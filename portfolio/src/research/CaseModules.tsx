// Analytical modules for the case studies. Each computes from, or loads, the same artifact the rest
// of the site uses, so no figure here is typed by hand.

import { useMemo } from "react";
import { DCF, valueDcf } from "../data/site.ts";
import { analyze, DEAL_DEFAULTS, simulate } from "../deal/model.ts";
import research from "../lab/research.json";
import type { Feed } from "./feed.ts";
import { ago, when } from "./feed.ts";
import type { ModuleId } from "./cases.ts";
import { assessChampion, VALIDATION_LABEL } from "./validation.ts";

const pc = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const $b = (m: number) => `$${(m / 1000).toFixed(1)}B`;
const $k = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

type Ops = (typeof research.ops)[number];
type Mc = (typeof research.mc)[number];

export function Module({ id, feed }: { id: ModuleId; feed: Feed }) {
  switch (id) {
    case "dcf-sensitivity":
      return <DcfSensitivity />;
    case "ops-table":
      return <OpsTable />;
    case "cost-sweep":
      return <CostSweep />;
    case "mc-table":
      return <McTable />;
    case "brain-ledger":
      return <RunLedger feed={feed} workflow="brain" />;
    case "brain-validation":
      return <BrainValidation feed={feed} />;
    case "deal-result":
      return <DealResult />;
    case "deal-sim":
      return <DealSim />;
    case "ci-runs":
      return <RunLedger feed={feed} workflow="jarvis-ci" />;
  }
}

function Source({ children }: { children: React.ReactNode }) {
  return <p className="cs-source">{children}</p>;
}

