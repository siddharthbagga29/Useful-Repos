// Reproducible research run behind the Strategy Lab's "Research" and "Monte Carlo" sections.
//   node --experimental-strip-types scripts/research.ts      → src/lab/research.json
//
// 1. Online portfolio selection: tune each algorithm's hyperparameters on the first half of the
//    sample (in-sample), freeze them, and report the untouched second half (out-of-sample),
//    at realistic costs. Then sweep costs from 0 to 50 bps to find where each edge disappears.
// 2. Monte Carlo: 1,000 stationary-block-bootstrap paths of ten years each, run through every
//    strategy with frozen parameters, to estimate how often each one beats the S&P 500 on return,
//    drawdown and Sharpe — the probabilities, not a single lucky history.

import { readFileSync, writeFileSync } from "node:fs";
import { backtest, DEFAULTS, type Dataset, type Params } from "../src/lab/backtest.ts";
import { blockBootstrap, OPS, quantile, relatives, rng, runOps, stats, bcrpWeights, type OpsId, type OpsParams, type Stats } from "../src/lab/ops.ts";

const SEED = 20261006;
const PATHS = Number(process.env.PATHS ?? 1000);
const YEARS = 10;
const MEAN_BLOCK = 8; // weeks
const COST = 0.001; // 10 bps per side for the headline results
const SWEEP = [0, 0.0005, 0.001, 0.0025, 0.005];

const data = JSON.parse(readFileSync(new URL("../src/lab/weekly.json", import.meta.url), "utf8")) as Dataset;
const SYMS = Object.keys(data.series);
const X = relatives(SYMS.map((s) => data.series[s]!));
const T = X.length;
const split = Math.floor(T / 2);
const IS = X.slice(0, split);
const OOS = X.slice(split);
const splitDate = data.dates[split]!;

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const pack = (s: Stats) => ({ cagr: round(s.cagr), vol: round(s.vol), sharpe: round(s.sharpe, 3), maxDD: round(s.maxDD), final: round(s.final, 3) });

// ---------------------------------------------------------------- 1. OPS walk-forward
const spyIdx = SYMS.indexOf("SPY");
const spyWealth = (Xs: number[][]) => Xs.reduce((w, x) => (w.push(w.at(-1)! * x[spyIdx]!), w), [1]);

const ops = OPS.map((o) => {
  const tuned = o.grid.map((p) => ({ p, s: stats(runOps(o.id, IS, p, COST).wealth) }));
  const best = tuned.reduce((a, b) => (b.s.sharpe > a.s.sharpe ? b : a));
  // BCRP is an oracle: its weights come from the period it is scored on.
  const isRun = runOps(o.id, IS, best.p, COST, o.id === "bcrp" ? bcrpWeights(IS) : undefined);
  const oosRun = runOps(o.id, OOS, best.p, COST, o.id === "bcrp" ? bcrpWeights(OOS) : undefined);
  const sweep = SWEEP.map((c) => ({ costBps: c * 1e4, ...pack(stats(runOps(o.id, X, best.p, c).wealth)) }));
  // Overfit view: best parameters chosen on the full sample, scored on the full sample.
  const fullBest = o.grid.map((p) => stats(runOps(o.id, X, p, COST).wealth)).reduce((a, b) => (b.sharpe > a.sharpe ? b : a));
  return {
    id: o.id,
    name: o.name,
    family: o.family,
    ref: o.ref,
    params: best.p,
    grid: tuned.map((g) => ({ params: g.p, sharpe: round(g.s.sharpe, 3) })),
    inSample: pack(stats(isRun.wealth)),
    outOfSample: pack(stats(oosRun.wealth)),
    overfitFullSample: pack(fullBest),
    turnover: round(oosRun.turnover),
    sweep,
    oosWealth: oosRun.wealth.filter((_, i) => i % 2 === 0).map((w) => round(w, 4)),
  };
});
const spyOOS = pack(stats(spyWealth(OOS)));
const spyIS = pack(stats(spyWealth(IS)));

