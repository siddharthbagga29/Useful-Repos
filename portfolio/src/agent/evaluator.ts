// CRITIC — independent quality guardrail. Two stages, as specified:
//   1. structural checks in the environment (tsc --noEmit, lint, unit tests);
//   2. the rubric (100 points → S ∈ [0, 10]), computed independently of the actor:
//        Deterministic code quality 40 · Natural conversational flow 25 ·
//        Task state integrity 20 · Resilience & security 15.
// Two hard gates block approval whatever the score: structural (0 errors, 0 failures) and honesty
// (every number traceable to the brief; no invented urgency; the CFA status stated correctly).

import { spawnSync } from "node:child_process";
import { displayText, sentences } from "../jarvis/sales/markup.ts";
import type { Line } from "../jarvis/sales/types.ts";
import { META_FLUFF } from "./actor.ts";
import { buildState, validateTasks } from "./tasks.ts";
import type { Candidate, Critique, Issue, Structural, TaskFile } from "./types.ts";
import { validatePayloads } from "./voice.ts";

export const PASS_SCORE = 9.5;

// ---------------------------------------------------------------- 1. environment

function run(cmd: string, args: string[], cwd: string) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }, maxBuffer: 32 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function structuralChecks(cwd: string): Structural {
  const tsc = run("npx", ["tsc", "--noEmit", "-p", "."], cwd);
  const tscErrors = (tsc.out.match(/error TS\d+/g) ?? []).length;
  const lint = run("npx", ["biome", "lint", "--max-diagnostics=50", "src/agent", "src/jarvis/sales", "scripts/jarvis-loop.ts"], cwd);
  const lintErrors = Number(/Found (\d+) error/.exec(lint.out)?.[1] ?? (lint.code === 0 ? 0 : 1));
  const unit = run("node", ["--experimental-strip-types", "--no-warnings", "--test", "--test-reporter=tap", "src/agent/agent.test.ts"], cwd);
  const names: { name: string; ok: boolean }[] = [];
  for (const m of unit.out.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)) names.push({ name: m[2]!.trim(), ok: m[1] === "ok" });
  const lab = run("node", ["--experimental-strip-types", "--no-warnings", "scripts/lab-check.ts"], cwd);
  names.push({ name: "lab-check: strategy, deal and brain checks", ok: lab.code === 0 });
  const ev = run("node", ["--experimental-strip-types", "--no-warnings", "scripts/eval.ts"], cwd);
  names.push({ name: "jarvis-eval: recruiter and principal questions", ok: ev.code === 0 });
  const failed = names.filter((n) => !n.ok).length + (unit.code !== 0 && !names.some((n) => !n.ok) ? 1 : 0);
  return {
    tsc: { ok: tsc.code === 0 && tscErrors === 0, errors: tscErrors, output: tsc.out.slice(-4000) },
    lint: { ok: lint.code === 0, errors: lintErrors, output: lint.out.slice(-4000) },
    tests: { ok: failed === 0 && names.length > 2, passed: names.filter((n) => n.ok).length, failed, names, output: unit.out.slice(-4000) },
  };
}

// ---------------------------------------------------------------- 2. rubric

const PRESSURE = /\b(only \d+ (spots|slots|seats)|limited time|act now|hurry|last chance|spots? left|before it's too late|don't miss|guarantee[ds]?|everyone (is|wants)|today only)\b/i;
const OPERATIONAL = /\b(30[- ]minutes?|30-minute|60-second|every six hours)\b/gi; // meeting length, tour length: not claims
const CONTRACTION = /\b\w+'(s|re|ve|ll|d|t|m)\b/gi;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Numbers a line asserts, normalised ("$6M+", "99.8", "60/40", "500"). */
export function claimedNumbers(text: string): string[] {
  const t = displayText(text).replace(OPERATIONAL, " ");
  return [...t.matchAll(/\$?\d[\d,.]*(?:\/\d+)?[MBK]?\+?%?/g)].map((m) => m[0].replace(/[.,]$/, "")).filter((n) => /\d/.test(n));
}

export function verifiedIn(brief: string, n: string): boolean {
  const core = n.replace(/%$/, "");
  return brief.includes(n) || brief.includes(core);
}

interface ConversationResult {
  points: number;
  issues: Issue[];
  honest: boolean;
}

