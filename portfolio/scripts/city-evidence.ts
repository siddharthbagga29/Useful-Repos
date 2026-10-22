// Build-time evidence snapshot for the Research City: src/research/evidence.json.
//   node --experimental-strip-types scripts/city-evidence.ts
//
// Records only what was observed while building:
//   - the last commits touching each project's paths (git)
//   - the latest public GitHub Actions runs of the Brain and the Jarvis CI (if the API answers)
//   - lab-check.ts, run now, and its pass count
//   - the last release-gate result written by the Jarvis loop
// Anything that can't be observed is written as { unavailable: reason }, never guessed. The site
// refreshes the Actions runs at runtime (cached); everything else is as of this build.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECTS } from "../src/research/manifest.ts";
import { WORKFLOWS, type WorkflowRun } from "../src/research/sources.ts";

const PORTFOLIO = resolve(import.meta.dirname, "..");
const ROOT = resolve(PORTFOLIO, "..");
const OUT = resolve(PORTFOLIO, "src/research/evidence.json");

const git = (...args: string[]) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim();

type Unavailable = { unavailable: string };

// Commits whose subject doesn't describe what they did to a project, annotated from the incident record.
const ANNOTATIONS: Record<string, string> = {
  "5f416f8": "Not the owner's change: this commit reused a real commit's title and added injected malicious code (api.js, sentinel/src/tailwind.config.js, package.json). Removed in 6ecd080.",
  "93a6d69": "Bulk upload. It also carried an injected payload in sentinel/src/tailwind.config.js, removed in 6ecd080.",
};

const commits: Record<string, { sha: string; at: string; subject: string; note?: string }[]> = {};
for (const p of PROJECTS) {
  if (!p.paths.length) {
    commits[p.id] = [];
    continue;
  }
  try {
    const out = git("log", "-n", "5", "--format=%H%x1f%cI%x1f%s", "--", ...p.paths);
    commits[p.id] = out
      ? out.split("\n").map((l) => {
          const [sha, at, subject] = l.split("\x1f");
          const note = Object.entries(ANNOTATIONS).find(([k]) => sha!.startsWith(k))?.[1];
          return { sha: sha!, at: new Date(at!).toISOString(), subject: subject!.slice(0, 140), ...(note ? { note } : {}) };
        })
      : [];
  } catch {
    commits[p.id] = [];
  }
}

function runs(w: (typeof WORKFLOWS)[number]): { runs: WorkflowRun[]; fetchedAt: string } | Unavailable {
  try {
    const body = execFileSync("curl", ["-sS", "--fail", "--max-time", "15", "-H", "Accept: application/vnd.github+json", `https://api.github.com/repos/${w.repo}/actions/workflows/${w.file}/runs?per_page=30`], { encoding: "utf8" });
    const j = JSON.parse(body) as { workflow_runs?: Record<string, unknown>[] };
    if (!Array.isArray(j.workflow_runs)) return { unavailable: "unexpected API response" };
    return {
      fetchedAt: new Date().toISOString(),
      runs: j.workflow_runs.map((r) => ({
        id: Number(r.id),
        number: Number(r.run_number),
        attempt: Number(r.run_attempt ?? 1),
        event: String(r.event),
        status: String(r.status),
        conclusion: r.conclusion === null ? null : String(r.conclusion),
        startedAt: String(r.run_started_at ?? r.created_at),
        updatedAt: String(r.updated_at),
        sha: String(r.head_sha),
        branch: String(r.head_branch),
        url: String(r.html_url),
      })),
    };
  } catch (e) {
    return { unavailable: `GitHub API not reachable at build time (${(e as Error).message.split("\n")[0]!.slice(0, 80)})` };
  }
}

const workflows = Object.fromEntries(WORKFLOWS.map((w) => [w.id, runs(w)]));

const t0 = Date.now();
const lab = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/lab-check.ts"], { cwd: PORTFOLIO, encoding: "utf8" });
const labOut = `${lab.stdout}${lab.stderr}`;
const labCheck = {
  ranAt: new Date().toISOString(),
  passed: lab.status === 0,
  checks: (labOut.match(/^pass {2}/gm) ?? []).length,
  failures: (labOut.match(/^FAIL/gm) ?? []).length,
  seconds: Math.round((Date.now() - t0) / 100) / 10,
};

let releaseGate: { at: string; passed: boolean; score: number } | Unavailable = { unavailable: "no eval history" };
const hist = resolve(PORTFOLIO, ".agent_logs/eval_history.json");
if (existsSync(hist)) {
  const h = JSON.parse(readFileSync(hist, "utf8")) as { at: string; passed: boolean; score: number }[];
  const last = h.at(-1);
  if (last) releaseGate = { at: last.at, passed: !!last.passed, score: last.score };
}

const data = JSON.parse(readFileSync(resolve(PORTFOLIO, "src/lab/weekly.json"), "utf8")) as { asOf: string; source: string; dates: string[] };

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: git("rev-parse", "HEAD"),
  commits,
  workflows,
  labCheck,
  releaseGate,
  dataset: { asOf: data.asOf, source: data.source, weeks: data.dates.length, from: data.dates[0] },
};
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(
  `city evidence: ${Object.values(commits).reduce((a, c) => a + c.length, 0)} commits · ` +
    Object.entries(workflows).map(([k, v]) => `${k} ${"runs" in v ? `${v.runs.length} runs` : "unavailable"}`).join(" · ") +
    ` · lab-check ${labCheck.passed ? "pass" : "FAIL"} (${labCheck.checks})`,
);
if (!labCheck.passed) process.exit(1);
