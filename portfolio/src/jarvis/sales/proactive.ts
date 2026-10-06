// When Jarvis speaks up on his own. Pure logic (no DOM), so it is unit-tested with the agent.
//
// Triggers: the visitor lands (first visit or return), lingers on a station, or moves to leave.
// Restraint is part of the craft: never while the visitor is typing or another panel is open,
// at least 40 s between unprompted lines, at most 4 per visit, each nudge once, and "Not now"
// silences him for the rest of the visit.

import { RateLimiter } from "../../agent/ratelimit.ts";

export type ProactiveEvent =
  | { type: "landing"; returning: boolean }
  | { type: "dwell"; station: string }
  | { type: "exit" };

export const DWELL_MS = 12_000;
export const NUDGE_FOR: Record<string, string> = {
  dealroom: "nudge.dealroom",
  model: "nudge.model",
  research: "nudge.research",
  experience: "nudge.experience",
};

export class Proactive {
  private limiter: RateLimiter;
  private used = new Set<string>();
  private snoozed = false;
  private engaged = false;

  constructor(now: () => number = () => Date.now(), maxPerVisit = 4, gapMs = 40_000) {
    this.limiter = new RateLimiter(maxPerVisit, 24 * 3_600_000, gapMs, now);
  }

  /** The visitor said "Not now": no more unprompted lines this visit. */
  snooze() {
    this.snoozed = true;
  }

  /** The visitor is in a conversation with Jarvis; nudges would interrupt it. */
  setEngaged(on: boolean) {
    this.engaged = on;
  }

  /** Returns the line to open with, or null to stay quiet. `busy` = typing or a panel is open. */
  decide(e: ProactiveEvent, busy: boolean): string | null {
    if (this.snoozed || busy) return null;
    let id: string | null = null;
    if (e.type === "landing") id = e.returning ? "open.return" : "open.first";
    else if (this.engaged) return null;
    else if (e.type === "dwell") id = NUDGE_FOR[e.station] ?? null;
    else if (e.type === "exit") id = "nudge.exit";
    if (!id || this.used.has(id)) return null;
    if (!this.limiter.take()) return null;
    this.used.add(id);
    return id;
  }
}
