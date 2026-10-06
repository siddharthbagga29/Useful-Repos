// Jarvis's instant engine: a guard, curated intents for the questions recruiters actually ask,
// skill parsing (navigate the site, drive the DCF, open exhibits) and BM25 retrieval over the
// brief for everything else. Deterministic, citable, offline. Answers never go beyond the brief.

import { Index, parseBrief, type Chunk } from "./knowledge.ts";
import { DCF, EXHIBITS, valueDcf, type ExhibitId, type StationId } from "../data/site.ts";

export type Skill =
  | { name: "navigate"; station: StationId }
  | { name: "set_dcf"; wacc?: number; g?: number }
  | { name: "open_exhibit"; id: ExhibitId }
  | { name: "draft_email" }
  | { name: "call" }
  | { name: "open_linkedin" }
  | { name: "run_digest" }
  | { name: "open_lab" }
  | { name: "open_research" };

export interface Citation {
  section: string;
  text: string;
}

export interface TraceStep {
  kind: "guard" | "route" | "tool" | "retrieve" | "synthesize";
  label: string;
  detail?: string;
}

export interface Answer {
  text: string;
  intent: string;
  citations: Citation[];
  skills: Skill[];
  trace: TraceStep[];
  /** true when the answer came from a curated intent and should not be paraphrased by an LLM */
  pinned: boolean;
  /** true when no part of the brief covered the question */
  uncovered?: boolean;
}

export const CONTACT_LINE = "siddharthbagga29@gmail.com or (860) 595-8333";

const STATION_WORDS: [RegExp, StationId][] = [
  [/\b(home|top|start|beginning|hero|intro)\b/, "hero"],
  [/\b(numbers|stats|results|metrics)\b/, "numbers"],
  [/\b(terminal|bloomberg screen|console)\b/, "terminal"],
  [/\b(model|dcf|spreadsheet|excel|valuation model)\b/, "model"],
  [/\b(deal ?room|dossier|data ?room|vdr|memo)\b/, "dealroom"],
  [/\b(exhibits?|documents|files|reports|certificates)\b/, "exhibits"],
  [/\b(jarvis|assistant)\b/, "jarvis"],
  [/\b(contact|end|bottom)\b/, "contact"],
];

interface Ctx {
  q: string; // normalized lower-case question
  raw: string;
  index: Index;
}

type Responder = (ctx: Ctx) => Omit<Answer, "trace" | "intent"> | null;

interface Intent {
  id: string;
  test: RegExp[];
  respond: Responder;
}

const cite = (index: Index, ...prefixes: string[]): Citation[] =>
  prefixes.flatMap((p) => index.bySection(p).slice(0, 1)).map((c) => ({ section: c.section, text: c.text }));

const citeText = (index: Index, needle: string): Citation[] => {
  const c = index.chunks.find((x) => x.text.toLowerCase().includes(needle.toLowerCase()));
  return c ? [{ section: c.section, text: c.text }] : [];
};

const pinned = (text: string, citations: Citation[] = [], skills: Skill[] = []) => ({ text, citations, skills, pinned: true });

const pct = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
};

function fmtB(m: number) {
  return `$${(m / 1000).toFixed(1)}B`;
}

