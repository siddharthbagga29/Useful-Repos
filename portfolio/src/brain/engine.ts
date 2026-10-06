// The Brain: a self-improving research loop over the Strategy Lab's rule families.
//
//   MUTATE    pick a hypothesis (rule family) by UCB1, mutate its best genome
//   EXECUTE   backtest the child on the selection window only (a sliced copy of the data)
//   EVALUATE  score it 0–100 on an institutional rubric and play it against the champion,
//             fold by fold, with Elo ratings
//   VERIFY    the Deflated Sharpe Ratio (Bailey & López de Prado 2014) discounts every score by
//             how many strategies the loop has already tried
//   EVOLVE    promote winners, log why losers lost, and adapt the next mutation to that reason
//
// The holdout (2021-05-10 → end) is never passed to selection. It is reported for the champion
// only, so anyone can see whether in-sample wins survive out of sample. Pure TypeScript: runs in
// Node on a schedule (scripts/brain-run.ts) and its types are shared with the site.

import { backtest, metrics, type Dataset, type Metrics, type Params, type StrategyId } from "../lab/backtest.ts";
import { rng } from "../lab/ops.ts";

export const SPLIT_DATE = "2021-05-10";
export const COST_BPS = 10;
const WARMUP = 52;
const FOLDS = 4;
const TIE = 0.05; // fold Sharpe difference treated as a draw
const K_ELO = 16;
const GUARD_DD = -0.35;
const GUARD_DRAG = 0.015; // cost drag per year
const LOG_KEEP = 240;
const HOF_KEEP = 8;

export type Family = "trend" | "dualmom" | "invvol" | "voltarget" | "static";

export const HYPOTHESES: { id: Family; name: string; claim: string }[] = [
  { id: "trend", name: "H1 · Trend filter", claim: "A moving-average filter on an equity index sidesteps the worst bear markets without giving up most of the return." },
  { id: "dualmom", name: "H2 · Dual momentum", claim: "Rotating into the strongest asset, and to a defensive asset when nothing is rising, beats a fixed mix." },
  { id: "invvol", name: "H3 · Inverse volatility", claim: "Sizing sleeves by 1/volatility earns a better risk-adjusted return than equal weights." },
  { id: "voltarget", name: "H4 · Volatility target", claim: "Cutting exposure when realised volatility spikes improves an equity index's Sharpe ratio." },
  { id: "static", name: "H5 · Strategic mix", claim: "A diversified fixed mix, rebalanced on a schedule, is hard to beat after costs." },
];

const EQUITY = ["SPY", "QQQ", "IWM", "EFA"];
const DEFENSIVE = ["AGG", "TLT", "GLD", "CASH"];
const ALL = ["SPY", "QQQ", "IWM", "EFA", "AGG", "TLT", "GLD", "VNQ"];

export type Genome = Pick<Params, "strategy" | "asset" | "weights" | "universe" | "safe" | "smaWeeks" | "lookbackWeeks" | "rebalanceWeeks" | "targetVolPct">;

export interface Rubric {
  riskReturn: number; // /30
  consistency: number; // /20
  drawdown: number; // /20
  costs: number; // /10
  robustness: number; // /20  (Deflated Sharpe probability)
}

export interface Candidate {
  id: string;
  family: Family;
  genome: Genome;
  label: string;
  born: number;
  elo: number;
  score: number;
  rubric: Rubric;
  is: { sharpe: number; cagr: number; maxDD: number; turnover: number; drag: number; dsr: number; folds: number[]; srWeekly: number; skew: number; kurt: number; n: number };
  holdout?: { cagr: number; sharpe: number; maxDD: number; spyCagr: number; spySharpe: number; spyMaxDD: number };
}

export interface LogEntry {
  t: string;
  gen: number;
  kind: "run" | "explore" | "promote" | "reject" | "fix" | "record";
  text: string;
}

