# Prompt to send to the Nexus session

Fill in the two values from `nexusCredentials` first, then send everything
below the line. Do not commit the filled-in version — it carries the token.

---

I'm adding a second system as a data source for the Nexus Control Center. It is
called **Positioning OS**. It already runs and already produces data. Your job
is to read it, surface it in the Control Center, and send my decisions back —
not to rebuild it.

## What it is

A private-markets research system that runs itself daily while I wait for US
work authorization. Two halves:

- **Google Apps Script**, bound to a Google Sheet, runs at 07:00 on Google's
  servers. Pulls Census County Business Patterns across seven counties — the
  four Ohio ones (Hamilton, Butler, Warren, Clermont) and the three Northern
  Kentucky ones (Boone, Kenton, Campbell) — repairs its own dashboard formulas,
  audits the CRM, and emails me at 08:00.
- **Python + Playwright on my MacBook**, runs at 07:15 via launchd. Screens SEC
  EDGAR Form D for new fund closes in OH/KY/IN, watches eight firm and
  association pages for change, and on Sundays runs the Opportunity Scout over
  the Deal Pipeline. Writes to the sheet through the Apps Script endpoint. If
  the Mac is asleep at 07:15 the day is skipped, not caught up — `mac_ran` in
  the digest tells you.

It now also carries my acquisition plan (`acquisition-research/`), an IC-grade
research pack that sets the thesis:

- **Focus industry:** commercial fire protection & life safety, inspection-led
  (sprinkler, alarm, extinguisher, kitchen suppression, backflow ITM).
  Alternate: commercial pest control. The industry decision is re-tested in the
  field around day 43 and may switch.
- **First deal profile:** Cincinnati MSA, $0.6–1.5m adjusted EBITDA, ≥50%
  inspection/service revenue, 4.5–6.0x, so $2.7–9.0m. My cash contribution: $0.
- **Realistic timing:** first LOI around **2029–30**. Not in the next 90 days.
  The 90-day plan builds the thesis, the case library, the operator pipeline
  and my career position — it does not buy anything.
- **SBA is closed to me.** Since 1 March 2026 SBA 7(a)/504 requires every owner
  to be a US citizen or national; green-card holders are excluded. Every
  structure is non-SBA. Never suggest one.

The 90-day calendar is loaded into a **Plan 90** tab: three goals a day, each
with its time, deliverable and done-condition.

## Do not touch the Telegram bot

You own it. Positioning OS does not and never will — it has no webhook
registration and its direct-send mode is off by default. Telegram allows one
webhook per bot, and a second claimant cuts the first off silently. **Do not
change the webhook while wiring this up.**

## The API

Base URL: `PASTE_BASE_URL_HERE`
Token: `PASTE_TOKEN_HERE`

- `GET {base}?token={token}&action=ping` — liveness
- `GET {base}?token={token}&action=digest&since={last_generated}` — one morning
  card: today's counts, open escalations, opportunities awaiting a decision
- `GET {base}?token={token}&action=today` — **today's three goals** from the
  90-day plan: block, action, minutes, deliverable, done-condition, status
- `GET {base}?token={token}&action=week` — this week's progress against the
  scorecard targets, and any recorded blockers
- `GET {base}?token={token}&action=pending&claim=1` — items to present.
  `claim=1` flips OPEN to PENDING so nothing is ever shown twice
- `POST {base}` with
  `{"token":"{token}","decide":[{"id":"OPP-…","decision":"APPROVED","by":"nexus","note":"…"}]}`
- `POST {base}` with
  `{"token":"{token}","complete":[{"day":2,"block":"CAREER","minutes":45,"notes":"…"}]}`
  to tick a goal off

`decision` is `APPROVED` or `SKIPPED`. The response reports each id as `ok`,
`not found` or `bad decision`.

## What I want you to build

0. **Be the butler.** Each morning, read `action=today` and give me my three
   goals — the action, how long it should take, and what "done" means. In the
   evening ask which are done and POST `complete` for those. If I try to add a
   fourth thing, put it on the parking lot and tell me it is there: file 11 is
   explicit that a fourth goal is how the day fails. Three blocks, always:
   CAREER, ACQUISITION, NETWORK.

1. **A Positioning OS section in the Control Center**, fed by `action=digest`,
   polled once each morning after 07:15 America/New_York. Store the `generated`
   timestamp and pass it back as `since` so escalations are not repeated.

2. **Opportunities routed into the existing scraped-opportunities section**,
   tagged source `positioning-os`, type `private-markets`. Each carries an SEC
   filing URL — keep it, it is the primary source.

3. **An approval flow over the bot you already own.** Fetch with `claim=1`,
   send one message per item with Approve / Skip, and POST the decision back.
   Approving is not cosmetic: my Mac's next run turns an approved item into a
   CRM company record and queues the team-page sourcing.

   Two kinds arrive. **Form D filings** daily — a fund that just closed.
   **Screened acquisition targets** weekly on Sunday — fire & life safety firms
   that clear the first-deal profile. A screened target is *not* a buy signal;
   it is a firm worth knowing. Show both the score and what has not been
   established, because a 6/6 on six known fields is less examined than an
   8/12, not better.

4. **A health line.** `today.mac_ran: false` means my laptop was asleep and
   browser research did not run. `today.failures > 0` means a module failed.
   Surface both plainly rather than reporting a quiet day.

## Rules you must carry through

These are not style preferences. They are the reason the data is worth
anything, and breaking them is worse than showing nothing.

1. **Every person is UNVERIFIED** until I confirm the title on the firm's own
   page. Never present a scraped name as a confirmed title, and never put one
   into a drafted message. One team page prints titles above names rather than
   below, which silently gave people their colleague's title until it was
   caught.
2. **Never invent private-company financials.** An estimate must carry its
   method. `UNKNOWN` means unknown.
3. **I am not currently authorized to work.** Every opportunity carries
   `authorization_cleared` and `counsel_reviewed`. Approving queues *research*,
   nothing else. Do not imply any opportunity is actionable as employment, and
   do not give legal advice.
4. **Never fabricate.** If something cannot be verified, label it UNVERIFIED
   rather than filling the gap. The research pack says **n/d** where a figure
   was undisclosed; keep it that way.
5. **Never present a target as a deal that could happen now.** First LOI is
   realistically 2029–30, behind an EAD, a signed operator and committed
   capital. Six gates must all be met first, and two of them are counsel's
   call, not mine and not yours.

## Constraints

- Apps Script Web Apps are rate-limited. Once a morning, plus `ping` if you want
  liveness. Polling every few minutes will exhaust the quota.
- The `/exec` URL changes on every new deployment. If calls start failing with a
  404 or HTML instead of JSON, tell me to re-run `nexusCredentials`.
- The token in a URL is the only auth. Keep both in your config store.

## Before you build

Call `action=ping`, then `action=digest`, and show me what comes back. If the
shapes differ from what I described above, say so rather than coding around it
— I would rather fix the source than have two systems disagree about it.
