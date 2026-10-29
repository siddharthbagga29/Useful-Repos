# Automation — setup on your MacBook

What this does, end to end:

```
MacBook (launchd, daily 07:15)
   ├── Census CBP API ──────────┐
   ├── SEC EDGAR Form D ────────┤
   └── Playwright: team pages,  ├──► writes rows to your Google Sheet
       event calendars ─────────┘     (+ Escalations, + Agent Memory)

Google (Apps Script, 24/7)
   ├── 08:00 daily  → "what was done + KPIs" email
   └── Sun 18:00    → weekly narrative report
```

**Why split like this.** Research needs a browser and a real runtime, so it runs
on your Mac. Email must arrive whether or not your laptop is open, so it runs on
Google's servers. Nothing in Python touches your email credentials.

---

## Step 1 — Apps Script ingest endpoint (5 min, no Google Cloud)

Google's Secure-by-Default policy (`iam.disableServiceAccountKeyCreation`)
blocks service-account key downloads on consumer accounts, so the normal Sheets
API path is unavailable. We skip Google Cloud entirely: the Mac posts to an
Apps Script Web App, which already has full access to the workbook.

In your sheet → **Extensions → Apps Script**:

1. **+ → Script**, name it `Ingest`, paste `apps-script/Ingest.gs`. Save.
2. Run **`setupIngestToken`** once. Authorise. It shows a long token — copy it.
3. **Deploy → New deployment → ⚙ → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - **Deploy**, authorise, and copy the **Web app URL** (ends `/exec`).

⚠️ *"Anyone"* means anyone **with the URL** can reach it — that is why every
request carries the token, which is checked before anything is written. Keep the
URL and token out of the repo; `config.json` is gitignored.

If you later change `Ingest.gs`, use **Deploy → Manage deployments → ✏️ → New
version**, or the `/exec` URL keeps serving the old code.

## Step 2 — Install on the Mac (5 min)

```bash
git clone -b claude/private-markets-positioning-system-b5twgr \
  https://github.com/siddharthbagga29/Useful-Repos.git ~/positioning-os
cd ~/positioning-os/positioning-system/automation
cp config.example.json config.json
```

Edit `config.json` and paste the two values from step 1 into `ingest_url` and
`ingest_token`. Census now refuses keyless requests (it redirects to
`missing_key.html`), so also request a free key at
<https://api.census.gov/data/key_signup.html> and paste it into
`census_api_key`. `config.load()` refuses to run without it. Note the key is
part of every Census URL, including the Source URL cells written to the sheet,
so each figure stays one-click reproducible. Then:

```bash
./install.sh
```

That creates `~/.positioning-os/venv`, installs Playwright and Chromium, writes
both launchd jobs with your real paths, and loads them.

## Step 3 — Self-test before trusting the schedule

```bash
~/.positioning-os/venv/bin/python \
  ~/positioning-os/positioning-system/automation/src/selftest.py
```

It checks config → endpoint → token → a real row landing in the sheet → Census
→ Playwright, and names the fix for anything that fails. Expect:

```
config ...................... OK
apps script endpoint ........ OK (wrote 1 row)
census api .................. OK (NAICS 5617, 1,2xx establishments)
playwright .................. OK

ALL GREEN — scheduled runs will work.
```

Confirm the **SELFTEST** row appears in the *Agent Log* tab. Then do a real run:

```bash
~/.positioning-os/venv/bin/python \
  ~/positioning-os/positioning-system/automation/src/run_daily.py
```

| Error | Fix |
|---|---|
| `flush refused: bad token` | Token in `config.json` ≠ `setupIngestToken` output |
| `ingest_url does not look like…` | Paste the `/exec` URL, not the editor URL |
| `Executable doesn't exist` | `~/.positioning-os/venv/bin/python -m playwright install chromium` |
| `census api key ... FAILED` (invalid or not yet activated) | Paste the emailed key into `census_api_key` (activate it from the email first) |
| Census `HTTP 404` | Census retired that vintage — lower `census_year` in `config.json` |

## Step 4 — Apps Script side (5 min)

In the sheet → **Extensions → Apps Script**:

1. Add a file `Reporter`, paste `apps-script/Reporter.gs`.
2. Make sure `DailyEngine.gs` and `Analyst.gs` match this repo (see `apps-script/DEPLOY.md`).
3. Run **`setupReporterTriggers`** once and authorise.

That schedules the 08:00 daily work report and the Sunday 18:00 weekly report,
and **removes the old reminder triggers**.

## Step 5 — Confirm it is alive tomorrow

```bash
launchctl list | grep positioningos          # both jobs listed
tail -20 ~/.positioning-os/logs/daily.out    # yesterday's run
```

---

## The laptop-asleep problem — read this

launchd does **not** run a job while the Mac is asleep, and `StartCalendarInterval`
fires on wake only if the machine wakes at all. A closed laptop silently skips
the day.

Three options, in order of how much I'd recommend them:

1. **Leave the lid open on charge overnight** — simplest, costs nothing.
2. **`sudo pmset repeat wakeorpoweron MTWRFSU 07:10:00`** — schedules a wake five
   minutes before the job. Works on most Macs on AC power.
3. Accept gaps. The Apps Script side still runs every day regardless, so you
   always get the Census pull and the KPI email; only the browser work pauses.

The daily email says **"No agent run recorded in the last 24 hours"** in red when
this happens, so a silent gap is impossible.

---

## How it evolves

`Agent Memory` is a real table you can read, not a black box:

| Column | What it changes |
|---|---|
| `Consecutive Failures` | 3 strikes and the source is dropped from the rotation and escalated to you |
| `Items Found (total)` | productive sources get a lower (better) `Priority` and are scraped first |
| `Content Hash` | a change versus last run is what triggers a HIGH escalation |
| `Priority` | recomputed each run from yield and failures |

So the agent genuinely changes behaviour from experience — it stops scraping
dead URLs, front-loads sources that produce, and only interrupts you when a page
actually moved. And every one of those decisions is a number you can audit.

## How escalation works

| Severity | Trigger | You hear about it |
|---|---|---|
| **HIGH** | A target firm's team page changed · Census returned nothing · scraper crashed | Same-day email, top of the message |
| **MEDIUM** | New Form D filings · event page changed · a source was retired | Weekly report |
| **LOW** | Routine logging | Sheet only |

A team-page change is HIGH on purpose: at a four-person firm that is almost
always a hire, a departure or a promotion, and a new hire is the single best
reason you will ever have to make contact.

## What is deliberately NOT automated

Outreach drafting, confirming a person's title, and memo writing. The scraper
extracts person *candidates* and marks every one **UNVERIFIED** with the page
URL — because extracting names from arbitrary HTML is unreliable, and a wrong
title in a cold email ends the conversation. You confirm before it is used.

That is the same standard as the rest of the system: a blank beats a plausible guess.
