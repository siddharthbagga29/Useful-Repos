import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Dataset } from "../../portfolio/src/lab/backtest.ts";
import { championWeights, fitToCaps, needsFreshData, planOrders, rebalanceDue } from "../src/plan.ts";
import { checkOrder, kelly, maxDrawdown, profitFactor, scorecard, sharpe } from "../src/risk.ts";
import type { Config, Journal, PlannedOrder, Quote } from "../src/types.ts";

const cfg = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8")) as Config;
const now = new Date("2026-10-07T14:00:00Z");
const quote = (symbol: string, mid: number, at = now): Quote => ({ symbol, bid: mid - 0.02, ask: mid + 0.02, at: at.toISOString() });
const day = (date: string, equity: number, pnl = 0, trades: number[] = []) => ({ date, equity, realizedPnl: pnl, trades: trades.map((p) => ({ pnl: p })), fills: [] });
const journal = (eqs: number[], start = 10_000): Journal => ({ version: 1, mode: "paper", startEquity: start, days: eqs.map((e, i) => day(`2026-09-${String(i + 1).padStart(2, "0")}`, e, 0, [e - (i ? eqs[i - 1]! : start)])) });
const buy = (o: Partial<PlannedOrder> = {}): PlannedOrder => ({ symbol: "SPY", side: "buy", type: "limit", qty: 1, limitPrice: 100.05, stopPrice: 98.6, timeInForce: "gfd", reason: "t", ...o });
const ctx = (over: Partial<Parameters<typeof checkOrder>[1]> = {}) => ({ cfg: { ...cfg, sleeveCapital: 100_000 }, quote: quote("SPY", 100), positions: [], card: scorecard(journal(Array(12).fill(0).map((_, i) => 10_000 + i * 60)), cfg), now, ...over });

test("kelly: textbook value and floors at zero", () => {
  assert.equal(kelly(0.55, 2, 1), (0.55 * 2 - 0.45) / 2);
  assert.equal(kelly(0.55, 2, 0.25), ((0.55 * 2 - 0.45) / 2) * 0.25);
  assert.equal(kelly(0.2, 1, 0.25), 0);
});

test("metrics: drawdown, profit factor, sharpe sign", () => {
  assert.equal(maxDrawdown([100, 120, 90, 130]), 0.25);
  assert.equal(profitFactor([200, -100]), 2);
  assert.ok(sharpe([0.01, 0.012, 0.009, 0.011]) > 0);
});

test("AHS: warm-up, autonomous, terminate on drawdown even in warm-up", () => {
  assert.equal(scorecard(journal([10_010, 10_020]), cfg).health, "warmup");
  let eq = 10_000;
  const good = scorecard(journal(Array.from({ length: 15 }, (_, i) => (eq += i % 3 === 2 ? 4 : 12))), cfg); // steady gains, no losing days
  assert.equal(good.health, "autonomous", `ahs ${good.ahs}`);
  const crash = scorecard(journal([10_000, 9_300]), cfg);
  assert.equal(crash.health, "terminate");
  assert.match(crash.reasons.join(), /max drawdown/);
});

test("AHS: PnL target scales with the sleeve, not a fixed $50k", () => {
  const c = scorecard(journal([10_010]), cfg);
  assert.ok(Math.abs(c.targetDailyPnl - (10_000 * 0.01) / 21) < 1e-9);
});

test("gate: a clean buy passes", () => {
  const c = checkOrder(buy(), ctx());
  assert.ok(c.ok, c.reasons.join("; "));
});

