import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { HYPOTHESES, type BrainState, type LogEntry } from "./engine.ts";
import { nextRun, useBrain } from "./useBrain.ts";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const RUBRIC: [keyof BrainState["champion"]["rubric"], string, number][] = [
  ["riskReturn", "Risk-adjusted return", 30],
  ["consistency", "Fold consistency", 20],
  ["drawdown", "Drawdown control", 20],
  ["costs", "Cost efficiency", 10],
  ["robustness", "Robustness (DSR)", 20],
];
const KIND: Record<LogEntry["kind"], string> = { run: "RUN", explore: "BEST", promote: "PROMOTE", reject: "REJECT", fix: "FIX", record: "HOLD" };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60e3);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

export function BrainConsole() {
  const { data, failed } = useBrain(120_000);
  const [filter, setFilter] = useState<LogEntry["kind"] | "all">("all");
  const s = data?.state;
  const log = useMemo(() => (s ? [...s.log].reverse().filter((l) => filter === "all" || l.kind === filter) : []), [s, filter]);

  if (!s)
    return (
      <div className="brain-con" data-testid="brain-console">
        <p className="bc-wait">{failed ? "The Brain's state could not be loaded. It will appear after the next deploy." : "Connecting to the Brain…"}</p>
      </div>
    );
  const c = s.champion;
  const h = c.holdout;
  const hyp = HYPOTHESES.find((x) => x.id === c.family);

  return (
    <div className="brain-con" data-testid="brain-console">
      <div className="bc-top">
        <span className="bc-live">
          <i aria-hidden /> {data.source === "live" ? "LIVE" : "SNAPSHOT"}
        </span>
        <span>Runs every 6 h on GitHub Actions · last run {ago(s.lastRun)} · next {nextRun(s.lastRun)}</span>
      </div>
      <div className="bc-stats">
        {[
          ["Generation", s.generation.toLocaleString("en-US")],
          ["Strategies tried", s.trials.toLocaleString("en-US")],
          ["Champion score", `${c.score.toFixed(1)} / 100`],
          ["Champion Elo", String(c.elo)],
          ["Deflated Sharpe", pct(c.is.dsr)],
          ["Runs", String(s.runs)],
        ].map(([k, v]) => (
          <div key={k} className="bc-stat">
            <span>{k}</span>
            <b data-testid={k === "Generation" ? "brain-gen" : undefined}>{v}</b>
          </div>
        ))}
      </div>

      <div className="bc-grid">
        <section className="bc-card">
          <div className="bc-h">Champion</div>
          <h3>{c.label}</h3>
          <p className="bc-sub">
            {hyp?.name} · born generation {c.born} · {hyp?.claim}
          </p>
          <div className="bc-rubric">
            {RUBRIC.map(([k, label, max]) => (
              <div key={k}>
                <span>{label}</span>
                <i>
                  <motion.b initial={{ width: 0 }} animate={{ width: `${(c.rubric[k] / max) * 100}%` }} transition={{ duration: 0.8 }} />
                </i>
                <em>
                  {c.rubric[k].toFixed(1)}/{max}
                </em>
              </div>
            ))}
          </div>
          <table className="bc-tab">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th className="r">Selection 2016–21</th>
                <th className="r">Holdout 2021–26</th>
                <th className="r">SPY holdout</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">CAGR</th>
                <td className="r">{pct(c.is.cagr)}</td>
                <td className="r">{h ? pct(h.cagr) : "—"}</td>
                <td className="r">{h ? pct(h.spyCagr) : "—"}</td>
              </tr>
              <tr>
                <th scope="row">Sharpe</th>
                <td className="r">{c.is.sharpe.toFixed(2)}</td>
                <td className="r">{h ? h.sharpe.toFixed(2) : "—"}</td>
                <td className="r">{h ? h.spySharpe.toFixed(2) : "—"}</td>
              </tr>
              <tr>
                <th scope="row">Max drawdown</th>
                <td className="r">{pct(c.is.maxDD)}</td>
                <td className="r">{h ? pct(h.maxDD) : "—"}</td>
                <td className="r">{h ? pct(h.spyMaxDD) : "—"}</td>
              </tr>
              <tr>
                <th scope="row">Cost drag / yr</th>
                <td className="r">{pct(c.is.drag, 2)}</td>
                <td className="r" colSpan={2} />
              </tr>
            </tbody>
          </table>
          <div className="bc-folds" aria-label="Sharpe ratio by fold">
            {c.is.folds.map((f, i) => (
              <div key={i}>
                <i style={{ height: `${Math.min(100, Math.max(4, (Math.abs(f) / 3) * 100))}%` }} className={f >= 0 ? "pos" : "neg"} />
                <span>
                  F{i + 1} {f.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bc-card bc-log-card">
          <div className="bc-h">
            Brain log
            <span className="bc-filter">
              {(["all", "promote", "reject", "fix", "explore"] as const).map((k) => (
                <button key={k} type="button" className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
                  {k}
                </button>
              ))}
            </span>
          </div>
          <ol className="bc-log" aria-live="polite" data-testid="brain-log">
            <AnimatePresence initial={false}>
              {log.slice(0, 80).map((l, i) => (
                <motion.li key={`${l.t}-${l.gen}-${i}-${l.text.slice(0, 20)}`} className={`k-${l.kind}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 20) * 0.02 }}>
                  <span className="bc-g">g{String(l.gen).padStart(4, "0")}</span>
                  <span className="bc-k">{KIND[l.kind]}</span>
                  <span className="bc-t">{l.text}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </section>
      </div>

      <div className="bc-grid">
        <section className="bc-card">
          <div className="bc-h">Active hypotheses</div>
          <table className="bc-tab">
            <thead>
              <tr>
                <th>Hypothesis</th>
                <th className="r">Trials</th>
                <th className="r">Promotions</th>
                <th className="r">Best score</th>
                <th className="r">Step</th>
              </tr>
            </thead>
            <tbody>
              {HYPOTHESES.map((x) => {
                const f = s.families[x.id];
                return (
                  <tr key={x.id} title={x.claim}>
                    <th scope="row">{x.name}</th>
                    <td className="r">{f.trials}</td>
                    <td className="r">{f.wins}</td>
                    <td className="r">{f.best ? f.best.score.toFixed(1) : "—"}</td>
                    <td className="r">{f.step.toFixed(2)}×</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="bc-card">
          <div className="bc-h">Hall of fame</div>
          <table className="bc-tab">
            <thead>
              <tr>
                <th>Strategy</th>
                <th className="r">Score</th>
                <th className="r">Holdout Sharpe</th>
              </tr>
            </thead>
            <tbody>
              {s.hallOfFame.map((x) => (
                <tr key={x.id}>
                  <th scope="row">{x.label}</th>
                  <td className="r">{x.score.toFixed(1)}</td>
                  <td className="r">{x.holdout ? x.holdout.sharpe.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <p className="bc-note">
        How to read this: selection only ever sees 2016-01 → 2021-05 (a test scrambles every later price and proves the choices don't change). Holdout figures
        are reported, never optimised on. The Deflated Sharpe charges for every strategy tried, so it falls as the search grows. Two honest caveats: picking
        these eight ETFs in 2026 is itself hindsight, and distributions are excluded from the data. Hypothetical research, not investment advice.
      </p>
    </div>
  );
}
