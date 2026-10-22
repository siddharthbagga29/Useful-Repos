// Case-study content, one per project. Anything a section doesn't document is rendered as "Not
// documented in this repository", never filled in. Figures that a script produced are not typed here:
// the `module` blocks compute or load them from the same artifacts the site uses.
//
// Sections 7 (work completed), 10 (limitations) and 12 (links) are assembled from the manifest, so a
// case study can't claim a milestone the inventory doesn't.

import type { ProjectId } from "./manifest.ts";

export type SectionId = "summary" | "problem" | "question" | "data" | "method" | "architecture" | "work" | "results" | "validation" | "limitations" | "reproduce" | "links";

export const SECTION_TITLE: Record<SectionId, string> = {
  summary: "Executive summary",
  problem: "Problem and intended user",
  question: "Research question or decision",
  data: "Data, coverage and assumptions",
  method: "Methodology and formulas",
  architecture: "Architecture and process",
  work: "Work completed and milestones",
  results: "Results",
  validation: "Validation and test evidence",
  limitations: "Limitations, risks and open work",
  reproduce: "Reproduce it",
  links: "Source, reports and demos",
};

export const DEFAULT_ORDER: SectionId[] = ["summary", "problem", "question", "data", "method", "architecture", "work", "results", "validation", "limitations", "reproduce", "links"];

export type ModuleId = "dcf-sensitivity" | "ops-table" | "cost-sweep" | "mc-table" | "brain-ledger" | "brain-validation" | "deal-result" | "deal-sim" | "ci-runs";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][]; caption?: string }
  | { kind: "formula"; text: string; note?: string }
  | { kind: "flow"; nodes: string[]; caption?: string }
  | { kind: "steps"; items: string[] }
  | { kind: "note"; tone: "warn" | "info"; text: string }
  | { kind: "module"; id: ModuleId };

export interface CaseStudy {
  /** one line under the title: what kind of work this is */
  kind: string;
  order?: SectionId[];
  sections: Partial<Record<SectionId, Block[]>>;
}

