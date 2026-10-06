import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { exhibit } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";

const BASE: string = import.meta.env.BASE_URL;

interface Item {
  tag: string;
  title: string;
  body: string;
  proof: string[];
  links: { label: string; href?: string; onClick?: () => void }[];
}

// Only work Siddharth built. Code links appear only for public repositories.
const ITEMS: Item[] = [
  {
    tag: "Quant research",
    title: "Strategy Lab",
    body: "Ten allocation and online-portfolio-selection strategies on ten years of weekly ETF data. Replicates the academic claim that mean-reversion algorithms win — then shows it was a frictionless artefact: PAMR earns 10.5% a year at zero cost but trades 55% of the book weekly, and its edge is gone by 5 bps.",
    proof: ["Walk-forward, out-of-sample", "1,000-decade Monte Carlo", "No look-ahead (tested)"],
    links: [
      { label: "Open the Lab ↗", href: `${BASE}lab/` },
      { label: "Monte Carlo ↗", href: `${BASE}lab/#montecarlo` },
    ],
  },
  {
    tag: "Real-estate underwriting",
    title: "Deal Lab",
    body: "My Ohio wholesale deal analyzer, audited and rebuilt. v1 left the end buyer's selling and holding costs out and never applied its own rehab contingency — so its example deal said GO. With the fixes it's a NO-GO that works in only ~29% of simulated outcomes.",
    proof: ["Excel with live Monte Carlo", "Cross-checked vs Python (200k trials)", "Max price for 60% success"],
    links: [
      { label: "Open the Deal Lab ↗", href: `${BASE}deal/` },
      { label: "Excel model ↓", href: `${BASE}Wholesale_Deal_Analyzer_v2.xlsx` },
    ],
  },
  {
    tag: "Product concept",
    title: "Twin-Engine control room",
    body: "A family-office dashboard for a two-market real-estate platform: US buy-fix-rent-refinance and India flips, with a Clean Books compliance index. Rebuilt so every figure is computed from the records — v1 typed in an IRR and counted a sold building as a rental.",
    proof: ["Next.js + TypeScript", "Generated preview", "Illustrative sample data"],
    links: [{ label: "View the concept ↗", href: `${BASE}projects/twin-engine/` }],
  },
  {
    tag: "AI system",
    title: "Jarvis",
    body: "A personal AI assistant in two parts: a Python service (guardrails, rate limits, confirmation-gated actions, local LLM via Ollama) and the in-browser agent on this site with voice, retrieval and citations.",
    proof: ["Recruiter eval suite", "79 automated tests", "Runs at $0"],
    links: [{ label: "Talk to it", onClick: () => bus.emit({ type: "open_jarvis" }) }],
  },
  {
    tag: "Quant research",
    title: "Sentinel — AI liability loss model",
    body: "Market and actuarial research on what AI failures have cost: 29 public loss claims graded A–D by source quality, a 60,000-trial Monte Carlo of strategy viability, and a 400,000-simulation pricing model.",
    proof: ["Every figure generated, none hand-typed", "332 build assertions", "Seeded, reproducible"],
    links: [{ label: "Walkthrough on request", onClick: () => bus.emit({ type: "open_connect", intent: "deal" }) }],
  },
  {
    tag: "Valuation",
    title: "S&P Global multi-scenario DCF",
    body: "M.S. capstone benchmarked against Moody's and MSCI, with WACC sensitivity and free-cash-flow projections across rate environments. Landed within 10% of analyst consensus.",
    proof: ["Report + deck on file"],
    links: [
      { label: "Report ↗", href: exhibit("spgi").url },
      { label: "Deck ↗", href: exhibit("deck").url },
    ],
  },
  {
    tag: "Full-stack build",
    title: "High Properties",
    body: "A lead-generation platform for a real-estate business: listings, enquiry capture, WhatsApp follow-up and an admin console on Vercel + Supabase at zero monthly cost.",
    proof: ["Public repository", "Vercel + Supabase"],
    links: [{ label: "Code ↗", href: "https://github.com/siddharthbagga29/High-Properties" }],
  },
];

export function Research() {
  return (
    <Panel id="research" label="Credibility and research" className="panel-research">
      <Kicker>Credibility &amp; research</Kicker>
      <motion.h2 className="sec" variants={rise}>
        Systems I built, evidence I can show
      </motion.h2>
      <motion.div className="rs" variants={rise}>
        {ITEMS.map((it) => (
          <motion.article key={it.title} className="rs-card" whileHover={{ y: -4 }}>
            <span className="rs-tag">{it.tag}</span>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
            <ul>
              {it.proof.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="rs-links">
              {it.links.map((l) =>
                l.href ? (
                  <a key={l.label} className="chip" href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                    {l.label}
                  </a>
                ) : (
                  <button key={l.label} className="chip" type="button" onClick={l.onClick}>
                    {l.label}
                  </button>
                ),
              )}
            </div>
          </motion.article>
        ))}
      </motion.div>
    </Panel>
  );
}
