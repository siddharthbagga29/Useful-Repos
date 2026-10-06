// Online portfolio selection (OPS), after Li & Hoi, "Online Portfolio Selection: A Survey" (ACM CSUR 2014).
// Implemented here from the published update rules. Every strategy decides the weights for period t
// using price relatives up to t−1 only, pays proportional costs on turnover, and is long-only.

export type OpsId = "ucrp" | "eg" | "pamr" | "olmar" | "bcrp";

export interface OpsParams {
  eta?: number; // EG learning rate
  eps?: number; // PAMR / OLMAR threshold
  window?: number; // OLMAR moving-average window
}

export const OPS: { id: OpsId; name: string; family: string; ref: string; grid: OpsParams[] }[] = [
  { id: "ucrp", name: "Uniform CRP", family: "Benchmark", ref: "Cover (1991)", grid: [{}] },
  { id: "eg", name: "Exponentiated Gradient", family: "Follow-the-winner", ref: "Helmbold et al. (1998)", grid: [0.01, 0.05, 0.1, 0.2, 0.5].map((eta) => ({ eta })) },
  { id: "pamr", name: "PAMR", family: "Follow-the-loser", ref: "Li et al. (2012)", grid: [0.5, 0.8, 0.9, 0.95, 1.0].map((eps) => ({ eps })) },
  {
    id: "olmar",
    name: "OLMAR",
    family: "Follow-the-loser",
    ref: "Li & Hoi (2012)",
    grid: [3, 5, 10].flatMap((window) => [5, 10, 20].map((eps) => ({ window, eps }))),
  },
  { id: "bcrp", name: "Best CRP (hindsight)", family: "Upper bound — uses the future", ref: "Cover (1991)", grid: [{}] },
];

