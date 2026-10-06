import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import raw from "./weekly.json";
import { ASSETS, backtest, DEFAULTS, STRATEGIES, type Dataset, type Params, type Result, type StrategyId } from "./backtest.ts";
import { CONTACT } from "../data/site.ts";
import { loadAnalytics, track } from "../lib/track.ts";

const DATA = raw as Dataset;
const SYMBOLS = Object.keys(ASSETS);

const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : "—");
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const usd = (x: number) => `$${(x / 1e6).toFixed(2)}M`;

const PRESETS: { name: string; p: Partial<Params> }[] = [
  { name: "60/40", p: { strategy: "static", weights: { SPY: 60, AGG: 40 }, rebalanceWeeks: 13 } },
  { name: "All-weather lite", p: { strategy: "static", weights: { SPY: 30, TLT: 40, AGG: 15, GLD: 15 }, rebalanceWeeks: 13 } },
  { name: "Trend on SPY", p: { strategy: "trend", asset: "SPY", smaWeeks: 40, safe: "AGG" } },
  { name: "Global dual momentum", p: { strategy: "dualmom", universe: ["SPY", "EFA"], lookbackWeeks: 52, safe: "AGG", rebalanceWeeks: 4 } },
  { name: "Risk-balanced", p: { strategy: "invvol", universe: ["SPY", "EFA", "AGG", "GLD", "VNQ"], lookbackWeeks: 26, rebalanceWeeks: 4 } },
  { name: "SPY @ 12% vol", p: { strategy: "voltarget", asset: "SPY", targetVolPct: 12, lookbackWeeks: 26, safe: "AGG" } },
];

