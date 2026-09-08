# PART X — Automation Architecture

## §1. The design constraint

You asked for roughly 80% system / 20% judgment. I am going to push back on the
number, because the split that actually works is different in kind:

**The system should do 80% of the *deciding what to do*. It should do ~0% of the
*doing*.**

Automating "what needs attention today" is pure gain — it removes the daily
willpower cost of deciding, which is the thing that kills systems by week six.
Automating "send the message" or "mark this verified" destroys the only thing you
are actually building, which is a set of relationships and a body of work that
are demonstrably yours. An auto-sent follow-up is worse than no follow-up: it
teaches the recipient that your attention is cheap.

So: the engine proposes, sweeps and reports. You decide, write, verify and send.

---

## §2. The pipeline

```
  INPUT                    you, primary sources, events, replies
    │
    ▼
  RESEARCH                 firm team pages · SEC EDGAR · Census CBP · BLS QCEW
    │                      Form ADV · FINRA BrokerCheck · Ohio SOS
    ▼
  VERIFICATION  ◀────────  HUMAN ONLY. Nothing is auto-verified, ever.
    │                      Status + Source URL + Date Verified + Confidence
    ▼
  DATABASE                 Google Sheets, 15 sheets, one Config vocabulary
    │
    ▼
  PRIORITISATION           DailyEngine: follow-ups due → live project →
    │                      spaced-rep due → event pre-brief → guardrails
    ▼
  DAILY TASKS              written as "Proposed", Approved = blank
    │
    ▼
  HUMAN APPROVAL  ◀─────── you approve or reject. Rejection is expected.
    │
    ▼
  HUMAN ACTION             writing, sending, meeting, modelling
    │
    ▼
  FOLLOW-UP                Last Contact, Next Contact, Cadence → back to the queue
    │
    ▼
  REVIEW                   Friday sweep · Sunday score · improvement questions
    │
    ▼
  LEARNING LOOP  ─────────▶ remove one low-value recurring task every week
```

### Stage table

| Stage | Tool | Automated | Human role | Verification | Failure mode | Mitigation |
|---|---|---|---|---|---|---|
| Input | Gmail, Calendar, you | No | All of it | — | Things never enter the system | The 15-minute close-out block is the capture ritual |
| Research | Browser, EDGAR, Census, ADV | No | All of it | Source URL captured at time of reading | Reading without recording | Sheet 6 requires a URL before a row saves usefully |
| Verification | Human | **Never** | All of it | Status + URL + Date | Marking VERIFIED from LinkedIn | Rule in `19-verification-protocol.md`; 90-day decay |
| Database | Sheets | Validation, formulas | Data entry | Dropdowns prevent invalid states | Freehand values break COUNTIFs | All vocabularies live in Config; no typing |
| Prioritisation | Apps Script | **Yes** | Set cadences and tiers | — | Bad cadence data → bad proposals | Visible in the task text; correct the row |
| Daily tasks | Sheets | Yes (writes proposals) | Approve/reject | — | Task spam → you stop reading | Capped at ~6/day; re-run is a no-op |
| Approval | You | No | The whole point | — | Rubber-stamping | Sunday question: "what did I approve and not do?" |
| Action | You | No | All of it | — | — | — |
| Follow-up | Sheets + engine | Detection only | Writing and sending | — | Cadence drift | Red row formatting is unmissable |
| Review | Script + you | Counts only | Judgment columns | — | Skipping Sunday | 45 min, one day a week; if you skip twice, cut the system instead |
| Learning | You | No | All of it | — | System bloat | Mandatory weekly removal |

---

## §3. Every automation, specified

The prompt asks for seven fields per automation. Here they are.

### A1 — Daily task proposal
1. **Purpose** — remove the daily "what should I do?" decision.
2. **Trigger** — time-based, ~6am, or menu on demand.
3. **Action** — read People CRM / Projects / Skills / Events / Opportunities; write 3–6 proposed rows.
4. **Destination** — `Daily Tasks`, Status `Proposed`.
5. **Verification** — none needed; it reads existing data and asserts nothing new.
6. **Failure handling** — wrapped in try/catch; logged to Executions; other steps continue. Re-running the same day is refused rather than duplicating.
7. **Human approval** — mandatory. Nothing happens until you set Approved.

