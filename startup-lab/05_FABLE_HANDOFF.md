# 05 — Fable 5.2 handoff: spend expensive tokens ONLY on these

## The split (rule of thumb)
| Cheap model (already done here) | Fable 5.2 (save for these) |
|---|---|
| Searching, listing, summarising, scoring with a given formula | Judgment under uncertainty, adversarial review |
| Templates, scripts, checklists, draft pages | Pricing/market-sizing logic, simulations design |
| Formatting, renaming, file organising | Building the full product end to end |
| Re-running a known process | Deciding what to do when a test fails |

Run in this order. Stop at any gate that fails. Paste the "Context block" at the top of every prompt.

## Context block (paste first, every time)
```
Founder: Siddharth, 23, Cincinnati; finance/valuation/underwriting background.
Budget: under $10,000 total; max $500 test spend before a paid pre-order.
Status gate: do NOT recommend publishing, selling, taking payment, forming
an entity or signing contracts until I confirm green card + counsel/CPA OK.
Label every claim FACT (with URL+date) / ESTIMATE (show math) / ASSUMPTION.
Never invent statistics. Simulation output = hypothesis, not evidence.
Inputs: the files in startup-lab/ and ../bagga-acquisition-research/.
Current candidate: A = Small-Deal Underwriting Toolkit (see 02_IDEA_SCORECARD.md).
```

## Tasks for Fable (in order)

### F1 · Attack the idea (before any more building)
```
Act as a skeptical serial founder. Read startup-lab/01 and 02. List the 7 most
likely reasons Idea A fails. For each: the cheapest test to confirm or kill it.
Then rank Ideas A, B, C again and say if you disagree with my scores and why.
Output: a one-page verdict, a kill/continue call, and 3 tests for this week.
```
**Gate:** if verdict = kill, stop; don't spend further tokens.

### F2 · Market and pricing logic
```
Using only sourced facts (cite URL+date), estimate demand for a $49–$299
underwriting toolkit for first-time buyers of $1–10M companies: who buys, how
many are reachable, competitors and their prices. Propose 3 price/packaging
options with expected conversion ranges (labelled ESTIMATE, formulas shown).
Say what evidence would change each estimate.
```

### F3 · Simulation design (your prediction simulator)
```
Design the inputs for a market-response simulation of Idea A: 4 buyer
personas, 3 messages, 3 prices. Define what the simulator should output,
its limits, and how each result maps to a REAL test (landing page, DMs,
pre-order). Do not treat results as proof.
```

### F4 · Build the real product (only if interviews pass)
```
Turn bagga-acquisition-research/06_FIRST_ACQUISITION_MODEL.xlsx and files
04, 05 into a sellable toolkit: generic (no founder-specific data), clearly
illustrative numbers, a user guide, and a one-page disclaimer (not financial,
legal or tax advice). Test every formula. Flag items for lawyer review.
```

### F5 · 90-day go-to-market plan (after GC)
```
Write a 90-day plan: week-by-week tasks (exactly three per day), channels,
messages, budget under $500 per test, metrics, and kill rules. Include
what to automate and what must stay manual. Include a LAWYER/CPA CHECK list
(entity, tax, sales tax, terms of sale, disclaimers, privacy).
```

### F6 · Path to $1,000,000 (honest math)
```
Build a table: price × units × months for 3 paths (toolkit only; toolkit +
cohort course; toolkit → productized QoE-lite service). For each, the
assumptions it depends on, hours needed, and the earliest realistic date.
Say plainly which path can't reach $1M and why.
```

### F7 · Adversarial review of everything before launch
```
Review all outputs as a hostile critic: legal exposure, misleading claims,
unsupported numbers, copyright, anything that could count as financial
advice, anything I should not say publicly while my status is pending.
```

## Token-saving rules
1. Hand Fable files, not conversation history.
2. One task per prompt; stop at gates.
3. Use the cheap model for anything in the left column above.
4. Ask Fable for decisions and structure, then let a cheap model fill and format.

## Do-not-do list until green card + counsel
Publish the offer page · collect emails or money · run ads · register a business · promise results · use PitchBook (academic, non-commercial licence) for this.
