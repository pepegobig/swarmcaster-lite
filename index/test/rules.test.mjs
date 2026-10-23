import { test } from "node:test";
import assert from "node:assert/strict";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { approvalMessage, decide, parseJob, pickFiles, pickManifest, recoverSigner, revokeMessage, verifyDevice } from "../src/rules.js";

const addressOf = (priv) => "0x" + bytesToHex(keccak_256(secp256k1.getPublicKey(priv, false).slice(1)).slice(-20));
function personalSign(priv, message) {
  const msg = utf8ToBytes(message);
  const digest = keccak_256(new Uint8Array([...utf8ToBytes(`\x19Ethereum Signed Message:\n${msg.length}`), ...msg]));
  const sig = secp256k1.sign(digest, priv);
  return "0x" + bytesToHex(sig.toCompactRawBytes()) + (27 + sig.recovery).toString(16);
}

test("parseJob reads the three line kinds and ignores other jobs", () => {
  assert.equal(parseJob("Make a video of Pepe"), null);
  assert.equal(parseJob("Swarmcaster post: seat abc"), null);
  assert.deepEqual(parseJob("Make a short video of Pepe at bat.\nSwarmcaster post: seat 912\nOutputs: video"), {
    kind: "post", seat: 912, text: "Make a short video of Pepe at bat.", link: null,
  });
  const linked = parseJob("Swarmcaster post: seat 912\nSwarmcaster link: https://swarm-derby.sites.imd.fun/\nSwarmcaster text: Play ball");
  assert.equal(linked.link, "https://swarm-derby.sites.imd.fun/");
  assert.equal(linked.text, "Play ball");
  assert.equal(parseJob("Swarmcaster post: seat 1\nSwarmcaster link: javascript:alert(1)\nHello").link, null);
  assert.equal(parseJob("Swarmcaster post: seat 1\nSwarmcaster link: https://a.example/\nHello").text, "Hello");
  assert.equal(parseJob("Swarmcaster post: seat #912\nSwarmcaster text: Hello swarm\nMore detail").text, "Hello swarm");
  const p = parseJob("swarmcaster profile: seat 7\nname: Gus\nbio: Slugger on deck\nlink: https://example.com\nlink: javascript:alert(1)\nlink: http://plain.example");
  assert.deepEqual(p, { kind: "profile", seat: 7, name: "Gus", bio: "Slugger on deck", links: ["https://example.com"] });
  assert.deepEqual(parseJob("Build a mini app\nSwarmcaster app: seat 1"), { kind: "app", seat: 1 });
  assert.equal(parseJob("Swarmcaster post: seat 912\n" + "x".repeat(400)).text.length, 280);
});

test("decide accepts the owner and the owner's approved posters only", () => {
  const owner = "0x710fed1a6ef0249292df001cdcbdae386b637733";
  const poster = "0xc3f59e5dd9e8d8a74631c0ea68e38fd49ff1b04b";
  assert.deepEqual(decide(owner.toUpperCase().replace("0X", "0x"), owner, []), { ok: true, reason: "owner" });
  assert.deepEqual(decide(poster, owner, []), { ok: false, reason: "not_owner_or_poster" });
  assert.deepEqual(decide(poster, owner, [{ wallet: poster, owner }]), { ok: true, reason: "poster" });
  // An approval from an earlier owner stops counting when the seat changes hands.
  assert.deepEqual(decide(poster, "0x" + "1".repeat(40), [{ wallet: poster, owner }]), { ok: false, reason: "not_owner_or_poster" });
  assert.deepEqual(decide(null, owner, []), { ok: false, reason: "unpaid" });
});

test("recoverSigner returns the personal_sign signer", () => {
  const priv = secp256k1.utils.randomPrivateKey();
  const other = secp256k1.utils.randomPrivateKey();
  const poster = "0xC3F59E5DD9E8D8A74631C0EA68E38FD49FF1B04B";
  const msg = approvalMessage(912, poster);
  assert.match(msg, /Poster: 0xc3f59e5dd9e8d8a74631c0ea68e38fd49ff1b04b/);
  assert.equal(recoverSigner(msg, personalSign(priv, msg)), addressOf(priv));
  assert.notEqual(recoverSigner(msg, personalSign(other, msg)), addressOf(priv));
  assert.notEqual(recoverSigner(revokeMessage(912, poster), personalSign(priv, msg)), addressOf(priv));
  assert.throws(() => recoverSigner(msg, "0x1234"), /bad_signature/);
});

test("recoverSigner matches a known Ethereum vector", () => {
  // Private key 0x...01 has the well-known address 0x7e5f4552091a69125d5dfcb7b8c2659029395bdf.
  const priv = new Uint8Array(32);
  priv[31] = 1;
  assert.equal(addressOf(priv), "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf");
  const msg = approvalMessage(1, "0x" + "a".repeat(40));
  assert.equal(recoverSigner(msg, personalSign(priv, msg)), "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf");
});

test("pickFiles keeps IMD artifact media only", () => {
  const files = pickFiles([
    { name: "video", path: "artifacts/video.mp4", hash: "ab", bytes: 10 },
    { name: "poster", url: "https://api.imd.fun/artifacts/cd", mediaType: "image/png" },
    { name: "script", path: "src/build.sh", hash: "ef" },
    { name: "evil", url: "https://evil.example/x.png", mediaType: "image/png" },
  ]);
  assert.deepEqual(files.map((f) => [f.name, f.type, f.url]), [
    ["video", "video/mp4", "https://api.imd.fun/artifacts/ab"],
    ["poster", "image/png", "https://api.imd.fun/artifacts/cd"],
  ]);
});

test("pickManifest reads miniapp and frame manifests", () => {
  const m = pickManifest({ miniapp: { name: "Lobby", homeUrl: "https://neighborslobby.com/", iconUrl: "http://x/i.png", splashBackgroundColor: "#1a1a2e" } }, "https://fallback/");
  assert.equal(m.name, "Lobby");
  assert.equal(m.iconUrl, null);
  assert.equal(m.splashBackgroundColor, "#1a1a2e");
  assert.equal(pickManifest({ frame: { name: "Old", homeUrl: "javascript:x" } }, "https://site/").homeUrl, "https://site/");
  assert.equal(pickManifest({}, "https://site/"), null);
});

test("verifyDevice checks an IMD device key's Ed25519 signature", async () => {
  const { ed25519 } = await import("@noble/curves/ed25519");
  const seed = ed25519.utils.randomPrivateKey();
  const pub = bytesToHex(ed25519.getPublicKey(seed));
  const msg = approvalMessage(912, "0xc3f59e5dd9e8d8a74631c0ea68e38fd49ff1b04b");
  const sig = bytesToHex(ed25519.sign(utf8ToBytes(msg), seed));
  assert.equal(verifyDevice(msg, sig, pub), true);
  assert.equal(verifyDevice(msg, "0x" + sig, pub), true);
  assert.equal(verifyDevice(revokeMessage(912, "0xc3f59e5dd9e8d8a74631c0ea68e38fd49ff1b04b"), sig, pub), false);
  assert.equal(verifyDevice(msg, sig, bytesToHex(ed25519.getPublicKey(ed25519.utils.randomPrivateKey()))), false);
  assert.equal(verifyDevice(msg, "abcd", pub), false);
});
