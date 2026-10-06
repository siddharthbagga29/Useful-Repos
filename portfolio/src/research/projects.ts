// The research city's registry. Every building is a project; every floor is a milestone (lit when
// shipped, scaffolding when not); every bot is a real automated job in the repositories behind this
// site. Nothing here is decorative: kinds say exactly when each bot actually runs.

export type AgentKind = "scheduled" | "ci" | "deploy" | "script" | "local";

export const KIND_LABEL: Record<AgentKind, string> = {
  scheduled: "Every 6 h · GitHub Actions",
  ci: "Every push · GitHub Actions",
  deploy: "Every deploy · release gate",
  script: "On demand · reproducible script",
  local: "Owner's machine",
};

export interface Agent {
  name: string;
  kind: AgentKind;
  duty: string;
  /** what it produced last, in one line */
  output: string;
}

export interface Project {
  id: string;
  name: string;
  district: string;
  color: string;
  tags: string[];
  summary: string;
  params: [string, string][];
  milestones: [string, boolean][];
  agents: Agent[];
  /** `station` makes the link scroll the home page instead of loading a URL when we're already on it */
  links: { label: string; href: string; station?: "model" | "jarvis" }[];
  /** grid plot, 0..2 × 0..2; (1,1) is the Brain and (0,0), behind it, the Data Foundry */
  plot: [number, number];
}

const BASE: string = typeof import.meta.env !== "undefined" ? import.meta.env.BASE_URL : "/";

