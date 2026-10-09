// Shared types for the Jarvis executive agent (actor), its environment checks and its critic.

import type { Playbook } from "../jarvis/sales/types.ts";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface Task {
  id: string;
  title: string;
  /** short spoken name, used when it's listed with others ("the LinkedIn link") */
  short?: string;
  /** why it matters, one line, spoken in the briefing */
  why: string;
  status: TaskStatus;
  /** 1 (nice to have) – 5 (moves the business) */
  impact: number;
  /** YYYY-MM-DD target date */
  due: string;
  /** what the owner has to provide when blocked */
  blockedOn?: string;
  completedAt?: string;
  /** where the owner does the task; Jarvis on the Mac opens it when he says go */
  link?: string;
}

export interface TaskFile {
  version: 1;
  owner: string;
  timezone: string;
  tasks: Task[];
}

export interface Ranked {
  id: string;
  title: string;
  score: number;
  reason: "overdue" | "due_soon" | "blocked" | "open";
  daysLeft: number;
}

export interface TaskState {
  version: 1;
  generatedAt: string;
  total: number;
  completed: string[];
  remaining: string[];
  overdue: string[];
  dueSoon: string[];
  blocked: string[];
  delta: { newlyCompleted: string[]; newlyAdded: string[]; newlyOverdue: string[] };
  top: Ranked[];
}

export type Trigger = { kind: "overdue" | "due_soon" | "blocked" | "morning_briefing"; taskIds: string[] };

export interface Briefing {
  /** spoken-script markup */
  script: string;
  /** what was said, for the record */
  text: string;
  triggers: Trigger[];
}

export interface VoicePayloads {
  twiml: string;
  bland: Record<string, unknown>;
  vapi: Record<string, unknown>;
}

/** Everything the actor produces in one iteration. */
export interface Candidate {
  iteration: number;
  playbook: Playbook;
  state: TaskState;
  briefing: Briefing;
  voice: VoicePayloads;
}

export interface Issue {
  code: string;
  where: string;
  detail: string;
  /** points lost */
  cost: number;
}

export interface Structural {
  tsc: { ok: boolean; errors: number; output: string };
  lint: { ok: boolean; errors: number; output: string };
  tests: { ok: boolean; passed: number; failed: number; names: { name: string; ok: boolean }[]; output: string };
}

export interface Critique {
  /** S ∈ [0, 10] */
  score: number;
  points: { code: number; conversation: number; state: number; resilience: number };
  /** hard gates: any failure blocks approval whatever the score */
  gates: { structural: boolean; honesty: boolean };
  issues: Issue[];
  critic: "deterministic" | "deterministic+claude";
  llmNotes?: string;
}

export interface EvalRecord {
  at: string;
  iteration: number;
  score: number;
  passed: boolean;
  points: Critique["points"];
  gates: Critique["gates"];
  issues: Issue[];
  critic: Critique["critic"];
  llmNotes?: string;
}
