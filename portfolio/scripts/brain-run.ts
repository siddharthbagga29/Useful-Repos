// Runs the Brain for N generations and writes its state. Bundled to dist/brain/evolve.mjs and run by
// the scheduled "Brain" workflow in the Pages repository (free on GitHub Actions).
//   node brain/evolve.mjs --state brain/state.json --data brain/weekly.json --generations 24
//   node --experimental-strip-types scripts/brain-run.ts --state /tmp/s.json --data src/lab/weekly.json --generations 40

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { evolve, initState, type BrainState } from "../src/brain/engine.ts";
import type { Dataset } from "../src/lab/backtest.ts";

const arg = (k: string, d?: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1]! : d;
};

const statePath = arg("state", "brain/state.json")!;
const dataPath = arg("data", "brain/weekly.json")!;
const gens = Math.max(1, Math.min(200, Number(arg("generations", "24"))));
const now = arg("now", new Date().toISOString())!;

const data: Dataset = JSON.parse(readFileSync(dataPath, "utf8"));
let state: BrainState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : initState(data, now);
const t0 = Date.now();
state = evolve(state, data, gens, now);
writeFileSync(statePath, JSON.stringify(state));
const c = state.champion;
console.log(
  `gen ${state.generation} · ${state.trials} trials · champion "${c.label}" score ${c.score} elo ${c.elo} · ` +
    `holdout Sharpe ${c.holdout?.sharpe.toFixed(2)} vs SPY ${c.holdout?.spySharpe.toFixed(2)} · ${Date.now() - t0} ms`,
);
