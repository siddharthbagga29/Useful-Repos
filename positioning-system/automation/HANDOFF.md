# Handoff prompt — paste this into Claude Code running on the MacBook

Run `claude` inside `~/positioning-os`, then paste everything below the line.
It is self-contained: a cold session becomes fully competent from it alone.

---

You are finishing the deployment of a personal research-automation system on this
Mac. The repo is already cloned at the folder you are in. Read these first, in
full, before doing anything:

- `positioning-system/automation/README.md` — the setup contract
- `positioning-system/automation/src/` — the code you are deploying
- `positioning-system/01-diagnosis.md` §B — why accuracy matters more than output here
- `positioning-system/19-verification-protocol.md` — the sourcing standard

## Context you need

Siddharth Bagga, 23, Cincinnati. M.S. Finance (Lindner, UC, 2025) — **not**
"Financial Mathematics". Indian national married to a U.S. citizen; adjustment
of status pending, **he is not currently authorised to work**. He is building
credibility in Cincinnati lower-middle-market private capital during the wait.

The system: Python + Playwright on this Mac researches daily and writes rows to
a Google Sheet; Apps Script on Google's servers emails a daily "what was done +
KPIs" report and a Sunday narrative report. No reminders — reports of work done.

## Why the architecture looks like this (do not undo these decisions)

1. **No Google Cloud.** `iam.disableServiceAccountKeyCreation` is enforced on his
   account and he has no Organization Policy Administrator. Service-account keys
   are impossible. The Mac posts to an Apps Script Web App instead
   (`apps-script/Ingest.gs`), authenticated by a shared token.
2. **Email lives in Apps Script, not Python.** It runs on Google's servers, so
   reports arrive whether or not this laptop is open. No SMTP credentials on disk.
3. **Census runs first and isolated** in `run_daily.py`, so a browser failure can
   never cost the one deliverable that always works.
4. **Scraping detects change; it does not assert facts.** A content-hash
   difference on a small firm's team page is almost always a hire, departure or
   promotion — that is the signal. Extracted people are written UNVERIFIED with
   the page URL, because name/title extraction from arbitrary HTML is unreliable
   and a wrong title in a cold email ends the conversation.

## Your tasks, in order

1. **Run the installer** — `positioning-system/automation/install.sh`. It creates
   `~/.positioning-os/venv`, installs Playwright + Chromium, and loads two
   launchd jobs.
2. **Help him deploy `apps-script/Ingest.gs`** if not done: paste into the sheet's
   Apps Script project, run `setupIngestToken`, deploy as Web app (Execute as: Me,
   Access: Anyone), then put the `/exec` URL and token into
   `positioning-system/automation/config.json`. He must do the browser clicks; you
   write the file.
3. **Run `src/selftest.py`.** Do not proceed until every line is OK. It checks
   config → endpoint → token → a real row landing in the sheet → Census → Playwright.
4. **Run `src/run_daily.py` for real, then fix what breaks.** Two things are known
   untested and are your real work:
   - **Playwright selectors in `src/scrape.py`.** The team-page and event-page
     heuristics have never run against the live sites in `config.json`
     `watch_sources`. Expect some URLs to 404 or have moved. Fix the URLs, and
     tighten `_people_candidates` only if it is clearly over- or under-matching.
   - **`src/edgar.py`.** The EDGAR full-text endpoint shape is a best guess. If it
     returns nothing or errors, find the correct current endpoint and fix it.
5. **Verify end to end**: rows actually in the sheet's Agent Log, Investment
   Research, Agent Memory tabs; then run `emailDailyWorkReport` from the Apps
   Script editor and confirm the email arrives.
6. **Commit and push** to branch `claude/private-markets-positioning-system-b5twgr`.
   Never commit `config.json` — it holds the ingest token and is gitignored.

## Rules that override everything

- **Never write anything claiming he is currently authorised to work**, available
  to start, or able to accept a role. Never draft anything accepting or
  soliciting paid work, unpaid trial work, a "sample project", equity, or
  anything of value. If a task touches this, stop and flag it.
- **Never invent a person, title, firm, deal, statistic or figure.** No resolvable
  primary source means mark it UNVERIFIED and say what you could not confirm.
  A blank beats a plausible guess.
- **Never produce a private-company revenue or valuation** without
  `Revenue Basis = REPORTED`.
- **Drafts only.** Nothing in this system sends email to a third party.

## How to report back

When done, write a short summary to
`positioning-system/automation/DEPLOY-LOG.md` and commit it: what works, what you
fixed, what is still broken, and the exact error text for anything unresolved.
He will paste that back into the cloud session that designed this.
