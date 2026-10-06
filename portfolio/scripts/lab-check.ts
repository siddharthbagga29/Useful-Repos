// Sanity checks for the Strategy Lab engine: arithmetic, no look-ahead, costs, and stress windows.
//   node --experimental-strip-types scripts/lab-check.ts
import { readFileSync } from "node:fs";
import { backtest, DEFAULTS, type Dataset, type Params } from "../src/lab/backtest.ts";

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

console.log(`\nSPY buy&hold: CAGR ${pct(hold.metrics.cagr)}, vol ${pct(hold.metrics.vol)}, maxDD ${pct(hold.metrics.maxDD)}`);
console.log(`60/40:        CAGR ${pct(sixty.metrics.cagr)}, vol ${pct(sixty.metrics.vol)}, maxDD ${pct(sixty.metrics.maxDD)}`);
console.log(failed ? `\n${failed} failing` : "\nall passing");
process.exit(failed ? 1 : 0);
