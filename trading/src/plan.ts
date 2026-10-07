// From the Brain's champion to limit orders. The signal comes from the Strategy Lab's own target()
// function, so the bot trades exactly what was backtested, scaled into the sleeve's risk caps.

import { DEFAULTS, target, type Dataset, type Params } from "../../portfolio/src/lab/backtest.ts";
import type { Config, PlannedOrder, Position, Quote } from "./types.ts";

export type Genome = Pick<Params, "strategy" | "asset" | "weights" | "universe" | "safe" | "smaWeeks" | "lookbackWeeks" | "rebalanceWeeks" | "targetVolPct">;

const returns = (v: number[]) => v.map((x, i) => (i === 0 ? 0 : x / v[i - 1]! - 1));

/** The champion's target weights on the latest week of data (fractions of capital, sum ≤ 1). */
export function championWeights(g: Genome, data: Dataset): Record<string, number> {
  const p: Params = { ...DEFAULTS, ...g, costBps: 0, startIndex: 0 };
  const rets: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(data.series)) rets[k] = returns(v);
  return target(p, data.dates.length - 1, data.series, rets);
}

/** Static mixes don't read prices; every other family does, so stale data blocks them. */
export const needsFreshData = (g: Genome) => g.strategy !== "static" && g.strategy !== "hold";

export function daysOld(asOf: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(`${asOf}T00:00:00Z`).getTime()) / 86_400_000);
}

/** Scale weights so no position exceeds maxPositionPct and the total stays within maxExposurePct. */
export function fitToCaps(w: Record<string, number>, cfg: Config): { weights: Record<string, number>; scale: number } {
  const vals = Object.values(w).filter((x) => x > 0);
  if (!vals.length) return { weights: {}, scale: 0 };
  const total = vals.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, cfg.maxExposurePct / 100 / total, cfg.maxPositionPct / 100 / Math.max(...vals));
  return { weights: Object.fromEntries(Object.entries(w).filter(([, x]) => x > 0).map(([k, x]) => [k, x * scale])), scale };
}

export function rebalanceDue(last: string | undefined, rebalanceWeeks: number, now: Date): boolean {
  if (!last) return true;
  return now.getTime() - new Date(last).getTime() >= rebalanceWeeks * 7 * 86_400_000 - 86_400_000;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Orders that move the bot's holdings to target. Sells come first (they fund the buys). Whole shares
 * only; changes under one share are skipped. Limits sit `limitOffsetPct` through the mid.
 */
export function planOrders(target: Record<string, number>, positions: Position[], quotes: Quote[], sleeveEquity: number, sizeMultiplier: number, cfg: Config): PlannedOrder[] {
  const q = new Map(quotes.map((x) => [x.symbol, x]));
  const syms = new Set([...Object.keys(target), ...positions.map((p) => p.symbol)]);
  const sells: PlannedOrder[] = [];
  const buys: PlannedOrder[] = [];
  for (const s of syms) {
    const quote = q.get(s);
    if (!quote) continue;
    const mid = (quote.bid + quote.ask) / 2;
    const held = positions.find((p) => p.symbol === s)?.qty ?? 0;
    const want = Math.floor((sleeveEquity * (target[s] ?? 0) * sizeMultiplier) / mid);
    const diff = want - held;
    if (diff === 0) continue;
    if (diff < 0) {
      const limitPrice = round2(mid * (1 - cfg.limitOffsetPct / 100));
      sells.push({ symbol: s, side: "sell", type: "limit", qty: -diff, limitPrice, timeInForce: "gfd", reason: `trim to ${want} sh (target ${(((target[s] ?? 0) * 100) || 0).toFixed(1)}%)` });
    } else {
      const limitPrice = round2(mid * (1 + cfg.limitOffsetPct / 100));
      const stopPrice = round2(limitPrice * (1 - cfg.stopPct / 100) + 0.005);
      buys.push({ symbol: s, side: "buy", type: "limit", qty: diff, limitPrice, stopPrice, timeInForce: "gfd", reason: `build to ${want} sh (target ${((target[s] ?? 0) * 100).toFixed(1)}%)` });
    }
  }
  return [...sells, ...buys];
}
