# Deploy — do this once, it is the step that has been blocking everything

**Code in this repo is not running code.** The `EMAIL_BRIEF = false` fix was
committed on 2026-10-01 and the reminder email kept arriving on the 5th, 6th and
7th because the live Apps Script was never updated. Verified from the sent
folder: identical emails at 10:17:48 UTC each day.

## Steps (5 minutes)

1. Open the **Positioning OS** sheet → **Extensions → Apps Script**.
2. Replace the whole contents of `DailyEngine.gs` with this repo's version.
3. **+ → Script**, name it `Analyst`, paste `Analyst.gs`.
4. Confirm `BuildWorkbook.gs` matches this repo's version too.
5. **Save all.**
6. Run `testAnalystNow` from the function dropdown. Authorise when prompted —
   it will ask for external-request access, which it needs for the Census API.
7. **Check your inbox.** You should get a report titled
   *"Positioning OS — <date> — N establishments pulled, M follow-ups overdue"*
   with a table of real county figures, each linking to its own Census API URL.

If step 7 produces errors instead of figures, the email says exactly which
county failed and with what HTTP code, and includes the URL so you can open it
yourself. Send me that and I will fix it.

## What changes after this

| Before | After |
|---|---|
| Daily email listed tasks for you to do | Daily email reports work already done |
| No data entered the sheet by itself | Real Census establishment counts appended to Investment Research every day |
| Dashboard formulas could be silently destroyed | `repairDashboard_()` restores them every run |
| CRM rot invisible | Overdue follow-ups, missing "Value I Can Give", and UNVERIFIED rows surfaced daily |

## What is deliberately NOT automated

Outreach drafting, sourcing people from firm team pages, and memo writing need
judgment. Five scheduled Claude sessions were tested 1–6 October; every one
ended in 30–90 seconds having produced nothing, because a fired session gets a
single turn. That path is abandoned, not hidden behind a retry.

Those tasks happen in a Claude session you start. The difference is that the
deterministic 80% now runs without you, every day, on infrastructure that has
not missed a morning.
