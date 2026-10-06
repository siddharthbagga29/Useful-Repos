// Sanity checks for the Strategy Lab engine: arithmetic, no look-ahead, costs, and stress windows.
//   node --experimental-strip-types scripts/lab-check.ts
import { readFileSync } from "node:fs";
import { backtest, DEFAULTS, type Dataset, type Params } from "../src/lab/backtest.ts";
import { blockBootstrap, relatives, rng, runOps, simplex, stats } from "../src/lab/ops.ts";
import { analyze, DEAL_DEFAULTS, maxPriceFor, simulate } from "../src/deal/model.ts";

const data = JSON.parse(readFileSync(new URL("../src/lab/weekly.json", import.meta.url), "utf8")) as Dataset;
let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "pass" : "FAIL"}  ${name}${cond ? "" : `  — ${detail}`}`);
};
const run = (p: Partial<Params>) => backtest(data, { ...DEFAULTS, ...p });
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

// 1. Buy & hold SPY reproduces the raw price ratio exactly (no costs after entry).
const hold = run({ strategy: "hold", asset: "SPY", costBps: 0 });
const spy = data.series.SPY!;
ok("buy & hold = price ratio", Math.abs(hold.equity.at(-1)! / 1e6 - spy.at(-1)! / spy[0]!) < 1e-9, `${hold.equity.at(-1)}`);
ok("benchmark = buy & hold SPY", Math.abs(hold.bench.at(-1)! - hold.equity.at(-1)!) < 1e-6);

// 2. No look-ahead: changing a future price must not change any earlier equity value.
const k = 300;
const tampered: Dataset = JSON.parse(JSON.stringify(data));
tampered.series.SPY![k] = tampered.series.SPY![k]! * 1.5;
for (const strategy of ["trend", "dualmom", "invvol", "voltarget", "static"] as const) {
  const a = backtest(data, { ...DEFAULTS, strategy, universe: ["SPY", "EFA", "AGG"] });
  const b = backtest(tampered, { ...DEFAULTS, strategy, universe: ["SPY", "EFA", "AGG"] });
  const same = a.equity.slice(0, k).every((v, i) => Math.abs(v - b.equity[i]!) < 1e-6);
  // weights held over week t+1 are decided at t; for every t < k they must ignore the tampered price
  const wsame = a.weights.slice(0, k).every((w, i) => JSON.stringify(w) === JSON.stringify(b.weights[i]));
  ok(`no look-ahead: ${strategy}`, same && wsame, `equity ${same} weights ${wsame}`);
}

// 3. Costs only ever reduce returns; turnover is non-negative.
const cheap = run({ strategy: "dualmom", costBps: 0 });
const dear = run({ strategy: "dualmom", costBps: 50 });
ok("costs reduce returns", dear.metrics.final < cheap.metrics.final, `${dear.metrics.final} vs ${cheap.metrics.final}`);
ok("turnover ≥ 0", dear.metrics.turnover >= 0);

// 4. Drawdown is within [-1, 0] and the max matches the series.
ok("drawdown bounds", hold.drawdown.every((d) => d <= 1e-12 && d >= -1));
ok("maxDD = min drawdown", Math.abs(Math.min(...hold.drawdown) - hold.metrics.maxDD) < 1e-12);

// 5. Stress windows resolve to real dates; COVID drawdown for SPY is deep.
const covid = hold.stress.find((s) => s.name === "COVID crash")!;
ok("COVID window SPY loss > 20%", covid.bench < -0.2, pct(covid.bench));

// 6. 60/40 is less volatile than SPY.
const sixty = run({});
ok("60/40 vol < SPY vol", sixty.metrics.vol < hold.metrics.vol, `${pct(sixty.metrics.vol)} vs ${pct(hold.metrics.vol)}`);

// 7. Online portfolio selection
const X = relatives(Object.values(data.series));
const proj = simplex([0.7, 0.6, -0.2, 0.1]);
ok("simplex projection sums to 1, non-negative", Math.abs(proj.reduce((a, b) => a + b, 0) - 1) < 1e-12 && proj.every((v) => v >= 0));
const u = runOps("ucrp", X, {}, 0).wealth.at(-1)!;
let manual = 1;
for (const x of X) manual *= x.reduce((a, b) => a + b, 0) / x.length;
ok("UCRP at 0 bps = mean of price relatives each week", Math.abs(u - manual) / manual < 1e-9, `${u} vs ${manual}`);
for (const id of ["eg", "pamr", "olmar"] as const) {
  const a = runOps(id, X, {}, 0.001);
  const X2 = X.map((r) => [...r]);
  X2[200] = X2[200]!.map((v) => v * 1.3);
  const b = runOps(id, X2, {}, 0.001);
  const same = a.weights.slice(0, 201).every((w, i) => w.every((v, j) => Math.abs(v - b.weights[i]![j]!) < 1e-12));
  ok(`OPS no look-ahead: ${id} (weights through t=200 ignore X[200])`, same);
  ok(`OPS weights stay on the simplex: ${id}`, a.weights.every((w) => Math.abs(w.reduce((s, v) => s + v, 0) - 1) < 1e-9 && w.every((v) => v >= -1e-12)));
}
const pz = stats(runOps("pamr", X, { eps: 0.95 }, 0).wealth).cagr;
const pc = stats(runOps("pamr", X, { eps: 0.95 }, 0.001).wealth).cagr;
ok("PAMR: costs reduce CAGR", pc < pz, `${pz} vs ${pc}`);
const b1 = blockBootstrap(X, 100, 8, rng(7));
const b2 = blockBootstrap(X, 100, 8, rng(7));
ok("bootstrap is reproducible with a seed", JSON.stringify(b1) === JSON.stringify(b2));
ok("bootstrap draws real weeks", b1.every((r) => X.includes(r)));

// 8. Deal Lab = Wholesale_Deal_Analyzer_v2.xlsx (values read back from the workbook's own formulas)
const dl = analyze(DEAL_DEFAULTS);
ok("deal: MAO matches workbook ($56,000)", dl.mao === 56000, String(dl.mao));
ok("deal: buyer margin matches workbook (17.5%)", Math.abs(dl.buyerMargin - 0.175) < 1e-12, String(dl.buyerMargin));
ok("deal: expected profit matches workbook ($6,125)", Math.abs(dl.expected - 6125) < 1e-9, String(dl.expected));
ok("deal: signal matches workbook", dl.signal === "NO-GO: offer above MAO", dl.signal);
ok("deal: v1 formulas would have said GO", dl.v1.signal === "GO", dl.v1.signal);
const ds = simulate(DEAL_DEFAULTS, 20000, 3);
ok("deal: Monte Carlo ≈ workbook (29.5%) and Python (29.3%)", Math.abs(ds.pWorks - 0.294) < 0.015, String(ds.pWorks));
const mp = maxPriceFor(DEAL_DEFAULTS, 0.6);
ok("deal: max price for 60% success is below MAO and works", mp < dl.mao && simulate({ ...DEAL_DEFAULTS, contract: mp }, 20000, 5).pWorks >= 0.58, String(mp));

console.log(`\nSPY buy&hold: CAGR ${pct(hold.metrics.cagr)}, vol ${pct(hold.metrics.vol)}, maxDD ${pct(hold.metrics.maxDD)}`);
console.log(`60/40:        CAGR ${pct(sixty.metrics.cagr)}, vol ${pct(sixty.metrics.vol)}, maxDD ${pct(sixty.metrics.maxDD)}`);
console.log(failed ? `\n${failed} failing` : "\nall passing");
process.exit(failed ? 1 : 0);