interface FamilyState {
  trials: number;
  wins: number;
  best: Candidate | null;
  step: number;
  recent: number[]; // 1 = improved its family, 0 = not (last 20)
  bias: { rebalance: number; sma: number; vol: number; safe: number };
}

export interface BrainState {
  version: 1;
  split: { selection: [string, string]; holdout: [string, string] };
  createdAt: string;
  lastRun: string;
  runs: number;
  generation: number;
  trials: number;
  srStats: { n: number; mean: number; m2: number };
  champion: Candidate;
  families: Record<Family, FamilyState>;
  hallOfFame: Candidate[];
  log: LogEntry[];
}

// ---------------------------------------------------------------- data

export function splitIndex(data: Dataset): number {
  const i = data.dates.findIndex((d) => d >= SPLIT_DATE);
  return i < 0 ? data.dates.length - 1 : i;
}

/** The only data selection ever sees: everything up to and including the split week. */
export function selectionData(data: Dataset): Dataset {
  const end = splitIndex(data) + 1;
  return {
    source: data.source,
    asOf: data.dates[end - 1]!,
    dates: data.dates.slice(0, end),
    series: Object.fromEntries(Object.entries(data.series).map(([k, v]) => [k, v.slice(0, end)])),
  };
}

// ---------------------------------------------------------------- statistics

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
function sd(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
}
function moments(xs: number[]) {
  const m = mean(xs);
  const s = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1e-12;
  const skew = xs.reduce((a, b) => a + ((b - m) / s) ** 3, 0) / xs.length;
  const kurt = xs.reduce((a, b) => a + ((b - m) / s) ** 4, 0) / xs.length;
  return { skew, kurt };
}

/** Standard normal CDF (Zelen & Severo 26.2.17, |error| < 7.5e-8). */
export function phi(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Inverse standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9). */
export function phiInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - lo) return -phiInv(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/**
 * Deflated Sharpe Ratio: probability that the true Sharpe is above what the best of `trials`
 * unskilled strategies would show by luck. All Sharpe ratios here are per-period (weekly).
 */
export function deflatedSharpe(sr: number, n: number, skew: number, kurt: number, trials: number, srVar: number): number {
  const g = 0.5772156649;
  const N = Math.max(2, trials);
  const sr0 = Math.sqrt(Math.max(0, srVar)) * ((1 - g) * phiInv(1 - 1 / N) + g * phiInv(1 - 1 / (N * Math.E)));
  const den = Math.sqrt(Math.max(1e-12, 1 - skew * sr + ((kurt - 1) / 4) * sr * sr));
  return phi(((sr - sr0) * Math.sqrt(Math.max(1, n - 1))) / den);
}

// ---------------------------------------------------------------- genomes

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function gauss(rand: () => number) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const pick = <T,>(xs: T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)]!;

export function seedGenome(f: Family): Genome {
  const base: Genome = { strategy: f as StrategyId, asset: "SPY", weights: { SPY: 60, AGG: 40 }, universe: ["SPY", "EFA"], safe: "AGG", smaWeeks: 40, lookbackWeeks: 52, rebalanceWeeks: 4, targetVolPct: 12 };
  if (f === "invvol") base.universe = ["SPY", "AGG", "GLD"];
  return base;
}

function randomGenome(f: Family, rand: () => number): Genome {
  const g = seedGenome(f);
  g.asset = pick(EQUITY, rand);
  g.safe = pick(DEFENSIVE, rand);
  g.smaWeeks = clampInt(10 + rand() * 50, 8, 60);
  g.lookbackWeeks = clampInt(8 + rand() * 70, 8, 78);
  g.rebalanceWeeks = clampInt(1 + rand() * 12, 1, 13);
  g.targetVolPct = clamp(Math.round((6 + rand() * 14) * 2) / 2, 5, 20);
  const pool = [...ALL].sort(() => rand() - 0.5);
  g.universe = pool.slice(0, 2 + Math.floor(rand() * 3));
  if (f === "dualmom") g.universe = [...EQUITY].sort(() => rand() - 0.5).slice(0, 2 + Math.floor(rand() * 2));
  if (f === "static") g.weights = Object.fromEntries(pool.slice(0, 3 + Math.floor(rand() * 3)).map((a) => [a, 10 + Math.round(rand() * 50)]));
  return normalise(g);
}

