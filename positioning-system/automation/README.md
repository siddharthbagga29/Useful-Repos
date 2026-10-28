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

## Step 1 — Google service account (10 min, once)

The sheet needs a non-human identity to write to it.

1. <https://console.cloud.google.com/> → create a project, call it `positioning-os`.
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it `positioning-os-writer`. Skip the optional role steps.
4. Open the service account → **Keys → Add key → Create new key → JSON**. It downloads.
5. `mkdir -p ~/.positioning-os && mv ~/Downloads/positioning-os-*.json ~/.positioning-os/service-account.json`
6. Open that JSON, copy the `client_email` value (looks like
   `positioning-os-writer@…iam.gserviceaccount.com`).
7. Open your **Positioning OS** sheet → **Share** → paste that address → **Editor** → Send.

⚠️ Step 7 is the one people miss. Without it every write fails with a 403.

## Step 2 — Install (5 min)

```bash
git clone -b claude/private-markets-positioning-system-b5twgr \
  https://github.com/siddharthbagga29/Useful-Repos.git ~/positioning-os
cd ~/positioning-os/positioning-system/automation
cp config.example.json config.json
./install.sh
```

`install.sh` creates a venv at `~/.positioning-os/venv`, installs Playwright and
Chromium, writes both launchd jobs with your real paths, and loads them.

## Step 3 — Test before trusting it

```bash
~/.positioning-os/venv/bin/python ~/positioning-os/positioning-system/automation/src/run_daily.py
```

Expect `run 20261028-1130: done, N escalations`. Then open the sheet — there
should be new rows in **Agent Log**, **Investment Research**, **Agent Memory**,
and probably **Escalations**.

If it fails it says exactly which module and why. Common ones:

| Error | Fix |
|---|---|
| `403` from Sheets | Step 1.7 — share the sheet with the service account |
| `Executable doesn't exist` | `~/.positioning-os/venv/bin/python -m playwright install chromium` |
| Census `HTTP 404` | Census retired that vintage; set `census_year` to the prior year in `config.json` |

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
