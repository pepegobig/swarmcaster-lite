// Writes ../NOTICES.md: the third-party code and fonts that the single-file build can include, with their licenses.
// Run after npm install; `npm run build` runs it.
import { execSync } from "node:child_process";
import fs from "node:fs";
const paths = execSync("npm ls --omit=dev --all --parseable", { encoding: "utf8" }).trim().split("\n").slice(1);
const rows = new Map();
for (const p of paths) {
  const j = JSON.parse(fs.readFileSync(`${p}/package.json`, "utf8"));
  const lic = typeof j.license === "string" ? j.license : (j.licenses || []).map((l) => l.type || l).join(" OR ") || "see package";
  rows.set(`${j.name}@${j.version}`, { name: j.name, version: j.version, lic, home: j.homepage || (j.repository && (j.repository.url || j.repository)) || "" });
}
const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
const out = [
  "# Third-party notices",
  "",
  "The Swarmcaster Lite page (`index.html`) is one file built from `app/`. It bundles code and fonts from the packages",
  "below, each under its own license. Swarmcaster Lite itself is MIT licensed (`LICENSE`).",
  "",
  "- **IBM Plex Sans and IBM Plex Mono** (latin subset, embedded): Copyright © 2017 IBM Corp., SIL Open Font License 1.1,",
  "  https://github.com/IBM/plex. The fonts are not sold on their own and keep their reserved font name.",
  "- The JavaScript packages that the build can include, from `npm ls --omit=dev` (the build leaves out unused code):",
  "",
  "| Package | Version | License |",
  "|---|---|---|",
  ...list.map((r) => `| ${r.name} | ${r.version} | ${r.lic} |`),
  "",
].join("\n");
fs.writeFileSync("../NOTICES.md", out);
console.log(`NOTICES.md: ${list.length} packages`);
