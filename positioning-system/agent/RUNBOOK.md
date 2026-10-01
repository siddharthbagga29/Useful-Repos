# Daily Runbook — execute in this order

Target: 25–40 minutes of agent work. Stop and report if you exceed that; a
partial run that reports honestly beats a long one that drifts.

---

## STEP 0 — Load state (5 min)

1. Read `agent/CONTEXT.md` in full. Non-negotiable.
2. Read `agent/MEMORY.md`. Note the standing lessons and open questions.
3. Read the live workbook — Google Drive file ID
   `1CximFWly4sb8l8YtFq-bXMXNcBxHeWLUfgJFydcfEEY` ("Positioning OS").
   You need: Dashboard red block, People CRM, Portfolio Projects, Events,
   Opportunities, Daily Tasks.
4. Note today's date and day of week.

If the workbook cannot be read, report that and stop. Do not guess its contents.

---

## STEP 1 — Check for replies (5 min)

Search Gmail for anything from, or mentioning, people in the People CRM since the
last run. A reply changes priority more than anything else in this runbook.

- Reply received → that person is today's top RELATIONSHIP item. Draft the
  response. Record it in MEMORY under "Things that produced a reply", including
  *what the original message did* — that is the learning.
- No replies → proceed.

Never reply to anyone yourself. Draft only.

---

## STEP 2 — Follow-ups due (10 min) — the highest-priority block

From People CRM, find rows where `Next Contact` ≤ today. Sort A-tier first.

For each (max 3 per run):
1. Read `Conversation Topic`, `Their Interests`, `Value I Can Give`, `Notes`.
2. **If `Value I Can Give` is empty or says "Nothing yet" — do not draft.**
   Instead, find something: a filing, a sector data point, an article relevant to
   their stated focus, an introduction. If after five minutes you have nothing
   specific, flag it in the report as *"needs a reason to write"* and move on.
   A follow-up with nothing attached teaches people to stop replying.
3. Check `Notes` for eligibility traps before mentioning any role (Rule 5).
4. Write the draft per `09-networking-system.md` §2 and the tone rules.
5. Create it as a **Gmail draft**. Subject line must be specific, never "Following up".

---

## STEP 3 — One new contact (5 min)

Only if the follow-up queue is under three. Maintenance outranks prospecting.

Use the People Sourcing Protocol (`05-people-and-firms.md` §3): firm's own team
page is the source, title copied verbatim, warrant identified (UC alumnus is the
strongest he has), second source checked. Draft the Curiosity message.

If no verified uncontacted person exists, source five new ones from the firm
register in `05-people-and-firms.md` §2 instead and draft nothing.

---

## STEP 4 — Advance the evidence (10 min)

Check Portfolio Projects for a row with Status = IN PROGRESS.

- **In progress** → do one bounded, genuinely useful piece of research for it and
  commit the output to `research/` in the repo with every source URL. Good units:
  a Census CBP establishment-count pull for one NAICS × the four counties; a BLS
  QCEW trend; one named company's ownership and growth signal; one comparable
  transaction from EDGAR full-text search.
- **Nothing in progress** → do not start a project for him. Flag it: the next one
  is chosen from `07-investment-portfolio.md` §3 and that is his call.

**Wednesdays**: add five companies to the radar instead, per
`06-target-company-radar.md` §4, with Revenue Basis set honestly.

**Monthly, first run of the month**: run the fund-close screen reasoning from
`20-pitchbook-playbook.md` §2 Use 1 — but you cannot access PitchBook. Instead,
check SEC Form D filings for new fund closes by Ohio/Kentucky/Indiana managers on
EDGAR, which is public and is the next best proxy. Flag any hit as a high-priority
outreach target.

---

## STEP 5 — Events and calendar (3 min)

- Event within 48 hours with `Pre-Brief Done` ≠ Yes → run the 48-hour checklist
  from `09-networking-system.md` §1 and create a calendar block for it.
- No events registered at all → flag it. Events have weeks of lead time and are
  the single most common thing to fall behind on.

---

## STEP 6 — Guardrails (2 min)

- Any Opportunities row with `Counsel Review Needed` = Yes → surface it at the
  **top** of the report. Do not act on it.
- Any People CRM row marked UNVERIFIED → name it; it must not be used in
  conversation until sourced.
- Any verification older than 90 days → flag for re-verification.

---

## STEP 7 — Record and report (5 min)

1. **Update `agent/MEMORY.md`**: standing lessons, replies, failures, corrections,
   and a run-log row. Be specific — "the critique ask got a reply, the generic
   follow-up did not" is a lesson; "made progress" is not.
2. **Write `agent/queue.tsv`** with any rows he should paste into the workbook
   (see the format block at the bottom of this file).
3. **Commit** everything to the repo with a one-line message naming what changed.
4. **Email him one report**, and only him. Structure:

```
WHAT I DID
  - 2 drafts waiting in Gmail: [names]. Each one says what it asks for.
  - 1 finding committed: [what, with the source]
  - [calendar blocks created]

WHAT NEEDS YOU
  - [anything blocked, with the specific thing you need from him]

FLAGS
  - [counsel review / unverified / eligibility traps]

WHAT I LEARNED
  - [one sentence, the actual lesson added to memory]
```

No preamble. No encouragement. If the run produced little, say so plainly — an
honest thin report is how he knows the system is working.

---

## queue.tsv format

Tab-separated, first line a run ID, for pasting into the workbook. Columns match
`10-sheets-architecture.md`.

```
RUN<YYYYMMDD>
SHEET	<sheet name>	<tab-separated row values>
```

⚠️ When writing People CRM rows, **skip columns R and S** — they hold array
formulas and pasting over them breaks every row below. Emit A–Q and T–AF as
separate rows prefixed `SHEET	People CRM A-Q` and `SHEET	People CRM T-AF`.
