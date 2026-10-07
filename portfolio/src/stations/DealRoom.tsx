import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";

const Rd = ({ children }: { children: ReactNode }) => (
  <span className="rd" tabIndex={0} title="Hover to unredact">
    {children}
  </span>
);

const DOCS: { id: string; n: string; group: string; title: string; body: ReactNode }[] = [
  {
    id: "exec",
    n: "1.1",
    group: "1.0 OVERVIEW",
    title: "Executive summary",
    body: (
      <>
        <p>
          The subject built an operating company's entire finance function from <Rd>raw bank statements and scattered invoices</Rd>, and was promoted to lead it within five months.
        </p>
        <p>
          He then underwrote a <b>$6M+ multi-state acquisition pipeline</b> in property services, authoring the go/no-go memoranda that governed every capital deployment decision.
        </p>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th className="r">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Pipeline underwritten</td><td className="r">$6.0M+</td></tr>
            <tr><td>Equity range delivered</td><td className="r">$3.5M – $21.0M</td></tr>
            <tr><td>Opex reduction identified</td><td className="r">6.0%</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "thesis",
    n: "1.2",
    group: "1.0 OVERVIEW",
    title: "Thesis & risks",
    body: (
      <>
        <p><b>Why it clears.</b></p>
        <ul>
          <li>Builds the analytical layer where none exists.</li>
          <li>Owns the full arc: frames the question, builds the model, writes the memo, defends it.</li>
          <li>M.S. Financial Mathematics paired with output a principal acts on.</li>
        </ul>
        <p><b>Risks, disclosed not discovered.</b></p>
        <ul>
          <li>Tenure is <Rd>22 months: 14 in the US (11 full-time) and 8 in India</Rd> — Associate-level, not senior.</li>
          <li>No expert-network or customer-interview programme run to date.</li>
          <li>Has not supervised junior colleagues.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ops",
    n: "2.1",
    group: "2.0 TRACK RECORD",
    title: "Operating history",
    body: (
      <>
        <table>
          <thead>
            <tr><th>Period</th><th>Role</th><th className="r">Result</th></tr>
          </thead>
          <tbody>
            <tr><td>Jan–Jun 2026</td><td>Strategic Finance Lead, Turnkey Services Pro</td><td className="r">Opex −6%</td></tr>
            <tr><td>Aug 2025–Jan 2026</td><td>Financial Associate, Turnkey Services Pro</td><td className="r">Decisions +75%</td></tr>
            <tr><td>Jan–Mar 2025</td><td>Wealth Management Intern, Cerity Partners</td><td className="r">Reporting −30%</td></tr>
          </tbody>
        </table>
        <ul>
          <li>Addressable market sizing by metro; competitive density and entry-cost modelling.</li>
          <li>Seller revenue forecasts tested against backlog and pipeline conversion.</li>
          <li>Reg D offering materials for LP capital raises on a deal-by-deal platform.</li>
        </ul>
      </>
    ),
  },
  {
    id: "qoe",
    n: "2.2",
    group: "2.0 TRACK RECORD",
    title: "Quality of earnings",
    body: (
      <>
        <p>Illustrative of the method applied in the pipeline. Real target figures are confidential.</p>
        <table>
          <thead>
            <tr><th>Bridge</th><th className="r">$000s</th></tr>
          </thead>
          <tbody>
            <tr><td>Reported EBITDA</td><td className="r">1,480</td></tr>
            <tr><td>Add back: owner comp above market</td><td className="r">+310</td></tr>
            <tr><td>Add back: non-recurring legal</td><td className="r">+74</td></tr>
            <tr><td>Deduct: deferred maintenance run-rate</td><td className="r">−128</td></tr>
            <tr><td>Deduct: <Rd>customer concentration haircut</Rd></td><td className="r">−196</td></tr>
            <tr><td><b>Normalized EBITDA</b></td><td className="r"><b>1,540</b></td></tr>
          </tbody>
        </table>
      </>
    ),
  },
];

export function DealRoom() {
  const [cur, setCur] = useState("exec");
  const doc = DOCS.find((d) => d.id === cur)!;
  let group = "";
  return (
    <Panel id="dealroom" label="Deal room">
      <Kicker>Station 03 · the deal room</Kicker>
      <motion.h2 className="sec" variants={rise}>
        Project Cincinnati
      </motion.h2>
      <motion.div className="vdr" variants={rise}>
        <nav className="idx" aria-label="Data room index">
          {DOCS.map((d) => {
            const head = d.group !== group ? d.group : null;
            group = d.group;
            return (
              <div key={d.id}>
                {head && <div className="t">{head}</div>}
                <button aria-current={cur === d.id} onClick={() => setCur(d.id)}>
                  <span className="n">{d.n}</span> {d.title}
                  {cur === d.id && <motion.span layoutId="vdr-pill" className="pill" />}
                </button>
              </div>
            );
          })}
          <div className="t">WATERMARK</div>
          <div className="wm">Viewer: you · {new Date().toISOString().slice(0, 10)}</div>
        </nav>
        <div className="docwrap">
          <AnimatePresence mode="wait">
            <motion.article
              key={doc.id}
              className="doc"
              initial={{ opacity: 0, y: 10, rotateX: -6 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.25, 1] }}
            >
              <div className="dl">Document {doc.n}</div>
              <h3>{doc.title}</h3>
              {doc.body}
            </motion.article>
          </AnimatePresence>
        </div>
      </motion.div>
    </Panel>
  );
}
