import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { analyze, DEAL_DEFAULTS, maxPriceFor, simulate, type DealInputs } from "./model.ts";
import { loadAnalytics, track } from "../lib/track.ts";

const BASE = import.meta.env.BASE_URL;
const usd = (x: number) => `${x < 0 ? "−" : ""}$${Math.round(Math.abs(x)).toLocaleString("en-US")}`;
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

type Field = { k: keyof DealInputs; label: string; min: number; max: number; step: number; kind: "usd" | "pct"; note?: string };
const FIELDS: { group: string; fields: Field[] }[] = [
  {
    group: "The property",
    fields: [
      { k: "arv", label: "ARV (after-repair value)", min: 40000, max: 600000, step: 1000, kind: "usd" },
      { k: "rehab", label: "Rehab estimate", min: 0, max: 200000, step: 1000, kind: "usd" },
      { k: "contingency", label: "Rehab contingency", min: 0, max: 0.4, step: 0.01, kind: "pct" },
      { k: "contract", label: "Your contract price", min: 0, max: 400000, step: 500, kind: "usd" },
    ],
  },
  {
    group: "Your side",
    fields: [
      { k: "fee", label: "Assignment fee", min: 0, max: 40000, step: 500, kind: "usd" },
      { k: "emd", label: "Earnest money", min: 0, max: 5000, step: 100, kind: "usd" },
      { k: "marketing", label: "Marketing per deal", min: 0, max: 5000, step: 50, kind: "usd" },
      { k: "closeRate", label: "Close rate", min: 0.1, max: 1, step: 0.01, kind: "pct" },
      { k: "emdLoss", label: "EMD lost on fall-through", min: 0, max: 1, step: 0.05, kind: "pct" },
    ],
  },
  {
    group: "The buyer & the market",
    fields: [
      { k: "rule", label: "Rule of thumb", min: 0.55, max: 0.8, step: 0.01, kind: "pct" },
      { k: "buyerCosts", label: "Buyer's sell/close/hold costs", min: 0, max: 0.2, step: 0.005, kind: "pct", note: "% of ARV" },
      { k: "minMargin", label: "Minimum buyer margin", min: 0.05, max: 0.35, step: 0.01, kind: "pct" },
      { k: "arvSd", label: "ARV uncertainty (σ)", min: 0, max: 0.2, step: 0.005, kind: "pct" },
      { k: "overrunMean", label: "Average rehab overrun", min: -0.05, max: 0.4, step: 0.01, kind: "pct" },
      { k: "overrunSd", label: "Rehab overrun spread (σ)", min: 0, max: 0.4, step: 0.01, kind: "pct" },
    ],
  },
];

