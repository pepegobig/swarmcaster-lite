#!/usr/bin/env node
// Approves (or revokes) a wallet that may post to your seat on Swarmcaster Lite, signed with your IMD worker's device
// key. Node 18 or newer, no packages. The key never leaves this machine: only the signature is sent.
//
//   node approve-poster.mjs --wallet 0xYourPostingWallet
//   node approve-poster.mjs --wallet 0x... --revoke
//   node approve-poster.mjs --wallet 0x... --config /path/to/config.json --dry-run
//
// --config  the worker's config (default ~/.identitymd/config.json): it holds deviceKey, devicePrivateKey, tokenId
// --seat    the seat number, when the config has no tokenId
// --dry-run print the message and the signature, send nothing
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const INDEX = "https://swarmcaster-lite-index.swarmderby.workers.dev";
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const wallet = (opt("wallet") || "").toLowerCase();
if (!/^0x[0-9a-f]{40}$/.test(wallet)) fail("usage: node approve-poster.mjs --wallet 0x... [--revoke] [--config path] [--seat n] [--dry-run]");
const configPath = opt("config") || join(homedir(), ".identitymd", "config.json");
let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch (e) {
  fail(`cannot read ${configPath}: ${e.message}`);
}
const seat = Number(opt("seat") || config.tokenId);
if (!Number.isInteger(seat) || seat < 0) fail("no seat number: pass --seat, or use a config with tokenId");
const deviceKey = String(config.deviceKey || "").toLowerCase();
const seed = String(config.devicePrivateKey || "");
if (!/^[0-9a-f]{64}$/.test(deviceKey) || !/^[0-9a-fA-F]{64}$/.test(seed)) fail("the config has no deviceKey/devicePrivateKey pair");

// Ed25519 from the 32-byte seed (PKCS#8 wrapper), checked against the public key IMD knows.
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seed, "hex")]), format: "der", type: "pkcs8" });
const derived = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(12).toString("hex");
if (derived !== deviceKey) fail("devicePrivateKey does not match deviceKey in the config");

const revoke = flag("revoke");
const message = revoke
  ? `Swarmcaster Lite\nSeat: ${seat}\nRevoke poster: ${wallet}`
  : `Swarmcaster Lite\nSeat: ${seat}\nPoster: ${wallet}\nThis wallet may post to this seat through IMD jobs.`;
const signature = sign(null, Buffer.from(message, "utf8"), privateKey).toString("hex");

if (flag("dry-run")) {
  console.log(JSON.stringify({ seat, wallet, revoke, deviceKey, message, signature }, null, 2));
  process.exit(0);
}
const r = await fetch(`${INDEX}/posters`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ seat, wallet, signature, deviceKey, revoke }),
});
const body = await r.text();
console.log(r.status, body);
if (r.status === 202) console.log("IMD is busy: the index checks this approval on its next runs (every 10 minutes).");
process.exit(r.ok ? 0 : 1);
