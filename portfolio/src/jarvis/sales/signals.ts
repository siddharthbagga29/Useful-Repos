// Reading the room. Small behavioural signs that a visitor is stuck, each answered once with a
// short offer of help. Pure logic (no DOM), unit-tested with the agent.
//
//   rage     three quick clicks in the same spot: something didn't respond the way they expected
//   dead     repeated clicks on things that aren't clickable
//   hunting  scrolling back and forth: looking for something they can't find
//   stall    no input for a while: reading, distracted, or unsure what to do next
//
// Nothing here identifies anyone. Signals are counted anonymously (track.ts) so Siddharth can see
// which moments come up and whether help leads to a conversation. A visitor who says "Not now"
// once is given more room on later visits (`patience`).

export type Signal = "rage" | "dead" | "hunting" | "stall";

export const HELP_FOR: Record<Signal, string> = {
  rage: "help.rage",
  dead: "help.dead",
  hunting: "help.hunting",
  stall: "help.stall",
};

export class Signals {
  private clicks: { t: number; x: number; y: number; ok: boolean }[] = [];
  private dir = 0;
  private lastMove = 0;
  private reversals: number[] = [];
  private now: () => number;
  private need: { rage: number; dead: number; hunting: number };
  readonly stallMs: number;

  /** patience: 1 normally, 2 for a visitor who has dismissed help before. */
  constructor(now: () => number = () => Date.now(), patience = 1) {
    this.now = now;
    this.stallMs = 35_000 * patience;
    this.need = { rage: 3, dead: 3 + patience - 1, hunting: 4 + 2 * (patience - 1) };
  }

  click(x: number, y: number, interactive: boolean): Signal | null {
    const t = this.now();
    this.clicks = [...this.clicks.filter((c) => t - c.t < 10_000), { t, x, y, ok: interactive }];
    const burst = this.clicks.filter((c) => t - c.t < 900 && Math.hypot(c.x - x, c.y - y) < 40);
    if (burst.length >= this.need.rage) {
      this.clicks = [];
      return "rage";
    }
    if (this.clicks.filter((c) => !c.ok).length >= this.need.dead) {
      this.clicks = [];
      return "dead";
    }
    return null;
  }

  /** Feed scroll movement (wheel deltaY or change in scroll position). */
  scroll(delta: number): Signal | null {
    if (Math.abs(delta) < 4) return null;
    const t = this.now();
    const d = Math.sign(delta);
    if (this.dir !== 0 && d !== this.dir && t - this.lastMove > 250) this.reversals.push(t);
    if (d !== this.dir) this.lastMove = t;
    this.dir = d;
    this.reversals = this.reversals.filter((r) => t - r < 12_000);
    if (this.reversals.length >= this.need.hunting) {
      this.reversals = [];
      return "hunting";
    }
    return null;
  }

  /** Called on a timer with the time since the visitor last did anything. */
  idle(sinceInputMs: number): Signal | null {
    return sinceInputMs >= this.stallMs ? "stall" : null;
  }
}
