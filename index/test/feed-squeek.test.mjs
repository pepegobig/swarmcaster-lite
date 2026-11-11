// The Feed Squeek relay passes only the level list and level files, with CORS, and nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// src/index.js imports Cloudflare's runtime module; the relay needs none of it, so a stub stands in.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }", shortCircuit: true };
    return next(specifier, context);
  },
});
const { default: worker } = await import("../src/index.js");

const get = (path) => worker.fetch(new Request("https://index.example" + path), {});

test("relays the level list and a level file with CORS", async () => {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => { seen.push(String(url)); return new Response(String(url).endsWith(".json") ? '{"levels":[]}' : "FeedSqueek.level({});"); };
  try {
    const a = await get("/feed-squeek/levels/index.json");
    assert.equal(a.status, 200);
    assert.equal(a.headers.get("access-control-allow-origin"), "*");
    assert.equal(await a.text(), '{"levels":[]}');
    const b = await get("/feed-squeek/levels/football-stadium-4f5d.js");
    assert.equal(b.headers.get("content-type"), "text/plain; charset=utf-8");
    const c = await get("/feed-squeek/levels/index.sig");
    assert.equal(c.status, 200);
    assert.deepEqual(seen, ["https://feed-squeek.imd.site/levels/index.json", "https://feed-squeek.imd.site/levels/football-stadium-4f5d.js",
      "https://feed-squeek.imd.site/levels/index.sig"]);
  } finally { globalThis.fetch = real; }
});

test("refuses other paths and oversized files", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response("x".repeat(70 * 1024));
  try {
    for (const p of ["/feed-squeek/levels/../index.html", "/feed-squeek/levels/BAD.js", "/feed-squeek/painter.js", "/feed-squeek/levels/a.json"]) {
      assert.equal((await get(p)).status, 404, p);
    }
    assert.equal((await get("/feed-squeek/levels/big-level.js")).status, 502);
  } finally { globalThis.fetch = real; }
});