export function scoreConversation(lines: Line[], briefingScript: string, brief: string): ConversationResult {
  const issues: Issue[] = [];
  let honest = true;
  const all: { where: string; stage: string; text: string }[] = [
    ...lines.map((l) => ({ where: `line:${l.id}`, stage: l.stage, text: l.text })),
    { where: "briefing", stage: "briefing", text: briefingScript },
  ];
  let sentenceCount = 0;
  let wordCount = 0;
  let longCost = 0;
  let fluffCost = 0;
  let pauseCost = 0;
  let askCost = 0;
  let lengthCost = 0;
  let exclaimCost = 0;
  let contractions = 0;
  const openers = new Map<string, number>();

  for (const x of all) {
    const ss = sentences(x.text);
    const plain = displayText(x.text);
    sentenceCount += ss.length;
    wordCount += ss.reduce((a, s) => a + words(s), 0);
    contractions += (plain.match(CONTRACTION) ?? []).length;
    const first = plain.split(/\s+/)[0]?.replace(/\W/g, "").toLowerCase() ?? "";
    openers.set(first, (openers.get(first) ?? 0) + 1);
    for (const s of ss) {
      if (words(s) > 22) {
        longCost += 1;
        issues.push({ code: "LONG_SENTENCE", where: x.where, detail: s, cost: 1 });
      }
    }
    const low = plain.toLowerCase();
    for (const f of META_FLUFF) {
      if (new RegExp(`(^|[^a-z])${f.replace(/'/g, "'")}([^a-z]|$)`).test(low)) {
        fluffCost += 2.5;
        issues.push({ code: "META_FLUFF", where: x.where, detail: f, cost: 2.5 });
      }
    }
    if (ss.length >= 2 && !/\|/.test(x.text)) {
      pauseCost += 1;
      issues.push({ code: "NO_PAUSE", where: x.where, detail: "several sentences, no pause marks", cost: 1 });
    }
    if (!ss.at(-1)?.trim().endsWith("?")) {
      askCost += 1;
      issues.push({ code: "NO_ASK", where: x.where, detail: "turn ends without a question", cost: 1 });
    }
    if (words(plain) > 70) {
      lengthCost += 1;
      issues.push({ code: "LINE_TOO_LONG", where: x.where, detail: `${words(plain)} words`, cost: 1 });
    }
    if (/!/.test(plain) || /\b[A-Z]{5,}\b/.test(plain.replace(/\b(WACC|EBITDA|NO-GO|MOIC)\b/g, ""))) {
      exclaimCost += 0.5;
      issues.push({ code: "EXCLAIM", where: x.where, detail: "exclamation or shouting", cost: 0.5 });
    }
    // honesty gate (the owner's briefing quotes task dates, not claims about Siddharth)
    for (const n of x.where === "briefing" ? [] : claimedNumbers(x.text)) {
      if (!verifiedIn(brief, n)) {
        honest = false;
        const s = ss.find((y) => y.includes(n)) ?? n;
        issues.push({ code: "UNVERIFIED_NUMBER", where: x.where, detail: s.includes(n) ? n : s, cost: 5 });
      }
    }
    const p = PRESSURE.exec(plain);
    if (p) {
      honest = false;
      issues.push({ code: "PRESSURE", where: x.where, detail: p[0], cost: 5 });
    }
    if (/\bCFA\b/.test(plain) && !/(hasn't sat|has not sat|scholarship)/i.test(plain)) {
      honest = false;
      issues.push({ code: "MISREPRESENTS_CFA", where: x.where, detail: "CFA", cost: 5 });
    }
  }
  const avg = sentenceCount ? wordCount / sentenceCount : 0;
  const avgPts = 5 * clamp((24 - avg) / (24 - 14), 0, 1);
  const contractionPts = contractions / all.length >= 0.5 ? 2 : 0;
  if (!contractionPts) issues.push({ code: "STIFF", where: "all", detail: "too few contractions for natural speech", cost: 2 });
  const topOpener = Math.max(...openers.values());
  const variety = topOpener / all.length > 0.4 ? 0 : 1;
  if (!variety) issues.push({ code: "REPETITIVE", where: "all", detail: "too many turns open the same way", cost: 1 });
  const points =
    avgPts +
    (3 - Math.min(3, longCost)) +
    (5 - Math.min(5, fluffCost)) +
    (4 - Math.min(4, pauseCost)) +
    (4 - Math.min(4, askCost)) +
    (1 - Math.min(1, lengthCost)) +
    contractionPts +
    (1 - Math.min(1, exclaimCost)) +
    variety -
    (honest ? 0 : 5);
  return { points: clamp(points, 0, 25), issues, honest };
}

export function scoreState(c: Candidate, file: TaskFile): { points: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let pts = 0;
  try {
    validateTasks(file);
    if (c.state.version === 1 && Array.isArray(c.state.completed) && Array.isArray(c.state.remaining)) pts += 5;
    else issues.push({ code: "STATE_SCHEMA", where: "state", detail: "state shape invalid", cost: 5 });
  } catch (e) {
    issues.push({ code: "STATE_SCHEMA", where: "tasks", detail: (e as Error).message, cost: 5 });
  }
  const s = c.state;
  const overlap = s.completed.filter((id) => s.remaining.includes(id));
  if (!overlap.length && s.completed.length + s.remaining.length === s.total && s.total === file.tasks.length) pts += 6;
  else issues.push({ code: "STATE_DELTA", where: "state", detail: `completed ${s.completed.length} + remaining ${s.remaining.length} ≠ total ${s.total}`, cost: 6 });
  // recompute independently from the raw file at the same instant
  const re = buildState(file, null, new Date(s.generatedAt));
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  if (same(re.overdue, s.overdue) && same(re.dueSoon, s.dueSoon) && same(re.blocked, s.blocked)) pts += 4;
  else issues.push({ code: "STATE_MISMATCH", where: "state", detail: "overdue/due-soon/blocked disagree with the task file", cost: 4 });
  // the briefing must name what needs the owner first: late items, then those waiting on him, then due soon
  const urgent = [...new Set([...s.overdue, ...s.blocked, ...s.dueSoon])];
  const must = (urgent.length ? urgent : s.top.map((r) => r.id)).slice(0, 3);
  const said = c.briefing.text.toLowerCase();
  const missing = must.filter((id) => {
    const t = file.tasks.find((x) => x.id === id);
    return t && !said.includes(t.title.toLowerCase().slice(0, 24)) && !(t.short && said.includes(t.short.toLowerCase()));
  });
  if (!missing.length) pts += 3;
  else issues.push({ code: "BRIEFING_COVERAGE", where: "briefing", detail: `not mentioned: ${missing.join(", ")}`, cost: 3 });
  try {
    if (JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s)) pts += 2;
  } catch {
    issues.push({ code: "STATE_JSON", where: "state", detail: "state is not valid JSON", cost: 2 });
  }
  return { points: pts, issues };
}

