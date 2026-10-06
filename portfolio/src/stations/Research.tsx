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
    tag: "Live system",
    title: "Strategy Lab",
    body: "Six allocation and risk rules — 60/40, trend, dual momentum, inverse volatility, volatility targeting — backtested in the browser on ten years of weekly ETF data, with stress windows for 2018, 2020 and the 2022 rate shock.",
    proof: ["Look-ahead bias tested", "Costs & turnover modelled", "Benchmarked to S&P 500"],
    links: [{ label: "Open the Lab ↗", href: `${BASE}lab/` }],
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
