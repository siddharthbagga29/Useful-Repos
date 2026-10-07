// Shared types for the execution loop. The bot runs one strategy (the Brain's champion) inside a
// capped sleeve of the account; it never touches holdings it did not open.

export interface Config {
  /** "paper" never sends an order; "live" is only honoured with the LIVE_ACK file present */
  mode: "paper" | "live";
  /** the most capital the bot may control, in dollars; the rest of the account is out of bounds */
  sleeveCapital: number;
  /** performance target as a % of the sleeve per month (drives the AHS PnL term) */
  targetMonthlyReturnPct: number;
  symbols: string[];
  /** CLAUDE.md caps, as % of the sleeve */
  maxPositionPct: number;
  maxExposurePct: number;
  /** protective stop below each long entry, % of entry price */
  stopPct: number;
  kellyFraction: number;
  dailyLossLimitUsd: number;
  maxDailyDrawdownPct: number;
  maxDrawdownPct: number;
  /** limit price offset from the quote, % */
  limitOffsetPct: number;
  maxSlippagePct: number;
  cancelIfMovesPct: number;
  /** momentum-style signals refuse to trade on price data older than this */
  maxDataAgeDays: number;
  /** trading days of history before the AHS can terminate the bot */
  warmupDays: number;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  /** ISO time of the quote */
  at: string;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface PlannedOrder {
  symbol: string;
  side: "buy" | "sell";
  /** limit for every entry and exit; "stop" only for the protective sell placed after a buy fills */
  type: "limit" | "stop";
  qty: number;
  /** for limit orders; for stops, the stop trigger price */
  limitPrice: number;
  /** for buys: the protective stop to place once filled */
  stopPrice?: number;
  timeInForce: "gfd";
  reason: string;
}

export interface Fill {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  limitPrice: number;
  fillPrice: number;
  at: string;
}

export interface DayRecord {
  date: string;
  /** sleeve value at the close */
  equity: number;
  realizedPnl: number;
  trades: { pnl: number }[];
  fills: Fill[];
}

export interface Journal {
  version: 1;
  mode: Config["mode"];
  startEquity: number;
  days: DayRecord[];
  halted?: { at: string; reason: string };
  /** ISO date of the last strategy rebalance */
  lastRebalance?: string;
}

export type Health = "warmup" | "autonomous" | "caution" | "terminate";