// break-even cost: lowest swept cost at which the strategy's full-sample CAGR falls below UCRP's
const ucrpSweep = ops.find((o) => o.id === "ucrp")!.sweep;
for (const o of ops) {
  const be = o.sweep.find((s, i) => s.cagr <= ucrpSweep[i]!.cagr);
  (o as Record<string, unknown>).breakEvenBps = o.id === "ucrp" || o.id === "bcrp" ? null : be ? be.costBps : `>${SWEEP.at(-1)! * 1e4}`;
}

// ---------------------------------------------------------------- 2. Monte Carlo
type Runner = (Xs: number[][]) => number[];
const toDataset = (Xs: number[][]): Dataset => {
  const series: Record<string, number[]> = {};
  SYMS.forEach((s, i) => {
    const p = [100];
    for (const x of Xs) p.push(p.at(-1)! * x[i]!);
    series[s] = p;
  });
  return { source: "bootstrap", asOf: "", dates: data.dates.slice(0, Xs.length + 1), series };
};
const rule = (p: Partial<Params>): Runner => (Xs) => backtest(toDataset(Xs), { ...DEFAULTS, costBps: COST * 1e4, ...p }, 1).equity;
const opsRunner = (id: OpsId, p: OpsParams): Runner => (Xs) => runOps(id, Xs, p, COST).wealth;
const frozen = (id: OpsId) => ops.find((o) => o.id === id)!.params;

const STRATS: { id: string; name: string; group: string; run: Runner }[] = [
  { id: "spy", name: "S&P 500 buy & hold", group: "Benchmark", run: (Xs) => spyWealth(Xs) },
  { id: "6040", name: "60/40 SPY/AGG", group: "Allocation", run: rule({ strategy: "static", weights: { SPY: 60, AGG: 40 }, rebalanceWeeks: 13 }) },
  { id: "trend", name: "Trend filter (40w)", group: "Allocation", run: rule({ strategy: "trend", asset: "SPY", smaWeeks: 40, safe: "AGG" }) },
  { id: "dualmom", name: "Dual momentum", group: "Allocation", run: rule({ strategy: "dualmom", universe: ["SPY", "EFA"], lookbackWeeks: 52, safe: "AGG", rebalanceWeeks: 4 }) },
  { id: "invvol", name: "Inverse volatility", group: "Allocation", run: rule({ strategy: "invvol", universe: ["SPY", "EFA", "AGG", "GLD", "VNQ"], lookbackWeeks: 26, rebalanceWeeks: 4 }) },
  { id: "voltarget", name: "SPY @ 12% vol", group: "Allocation", run: rule({ strategy: "voltarget", asset: "SPY", targetVolPct: 12, lookbackWeeks: 26, safe: "AGG" }) },
  { id: "ucrp", name: "Uniform CRP", group: "Online selection", run: opsRunner("ucrp", {}) },
  { id: "eg", name: "Exponentiated Gradient", group: "Online selection", run: opsRunner("eg", frozen("eg")) },
  { id: "pamr", name: "PAMR", group: "Online selection", run: opsRunner("pamr", frozen("pamr")) },
  { id: "olmar", name: "OLMAR", group: "Online selection", run: opsRunner("olmar", frozen("olmar")) },
];

