import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";

const ROLES = [
  {
    when: "Jan – Jun 2026",
    title: "Strategic Finance Lead",
    org: "Turnkey Services Pro · Cincinnati",
    tag: "Promoted in 5 months",
    points: [
      "Underwrote a $6M+ multi-state acquisition pipeline in property services: normalized EBITDA, backlog-tested seller forecasts, IRR/MOIC at multiple entry and exit points.",
      "Wrote the go/no-go investment memos behind every capital deployment decision and defended them to the Managing Partner.",
      "Valued private companies (12% WACC, 3% terminal growth): $3.5M base to $21M upside. Cut opex 6%. Authored Reg D materials for LP raises.",
    ],
  },
  {
    when: "Aug 2025 – Jan 2026",
    title: "Financial Associate",
    org: "Turnkey Services Pro · Cincinnati",
    tag: "Built the finance function",
    points: [
      "Started from raw bank statements and scattered invoices; built the first DCF, free-cash-flow, AR/AP and job-costing models.",
      "Executive decision-making efficiency up 75% in month one, per the Managing Partner. Produced the first investment prospectus.",
    ],
  },
  {
    when: "Jan – Mar 2025",
    title: "Wealth Management Intern",
    org: "Cerity Partners · Cincinnati",
    tag: "Reporting −30%",
    points: ["Reconciled high-volume client transactions under U.S. GAAP and internal controls; cut daily reporting turnaround 30%."],
  },
];

const EDU = [
  ["M.S. Financial Mathematics", "University of Cincinnati", "2024 – 2025"],
  ["Graduate Certificate, Quantitative Finance", "University of Cincinnati", "2025"],
  ["B.Com (Honors), Finance", "University of Delhi", "2020 – 2023"],
];

export function Experience() {
  return (
    <Panel id="experience" label="Track record" className="panel-exp">
      <Kicker>Track record</Kicker>
      <motion.h2 className="sec" variants={rise}>
        Experience &amp; education
      </motion.h2>
      <motion.ol className="tl" variants={rise}>
        {ROLES.map((r) => (
          <li key={r.title}>
            <div className="tl-when">{r.when}</div>
            <div className="tl-body">
              <h3>
                {r.title} <span>— {r.org}</span>
              </h3>
              <span className="tl-tag">{r.tag}</span>
              <ul>
                {r.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </motion.ol>
      <motion.dl className="edu" variants={rise}>
        {EDU.map(([d, s, y]) => (
          <div key={d}>
            <dt>{d}</dt>
            <dd>
              {s} · {y}
            </dd>
          </div>
        ))}
        <div>
          <dt>Credentials</dt>
          <dd>Bloomberg Market Concepts · IISc Strategic Management Scholar · CFA L1 exam-fee scholarship (exam not yet taken)</dd>
        </div>
      </motion.dl>
    </Panel>
  );
}
