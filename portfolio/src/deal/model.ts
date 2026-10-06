// Wholesale deal model — the same arithmetic as Wholesale_Deal_Analyzer_v2.xlsx, plus its Monte Carlo.
// Pure TypeScript; checked against the workbook in scripts/lab-check.ts.

import { rng } from "../lab/ops.ts";

export interface DealInputs {
  arv: number;
  rehab: number;
  contingency: number; // fraction of rehab
  rule: number; // 0.70
  fee: number;
  emd: number;
  marketing: number;
  buyerCosts: number; // fraction of ARV
  minMargin: number; // fraction of ARV
  closeRate: number; // probability
  emdLoss: number; // fraction of EMD lost on fall-through
  contract: number;
  // Monte Carlo
  arvSd: number;
  overrunMean: number;
  overrunSd: number;
}

export const DEAL_DEFAULTS: DealInputs = {
  arv: 160000,
  rehab: 40000,
  contingency: 0.15,
  rule: 0.7,
  fee: 10000,
  emd: 500,
  marketing: 800,
  buyerCosts: 0.1,
  minMargin: 0.2,
  closeRate: 0.7,
  emdLoss: 0.5,
  contract: 60000,
  arvSd: 0.08,
  overrunMean: 0.1,
  overrunSd: 0.15,
};

export interface DealResult {
  rehabAll: number;
  mao: number;
  assign: number;
  net: number;
  cashAtRisk: number;
  roc: number;
  expected: number;
  buyerAllIn: number;
  buyerProfit: number;
  buyerMargin: number;
  signal: "GO" | "NO-GO: offer above MAO" | "WEAK: buyer margin below minimum" | "NO-GO: expected profit ≤ 0";
  /** v1's formulas on the same inputs, for comparison */
  v1: { mao: number; buyerMargin: number; signal: string };
}

export function analyze(d: DealInputs): DealResult {
  const rehabAll = d.rehab * (1 + d.contingency);
  const mao = Math.max(0, d.arv * d.rule - rehabAll - d.fee);
  const assign = d.contract + d.fee;
  const net = d.fee - d.marketing;
  const cashAtRisk = d.emd + d.marketing;
  const roc = cashAtRisk ? net / cashAtRisk : 0;
  const expected = d.closeRate * net - (1 - d.closeRate) * (d.marketing + d.emd * d.emdLoss);
  const buyerAllIn = assign + rehabAll + d.arv * d.buyerCosts;
  const buyerProfit = d.arv - buyerAllIn;
  const buyerMargin = d.arv ? buyerProfit / d.arv : 0;
  const signal =
    d.contract > mao ? "NO-GO: offer above MAO" : buyerMargin < d.minMargin ? "WEAK: buyer margin below minimum" : expected <= 0 ? "NO-GO: expected profit ≤ 0" : "GO";
  const v1Mao = d.arv * d.rule - d.rehab - d.fee;
  const v1Margin = d.arv ? (d.arv - (assign + d.rehab)) / d.arv : 0;
  const v1Signal = d.contract <= v1Mao && v1Margin >= 0.15 && net > 0 ? "GO" : d.contract > v1Mao ? "NO-GO: offer above MAO" : v1Margin < 0.15 ? "WEAK" : "CHECK";
  return { rehabAll, mao, assign, net, cashAtRisk, roc, expected, buyerAllIn, buyerProfit, buyerMargin, signal, v1: { mao: v1Mao, buyerMargin: v1Margin, signal: v1Signal } };
}

function gauss(rand: () => number): number {
  // Box–Muller
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export interface Simulation {
  trials: number;
  pWorks: number;
  pBites: number;
  pLoss: number;
  avgProfit: number;
  margins: number[]; // sorted buyer margins
  p5: number;
  p50: number;
  p95: number;
}

export function simulate(d: DealInputs, trials = 5000, seed = 7): Simulation {
  const rand = rng(seed);
  const assign = d.contract + d.fee;
  const net = d.fee - d.marketing;
  const fail = -(d.marketing + d.emd * d.emdLoss);
  let works = 0;
  let bites = 0;
  let loss = 0;
  let sum = 0;
  const margins: number[] = [];
  for (let i = 0; i < trials; i++) {
    const arv = Math.max(0, d.arv * (1 + gauss(rand) * d.arvSd));
    const rehab = d.rehab * Math.max(0.9, 1 + d.overrunMean + gauss(rand) * d.overrunSd);
    const m = arv ? (arv - (assign + rehab + arv * d.buyerCosts)) / arv : 0;
    margins.push(m);
    const b = m >= d.minMargin;
    if (b) bites++;
    const profit = b && rand() < d.closeRate ? net : fail;
    if (profit > 0) works++;
    if (profit < 0) loss++;
    sum += profit;
  }
  margins.sort((a, b) => a - b);
  const q = (p: number) => margins[Math.min(margins.length - 1, Math.floor(p * margins.length))]!;
  return { trials, pWorks: works / trials, pBites: bites / trials, pLoss: loss / trials, avgProfit: sum / trials, margins, p5: q(0.05), p50: q(0.5), p95: q(0.95) };
}

/** Highest contract price at which the deal still works in at least `target` of simulated outcomes. */
export function maxPriceFor(d: DealInputs, target = 0.6): number {
  let lo = 0;
  let hi = d.arv;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (simulate({ ...d, contract: mid }, 2000, 11).pWorks >= target) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo / 500) * 500;
}