export function Lab() {
  const [p, setP] = useState<Params>(() => ({ ...DEFAULTS, ...PRESETS[0]!.p }) as Params);
  const [log, setLog] = useState(true);
  const res = useMemo(() => backtest(DATA, p), [p]);
  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    loadAnalytics();
    track("page_view", { page: "lab" }, true);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => track("lab_run", { strategy: p.strategy }), 1500);
    return () => clearTimeout(id);
  }, [p]);

  const strat = STRATEGIES.find((s) => s.id === p.strategy)!;
  const m = res.metrics;
  const b = res.benchMetrics;

  return (
    <div className="lab">
      <header className="nav">
        <a className="nav-id" href="../">
          <span className="mono-mark" aria-hidden>
            SB
          </span>
          <span className="nav-name">
            Strategy Lab
            <em>Siddharth Bagga · research</em>
          </span>
        </a>
        <nav className="nav-links" aria-label="Lab">
          <a href="#build">Build</a>
          <a href="#results">Results</a>
          <a href="#stress">Stress</a>
          <a href="#method">Method</a>
        </nav>
        <div className="nav-cta">
          <a className="nav-btn" href="../">
            ← Portfolio
          </a>
          <a className="nav-btn hot" href="../#connect">
            Get in touch
          </a>
        </div>
      </header>

      <main className="lab-main">
        <motion.section className="lab-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="kicker">Algorithmic strategies · research sandbox</div>
          <h1>
            Strategy <em>Lab</em>
          </h1>
          <p className="sub">
            Six allocation and risk-management rules a family office's investment committee would recognise, tested on ten years of weekly ETF prices ({DATA.dates[0]} → {DATA.asOf}). Every run is computed in your browser:
            no look-ahead, trading costs included, results benchmarked to the S&amp;P 500.
          </p>
          <p className="lab-flag">
            Hypothetical backtest for research and discussion. Not investment advice, not an offer of advisory services, and no live capital is managed with these rules.
          </p>
        </motion.section>

        <section id="build" className="lab-grid">
          <aside className="lab-controls" aria-label="Strategy settings">
            <div className="lab-h">Presets</div>
            <div className="lab-presets">
              {PRESETS.map((x) => (
                <button key={x.name} className="chip" onClick={() => setP({ ...DEFAULTS, ...x.p } as Params)}>
                  {x.name}
                </button>
              ))}
            </div>

            <div className="lab-h">Strategy</div>
            <div className="lab-strats" role="radiogroup" aria-label="Strategy">
              {STRATEGIES.map((s) => (
                <button key={s.id} role="radio" aria-checked={p.strategy === s.id} className={p.strategy === s.id ? "on" : ""} onClick={() => set("strategy", s.id as StrategyId)}>
                  <b>{s.name}</b>
                </button>
              ))}
            </div>
            <p className="lab-blurb">{strat.blurb}</p>

            {(p.strategy === "hold" || p.strategy === "trend" || p.strategy === "voltarget") && (
              <Select id="asset" label="Asset" value={p.asset} onChange={(v) => set("asset", v)} options={SYMBOLS} />
            )}
            {p.strategy === "static" && (
              <div className="lab-weights">
                {SYMBOLS.map((s) => (
                  <Range key={s} id={`w-${s}`} label={`${s} weight`} value={p.weights[s] ?? 0} min={0} max={100} step={5} fmt={(v) => `${v}`} onChange={(v) => set("weights", { ...p.weights, [s]: v })} />
                ))}
              </div>
            )}
            {(p.strategy === "dualmom" || p.strategy === "invvol") && (
              <fieldset className="lab-universe">
                <legend>Universe</legend>
                {SYMBOLS.map((s) => (
                  <label key={s}>
                    <input
                      type="checkbox"
                      checked={p.universe.includes(s)}
                      onChange={(e) => set("universe", e.target.checked ? [...p.universe, s] : p.universe.filter((x) => x !== s).length ? p.universe.filter((x) => x !== s) : p.universe)}
                    />
                    {s}
                  </label>
                ))}
              </fieldset>
            )}
            {p.strategy === "trend" && <Range id="sma" label="Moving average" value={p.smaWeeks} min={8} max={60} step={1} fmt={(v) => `${v} wks`} onChange={(v) => set("smaWeeks", v)} />}
            {(p.strategy === "dualmom" || p.strategy === "invvol" || p.strategy === "voltarget") && (
              <Range id="lb" label="Lookback" value={p.lookbackWeeks} min={8} max={104} step={1} fmt={(v) => `${v} wks`} onChange={(v) => set("lookbackWeeks", v)} />
            )}
            {p.strategy === "voltarget" && <Range id="tv" label="Target volatility" value={p.targetVolPct} min={4} max={20} step={0.5} fmt={(v) => `${v}%`} onChange={(v) => set("targetVolPct", v)} />}
            {(p.strategy === "trend" || p.strategy === "dualmom" || p.strategy === "voltarget") && (
              <Select id="safe" label="Defensive asset" value={p.safe} onChange={(v) => set("safe", v)} options={["AGG", "TLT", "GLD", "CASH"]} />
            )}
            {(p.strategy === "static" || p.strategy === "dualmom" || p.strategy === "invvol") && (
              <Range id="rb" label="Rebalance every" value={p.rebalanceWeeks} min={1} max={52} step={1} fmt={(v) => `${v} wks`} onChange={(v) => set("rebalanceWeeks", v)} />
            )}
            <Range id="cost" label="Trading cost" value={p.costBps} min={0} max={50} step={1} fmt={(v) => `${v} bps`} onChange={(v) => set("costBps", v)} />
            <Range id="start" label="Start" value={p.startIndex} min={0} max={DATA.dates.length - 60} step={1} fmt={(v) => DATA.dates[v]!} onChange={(v) => set("startIndex", v)} />
          </aside>

          <div id="results" className="lab-results">
            <div className="kpis" data-testid="kpis">
              <Kpi k="CAGR" v={pct(m.cagr)} vs={pct(b.cagr)} good={m.cagr >= b.cagr} />
              <Kpi k="Volatility" v={pct(m.vol)} vs={pct(b.vol)} good={m.vol <= b.vol} />
              <Kpi k="Sharpe (rf 0)" v={num(m.sharpe)} vs={num(b.sharpe)} good={m.sharpe >= b.sharpe} />
              <Kpi k="Max drawdown" v={pct(m.maxDD)} vs={pct(b.maxDD)} good={m.maxDD >= b.maxDD} />
              <Kpi k="Calmar" v={num(m.calmar)} vs={num(b.calmar)} good={m.calmar >= b.calmar} />
              <Kpi k="$1M became" v={usd(m.final)} vs={usd(b.final)} good={m.final >= b.final} />
            </div>

            <Chart res={res} log={log} />
            <div className="lab-chart-foot">
              <span>
                <i className="sw s" /> Strategy <i className="sw b" /> S&amp;P 500 (SPY)
              </span>
              <label>
                <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> Log scale
              </label>
            </div>
            <Drawdown res={res} />

            <div className="lab-table">
              <table>
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th className="r">Strategy</th>
                    <th className="r">SPY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Sortino</td><td className="r">{num(m.sortino)}</td><td className="r">{num(b.sortino)}</td></tr>
                  <tr><td>Worst week</td><td className="r">{pct(m.worstWeek)}</td><td className="r">{pct(b.worstWeek)}</td></tr>
                  <tr><td>Up weeks</td><td className="r">{pct(m.hitRate, 0)}</td><td className="r">{pct(b.hitRate, 0)}</td></tr>
                  <tr><td>Beta to SPY</td><td className="r">{num(m.beta)}</td><td className="r">1.00</td></tr>
                  <tr><td>Turnover / yr</td><td className="r">{pct(m.turnover, 0)}</td><td className="r">0%</td></tr>
                </tbody>
              </table>
              <Holdings w={res.weights.at(-1) ?? {}} />
            </div>
          </div>
        </section>

        <section id="stress" className="lab-stress">
          <h2 className="sec">Stress windows</h2>
          <p className="sub">How the rule behaved in the episodes an investment committee asks about first — including the 2022 rate shock, when stocks and bonds fell together.</p>
          <div className="stress-grid">
            {res.stress.map((s) => (
              <motion.div key={s.name} className="stress" layout>
                <b>{s.name}</b>
                <div>
                  <span className={s.strat >= 0 ? "pos" : "neg"}>{pct(s.strat)}</span>
                  <em>strategy</em>
                </div>
                <div>
                  <span className={s.bench >= 0 ? "pos" : "neg"}>{pct(s.bench)}</span>
                  <em>S&amp;P 500</em>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="method" className="lab-method">
          <h2 className="sec">Method &amp; limits</h2>
          <ul>
            <li>
              <b>Data.</b> {DATA.source}. {DATA.dates.length} weekly observations per ETF. Because distributions are excluded, income-heavy assets (bonds, REITs) are understated — AGG's price fell over the period even though its total return did not.
            </li>
            <li>
              <b>Timing.</b> Signals use closes up to week <i>t</i> and earn week <i>t+1</i>'s return. Verified by test: altering any future price leaves every earlier decision unchanged.
            </li>
            <li>
              <b>Costs.</b> Each rebalance pays the selected cost in basis points on traded notional. No taxes, slippage model, borrowing or leverage. Cash earns 0%.
            </li>
            <li>
              <b>Risk-free rate.</b> Sharpe and Sortino use 0%, which flatters every strategy equally against the benchmark.
            </li>
            <li>
              <b>Overfitting.</b> Ten years, one regime of mostly falling-then-rising rates. A rule tuned to look good here is a hypothesis, not evidence.
            </li>
          </ul>
          <p className="sub">
            Questions about the method? <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> — or ask Jarvis on the <a href="../#jarvis">main site</a>.
          </p>
        </section>
      </main>
    </div>
  );
}

function Kpi({ k, v, vs, good }: { k: string; v: string; vs: string; good: boolean }) {
  return (
    <motion.div className="kpi" layout>
      <span className="k">{k}</span>
      <AnimatePresence mode="popLayout">
        <motion.span key={v} className={`v ${good ? "good" : "bad"}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          {v}
        </motion.span>
      </AnimatePresence>
      <span className="vs">SPY {vs}</span>
    </motion.div>
  );
}

function Range({ id, label, value, min, max, step, fmt, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; fmt(v: number): string; onChange(v: number): void }) {
  return (
    <div className="sl">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{fmt(value)}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Select({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[]; onChange(v: string): void }) {
  return (
    <div className="sl">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
            {ASSETS[o] ? ` — ${ASSETS[o]}` : o === "CASH" ? " — 0% return" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function Holdings({ w }: { w: Record<string, number> }) {
  const rows = Object.entries(w).filter(([, x]) => x > 0.001).sort((a, b) => b[1] - a[1]);
  const cash = 1 - rows.reduce((a, [, x]) => a + x, 0);
  return (
    <div className="holdings">
      <div className="lab-h">Latest positioning</div>
      {rows.map(([k, x]) => (
        <div key={k} className="hold">
          <span>{k}</span>
          <i>
            <motion.b animate={{ width: `${x * 100}%` }} />
          </i>
          <em>{pct(x, 0)}</em>
        </div>
      ))}
      {cash > 0.005 && (
        <div className="hold">
          <span>Cash</span>
          <i>
            <motion.b animate={{ width: `${cash * 100}%` }} />
          </i>
          <em>{pct(cash, 0)}</em>
        </div>
      )}
    </div>
  );
}

const VW = 900;
const VH = 300;
const PAD = { l: 52, r: 12, t: 12, b: 26 };

function Chart({ res, log }: { res: Result; log: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const all = [...res.equity, ...res.bench];
  const tf = (v: number) => (log ? Math.log(v) : v);
  const lo = Math.min(...all.map(tf));
  const hi = Math.max(...all.map(tf));
  const n = res.equity.length;
  const x = (i: number) => PAD.l + (i / (n - 1)) * (VW - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (tf(v) - lo) / (hi - lo || 1)) * (VH - PAD.t - PAD.b);
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = useMemo(() => {
    const out: number[] = [];
    const a = Math.exp(lo);
    const z = Math.exp(hi);
    if (!log) {
      const step = (Math.max(...all) - Math.min(...all)) / 4;
      for (let i = 0; i <= 4; i++) out.push(Math.min(...all) + step * i);
      return out;
    }
    for (let v = 0.25e6; v <= z * 1.01; v *= 2) if (v >= a * 0.99) out.push(v);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo, hi, log]);
  const years = res.dates.map((d, i) => [d.slice(0, 4), i] as const).filter(([yr], i, arr) => i === 0 || yr !== arr[i - 1]![0]);

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * VW;
    const i = Math.round(((px - PAD.l) / (VW - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="chart">
      <svg ref={ref} viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="Growth of $1M, strategy versus S&P 500" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={VW - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.l - 6} y={y(t) + 3} className="ax" textAnchor="end">
              {usd(t)}
            </text>
          </g>
        ))}
        {years.filter((_, i) => i % 2 === 1).map(([yr, i]) => (
          <text key={yr} x={x(i)} y={VH - 8} className="ax" textAnchor="middle">
            {yr}
          </text>
        ))}
        <motion.path d={path(res.bench)} className="ln b" initial={false} animate={{ d: path(res.bench) }} transition={{ duration: 0.5 }} />
        <motion.path d={path(res.equity)} className="ln s" initial={false} animate={{ d: path(res.equity) }} transition={{ duration: 0.5 }} />
        <circle cx={x(n - 1)} cy={y(res.equity[n - 1]!)} r={4} className="end" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={VH - PAD.b} className="cross" />
            <circle cx={x(hover)} cy={y(res.equity[hover]!)} r={3.5} className="dot s" />
            <circle cx={x(hover)} cy={y(res.bench[hover]!)} r={3.5} className="dot b" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${(x(hover) / VW) * 100}%` }}>
          <b>{res.dates[hover]}</b>
          <span>Strategy {usd(res.equity[hover]!)}</span>
          <span>SPY {usd(res.bench[hover]!)}</span>
        </div>
      )}
    </div>
  );
}

function Drawdown({ res }: { res: Result }) {
  const n = res.drawdown.length;
  const H = 110;
  const min = Math.min(...res.drawdown, -0.05);
  const x = (i: number) => PAD.l + (i / (n - 1)) * (VW - PAD.l - PAD.r);
  const y = (v: number) => 6 + (v / min) * (H - 12);
  const area = `M${x(0)},${y(0)}` + res.drawdown.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("") + `L${x(n - 1)},${y(0)}Z`;
  return (
    <div className="chart dd">
      <svg viewBox={`0 0 ${VW} ${H}`} role="img" aria-label={`Drawdown, worst ${pct(min)}`}>
        <line x1={PAD.l} x2={VW - PAD.r} y1={y(0)} y2={y(0)} className="grid" />
        <text x={PAD.l - 6} y={y(min) + 3} className="ax" textAnchor="end">
          {pct(min, 0)}
        </text>
        <text x={PAD.l - 6} y={y(0) + 3} className="ax" textAnchor="end">
          0%
        </text>
        <motion.path d={area} className="dd-area" initial={false} animate={{ d: area }} transition={{ duration: 0.5 }} />
      </svg>
      <span className="dd-label">Drawdown from peak</span>
    </div>
  );
}
