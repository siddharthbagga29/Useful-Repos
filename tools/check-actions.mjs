#!/usr/bin/env node
// Fails if a GitHub Actions step uses an action by tag or branch instead of a full commit SHA with its
// release named in a comment (`uses: owner/repo@<40 hex> # v7.0.1`). A tag can be moved to different
// code after review; a SHA can't. Covers active workflows and the copies in portfolio/deploy/.
// Reads files only. Exit 0 clean, 1 on findings.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIRS = [".github/workflows", "portfolio/deploy"];
const PINNED = /^[\w.-]+\/[\w.\/-]+@[0-9a-f]{40} # v\d+(\.\d+){0,2}$/;

const bad = [];
let count = 0;
for (const dir of DIRS) {
  let files = [];
  try {
    files = readdirSync(join(ROOT, dir)).filter((f) => /\.ya?ml$/.test(f));
  } catch {
    continue;
  }
  for (const f of files) {
    readFileSync(join(ROOT, dir, f), "utf8")
      .split("\n")
      .forEach((line, i) => {
        const m = line.match(/^\s*-?\s*uses:\s*(.+?)\s*$/);
        if (!m) return;
        const ref = m[1].replace(/^["']|["']$/g, "");
        if (ref.startsWith("./") || ref.startsWith("docker://")) return;
        count++;
        if (!PINNED.test(ref)) bad.push(`${dir}/${f}:${i + 1}  ${ref}`);
      });
  }
}

if (bad.length) {
  console.error(`actions: ${bad.length} of ${count} not pinned to a commit SHA with a version comment:`);
  for (const b of bad) console.error("  " + b);
  process.exit(1);
}
console.log(`actions: ${count} uses, all pinned to commit SHAs`);
