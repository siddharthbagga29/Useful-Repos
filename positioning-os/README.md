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

The webhook goes in the **same Apps Script project as `buildWorkbook`** (the one opened from the sheet via
**Extensions → Apps Script**), as a **second file**. Keep your `Code.gs` exactly as it is. Everything in
`Code.gs` from this folder sits inside one namespace, so its names can't collide with `buildWorkbook`'s
(`SHEETS`, helpers, and so on). Leave `appsscript.json` as it is: Apps Script works out the permissions itself.

1. Open the **Positioning OS** sheet → **Extensions → Apps Script**.
2. In **Files**, click **+** → **Script** → name it `Webhook` (it becomes `Webhook.gs`).
   Paste the whole of [`Code.gs`](Code.gs) from this folder into it → **Save** (⌘S).
3. In the function dropdown next to **Debug**, pick `webhookSelfTest` → **Run** → **Review permissions** →
   your Google account → **Advanced** → **Go to … (unsafe)** → **Allow**. Google says "unsafe" for every
   personal script that isn't published on the Marketplace.
   Check the sheet: a `TEST — delete me` row appears in People CRM, Target Companies and Opportunities,
   and a `Web Activity` tab appears. Delete the three TEST rows.
4. Pick `webhookInstallTriggers` → **Run**. This creates the hourly Dashboard refresh.
5. **Deploy → New deployment** → ⚙ next to *Select type* → **Web app**.
   *Execute as*: **Me**. *Who has access*: **Anyone** (not "Anyone with Google account") → **Deploy**.
   Copy the **Web app URL** (it ends in `/exec`).
6. Send that URL to Claude, or put it in `portfolio/.env.production` as `VITE_SHEETS_WEBHOOK=` and run
   `scripts/deploy.sh`.

To check the URL by hand, open it in a browser. It should show `{"ok":true,"service":"positioning-os-webhook",…}`.

Updating later: edit `Webhook.gs` → **Deploy → Manage deployments → ✎ → Version: New version → Deploy**.
The URL stays the same.

## Tests

`node harness.test.mjs` runs `Code.gs` against an in-memory copy of the sheet's real layout: ID sequencing,
dedupe of repeat senders, firm matching, no PII in the raw log, formula injection, formula cells left alone,
CPI arithmetic, rate limiting and oversize payloads.
