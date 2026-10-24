// Swarmcaster Lite index: reads the IMD API server-side and serves seat profiles, posts and mini apps with CORS, because
// the IMD API sends no CORS headers. Rules: SPEC.md in the repository root.
//   GET  /seats            every seat with IMD work, with its Swarmcaster name, picture and accepted post count
//   GET  /seats/:tokenId   the IMD seat record (owner, stats, work) plus profile, posts, apps and approved posters
//   GET  /feed             every seat's posts, newest first (?before=<createdAt>&limit=1..50)
//   GET  /apps             the mini apps seats published through swarm jobs, newest first
//   GET  /jobs/:id         whether an IMD job counts for a seat, and why not
//   GET  /status           index health
//   POST /posters          { seat, wallet, signature, deviceKey?, revoke? }: the seat owner, or the seat's enrolled
//                          worker device, approves or revokes a poster wallet
// A cron every 10 minutes finds IMD jobs with a "Swarmcaster post|profile|app: seat N" line and records the finished ones.
import { DurableObject } from "cloudflare:workers";
import { approvalMessage, decide, isAddress, isDeviceKey, parseJob, pickFiles, pickManifest, recoverSigner, revokeMessage, verifyDevice } from "./rules.js";

const IMD = "https://api.imd.fun";
const RECORDS_TTL_MS = 10 * 60_000; // IMD caches /seats/records up to 10 minutes
const SEAT_TTL_MS = 60_000;
// Per cron run: 2 list reads, up to MAX_LOOKUPS full job reads, MAX_JOBS_PER_RUN jobs of up to 5 reads each and
// 3 queued posters of 2 reads each stay under the free plan's 50 subrequests.
const MAX_JOBS_PER_RUN = 6;
const MAX_LOOKUPS = 8;
const IMD_TIMEOUT_MS = 10_000; // page requests
const SCAN_TIMEOUT_MS = 25_000; // the cron's job search, which IMD answers slowly under load
const TERMINAL = new Set(["blocked", "failed", "cancelled", "refunded", "expired"]);