function normalise(g: Genome): Genome {
  const w = Object.entries(g.weights).filter(([, v]) => v > 0);
  const s = w.reduce((a, [, v]) => a + v, 0) || 1;
  g.weights = Object.fromEntries(w.map(([k, v]) => [k, Math.round((v / s) * 100)]));
  g.universe = [...new Set(g.universe)].filter((a) => ALL.includes(a));
  if (g.universe.length < 2) g.universe = ["SPY", "AGG"];
  if (g.strategy === "dualmom") g.universe = g.universe.filter((a) => a !== g.safe);
  if (g.strategy === "dualmom" && g.universe.length < 2) g.universe = ["SPY", "EFA"];
  return g;
}

export function mutate(parent: Genome, f: FamilyState, rand: () => number): { g: Genome; fix: string | null } {
  const g: Genome = JSON.parse(JSON.stringify(parent));
  const s = f.step;
  let fix: string | null = null;
  g.smaWeeks = clampInt(g.smaWeeks + gauss(rand) * 6 * s + f.bias.sma, 8, 60);
  g.lookbackWeeks = clampInt(g.lookbackWeeks + gauss(rand) * 8 * s, 8, 78);
  g.rebalanceWeeks = clampInt(g.rebalanceWeeks + gauss(rand) * 1.5 * s + f.bias.rebalance, 1, 13);
  g.targetVolPct = clamp(Math.round((g.targetVolPct + gauss(rand) * 1.5 * s + f.bias.vol) * 2) / 2, 5, 20);
  if (rand() < 0.15 * s) g.asset = pick(EQUITY, rand);
  if (rand() < 0.15 * s || f.bias.safe > 0) g.safe = pick(f.bias.safe > 0 ? ["AGG", "TLT", "GLD"] : DEFENSIVE, rand);
  if (rand() < 0.3) {
    const a = pick(g.strategy === "dualmom" ? EQUITY : ALL, rand);
    g.universe = g.universe.includes(a) && g.universe.length > 2 ? g.universe.filter((x) => x !== a) : [...g.universe, a].slice(0, 5);
  }
  if (g.strategy === "static") {
    const keys = Object.keys(g.weights);
    const k = rand() < 0.2 ? pick(ALL, rand) : pick(keys, rand);
    g.weights[k] = Math.max(0, (g.weights[k] ?? 0) + gauss(rand) * 10 * s);
    if (f.bias.safe > 0) g.weights.AGG = (g.weights.AGG ?? 0) + 5;
  }
  if (f.bias.rebalance > 0) fix = `slower rebalancing (+${f.bias.rebalance.toFixed(1)} wk) after turnover rejections`;
  else if (f.bias.vol < 0 || f.bias.safe > 0) fix = "more defensive settings after drawdown rejections";
  else if (f.bias.sma > 0) fix = "longer signal windows after whipsaw losses";
  // memory decays: a fix is applied for a few children, then the search is unbiased again
  f.bias = { rebalance: f.bias.rebalance * 0.6, sma: f.bias.sma * 0.6, vol: f.bias.vol * 0.6, safe: Math.max(0, f.bias.safe - 1) };
  if (Math.abs(f.bias.rebalance) < 0.2) f.bias.rebalance = 0;
  if (Math.abs(f.bias.sma) < 0.5) f.bias.sma = 0;
  if (Math.abs(f.bias.vol) < 0.2) f.bias.vol = 0;
  return { g: normalise(g), fix };
}

