// The graph loop:
//
//   [ACTOR: Jarvis Core] → [ENVIRONMENT: tsc, lint, tests] → [CRITIC: rubric + gates]
//        ↑                                                          │
//        └──────────── critique (≤ MAX_RETRIES rounds) ────────────┤ S < 9.5 or a gate fails
//                                                                   └→ S ≥ 9.5 and gates pass → APPROVE & COMMIT
//
// Approval writes the sales playbook the site ships (src/jarvis/sales/playbook.json), the task
// state and the owner's briefing + call payloads. Every round is logged to
// .agent_logs/eval_history.json. A failed run writes nothing the site uses and exits non-zero, so
// deploys stop on it.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compose } from "./actor.ts";
import { claudeCritique, claudeEnabled, claudeRewrite } from "./claude.ts";
import { critique, PASS_SCORE, passes, structuralChecks } from "./evaluator.ts";
import { validateTasks } from "./tasks.ts";
import type { Candidate, Critique, EvalRecord, Structural, TaskState } from "./types.ts";
import type { Line } from "../jarvis/sales/types.ts";

export const MAX_RETRIES = 5;
const HISTORY_KEEP = 300;

export interface LoopOptions {
  root: string; // the portfolio directory
  now?: Date;
  claude?: boolean;
  log?: (s: string) => void;
}

export interface LoopResult {
  ok: boolean;
  iterations: number;
  final: Critique;
  candidate: Candidate;
}

const paths = (root: string) => ({
  tasks: join(root, "agent/tasks.json"),
  state: join(root, "agent/state/task_state.json"),
  out: join(root, "agent/out"),
  playbook: join(root, "src/jarvis/sales/playbook.json"),
  history: join(root, ".agent_logs/eval_history.json"),
  brief: join(root, "../jarvis/knowledge/brief.md"),
});

/** Hash of the code the structural checks cover; unchanged code is not re-checked within a run. */
function codeHash(root: string): string {
  const h = createHash("sha256");
  const walk = (d: string) => {
    for (const f of readdirSync(join(root, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = join(d, f.name);
      if (f.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(f.name)) h.update(rel).update(readFileSync(join(root, rel)));
    }
  };
  walk("src");
  walk("scripts");
  return h.digest("hex");
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(p: string, v: unknown) {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
}

function record(root: string, c: Critique, iteration: number, now: Date) {
  const p = paths(root).history;
  const prev = readJson<EvalRecord[]>(p) ?? [];
  const rec: EvalRecord = { at: now.toISOString(), iteration, score: c.score, passed: passes(c), points: c.points, gates: c.gates, issues: c.issues, critic: c.critic, llmNotes: c.llmNotes };
  writeJson(p, [...prev, rec].slice(-HISTORY_KEEP));
}

export async function runLoop(o: LoopOptions): Promise<LoopResult> {
  const log = o.log ?? ((s: string) => console.log(s));
  const now = o.now ?? new Date();
  const P = paths(o.root);
  const file = validateTasks(JSON.parse(readFileSync(P.tasks, "utf8")));
  const prevState = readJson<TaskState>(P.state);
  const brief = readFileSync(P.brief, "utf8");
  const useClaude = o.claude ?? claudeEnabled();

  let prev: Critique | null = null;
  let lines: Line[] | undefined;
  let structural: Structural | null = null;
  let checkedHash = "";
  let candidate: Candidate | null = null;

  for (let iteration = 1; iteration <= MAX_RETRIES; iteration++) {
    // ACTOR
    if (useClaude && prev && lines) lines = await claudeRewrite(lines, prev.issues);
    candidate = compose({ iteration, file, prevState, now, critique: prev, lines });
    lines = Object.values(candidate.playbook.lines);

    // ENVIRONMENT
    const hash = codeHash(o.root);
    if (!structural || hash !== checkedHash) {
      log(`  [env] tsc · lint · tests …`);
      structural = structuralChecks(o.root);
      checkedHash = hash;
    }
    log(`  [env] tsc ${structural.tsc.ok ? "ok" : `${structural.tsc.errors} errors`} · lint ${structural.lint.ok ? "ok" : `${structural.lint.errors} errors`} · tests ${structural.tests.passed}/${structural.tests.passed + structural.tests.failed}`);

    // CRITIC
    const llm = useClaude ? await claudeCritique(lines, candidate.briefing.script) : null;
    const c = critique(candidate, structural, file, brief, llm);
    record(o.root, c, iteration, now);
    log(
      `  [critic] round ${iteration}: S = ${c.score.toFixed(1)}/10 (code ${c.points.code}/40 · conversation ${c.points.conversation}/25 · state ${c.points.state}/20 · resilience ${c.points.resilience}/15)` +
        `${c.gates.structural ? "" : " · structural gate FAILED"}${c.gates.honesty ? "" : " · honesty gate FAILED"}`,
    );
    for (const is of c.issues.slice(0, 8)) log(`           - ${is.code} @ ${is.where}: ${is.detail.slice(0, 90)}`);

    if (passes(c)) {
      // APPROVE & COMMIT
      candidate.playbook.approved = { score: c.score, iteration, critic: c.critic };
      writeJson(P.playbook, candidate.playbook);
      writeJson(P.state, candidate.state);
      writeJson(join(P.out, "briefing.json"), { ...candidate.briefing, state: candidate.state, score: c.score });
      if (!existsSync(join(P.out, "voice"))) mkdirSync(join(P.out, "voice"), { recursive: true });
      writeFileSync(join(P.out, "voice/twilio.xml"), `${candidate.voice.twiml}\n`);
      writeJson(join(P.out, "voice/bland.json"), candidate.voice.bland);
      writeJson(join(P.out, "voice/vapi.json"), candidate.voice.vapi);
      log(`  [approve] S ≥ ${PASS_SCORE} and all gates pass → playbook, state, briefing and call payloads written.`);
      return { ok: true, iterations: iteration, final: c, candidate };
    }
    prev = c;
  }
  log(`  [stop] no candidate reached ${PASS_SCORE} within ${MAX_RETRIES} rounds; nothing written.`);
  return { ok: false, iterations: MAX_RETRIES, final: prev!, candidate: candidate! };
}