function DcfSensitivity() {
  const waccs = [7, 7.5, 8, 8.5, 9, 9.5, 10, 11];
  const gs = [2, 2.5, 3, 3.5, 4];
  const base = valueDcf(DCF.defaultWacc, DCF.defaultG)!;
  return (
    <figure className="cs-fig">
      <div className="cs-kpis">
        <div>
          <span>Site model at {DCF.defaultWacc}% / {DCF.defaultG}% (illustrative)</span>
          <b>{$b(base.equity)}</b>
        </div>
        <div>
          <span>Terminal value share of EV</span>
          <b>{pc(base.pvtv / base.ev)}</b>
        </div>
        <div>
          <span>Reference market cap (2 Oct 2026)</span>
          <b>{$b(DCF.marketCap)}</b>
        </div>
      </div>
      <div className="cs-scroll">
        <table className="cs-table cs-heat" data-testid="dcf-grid">
          <caption>Implied equity value ($B) by WACC (rows) and terminal growth (columns). Illustrative model, not the capstone's result.</caption>
          <thead>
            <tr>
              <th scope="col">WACC ↓ · g →</th>
              {gs.map((g) => (
                <th key={g} scope="col">
                  {g.toFixed(1)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {waccs.map((w) => (
              <tr key={w}>
                <th scope="row">{w.toFixed(1)}%</th>
                {gs.map((g) => {
                  const v = valueDcf(w, g);
                  const isBase = w === DCF.defaultWacc && g === DCF.defaultG;
                  const rel = v ? v.equity / DCF.marketCap - 1 : 0;
                  return (
                    <td key={g} className={isBase ? "base" : ""} style={{ ["--h" as string]: v ? Math.max(-1, Math.min(1, rel * 2)) : 0 }}>
                      {v ? $b(v.equity) : "n/a"}
                      {isBase ? <span className="vh"> (base case)</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Source>Computed in the browser by valueDcf() in portfolio/src/data/site.ts, the function behind the home page's Model station.</Source>
    </figure>
  );
}

function OpsTable() {
  const ops = research.ops as Ops[];
  return (
    <figure className="cs-fig">
      <div className="cs-scroll">
        <table className="cs-table" data-testid="ops-table">
          <caption>
            Tuned on {research.method.split.inSample}, frozen, then run on {research.method.split.outOfSample} at {research.method.costBpsPerSide} bps per side.
          </caption>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">IS CAGR</th>
              <th scope="col">IS Sharpe</th>
              <th scope="col">OOS CAGR</th>
              <th scope="col">OOS Sharpe</th>
              <th scope="col">OOS max DD</th>
              <th scope="col">Weekly turnover</th>
              <th scope="col">Edge gone by</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((o) => (
              <tr key={o.id}>
                <th scope="row">
                  {o.name}
                  <small>{o.ref}</small>
                </th>
                <td>{pc(o.inSample.cagr)}</td>
                <td>{o.inSample.sharpe.toFixed(2)}</td>
                <td>{pc(o.outOfSample.cagr)}</td>
                <td>{o.outOfSample.sharpe.toFixed(2)}</td>
                <td>{pc(o.outOfSample.maxDD)}</td>
                <td>{pc(o.turnover)}</td>
                <td>{o.breakEvenBps === null ? "—" : `${o.breakEvenBps} bps`}</td>
              </tr>
            ))}
            <tr className="bench">
              <th scope="row">SPY buy &amp; hold</th>
              <td>{pc(research.spy.inSample.cagr)}</td>
              <td>{research.spy.inSample.sharpe.toFixed(2)}</td>
              <td>{pc(research.spy.outOfSample.cagr)}</td>
              <td>{research.spy.outOfSample.sharpe.toFixed(2)}</td>
              <td>{pc(research.spy.outOfSample.maxDD)}</td>
              <td>0%</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Source>
        From portfolio/src/lab/research.json, generated {research.generated} by scripts/research.ts. "Edge gone by": the cost at which the rule's CAGR falls to
        uniform CRP's.
      </Source>
    </figure>
  );
}

function CostSweep() {
  const pamr = (research.ops as Ops[]).find((o) => o.id === "pamr")!;
  const ucrp = (research.ops as Ops[]).find((o) => o.id === "ucrp")!;
  const max = Math.max(...pamr.sweep.map((s) => Math.abs(s.cagr)), ...ucrp.sweep.map((s) => Math.abs(s.cagr)));
  const W = 520;
  const H = 170;
  const x = (i: number) => 50 + (i * (W - 70)) / (pamr.sweep.length - 1);
  const y = (v: number) => H / 2 - (v / max) * (H / 2 - 18);
  const line = (sw: Ops["sweep"]) => sw.map((s, i) => `${x(i)},${y(s.cagr)}`).join(" ");
  return (
    <figure className="cs-fig">
      <svg viewBox={`0 0 ${W} ${H}`} className="cs-chart" role="img" aria-label={`PAMR CAGR falls from ${pc(pamr.sweep[0]!.cagr)} at 0 bps to ${pc(pamr.sweep.at(-1)!.cagr)} at 50 bps; uniform CRP from ${pc(ucrp.sweep[0]!.cagr)} to ${pc(ucrp.sweep.at(-1)!.cagr)}`}>
        <line x1={40} x2={W - 10} y1={y(0)} y2={y(0)} className="axis" />
        <polyline points={line(ucrp.sweep)} className="ln b" />
        <polyline points={line(pamr.sweep)} className="ln a" />
        {pamr.sweep.map((s, i) => (
          <g key={s.costBps}>
            <circle cx={x(i)} cy={y(s.cagr)} r={3} className="dot a" />
            <text x={x(i)} y={H - 4} textAnchor="middle" className="tick">
              {s.costBps} bps
            </text>
            <text x={x(i)} y={y(s.cagr) - 7} textAnchor="middle" className="val">
              {pc(s.cagr)}
            </text>
          </g>
        ))}
        <text x={44} y={14} className="lg a">
          PAMR
        </text>
        <text x={90} y={14} className="lg b">
          Uniform CRP
        </text>
      </svg>
      <Source>Whole sample, parameters frozen from the in-sample tuning. Same artifact as above.</Source>
    </figure>
  );
}

function McTable() {
  const mc = research.mc as Mc[];
  return (
    <figure className="cs-fig">
      <div className="cs-scroll">
        <table className="cs-table" data-testid="mc-table">
          <caption>
            {research.method.monteCarlo.paths.toLocaleString("en-US")} block-bootstrapped {research.method.monteCarlo.years}-year paths (mean block {research.method.monteCarlo.meanBlockWeeks} weeks, seed{" "}
            {research.method.monteCarlo.seed}).
          </caption>
          <thead>
            <tr>
              <th scope="col">Strategy</th>
              <th scope="col">Median CAGR</th>
              <th scope="col">Median max DD</th>
              <th scope="col">P(beats SPY return)</th>
              <th scope="col">P(shallower DD than SPY)</th>
            </tr>
          </thead>
          <tbody>
            {mc.map((m) => (
              <tr key={m.id} className={m.id === "spy" ? "bench" : ""}>
                <th scope="row">{m.name}</th>
                <td>{pc(m.cagr.p50)}</td>
                <td>{pc(m.maxDD.p50)}</td>
                <td>{m.pBeatSpyReturn == null || m.id === "spy" ? "—" : pc(m.pBeatSpyReturn)}</td>
                <td>{m.pShallowerDrawdown == null || m.id === "spy" ? "—" : pc(m.pShallowerDrawdown)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Source>The defensive rules buy shallower drawdowns, not higher returns. From research.json.</Source>
    </figure>
  );
}

function RunLedger({ feed, workflow }: { feed: Feed; workflow: "brain" | "jarvis-ci" }) {
  const events = feed.store.events.filter((e) => e.source === "github-actions" && e.projectId === (workflow === "brain" ? "strategy-lab" : "jarvis") && (e.status === "succeeded" || e.status === "failed"));
  const ok = events.filter((e) => e.status === "succeeded").length;
  const s = feed.sources[workflow];
  return (
    <figure className="cs-fig">
      <div className="cs-kpis">
        <div>
          <span>Runs listed</span>
          <b>{events.length}</b>
        </div>
        <div>
          <span>Succeeded</span>
          <b className="t-ok">✓ {ok}</b>
        </div>
        <div>
          <span>Failed</span>
          <b className={events.length - ok ? "t-err" : ""}>✕ {events.length - ok}</b>
        </div>
      </div>
      <ol className="cs-runs" data-testid={`runs-${workflow}`}>
        {events.slice(0, 12).map((e) => (
          <li key={e.eventId} className={e.status === "failed" ? "t-err" : "t-ok"}>
            <span aria-hidden>{e.status === "failed" ? "✕" : "✓"}</span>
            <a href={e.url} target="_blank" rel="noopener noreferrer">
              {e.title}
            </a>
            <time dateTime={e.occurredAt}>{when(e.occurredAt)}</time>
          </li>
        ))}
      </ol>
      <Source>
        Public GitHub Actions run list ({s.state === "live" ? "fetched just now" : s.state === "cached" ? `cached ${ago(s.at, feed.now)}` : s.state === "build" ? `as of the build, ${when(s.at)}` : "unavailable"}).
        {s.note ? ` ${s.note}` : ""}
      </Source>
    </figure>
  );
}

function BrainValidation({ feed }: { feed: Feed }) {
  const a = assessChampion(feed.brain);
  const c = feed.brain?.champion;
  return (
    <figure className="cs-fig" data-testid="brain-validation">
      <p className={`pill t-${a.status === "provisional" ? "ok" : a.status === "not-validated" ? "warn" : "idle"}`}>{VALIDATION_LABEL[a.status]}</p>
      {c && (
        <p className="cs-p">
          Champion: <b>{c.label}</b> · score {c.score.toFixed(1)}/100 · Elo {c.elo} · generation {feed.brain!.generation.toLocaleString("en-US")}
        </p>
      )}
      <div className="cs-scroll">
      <table className="cs-table">
        <caption>Checks applied to the current champion (all required). {a.ceiling}</caption>
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th scope="col">Value</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {a.checks.map((k) => (
            <tr key={k.label}>
              <th scope="row">{k.label}</th>
              <td>{k.value}</td>
              <td className={k.pass ? "t-ok" : "t-err"}>{k.pass ? "✓ pass" : "✕ fail"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <Source>Computed from the Brain's committed state by validation.ts. Read {feed.brainSource === "live" ? "from the latest commit on GitHub" : feed.brainSource === "site" ? "from the copy published with the site" : feed.brainSource}.</Source>
    </figure>
  );
}

function DealResult() {
  const r = analyze(DEAL_DEFAULTS);
  return (
    <figure className="cs-fig">
      <div className="cs-scroll">
      <table className="cs-table" data-testid="deal-result">
        <caption>v1's formulas and v2's on the same example deal.</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">v1</th>
            <th scope="col">v2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Maximum allowable offer</th>
            <td>{$k(r.v1.mao)}</td>
            <td>{$k(r.mao)}</td>
          </tr>
          <tr>
            <th scope="row">End buyer's margin</th>
            <td>{pc(r.v1.buyerMargin)}</td>
            <td>{pc(r.buyerMargin)}</td>
          </tr>
          <tr>
            <th scope="row">Signal</th>
            <td>{r.v1.signal}</td>
            <td className="t-err">{r.signal}</td>
          </tr>
        </tbody>
      </table>
      </div>
      <Source>Computed by analyze() in portfolio/src/deal/model.ts, which lab-check ties to the workbook.</Source>
    </figure>
  );
}

function DealSim() {
  const s = useMemo(() => simulate(DEAL_DEFAULTS, 5000, 7), []);
  const bins = 24;
  const lo = -0.2;
  const hi = 0.4;
  const counts = new Array<number>(bins).fill(0);
  for (const m of s.margins) counts[Math.max(0, Math.min(bins - 1, Math.floor(((m - lo) / (hi - lo)) * bins)))]! += 1;
  const max = Math.max(...counts);
  const W = 520;
  const H = 150;
  const bw = (W - 20) / bins;
  const cut = 10 + ((DEAL_DEFAULTS.minMargin - lo) / (hi - lo)) * (W - 20);
  return (
    <figure className="cs-fig">
      <div className="cs-kpis">
        <div>
          <span>Deal works (closes at a profit)</span>
          <b>{pc(s.pWorks, 0)}</b>
        </div>
        <div>
          <span>Buyer margin, median</span>
          <b>{pc(s.p50)}</b>
        </div>
        <div>
          <span>Buyer margin, 5th–95th</span>
          <b>
            {pc(s.p5)} to {pc(s.p95)}
          </b>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cs-chart" role="img" aria-label={`Histogram of simulated buyer margins; ${pc(s.pBites, 0)} clear the ${pc(DEAL_DEFAULTS.minMargin, 0)} minimum`}>
        {counts.map((c, i) => {
          const left = lo + ((i + 0.5) / bins) * (hi - lo);
          return <rect key={i} x={10 + i * bw + 1} y={H - 22 - (c / max) * (H - 40)} width={bw - 2} height={(c / max) * (H - 40)} className={left >= DEAL_DEFAULTS.minMargin ? "bar ok" : "bar"} />;
        })}
        <line x1={cut} x2={cut} y1={8} y2={H - 20} className="cut" />
        <text x={cut + 4} y={16} className="val">
          {pc(DEAL_DEFAULTS.minMargin, 0)} minimum
        </text>
        <text x={10} y={H - 6} className="tick">
          {pc(lo, 0)}
        </text>
        <text x={W - 10} y={H - 6} textAnchor="end" className="tick">
          {pc(hi, 0)}
        </text>
      </svg>
      <Source>simulate(DEAL_DEFAULTS, 5,000 trials, seed 7), run in your browser. The same function powers the Deal Lab.</Source>
    </figure>
  );
}
