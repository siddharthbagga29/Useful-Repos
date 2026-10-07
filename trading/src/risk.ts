// The risk engine. Every order the agent wants to send passes checkOrder() first; the agent's
// CLAUDE.md forbids calling an order tool on anything this rejects. Pure functions, unit-tested.

import type { Config, DayRecord, Health, Journal, PlannedOrder, Position, Quote } from "./types.ts";

const TRADING_DAYS = 252;

/** Fractional Kelly: f* = (p·b − (1 − p)) / b × fraction, floored at 0. */
export function kelly(p: number, b: number, fraction: number): number {
  if (!(b > 0) || p < 0 || p > 1) return 0;
  return Math.max(0, ((p * b - (1 - p)) / b) * fraction);
}

export function dailyReturns(days: DayRecord[], start: number): number[] {
  const out: number[] = [];
  let prev = start;
  for (const d of days) {
    out.push(prev > 0 ? d.equity / prev - 1 : 0);
    prev = d.equity;
  }
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

export function sharpe(r: number[]): number {
  const s = sd(r);
  return s > 0 ? (mean(r) / s) * Math.sqrt(TRADING_DAYS) : 0;
}

export function sortino(r: number[]): number {
  const down = r.filter((x) => x < 0);
  const dd = Math.sqrt(down.reduce((a, x) => a + x * x, 0) / Math.max(1, r.length));
  return dd > 0 ? (mean(r) / dd) * Math.sqrt(TRADING_DAYS) : 0;
}

/** Peak-to-trough drawdown of the equity path, as a positive fraction. */
export function maxDrawdown(equity: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of equity) {
    peak = Math.max(peak, v);
    if (peak > 0) worst = Math.max(worst, 1 - v / peak);
  }
  return worst;
}

export function profitFactor(pnls: number[]): number {
  const win = pnls.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const loss = -pnls.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  if (loss === 0) return win > 0 ? Infinity : 0;
  return win / loss;
}

export interface Scorecard {
  days: number;
  equity: number;
  avgDailyPnl: number;
  targetDailyPnl: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  todayDrawdownPct: number;
  profitFactor: number;
  winRate: number;
  ahs: number;
  health: Health;
  sizeMultiplier: number;
  reasons: string[];
}

/**
 * Agent Health Score from CLAUDE.md §II, with one change: the PnL target scales with the sleeve
 * (config.targetMonthlyReturnPct) instead of a fixed $50,000, so a small account isn't scored as a
 * failure by construction. Each term is clamped to [0, 1]. Uses a rolling 21-day window.
 */
export function scorecard(j: Journal, cfg: Config): Scorecard {
  const window = j.days.slice(-21);
  const startEq = j.days.length > window.length ? j.days[j.days.length - window.length - 1]!.equity : j.startEquity;
  const r = dailyReturns(window, startEq);
  const equity = [j.startEquity, ...j.days.map((d) => d.equity)];
  const pnls = window.flatMap((d) => d.trades.map((t) => t.pnl));
  const avgDailyPnl = mean(window.map((d, k) => d.equity - (k === 0 ? startEq : window[k - 1]!.equity)));
  const targetDailyPnl = (cfg.sleeveCapital * cfg.targetMonthlyReturnPct) / 100 / 21;
  const sh = sharpe(r);
  const mdd = maxDrawdown(equity);
  const pf = profitFactor(pnls);
  const last = window[window.length - 1];
  const prevEq = window.length > 1 ? window[window.length - 2]!.equity : startEq;
  const todayDD = last ? Math.max(0, 1 - last.equity / prevEq) : 0;
  const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 1));
  const pfNorm = clamp((Math.min(pf, 3) - 1) / (2 - 1)); // 1.0 → 0, 2.0 (target) → 1
  const ahs =
    0.35 * clamp(targetDailyPnl > 0 ? avgDailyPnl / targetDailyPnl : 0) +
    0.25 * clamp(sh / 2.5) +
    0.25 * clamp(1 - mdd / (cfg.maxDrawdownPct / 100)) +
    0.15 * (pnls.length ? pfNorm : 0.5);

  const reasons: string[] = [];
  if (mdd * 100 >= cfg.maxDrawdownPct) reasons.push(`max drawdown ${(mdd * 100).toFixed(2)}% ≥ ${cfg.maxDrawdownPct}%`);
  const realizedToday = last?.realizedPnl ?? 0;
  if (-realizedToday >= cfg.dailyLossLimitUsd) reasons.push(`daily loss $${(-realizedToday).toFixed(0)} ≥ $${cfg.dailyLossLimitUsd}`);
  if (todayDD * 100 >= cfg.maxDailyDrawdownPct) reasons.push(`daily drawdown ${(todayDD * 100).toFixed(2)}% ≥ ${cfg.maxDailyDrawdownPct}%`);

  let health: Health;
  if (mdd * 100 >= cfg.maxDrawdownPct) health = "terminate"; // hard stop applies even during warm-up
  else if (j.days.length < cfg.warmupDays) health = "warmup";
  else health = ahs >= 0.85 ? "autonomous" : ahs >= 0.7 ? "caution" : "terminate";
  if (health === "terminate" && !reasons.length) reasons.push(`AHS ${ahs.toFixed(2)} < 0.70`);

  return {
    days: j.days.length,
    equity: equity[equity.length - 1]!,
    avgDailyPnl,
    targetDailyPnl,
    sharpe: sh,
    sortino: sortino(r),
    maxDrawdownPct: mdd * 100,
    todayDrawdownPct: todayDD * 100,
    profitFactor: pf,
    winRate: pnls.length ? pnls.filter((x) => x > 0).length / pnls.length : 0,
    ahs,
    health,
    // warm-up trades at half size until there's a track record
    sizeMultiplier: health === "autonomous" ? 1 : health === "caution" || health === "warmup" ? 0.5 : 0,
    reasons,
  };
}

