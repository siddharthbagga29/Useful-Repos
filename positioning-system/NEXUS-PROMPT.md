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
  servers. Pulls Census County Business Patterns for the four-county Cincinnati
  region, repairs its own dashboard formulas, audits the CRM, emails me at
  08:00.
- **Python + Playwright on my MacBook**, runs at 07:15 via launchd. Screens SEC
  EDGAR Form D for new fund closes in OH/KY/IN, and watches eight firm and
  association pages for change. Writes to the sheet through the Apps Script
  endpoint.

The thesis it serves: Cincinnati lower-middle-market private equity,
independent sponsors, search funds. A manager that just closed a fund has
capital it must deploy, and two-to-six person firms add junior headcount when
they do — seats that are never posted anywhere. That is the signal.

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
- `GET {base}?token={token}&action=pending&claim=1` — items to present.
  `claim=1` flips OPEN to PENDING so nothing is ever shown twice
- `POST {base}` with
  `{"token":"{token}","decide":[{"id":"OPP-…","decision":"APPROVED","by":"nexus","note":"…"}]}`

`decision` is `APPROVED` or `SKIPPED`. The response reports each id as `ok`,
`not found` or `bad decision`.

## What I want you to build

1. **A Positioning OS section in the Control Center**, fed by `action=digest`,
   polled once each morning after 07:15 America/New_York. Store the `generated`
   timestamp and pass it back as `since` so escalations are not repeated.

2. **Opportunities routed into the existing scraped-opportunities section**,
   tagged source `positioning-os`, type `private-markets`. Each carries an SEC
   filing URL — keep it, it is the primary source.

3. **An approval flow over the bot you already own.** Fetch with `claim=1`,
   send one message per item with Approve / Skip, and POST the decision back.
   Approving is not cosmetic: my Mac's next run turns an approved fund close
   into a CRM company record and queues the team-page sourcing.

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
   rather than filling the gap.

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
