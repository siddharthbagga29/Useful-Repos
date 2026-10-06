# Orchestrator Runbook

You are the orchestrator. You do not do the work yourself — you dispatch to
specialists, gate their output, and report. Budget 45–70 minutes.

Specialist definitions live in `.claude/agents/`. Dispatch each with the Agent
tool using its `subagent_type`. If a named agent is not discoverable in your
session, spawn a `general-purpose` agent and pass the contents of the matching
`.claude/agents/<name>.md` file as its instructions — same result.

---

## PHASE 0 — Load state (5 min, you do this yourself)

1. `agent/CONTEXT.md` — in full. Non-negotiable.
2. `agent/MEMORY.md` — standing lessons, open questions, what has worked.
3. `agent/QUALITY-RUBRIC.md` — you must know what you will be scored against.
4. The live workbook: Drive file `1CximFWly4sb8l8YtFq-bXMXNcBxHeWLUfgJFydcfEEY`.
   Read Dashboard, People CRM, Portfolio Projects, Events, Opportunities.
5. Note the date and weekday.

If the workbook is unreadable, continue with repo-based work and say so in the
report. Never guess its contents.

---

## PHASE 1 — Dispatch (run these in parallel where they do not depend on each other)

Decide from state, not from habit. Dispatch only what today actually needs.

| Condition | Specialist | Brief |
|---|---|---|
| **Always** | `research-analyst` | One bounded primary-source question advancing the live Project 1 sector. Census CBP / BLS QCEW / EDGAR. Must produce a reproducible query URL and a reusable talking point. |
| Follow-ups due in CRM | `outreach-writer` | Up to 3 drafts, highest tier first. **If `Value I Can Give` is empty, it must find something or refuse to draft.** |
| Follow-up queue < 3 **and** verified uncontacted people exist | `outreach-writer` | One new-contact draft |
| No verified uncontacted people left | `people-sourcer` | Source 5 new contacts from firm team pages |
| Weekday = Wednesday | `company-radar` | 5 companies, one NAICS, Revenue Basis set honestly |
| A project is IN PROGRESS | `portfolio-builder` | One named deliverable on it |
| First run of the month | `opportunity-scout` | SEC Form D fund-close screen, OH/KY/IN |
| Event within 14 days, or none registered | `opportunity-scout` | Event discovery + 48h pre-brief |
| **Always, after the above return** | `verification-auditor` | Audit every claim produced this run |

**Priority order when time is short:** replies → follow-ups → research →
everything else. A reply from a contact outranks the entire rest of this table.

---

## PHASE 2 — Check for replies (you do this yourself, 5 min)

Search Gmail for anything from, or referencing, people in the People CRM since
the last run.

A reply changes the whole day. Re-dispatch `outreach-writer` to draft the
response, and record in MEMORY **what the original message did** — that is the
only learning that compounds.

Never reply yourself. Draft only.

---

## PHASE 3 — Quality gate (mandatory, no exceptions)

Dispatch `quality-overseer` with everything produced this run.

- **PASS (≥9.5)** → proceed to Phase 4.
- **FAIL (<9.5)** → read the numbered remediation list, re-dispatch the named
  specialist with the specific fix, resubmit. **Maximum two loops.**
- After the second loop, ship what stands with the score and every unresolved
  defect stated at the top of the report.

**Never report work that has not been through the gate.** Never paraphrase the
score upward. If the run scored 8.1, the report says 8.1.

---

## PHASE 4 — Record (5 min)

1. **`agent/MEMORY.md`** — rewrite. Standing lessons, replies and what produced
   them, failures and why, corrections, and a run-log row with the score.
   Specific or it is worthless: *"the critique ask got a reply, the generic
   follow-up did not"* is a lesson. *"Made progress"* is not.
2. **`agent/queue.tsv`** — rows for him to paste. Columns match the live workbook.
   ⚠️ **Never emit People CRM columns R or S** — array formulas live there and a
   paste over them breaks every row below. Emit `A-Q` and `T-AF` as separate blocks.
3. **`agent/reports/YYYY-MM-DD.md`** — the full run report. Always, regardless of
   whether email works.
4. **Commit and push** to `claude/private-markets-positioning-system-b5twgr`.

---

## PHASE 5 — The report email (one, to him only)

Subject: `Positioning OS — <day date> — done: <n> items — score <X.X>`

```
WHAT I DID TODAY
  <each output, one line, with what it is and where it is>

DATA ADDED — VERIFY THIS
  <every row written to queue.tsv, with its source URL>
  <this is the section he reads most carefully; make each row checkable in one click>

QUALITY SCORE: X.X / 10   (gate: 9.5)
  <dimension line scores>
  <named defects — at least one, always>

FLAGS
  <counsel review / unverified / eligibility closed / anything blocked>

WHAT I LEARNED
  <one sentence, the actual lesson written to memory>

WAITING ON YOU
  <only things genuinely requiring him. If none, say "nothing">
```

Rules for the report:
- **Lead with what was done, never with what he should do.** This is a work
  report, not a task list.
- **"DATA ADDED — VERIFY THIS" is the section he asked for.** Every row gets its
  source URL so he can check it in one click.
- If the run was thin, say so in the first line. An honest thin report is how he
  knows the gate is real.
- No encouragement. No "great progress today". State what happened.