export function describe(g: Genome): string {
  const w = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(" / ");
  switch (g.strategy) {
    case "trend":
      return `Trend: ${g.asset} above its ${g.smaWeeks}-wk average, else ${g.safe}`;
    case "dualmom":
      return `Dual momentum: best of ${g.universe.join(", ")} over ${g.lookbackWeeks} wk, else ${g.safe}, every ${g.rebalanceWeeks} wk`;
    case "invvol":
      return `Inverse vol: ${g.universe.join(", ")} on ${g.lookbackWeeks}-wk vol, every ${g.rebalanceWeeks} wk`;
    case "voltarget":
      return `Vol target: ${g.asset} at ${g.targetVolPct}% vol (${g.lookbackWeeks}-wk), rest in ${g.safe}`;
    case "static":
      return `Mix: ${w(g.weights)}, rebalanced every ${g.rebalanceWeeks} wk`;
    default:
      return g.strategy;
  }
}

// ---------------------------------------------------------------- evaluation

const toParams = (g: Genome): Params => ({ ...g, costBps: COST_BPS, startIndex: 0 });

function weekly(eq: number[]) {
  const r: number[] = [];
  for (let i = 1; i < eq.length; i++) r.push(eq[i]! / eq[i - 1]! - 1);
  return r;
}

/** Evaluate on the selection window. `sel` must come from selectionData(). */
export function evaluate(sel: Dataset, g: Genome, gen: number, id: string, srStats: BrainState["srStats"], trials: number): Candidate {
  const res = backtest(sel, toParams(g));
  const r = weekly(res.equity).slice(WARMUP);
  const len = Math.floor(r.length / FOLDS);
  const folds = Array.from({ length: FOLDS }, (_, k) => {
    const x = r.slice(k * len, k === FOLDS - 1 ? r.length : (k + 1) * len);
    const v = sd(x);
    return v > 0 ? (mean(x) / v) * Math.sqrt(52) : 0;
  });
  const v = sd(r);
  const srWeekly = v > 0 ? mean(r) / v : 0;
  const { skew, kurt } = moments(r);
  const m = res.metrics;
  const drag = 2 * m.turnover * (COST_BPS / 10_000);
  const c: Candidate = {
    id,
    family: g.strategy as Family,
    genome: g,
    label: describe(g),
    born: gen,
    elo: 1500,
    score: 0,
    rubric: { riskReturn: 0, consistency: 0, drawdown: 0, costs: 0, robustness: 0 },
    is: { sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD, turnover: m.turnover, drag, dsr: 0, folds, srWeekly, skew, kurt, n: r.length },
  };
  rescore(c, srStats, trials);
  return c;
}

/** Recompute the rubric. Robustness depends on how many trials have been run, so scores are refreshed every run. */
export function rescore(c: Candidate, srStats: BrainState["srStats"], trials: number) {
  const srVar = srStats.n > 1 ? srStats.m2 / (srStats.n - 1) : 0;
  c.is.dsr = deflatedSharpe(c.is.srWeekly, c.is.n, c.is.skew, c.is.kurt, trials, srVar);
  c.rubric = {
    riskReturn: 30 * clamp(c.is.sharpe / 1.2, 0, 1),
    consistency: 20 * (c.is.folds.filter((x) => x > 0).length / c.is.folds.length),
    drawdown: 20 * clamp(1 - (-c.is.maxDD - 0.1) / 0.25, 0, 1),
    costs: 10 * clamp(1 - c.is.drag / 0.01, 0, 1),
    robustness: 20 * c.is.dsr,
  };
  c.score = Math.round(Object.values(c.rubric).reduce((a, b) => a + b, 0) * 10) / 10;
}

/** Out-of-sample report for display only. Never feeds back into selection. */
export function holdout(full: Dataset, g: Genome): NonNullable<Candidate["holdout"]> {
  const s = splitIndex(full);
  const res = backtest(full, toParams(g));
  const a: Metrics = metrics(res.equity.slice(s));
  const b: Metrics = metrics(res.bench.slice(s));
  return { cagr: a.cagr, sharpe: a.sharpe, maxDD: a.maxDD, spyCagr: b.cagr, spySharpe: b.sharpe, spyMaxDD: b.maxDD };
}