const rand = rng(SEED);
const L = YEARS * 52;
const samples: Record<string, Stats[]> = Object.fromEntries(STRATS.map((s) => [s.id, []]));
const t0 = Date.now();
for (let k = 0; k < PATHS; k++) {
  const path = blockBootstrap(X, L, MEAN_BLOCK, rand);
  for (const s of STRATS) samples[s.id]!.push(stats(s.run(path)));
}
const spy = samples.spy!;
const hist = (xs: number[], lo: number, hi: number, bins = 24) => {
  const h = Array(bins).fill(0) as number[];
  for (const x of xs) h[Math.min(bins - 1, Math.max(0, Math.floor(((x - lo) / (hi - lo)) * bins)))]!++;
  return { lo, hi, counts: h };
};
const mc = STRATS.map((s) => {
  const xs = samples[s.id]!;
  const pct = (f: (a: Stats, i: number) => boolean) => round(xs.filter(f).length / xs.length, 3);
  const q = (k: keyof Stats) => ({ p5: round(quantile(xs.map((x) => x[k]), 0.05)), p25: round(quantile(xs.map((x) => x[k]), 0.25)), p50: round(quantile(xs.map((x) => x[k]), 0.5)), p75: round(quantile(xs.map((x) => x[k]), 0.75)), p95: round(quantile(xs.map((x) => x[k]), 0.95)) });
  return {
    id: s.id,
    name: s.name,
    group: s.group,
    cagr: q("cagr"),
    maxDD: q("maxDD"),
    sharpe: q("sharpe"),
    pPositive: pct((a) => a.cagr > 0),
    pBeatSpyReturn: s.id === "spy" ? null : pct((a, i) => a.cagr > spy[i]!.cagr),
    pShallowerDrawdown: s.id === "spy" ? null : pct((a, i) => a.maxDD > spy[i]!.maxDD),
    pBeatSpySharpe: s.id === "spy" ? null : pct((a, i) => a.sharpe > spy[i]!.sharpe),
    pBeatSpyCalmar: s.id === "spy" ? null : pct((a, i) => a.cagr / -a.maxDD > spy[i]!.cagr / -spy[i]!.maxDD),
    pDrawdownWorse30: pct((a) => a.maxDD < -0.3),
    histCagr: hist(xs.map((x) => x.cagr), -0.1, 0.3),
    histDD: hist(xs.map((x) => x.maxDD), -0.7, 0),
  };
});

const out = {
  generated: new Date().toISOString().slice(0, 10),
  data: { source: data.source, from: data.dates[0], to: data.asOf, weeks: T, universe: SYMS },
  method: {
    costBpsPerSide: COST * 1e4,
    split: { inSample: `${data.dates[0]} → ${splitDate}`, outOfSample: `${splitDate} → ${data.asOf}` },
    monteCarlo: { paths: PATHS, years: YEARS, meanBlockWeeks: MEAN_BLOCK, seed: SEED, seconds: Math.round((Date.now() - t0) / 100) / 10 },
  },
  ops,
  spy: { inSample: spyIS, outOfSample: spyOOS },
  mc,
};
writeFileSync(new URL("../src/lab/research.json", import.meta.url), JSON.stringify(out));

// ---- console summary
const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`Universe ${SYMS.join(" ")} | IS ${out.method.split.inSample} | OOS ${out.method.split.outOfSample} | ${COST * 1e4} bps`);
console.log(`SPY  IS CAGR ${pc(spyIS.cagr)}  OOS CAGR ${pc(spyOOS.cagr)} Sharpe ${spyOOS.sharpe}`);
for (const o of ops) {
  console.log(`${o.name.padEnd(24)} params ${JSON.stringify(o.params).padEnd(22)} IS Sharpe ${o.inSample.sharpe.toFixed(2)} | OOS CAGR ${pc(o.outOfSample.cagr)} Sharpe ${o.outOfSample.sharpe.toFixed(2)} DD ${pc(o.outOfSample.maxDD)} | overfit Sharpe ${o.overfitFullSample.sharpe.toFixed(2)} | turnover ${pc(o.turnover)}/wk | 0bps ${pc(o.sweep[0]!.cagr)} 50bps ${pc(o.sweep.at(-1)!.cagr)} | break-even ${(o as Record<string, unknown>).breakEvenBps}`);
}
console.log(`\nMonte Carlo ${PATHS} × ${YEARS}y paths in ${out.method.monteCarlo.seconds}s`);
for (const m of mc) {
  console.log(`${m.name.padEnd(24)} median CAGR ${pc(m.cagr.p50)} [${pc(m.cagr.p5)}, ${pc(m.cagr.p95)}]  median DD ${pc(m.maxDD.p50)}  P(beat SPY ret) ${m.pBeatSpyReturn ?? "-"}  P(shallower DD) ${m.pShallowerDrawdown ?? "-"}  P(beat Sharpe) ${m.pBeatSpySharpe ?? "-"}  P(beat Calmar) ${m.pBeatSpyCalmar ?? "-"}  P(DD<-30%) ${m.pDrawdownWorse30}`);
}
