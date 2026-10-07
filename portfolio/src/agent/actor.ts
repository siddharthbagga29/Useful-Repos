// ACTOR — Jarvis Core. Produces a candidate (sales playbook, task state, owner briefing, call
// payloads) and, on later iterations, revises it against the critic's issues. Deterministic by
// default; with ANTHROPIC credentials and claude=true it asks Claude to rewrite flagged lines.

import { displayText, sentences } from "../jarvis/sales/markup.ts";
import type { Line, Playbook } from "../jarvis/sales/types.ts";
import { DRAFTS } from "./drafts.ts";
import { buildState, triggers } from "./tasks.ts";
import type { Briefing, Candidate, Critique, Issue, TaskFile, TaskState } from "./types.ts";
import { buildPayloads } from "./voice.ts";

export const META_FLUFF = [
  "here is your update",
  "here's your update",
  "here is an update",
  "as an ai",
  "i hope this helps",
  "feel free to",
  "don't hesitate",
  "great question",
  "i'd be happy to",
  "let me know if",
  "in conclusion",
  "as mentioned",
  "certainly",
  "absolutely",
];

// ---------------------------------------------------------------- briefing

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function when(d: number): string {
  if (d < -1) return `It's ${-d} days late.`;
  if (d === -1) return "It's a day late.";
  if (d === 0) return "It's due today.";
  if (d === 1) return "It's due tomorrow.";
  return `It's due in ${d} days.`;
}

/** What needs the owner, in the order a good assistant would raise it: late, waiting on him, due soon. */
export function needsOwner(state: TaskState): string[] {
  const order = [...state.overdue, ...state.blocked, ...state.dueSoon];
  const out = [...new Set(order)];
  return out.length ? out : state.top.map((r) => r.id);
}

const COUNT = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things"];