/** Euclidean projection onto the probability simplex (Duchi et al. 2008). */
export function simplex(v: number[]): number[] {
  const u = [...v].sort((a, b) => b - a);
  let css = 0;
  let rho = -1;
  let theta = 0;
  for (let i = 0; i < u.length; i++) {
    css += u[i]!;
    const t = (css - 1) / (i + 1);
    if (u[i]! - t > 0) {
      rho = i;
      theta = t;
    }
  }
  if (rho < 0) return v.map(() => 1 / v.length);
  return v.map((x) => Math.max(0, x - theta));
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

/** Best constant-rebalanced portfolio in hindsight, by exponentiated-gradient ascent on mean log-wealth. */
export function bcrpWeights(X: number[][]): number[] {
  const n = X[0]!.length;
  let b = Array(n).fill(1 / n) as number[];
  for (let it = 0; it < 400; it++) {
    const g = Array(n).fill(0) as number[];
    for (const x of X) {
      const r = dot(b, x);
      for (let i = 0; i < n; i++) g[i]! += x[i]! / r / X.length;
    }
    const w = b.map((bi, i) => bi * Math.exp(0.5 * g[i]!));
    const s = w.reduce((a, c) => a + c, 0);
    b = w.map((x) => x / s);
  }
  return b;
}

export interface OpsRun {
  wealth: number[]; // starts at 1
  weights: number[][];
  turnover: number; // average one-way turnover per period
}

/**
 * X[t][i] = price_t / price_{t-1} for asset i (t = 1..T). Weights for period t are decided before
 * X[t] is known. `cost` is a proportional rate (0.001 = 10 bps) charged on traded notional.
 */
export function runOps(id: OpsId, X: number[][], p: OpsParams = {}, cost = 0, hindsight?: number[]): OpsRun {
  const n = X[0]!.length;
  let b = Array(n).fill(1 / n) as number[];
  let held = [...b];
  const wealth = [1];
  const weights: number[][] = [];
  let traded = 0;
  // price-level path for OLMAR's moving average (relative units; level cancels in the ratio)
  const px: number[][] = [Array(n).fill(1)];
  const bc = id === "bcrp" ? (hindsight ?? bcrpWeights(X)) : null;

  for (let t = 0; t < X.length; t++) {
    if (bc) b = [...bc];
    const turn = b.reduce((s, x, i) => s + Math.abs(x - held[i]!), 0) / 2;
    if (t > 0) traded += turn;
    const net = 1 - 2 * turn * cost; // pay on both sides of the trade
    weights.push(b);
    const x = X[t]!;
    const r = dot(b, x);
    wealth.push(wealth[wealth.length - 1]! * r * net);
    held = b.map((bi, i) => (bi * x[i]!) / r); // drift
    px.push(px[px.length - 1]!.map((v, i) => v * x[i]!));

    // ---- update for period t+1, using information up to and including X[t] ----
    switch (id) {
      case "ucrp":
        b = Array(n).fill(1 / n);
        break;
      case "eg": {
        const eta = p.eta ?? 0.05;
        const w = b.map((bi, i) => bi * Math.exp((eta * x[i]!) / r));
        const s = w.reduce((a, c) => a + c, 0);
        b = w.map((v) => v / s);
        break;
      }
      case "pamr": {
        const eps = p.eps ?? 0.9;
        const mean = x.reduce((a, c) => a + c, 0) / n;
        const dev = x.map((v) => v - mean);
        const den = dot(dev, dev);
        const loss = Math.max(0, r - eps);
        const tau = den > 0 ? loss / den : 0;
        b = simplex(b.map((bi, i) => bi - tau * dev[i]!));
        break;
      }
      case "olmar": {
        const w = p.window ?? 5;
        const eps = p.eps ?? 10;
        const k = Math.min(w, px.length);
        const last = px[px.length - 1]!;
        const pred = last.map((_, i) => {
          let s = 0;
          for (let j = px.length - k; j < px.length; j++) s += px[j]![i]!;
          return s / k / last[i]!;
        });
        const mean = pred.reduce((a, c) => a + c, 0) / n;
        const dev = pred.map((v) => v - mean);
        const den = dot(dev, dev);
        const lam = den > 0 ? Math.max(0, (eps - dot(b, pred)) / den) : 0;
        b = simplex(b.map((bi, i) => bi + lam * dev[i]!));
        break;
      }
      case "bcrp":
        break;
    }
  }
  return { wealth, weights, turnover: traded / Math.max(1, X.length - 1) };
}

// ---------------------------------------------------------------- metrics

export interface Stats {
  cagr: number;
  vol: number;
  sharpe: number;
  maxDD: number;
  final: number;
}

export function stats(wealth: number[], periodsPerYear = 52): Stats {
  const r: number[] = [];
  for (let i = 1; i < wealth.length; i++) r.push(wealth[i]! / wealth[i - 1]! - 1);
  const years = r.length / periodsPerYear;
  const mean = r.reduce((a, c) => a + c, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, c) => a + (c - mean) ** 2, 0) / Math.max(1, r.length - 1));
  let peak = wealth[0]!;
  let dd = 0;
  for (const w of wealth) {
    peak = Math.max(peak, w);
    dd = Math.min(dd, w / peak - 1);
  }
  const vol = sd * Math.sqrt(periodsPerYear);
  return {
    cagr: (wealth[wealth.length - 1]! / wealth[0]!) ** (1 / years) - 1,
    vol,
    sharpe: vol > 0 ? (mean * periodsPerYear) / vol : 0,
    maxDD: dd,
    final: wealth[wealth.length - 1]!,
  };
}

// ---------------------------------------------------------------- resampling

/** Small, fast, seedable PRNG (mulberry32) so every Monte Carlo run is reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stationary block bootstrap (Politis & Romano 1994): resample whole weeks across all assets at
 * once (keeps cross-asset correlation) in blocks of geometric length (keeps volatility clustering
 * and short-horizon mean reversion).
 */
export function blockBootstrap(X: number[][], length: number, meanBlock: number, rand: () => number): number[][] {
  const out: number[][] = [];
  const T = X.length;
  let i = Math.floor(rand() * T);
  while (out.length < length) {
    out.push(X[i]!);
    i = rand() < 1 / meanBlock ? Math.floor(rand() * T) : (i + 1) % T;
  }
  return out;
}

export function relatives(series: number[][]): number[][] {
  // series[i] = price path of asset i → X[t][i]
  const T = series[0]!.length;
  const X: number[][] = [];
  for (let t = 1; t < T; t++) X.push(series.map((s) => s[t]! / s[t - 1]!));
  return X;
}

export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}