test("gate: market orders, missing or wide stops, stale quotes and outside symbols are rejected", () => {
  assert.match(checkOrder(buy({ type: "market" as "limit" }), ctx()).reasons.join(), /limit orders only/);
  assert.match(checkOrder(buy({ stopPrice: undefined }), ctx()).reasons.join(), /protective stop/);
  assert.match(checkOrder(buy({ stopPrice: 95 }), ctx()).reasons.join(), /wider than/);
  assert.match(checkOrder(buy(), ctx({ quote: quote("SPY", 100, new Date(now.getTime() - 120_000)) })).reasons.join(), /old/);
  assert.match(checkOrder(buy({ symbol: "TSLA" }), ctx({ quote: quote("TSLA", 100) })).reasons.join(), /outside the approved universe/);
  assert.match(checkOrder(buy({ limitPrice: 101, stopPrice: 99.6 }), ctx()).reasons.join(), /from mid/);
});

test("gate: position and exposure caps scale with health", () => {
  const big = buy({ qty: 60 }); // $6,003 > 5% of $100k at full size
  assert.match(checkOrder(big, ctx()).reasons.join(), /exceeds 5%/);
});

test("gate: terminate and daily loss block new buys; sells only from the bot's own shares", () => {
  const dead = scorecard(journal([10_000, 9_300]), cfg);
  assert.match(checkOrder(buy(), ctx({ card: dead })).reasons.join(), /TERMINATE/);
  const j = journal(Array(12).fill(10_000));
  j.days[j.days.length - 1]!.realizedPnl = -1_200;
  assert.match(checkOrder(buy(), ctx({ card: scorecard(j, cfg) })).reasons.join(), /daily loss/);
  const sell: PlannedOrder = { symbol: "SPY", side: "sell", type: "limit", qty: 5, limitPrice: 99.95, timeInForce: "gfd", reason: "t" };
  assert.match(checkOrder(sell, ctx({ positions: [{ symbol: "SPY", qty: 2, avgPrice: 90 }] })).reasons.join(), /only sell shares the bot holds/);
  assert.ok(checkOrder(sell, ctx({ positions: [{ symbol: "SPY", qty: 5, avgPrice: 90 }] })).ok);
  const stop: PlannedOrder = { ...sell, type: "stop", limitPrice: 98.5 };
  assert.ok(checkOrder(stop, ctx({ positions: [{ symbol: "SPY", qty: 5, avgPrice: 100 }] })).ok, "protective stop on held shares");
  assert.match(checkOrder({ ...stop, side: "buy" }, ctx()).reasons.join(), /limit orders only/);
});

test("plan: champion weights come from the lab, fit the caps, and become gated limit orders", () => {
  const data = JSON.parse(readFileSync(new URL("../../portfolio/src/lab/weekly.json", import.meta.url), "utf8")) as Dataset;
  const g = { strategy: "static" as const, asset: "QQQ", weights: { GLD: 32, QQQ: 68 }, universe: ["GLD"], safe: "GLD", smaWeeks: 40, lookbackWeeks: 52, rebalanceWeeks: 11, targetVolPct: 12 };
  const w = championWeights(g, data);
  assert.ok(Math.abs((w.GLD ?? 0) - 0.32) < 1e-9 && Math.abs((w.QQQ ?? 0) - 0.68) < 1e-9);
  assert.equal(needsFreshData(g), false);
  const { weights } = fitToCaps(w, cfg);
  assert.ok(Math.max(...Object.values(weights)) <= 0.05 + 1e-12);
  const big = { ...cfg, sleeveCapital: 500_000 };
  const orders = planOrders(weights, [], [quote("QQQ", 560), quote("GLD", 310)], 500_000, 1, big);
  assert.ok(orders.length === 2 && orders.every((o) => o.type === "limit" && o.side === "buy" && o.stopPrice! < o.limitPrice));
  for (const o of orders) assert.ok(checkOrder(o, ctx({ cfg: big, quote: quote(o.symbol, o.symbol === "QQQ" ? 560 : 310) })).ok);
});

test("plan: rebalance only when due", () => {
  assert.equal(rebalanceDue(undefined, 11, now), true);
  assert.equal(rebalanceDue("2026-09-30", 11, now), false);
  assert.equal(rebalanceDue("2026-07-01", 11, now), true);
});
