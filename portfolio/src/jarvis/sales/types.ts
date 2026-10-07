// The sales playbook Jarvis runs on the site. Produced by the actor (src/agent), approved by the
// critic, and shipped as playbook.json. Browser-safe: no Node imports here.

/** "tour" lines narrate the self-running tour; only its last stop has to end on a question. */
export type Stage = "open" | "pitch" | "proof" | "objection" | "close" | "nudge" | "tour";
export type Audience = "recruiter" | "principal" | "founder" | "explorer";

/** What a line or a chip does besides talking. `navigate:<station>` scrolls; `href:<path>` opens. */
export type Action =
  | "open_schedule"
  | "open_connect"
  | "open_resume"
  | "run_digest"
  | "run_tour"
  | `dcf:${number}`
  | "open_jarvis"
  | "snooze"
  | `navigate:${string}`
  | `href:${string}`;

export interface Chip {
  label: string;
  /** next line id */
  next?: string;
  action?: Action;
  /** sets the visitor's audience when chosen */
  audience?: Audience;
}

export interface Line {
  id: string;
  stage: Stage;
  audience?: Audience;
  /** spoken-script markup, see markup.ts */
  text: string;
  chips: Chip[];
  action?: Action;
}

export interface Playbook {
  version: 1;
  generatedAt: string;
  approved: { score: number; iteration: number; critic: "deterministic" | "deterministic+claude" };
  lines: Record<string, Line>;
}