export function Deal() {
  const [d, setD] = useState<DealInputs>(DEAL_DEFAULTS);
  const a = useMemo(() => analyze(d), [d]);
  const sim = useMemo(() => simulate(d, 5000), [d]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  useEffect(() => {
    loadAnalytics();
    track("page_view", { page: "deal" }, true);
  }, []);
  useEffect(() => {
    setMaxPrice(null);
    const id = setTimeout(() => setMaxPrice(maxPriceFor(d, 0.6)), 250);
    return () => clearTimeout(id);
  }, [d]);

  const go = a.signal === "GO";
  const bins = 30;
  const lo = -0.2;
  const hi = 0.5;
  const counts = Array(bins).fill(0) as number[];
  for (const m of sim.margins) counts[Math.min(bins - 1, Math.max(0, Math.floor(((m - lo) / (hi - lo)) * bins)))]!++;
  const maxC = Math.max(...counts);
  const minX = ((d.minMargin - lo) / (hi - lo)) * 100;

  return (
    <div className="lab">
      <header className="nav">
        <a className="nav-id" href={BASE}>
          <span className="mono-mark" aria-hidden>
            SB
          </span>
          <span className="nav-name">
            Deal Lab
            <em>Siddharth Bagga · real estate</em>
          </span>
        </a>
        <nav className="nav-links" aria-label="Deal Lab">
          <a href={`${BASE}lab/`}>Strategy Lab</a>
          <a href={`${BASE}Wholesale_Deal_Analyzer_v2.xlsx`} download>
            Excel model ↓
          </a>
        </nav>
        <div className="nav-cta">
          <a className="nav-btn" href={BASE}>
            ← Portfolio
          </a>
          <a className="nav-btn hot" href={`${BASE}#connect`}>
            Get in touch
          </a>
        </div>
      </header>

      <main className="lab-main">
        <section className="lab-hero">
          <div className="kicker">Real-estate underwriting · wholesale assignments</div>
          <h1>
            Deal <em>Lab</em>
          </h1>
          <p className="sub">
            My Ohio wholesale deal analyzer, rebuilt and stress-tested. Every input feeds the maximum allowable offer, the end buyer's true margin after
            selling, closing and holding costs, and 5,000 simulated outcomes with uncertain ARV and rehab overruns.
          </p>
          <p className="lab-flag">An underwriting tool for education and discussion. Not legal, tax or investment advice; verify comps, rehab bids and Ohio wholesaling rules locally.</p>
        </section>

        <section className="lab-grid">
          <aside className="lab-controls" aria-label="Deal inputs">
            {FIELDS.map((g) => (
              <div key={g.group} className="deal-group">
                <div className="lab-h">{g.group}</div>
                {g.fields.map((f) => (
                  <div key={f.k} className="sl">
                    <label htmlFor={`d-${f.k}`}>{f.label}</label>
                    <output htmlFor={`d-${f.k}`}>{f.kind === "usd" ? usd(d[f.k]) : pct(d[f.k], 1)}</output>
                    <input id={`d-${f.k}`} type="range" min={f.min} max={f.max} step={f.step} value={d[f.k]} onChange={(e) => setD((x) => ({ ...x, [f.k]: parseFloat(e.target.value) }))} />
                  </div>
                ))}
              </div>
            ))}
            <button className="chip" onClick={() => setD(DEAL_DEFAULTS)}>
              Reset to the workbook example
            </button>
          </aside>

          <div className="lab-results">
            <motion.div className={`signal ${go ? "go" : "no"}`} key={a.signal} initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} data-testid="deal-signal">
              <span className="lbl">Signal</span>
              <b>{a.signal}</b>
              <span className="v1">
                v1 workbook said: <i>{a.v1.signal}</i> (MAO {usd(a.v1.mao)}, buyer margin {pct(a.v1.buyerMargin)} — no contingency, no buyer costs)
              </span>
            </motion.div>

            <div className="kpis">
              <Kpi k="MAO" v={usd(a.mao)} sub={`contract ${usd(d.contract)}`} good={d.contract <= a.mao} />
              <Kpi k="Buyer margin" v={pct(a.buyerMargin)} sub={`need ${pct(d.minMargin, 0)}`} good={a.buyerMargin >= d.minMargin} />
              <Kpi k="Expected profit" v={usd(a.expected)} sub={`${usd(a.net)} if it closes`} good={a.expected > 0} />
              <Kpi k="Works in" v={pct(sim.pWorks, 0)} sub="of 5,000 outcomes" good={sim.pWorks >= 0.5} testid="deal-pworks" />
              <Kpi k="Buyer bites" v={pct(sim.pBites, 0)} sub="margin ≥ minimum" good={sim.pBites >= 0.6} />
              <Kpi k="Max price @ 60%" v={maxPrice === null ? "…" : usd(maxPrice)} sub="contract for 60% success" good={maxPrice !== null && d.contract <= maxPrice} />
            </div>

            <div className="chart">
              <div className="hist deal-hist" role="img" aria-label="Distribution of the end buyer's margin across simulated outcomes">
                {counts.map((c, i) => (
                  <div key={i} className="hcol">
                    <motion.i className={`hb ${lo + ((hi - lo) * (i + 0.5)) / bins >= d.minMargin ? "ok" : "s"}`} animate={{ height: `${(c / maxC) * 100}%` }} transition={{ type: "spring", stiffness: 220, damping: 28 }} />
                    {i % 5 === 0 && <span>{pct(lo + ((hi - lo) * i) / bins, 0)}</span>}
                  </div>
                ))}
                <i className="minline" style={{ left: `${minX}%` }} aria-hidden />
              </div>
              <span className="dd-label">End buyer's margin · 5th {pct(sim.p5, 0)} · median {pct(sim.p50, 0)} · 95th {pct(sim.p95, 0)}</span>
            </div>

            <div className="lab-table">
              <table>
                <thead>
                  <tr>
                    <th>Waterfall</th>
                    <th className="r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>ARV × {pct(d.rule, 0)}</td><td className="r">{usd(d.arv * d.rule)}</td></tr>
                  <tr><td>Less rehab incl. {pct(d.contingency, 0)} contingency</td><td className="r">{usd(-a.rehabAll)}</td></tr>
                  <tr><td>Less your fee</td><td className="r">{usd(-d.fee)}</td></tr>
                  <tr><td><b>MAO</b></td><td className="r"><b>{usd(a.mao)}</b></td></tr>
                  <tr><td>Buyer pays you + seller</td><td className="r">{usd(a.assign)}</td></tr>
                  <tr><td>Buyer's sell/close/hold ({pct(d.buyerCosts, 1)} of ARV)</td><td className="r">{usd(d.arv * d.buyerCosts)}</td></tr>
                  <tr><td><b>Buyer's profit</b></td><td className="r"><b>{usd(a.buyerProfit)}</b></td></tr>
                </tbody>
              </table>
              <div className="deal-notes">
                <div className="lab-h">What v2 fixed</div>
                <ul>
                  <li>Buyer costs (agent, closing, holding) now come out of the buyer's margin.</li>
                  <li>The rehab contingency is applied, not just recommended.</li>
                  <li>One minimum margin drives both the guidance and the signal.</li>
                  <li>Return on cash counts marketing as cash at risk.</li>
                  <li>Expected profit weights the fee by your close rate.</li>
                </ul>
                <a className="chip" href={`${BASE}Wholesale_Deal_Analyzer_v2.xlsx`} download data-testid="deal-xlsx">
                  Download the Excel model (live Monte Carlo) ↓
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ k, v, sub, good, testid }: { k: string; v: string; sub: string; good: boolean; testid?: string }) {
  return (
    <div className="kpi" data-testid={testid}>
      <span className="k">{k}</span>
      <span className={`v ${good ? "good" : "bad"}`}>{v}</span>
      <span className="vs">{sub}</span>
    </div>
  );
}