/** Fold-by-fold Elo match. Returns the challenger's wins and losses. */
export function match(champ: Candidate, ch: Candidate) {
  let wins = 0;
  let losses = 0;
  for (let k = 0; k < FOLDS; k++) {
    const d = ch.is.folds[k]! - champ.is.folds[k]!;
    const s = d > TIE ? 1 : d < -TIE ? 0 : 0.5;
    if (s === 1) wins++;
    if (s === 0) losses++;
    const e = 1 / (1 + 10 ** ((champ.elo - ch.elo) / 400));
    ch.elo += K_ELO * (s - e);
    champ.elo -= K_ELO * (s - e);
  }
  ch.elo = Math.round(ch.elo);
  champ.elo = Math.round(champ.elo);
  return { wins, losses };
}

// ---------------------------------------------------------------- loop

const FAMILIES = HYPOTHESES.map((h) => h.id);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function initState(full: Dataset, now: string): BrainState {
  const sel = selectionData(full);
  const s = splitIndex(full);
  const srStats = { n: 0, mean: 0, m2: 0 };
  const champion = evaluate(sel, seedGenome("static"), 0, "g0-seed", srStats, 1);
  champion.holdout = holdout(full, champion.genome);
  const families = Object.fromEntries(FAMILIES.map((f) => [f, { trials: 0, wins: 0, best: null, step: 1, recent: [], bias: { rebalance: 0, sma: 0, vol: 0, safe: 0 } }])) as unknown as Record<Family, FamilyState>;
  return {
    version: 1,
    split: { selection: [full.dates[0]!, full.dates[s]!], holdout: [full.dates[s]!, full.dates[full.dates.length - 1]!] },
    createdAt: now,
    lastRun: now,
    runs: 0,
    generation: 0,
    trials: 0,
    srStats,
    champion,
    families,
    hallOfFame: [champion],
    log: [{ t: now, gen: 0, kind: "run", text: `Seeded with a 60/40 mix. Selection window ${full.dates[0]} → ${full.dates[s]}; holdout locked from ${full.dates[s]}.` }],
  };
}

function ucb(state: BrainState, f: Family) {
  const fs = state.families[f];
  if (fs.trials === 0) return Infinity;
  const total = FAMILIES.reduce((a, x) => a + state.families[x].trials, 0);
  return fs.wins / fs.trials + Math.sqrt((2 * Math.log(Math.max(2, total))) / fs.trials);
}

