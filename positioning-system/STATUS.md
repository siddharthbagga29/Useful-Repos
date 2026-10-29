# Positioning OS — status

**As of 29 October 2026.** Everything below marked VERIFIED was observed
running, not inferred from the code.

---

## What exists

Two halves that do not depend on each other to survive.

**Google's servers (Apps Script, `apps-script/PositioningOS.gs`, 442 lines)**
One file, bound to the Positioning OS spreadsheet. It holds the custom menu, a
token-protected `/exec` endpoint the Mac posts rows to, Dashboard formula
self-repair, a Census fallback, a CRM audit, and both report emails. It runs on
Google's machines, so it works with the laptop shut.

It is one file on purpose. This project was broken three separate times by a
version-skewed paste — a fix sat undeployed for six days while the old reminder
kept mailing, `Ingest.gs` was a version behind and hung on an editor dialog, and
`Code.gs` still held the first `DailyEngine` weeks after it was replaced. Four
files kept in sync by hand was the defect. One file cannot drift.

**The Mac (Python + Playwright, `automation/`)**
Pulls Census County Business Patterns, screens SEC Form D for new fund closes,
and watches eight firm and association pages for change. Writes everything to
the sheet through the endpoint in a single POST per run. It never sends mail —
no SMTP credentials on disk, and the report arrives whether or not the laptop
is open.

**Why not a service account:** Google enforces
`iam.disableServiceAccountKeyCreation` on consumer accounts. The key could never
be created. The Apps Script endpoint replaces it entirely.

---

## Verified working

| | Evidence |
|---|---|
| Endpoint writes to the sheet | `SELFTEST-GS` row in Agent Log |
| Full chain | `selftest.py` — ALL GREEN, every check |
| Census | NAICS 5617 → 1,074 establishments; NAICS 5613 → 321 |
| SEC Form D | Returned OH/KY/IN filings; now in Opportunities |
| Watch sources | 8 of 8 reachable, HTTP 200 |
| Daily run | 43 rows written — Apps Script's own count, not the Mac's |
| Report email | Delivered, read, and its three defects since fixed |

---

## The schedule

| When | Where | What |
|---|---|---|
| 07:00 daily | Google | Census (if the Mac hasn't), Dashboard repair, CRM audit |
| 07:15 daily | Mac | Eight sources scraped, change detected, Form D screened |
| 08:00 daily | Google | Report email: what was **done**, plus KPIs |
| Sun 17:00 | Mac | Writes the weekly row |
| Sun 18:00 | Google | Weekly email |

`RunAtLoad` is off on both launchd jobs: **if the Mac is asleep at 07:15 the day
is skipped, not caught up.** The Google half still runs, so a Census pull and the
report arrive regardless — the email will say the Mac did not run.

---

## What to expect

**Tomorrow** is the first run that can detect *change*. Today only recorded
baseline hashes for the eight sources. From here, a modified team page at
Roebling, Silverstone or REAG raises a HIGH escalation and leads your 08:00
email. On a small firm's team page that is almost always a hire, a departure or
a promotion — the best reason you will ever get to make contact.

**Sunday 1 November** is the first weekly report. The Weekly Report tab is empty
until then.

**Steady state:** roughly 300–1,100 establishments logged per day as the NAICS
rotation moves through seven codes, a handful of Form D filings a week, and a
change escalation whenever one of the eight sources moves.

**What it will not do:** apply for anything, send a message, or assert a fact it
cannot source. Every extracted person is written UNVERIFIED with the page URL,
because a name wearing a colleague's title is worse than no name at all.

---

## Open, and why each matters

**Two hollow team pages.** River Cities Capital and Northcreek Mezzanine answer
HTTP 200 with under 900 characters and yield nobody, while Roebling returns
6,308 and REAG 1,958. They pass every check while sourcing no one, which is the
failure a monitoring system is least able to notice. `diagnose_thin.py` loads
both under three wait strategies and prints what they contain.

**Four contradictions in the résumé** — `01-diagnosis.md` §B. No automation
touches this. A referral that ends with someone reading an inconsistent résumé
costs you the relationship that produced it.

**Immigration counsel, still unbooked.** The system is deliberately built to
stop short of anything resembling employment, and every Opportunity row carries
an authorization column for that reason. Where that line falls is a lawyer's
call, not this system's.

**Google storage is nearly full.** If Drive fills, sheet writes and Gmail both
stop. That would present as an agent failure and would not be one. Web Activity
(756 rows) and Daily Tasks (229 rows, from the retired reminder generator) are
the two largest tabs and feed nothing.

---

## When something looks wrong

1. **Agent Log** — every module, every run, with the source URL and the error.
2. **Escalations** — anything open, by severity.
3. **Agent Memory** — per source: consecutive failures, last success, hash.
   Three failures in a row retires a source and raises a MEDIUM.
4. `~/.positioning-os/logs/daily.err` on the Mac.
5. `~/.positioning-os/venv/bin/python src/selftest.py` re-checks the whole chain.

A source that fails is loud. A source that silently returns nothing is the
dangerous one — which is why `selftest` now fetches all eight and prints the
character count for each.
