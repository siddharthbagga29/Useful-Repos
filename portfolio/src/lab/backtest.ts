// Strategy Lab engine: weekly, long-only, no leverage, no look-ahead.
// A signal formed on the close of week t sets the weights that earn week t+1's return.
// Pure TypeScript so scripts/lab-check.ts can run it under Node.

export interface Dataset {
  source: string;
  asOf: string;
  dates: string[];
  series: Record<string, number[]>;
}

export type StrategyId = "hold" | "static" | "trend" | "dualmom" | "invvol" | "voltarget";

export interface Params {
  strategy: StrategyId;
  /** asset for single-asset strategies */
  asset: string;
  /** static weights, symbol → weight (normalised internally) */
  weights: Record<string, number>;
  /** universe for rotation / inverse-vol strategies */
  universe: string[];
  /** defensive asset when a risk-off signal fires; "CASH" earns 0% */
  safe: string;
  smaWeeks: number;
  lookbackWeeks: number;
  rebalanceWeeks: number;
  targetVolPct: number;
  costBps: number;
  startIndex: number;
}

export const STRATEGIES: { id: StrategyId; name: string; blurb: string }[] = [
  { id: "hold", name: "Buy & hold", blurb: "One asset, never traded. The benchmark every idea has to beat." },
  { id: "static", name: "Strategic allocation", blurb: "Fixed weights, rebalanced on a schedule — the classic 60/40 and its cousins." },
  { id: "trend", name: "Trend filter", blurb: "Own the asset only while it trades above its moving average; otherwise step aside." },
  { id: "dualmom", name: "Dual momentum", blurb: "Rotate into the strongest risk asset — unless even that one is falling, then go defensive." },
  { id: "invvol", name: "Inverse volatility", blurb: "Size each sleeve by 1/volatility so no single asset dominates the risk budget." },
  { id: "voltarget", name: "Volatility target", blurb: "Scale exposure down when realised volatility rises above a target." },
];

export interface Result {
  dates: string[];
  equity: number[];
  bench: number[];
  drawdown: number[];
  weights: Record<string, number>[];
  metrics: Metrics;
  benchMetrics: Metrics;
  stress: { name: string; strat: number; bench: number }[];
}

export interface Metrics {
  cagr: number;
  vol: number;
  sharpe: number;
  sortino: number;
  maxDD: number;
  calmar: number;
  worstWeek: number;
  hitRate: number;
  turnover: number;
  beta: number;
  final: number;
}

const W = 52;