export function scoreResilience(c: Candidate, st: Structural): { points: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let pts = 0;
  const problems = validatePayloads(c.voice);
  const pii = problems.filter((p) => /phone number|credential/.test(p));
  const schema = problems.filter((p) => !/phone number|credential/.test(p));
  if (!schema.length) pts += 5;
  else issues.push({ code: "PAYLOAD_SCHEMA", where: "voice", detail: schema.join("; "), cost: 5 });
  if (!pii.length) pts += 3;
  else issues.push({ code: "PAYLOAD_PII", where: "voice", detail: pii.join("; "), cost: 3 });
  const res = st.tests.names.filter((n) => n.name.startsWith("resilience:"));
  const retry = res.filter((n) => /retr|backoff/i.test(n.name));
  const limit = res.filter((n) => /rate/i.test(n.name));
  if (retry.length && retry.every((n) => n.ok)) pts += 4;
  else issues.push({ code: "RESILIENCE_TEST", where: "tests", detail: "retry/backoff tests missing or failing", cost: 4 });
  if (limit.length && limit.every((n) => n.ok)) pts += 3;
  else issues.push({ code: "RESILIENCE_TEST", where: "tests", detail: "rate-limit tests missing or failing", cost: 3 });
  return { points: pts, issues };
}

export function scoreCode(st: Structural): { points: number; issues: Issue[] } {
  const issues: Issue[] = [];
  const tsc = st.tsc.ok ? 15 : Math.max(0, 15 - 3 * st.tsc.errors);
  const lint = st.lint.ok ? 10 : Math.max(0, 10 - 2 * Math.max(1, st.lint.errors));
  const total = st.tests.passed + st.tests.failed;
  const tests = total ? 15 * (st.tests.passed / total) : 0;
  if (!st.tsc.ok) issues.push({ code: "TSC", where: "code", detail: `${st.tsc.errors} TypeScript errors`, cost: 15 - tsc });
  if (!st.lint.ok) issues.push({ code: "LINT", where: "code", detail: `${st.lint.errors} lint errors`, cost: 10 - lint });
  if (st.tests.failed) issues.push({ code: "TESTS", where: "code", detail: st.tests.names.filter((n) => !n.ok).map((n) => n.name).join("; "), cost: 15 - tests });
  return { points: tsc + lint + tests, issues };
}

/** The full deterministic critique. `llm` (optional) blends a Claude flow score into conversation. */
export function critique(c: Candidate, st: Structural, file: TaskFile, brief: string, llm?: { flow: number; notes: string } | null): Critique {
  const code = scoreCode(st);
  const conv = scoreConversation(Object.values(c.playbook.lines), c.briefing.script, brief);
  const state = scoreState(c, file);
  const res = scoreResilience(c, st);
  const conversation = llm ? Math.min(conv.points, (conv.points + clamp(llm.flow, 0, 25)) / 2) : conv.points;
  const points = { code: round1(code.points), conversation: round1(conversation), state: round1(state.points), resilience: round1(res.points) };
  const total = points.code + points.conversation + points.state + points.resilience;
  return {
    score: round1(total / 10),
    points,
    gates: { structural: st.tsc.ok && st.lint.ok && st.tests.ok, honesty: conv.honest },
    issues: [...code.issues, ...conv.issues, ...state.issues, ...res.issues],
    critic: llm ? "deterministic+claude" : "deterministic",
    llmNotes: llm?.notes,
  };
}

export const passes = (c: Critique) => c.score >= PASS_SCORE && c.gates.structural && c.gates.honesty;

function round1(x: number) {
  return Math.round(x * 10) / 10;
}
