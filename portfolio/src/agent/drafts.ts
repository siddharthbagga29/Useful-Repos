// The actor's raw material: Jarvis's sales lines. The register is JARVIS from the films: composed,
// precise, dryly witty, a step ahead, and narrating what he's doing while he does it. The craft is a
// calm, senior closer's.
// Discovery before pitch, one specific proof at a time, a question at the end of every turn, and
// the smallest possible next step. Every number here must appear in jarvis/knowledge/brief.md;
// the critic rejects anything it can't find there. No invented scarcity, urgency or social proof.

import type { Line } from "../jarvis/sales/types.ts";

const BOOK = { label: "Book 30 minutes", next: "close.call" } as const;
const CONCERN = { label: "I have a concern", next: "objection.menu" } as const;
const NOTE = { label: "Send a note", next: "close.email" } as const;

export const DRAFTS: Line[] = [
  // ---------------------------------------------------------------- opening
  {
    id: "open.first",
    stage: "open",
    text: "{greet}. || I'm Jarvis. | I run this place while Siddharth runs the numbers. || His work, in one line. | Most analysts tell you what the model says. | He shows you where it breaks. || Before I take you anywhere, | who am I speaking with?",
    chips: [
      { label: "I'm hiring", next: "pitch.recruiter", audience: "recruiter" },
      { label: "I invest family capital", next: "pitch.principal", audience: "principal" },
      { label: "I run a company", next: "pitch.founder", audience: "founder" },
      { label: "Just looking", next: "pitch.explorer", audience: "explorer" },
    ],
  },
  {
    id: "open.return",
    stage: "open",
    text: "Welcome back, {name}. || I kept your place. | Shall I give you the short version, | or show you something you haven't seen?",
    chips: [
      { label: "Short version", next: "pitch.return" },
      { label: "Show me something new", next: "nudge.research" },
      BOOK,
    ],
  },
  {
    id: "pitch.return",
    stage: "pitch",
    text: "Very well. || He underwrote a $6M+ acquisition pipeline. | He wrote the go/no-go memos that decided where the capital went. | And he was promoted after five months. || Shall we put 30 minutes on the calendar?",
    chips: [BOOK, NOTE, CONCERN],
  },

  // ---------------------------------------------------------------- pitch, by audience
  {
    id: "pitch.recruiter",
    stage: "pitch",
    audience: "recruiter",
    text: "Noted. | Then I'll skip to what matters. || In his last seat, he underwrote a $6M+ acquisition pipeline. | He wrote the go/no-go memos the Managing Partner used for every capital decision. | And he was promoted after five months. || What's the role you're filling?",
    chips: [
      { label: "Diligence or valuation", next: "proof.recruiter" },
      { label: "Investment analyst", next: "proof.recruiter" },
      CONCERN,
      BOOK,
    ],
  },
  {
    id: "pitch.principal",
    stage: "pitch",
    audience: "principal",
    text: "Understood. || First, so we're clear. | Siddharth doesn't manage money or give investment advice. | What he does is the work behind the decision. || Normalized earnings. | Downside cases. | A memo that survives a partner's questions. || Are you building a team, | or looking at a specific deal?",
    chips: [
      { label: "Building a team", next: "proof.principal" },
      { label: "A specific deal", next: "proof.principal" },
      CONCERN,
      BOOK,
    ],
  },
  {
    id: "pitch.founder",
    stage: "pitch",
    audience: "founder",
    text: "Then you'll like this. || He's sat on your side of the table. | He built a finance function from raw bank statements. | Then he wrote the capital-raise package, | and the Reg D offering materials. || Are you raising, | buying, | or selling?",
    chips: [
      { label: "Raising", next: "proof.founder" },
      { label: "Buying", next: "proof.founder" },
      { label: "Selling", next: "proof.founder" },
      BOOK,
    ],
  },
  {
    id: "pitch.explorer",
    stage: "pitch",
    audience: "explorer",
    text: "Then allow me. || I can run the tour myself. | Five stops, | about a minute, | and you can stop me at any point. || Shall I begin?",
    chips: [
      { label: "Begin the tour", action: "run_tour" },
      { label: "Actually, I'm hiring", next: "pitch.recruiter", audience: "recruiter" },
      { label: "Maybe later", action: "snooze" },
    ],
  },

  // ---------------------------------------------------------------- proof
  {
    id: "proof.recruiter",
    stage: "proof",
    audience: "recruiter",
    text: "Here's how he works. || He doesn't take a seller's forecast at face value. | He tests it against backlog and pipeline conversion. || You can see the same habit on this site. | He audited his own deal analyzer, | and caught it saying GO on a deal that fails. || Worth a 30-minute conversation?",
    chips: [BOOK, { label: "Show me the Deal Lab", action: "href:/deal/" }, NOTE],
  },
  {
    id: "proof.principal",
    stage: "proof",
    audience: "principal",
    text: "Here's the honest version of his research. || He tested ten years of allocation rules across a thousand simulated decades. | None reliably beat the S&P 500 on return. || But the defensive ones cut drawdowns. | The 60/40 mix did it in 99.8% of paths. || He'll tell you what the data says, | not what sells. || Shall I set up 30 minutes?",
    chips: [BOOK, { label: "Show me the research", action: "href:/lab/#montecarlo" }, CONCERN],
  },
  {
    id: "proof.founder",
    stage: "proof",
    audience: "founder",
    text: "When he joined Turnkey, there was no finance function. || Within a month, | the Managing Partner said decision-making was 75% more efficient. | Later he found levers that cut operating expenses 6%. || If you're weighing a deal, | he'll pressure-test the numbers before anyone else does. || Want to talk it through?",
    chips: [BOOK, NOTE, CONCERN],
  },

  // ---------------------------------------------------------------- objections
  {
    id: "objection.menu",
    stage: "objection",
    text: "Please. | I'd rather hear it now than later. || What's on your mind?",
    chips: [
      { label: "He's early in his career", next: "objection.junior" },
      { label: "No CFA?", next: "objection.cfa" },
      { label: "Why private capital?", next: "objection.fit" },
      { label: "Not the right time", next: "objection.timing" },
    ],
  },
  {
    id: "objection.junior",
    stage: "objection",
    text: "Fair. | Twenty-two months isn't twenty years. || But look at what those months held. | A promotion after five. | A $6M+ pipeline underwritten. | Memos that decided where capital went. || Most people get that responsibility later. | He got it early, | and kept it. || Would 30 minutes help you judge for yourself?",
    chips: [BOOK, NOTE],
  },
  {
    id: "objection.cfa",
    stage: "objection",
    text: "Straight answer. || He hasn't sat the CFA exam. | He was awarded a merit-based scholarship for the Level I exam fee, | and his M.S. in Financial Mathematics covers the quant side in depth. || If the charter is a hard requirement, | I'd rather you know now. || Is it?",
    chips: [
      { label: "Not a hard requirement", next: "close.call" },
      { label: "It is", next: "objection.timing" },
    ],
  },
  {
    id: "objection.fit",
    stage: "objection",
    text: "Because the work suits him. || Private, illiquid companies. | Messy data. | A decision someone has to defend. || That's what he did every week at Turnkey, | with a 12% WACC and real capital on the line. || Does your team look at deals like that?",
    chips: [
      { label: "Yes", next: "close.call" },
      { label: "Not really", next: "objection.timing" },
    ],
  },
  {
    id: "objection.timing",
    stage: "objection",
    text: "Understood. || I'll stand down. | No pressure. || If it helps later, | his résumé and a pre-written note are one click away. | Want either?",
    chips: [
      { label: "Résumé", action: "open_resume" },
      NOTE,
      { label: "Not now", action: "snooze" },
    ],
  },

  // ---------------------------------------------------------------- close
  {
    id: "close.call",
    stage: "close",
    text: "Right away. || It's 30 minutes. | You'll leave with a clear read on whether he fits. || His calendar is opening now. | Any slot that suits you, | shall we?",
    chips: [NOTE],
    action: "open_schedule",
  },
  {
    id: "close.email",
    stage: "close",
    text: "Already done. || I've drafted a short note for you. | Add your name, | change anything, | and send. || Or would you rather just book a time?",
    chips: [BOOK],
    action: "open_connect",
  },

  // ---------------------------------------------------------------- proactive nudges
  {
    id: "nudge.dealroom",
    stage: "nudge",
    text: "You've been in the deal room a while. || I'd flag one finding most people miss. | It takes twenty seconds. || Want it?",
    chips: [{ label: "Go on", next: "proof.dealroom" }, BOOK],
  },
  {
    id: "proof.dealroom",
    stage: "proof",
    text: "His own deal analyzer said GO on its example deal. || He audited it. | It had left out the buyer's costs, | and never applied its own contingency. || Fixed, | the deal works in about 29% of outcomes. | That's the habit you'd be hiring. || Shall we talk?",
    chips: [BOOK, { label: "Open the Deal Lab", action: "href:/deal/" }],
  },
  {
    id: "nudge.model",
    stage: "nudge",
    text: "Try this. || Drag the WACC up a point, | and watch what happens to value. || That sensitivity is how he thinks about every deal. | Want to know what this model can't tell you?",
    chips: [{ label: "Tell me", next: "proof.model" }, BOOK],
  },
  {
    id: "proof.model",
    stage: "proof",
    text: "It's an illustration, built on S&P Global's reported revenue. | It isn't his capstone result. || The capstone landed within 10% of analyst consensus. | He'll always tell you which number is which. || Worth 30 minutes?",
    chips: [BOOK, NOTE],
  },
  {
    id: "nudge.research",
    stage: "nudge",
    text: "Those buildings aren't decoration. || Every bot down there is a real job. | Running tests, | or evolving strategies every six hours. || Want me to walk you through the one that matters most to you?",
    chips: [
      { label: "The strategy research", next: "proof.principal" },
      { label: "The deal audit", next: "proof.dealroom" },
      BOOK,
    ],
  },
  {
    id: "nudge.experience",
    stage: "nudge",
    text: "Quick context on that timeline. || Twenty-two months, | fourteen in the U.S., | eight in India, | and a promotion in the middle. || Want the one deal story that shows his judgment best?",
    chips: [{ label: "Yes", next: "proof.recruiter" }, BOOK],
  },
  {
    id: "nudge.exit",
    stage: "nudge",
    text: "Before you go. || For the record, | if any of this was useful, | the fastest next step is a 30-minute call. | No prep needed on your side. || Shall I open the calendar?",
    chips: [BOOK, NOTE, { label: "Not now", action: "snooze" }],
  },
  // ---------------------------------------------------------------- the self-running tour
  // Concierge.tsx drives the site between these: it navigates, runs the model, and narrates.
  {
    id: "tour.numbers",
    stage: "tour",
    text: "Stop one. | The numbers. || In his last seat, | he underwrote a $6M+ acquisition pipeline. | Operating expenses came down 6%.",
    chips: [],
  },
  {
    id: "tour.experience",
    stage: "tour",
    text: "Stop two. | The track record. || Fourteen months in the U.S., | eight in India before that. | Promoted to lead the finance function after five months.",
    chips: [],
  },
  {
    id: "tour.model",
    stage: "tour",
    text: "Stop three. | A live valuation model. || I'm raising the WACC a point, | so you can watch the value fall. | It's an illustration, | not his capstone result.",
    chips: [],
  },
  {
    id: "tour.dealroom",
    stage: "tour",
    text: "Stop four. | The deal room. || His own analyzer said GO on its example deal. | He audited it. | Fixed, | it works in about 29% of outcomes.",
    chips: [],
  },
  {
    id: "tour.research",
    stage: "tour",
    text: "Stop five. | The research city. || Every bot is a real automated job. | The Brain in the middle evolves strategies every six hours.",
    chips: [],
  },
  {
    id: "tour.end",
    stage: "tour",
    text: "That concludes the tour. || If any of it was useful, | the next step is 30 minutes with him. || Shall I open his calendar?",
    chips: [BOOK, NOTE, { label: "Not now", action: "snooze" }],
  },
  // ---------------------------------------------------------------- reading the room (signals.ts)
  {
    id: "help.rage",
    stage: "nudge",
    text: "That didn't respond the way you expected, | did it? || I'll take you straight there. | Where were you trying to go?",
    chips: [
      { label: "The live model", action: "navigate:model" },
      { label: "His experience", action: "navigate:experience" },
      { label: "Ask Jarvis", action: "open_jarvis" },
    ],
  },
  {
    id: "help.dead",
    stage: "nudge",
    text: "That part isn't clickable, | I'm afraid. || Shall I show you what is?",
    chips: [
      { label: "Begin the tour", action: "run_tour" },
      { label: "Ask Jarvis", action: "open_jarvis" },
      { label: "Not now", action: "snooze" },
    ],
  },
  {
    id: "help.hunting",
    stage: "nudge",
    text: "Looking for something specific? || I know where everything is on this site. | What do you need?",
    chips: [
      { label: "Experience", action: "navigate:experience" },
      { label: "The deal audit", action: "navigate:dealroom" },
      { label: "Research", action: "navigate:research" },
      { label: "Contact", action: "navigate:contact" },
    ],
  },
  {
    id: "help.stall",
    stage: "nudge",
    text: "Still with me? || I can run the one-minute tour, | or answer whatever's on your mind. || Which would you prefer?",
    chips: [
      { label: "Begin the tour", action: "run_tour" },
      { label: "Ask Jarvis", action: "open_jarvis" },
      { label: "Not now", action: "snooze" },
    ],
  },
];
