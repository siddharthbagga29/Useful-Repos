# Positioning OS → Nexus Control Center

Positioning OS does **not** own a Telegram bot and never registers a webhook.
Telegram allows one webhook per bot; a second system claiming it cuts the first
one off silently, with no error on either side. Nexus owns the bot. This system
is a source Nexus reads, and a sink it posts decisions back to.

`TELEGRAM_MODE` defaults to `nexus`, so the daily Telegram push here is inert
unless Positioning OS is ever given a bot of its own.

---

## Credentials

Run **`nexusCredentials`** from the Apps Script editor. It prints the base URL
and token and the three ready-made URLs. Both values are secrets: they belong in
Nexus's own config store, not in a repo.

---

## Endpoints

All are the same Apps Script Web App URL. `token` is required on every call.

### `GET ?token=T&action=ping`
Liveness. Confirms the deployment is up and names the workbook.

```json
{"ok":true,"system":"positioning-os","sheet":"Positioning OS","url":"https://docs.google.com/…"}
```

### `GET ?token=T&action=digest[&since=ISO8601]`
Everything for one morning card, in one call.

```json
{
  "ok": true,
  "system": "positioning-os",
  "generated": "2026-10-30T07:30:00-04:00",
  "sheet_url": "https://docs.google.com/…",
  "today": { "establishments": 321, "form_d": 9, "changes": 0,
             "people": 12, "failures": 0, "mac_ran": true },
  "counts": { "contacts": 4, "companies": 25, "research": 1,
              "opportunities": 9, "awaiting_decision": 2 },
  "escalations": [ { "id","severity","category","what","why","action","url","raised" } ],
  "pending":     [ { "id","type","title","organization","why","next_action",
                     "authorization_cleared","counsel_reviewed","status","source","actions" } ]
}
```

`since` filters escalations to those raised after that timestamp — pass the
previous run's `generated` value to get only what is new.

`today.mac_ran` false means the laptop was asleep: browser research did not run,
and the Census figure came from the Google half. Say so rather than reporting a
quiet day.

### `GET ?token=T&action=pending[&claim=1]`
Opportunities awaiting a decision. **`claim=1` flips `OPEN` to `PENDING`**, so
whichever surface displays an item owns it and no other surface shows it twice.
Use `claim=1` when actually presenting them; omit it to look without claiming.

### `POST` (JSON body)
```json
{ "token": "T",
  "decide": [ { "id": "OPP-20261030-0715-OH-1",
                "decision": "APPROVED",
                "by": "nexus",
                "note": "buyout fund, size in range" } ] }
```
`decision` is `APPROVED` or `SKIPPED`; anything else is rejected. The response
reports each id as `ok`, `not found` or `bad decision`. Posting the same
decision twice is harmless.

### `GET ?token=T&action=today`
The three goals for today from the 90-day plan (`acquisition-research/10`,
loaded into the **Plan 90** tab). This is the butler script.

```json
{ "ok": true, "in_plan": true, "date": "2026-11-11", "day": 2, "week": 1, "of": 90,
  "total_minutes": 105, "done_today": 0,
  "goals": [ { "day": 2, "block": "CAREER", "action": "…", "minutes": 40,
               "deliverable": "…", "done_when": "…", "status": "OPEN" } ],
  "rule": "Exactly three goals…",
  "counsel_gate": "Anything touching ownership, fees, officer roles or guarantees…" }
```

Three blocks, always: `CAREER`, `ACQUISITION`, `NETWORK`. Never present a
fourth — file 11 is explicit that a fourth goal is the failure mode. Outside
the 90-day window `in_plan` is false and `note` says so.

### `GET ?token=T&action=week`
This week's progress against the file 11 scorecard: goals done over goals
total, focused minutes, recorded blockers, and the weekly targets to compare
against.

### `POST` — ticking a goal
```json
{ "token": "T", "complete": [ { "day": 2, "block": "CAREER",
                                "minutes": 45, "notes": "…" } ] }
```
Each returns `ok`, `already done`, `not found` or `no plan`.

### `GET ?token=T&tab=<tab name>`
Raw rows from any tab, for anything the digest does not cover.

---

## Where opportunities come from

Two sources, both arriving as `pending` items:

**Form D filings** — daily, from SEC EDGAR. A manager that just closed a fund.

**Screened acquisition targets** — weekly, on Sunday. The Opportunity Scout
reads the **Deal Pipeline** tab, screens every target against the
first-acquisition profile (`acquisition-research/01` answer 4) and the ten IC
rules, and promotes only those that clear it. Three things are hard stops and
no score outweighs them: a price above 6.0x adjusted EBITDA, undocumented
add-backs above 20%, and an unresolved AFFF/PFAS history. A blocked target is
logged with its reason rather than dropped silently.

Weekly, not daily, is deliberate. A target found on Monday is worth more on
Sunday because four days of research have been added to it. Surfacing a bare
name trains the reader to stop looking.

**A promoted target is not a buy signal.** It is a firm worth knowing. The
screen says how many *known* criteria it meets and names what has not been
established — a 6/6 on six known fields is not better than 8/12, it is less
examined. Present both numbers.

## What a decision causes

`APPROVED` is not a label. The Mac's next run turns the fund close into a
**Target Companies** row carrying the SEC filing as its source, and raises one
escalation with a search link for the firm's team page. It does not name people
from search results — a plausible wrong name costs more than a missing one.

`SKIPPED` closes the item and nothing further happens.

---

## Rules any surface must carry

These are not stylistic. They are why the data is worth anything.

1. **People are UNVERIFIED until confirmed on the firm's own page.** Every
   person candidate reaches the sheet with its source URL and a note saying
   where on the page the title came from. Never present one as a confirmed
   title, and never put one into a drafted message.
2. **Never invent private-company financials.** Any estimate must carry its
   method. `revenue_basis: UNKNOWN` means unknown.
3. **The owner is awaiting work authorization.** Every opportunity carries
   `authorization_cleared` and `counsel_reviewed`. Approving an item queues
   *research*, nothing else. Nothing here is legal advice, and no surface
   should imply an opportunity is actionable as employment.
4. **A source that returns nothing is not the same as a quiet day.** Surface
   `today.failures` and `mac_ran` rather than smoothing them away.
5. **The timeline is years, not weeks.** The plan's own conclusion is that a
   first LOI is realistically 2029-30, after an EAD, an operator and capital.
   The 90 days build the thesis, the case library and the pipeline. Never
   present a screened target as a deal that could happen now.
6. **SBA financing is closed.** Since 1 March 2026 SBA 7(a)/504 requires every
   owner to be a US citizen or national; green-card holders are excluded too.
   Every structure in the plan is non-SBA. Do not suggest one.

---

## Polling

Once a morning, after 07:15 local, is enough — that is when both halves have
run. `ping` is cheap if a liveness check is wanted more often. Apps Script Web
Apps are rate-limited; polling every few minutes will exhaust the quota and
nothing will answer.

The `/exec` URL **changes on every new deployment.** If calls start failing,
re-run `nexusCredentials` and update the stored URL.