### A2 — Verification decay sweep
1. **Purpose** — stop stale facts from masquerading as verified.
2. **Trigger** — daily, with A1.
3. **Action** — any row with Status `VERIFIED` and Date Verified older than 90 days becomes `OUTDATED`.
4. **Destination** — People CRM, Target Companies, Organizations.
5. **Verification** — the sweep *is* the verification control.
6. **Failure handling** — try/catch; the sweep is idempotent.
7. **Human approval** — not required to *downgrade*. **Upgrading back to VERIFIED is human-only, always.** The asymmetry is the safety property.

### A3 — Morning brief email
1. **Purpose** — get the red numbers and today's proposals in front of you before you open the sheet.
2. **Trigger** — daily, after A1 and A2.
3. **Action** — compose HTML from the Dashboard red block + today's tasks.
4. **Destination** — your own inbox. Nobody else's, ever.
5. **Verification** — n/a; reports existing state.
6. **Failure handling** — if MailApp fails, tasks are already in the sheet; the brief is convenience, not record. Gmail consumer quota is 100 emails/day; you use 1.
7. **Human approval** — n/a (self-addressed).

### A4 — Weekly score
1. **Purpose** — an honest number instead of a feeling.
2. **Trigger** — manual, Sunday, from the menu.
3. **Action** — count the machine-countable metrics for the trailing 7 days; append a Weekly Review row.
4. **Destination** — `Weekly Review`.
5. **Verification** — counts derive from dated rows you entered.
6. **Failure handling** — if a sheet is empty, counts are 0, which is the correct answer.
7. **Human approval** — you fill the judgment columns (follow-ups sent, posts, hours, finances) and answer S:Y. **The script deliberately cannot score the qualitative half.**

### A5 — Calendar blocks (manual, one-time)
1. **Purpose** — implementation intentions, not intentions.
2. **Trigger** — you, once, in week 1.
3. **Action** — recurring Google Calendar events: Mon–Fri 08:00–10:15 "Positioning OS"; Fri 16:00 "Weekly sweep"; Sun 17:00 "Score + reset".
4. **Destination** — Google Calendar.
5. **Verification** — n/a.
6. **Failure handling** — if you miss a block, the follow-up queue turns red and the system self-reports.
7. **Human approval** — n/a.

**[R]** Gollwitzer & Sheeran's meta-analysis of 94 tests (8,000+ participants)
found implementation intentions — specifying *when, where and how* — produced a
medium-to-large effect on goal attainment (d = 0.65), robust to publication-bias
adjustment. **[I]** This single unglamorous step is better evidenced than any
software in this file. A calendar block that names the time and place is doing
more work than the Apps Script.

---

## §4. What I am deliberately not automating, and why

| Tempting | Why not |
|---|---|
| **Auto-send follow-up emails** | Destroys the asset. A templated message is detectable and reclassifies you from "person" to "campaign". |
| **Scrape LinkedIn for contacts** | Against LinkedIn's terms; produces unverified data; and `05-people-and-firms.md` §3 explains why LinkedIn cannot be your verification source anyway. |
| **Auto-enrich people rows from an API** | Data brokers are frequently stale and you would not know which fields to distrust. Twelve manual minutes buys certainty. |
| **Zapier / Make** | Adds a paid dependency, a second failure surface, and a place for logic to hide. Everything here runs in Apps Script, which is free and lives inside the file. |
| **Notion** | A second database to keep in sync with the first. Sheets + Drive is sufficient — see `12-daily-weekly-os.md` §KMS. |
| **An LLM auto-drafting your outreach** | The message is the product. Drafting is where you decide what you actually think about the person's market. |
| **Auto-marking anything VERIFIED** | The single rule the whole system depends on. |

**[I]** Every one of these would make the system look more impressive and work
less well. The failure mode of over-automated personal systems is not that they
break — it is that they keep running while quietly producing garbage, and you
trust the garbage because a machine produced it.
