# Quality Rubric — the 9.5 gate

Every day's work is scored out of 10.0 before it reaches the owner. Below 9.5 it
goes back for remediation.

## Why this rubric is arithmetic

An LLM scoring its own team's output drifts upward — it reads its own work as
reasonable because it produced it. The defence is to make the score **mostly
countable**. The overseer counts sourced claims, dead links, tier violations and
eligibility checks; the number follows from the counts rather than from a feeling
about quality.

Two further defences:
- **No score above 9.0 without a named defect.** If the reviewer cannot point at
  something specific, the review did not happen.
- **Hard-fail conditions cap the run at 4.0** regardless of everything else, so a
  single integrity failure cannot be averaged away by volume.

This is still self-assessment and you should read it as such. It catches sloppiness
and fabrication reliably; it cannot certify that a judgment call was wise. That is
what your verification pass is for.

---

## Dimension 1 — Legitimacy (2.0)

*Can every claim be traced to a source that actually says it?*

| Score | Condition |
|---|---|
| 2.0 | 100% of factual claims carry a URL; every URL fetched and confirmed to contain the claim; zero Tier 4 citations |
| 1.5 | ≥95% sourced; one dead or non-confirming link, flagged |
| 1.0 | ≥85% sourced, or a Tier 3 source used without corroboration |
| 0.0 | Any unsourced factual claim presented as fact → **hard fail** |

## Dimension 2 — Credibility (2.0)

*Would a Cincinnati LMM practitioner accept this without wincing?*

| Score | Condition |
|---|---|
| 2.0 | Every role eligibility-checked; no private-company financials asserted; titles verbatim from firm pages; no fabrication-risk items |
| 1.5 | One item needing a caveat, and the caveat is present |
| 1.0 | A plausible-but-unconfirmed item surfaced without a flag |
| 0.0 | Any fabricated person, title, deal or figure → **hard fail** |

## Dimension 3 — Research depth (2.0)

*Did it go to primary sources, or summarise what was easy to find?*

| Score | Condition |
|---|---|
| 2.0 | ≥3 distinct Tier 1 sources; every figure has a reproducible query URL; failed lookups disclosed |
| 1.5 | 2 Tier 1 sources; reproducible |
| 1.0 | 1 Tier 1 source, or reproducible only in part |
| 0.5 | Search-result summarising with no primary source touched |

## Dimension 4 — Analysis quality (2.0)

*Is there reasoning, or only collection?*

| Score | Condition |
|---|---|
| 2.0 | Assumption register present; sensitivities stated; returns attribution on any LBO; downside built before base on any credit work; check tab ties; five hostile questions answered |
| 1.5 | Analysis sound, one element of the above missing |
| 1.0 | Correct but mechanical — numbers without interpretation |
| 0.5 | Collection only. Data moved from one place to another. |

## Dimension 5 — Deep thinking (1.5)

*Did the run produce something a careful person would not have got for free?*

| Score | Condition |
|---|---|
| 1.5 | A non-obvious finding, a surfaced contradiction between sources, or a **negative finding** that saves wasted effort |
| 1.0 | A useful connection between two existing facts |
| 0.5 | Competent execution of instructions, no insight |
| 0.0 | Restates what was already in the system |

**Negative findings score full marks.** "I checked these four roles and all four
are closed to him, here is the requirement each one fails" is more valuable than
four surfaced opportunities he cannot hold.

## Dimension 6 — Usefulness (0.5)

*Does it move the actual deficit?*

Diagnosis: capability 68, evidence 34, network 18, reputation 12. The gap is
legibility and access, **not** knowledge.

| Score | Condition |
|---|---|
| 0.5 | Advances network, evidence or reputation concretely |
| 0.25 | Supports something that will |
| 0.0 | Adds knowledge he already had enough of |

---

## Hard-fail conditions — cap the run at 4.0

1. A claim about a person, firm, deal or statistic with no resolvable source
2. A private-company revenue or valuation without `Revenue Basis = REPORTED`
3. A draft stating or implying he is currently authorised to work
4. A draft accepting or soliciting work, payment, equity or anything of value
5. A role surfaced without eligibility checked against his verified record
6. PitchBook-derived data in anything intended for publication
7. Reproduced work product from Turnkey Services Pro or Cerity Partners
8. An email sent to any third party

Each of these is in the rubric because it is a way the system could quietly
damage him rather than merely underperform.