export const CASES: Record<ProjectId, CaseStudy> = {
  dcf: {
    kind: "Valuation · discounted cash flow",
    order: ["summary", "question", "results", "method", "data", "architecture", "work", "validation", "limitations", "reproduce", "problem", "links"],
    sections: {
      summary: [
        { kind: "p", text: "A multi-scenario DCF of S&P Global, written as the M.S. Financial Mathematics capstone and benchmarked against Moody's and MSCI. The report's finding was a value within 10% of analyst consensus." },
        { kind: "note", tone: "warn", text: "The capstone workbook is not in this repository. The grid below is the site's illustrative model on SPGI's reported revenue with estimated cash flows; it shows the method, not the capstone's number." },
      ],
      question: [{ kind: "p", text: "What is S&P Global worth under different rate environments, and how much of that value rests on the discount rate and the terminal growth assumption?" }],
      results: [
        { kind: "p", text: "Value drivers: five years of free cash flow and a terminal value. At the site model's defaults the terminal value is most of enterprise value, which is why the sensitivity grid matters more than any single point estimate." },
        { kind: "module", id: "dcf-sensitivity" },
      ],
      method: [
        { kind: "formula", text: "EV = Σₜ₌₁⁵ FCFₜ / (1 + WACC)ᵗ  +  [FCF₅ × (1 + g) / (WACC − g)] / (1 + WACC)⁵", note: "Gordon-growth terminal value; the model refuses WACC − g below 0.5 percentage points." },
        { kind: "formula", text: "Equity value = EV − net debt" },
        { kind: "list", items: ["Peers: Moody's and MSCI for multiples and margin context.", "Scenarios: WACC across rate environments, with terminal growth swept alongside it."] },
      ],
      data: [
        { kind: "table", head: ["Input", "Value", "Source"], rows: [["Revenue 2023–2025", "$12.497B · $14.208B · $15.336B", "SPGI 10-K (reported)"], ["Free cash flow 2026–2030", "Estimates", "Site model assumption"], ["Net debt", "Estimate", "Site model assumption"], ["Market cap reference", "≈ $113.6B, 2 Oct 2026", "Market data on that date"]] },
      ],
      architecture: [{ kind: "flow", nodes: ["Reported revenue", "FCF projection", "Discounting at WACC", "Terminal value", "EV − net debt", "Sensitivity grid"] }],
      validation: [
        { kind: "list", items: ["The site grid is computed by one function (valueDcf) that the Model station also uses, so the two can't disagree.", "Capstone validation against consensus is stated in the report and was not re-performed here."] },
      ],
      reproduce: [{ kind: "steps", items: ["Open the Model station on the home page and drag WACC and terminal growth.", "Or read portfolio/src/data/site.ts: valueDcf(waccPct, gPct)."] }],
    },
  },
  "risk-tolerance": {
    kind: "Survey research · investor profiling",
    sections: {
      summary: [{ kind: "p", text: "Investor profiling built on survey design, a scoring model and portfolio-fit mapping. It grew out of the Sri Vipra research project he led at Sri Venkateswara College (University of Delhi), published as \"Empirical Analysis of Risk Tolerance\"." }],
      problem: [{ kind: "p", text: "Advisers routinely mismatch clients and portfolios because stated risk appetite and actual capacity for loss diverge. A structured instrument and a scoring model make the match explicit and reviewable." }],
      question: [{ kind: "p", text: "Which observable investor characteristics explain risk tolerance, and how should a score map to a portfolio?" }],
      data: [{ kind: "p", text: "Survey responses analysed in SPSS; the research datasets were maintained for audit-style review. Sample size and variables are documented in the report." }],
      method: [{ kind: "list", items: ["Questionnaire design for risk attitude and capacity.", "A scoring model over the responses.", "A mapping from score bands to portfolio profiles."] }],
      architecture: [{ kind: "flow", nodes: ["Survey instrument", "Responses (SPSS)", "Scoring model", "Risk band", "Portfolio fit"] }],
      validation: [{ kind: "note", tone: "info", text: "Manual verification required: the analysis is in the published report and the data is not in this repository." }],
    },
  },
  "strategy-lab": {
    kind: "Quantitative research · backtesting and search",
    order: ["summary", "question", "data", "results", "validation", "method", "architecture", "work", "limitations", "reproduce", "problem", "links"],
    sections: {
      summary: [
        { kind: "p", text: "Two studies and one scheduled search on the same weekly ETF data. The online-portfolio-selection study replicates the claim that mean-reversion algorithms win, then shows the edge disappears at a few basis points of cost. The Monte Carlo shows defensive rules buy shallower drawdowns, not higher returns. The Brain keeps searching rule families on 2016–2021 and reports its champion on 2021–2026." },
      ],
      question: [{ kind: "p", text: "Do published allocation and mean-reversion rules survive realistic trading costs and data they weren't tuned on, and can an automated search find a rule that does without overfitting?" }],
      data: [
        { kind: "table", head: ["Item", "Value"], rows: [["Universe", "SPY QQQ IWM EFA AGG TLT GLD VNQ"], ["Frequency", "Weekly bars, week-start dated"], ["Span", "2015-12-28 → 2026-09-21 (561 weeks)"], ["Prices", "Split-adjusted closes; distributions excluded"], ["Selection window", "2015-12-28 → 2021-05-10"], ["Holdout", "2021-05-10 → 2026-09-21"], ["Costs", "10 bps per side headline; swept 0–50 bps"], ["Refresh", "None automated: a manual snapshot"]] },
        { kind: "note", tone: "warn", text: "Price-only returns understate bonds most (AGG and TLT lose their coupons), so the data quietly favours equity- and gold-heavy rules. Treat every comparison with bonds as biased against them." },
      ],
      results: [
        { kind: "p", text: "Online portfolio selection, tuned on the first half and frozen, at 10 bps per side:" },
        { kind: "module", id: "ops-table" },
        { kind: "p", text: "PAMR's edge against cost (whole sample, frictionless to 50 bps):" },
        { kind: "module", id: "cost-sweep" },
        { kind: "p", text: "1,000 block-bootstrapped ten-year paths, frozen parameters:" },
        { kind: "module", id: "mc-table" },
        { kind: "p", text: "The Brain's scheduled runs, from GitHub Actions:" },
        { kind: "module", id: "brain-ledger" },
      ],
      validation: [
        { kind: "module", id: "brain-validation" },
        { kind: "list", items: ["lab-check.ts verifies no look-ahead, that costs reduce returns, that weights stay on the simplex, and that scrambling the holdout prices doesn't change any selection.", "A workflow run that succeeds only means the search ran and its state was committed. Validation of the champion is judged separately, above."] },
      ],
      method: [
        { kind: "formula", text: "Signal on the close of week t sets the weights that earn week t+1's return.", note: "Tested for look-ahead in lab-check.ts." },
        { kind: "formula", text: "Score /100 = 30·risk-return + 20·fold consistency + 20·drawdown + 10·cost drag + 20·Deflated Sharpe probability" },
        { kind: "formula", text: "DSR = Φ( (SR − SR₀) · √(n − 1) / √(1 − γ₃·SR + (γ₄ − 1)/4 · SR²) ),  SR₀ from the expected maximum of N unskilled trials", note: "Bailey & López de Prado (2014); N grows with every strategy the Brain tries." },
        { kind: "list", items: ["Promotion needs more fold wins than losses against the champion (Elo-rated) and a higher score, inside a −35% drawdown guard and a 1.5%/yr cost-drag guard.", "Monte Carlo: stationary block bootstrap, mean block 8 weeks, seed 20261006."] },
      ],
      architecture: [
        { kind: "flow", nodes: ["weekly.json snapshot", "Selection slice (≤ 2021-05-10)", "Mutate (UCB1 family pick)", "Backtest + score", "Elo match vs champion", "Commit brain/state.json", "Site reads state"], caption: "One Brain run, every 6 hours on GitHub Actions. The holdout is computed only for display." },
      ],
      reproduce: [
        { kind: "steps", items: ["cd portfolio && npm ci", "node --experimental-strip-types scripts/research.ts   # regenerates src/lab/research.json", "node --experimental-strip-types scripts/lab-check.ts  # look-ahead, cost, simplex and holdout-isolation checks", "node --experimental-strip-types scripts/brain-run.ts --state /tmp/s.json --data src/lab/weekly.json --generations 24"] },
      ],
      problem: [{ kind: "p", text: "Allocators are shown backtests that were tuned on the data they report. This project separates selection from evaluation, prices in costs, and reports what survives." }],
    },
  },
  "deal-lab": {
    kind: "Underwriting · single-deal analysis",
    order: ["summary", "question", "results", "method", "data", "validation", "architecture", "work", "limitations", "reproduce", "problem", "links"],
    sections: {
      summary: [{ kind: "p", text: "An audit and rebuild of an Ohio wholesale deal analyzer. v1 left the end buyer's selling, closing and holding costs out, never applied its own 15% rehab contingency, and tested a 15% buyer margin while its note said 20%. On v1's own example it said GO; v2 says NO-GO." }],
      question: [{ kind: "p", text: "Should the wholesaler contract this property at $60,000, and at what price does the deal still work for the end buyer?" }],
      results: [{ kind: "module", id: "deal-result" }, { kind: "module", id: "deal-sim" }],
      method: [
        { kind: "formula", text: "MAO = 70% × ARV − rehab × (1 + 15% contingency) − assignment fee" },
        { kind: "formula", text: "Buyer margin = (ARV − contract − fee − rehab × 1.15 − 10% × ARV) / ARV,  minimum 20%" },
        { kind: "list", items: ["Monte Carlo: ARV ~ N(ARV, 8%), rehab overrun ~ N(10%, 15%) floored at −10%, 70% close rate, half the EMD lost on a fall-through.", "Max-price solver: bisection on contract price until the deal works in a target share of outcomes."] },
      ],
      data: [{ kind: "table", head: ["Input", "Value"], rows: [["ARV", "$160,000"], ["Rehab", "$40,000 (+15% contingency)"], ["Contract", "$60,000"], ["Assignment fee", "$10,000"], ["Buyer costs", "10% of ARV"], ["Minimum buyer margin", "20%"]], caption: "Illustrative inputs from the v2 workbook, not a live deal feed." }],
      validation: [{ kind: "list", items: ["lab-check.ts ties the web model's MAO, margin, expected profit and signal to the workbook's formulas before every deploy.", "The workbook's 1,000-trial Monte Carlo was cross-checked against a 200,000-trial Python simulation (≈29% profitable)."] }],
      architecture: [{ kind: "flow", nodes: ["Deal inputs", "MAO + buyer margin", "GO / NO-GO", "Monte Carlo", "Max-price solver"] }],
      reproduce: [{ kind: "steps", items: ["Open /deal/ and change any input.", "Or: portfolio/src/deal/model.ts — analyze(DEAL_DEFAULTS), simulate(DEAL_DEFAULTS, 5000, 7)", "Workbook: projects/deal-analyzer/build_analyzer.py builds Wholesale_Deal_Analyzer_v2.xlsx"] }],
    },
  },
  "twin-engine": {
    kind: "Product engineering · decision dashboard",
    order: ["summary", "problem", "architecture", "work", "method", "data", "validation", "limitations", "reproduce", "question", "results", "links"],
    sections: {
      summary: [{ kind: "p", text: "A concept command center for a two-market real-estate platform (US buy-fix-rent-refinance, India flips), built in Next.js and TypeScript. An audit found a 16.8% IRR typed in with nothing behind it; the rebuild computes every figure from the property records and leaves IRR blank until dated cash flows exist." }],
      problem: [{ kind: "p", text: "A principal running two very different property engines needs one screen for equity, value-add, exits and bookkeeping compliance, and needs to trust that each number is computed, not typed." }],
      architecture: [{ kind: "flow", nodes: ["lib/data.ts (sample records)", "lib/metrics.ts", "app/page.tsx (server component)", "DashboardLayout", "render-preview.ts → preview.html"] }],
      method: [{ kind: "list", items: ["Equity by market, gross value-add, realised exit multiple, renovation share and a Clean Books compliance index, each a function of the records.", "IRR is withheld rather than estimated."] }],
      data: [{ kind: "note", tone: "warn", text: "Illustrative sample data, labelled as such on the page. Not real holdings." }],
      validation: [{ kind: "list", items: ["The preview generator asserts its numbers when it regenerates the static page."] }],
      results: [{ kind: "p", text: "On the sample data: equity $4.2M and a 1.56× realised exit multiple. These describe the sample, not a real portfolio." }],
      reproduce: [{ kind: "steps", items: ["cd projects/twin-engine-dashboard", "Read README.md for the file tree; scripts/render-preview.ts regenerates preview.html"] }],
    },
  },
  sentinel: {
    kind: "Risk research · insurance pricing",
    sections: {
      summary: [{ kind: "p", text: "Market and actuarial research on what AI failures have cost: 29 public loss claims graded A–D by source quality, a 60,000-trial viability simulation and a 400,000-simulation frequency-severity pricing model." }],
      problem: [{ kind: "p", text: "Insurers asked to cover AI failures have no loss history to price from. Public claims exist but vary wildly in reliability." }],
      question: [{ kind: "p", text: "Is AI-liability cover viable, and what premium range does the evidence support once low-quality claims are kept out of the base case?" }],
      data: [{ kind: "p", text: "29 public loss claims, each graded A–D by source quality before it can feed a number. Low-grade claims are kept for context but excluded from the base case." }],
      method: [{ kind: "list", items: ["Frequency-severity Monte Carlo for premium ranges (400,000 simulations).", "A 60,000-trial viability model.", "Generated pages: no figure on the site is hand-typed; a harness checks it."] }],
      architecture: [{ kind: "flow", nodes: ["Loss claims", "Source grading A–D", "Base-case filter", "Frequency-severity simulation", "Pricing + viability", "Generated pages"] }],
      validation: [{ kind: "note", tone: "info", text: "Not verified in this audit: the assertion harness (332 assertions claimed) was not re-run." }],
    },
  },
  jarvis: {
    kind: "AI systems · agents with guardrails",
    order: ["summary", "problem", "architecture", "validation", "work", "method", "data", "limitations", "reproduce", "question", "results", "links"],
    sections: {
      summary: [{ kind: "p", text: "A personal assistant in two parts: a Python service on the owner's Mac (local model via Ollama, voice, confirmation-gated actions, an action ledger and a false-claim guard) and the in-browser agent on this site (retrieval over one brief, citations, voice)." }],
      problem: [{ kind: "p", text: "Assistants that act for someone fail worst when they say they did something they didn't. Every action here is allow-listed, schema-validated, risk-levelled, timed out and audited, and a reply claiming a change is corrected unless the change actually succeeded." }],
      architecture: [
        { kind: "flow", nodes: ["Voice / text", "Agent loop", "Allow-listed tools (risk 0–3)", "Confirmation for level 2–3", "Action ledger + audit log", "False-claim guard", "Reply"], caption: "Owner service. The public site never gets a route to the Mac: the gateway binds 127.0.0.1 and needs a pairing token and an allow-listed origin." },
      ],
      validation: [
        { kind: "module", id: "ci-runs" },
        { kind: "list", items: ["The site's deploy is gated by the recruiter eval (scripts/eval.ts): a failing case stops the release.", "In CI the Python eval runs with a fake backend and a minimum pass rate of 0, so CI checks that it runs, not how well it answers."] },
      ],
      method: [{ kind: "list", items: ["Retrieval over one knowledge brief shared by the site and the service, so both answer from the same facts.", "Tools: allow-listed, JSON-schema-validated locally, risk-levelled 0–3, timed out and audited."] }],
      data: [{ kind: "p", text: "jarvis/knowledge/brief.md and an eval set of recruiter and principal questions (jarvis/knowledge/eval_cases.toml)." }],
      reproduce: [{ kind: "steps", items: ["cd jarvis && python3.12 -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'", "make check   # ruff, ruff format, mypy, pytest", "cd ../portfolio && npm run -s eval"] }],
    },
  },
  "high-properties": {
    kind: "Full-stack product · lead generation",
    order: ["summary", "problem", "architecture", "validation", "work", "data", "method", "limitations", "reproduce", "question", "results", "links"],
    sections: {
      summary: [{ kind: "p", text: "A lead-generation platform for a real-estate business: public listings, enquiry capture, WhatsApp follow-up and a staff admin console, on Vercel serverless functions and Supabase." }],
      problem: [{ kind: "p", text: "A small team loses enquiries between the listing, the phone and the spreadsheet. One system captures the lead, follows up on WhatsApp and gives staff a console to manage listings and leads." }],
      architecture: [{ kind: "flow", nodes: ["Public listings page", "Enquiry form", "Serverless API (/api/*)", "Supabase (service role, server only)", "WhatsApp follow-up", "Admin console (session + role)"] }],
      validation: [
        { kind: "list", items: ["Authorization is checked inside the handlers, not only in the browser: in this repository's copy, admin.js calls requireRole(req, res, 'admin' | 'staff') at the top of all seven actions, and save, delete, export and import require 'admin'. requireRole itself lives in lib/auth.js, which this copy doesn't include, so its session check was not reviewed.", "db.js uses the Supabase service-role key only on the server and documents that it must never reach the browser.", "vercel.json sets a Content-Security-Policy, HSTS, nosniff, frame and referrer headers, and no-store on /api/*."] },
        { kind: "note", tone: "warn", text: "Not verified: the deployed Vercel functions, environment and Supabase row-level-security policies were not inspected. The copy here imports ../lib/*, which isn't in this repository, so it can't be run or tested from here." },
      ],
      data: [{ kind: "p", text: "Listings and leads in Supabase. Production data was not inspected." }],
      reproduce: [{ kind: "steps", items: ["See README-DEPLOY-VERCEL.md at the repository root and the public High-Properties repository."] }],
    },
  },
};