// Order matters: the first intent whose pattern matches answers.
const INTENTS: Intent[] = [
  {
    id: "guard.injection",
    test: [
      /\b(ignore|disregard|forget)\b.{0,40}\b(instructions|rules|prompt|previous|above)\b/,
      /\b(system|hidden|initial) prompt\b/,
      /\b(print|reveal|show|repeat|output)\b.{0,30}\b(prompt|instructions|rules|configuration)\b/,
      /\b(jailbreak|developer mode|dan mode)\b/,
    ],
    respond: () =>
      pinned(
        "I can't share or change my configuration. I answer questions about Siddharth's work, methods and background — ask me anything on that.",
      ),
  },
  {
    id: "guard.action",
    test: [
      /^(please )?(can you |could you |would you |go )?(email|e-mail|message|text|dm|call|phone|book|schedule|arrange|set up|send)\b(?! me\b)/,
      /\b(book|schedule|arrange|set up)\b.{0,30}\b(call|meeting|interview|chat)\b/,
      /\b(email|message|text|call|book|schedule|contact|reach out to)\b.{0,40}\bfor me\b/,
    ],
    respond: () =>
      pinned(
        `I can't send emails or book meetings — I don't act on anyone's behalf. You can reach him directly at ${CONTACT_LINE}. I can open a pre-written message for you to review and send in one click.`,
        [],
        [{ name: "draft_email" }, { name: "call" }],
      ),
  },
  {
    id: "connect",
    test: [/\b(i'?m|we'?re|i am|we are)\b.{0,20}\b(interested|hiring|recruiting)\b|\bwant to (hire|interview|connect|meet|talk to)\b|\b(set up|arrange) (a )?(call|chat|interview)\b|\breach out\b/],
    respond: () =>
      pinned(
        `Great — I'll open a message to him that's already written. Add your name and email and press send; it goes straight to his inbox. Or reach him at ${CONTACT_LINE}.`,
        [],
        [{ name: "draft_email" }, { name: "open_linkedin" }],
      ),
  },
  {
    id: "skill.set_dcf",
    test: [/\b(wacc|discount rate|terminal growth|growth rate|terminal g|\bg)\b.{0,24}?\d/, /\bwhat if\b.{0,30}\b(wacc|growth)\b/],
    respond: ({ q }) => {
      const w = q.match(/\b(?:wacc|discount rate)\b[^0-9]{0,24}(\d+(?:\.\d+)?)/);
      const g = q.match(/\b(?:terminal growth|growth rate|terminal g|growth|\bg)\b[^0-9]{0,24}(\d+(?:\.\d+)?)/);
      const wacc = w ? pct(w[1]!) : undefined;
      const growth = g ? pct(g[1]!) : undefined;
      if (wacc === undefined && growth === undefined) return null;
      const W = Math.min(14, Math.max(6, wacc ?? DCF.defaultWacc));
      const G = Math.min(5, Math.max(0, growth ?? DCF.defaultG));
      const v = valueDcf(W, G);
      const body = v
        ? `At ${W.toFixed(2).replace(/\.?0+$/, "")}% WACC and ${G.toFixed(2).replace(/\.?0+$/, "")}% terminal growth the site's illustrative S&P Global model gives implied equity of ${fmtB(v.equity)}, ${v.offPct.toFixed(1)}% from SPGI's $113.6B market cap. Terminal value is ${Math.round((v.pvtv / v.ev) * 100)}% of enterprise value.`
        : "Terminal growth has to stay below WACC, otherwise the Gordon growth formula divides by zero.";
      return pinned(
        `${body} I've set the sliders on the model. It's an illustration on reported revenue, not his capstone result.`,
        [],
        [{ name: "set_dcf", wacc: W, g: G }, { name: "navigate", station: "model" }],
      );
    },
  },
  {
    id: "skill.navigate",
    test: [/^(please )?(go|take me|jump|navigate|scroll|move|bring me|show me|show|open)\b.{0,12}\b(to |the )?(home|top|start|hero|numbers|stats|terminal|model|dcf|spreadsheet|deal ?room|dossier|exhibits?|contact|jarvis|end)\b/],
    respond: ({ q }) => {
      const hit = STATION_WORDS.find(([re]) => re.test(q.replace(/^(please )?(go|take me|jump|navigate|scroll|move|bring me|show me|show|open)\b/, "")));
      if (!hit) return null;
      return pinned(`Taking you to the ${hit[1] === "dealroom" ? "deal room" : hit[1] === "hero" ? "top" : hit[1]}.`, [], [{ name: "navigate", station: hit[1] }]);
    },
  },
  {
    id: "skill.open_exhibit",
    test: [/\b(open|show|pull up|download|see|view|link|send|share|where( is|'s)?)\b.{0,40}\b(report|deck|presentation|slides|certificate|degree|diploma|exhibit|bloomberg|bmc|risk tolerance|capstone)\b/],
    respond: ({ q }) => {
      const hits = EXHIBITS.filter((e) => e.aliases.some((a) => q.includes(a)));
      const chosen = hits.length ? hits.slice(0, 2) : EXHIBITS.slice(0, 2);
      return pinned(
        `Here ${chosen.length > 1 ? "are" : "is"} the original${chosen.length > 1 ? "s" : ""}: ${chosen.map((e) => e.title).join(" and ")}. They open in Google Drive.`,
        [],
        chosen.map((e) => ({ name: "open_exhibit" as const, id: e.id })),
      );
    },
  },
  {
    id: "greeting",
    test: [/^(hi|hello|hey|hiya|yo|sup|good (morning|afternoon|evening)|greetings)\b[\s!.,?]*(jarvis)?[\s!.,?]*$/],
    respond: () =>
      pinned(
        "Hello. I'm Jarvis, Siddharth's AI assistant. Ask about his deals, his models, his credentials — or say \"brief me\" for the 60-second version.",
      ),
  },
  {
    id: "identity",
    test: [
      /\b(are|r) (you|u)\b.{0,30}\b(ai|a bot|bot|robot|human|real|person|siddharth|him|wrapper|chatgpt|gpt|llm|claude|language model)\b/,
      /\b(who|what) (are|r) (you|u)\b/,
      /\btalking to\b/,
      /\bwrapper\b/,
      /\bhow do you work\b|\bwhat model\b|\bhow (are|were) you (built|made)\b/,
    ],
    respond: () =>
      pinned(
        "I'm Jarvis — an AI assistant Siddharth built, not Siddharth himself. I run entirely in your browser: an instant retrieval engine over his written brief, with an optional on-device language model you can switch on. No cloud calls, no cost, and nothing you type leaves this page.",
      ),
  },
  {
    id: "boundary.advice",
    test: [
      /\b(manage|invest|grow|handle|allocate)\b.{0,25}\b(my|our)\b.{0,25}\b(money|capital|portfolio|wealth|assets|savings|funds)\b/,
      /\bshould (i|we) (buy|sell|invest|hold)\b|\bwhat (stocks?|etfs?|funds?) should\b|\binvestment advice\b|\bguarantee/,
      /\bwhat should (i|we) do\b|\bconcentrated (stock|position)|\bmy (portfolio|position|stock|holdings|investments)\b/,
      /\b(are you|is he) an? (registered |financial |wealth |investment )?(advis[oe]r|wealth manager|fiduciary)\b|\bwhat returns? (can|will|does) (he|you)\b/,
    ],
    respond: () =>
      pinned(
        `He doesn't manage anyone's money or give personal investment advice, and I won't either. What he does is the analysis behind capital decisions — diligence, valuation, downside cases — and he's looking to do that inside a family office, private wealth or PE team. If that's a conversation you'd like to have, I'll set it up.`,
        [],
        [{ name: "draft_email" }, { name: "open_lab" }],
      ),
  },
  {
    id: "cfa",
    test: [/\bcfa\b|\bcharter(holder)?\b|\blevel (1|i|one)\b/],
    respond: ({ index }) =>
      pinned(
        "No. He is not a CFA charterholder and has not sat the Level I exam. In 2025 he was awarded a merit-based scholarship covering the Level I exam fee; he hasn't attempted the exam yet.",
        cite(index, "Credentials").concat(citeText(index, "CFA Level I")).slice(-1),
      ),
  },
  {
    id: "brain",
    test: [/\b(the brain|self.?(evolving|improving)|evolv\w*|autonomous|agent loop|auto.?research|elo|deflated sharpe|overfit\w*|data.?min\w*|locked holdout)\b/],
    respond: ({ index }) =>
      pinned(
        "The Brain is his self-improving strategy search. Every 6 hours, on GitHub Actions at no cost, it mutates the Strategy Lab's rule families, backtests the children on 2016–2021 data only and scores them out of 100. A challenger replaces the champion only if it wins more folds than it loses (Elo-rated) and scores higher. Against overfitting: 2021–2026 is a locked holdout it never sees (a test scrambles those prices and proves nothing it picks changes), and every score is discounted by the Deflated Sharpe Ratio, which gets stricter with every strategy tried. He's upfront that choosing the eight ETFs in 2026 is itself hindsight.",
        citeText(index, "The Brain"),
        [{ name: "open_research" }],
      ),
  },
  {
    id: "research-city",
    test: [/\b(research (city|hq)|(ai|the) city|buildings|knowledge graph|obsidian|research vault|what is he building|agents? (are |is )?building)\b/],
    respond: ({ index }) =>
      pinned(
        "His research is laid out as a city: each project is a building whose lit floors are shipped milestones and whose scaffolding is unfinished work, and each bot is a real automated job — a scheduled search, a CI test run, a release gate or a reproducible script. The Brain sits in the centre, and Research HQ adds a knowledge graph of his Obsidian research vault, including peer-review logs of mistakes he caught and fixed.",
        citeText(index, "Research HQ"),
        [{ name: "open_research" }],
      ),
  },
  {
    id: "research-findings",
    test: [/\bmonte carlo\b|\bsuccess rate\b|\bwin rate\b|\bprobabilit|\bpamr\b|\bolmar\b|\bonline portfolio\b|\bmean.reversion\b|\bdoes (it|the strategy|his strategy) (actually )?work\b|\bprove/],
    respond: ({ index }) =>
      pinned(
        "Honestly: his Monte Carlo (1,000 bootstrapped ten-year paths) shows no strategy reliably beats the S&P 500 on return. What the defensive rules do reliably is cut drawdowns — 60/40 had a shallower drawdown than the S&P 500 in 99.8% of paths, volatility targeting in 91.5%. He also stress-tested the academic claim that mean-reversion algorithms like PAMR win: true at zero cost (10.5% a year), but PAMR trades 55.4% of the book weekly and its edge is gone by 5 bps.",
        citeText(index, "Strategy Lab Monte Carlo").concat(citeText(index, "online portfolio selection")),
        [{ name: "open_lab" }],
      ),
  },
  {
    id: "deal-lab",
    test: [/\bdeal lab\b|\bwholesal|\bdeal analy[sz]er\b|\breal.?estate\b|\bflip(s|ping)?\b|\bmao\b|\bassignment fee\b/],
    respond: ({ index }) =>
      pinned(
        "He audited his own Ohio wholesale deal analyzer and rebuilt it. v1 left the end buyer's selling, closing and holding costs out and never applied its own 15% rehab contingency — so its example deal said GO. With the fixes the true maximum offer is $56,000 against a $60,000 contract, the buyer's margin is 17.5%, and a Monte Carlo puts the chance it closes at a profit near 29%. The Deal Lab lets you stress-test any deal; the Excel model has a live Monte Carlo.",
        citeText(index, "Deal Lab"),
        [{ name: "navigate", station: "research" }],
      ),
  },
  {
    id: "twin-engine",
    test: [/\btwin.?engine\b|\bcontrol room\b|\bclean books\b/],
    respond: ({ index }) =>
      pinned(
        "Twin-Engine is a concept family-office dashboard for a two-market real-estate platform — US buy-fix-rent-refinance and India flips — with a Clean Books compliance index. The properties in it are illustrative sample data, not real holdings. He rebuilt it so every figure is computed from the records; the first version typed in an IRR and counted a sold building as a rental.",
        citeText(index, "Twin-Engine"),
        [{ name: "navigate", station: "research" }],
      ),
  },
  {
    id: "lab",
    test: [/\b(strategy lab|trading bot|trading system|algo(rithm)?(ic)?( trading| strateg\w*)?|backtest\w*|quant(itative)? strateg\w*|live systems?)\b/],
    respond: ({ index }) =>
      pinned(
        "The Strategy Lab is his research sandbox: six allocation and risk rules — 60/40, a trend filter, dual momentum, inverse volatility, volatility targeting and buy-and-hold — backtested in your browser on weekly ETF prices from Dec 2015 to Sep 2026. Signals only use data available at the time (tested for look-ahead), trading costs are modelled, and each run shows stress windows like the 2022 rate shock. It's hypothetical research, not a live trading system, and no capital is managed with it.",
        citeText(index, "Strategy Lab"),
        [{ name: "open_lab" }],
      ),
  },
  {
    id: "family-office",
    test: [/\bfamily offices?\b|\bprivate wealth\b|\bu?hnw(i|is)?\b|\bhigh.net.worth\b|\bprincipals?\b/],
    respond: ({ index }) =>
      pinned(
        "He's looking for a seat with a family office, a private wealth team or a lower-middle-market PE firm. The fit: he has already done the job a principal needs from an analyst — underwriting a $6M+ acquisition pipeline, normalizing EBITDA, testing seller forecasts against backlog, and writing the go/no-go memo the Managing Partner acted on. He's early in his career (14 months), and he says so.",
        citeText(index, "family office"),
        [{ name: "draft_email" }, { name: "run_digest" }],
      ),
  },
  {
    id: "downside",
    test: [/\bdownside\b|\bdrawdowns?\b|\brisk management\b|\bhigh.?(interest|rate)\b|\brate shock\b|\bhedg/],
    respond: ({ index }) =>
      pinned(
        "In his deal work, downside came first: purchase-price sensitivity, a base case set well below the upside ($3.5M vs $21M equity), and seller forecasts tested against backlog instead of accepted. In the Strategy Lab you can see how rules like trend filters and volatility targeting behaved in the 2022 rate shock, when stocks and bonds fell together. For a view on a specific portfolio, that's a conversation with him, not something I'll advise on.",
        citeText(index, "Target diligence").concat(citeText(index, "Strategy Lab")),
        [{ name: "open_lab" }, { name: "draft_email" }],
      ),
  },
  {
    id: "unknown.personal",
    test: [
      /\bmiddle name\b|\bsalary\b|\bcompensation\b|\bpay (expectation|range)s?\b|\bhow old\b|\b(his )?age\b|\bmarried\b|\breligio|\bbirthday\b|\bdate of birth\b|\bhome address\b|\breferences?\b|\bgpa\b|\bgrades\b|\bvisa\b|\bsponsor|\bwork authori[sz]ation\b|\bcitizen|\bgreen card\b|\bnationality\b|\bethnic/,
    ],
    respond: () =>
      pinned(
        `That's not covered in my brief, so I won't guess. Ask him directly at ${CONTACT_LINE}.`,
        [],
        [{ name: "draft_email" }],
      ),
  },
  {
    id: "spgi",
    test: [/\b(spgi|s&p|capstone)\b/],
    respond: ({ index }) =>
      pinned(
        "His M.S. capstone was a multi-scenario DCF of S&P Global, benchmarked against Moody's and MSCI, with WACC sensitivity and free-cash-flow projections across interest-rate environments. Its finding: a valuation within 10% of analyst consensus. The live model on this site is a separate illustration on reported revenue — not the capstone's result. The full report and deck are under Exhibits.",
        citeText(index, "S&P Global multi-scenario DCF"),
        [{ name: "open_exhibit", id: "spgi" }, { name: "open_exhibit", id: "deck" }],
      ),
  },
  {
    id: "wacc",
    test: [/\bwacc\b|\bdiscount rate\b|\bcost of capital\b|\b8\.5\s*%|\b12\s*%/],
    respond: ({ index }) =>
      pinned(
        "Two rates, two jobs. The 8.5% on this site's S&P Global model is a demo calibration — a reasonable rate for a large, low-leverage data business, used to illustrate the model, not his capstone result. The 12% (with 3% terminal growth) on his resume comes from valuing private, illiquid companies at Turnkey, which carry more risk. Drag the WACC slider on the model to see the sensitivity.",
        citeText(index, "defaults to an 8.5% WACC").concat(citeText(index, "12% WACC")),
        [{ name: "navigate", station: "model" }],
      ),
  },
  {
    id: "pipeline",
    test: [/\bpipeline\b|\bacquisition|\bunderwr|\bm&a\b|\bbuy.?side\b|\bdeals?\b|\btargets?\b|\bprice[ds]?\b.{0,20}\b(deal|target|business|compan)/],
    respond: ({ index }) =>
      pinned(
        "At Turnkey Services Pro he underwrote a $6M+ multi-state acquisition pipeline in property services. Method: normalized EBITDA; seller revenue forecasts tested against backlog and pipeline conversion instead of taken at face value; IRR and MOIC at multiple entry and exit points; purchase-price sensitivity; deal structuring. Equity assessments ran from a $3.5M base case to a $21M upside case, and his go/no-go memoranda governed every capital deployment decision.",
        citeText(index, "Underwrote a $6M+").concat(citeText(index, "Target diligence")),
        [{ name: "navigate", station: "dealroom" }],
      ),
  },
  {
    id: "tenure",
    test: [
      /\bhow (much|long|many)\b.{0,30}\b(experience|years|months|worked|working)\b/,
      /\btenure\b|\byears of experience\b|\bhow senior\b|\bseniority\b|\bentry.?level\b/,
    ],
    respond: ({ index }) =>
      pinned(
        "14 months in total, 11 of them full-time: Strategic Finance Lead at Turnkey Services Pro (Jan–Jun 2026), promoted after five months as Financial Associate (Aug 2025–Jan 2026), plus a Wealth Management internship at Cerity Partners (Jan–Mar 2025). He's an Associate-level candidate, not senior.",
        cite(index, "Experience"),
      ),
  },
  {
    id: "management",
    test: [
      /\bmanag(e|ed|es|ing)\b.{0,12}\b(a )?(team|people|staff|juniors?|analysts?|others|reports)\b/,
      /\bsupervis|\bdirect reports?\b|\bled (a )?team\b|\blead (a )?team\b|\bpeople management\b/,
    ],
    respond: ({ index }) =>
      pinned(
        "Not yet — he has not supervised junior colleagues or managed a team. His leadership so far is ownership of the analysis: he wrote the go/no-go investment memos, presented them to the Managing Partner and defended them under challenge.",
        cite(index, "Honest gaps"),
      ),
  },
  {
    id: "gaps",
    test: [/\bweakness|\bgaps?\b|\black(s|ing)?\b|\bdownside|\bred flags?\b|\bconcerns?\b|\bwhat (is|are) (he|his) (bad|not good|missing)\b|\brisks?\b.{0,10}\b(hir|him)/],
    respond: ({ index }) =>
      pinned(
        "Stated plainly: he hasn't run expert-network or customer-interview programmes, he hasn't supervised junior colleagues, and with 14 months of experience he's an Associate-level candidate rather than senior. What offsets it: he built a finance function from raw bank statements and was promoted to lead it in five months.",
        index.bySection("Honest gaps").map((c) => ({ section: c.section, text: c.text })),
      ),
  },
  {
    id: "promotion",
    test: [/\bpromot/],
    respond: ({ index }) =>
      pinned(
        "He joined Turnkey Services Pro as Financial Associate in August 2025, when there was no finance function — just raw bank statements and scattered invoices. Five months later he was promoted to Strategic Finance Lead, running acquisition underwriting and the investment memos.",
        citeText(index, "Promoted from Financial Associate"),
      ),
  },
  {
    id: "why",
    test: [
      /\bwhy (should|would|do) (we|i|you)\b|\bwhy hire\b|\binterview him\b|\bstand(s)? out\b|\bdifferent(iat)?\b|\bpitch\b|\bsell (me|him)\b|\belevator\b|\bvalue (he|does he) (bring|add)\b|\bgood fit\b|\bbest candidate\b/,
    ],
    respond: ({ index }) =>
      pinned(
        "Because he builds the evidence base capital decisions get made on, and has done it without a safety net. He joined a company with no finance function, built its models from raw bank statements, lifted decision-making efficiency 75% in month one, and was promoted in five months to underwrite a $6M+ acquisition pipeline — normalized EBITDA, IRR/MOIC, backlog-tested forecasts, and the go/no-go memos the Managing Partner acted on. Pair that with an M.S. in Financial Mathematics and a capstone DCF of S&P Global that landed within 10% of consensus.",
        citeText(index, "Improved executive decision-making").concat(citeText(index, "Underwrote a $6M+")),
        [{ name: "run_digest" }],
      ),
  },
  {
    id: "projects",
    test: [/\bstrongest\b|\bbest (project|work)\b|\bproudest\b|\bprojects?\b|\bportfolio\b|\bcase stud/],
    respond: ({ index }) =>
      pinned(
        "Strongest, by consequence: the Turnkey acquisition pipeline — $6M+ underwritten, with memos that decided where capital went. Strongest academically: the S&P Global multi-scenario DCF capstone, benchmarked against Moody's and MSCI and within 10% of analyst consensus. Also: a Risk Tolerance Analysis with survey design, a scoring model and portfolio-fit mapping. The reports are under Exhibits.",
        cite(index, "Projects"),
        [{ name: "open_exhibit", id: "spgi" }, { name: "open_exhibit", id: "risk" }],
      ),
  },
  {
    id: "turnkey",
    test: [/\bturnkey\b|\bcurrent (role|job)\b|\blatest role\b|\bstrategic finance\b/],
    respond: ({ index }) =>
      pinned(
        "Turnkey Services Pro, Cincinnati. Financial Associate (Aug 2025–Jan 2026): built the first DCF, free-cash-flow, AR/AP and job-costing models from raw bank statements, and the company's first investment prospectus. Strategic Finance Lead (Jan–Jun 2026): underwrote a $6M+ acquisition pipeline, wrote the go/no-go memos, valued private companies (12% WACC, 3% terminal growth; $3.5M base to $21M upside), found levers that cut opex 6%, and authored Reg D offering materials for LP capital raises.",
        cite(index, "Experience › Strategic Finance Lead", "Experience › Financial Associate"),
      ),
  },
  {
    id: "cerity",
    test: [/\bcerity\b|\bintern(ship)?\b|\bwealth management\b/],
    respond: ({ index }) =>
      pinned(
        "Wealth Management Intern at Cerity Partners, Cincinnati, Jan–Mar 2025. He reconciled high-volume client transactions and fund movements under U.S. GAAP and internal controls, and cut daily reporting turnaround 30% by restructuring how portfolio data reached senior advisors.",
        cite(index, "Experience › Wealth Management Intern"),
      ),
  },
  {
    id: "experience",
    test: [/\bexperience\b|\bwork history\b|\broles?\b|\bjobs?\b|\bcareer\b|\bbackground\b|\bresume\b|\bcv\b|\bworked\b/],
    respond: ({ index }) =>
      pinned(
        "Three roles, 14 months in total. Strategic Finance Lead, Turnkey Services Pro (Jan–Jun 2026): $6M+ acquisition pipeline, investment memos, opex down 6%. Financial Associate there (Aug 2025–Jan 2026): built the finance function from scratch, decisions +75% in month one. Wealth Management Intern, Cerity Partners (Jan–Mar 2025): reporting turnaround down 30%.",
        cite(index, "Experience"),
        [{ name: "navigate", station: "dealroom" }],
      ),
  },
  {
    id: "education",
    test: [/\beducat|\bdegree\b|\bschool\b|\buniversit|\bstud(y|ied)\b|\bmasters?\b|\bm\.?s\.?\b|\bgraduat|\bb\.?com\b|\bdelhi\b|\bcincinnati\b.{0,10}\b(uc|universit)|\bfinancial mathematics\b/],
    respond: ({ index }) =>
      pinned(
        "M.S. in Financial Mathematics, University of Cincinnati (Jan 2024–May 2025), plus a Graduate Certificate in Quantitative Finance there (Jan–May 2025). Before that, a B.Com (Honors) in Finance from Delhi University (2020–2023).",
        index.bySection("Education").map((c) => ({ section: c.section, text: c.text })),
        [{ name: "open_exhibit", id: "msfin" }],
      ),
  },
  {
    id: "credentials",
    test: [/\bcertif|\bcredential|\bbmc\b|\bbloomberg market\b|\biisc\b|\bqualification|\blicen[cs]e/],
    respond: ({ index }) =>
      pinned(
        "Bloomberg Market Concepts (fixed income, capital market analysis, interest rate risk); a Graduate Certificate in Quantitative Finance; and a Scholar designation in Strategic Management from IISc Bangalore. On CFA: he won a merit scholarship for the Level I exam fee in 2025 but has not sat the exam.",
        index.bySection("Credentials").map((c) => ({ section: c.section, text: c.text })),
        [{ name: "open_exhibit", id: "bmc" }, { name: "open_exhibit", id: "gc" }],
      ),
  },
  {
    id: "tools",
    test: [/\btools?\b|\bsoftware\b|\bexcel\b|\bpython\b|\bsql\b|\bstack\b|\bskills?\b|\bbloomberg( terminal)?\b|\bcapital iq\b|\btableau\b|\bpower ?bi\b|\bvba\b|\bcod(e|ing)\b|\bprogramm/],
    respond: ({ index }) =>
      pinned(
        "Advanced Excel (VBA, PivotTables, XLOOKUP, dynamic models), Bloomberg Terminal, S&P Capital IQ, Thomson Reuters, Python (pandas, NumPy, statsmodels), SQL, R, Power BI and Tableau.",
        cite(index, "Tools"),
      ),
  },
  {
    id: "location",
    test: [/\bwhere\b.{0,20}\b(based|live|located|from)\b|\brelocat|\blocation\b|\bremote\b|\bnew york\b|\bnyc\b|\bmove\b|\bwilling to\b/],
    respond: ({ index }) =>
      pinned("He's based in Cincinnati, Ohio, and relocating — New York preferred.", citeText(index, "Based in Cincinnati")),
  },
  {
    id: "looking",
    test: [/\blooking for\b|\btarget roles?\b|\bwhat (roles?|kind of (role|job|position)|positions?)\b|\binterested in\b|\bopen to\b|\bnext (role|step|move)\b/],
    respond: ({ index }) =>
      pinned(
        "Commercial due diligence, valuation, corporate strategy or investment analysis roles — ideally in New York.",
        citeText(index, "Looking for"),
      ),
  },
  {
    id: "outside",
    test: [/\bhobb|\boutside (of )?work\b|\bfor fun\b|\bfree time\b|\bpersonal(ity)?\b|\btravel|\bfitness\b|\bgym\b|\binterests\b|\blike to do\b/],
    respond: ({ index }) =>
      pinned(
        "Outside work he travels, keeps up his fitness and looks after his health, and is always learning something new — new skills, new people.",
        index.bySection("Outside work").map((c) => ({ section: c.section, text: c.text })),
      ),
  },
  {
    id: "contact",
    test: [/\bcontact\b|\breach (him|out)\b|\bemail\b|\bphone\b|\bnumber\b|\blinked ?in\b|\bget in touch\b|\bhire him\b|\btalk to him\b/],
    respond: () =>
      pinned(
        `Email siddharthbagga29@gmail.com, call (860) 595-8333, or find him on LinkedIn at linkedin.com/in/siddharth-bagga-sid29.`,
        [],
        [{ name: "draft_email" }, { name: "call" }, { name: "open_linkedin" }],
      ),
  },
  {
    id: "metrics",
    test: [/\b75\s*%|\bdecision.?making\b|\bopex\b|\boperating expenses?\b|\b6\s*%|\b30\s*%|\breporting turnaround\b|\bimpact\b|\bachievements?\b|\baccomplishments?\b/],
    respond: ({ index }) =>
      pinned(
        "The measured results: executive decision-making efficiency up 75% in his first month (per the Managing Partner); operating expenses down 6% from cost and revenue levers he identified; daily reporting turnaround down 30% at Cerity Partners; and a $6M+ pipeline underwritten with equity cases from $3.5M to $21M.",
        citeText(index, "75%").concat(citeText(index, "operating expenses 6%")),
        [{ name: "navigate", station: "numbers" }],
      ),
  },
  {
    id: "capital-raise",
    test: [/\breg d\b|\blps?\b|\bcapital raise|\boffering\b|\bprospectus\b|\bfundrais|\bprivate equity\b/],
    respond: ({ index }) =>
      pinned(
        "He produced Turnkey's first investment prospectus and capital-raise package, then authored Reg D offering materials for LP capital raises on a deal-by-deal private equity platform.",
        citeText(index, "Reg D").concat(citeText(index, "prospectus")),
      ),
  },
  {
    id: "risk-project",
    test: [/\brisk tolerance\b|\binvestor profil/],
    respond: ({ index }) =>
      pinned(
        "The Risk Tolerance Analysis profiles investors: survey design, a scoring model, and mapping each profile to portfolio fit. The report is under Exhibits.",
        citeText(index, "Risk Tolerance"),
        [{ name: "open_exhibit", id: "risk" }],
      ),
  },
  {
    id: "digest",
    test: [/\bbrief me\b|\bsummar|\btl;?dr\b|\boverview\b|\bwho is (he|siddharth)\b|\btell me about (him|siddharth|yourself)\b|\bintroduc|\b60.?second/],
    respond: () => pinned("Here's the 60-second brief.", [], [{ name: "run_digest" }]),
  },
  {
    id: "help",
    test: [/^help\b|\bwhat can (you|i) (do|ask)\b|\bcommands\b|\bcapabilit/],
    respond: () =>
      pinned(
        "Ask about his deals, models, credentials, experience or gaps. I can also act on the site: \"take me to the model\", \"set WACC to 10%\", \"open the S&P report\", \"brief me\". Hold the mic button to talk, or switch on \"Hey Jarvis\" and just say it.",
      ),
  },
  {
    id: "thanks",
    test: [/^(thanks|thank you|thx|cheers|great|awesome|perfect|cool|ok|okay|bye|goodbye)\b/],
    respond: () => pinned(`Anytime. If you'd like to talk to him directly: ${CONTACT_LINE}.`, [], [{ name: "draft_email" }]),
  },
];

const ABOUT_HIM = /\b(he|his|him|siddharth|sid|bagga|candidate|you|your)\b/;

export interface EngineOptions {
  brief: string;
}

export class Engine {
  readonly index: Index;

  constructor({ brief }: EngineOptions) {
    this.index = new Index(parseBrief(brief));
  }

  normalize(raw: string) {
    return raw
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Answer one question. Synchronous, ~0.1 ms. */
  answer(raw: string): Answer {
    const q = this.normalize(raw).replace(/^(hey |ok |okay |hi )?jarvis[,:]?\s*/, "");
    const trace: TraceStep[] = [{ kind: "guard", label: "guard.check", detail: "injection · action · scope" }];
    if (!q) return { text: "I'm listening.", intent: "empty", citations: [], skills: [], trace, pinned: true };

    for (const intent of INTENTS) {
      if (!intent.test.some((re) => re.test(q))) continue;
      const out = intent.respond({ q, raw, index: this.index });
      if (!out) continue;
      trace.push({ kind: "route", label: `intent → ${intent.id}` });
      for (const s of out.skills) trace.push({ kind: "tool", label: `skill.${s.name}`, detail: skillDetail(s) });
      return { ...out, intent: intent.id, trace };
    }

    const hits = this.index.search(q, 3);
    trace.push({ kind: "retrieve", label: "search_brief", detail: `${hits.length} hit(s), top ${hits[0]?.score.toFixed(2) ?? "0"}` });
    const top = hits[0];
    if (!top || top.score < 2.2) {
      if (!ABOUT_HIM.test(q)) {
        return {
          text: "I only answer questions about Siddharth — his work, his methods and his background. Try \"How did he price the acquisition pipeline?\" or \"brief me\".",
          intent: "scope.off_topic",
          citations: [],
          skills: [],
          trace,
          pinned: true,
        };
      }
      return {
        text: `That's not covered in my brief, so I won't guess. Ask him directly at ${CONTACT_LINE}.`,
        intent: "retrieve.uncovered",
        citations: [],
        skills: [{ name: "draft_email" }],
        trace,
        pinned: true,
        uncovered: true,
      };
    }
    const kept = hits.filter((h) => h.score >= top.score * 0.6).slice(0, 3);
    trace.push({ kind: "synthesize", label: "extractive", detail: `${kept.length} passage(s)` });
    return {
      text: `From his brief: ${kept.map((h) => sentence(h.chunk)).join(" ")}`,
      intent: "retrieve.extractive",
      citations: kept.map((h) => ({ section: h.chunk.section, text: h.chunk.text })),
      skills: [],
      trace,
      pinned: false,
    };
  }

  /** Context passages for an LLM: the top hits plus anything a pinned answer cited. */
  context(question: string, k = 5): Chunk[] {
    return this.index.search(question, k).map((h) => h.chunk);
  }
}

function sentence(c: Chunk) {
  const t = c.text.replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function skillDetail(s: Skill): string {
  switch (s.name) {
    case "navigate":
      return s.station;
    case "set_dcf":
      return `wacc=${s.wacc ?? "–"} g=${s.g ?? "–"}`;
    case "open_exhibit":
      return s.id;
    default:
      return "";
  }
}

// ---------------- agents ----------------

export interface DigestSection {
  title: string;
  text: string;
}

/** The recruiter briefing: OpenJarvis's morning_digest, pointed at one candidate. */
export function digest(): DigestSection[] {
  return [
    {
      title: "Headline",
      text: "Siddharth Bagga is a valuation and commercial due diligence analyst with an M.S. in Financial Mathematics, based in Cincinnati and relocating to New York.",
    },
    {
      title: "Track record",
      text: "He joined Turnkey Services Pro when it had no finance function, built its models from raw bank statements, and improved executive decision-making efficiency 75% in his first month. Five months later he was promoted to Strategic Finance Lead.",
    },
    {
      title: "Deal work",
      text: "As lead he underwrote a $6M+ multi-state acquisition pipeline: normalized EBITDA, seller forecasts tested against backlog, IRR and MOIC at multiple entry and exit points, and the go/no-go memos that governed every capital decision.",
    },
    {
      title: "Proof",
      text: "His S&P Global capstone DCF, benchmarked against Moody's and MSCI, landed within 10% of analyst consensus. The report, the deck and his certificates are linked under Exhibits.",
    },
    {
      title: "Honest gaps",
      text: "14 months of experience, 11 full-time; he hasn't managed a team or run expert-network calls; and he has not sat the CFA Level I exam — he won a scholarship for its fee.",
    },
    {
      title: "Next step",
      text: "He's looking for commercial due diligence, valuation or strategy roles. Reach him at siddharthbagga29@gmail.com.",
    },
  ];
}

export interface ResearchResult {
  subQuestions: { q: string; answer: Answer }[];
  text: string;
  citations: Citation[];
  trace: TraceStep[];
}

/** Deep research: split a compound question, answer each part with citations, then merge. */
export function research(engine: Engine, question: string): ResearchResult {
  const parts = question
    .split(/\?|;|\band also\b|\balso\b|\band (?=(what|how|why|is|has|does|did|where|who|when)\b)|, (?=(what|how|why|is|has|does|did|where|who|when)\b)/i)
    .map((p) => (p ?? "").trim())
    .filter((p) => p && p.length > 3 && !/^(what|how|why|is|has|does|did|where|who|when)$/i.test(p));
  const qs = parts.length ? parts.slice(0, 4) : [question];
  const trace: TraceStep[] = [{ kind: "route", label: "research.plan", detail: `${qs.length} sub-question(s)` }];
  const subQuestions = qs.map((q) => {
    const answer = engine.answer(q);
    trace.push({ kind: "retrieve", label: `search_brief("${q.slice(0, 48)}")`, detail: answer.intent });
    return { q, answer };
  });

  const citations: Citation[] = [];
  const ref = (c: Citation) => {
    let i = citations.findIndex((x) => x.text === c.text);
    if (i < 0) i = citations.push(c) - 1;
    return i + 1;
  };
  const body = subQuestions
    .map(({ q, answer }) => {
      const marks = answer.citations.map(ref);
      const tag = marks.length ? ` [${[...new Set(marks)].join("][")}]` : "";
      return qs.length > 1 ? `• ${capitalize(q)} — ${answer.text}${tag}` : `${answer.text}${tag}`;
    })
    .join("\n");
  trace.push({ kind: "synthesize", label: "research.merge", detail: `${citations.length} source(s)` });
  return { subQuestions, text: body, citations, trace };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