/** `compact` is the actor's repair when the critic finds the briefing too long: short names, no reasons. */
export function composeBriefing(file: TaskFile, state: TaskState, now: Date, compact = false): Briefing {
  const trig = triggers(state, now, file.timezone);
  const morning = trig.some((t) => t.kind === "morning_briefing");
  const byId = new Map(file.tasks.map((t) => [t.id, t]));
  const daysById = new Map(state.top.map((r) => [r.id, r.daysLeft]));
  const parts: string[] = [morning ? `Morning, ${file.owner}.` : `${file.owner}.`];
  if (!state.remaining.length) {
    parts.push("|| You're clear. | Nothing's waiting on you today.");
  } else {
    const need = needsOwner(state);
    const named = need.slice(0, 3);
    const rest = need.slice(3);
    parts.push(`|| ${COUNT[need.length] ?? `${need.length} things`} ${need.length === 1 ? "needs" : "need"} you.`);
    named.forEach((id, i) => {
      const t = byId.get(id);
      if (!t) return;
      const name = i === 0 && !compact ? lowerFirst(t.title) : (t.short ?? lowerFirst(t.title));
      const lead = named.length === 1 ? `${t.title}.` : `${["First,", "Then,", "And"][i] ?? "Also,"} ${name}.`;
      const d = daysById.get(id) ?? Math.round((Date.parse(`${t.due}T00:00:00Z`) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86_400_000);
      const status = t.status === "blocked" && t.blockedOn ? `I need ${t.blockedOn} from you.` : when(d);
      parts.push(`|| ${lead} | ${status}${i === 0 && !compact ? ` | ${t.why}` : ""}`);
    });
    if (rest.length) {
      const names = rest.map((id) => byId.get(id)?.short ?? lowerFirst(byId.get(id)?.title ?? id));
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
      parts.push(`|| ${rest.length === 1 ? "One more is" : `${COUNT[rest.length]?.split(" ")[0] ?? rest.length} more are`} close behind: | ${list}.`);
    }
  }
  if (state.delta.newlyCompleted.length) {
    const k = state.delta.newlyCompleted.length;
    parts.push(`||| ${k === 1 ? "One task" : `${k} tasks`} closed since last time. | Good work.`);
  }
  parts.push(state.remaining.length ? "||| Want me to move anything?" : "||| Anything new to add?");
  const script = parts.join(" ");
  return { script, text: displayText(script), triggers: trig };
}

// ---------------------------------------------------------------- playbook revision

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const STAGE_ASK: Record<string, string> = {
  open: "What brings you here?",
  pitch: "Shall we put 30 minutes on the calendar?",
  proof: "Worth a 30-minute conversation?",
  objection: "Would 30 minutes help?",
  close: "Shall I open the calendar?",
  nudge: "Want the short version?",
  tour: "Shall I open his calendar?",
};

/** Split a long sentence at the comma or conjunction nearest its middle. */
function splitSentence(s: string): string {
  const words = s.split(" ");
  const mid = Math.floor(words.length / 2);
  let best = -1;
  for (let d = 0; d < mid && best < 0; d++) {
    for (const i of [mid + d, mid - d]) {
      const w = words[i];
      if (!w) continue;
      if (w.endsWith(",")) {
        best = i;
        break;
      }
      if (["and", "but", "then", "so"].includes(w.toLowerCase()) && i > 2) {
        best = i - 1;
        break;
      }
    }
  }
  if (best < 0) best = mid;
  const head = words.slice(0, best + 1).join(" ").replace(/,$/, "");
  const tailWords = words.slice(best + 1);
  if (["and", "but", "then", "so"].includes((tailWords[0] ?? "").toLowerCase())) tailWords.shift();
  const tail = tailWords.join(" ");
  return `${head}. | ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
}

function dropSentence(text: string, needle: (s: string) => boolean): string {
  const chunks = text.split(/(\s*\|{1,3}\s*)/);
  return chunks
    .map((c) => (/\|/.test(c) ? c : c.replace(/[^.!?]+[.!?]*/g, (s) => (needle(s) ? "" : s))))
    .join("")
    .replace(/(\s*\|{1,3}\s*)+(?=\s*\|)/g, "")
    .replace(/^\s*\|{1,3}\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Apply the critic's fixes to one line. Each issue code has exactly one repair. */
export function repairLine(line: Line, issues: Issue[]): Line {
  const l = clone(line);
  for (const is of issues) {
    switch (is.code) {
      case "META_FLUFF":
        for (const f of META_FLUFF) l.text = l.text.replace(new RegExp(`${f}[,.!]?\\s*`, "ig"), "");
        break;
      case "LONG_SENTENCE": {
        const s = is.detail;
        if (l.text.includes(s)) l.text = l.text.replace(s, splitSentence(s));
        break;
      }
      case "NO_PAUSE":
        l.text = l.text.replace(/([.?!])\s+(?=[A-Z])/, "$1 | ");
        break;
      case "NO_ASK":
        l.text = `${l.text.trim()} || ${STAGE_ASK[l.stage] ?? "Shall we talk?"}`;
        break;
      case "EXCLAIM":
        l.text = l.text.replace(/!/g, ".");
        break;
      case "UNVERIFIED_NUMBER":
      case "PRESSURE":
      case "MISREPRESENTS_CFA":
        l.text = dropSentence(l.text, (s) => s.includes(is.detail));
        break;
      case "LINE_TOO_LONG": {
        const ss = sentences(l.text);
        const victim = ss[ss.length - 2];
        if (ss.length > 3 && victim) l.text = dropSentence(l.text, (s) => s.trim() === victim);
        break;
      }
      default:
        break;
    }
  }
  return l;
}

export function composePlaybook(prev: Critique | null, base: Line[] = DRAFTS): Record<string, Line> {
  const lines: Record<string, Line> = {};
  for (const d of base) {
    const mine = prev?.issues.filter((i) => i.where === `line:${d.id}`) ?? [];
    lines[d.id] = mine.length ? repairLine(d, mine) : clone(d);
  }
  return lines;
}

// ---------------------------------------------------------------- the candidate

export interface ActorInput {
  iteration: number;
  file: TaskFile;
  prevState: TaskState | null;
  now: Date;
  critique: Critique | null;
  /** lines carried from the previous candidate (so repairs accumulate) */
  lines?: Line[];
}

export function compose(input: ActorInput): Candidate {
  const state = buildState(input.file, input.prevState, input.now);
  const tooLong = !!input.critique?.issues.some((i) => i.where === "briefing" && i.code === "LINE_TOO_LONG");
  const briefing = composeBriefing(input.file, state, input.now, tooLong);
  const lines = composePlaybook(input.critique, input.lines ?? DRAFTS);
  const playbook: Playbook = {
    version: 1,
    generatedAt: input.now.toISOString(),
    approved: { score: 0, iteration: input.iteration, critic: "deterministic" },
    lines,
  };
  return { iteration: input.iteration, playbook, state, briefing, voice: buildPayloads(briefing.script, briefing.text) };
}
