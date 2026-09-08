# Apps Script — setup and behaviour

Both files live in the **same** Apps Script project. Apps Script shares one
global scope across `.gs` files, so `DailyEngine.gs` uses the `SHEETS` constant
defined in `BuildWorkbook.gs`. Do not put them in separate projects.

## Install (10 minutes)

1. New Google Sheet → name it `Positioning OS`.
2. **Extensions → Apps Script**. Delete the stub `myFunction`.
3. Paste `BuildWorkbook.gs`. Save.
4. **+ → Script** → name it `DailyEngine` → paste `DailyEngine.gs`. Save.
5. Select `buildWorkbook` in the function dropdown → **Run**. Authorise when asked
   (it needs Sheets access, and Gmail access for the brief).
6. Reload the spreadsheet. A **Positioning OS** menu appears in the menu bar.
7. Menu → **Set up daily trigger**.

`buildWorkbook` is safe to re-run — it rebuilds headers, dropdowns, formatting and
formulas without touching your data rows. The one exception is
`Personal Financial Profile`, which is only seeded while it is still empty.

## What the daily trigger actually does at ~6am

| Step | Function | Acts on your behalf? |
|---|---|---|
| Propose today's tasks | `generateDailyTasks` | **No.** Writes rows with Status = `Proposed`, Approved = blank |
| Sweep verification ages | `flagStaleVerification` | Only downgrades `VERIFIED` → `OUTDATED` after 90 days |
| Email the brief | `emailMorningBrief` | Emails **you**, nobody else |

**Nothing is sent to any third party. No row is ever marked VERIFIED by the
script.** Verification is a human act by design — see `../19-verification-protocol.md`.

## How tasks get proposed

Priority order, deliberately:

1. **Overdue follow-ups** (up to 4), sorted A-tier first. These always come first;
   a lapsed relationship is the only irreversible loss in the system.
2. **A new first contact** — but *only* when the follow-up queue is under three,
   so prospecting never crowds out maintenance. If no verified, uncontacted person
   remains, it proposes a sourcing block instead.
3. **The live portfolio project**, with hours and % complete quoted back at you.
4. **A spaced-repetition skill rep** when one is due.
5. **Event pre-brief** at the 48-hour mark; otherwise a Wednesday radar-build
   block; otherwise a research question.
6. **A counsel-review warning** if any Opportunity row is flagged.

Running it twice in a day is a no-op — it refuses rather than duplicating.

## Failure handling

- Trigger runs cannot show dialogs, so `dailyRun_` wraps each step in try/catch
  and writes failures to the Apps Script execution log
  (**Executions** in the editor). A failed step never blocks the others.
- If a sheet is missing, `requireSheet_` throws with the sheet name rather than
  silently producing empty output.
- Gmail has a daily send quota (100/day on consumer accounts). One brief a day is
  far inside it.
- If `MailApp` fails, tasks are still written to the sheet — the brief is a
  convenience, not the system of record.

## Things to change if you want to

- `LAST` (default 1000) — how many rows get pre-formatted and validated.
- Trigger hour — `atHour(6)` in `setupDailyTrigger`.
- Verification staleness — `90` days in `flagStaleVerification`.
- Weekly score caps — the `cap(...)` calls in `applyRowFormulas_`. The current
  weights are documented in `../10-sheets-architecture.md` §Weekly score.
