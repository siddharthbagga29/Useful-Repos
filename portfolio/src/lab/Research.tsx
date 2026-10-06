import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import raw from "./research.json";

interface S {
  cagr: number;
  vol: number;
  sharpe: number;
  maxDD: number;
  final: number;
}
interface Q {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}
interface OpsRow {
  id: string;
  name: string;
  family: string;
  ref: string;
  params: Record<string, number>;
  inSample: S;
  outOfSample: S;
  overfitFullSample: S;
  turnover: number;
  breakEvenBps: number | string | null;
  sweep: (S & { costBps: number })[];
}
interface McRow {
  id: string;
  name: string;
  group: string;
  cagr: Q;
  maxDD: Q;
  sharpe: Q;
  pPositive: number;
  pBeatSpyReturn: number | null;
  pShallowerDrawdown: number | null;
  pBeatSpySharpe: number | null;
  pBeatSpyCalmar: number | null;
  pDrawdownWorse30: number;
  histCagr: { lo: number; hi: number; counts: number[] };
  histDD: { lo: number; hi: number; counts: number[] };
}
interface Research {
  generated: string;
  data: { from: string; to: string; weeks: number; universe: string[] };
  method: { costBpsPerSide: number; split: { inSample: string; outOfSample: string }; monteCarlo: { paths: number; years: number; meanBlockWeeks: number; seed: number } };
  ops: OpsRow[];
  spy: { inSample: S; outOfSample: S };
  mc: McRow[];
}