function returns(px: number[]): number[] {
  const r = [0];
  for (let i = 1; i < px.length; i++) r.push(px[i]! / px[i - 1]! - 1);
  return r;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

const norm = (w: Record<string, number>) => {
  const s = Object.values(w).reduce((a, b) => a + Math.max(0, b), 0);
  const out: Record<string, number> = {};
  if (s <= 0) return out;
  for (const [k, v] of Object.entries(w)) if (v > 0) out[k] = v / s;
  return out;
};

/** Target weights decided with information up to and including week t. */
export function target(p: Params, t: number, px: Record<string, number[]>, rets: Record<string, number[]>): Record<string, number> {
  const safe = p.safe === "CASH" ? {} : { [p.safe]: 1 };
  switch (p.strategy) {
    case "hold":
      return { [p.asset]: 1 };
    case "static":
      return norm(p.weights);
    case "trend": {
      const s = px[p.asset]!;
      if (t + 1 < p.smaWeeks) return { [p.asset]: 1 };
      let sum = 0;
      for (let k = t - p.smaWeeks + 1; k <= t; k++) sum += s[k]!;
      return s[t]! >= sum / p.smaWeeks ? { [p.asset]: 1 } : safe;
    }
    case "dualmom": {
      if (t < p.lookbackWeeks) return { [p.universe[0]!]: 1 };
      let best = "";
      let bestR = -Infinity;
      for (const a of p.universe) {
        const r = px[a]![t]! / px[a]![t - p.lookbackWeeks]! - 1;
        if (r > bestR) [best, bestR] = [a, r];
      }
      return bestR > 0 ? { [best]: 1 } : safe;
    }
    case "invvol": {
      const lb = Math.min(p.lookbackWeeks, t);
      if (lb < 8) return norm(Object.fromEntries(p.universe.map((a) => [a, 1])));
      const w: Record<string, number> = {};
      for (const a of p.universe) {
        const v = stdev(rets[a]!.slice(t - lb + 1, t + 1));
        w[a] = v > 0 ? 1 / v : 0;
      }
      return norm(w);
    }
    case "voltarget": {
      const lb = Math.min(p.lookbackWeeks, t);
      if (lb < 8) return { [p.asset]: 1 };
      const v = stdev(rets[p.asset]!.slice(t - lb + 1, t + 1)) * Math.sqrt(W);
      const x = v > 0 ? Math.min(1, p.targetVolPct / 100 / v) : 1;
      return x >= 1 ? { [p.asset]: 1 } : { [p.asset]: x, ...(p.safe === "CASH" ? {} : { [p.safe]: 1 - x }) };
    }
  }
}

export function metrics(eq: number[], benchRets?: number[], turnover = 0): Metrics {
  const r = returns(eq).slice(1);
  const years = r.length / W;
  const cagr = (eq[eq.length - 1]! / eq[0]!) ** (1 / years) - 1;
  const vol = stdev(r) * Math.sqrt(W);
  const mean = (r.reduce((a, b) => a + b, 0) / r.length) * W;
  const down = stdev(r.map((x) => Math.min(0, x))) * Math.sqrt(W);
  let peak = eq[0]!;
  let maxDD = 0;
  for (const v of eq) {
    peak = Math.max(peak, v);
    maxDD = Math.min(maxDD, v / peak - 1);
  }
  let beta = 1;
  if (benchRets) {
    const b = benchRets.slice(1, r.length + 1);
    const mr = r.reduce((a, c) => a + c, 0) / r.length;
    const mb = b.reduce((a, c) => a + c, 0) / b.length;
    let cov = 0;
    let vb = 0;
    for (let i = 0; i < r.length; i++) {
      cov += (r[i]! - mr) * (b[i]! - mb);
      vb += (b[i]! - mb) ** 2;
    }
    beta = vb > 0 ? cov / vb : 0;
  }
  return {
    cagr,
    vol,
    sharpe: vol > 0 ? mean / vol : 0,
    sortino: down > 0 ? mean / down : 0,
    maxDD,
    calmar: maxDD < 0 ? cagr / -maxDD : 0,
    worstWeek: Math.min(...r),
    hitRate: r.filter((x) => x > 0).length / r.length,
    turnover: turnover / years,
    beta,
    final: eq[eq.length - 1]!,
  };
}

const STRESS: { name: string; from: string; to: string }[] = [
  { name: "Q4 2018 sell-off", from: "2018-09-17", to: "2018-12-24" },
  { name: "COVID crash", from: "2020-02-17", to: "2020-03-23" },
  { name: "2022 rate shock", from: "2022-01-03", to: "2022-10-10" },
  { name: "2023–24 rally", from: "2023-01-02", to: "2024-12-30" },
];

export function backtest(data: Dataset, p: Params, initial = 1_000_000): Result {
  const px = data.series;
  const rets: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(px)) rets[k] = returns(v);
  const n = data.dates.length;
  const s = Math.max(0, Math.min(p.startIndex, n - 60));
  const dates = data.dates.slice(s);
  const equity = [initial];
  const bench = [initial];
  const ws: Record<string, number>[] = [];
  let w: Record<string, number> = {};
  let turnover = 0;
  const cost = p.costBps / 10_000;

  for (let t = s; t < n - 1; t++) {
    const rebalance = (t - s) % Math.max(1, p.rebalanceWeeks) === 0 || p.strategy === "trend" || p.strategy === "voltarget";
    if (t === s || rebalance) {
      const next = target(p, t, px, rets);
      const keys = new Set([...Object.keys(w), ...Object.keys(next)]);
      let traded = 0;
      for (const k of keys) traded += Math.abs((next[k] ?? 0) - (w[k] ?? 0));
      if (t > s) turnover += traded / 2;
      equity[equity.length - 1] = equity[equity.length - 1]! * (1 - traded * cost);
      w = next;
    }
    ws.push(w);
    let r = 0;
    for (const [k, x] of Object.entries(w)) r += x * rets[k]![t + 1]!;
    equity.push(equity[equity.length - 1]! * (1 + r));
    bench.push(bench[bench.length - 1]! * (1 + rets.SPY![t + 1]!));
    // let weights drift with prices between rebalances
    const tot = Object.entries(w).reduce((a, [k, x]) => a + x * (1 + rets[k]![t + 1]!), 0) + (1 - Object.values(w).reduce((a, b) => a + b, 0));
    if (tot > 0) w = Object.fromEntries(Object.entries(w).map(([k, x]) => [k, (x * (1 + rets[k]![t + 1]!)) / tot]));
  }

  let peak = equity[0]!;
  const drawdown = equity.map((v) => ((peak = Math.max(peak, v)), v / peak - 1));
  const benchRets = returns(bench);

  const stress = STRESS.map((x) => {
    const a = dates.findIndex((d) => d >= x.from);
    let b = dates.findIndex((d) => d >= x.to);
    if (b < 0) b = dates.length - 1;
    if (a < 0 || b <= a) return { name: x.name, strat: NaN, bench: NaN };
    return { name: x.name, strat: equity[b]! / equity[a]! - 1, bench: bench[b]! / bench[a]! - 1 };
  });

  return {
    dates,
    equity,
    bench,
    drawdown,
    weights: ws,
    metrics: metrics(equity, benchRets, turnover),
    benchMetrics: metrics(bench, benchRets),
    stress,
  };
}

export const DEFAULTS: Params = {
  strategy: "static",
  asset: "SPY",
  weights: { SPY: 60, AGG: 40 },
  universe: ["SPY", "EFA"],
  safe: "AGG",
  smaWeeks: 40,
  lookbackWeeks: 52,
  rebalanceWeeks: 4,
  targetVolPct: 12,
  costBps: 5,
  startIndex: 0,
};

export const ASSETS: Record<string, string> = {
  SPY: "US large cap (S&P 500)",
  QQQ: "US growth (Nasdaq-100)",
  IWM: "US small cap (Russell 2000)",
  EFA: "Developed ex-US equity",
  AGG: "US aggregate bonds",
  TLT: "Long Treasuries (20y+)",
  GLD: "Gold",
  VNQ: "US REITs",
};