/** Run `generations` generations of `children` each. Deterministic for a given state. */
export function evolve(state: BrainState, full: Dataset, generations: number, now: string, children = 6): BrainState {
  const sel = selectionData(full);
  const s: BrainState = JSON.parse(JSON.stringify(state));
  const log = (kind: LogEntry["kind"], text: string) => s.log.push({ t: now, gen: s.generation, kind, text });
  s.runs += 1;
  log("run", `Run ${s.runs} started: ${generations} generations × ${children} children.`);
  const startChampion = s.champion.id;

  for (let gi = 0; gi < generations; gi++) {
    s.generation += 1;
    const rand = rng(0x9e3779b1 ^ (s.generation * 2654435761));
    const fam = [...FAMILIES].sort((a, b) => ucb(s, b) - ucb(s, a))[0]!;
    const fs = s.families[fam];
    const parent = fs.best?.genome ?? seedGenome(fam);
    let improved = false;
    let lastFix: string | null = null;
    for (let c = 0; c < children; c++) {
      const restart = !fs.best || rand() < 0.12;
      const { g, fix } = restart ? { g: randomGenome(fam, rand), fix: null } : mutate(parent, fs, rand);
      if (fix) lastFix = fix;
      s.trials += 1;
      const ch = evaluate(sel, g, s.generation, `g${s.generation}-${c}`, s.srStats, s.trials);
      // Welford update of the cross-trial variance of weekly Sharpe (feeds the DSR)
      s.srStats.n += 1;
      const d = ch.is.srWeekly - s.srStats.mean;
      s.srStats.mean += d / s.srStats.n;
      s.srStats.m2 += d * (ch.is.srWeekly - s.srStats.mean);
      fs.trials += 1;

      if (!fs.best || ch.score > fs.best.score) {
        fs.best = ch;
        improved = true;
      }
      const guardDD = ch.is.maxDD < GUARD_DD;
      const guardDrag = ch.is.drag > GUARD_DRAG;
      rescore(s.champion, s.srStats, s.trials);
      const m = match(s.champion, ch);
      if (!guardDD && !guardDrag && m.wins > m.losses && ch.score > s.champion.score) {
        ch.holdout = holdout(full, ch.genome);
        log("promote", `${ch.label} → champion. Score ${ch.score.toFixed(1)} vs ${s.champion.score.toFixed(1)}, won ${m.wins}/${FOLDS} folds, Elo ${ch.elo}. Holdout Sharpe ${ch.holdout.sharpe.toFixed(2)} vs SPY ${ch.holdout.spySharpe.toFixed(2)}.`);
        s.champion = ch;
        fs.wins += 1;
      } else if (guardDrag) {
        fs.bias.rebalance = 2;
        fs.bias.sma = 6;
        log("reject", `${ch.label}: cost drag ${pct(ch.is.drag)}/yr breaks the ${pct(GUARD_DRAG)} guard.`);
      } else if (guardDD) {
        fs.bias.vol = -2;
        fs.bias.safe = 2;
        log("reject", `${ch.label}: drawdown ${pct(ch.is.maxDD)} breaks the ${pct(GUARD_DD)} guard.`);
      } else if (c === children - 1 || rand() < 0.15) {
        // log a sample of ordinary rejections so the console shows the work without flooding it
        log("reject", `${ch.label}: score ${ch.score.toFixed(1)} vs champion ${s.champion.score.toFixed(1)}, ${m.wins}–${m.losses} on folds.`);
      }
      s.hallOfFame = [...s.hallOfFame.filter((x) => x.id !== ch.id), ch]
        .sort((a, b) => b.score - a.score)
        .filter((x, i, arr) => arr.findIndex((y) => y.label === x.label) === i)
        .filter((x, i, arr) => arr.slice(0, i).filter((y) => y.family === x.family).length < 2) // keep the board diverse
        .slice(0, HOF_KEEP);
    }
    if (lastFix) log("fix", `${HYPOTHESES.find((h) => h.id === fam)!.name}: applied ${lastFix}.`);
    fs.recent = [...fs.recent, improved ? 1 : 0].slice(-20);
    const rate = fs.recent.reduce((a, b) => a + b, 0) / fs.recent.length;
    fs.step = clamp(fs.step * (rate > 0.2 ? 1.2 : 0.85), 0.3, 3); // Rechenberg's 1/5 success rule
    if (improved) log("explore", `${HYPOTHESES.find((h) => h.id === fam)!.name}: new family best ${fs.best!.label} (score ${fs.best!.score.toFixed(1)}).`);
  }

  // every score is deflated by the trial count, so refresh all of them before reporting
  rescore(s.champion, s.srStats, s.trials);
  for (const c of s.hallOfFame) {
    rescore(c, s.srStats, s.trials);
    if (!c.holdout) c.holdout = holdout(full, c.genome);
  }
  for (const f of FAMILIES) if (s.families[f].best) rescore(s.families[f].best!, s.srStats, s.trials);
  if (s.champion.id === startChampion) log("record", `No promotion this run. Champion holds at score ${s.champion.score.toFixed(1)} after ${s.trials.toLocaleString("en-US")} trials (DSR ${pct(s.champion.is.dsr)}).`);
  s.lastRun = now;
  s.log = s.log.slice(-LOG_KEEP);
  return s;
}
