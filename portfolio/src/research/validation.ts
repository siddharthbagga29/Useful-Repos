// Research validation, kept apart from job execution. A Brain run can succeed (the workflow ran and
// committed its state) while the champion it reports fails validation. This module only judges the
// result; events.ts judges the job.

import type { BrainState } from "../brain/engine.ts";

export type Validation = "provisional" | "not-validated" | "unavailable";

export interface Check {
  label: string;
  pass: boolean;
  value: string;
}

export interface Assessment {
  status: Validation;
  /** why the strongest possible status here is "provisional" */
  ceiling: string;
  checks: Check[];
}

export const CRITERIA = {
  /** probability the in-sample Sharpe beats the best of N unskilled trials */
  minDsr: 0.95,
  /** holdout drawdown may be at most this much deeper than SPY's */
  maxExtraDrawdown: 0.05,
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/**
 * Three checks, all required, and even then only "provisional": the data excludes distributions and
 * the holdout has been displayed publicly, so no result here can be called validated.
 */
export function assessChampion(state: BrainState | null): Assessment {
  const ceiling = "Price-only data (no distributions) and a publicly displayed holdout cap any result at provisional.";
  if (!state?.champion) return { status: "unavailable", ceiling, checks: [] };
  const c = state.champion;
  const h = c.holdout;
  const checks: Check[] = [
    { label: `Deflated Sharpe ≥ ${pct(CRITERIA.minDsr)} after ${state.trials.toLocaleString("en-US")} trials`, pass: c.is.dsr >= CRITERIA.minDsr, value: pct(c.is.dsr) },
    h
      ? { label: "Holdout Sharpe above SPY's", pass: h.sharpe > h.spySharpe, value: `${h.sharpe.toFixed(2)} vs ${h.spySharpe.toFixed(2)}` }
      : { label: "Holdout Sharpe above SPY's", pass: false, value: "not reported" },
    h
      ? { label: `Holdout drawdown within ${pct(CRITERIA.maxExtraDrawdown)} of SPY's`, pass: h.maxDD >= h.spyMaxDD - CRITERIA.maxExtraDrawdown, value: `${pct(h.maxDD)} vs ${pct(h.spyMaxDD)}` }
      : { label: "Holdout drawdown within tolerance", pass: false, value: "not reported" },
  ];
  return { status: checks.every((x) => x.pass) ? "provisional" : "not-validated", ceiling, checks };
}

export const VALIDATION_LABEL: Record<Validation, string> = {
  provisional: "Provisional: passes all checks, not independently validated",
  "not-validated": "Not validated: fails at least one check",
  unavailable: "Unavailable: no champion loaded",
};
