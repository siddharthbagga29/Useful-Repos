// Grades the in-browser Jarvis against the same recruiter cases as the Python service
// (jarvis/knowledge/eval_cases.toml), plus checks for the site skills.
//   npm run eval

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Engine, digest, research, type Skill } from "../src/jarvis/engine.ts";

const root = fileURLToPath(new URL("../../jarvis/knowledge/", import.meta.url));
const engine = new Engine({ brief: readFileSync(root + "brief.md", "utf8") });

interface Case {
  id: string;
  question: string;
  require_any: string[][];
  forbid: string[];
}

// eval_cases.toml only uses [[case]] tables of strings and JSON-compatible arrays.
function loadCases(text: string): Case[] {
  const cases: Case[] = [];
  let cur: Partial<Case> | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    if (line.trim() === "[[case]]") {
      if (cur) cases.push(cur as Case);
      cur = { require_any: [], forbid: [] };
      continue;
    }
    const m = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (m && cur) (cur as Record<string, unknown>)[m[1]!] = JSON.parse(m[2]!);
  }
  if (cur) cases.push(cur as Case);
  return cases;
}

function contains(text: string, phrase: string) {
  const prefix = phrase.endsWith("*");
  const core = phrase.replace(/\*$/, "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${core}${prefix ? "" : "(?![\\p{L}\\p{N}_])"}`, "u");
  return re.test(text.toLowerCase().replace(/[‘’]/g, "'"));
}

let failed = 0;
const report = (id: string, problems: string[], answer: string) => {
  if (problems.length) failed++;
  console.log(`${problems.length ? "FAIL" : "pass"}  ${id}${problems.length ? `\n      ${problems.join("\n      ")}\n      → ${answer}` : ""}`);
};

for (const c of loadCases(readFileSync(root + "eval_cases.toml", "utf8"))) {
  const a = engine.answer(c.question);
  const problems: string[] = [];
  for (const group of c.require_any) if (!group.some((p) => contains(a.text, p))) problems.push(`missing one of ${JSON.stringify(group)}`);
  for (const p of c.forbid) if (contains(a.text, p)) problems.push(`contains forbidden ${JSON.stringify(p)}`);
  report(`${c.id} [${a.intent}]`, problems, a.text);
}

const skillCases: [string, (s: Skill[]) => boolean][] = [
  ["take me to the model", (s) => s.some((x) => x.name === "navigate" && x.station === "model")],
  ["go to the deal room", (s) => s.some((x) => x.name === "navigate" && x.station === "dealroom")],
  ["Hey Jarvis, set WACC to 10%", (s) => s.some((x) => x.name === "set_dcf" && x.wacc === 10)],
  ["what if terminal growth is 2.5", (s) => s.some((x) => x.name === "set_dcf" && x.g === 2.5)],
  ["open the S&P report", (s) => s.some((x) => x.name === "open_exhibit" && x.id === "spgi")],
  ["show me his Bloomberg certificate", (s) => s.some((x) => x.name === "open_exhibit" && x.id === "bmc")],
  ["brief me", (s) => s.some((x) => x.name === "run_digest")],
  ["send me the deck", (s) => s.some((x) => x.name === "open_exhibit" && x.id === "deck")],
  ["how do I contact him?", (s) => s.some((x) => x.name === "draft_email")],
];
for (const [q, ok] of skillCases) {
  const a = engine.answer(q);
  report(`skill: ${q} [${a.intent}]`, ok(a.skills) ? [] : [`skills ${JSON.stringify(a.skills)}`], a.text);
}

const free = ["What does he do outside work?", "Where is he based?", "What tools does he use?", "Did he write any offering documents?"];
for (const q of free) {
  const a = engine.answer(q);
  report(`free: ${q} [${a.intent}]`, a.uncovered || a.intent.startsWith("scope") ? ["not answered"] : [], a.text);
}

const r = research(engine, "Is he a CFA charterholder and how did he price the pipeline?");
report("research: compound split", r.subQuestions.length === 2 && r.citations.length > 0 ? [] : [`parts=${r.subQuestions.length}`], r.text);
report("digest: six sections", digest().length === 6 ? [] : ["wrong length"], "");

console.log(failed ? `\n${failed} failing` : "\nall passing");
process.exit(failed ? 1 : 0);