const R = raw as unknown as Research;
const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(d)}%`);
const prob = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const COLORS: Record<string, string> = { ucrp: "#8d8a80", eg: "#58d6ff", pamr: "#ff4a1c", olmar: "#ffb020", bcrp: "#15c26b" };

export function ResearchSections() {
  const pamr = R.ops.find((o) => o.id === "pamr")!;
  const ucrp = R.ops.find((o) => o.id === "ucrp")!;
  const eg = R.ops.find((o) => o.id === "eg")!;
  return (
    <>
      <section id="ops" className="lab-ops">
        <div className="kicker">Research · replication and stress test</div>
        <h2 className="sec">Online portfolio selection, with the costs left in</h2>
        <p className="sub">
          Academic work on online portfolio selection — including the survey by Li &amp; Hoi and a Glucksman Fellowship study at NYU Stern by Lahanis, Liu &amp; Zhou — reports
          that mean-reversion algorithms such as PAMR deliver outstanding wealth. Those studies assume frictionless trading. I implemented the algorithms
          from their published update rules, tuned them on {R.method.split.inSample} only, froze the parameters, and scored the untouched{" "}
          {R.method.split.outOfSample} at {R.method.costBpsPerSide} bps per trade.
        </p>
        <div className="finding">
          <b>Finding.</b> The frictionless result replicates: at 0 bps, PAMR compounds at {pct(pamr.sweep[0]!.cagr)} a year against {pct(ucrp.sweep[0]!.cagr)} for an
          equal-weight portfolio. But it trades {pct(pamr.turnover, 0)} of the book every week, so the edge is gone by {pamr.breakEvenBps} bps and out of sample
          it earns {pct(pamr.outOfSample.cagr)}. The quiet winner is Exponentiated Gradient: {pct(eg.turnover, 1)} weekly turnover, edge intact at 50 bps.
        </div>
        <div className="lab-table ops-table">
          <table>
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Family</th>
                <th>Frozen params</th>
                <th className="r">IS Sharpe</th>
                <th className="r">OOS CAGR</th>
                <th className="r">OOS Sharpe</th>
                <th className="r">OOS max DD</th>
                <th className="r">Turnover / wk</th>
                <th className="r">Edge gone by</th>
              </tr>
            </thead>
            <tbody>
              {R.ops.map((o) => (
                <tr key={o.id} className={o.id === "bcrp" ? "oracle" : ""}>
                  <td>
                    <i className="sw" style={{ background: COLORS[o.id] }} /> {o.name}
                    <em className="ref">{o.ref}</em>
                  </td>
                  <td>{o.family}</td>
                  <td className="mono">{Object.keys(o.params).length ? Object.entries(o.params).map(([k, v]) => `${k}=${v}`).join(" ") : "—"}</td>
                  <td className="r">{o.inSample.sharpe.toFixed(2)}</td>
                  <td className="r">{pct(o.outOfSample.cagr)}</td>
                  <td className="r">{o.outOfSample.sharpe.toFixed(2)}</td>
                  <td className="r">{pct(o.outOfSample.maxDD)}</td>
                  <td className="r">{pct(o.turnover)}</td>
                  <td className="r">{o.breakEvenBps === null ? "n/a" : `${o.breakEvenBps} bps`}</td>
                </tr>
              ))}
              <tr className="bench">
                <td>S&amp;P 500 (SPY)</td>
                <td>Benchmark</td>
                <td className="mono">—</td>
                <td className="r">{R.spy.inSample.sharpe.toFixed(2)}</td>
                <td className="r">{pct(R.spy.outOfSample.cagr)}</td>
                <td className="r">{R.spy.outOfSample.sharpe.toFixed(2)}</td>
                <td className="r">{pct(R.spy.outOfSample.maxDD)}</td>
                <td className="r">0%</td>
                <td className="r">n/a</td>
              </tr>
            </tbody>
          </table>
        </div>
        <CostSweep />
        <p className="note">
          “Edge gone by” = the lowest tested cost at which the algorithm compounds slower than the equal-weight portfolio over the full sample. Best CRP is an oracle that
          picks its weights with hindsight — an upper bound, not a strategy. Universe: {R.data.universe.join(", ")}; weekly; prices exclude dividends.
        </p>
      </section>

      <section id="montecarlo" className="lab-mc">
        <div className="kicker">Monte Carlo · {R.method.monteCarlo.paths.toLocaleString()} simulated decades</div>
        <h2 className="sec">How often does it actually work?</h2>
        <p className="sub">
          One backtest is one history. To see the range, I resampled real weeks in blocks (a stationary bootstrap that keeps cross-asset correlation and volatility
          clustering) into {R.method.monteCarlo.paths.toLocaleString()} alternative {R.method.monteCarlo.years}-year paths, ran every strategy with frozen parameters
          and {R.method.costBpsPerSide} bps costs, and counted how often each one beat buying the S&amp;P 500 on the same path.
        </p>
        <McTable />
        <McExplorer />
        <p className="note">
          Seed {R.method.monteCarlo.seed}, mean block {R.method.monteCarlo.meanBlockWeeks} weeks. Reproduce with <code>node scripts/research.ts</code>. A bootstrap
          can only recombine the past it was given (2015–2026); it cannot invent a regime that never happened.
        </p>
      </section>
    </>
  );
}

function CostSweep() {
  const W = 640;
  const H = 220;
  const P = { l: 46, r: 64, t: 12, b: 30 };
  const lines = R.ops.filter((o) => o.id !== "bcrp");
  const costs = lines[0]!.sweep.map((s) => s.costBps);
  const all = lines.flatMap((o) => o.sweep.map((s) => s.cagr));
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all);
  const x = (i: number) => P.l + (i / (costs.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  // End labels: sorted by height and pushed apart so lines that finish close together stay readable.
  const labelY: Record<string, number> = {};
  let prev = -Infinity;
  for (const o of [...lines].sort((a, b) => y(a.sweep.at(-1)!.cagr) - y(b.sweep.at(-1)!.cagr))) {
    prev = Math.max(y(o.sweep.at(-1)!.cagr) + 3, prev + 12);
    labelY[o.id] = prev;
  }
  // …then pulled back up from the bottom so none sits on the axis labels.
  let next = H - P.b + 3;
  for (const o of [...lines].sort((a, b) => labelY[b.id]! - labelY[a.id]!)) {
    next = Math.min(labelY[o.id]!, next);
    labelY[o.id] = next;
    next -= 12;
  }
  const ticks = [lo, 0, hi / 2, hi].filter((v, i, a) => a.findIndex((u) => Math.abs(u - v) < 0.005) === i);
  return (
    <div className="chart sweep">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Full-sample CAGR versus trading cost per side">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className={t === 0 ? "zero" : "grid"} />
            <text x={P.l - 6} y={y(t) + 3} className="ax" textAnchor="end">
              {pct(t, 0)}
            </text>
          </g>
        ))}
        {costs.map((c, i) => (
          <text key={c} x={x(i)} y={H - 10} className="ax" textAnchor="middle">
            {c} bps
          </text>
        ))}
        {lines.map((o) => (
          <g key={o.id}>
            <motion.path
              d={o.sweep.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s.cagr)}`).join("")}
              fill="none"
              stroke={COLORS[o.id]}
              strokeWidth={2}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2 }}
            />
            <text x={W - P.r + 6} y={labelY[o.id]} className="ax" fill={COLORS[o.id]}>
              {o.id.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
      <span className="dd-label">CAGR vs cost per side, {R.data.from.slice(0, 4)}–{R.data.to.slice(0, 4)}</span>
    </div>
  );
}

