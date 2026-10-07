// trading_journal.json and daily_summary.md: the bot's persistent record.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Config, Journal } from "./types.ts";
import type { Scorecard } from "./risk.ts";

export function loadJournal(path: string, cfg: Config): Journal {
  if (!existsSync(path)) return { version: 1, mode: cfg.mode, startEquity: cfg.sleeveCapital, days: [] };
  const j = JSON.parse(readFileSync(path, "utf8")) as Journal;
  if (j.version !== 1 || !Array.isArray(j.days)) throw new Error(`${path}: not a v1 journal`);
  return j;
}

export function saveJournal(path: string, j: Journal) {
  writeFileSync(path, `${JSON.stringify(j, null, 2)}\n`);
}

export function summary(date: string, card: Scorecard, cfg: Config): string {
  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "∞");
  return [
    `# Daily summary · ${date} · ${cfg.mode.toUpperCase()}`,
    "",
    `| Metric | Value |`,
    `| :-- | --: |`,
    `| Sleeve equity | $${f(card.equity)} |`,
    `| Avg daily PnL (21d) | $${f(card.avgDailyPnl)} vs target $${f(card.targetDailyPnl)} |`,
    `| Sharpe (ann.) | ${f(card.sharpe)} |`,
    `| Sortino (ann.) | ${f(card.sortino)} |`,
    `| Max drawdown | ${f(card.maxDrawdownPct)}% |`,
    `| Today's drawdown | ${f(card.todayDrawdownPct)}% |`,
    `| Profit factor | ${f(card.profitFactor)} |`,
    `| Win rate | ${f(card.winRate * 100, 1)}% |`,
    `| **AHS** | **${f(card.ahs)}** → ${card.health.toUpperCase()} (size ×${card.sizeMultiplier}) |`,
    "",
    card.reasons.length ? `Flags: ${card.reasons.join("; ")}` : "No risk flags.",
    "",
  ].join("\n");
}
