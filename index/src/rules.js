// Rules shared by the index Worker and its tests: which IMD jobs count for a seat, and poster approvals.
import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

const LINE = /^[ \t]*Swarmcaster (post|profile|app):[ \t]*seat[ \t]*#?(\d{1,6})[ \t]*$/im;
const MAX_TEXT = 280;
const MAX_NAME = 50;
const MAX_LINKS = 5;

export const isDeviceKey = (s) => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
export const isAddress = (s) => typeof s === "string" && /^0x[0-9a-fA-F]{40}$/.test(s);
export const isHttpsUrl = (s) => {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// The Swarmcaster line of a job objective, and the fields that kind of job carries; null when the job has none.
export function parseJob(objective) {
  const m = LINE.exec(objective || "");
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const seat = Number(m[2]);
  const lines = objective.split(/\r?\n/).map((l) => l.trim());
  const field = (name) => {
    const l = lines.find((x) => x.toLowerCase().startsWith(name + ":"));
    return l ? l.slice(name.length + 1).trim() : "";
  };
  if (kind === "post") {
    const text = field("swarmcaster text") || lines.find((x) => x && !LINE.test(x)) || "";
    return { kind, seat, text: clip(text, MAX_TEXT) };
  }
  if (kind === "profile") {
    const links = lines
      .filter((x) => /^link:/i.test(x))
      .map((x) => x.slice(5).trim())
      .filter(isHttpsUrl)
      .slice(0, MAX_LINKS);
    return { kind, seat, name: clip(field("name"), MAX_NAME), bio: clip(field("bio"), MAX_TEXT), links };
  }
  return { kind, seat };
}

// A job counts when the wallet that paid it is the seat owner or a poster the current owner approved.
export function decide(paidBy, owner, posters) {
  if (!isAddress(paidBy)) return { ok: false, reason: "unpaid" };
  if (!isAddress(owner)) return { ok: false, reason: "unknown_owner" };
  const payer = paidBy.toLowerCase();
  if (payer === owner.toLowerCase()) return { ok: true, reason: "owner" };
  if (posters.some((p) => p.wallet === payer && p.owner === owner.toLowerCase())) return { ok: true, reason: "poster" };
  return { ok: false, reason: "not_owner_or_poster" };
}

export const approvalMessage = (seat, wallet) =>
  `Swarmcaster Lite\nSeat: ${seat}\nPoster: ${wallet.toLowerCase()}\nThis wallet may post to this seat through IMD jobs.`;
export const revokeMessage = (seat, wallet) => `Swarmcaster Lite\nSeat: ${seat}\nRevoke poster: ${wallet.toLowerCase()}`;

// The address that signed `message` with personal_sign (EIP-191).
export function recoverSigner(message, signature) {
  const sig = hexToBytes(String(signature).replace(/^0x/, ""));
  if (sig.length !== 65) throw new Error("bad_signature");
  let v = sig[64];
  if (v >= 27) v -= 27;
  if (v !== 0 && v !== 1) throw new Error("bad_signature");
  const msg = utf8ToBytes(message);
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msg.length}`);
  const digest = keccak_256(new Uint8Array([...prefix, ...msg]));
  const point = secp256k1.Signature.fromCompact(sig.slice(0, 64)).addRecoveryBit(v).recoverPublicKey(digest);
  return "0x" + bytesToHex(keccak_256(point.toRawBytes(false).slice(1)).slice(-20));
}

// True when `signature` is the Ed25519 signature of `message` by the IMD worker device key `deviceKey` (64 hex).
export function verifyDevice(message, signature, deviceKey) {
  try {
    const sig = hexToBytes(String(signature).replace(/^0x/, ""));
    return sig.length === 64 && ed25519.verify(sig, utf8ToBytes(message), hexToBytes(deviceKey));
  } catch {
    return false;
  }
}

const TYPES = { mp4: "video/mp4", webm: "video/webm", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", mp3: "audio/mpeg", wav: "audio/wav", pdf: "application/pdf", md: "text/markdown" };

// The files a post shows: media and documents with an IMD artifact URL, at most 8.
export function pickFiles(files) {
  const out = [];
  for (const f of files || []) {
    const url = f.url || (f.hash ? `https://api.imd.fun/artifacts/${f.hash}` : "");
    if (!url.startsWith("https://api.imd.fun/artifacts/")) continue;
    const ext = String(f.path || f.name || "").split(".").pop().toLowerCase();
    const type = f.mediaType || TYPES[ext] || "";
    if (!/^(video|image|audio)\//.test(type) && !["application/pdf", "text/markdown"].includes(type)) continue;
    out.push({ name: String(f.name || f.path || "file").slice(0, 80), type, url, bytes: Number(f.bytes) || null });
    if (out.length === 8) break;
  }
  return out;
}

// The parts of a mini app manifest the directory shows.
export function pickManifest(json, fallbackHome) {
  const m = (json && (json.miniapp || json.frame)) || null;
  if (!m || !m.name) return null;
  const url = (s) => (isHttpsUrl(s) ? s : null);
  return {
    name: String(m.name).slice(0, 32),
    subtitle: m.subtitle ? String(m.subtitle).slice(0, 60) : null,
    homeUrl: url(m.homeUrl) || fallbackHome,
    iconUrl: url(m.iconUrl),
    splashImageUrl: url(m.splashImageUrl),
    splashBackgroundColor: /^#[0-9a-fA-F]{3,8}$/.test(m.splashBackgroundColor || "") ? m.splashBackgroundColor : null,
  };
}