function McTable() {
  return (
    <div className="lab-table mc-table">
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th className="r">Median CAGR</th>
            <th className="r">5–95% range</th>
            <th className="r">Median max DD</th>
            <th className="r" title="Share of paths where the strategy's worst drawdown was smaller than SPY's">Shallower DD than SPY</th>
            <th className="r" title="Share of paths where CAGR / |max drawdown| beat SPY's">Better return per unit of drawdown</th>
            <th className="r">Beat SPY Sharpe</th>
            <th className="r">Beat SPY return</th>
            <th className="r">DD worse than −30%</th>
          </tr>
        </thead>
        <tbody>
          {R.mc.map((m) => (
            <tr key={m.id} className={m.id === "spy" ? "bench" : ""}>
              <td>
                {m.name}
                <em className="ref">{m.group}</em>
              </td>
              <td className="r">{pct(m.cagr.p50)}</td>
              <td className="r mono">
                {pct(m.cagr.p5, 0)} … {pct(m.cagr.p95, 0)}
              </td>
              <td className="r">{pct(m.maxDD.p50)}</td>
              <Prob v={m.pShallowerDrawdown} />
              <Prob v={m.pBeatSpyCalmar} />
              <Prob v={m.pBeatSpySharpe} />
              <Prob v={m.pBeatSpyReturn} />
              <td className="r">{prob(m.pDrawdownWorse30)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Prob({ v }: { v: number | null }) {
  if (v === null) return <td className="r">—</td>;
  return (
    <td className="r prob">
      <i style={{ width: `${v * 100}%`, background: v >= 0.5 ? "var(--grn)" : v >= 0.2 ? "var(--amber)" : "var(--edge)" }} />
      <span>{prob(v)}</span>
    </td>
  );
}

function McExplorer() {
  const [id, setId] = useState("6040");
  const [view, setView] = useState<"cagr" | "dd">("dd");
  const m = R.mc.find((x) => x.id === id)!;
  const spy = R.mc.find((x) => x.id === "spy")!;
  const h = view === "cagr" ? m.histCagr : m.histDD;
  const hs = view === "cagr" ? spy.histCagr : spy.histDD;
  const max = useMemo(() => Math.max(...h.counts, ...hs.counts), [h, hs]);
  const n = h.counts.length;
  const label = (i: number) => pct(h.lo + ((h.hi - h.lo) * i) / n, 0);
  return (
    <div className="mc-explorer">
      <div className="mc-controls">
        <label htmlFor="mc-strat">Strategy</label>
        <select id="mc-strat" value={id} onChange={(e) => setId(e.target.value)}>
          {R.mc.filter((x) => x.id !== "spy").map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="jx-seg" role="tablist" aria-label="Distribution">
          {(["dd", "cagr"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {view === v && <motion.span layoutId="mc-pill" className="seg-pill" />}
              <span>{v === "dd" ? "Max drawdown" : "CAGR"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="hist" role="img" aria-label={`Distribution of ${view === "dd" ? "maximum drawdown" : "CAGR"} across simulated decades, ${m.name} versus S&P 500`}>
        {h.counts.map((c, i) => (
          <div key={i} className="hcol">
            <motion.i className="hb s" animate={{ height: `${(c / max) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
            <motion.i className="hb b" animate={{ height: `${(hs.counts[i]! / max) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
            {i % 4 === 0 && <span>{label(i)}</span>}
          </div>
        ))}
      </div>
      <div className="lab-chart-foot">
        <span>
          <i className="sw s" /> {m.name} <i className="sw b" /> S&amp;P 500
        </span>
        <span>
          {view === "dd"
            ? `Shallower drawdown than SPY in ${prob(m.pShallowerDrawdown)} of paths`
            : `Median CAGR ${pct(m.cagr.p50)} vs ${pct(spy.cagr.p50)}`}
        </span>
      </div>
    </div>
  );
}