export const PROJECTS: Project[] = [
  {
    id: "strategy-lab",
    name: "Strategy Lab",
    district: "Quant Quarter",
    color: "#ff5a1f",
    tags: ["quant", "backtest", "montecarlo"],
    summary:
      "Ten allocation and online-portfolio-selection rules on ten years of weekly ETF data. Replicates the academic claim that mean-reversion algorithms win, then shows the edge disappears at about 5 bps of trading cost.",
    params: [
      ["Universe", "8 ETFs · SPY QQQ IWM EFA AGG TLT GLD VNQ"],
      ["Data", "561 weeks · 2015-12-28 → 2026-09-21"],
      ["Split", "selection to 2021-05-10 · holdout after"],
      ["Costs", "10 bps per side (swept 0–50)"],
      ["Monte Carlo", "1,000 × 10-yr block-bootstrap paths"],
    ],
    milestones: [
      ["Weekly data pipeline", true],
      ["Six allocation rules + stress windows", true],
      ["OPS replication (UCRP, EG, PAMR, OLMAR)", true],
      ["Transaction-cost sweep", true],
      ["Block-bootstrap Monte Carlo", true],
      ["Self-evolving search with locked holdout", true],
      ["Automated data refresh", false],
      ["Paper-trading ledger", false],
    ],
    agents: [
      { name: "Evolver", kind: "scheduled", duty: "Mutates rule families, scores them on the selection window, promotes champions by fold-by-fold Elo.", output: "See the Brain log for the live generation" },
      { name: "Auditor", kind: "deploy", duty: "Proves no look-ahead, costs reduce returns, weights stay on the simplex, the holdout is never seen.", output: "All lab checks pass on every release" },
      { name: "Backtester", kind: "script", duty: "Walk-forward OPS study with frozen parameters and a cost sweep.", output: "PAMR 10.5% at 0 bps → 0.8% out of sample at 10 bps" },
      { name: "Simulator", kind: "script", duty: "Stationary block bootstrap (mean block 8 weeks), seed 20261006.", output: "Defensive rules: shallower drawdown than SPY in 90–99.8% of paths" },
    ],
    links: [
      { label: "Open the Lab", href: `${BASE}lab/` },
      { label: "Monte Carlo", href: `${BASE}lab/#montecarlo` },
    ],
    plot: [2, 1],
  },
  {
    id: "deal-lab",
    name: "Deal Lab",
    district: "Underwriting Row",
    color: "#ffb020",
    tags: ["underwriting", "realestate", "montecarlo"],
    summary:
      "My Ohio wholesale deal analyzer, audited and rebuilt. v1 ignored the end buyer's costs and never applied its own contingency, so its example deal said GO. Fixed, it is a NO-GO that works in about 29% of simulated outcomes.",
    params: [
      ["Example deal", "ARV $160k · rehab $40k · contract $60k"],
      ["Rule", "70% of ARV − rehab × 1.15 − fee"],
      ["Buyer costs", "10% of ARV · min margin 20%"],
      ["Simulation", "5,000 trials · ARV σ 8% · overrun 10% ± 15%"],
    ],
    milestones: [
      ["Audit of v1 workbook", true],
      ["v2 workbook with live Monte Carlo", true],
      ["Web model mirrors the workbook", true],
      ["Excel vs Python cross-check", true],
      ["Max-price solver", true],
      ["Comparable-sales feed", false],
      ["Deal pipeline log", false],
    ],
    agents: [
      { name: "Underwriter", kind: "script", duty: "MAO, buyer all-in cost, margin and the GO / NO-GO signal.", output: "MAO $56,000 · buyer margin 17.5% · NO-GO" },
      { name: "Simulator", kind: "script", duty: "Draws ARV and rehab-overrun scenarios and counts deals that still work.", output: "Works in 29% of 5,000 outcomes" },
      { name: "Auditor", kind: "deploy", duty: "Ties the web model to the workbook's own formulas on every release.", output: "MAO, margin, expected profit and signal all tie" },
    ],
    links: [
      { label: "Open the Deal Lab", href: `${BASE}deal/` },
      { label: "Excel model", href: `${BASE}Wholesale_Deal_Analyzer_v2.xlsx` },
    ],
    plot: [1, 0],
  },
  {
    id: "jarvis",
    name: "Jarvis",
    district: "Agent Works",
    color: "#22d3ee",
    tags: ["llm", "agents", "voice"],
    summary:
      "A personal AI assistant in two parts: a Python service with guardrails, rate limits and confirmation-gated actions on a local model, and the in-browser agent on this site with voice, retrieval and citations.",
    params: [
      ["Browser", "Web Speech · retrieval over one brief"],
      ["Service", "FastAPI · local LLM via Ollama"],
      ["Safety", "Prompt canary · confirmation-gated actions"],
      ["Cost", "$0"],
    ],
    milestones: [
      ["In-browser agent with citations", true],
      ["Voice in and out", true],
      ["Python service + guardrails", true],
      ["Recruiter eval suite", true],
      ["Gated prompt evolution", true],
      ["Local model on the owner's machine", true],
      ["Always-on public endpoint", false],
    ],
    agents: [
      { name: "Test runner", kind: "ci", duty: "ruff, mypy, 79 pytest cases and the eval harness on every push.", output: "79 tests passing" },
      { name: "Evaluator", kind: "deploy", duty: "21 recruiter and principal questions; a release stops if one fails.", output: "21 / 21 cases pass" },
      { name: "Prompt evolver", kind: "local", duty: "Proposes prompt addenda; keeps one only if strictly better with no regressions.", output: "Runs when the owner's machine is on" },
    ],
    links: [{ label: "Talk to Jarvis", href: `${BASE}#jarvis`, station: "jarvis" }],
    plot: [2, 0],
  },
  {
    id: "sentinel",
    name: "Sentinel",
    district: "Risk Heights",
    color: "#a78bfa",
    tags: ["quant", "insurance", "montecarlo"],
    summary:
      "Market and actuarial research on what AI failures have cost: 29 public loss claims graded A–D by source quality, a 60,000-trial viability simulation and a 400,000-simulation pricing model.",
    params: [
      ["Evidence", "29 loss claims · graded A–D"],
      ["Viability", "60,000-trial Monte Carlo"],
      ["Pricing", "400,000 simulations"],
      ["Build", "332 assertions · seeded, reproducible"],
    ],
    milestones: [
      ["Loss-claim dataset", true],
      ["Source grading", true],
      ["Viability simulation", true],
      ["Pricing model", true],
      ["Build assertions", true],
      ["Public write-up", false],
    ],
    agents: [
      { name: "Grader", kind: "script", duty: "Grades every claim by source quality before it can feed a number.", output: "29 claims graded A–D" },
      { name: "Pricer", kind: "script", duty: "Frequency-severity simulation for premium ranges.", output: "400,000 simulations" },
      { name: "Auditor", kind: "script", duty: "Fails the build if any figure is typed rather than generated.", output: "332 assertions pass" },
    ],
    links: [],
    plot: [0, 1],
  },
  {
    id: "dcf",
    name: "S&P Global DCF",
    district: "Valuation Square",
    color: "#34d399",
    tags: ["valuation", "dcf"],
    summary: "M.S. capstone: a multi-scenario DCF of S&P Global benchmarked against Moody's and MSCI, with WACC sensitivity across rate environments. Landed within 10% of analyst consensus.",
    params: [
      ["Peers", "Moody's · MSCI"],
      ["Method", "Multi-scenario DCF · WACC × g sensitivity"],
      ["Result", "Within 10% of consensus"],
    ],
    milestones: [
      ["Model", true],
      ["Peer benchmark", true],
      ["Sensitivity grid", true],
      ["Report", true],
      ["Deck", true],
    ],
    agents: [{ name: "Sensitivity grid", kind: "script", duty: "Recomputes value across WACC and terminal growth; live in the Model station.", output: "Interactive on the home page" }],
    links: [{ label: "Model station", href: `${BASE}#model`, station: "model" }],
    plot: [2, 2],
  },
  {
    id: "twin-engine",
    name: "Twin-Engine",
    district: "Concept Docks",
    color: "#f472b6",
    tags: ["realestate", "dashboard"],
    summary:
      "A family-office control room for a two-market real-estate platform: US buy-fix-rent-refinance and India flips. Rebuilt so every figure is computed from the records. Runs on illustrative sample data.",
    params: [
      ["Markets", "US BRRRR · India flips"],
      ["Stack", "Next.js · TypeScript"],
      ["Data", "Illustrative sample"],
    ],
    milestones: [
      ["Concept dashboard", true],
      ["Metrics computed from records", true],
      ["Generated static preview", true],
      ["Real portfolio data", false],
      ["IRR engine", false],
      ["Authentication + backend", false],
    ],
    agents: [
      { name: "Metrics", kind: "script", duty: "Equity by market, value-add, exit multiple and compliance from the property list.", output: "Equity $4.2M · exit multiple 1.56×" },
      { name: "Previewer", kind: "script", duty: "Regenerates the hosted preview and asserts its numbers.", output: "Preview rebuilt, assertions pass" },
    ],
    links: [{ label: "View the concept", href: `${BASE}projects/twin-engine/` }],
    plot: [0, 2],
  },
  {
    id: "high-properties",
    name: "High Properties",
    district: "Build Yard",
    color: "#60a5fa",
    tags: ["fullstack", "realestate"],
    summary: "A lead-generation platform for a real-estate business: listings, enquiry capture, WhatsApp follow-up and an admin console on Vercel + Supabase at zero monthly cost.",
    params: [
      ["Stack", "Vercel · Supabase"],
      ["Cost", "$0 / month"],
    ],
    milestones: [
      ["Listings", true],
      ["Enquiry capture", true],
      ["WhatsApp follow-up", true],
      ["Admin console", true],
      ["Independent code audit", false],
    ],
    agents: [{ name: "Deployer", kind: "ci", duty: "Vercel builds the public repository and serves the site.", output: "Live on Vercel + Supabase" }],
    links: [{ label: "Code", href: "https://github.com/siddharthbagga29/High-Properties" }],
    plot: [1, 2],
  },
];

export const progress = (p: Project) => p.milestones.filter(([, d]) => d).length / p.milestones.length;
