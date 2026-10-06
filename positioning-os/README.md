# Positioning OS — website webhook

Connects the portfolio (siddharthbagga29.github.io and `/lab/`) to the **Positioning OS** Google Sheet.

| Website signal | Where it lands |
|---|---|
| Any page view, section viewed, Jarvis question, Strategy Lab run | `Web Activity` (new tab; anonymous session id, no names or emails) |
| "Get in touch" message | `People CRM` (new `P-###`, **UNVERIFIED**, Follow-Up Due = DUE), `Target Companies` (new `FIRM-###` if the firm isn't on your radar), `Opportunities` (Job / Deal / Introduction) |
| Calendly booking | `Opportunities` (Stage: Active conversation) |
| Hourly, and after every post | `Dashboard` → *Follow-ups overdue*, *Unverified people rows* (skipped if those cells are formulas), plus a **🌐 WEB** block with Sessions, Engaged sessions, Inbound, Bookings, **CPI**; one row per day in `Web Metrics` |

**CPI — Conversion & Profile Index** = 1,000 × (inbound messages + Calendly bookings) ÷ sessions, last 30 days.
Read it as *conversations started per 1,000 visits*. (A literal cost-per-interaction is $0 here: nothing is paid for.)

**Engaged session** = score ≥ 8, where a section view = 1, Jarvis question or Lab run or résumé = 2, opening the
contact form or the scheduler = 3, a message or a booking = 10. Anonymous engaged sessions are counted on the
Dashboard rather than logged as Opportunities — there is no person to follow up with.

Inbound people are written as **UNVERIFIED / Low confidence** with the email in Notes, so your own rule
("never use unverified rows in conversation") still holds until you check them.

## Deploy (10 minutes, once)

1. Open the **Positioning OS** sheet → **Extensions → Apps Script**.
2. Delete what's in `Code.gs`, paste the contents of [`Code.gs`](Code.gs), save.
3. ⚙ **Project Settings** → tick **Show "appsscript.json" manifest file in editor** → open `appsscript.json` and
   replace it with [`appsscript.json`](appsscript.json), save.
4. Select `selfTest` in the function dropdown → **Run** → **Review permissions** → choose your Google account →
   *Advanced* → *Go to … (unsafe)* → **Allow**. (Google shows "unsafe" for every personal script that isn't
   published to the Marketplace. The script only asks for: this spreadsheet, and creating its own trigger.)
   Check the sheet: a `TEST — delete me` row appears in People CRM, Target Companies and Opportunities. Delete those rows.
5. Select `installTriggers` → **Run** (creates the hourly dashboard refresh).
6. **Deploy → New deployment** → type **Web app** → *Execute as*: **Me** → *Who has access*: **Anyone** → **Deploy**.
   Copy the **Web app URL** (ends in `/exec`).
7. Send that URL to Claude (or put it in `portfolio/.env.production` as `VITE_SHEETS_WEBHOOK=` and run
   `npm run build && scripts/deploy.sh`).

Updating later: edit `Code.gs` → **Deploy → Manage deployments → ✎ → Version: New version → Deploy**.
The URL stays the same.

## Tests

`node harness.test.mjs` runs `Code.gs` against an in-memory copy of the sheet's real layout: ID sequencing,
dedupe of repeat senders, firm matching, no PII in the raw log, formula injection, formula cells left alone,
CPI arithmetic, rate limiting and oversize payloads.