async function imdAt(base, path, timeoutMs = IMD_TIMEOUT_MS) {
  let r;
  try {
    r = await fetch(base + path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new Error(`${path} ${e && e.name === "TimeoutError" ? "timed out" : "network error"}`);
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${path} answered ${r.status}`);
  return r.json();
}

export class SwarmIndex extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, seat INTEGER NOT NULL, kind TEXT NOT NULL, state TEXT NOT NULL,
        status TEXT NOT NULL, reason TEXT, paid_by TEXT, created_at TEXT, data TEXT, updated_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS jobs_seat ON jobs (seat, status);
      CREATE TABLE IF NOT EXISTS posters (seat INTEGER NOT NULL, wallet TEXT NOT NULL, owner TEXT NOT NULL,
        signature TEXT NOT NULL, signed_at INTEGER NOT NULL, via TEXT, PRIMARY KEY (seat, wallet));`);
    try {
      this.sql.exec("ALTER TABLE posters ADD COLUMN via TEXT"); // tables made before device approvals
    } catch {}
    this.sql.exec(`CREATE TABLE IF NOT EXISTS queued_posters (seat INTEGER NOT NULL, wallet TEXT NOT NULL, signature TEXT NOT NULL,
      device_key TEXT, revoke INTEGER NOT NULL, received_at INTEGER NOT NULL, PRIMARY KEY (seat, wallet, revoke));`);
    this.seatCache = new Map(); // tokenId -> { at, body }
    this.base = env.IMD_API || IMD; // IMD_API points a local test run at a mock
  }

  imd(path, timeoutMs) {
    return imdAt(this.base, path, timeoutMs);
  }

  kvGet(k) {
    const rows = this.sql.exec("SELECT v FROM kv WHERE k = ?", k).toArray();
    return rows.length ? JSON.parse(rows[0].v) : null;
  }
  kvSet(k, v) {
    this.sql.exec("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, JSON.stringify(v));
  }

  async records(force = false) {
    const cur = this.kvGet("records");
    if (cur && !force && Date.now() - cur.at < RECORDS_TTL_MS) return cur;
    const body = await this.imd("/seats/records");
    const next = { at: Date.now(), seats: (body && body.seats) || [] };
    this.kvSet("records", next);
    return next;
  }

  // The IMD seat record, fresh for SEAT_TTL_MS. When IMD is busy, the last good copy is served (memory, then storage).
  async seatRecord(tokenId) {
    const hit = this.seatCache.get(tokenId);
    if (hit && Date.now() - hit.at < SEAT_TTL_MS) return hit.body;
    let body;
    try {
      body = await this.imd(`/seats/${tokenId}?work=30&reviews=0&collaborators=0`);
    } catch (e) {
      const stale = hit ? hit.body : this.kvGet(`seat:${tokenId}`);
      if (stale) return stale;
      throw e;
    }
    if (this.seatCache.size > 2000) this.seatCache.clear();
    this.seatCache.set(tokenId, { at: Date.now(), body });
    if (body) this.kvSet(`seat:${tokenId}`, body);
    return body;
  }

  accepted(seat, kind) {
    const rows = this.sql
      .exec("SELECT id, created_at, paid_by, data FROM jobs WHERE seat = ? AND kind = ? AND status = 'accepted' ORDER BY created_at DESC", seat, kind)
      .toArray();
    return rows.map((r) => ({ jobId: r.id, createdAt: r.created_at, paidBy: r.paid_by, ...JSON.parse(r.data || "{}") }));
  }

  profile(seat) {
    const out = { name: null, bio: null, links: [], picture: null };
    for (const p of this.accepted(seat, "profile")) {
      out.name ??= p.name || null;
      out.bio ??= p.bio || null;
      if (!out.links.length && p.links && p.links.length) out.links = p.links;
      out.picture ??= p.picture || null;
    }
    return out;
  }

  posters(seat) {
    return this.sql.exec("SELECT wallet, owner, signed_at, via FROM posters WHERE seat = ?", seat).toArray();
  }

  async getSeats() {
    const { at, seats } = await this.records();
    const named = new Map();
    for (const r of this.sql.exec("SELECT DISTINCT seat FROM jobs WHERE kind = 'profile' AND status = 'accepted'").toArray()) {
      const p = this.profile(r.seat);
      named.set(String(r.seat), { name: p.name, picture: p.picture });
    }
    const posts = new Map(
      this.sql
        .exec("SELECT seat, COUNT(*) AS n FROM jobs WHERE kind = 'post' AND status = 'accepted' GROUP BY seat")
        .toArray()
        .map((r) => [String(r.seat), r.n]),
    );
    return {
      updatedAt: new Date(at).toISOString(),
      count: seats.length,
      seats: seats.map((s) => ({
        ...s,
        ...(named.get(String(s.tokenId)) || { name: null, picture: null }),
        posts: posts.get(String(s.tokenId)) || 0,
      })),
    };
  }

  async getSeat(tokenId) {
    const record = await this.seatRecord(tokenId);
    if (!record) return null;
    const seat = Number(tokenId);
    return {
      seat: record,
      profile: this.profile(seat),
      posts: this.accepted(seat, "post"),
      apps: this.accepted(seat, "app"),
      posters: this.posters(seat).map((p) => ({ wallet: p.wallet, approvedBy: p.via || "owner", approvedAt: new Date(p.signed_at).toISOString() })),
    };
  }

  // The home feed: accepted posts of every seat, newest first, each with its seat's name, picture and agent id.
  async getFeed(before, limit) {
    const rows = this.sql
      .exec(
        "SELECT id, seat, created_at, paid_by, data FROM jobs WHERE kind = 'post' AND status = 'accepted' AND (? IS NULL OR created_at < ?) ORDER BY created_at DESC LIMIT ?",
        before, before, limit,
      )
      .toArray();
    const agents = new Map(((this.kvGet("records") || {}).seats || []).map((r) => [String(r.tokenId), r.agentId]));
    const profiles = new Map();
    const posts = rows.map((r) => {
      if (!profiles.has(r.seat)) profiles.set(r.seat, this.profile(r.seat));
      const p = profiles.get(r.seat);
      return {
        jobId: r.id, seat: r.seat, agentId: agents.get(String(r.seat)) || null, name: p.name, picture: p.picture,
        createdAt: r.created_at, paidBy: r.paid_by, ...JSON.parse(r.data || "{}"),
      };
    });
    return { posts, next: posts.length === limit ? posts[posts.length - 1].createdAt : null };
  }

  getApps() {
    const apps = this.sql
      .exec("SELECT id, seat, created_at, data FROM jobs WHERE kind = 'app' AND status = 'accepted' ORDER BY created_at DESC")
      .toArray()
      .map((r) => ({ ...JSON.parse(r.data || "{}"), seat: r.seat, jobId: r.id, createdAt: r.created_at }));
    return { apps };
  }

  getJob(id) {
    const r = this.sql.exec("SELECT id, seat, kind, state, status, reason, paid_by, created_at FROM jobs WHERE id = ?", id).toArray()[0];
    return r ? { jobId: r.id, seat: r.seat, kind: r.kind, jobState: r.state, status: r.status, reason: r.reason, paidBy: r.paid_by, createdAt: r.created_at } : null;
  }

  getStatus() {
    const count = (q) => this.sql.exec(q).toArray()[0].n;
    return {
      lastScan: this.kvGet("lastScan"),
      lastError: this.kvGet("lastError"),
      jobs: count("SELECT COUNT(*) AS n FROM jobs"),
      accepted: count("SELECT COUNT(*) AS n FROM jobs WHERE status = 'accepted'"),
      pending: count("SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'"),
      posters: count("SELECT COUNT(*) AS n FROM posters"),
      queuedPosters: count("SELECT COUNT(*) AS n FROM queued_posters"),
      lastQueuedPoster: this.kvGet("lastQueuedPoster"),
    };
  }

  // The owner signs with its wallet (personal_sign), or the seat's worker signs with its IMD device key: IMD enrolls a
  // device for a seat only after the owner signs the pairing, and /workers/:deviceKey/standing names that seat.
  // While IMD is busy, a request is queued and checked by the next cron runs; the signature alone authorizes nothing.
  async requestPoster(seat, wallet, signature, revoke, deviceKey) {
    try {
      return await this.setPoster(seat, wallet, signature, revoke, deviceKey);
    } catch (e) {
      if (!/answered (429|503)|timed out|network error/.test(String(e && e.message))) throw e;
      this.sql.exec(
        "INSERT INTO queued_posters (seat, wallet, signature, device_key, revoke, received_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(seat, wallet, revoke) DO UPDATE SET signature = excluded.signature, device_key = excluded.device_key, received_at = excluded.received_at",
        seat, wallet.toLowerCase(), signature, deviceKey || null, revoke ? 1 : 0, Date.now(),
      );
      return { status: 202, body: { seat, wallet: wallet.toLowerCase(), queued: true, message: "IMD is busy; the index checks this request on its next runs" } };
    }
  }

  async drainQueuedPosters() {
    for (const q of this.sql.exec("SELECT * FROM queued_posters ORDER BY received_at LIMIT 3").toArray()) {
      let r;
      try {
        r = await this.setPoster(q.seat, q.wallet, q.signature, q.revoke === 1, q.device_key || undefined);
      } catch {
        return; // IMD still busy: keep the queue for the next run
      }
      this.sql.exec("DELETE FROM queued_posters WHERE seat = ? AND wallet = ? AND revoke = ?", q.seat, q.wallet, q.revoke);
      this.kvSet("lastQueuedPoster", { at: Date.now(), seat: q.seat, wallet: q.wallet, revoke: q.revoke === 1, status: r.status, result: r.body.error || "ok" });
    }
  }

  async setPoster(seat, wallet, signature, revoke, deviceKey) {
    const record = await this.seatRecord(String(seat));
    if (!record || !isAddress(record.owner)) return { status: 404, body: { error: "unknown_seat" } };
    const message = revoke ? revokeMessage(seat, wallet) : approvalMessage(seat, wallet);
    const owner = record.owner.toLowerCase();
    let via = "owner";
    if (deviceKey) {
      const standing = await this.imd(`/workers/${deviceKey}/standing?queue=0`);
      const e = standing && standing.enrollment;
      if (!e || e.status !== "active" || String(e.tokenId) !== String(seat)) return { status: 403, body: { error: "not_seat_device", message } };
      if (!verifyDevice(message, signature, deviceKey)) return { status: 400, body: { error: "bad_signature", message } };
      via = "device";
    } else {
      let signer;
      try {
        signer = recoverSigner(message, signature);
      } catch {
        return { status: 400, body: { error: "bad_signature", message } };
      }
      if (signer !== owner) return { status: 403, body: { error: "not_owner", message } };
    }
    if (revoke) this.sql.exec("DELETE FROM posters WHERE seat = ? AND wallet = ?", seat, wallet.toLowerCase());
    else
      this.sql.exec(
        "INSERT INTO posters (seat, wallet, owner, signature, signed_at, via) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(seat, wallet) DO UPDATE SET owner = excluded.owner, signature = excluded.signature, signed_at = excluded.signed_at, via = excluded.via",
        seat, wallet.toLowerCase(), owner, signature, Date.now(), via,
      );
    // An approval sends the seat's refused jobs back to the queue: the next run reads them in full and decides again.
    // A revoke refuses the jobs that counted only through a poster approval.
    if (!revoke) this.sql.exec("UPDATE jobs SET status = 'pending', updated_at = ? WHERE seat = ? AND status = 'rejected' AND reason = 'not_owner_or_poster'", Date.now(), seat);
    else
      for (const j of this.sql.exec("SELECT id, paid_by FROM jobs WHERE seat = ? AND status = 'accepted' AND reason = 'poster'", seat).toArray()) {
        const d = decide(j.paid_by, owner, this.posters(seat));
        if (!d.ok) this.sql.exec("UPDATE jobs SET status = 'rejected', reason = ?, updated_at = ? WHERE id = ?", d.reason, Date.now(), j.id);
      }
    return { status: 200, body: { seat, posters: this.posters(seat).map((p) => p.wallet) } };
  }

  // One cron run: list the jobs that moved since the last run, then record up to MAX_JOBS_PER_RUN finished ones.
  async scan() {
    const startedAt = Date.now();
    try {
      await this.records();
      await this.drainQueuedPosters();
      const last = this.kvGet("lastScan");
      const since = last ? `&since=${encodeURIComponent(new Date(last.at - 15 * 60_000).toISOString())}` : "";
      const list = (await this.imd(`/jobs?q=Swarmcaster&limit=100${since}`, SCAN_TIMEOUT_MS)) || { jobs: [] };
      let lookups = 0;
      for (const j of list.jobs || []) {
        const row = this.sql.exec("SELECT status, state FROM jobs WHERE id = ?", j.id).toArray()[0];
        if (row && row.state === j.state && row.status !== "pending") continue;
        let parsed = parseJob(j.objective);
        // The job list cuts objectives at about 155 characters ("…"), so a Swarmcaster line further down is only in
        // the job record itself.
        if (!parsed && /…\s*$/.test(j.objective || "")) {
          if (lookups >= MAX_LOOKUPS) continue; // the next run reads it
          lookups++;
          const full = await this.imd(`/jobs/${j.id}`);
          if (!full) continue;
          parsed = parseJob(full.objective);
        }
        if (!parsed) {
          // Remembered so that the next runs skip it until its state changes.
          this.sql.exec(
            "INSERT INTO jobs (id, seat, kind, state, status, reason, created_at, updated_at) VALUES (?, -1, 'none', ?, 'ignored', 'no_line', ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at",
            j.id, j.state, j.createdAt, Date.now(),
          );
          continue;
        }
        const status = j.state === "completed" ? "pending" : TERMINAL.has(j.state) ? "rejected" : "waiting";
        this.sql.exec(
          "INSERT INTO jobs (id, seat, kind, state, status, reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state, status = excluded.status, reason = excluded.reason, updated_at = excluded.updated_at",
          j.id, parsed.seat, parsed.kind, j.state, status, status === "rejected" ? `job_${j.state}` : null, j.createdAt, Date.now(),
        );
      }
      // App jobs refused for a missing site or manifest are checked again for 24 hours: pinning and naming finish
      // after the job does.
      this.sql.exec(
        "UPDATE jobs SET status = 'pending' WHERE kind = 'app' AND status = 'rejected' AND reason IN ('no_site', 'no_manifest') AND created_at > ?",
        new Date(Date.now() - 86_400_000).toISOString(),
      );
      const queue = this.sql.exec("SELECT id FROM jobs WHERE status = 'pending' ORDER BY created_at LIMIT ?", MAX_JOBS_PER_RUN).toArray();
      let media = null; // committed media of jobs without outputs[], read once per run when needed
      for (const { id } of queue) {
        const job = await this.imd(`/jobs/${id}`);
        if (!job) continue;
        const parsed = parseJob(job.objective);
        if (!parsed) {
          this.sql.exec("UPDATE jobs SET status = 'rejected', reason = 'no_line', updated_at = ? WHERE id = ?", Date.now(), id);
          continue;
        }
        // A site is served once IMD pins it ("pinned") and names it under ENS ("named"); until then the job waits.
        const siteState = job.site && job.site.status;
        if (siteState && !["pinned", "named", "failed", "held", "taken_down"].includes(siteState)) continue;
        const record = await this.seatRecord(String(parsed.seat));
        const verdict = record ? decide(job.paidBy, record.owner, this.posters(parsed.seat)) : { ok: false, reason: "unknown_seat" };
        const data = { ...parsed };
        delete data.kind;
        delete data.seat;
        if (verdict.ok) {
          const result = (await this.imd(`/jobs/${id}/result`)) || {};
          let files = pickFiles(result.files);
          if (!files.length && parsed.kind !== "app") {
            media ??= await this.imd(`/publications?q=Swarmcaster&type=media&pageSize=100`).catch(() => null);
            const item = ((media && media.items) || []).find((x) => x.id === `job:${id}`);
            files = pickFiles(((item && item.media) || []).flatMap((m) => m.files || []));
          }
          const site = ["pinned", "named"].includes(siteState) && job.site.label ? `https://${job.site.label}.sites.imd.fun` : null;
          if (parsed.kind === "post") Object.assign(data, { files, site, launch: job.launch && job.launch.id ? job.launch : null });
          if (parsed.kind === "profile") data.picture = (files.find((f) => f.type.startsWith("image/")) || {}).url || null;
          if (parsed.kind === "app") {
            // The standard place is /.well-known/farcaster.json; IMD site jobs cannot publish dot folders, so an
            // IMD-hosted app serves the same manifest at /farcaster.json.
            const read = (path) => fetch(`${site}${path}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
            const manifest = site ? (await read("/.well-known/farcaster.json")) || (await read("/farcaster.json")) : null;
            const app = pickManifest(manifest, site);
            if (!app) Object.assign(verdict, { ok: false, reason: site ? "no_manifest" : "no_site" });
            else Object.assign(data, app, { site });
          }
        }
        this.sql.exec(
          "UPDATE jobs SET status = ?, reason = ?, paid_by = ?, created_at = ?, data = ?, updated_at = ? WHERE id = ?",
          verdict.ok ? "accepted" : "rejected", verdict.reason, (job.paidBy || "").toLowerCase() || null, job.createdAt, JSON.stringify(data), Date.now(), id,
        );
      }
      this.kvSet("lastScan", { at: startedAt, listed: (list.jobs || []).length, processed: queue.length });
      this.kvSet("lastError", null);
    } catch (e) {
      this.kvSet("lastError", { at: Date.now(), message: String(e && e.message ? e.message : e).slice(0, 200) });
    }
  }
}

const index = (env) => env.INDEX.get(env.INDEX.idFromName("global"));

function respond(body, status = 200, maxAge = 0) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (request.method === "OPTIONS") return respond(null, 204);
      if (request.method === "GET") {
        if (path === "/seats") return respond(await index(env).getSeats(), 200, 60);
        const m = /^\/seats\/(\d{1,6})$/.exec(path);
        if (m) {
          const body = await index(env).getSeat(String(Number(m[1])));
          return body ? respond(body, 200, 30) : respond({ error: "unknown_seat" }, 404);
        }
        if (path === "/apps") return respond(await index(env).getApps(), 200, 60);
        if (path === "/feed") {
          const before = url.searchParams.get("before");
          if (before !== null && Number.isNaN(Date.parse(before))) return respond({ error: "bad_before" }, 400);
          const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 30));
          return respond(await index(env).getFeed(before, limit), 200, 30);
        }
        const j = /^\/jobs\/([0-9a-zA-Z-]{1,64})$/.exec(path);
        if (j) {
          const body = await index(env).getJob(j[1]);
          return body ? respond(body) : respond({ error: "unknown_job" }, 404);
        }
        if (path === "/status") return respond(await index(env).getStatus());
        if (path === "/") return respond({ name: "Swarmcaster Lite index", routes: ["/feed", "/seats", "/seats/:tokenId", "/apps", "/jobs/:id", "/status", "POST /posters"] });
      }
      if (request.method === "POST" && path === "/posters") {
        let b;
        try {
          b = await request.json();
        } catch {
          return respond({ error: "bad_json" }, 400);
        }
        const seat = Number(b && b.seat);
        if (!Number.isInteger(seat) || seat < 0 || seat > 999999) return respond({ error: "bad_seat" }, 400);
        if (!isAddress(b.wallet)) return respond({ error: "bad_wallet" }, 400);
        if (typeof b.signature !== "string") return respond({ error: "bad_signature" }, 400);
        if (b.deviceKey !== undefined && !isDeviceKey(b.deviceKey)) return respond({ error: "bad_device_key" }, 400);
        const r = await index(env).requestPoster(seat, b.wallet, b.signature, b.revoke === true, b.deviceKey);
        return respond(r.body, r.status);
      }
      return respond({ error: "not_found" }, 404);
    } catch (e) {
      const message = String(e && e.message ? e.message : e).slice(0, 200);
      if (/answered (429|503)|timed out|network error/.test(message)) return respond({ error: "imd_busy", message: "IMD is busy; try again in a moment" }, 503);
      return respond({ error: "upstream", message }, 502);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(index(env).scan());
  },
};