export interface Check {
  ok: boolean;
  reasons: string[];
}

/** The gate. Rejects anything that breaks a CLAUDE.md rule; returns every reason, not just the first. */
export function checkOrder(o: PlannedOrder, ctx: { cfg: Config; quote: Quote | undefined; positions: Position[]; card: Scorecard; now: Date; dataAgeDays?: number }): Check {
  const { cfg, quote, positions, card } = ctx;
  const why: string[] = [];
  const protective = o.type === "stop" && o.side === "sell";
  if (o.type !== "limit" && !protective) why.push("limit orders only (a stop is allowed only as a protective sell)");
  if (!cfg.symbols.includes(o.symbol)) why.push(`${o.symbol} is outside the approved universe`);
  if (!(o.qty > 0) || !Number.isFinite(o.qty)) why.push("quantity must be positive");
  if (!quote) why.push(`no quote for ${o.symbol}`);
  else {
    const ageS = (ctx.now.getTime() - new Date(quote.at).getTime()) / 1000;
    if (!(ageS <= 60)) why.push(`quote is ${Math.round(ageS)} s old (max 60)`);
    if (!(quote.bid > 0 && quote.ask >= quote.bid)) why.push("quote is not sane");
    const mid = (quote.bid + quote.ask) / 2;
    const away = Math.abs(o.limitPrice / mid - 1) * 100;
    if (protective) {
      if (o.limitPrice >= quote.bid) why.push("a protective stop must sit below the market");
    } else if (away > cfg.maxSlippagePct) why.push(`limit ${away.toFixed(3)}% from mid exceeds ${cfg.maxSlippagePct}%`);
  }
  if (o.side === "buy") {
    if (card.health === "terminate") why.push("health is TERMINATE: no new buys");
    if (card.reasons.some((r) => r.startsWith("daily"))) why.push("daily loss or drawdown limit hit: no new buys today");
    if (!(o.stopPrice && o.stopPrice < o.limitPrice)) why.push("every buy needs a protective stop below the entry");
    else if ((1 - o.stopPrice / o.limitPrice) * 100 > cfg.stopPct + 1e-9) why.push(`stop is wider than ${cfg.stopPct}%`);
    const cap = cfg.sleeveCapital * card.sizeMultiplier;
    const value = o.qty * o.limitPrice;
    const held = positions.find((p) => p.symbol === o.symbol);
    const posValue = value + (held ? held.qty * held.avgPrice : 0);
    if (posValue > (cap * cfg.maxPositionPct) / 100 + 1e-6) why.push(`position $${posValue.toFixed(0)} exceeds ${cfg.maxPositionPct}% of the sleeve ($${((cap * cfg.maxPositionPct) / 100).toFixed(0)} at size ×${card.sizeMultiplier})`);
    const exposure = positions.reduce((a, p) => a + p.qty * p.avgPrice, 0) + value;
    if (exposure > (cap * cfg.maxExposurePct) / 100 + 1e-6) why.push(`exposure $${exposure.toFixed(0)} exceeds ${cfg.maxExposurePct}% of the sleeve`);
    if (ctx.dataAgeDays !== undefined && ctx.dataAgeDays > cfg.maxDataAgeDays) why.push(`signal data is ${ctx.dataAgeDays} days old (max ${cfg.maxDataAgeDays})`);
  } else {
    const held = positions.find((p) => p.symbol === o.symbol);
    if (!held || held.qty < o.qty - 1e-9) why.push(`can only sell shares the bot holds (${held?.qty ?? 0} ${o.symbol})`);
  }
  return { ok: why.length === 0, reasons: why };
}
