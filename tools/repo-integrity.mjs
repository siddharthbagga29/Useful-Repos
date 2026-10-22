#!/usr/bin/env node
// Repository integrity check. Reads every tracked file and fails if it finds a pattern that can run
// code without anyone deciding to run it. It never executes repository content.
//
//   node tools/repo-integrity.mjs            # scan the working tree's tracked files
//   node tools/repo-integrity.mjs --rev HEAD # scan a commit instead
//
// What it looks for (each was found in this repository; see docs/security/2026-10-code-integrity-review.md):
//   disguised-code       a font/image/archive file whose bytes are readable program text
//   hidden-after-space   code pushed out of view by a long run of spaces or tabs on one line
//   editor-autorun       an editor task that runs when the folder is opened, or settings that skip the prompt
//   npm-lifecycle        an install-time hook (preinstall, install, postinstall, prepare) in a package.json
//   dev-runs-loose-file  a "dev" script that first runs a stray .js file at the repository root
//   eval-and-spawn       one file that both evaluates code at run time and starts processes
//   chain-lookup         Ethereum RPC calls (used to look up where to download code from)
//
// A legitimate exception goes in tools/repo-integrity-allow.json as { "path": ..., "kind": ..., "why": ... }.
// Exit code: 0 clean, 1 findings, 2 the check itself could not run.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = "tools/repo-integrity.mjs";
const rev = process.argv.includes("--rev") ? process.argv[process.argv.indexOf("--rev") + 1] : null;

const BINARY_EXT = /\.(woff2?|ttf|eot|otf|png|jpe?g|gif|ico|webp|avif|zip|gz|pdf|mp3|mp4|wasm|bin)$/i;
// Built from parts so this file never contains the literal patterns it searches for.
const Q = '"';
const P = {
  autorunTask: new RegExp(`${Q}runOn${Q}\\s*:\\s*${Q}folder` + "Open" + Q),
  autorunAllow: new RegExp(`${Q}task\\.allowAutomatic` + `Tasks${Q}\\s*:\\s*(true|${Q}on${Q})`),
  // a bare eval( call; not a method such as Playwright's page.$$eval(
  dynamicEval: new RegExp("(?<![\\w$.])ev" + "al\\(|new Func" + "tion\\("),
  spawn: new RegExp("child_" + "process|\\bspawn\\(|\\bexecSync\\("),
  chain: new RegExp("eth_get" + "TransactionCount|eth_block" + "Number|eth_get" + "BlockByNumber"),
  codeish: /require\(|function\b|=>|\bglobal\.|import\s|\bconst\s/,
  hidden: /[ \t]{120,}(\S.{0,40})/,
};

function listFiles() {
  const args = rev ? ["ls-tree", "-r", "-z", "--name-only", rev] : ["ls-files", "-z"];
  return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", maxBuffer: 64 << 20 })
    .split("\0")
    .filter(Boolean);
}

function read(path) {
  if (rev) return execFileSync("git", ["-C", ROOT, "show", `${rev}:${path}`], { maxBuffer: 256 << 20 });
  const full = join(ROOT, path);
  return existsSync(full) ? readFileSync(full) : null; // deleted in the working tree but still in the index
}

// Text means "no zero bytes" (the usual git heuristic), so UTF-8 files with accents or symbols count.
const isText = (buf) => buf.length > 0 && !buf.subarray(0, 8000).includes(0);

const allowFile = join(ROOT, "tools/repo-integrity-allow.json");
const allow = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, "utf8")) : [];
const allowed = (path, kind) => allow.some((a) => a.path === path && a.kind === kind);

const findings = [];
const add = (kind, path, detail) => {
  if (!allowed(path, kind)) findings.push({ kind, path, detail });
};

let files;
try {
  files = listFiles();
} catch (e) {
  console.error(`integrity: could not list files: ${e.message}`);
  process.exit(2);
}

for (const path of files) {
  if (path === SELF || path.includes("node_modules/")) continue;
  const buf = read(path);
  if (!buf) continue;
  const text = isText(buf);
  if (BINARY_EXT.test(path)) {
    if (text && P.codeish.test(buf.subarray(0, 20000).toString("latin1"))) add("disguised-code", path, `${buf.length} bytes of program text in a binary-format file`);
    continue;
  }
  if (!text) continue;
  const s = buf.toString("latin1");
  const h = s.match(P.hidden);
  if (h) add("hidden-after-space", path, `long blank run, then: ${JSON.stringify(h[1].slice(0, 30))}`);
  if (P.autorunTask.test(s)) add("editor-autorun", path, "a task runs when the folder is opened");
  if (P.autorunAllow.test(s)) add("editor-autorun", path, "automatic tasks are allowed without a prompt");
  if (P.dynamicEval.test(s) && P.spawn.test(s)) add("eval-and-spawn", path, "evaluates code at run time and starts processes");
  if (P.chain.test(s)) add("chain-lookup", path, "Ethereum RPC calls");
  if (/(^|\/)package\.json$/.test(path)) {
    try {
      const scripts = JSON.parse(s).scripts ?? {};
      for (const k of ["preinstall", "install", "postinstall", "prepare"]) if (scripts[k]) add("npm-lifecycle", path, `${k}: ${scripts[k]}`);
      if (/^node\s+[^\s/]+\.(m?js|cjs)\s*&&/.test(scripts.dev ?? "")) add("dev-runs-loose-file", path, `dev: ${scripts.dev}`);
    } catch {
      add("unparseable-package-json", path, "package.json is not valid JSON");
    }
  }
}

const where = rev ? `commit ${rev}` : "working tree";
if (!findings.length) {
  console.log(`integrity: ${files.length} tracked files in the ${where}, no findings`);
  process.exit(0);
}
for (const f of findings) console.log(`integrity: ${f.kind.padEnd(22)} ${f.path} :: ${f.detail}`);
console.log(`integrity: ${findings.length} finding(s) in ${files.length} files (${where}). See docs/security/2026-10-code-integrity-review.md`);
process.exit(1);
