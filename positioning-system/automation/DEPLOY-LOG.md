# Deploy log — MacBook, 2026-10-30

Secrets (ingest URL, ingest token, Census key) live only in the git-ignored
`automation/config.json` (mode 600). None appear in this file or any commit.

## What works — verified on this Mac

**Install.** `install.sh` builds `~/.positioning-os/venv`, installs Playwright and
Chromium, and loads both launchd jobs (`com.positioningos.daily` 07:15 daily,
`com.positioningos.weekly` Sun 17:00). Both show in `launchctl list`.

**Endpoint.** A read-only GET to the Web App returned `200 application/json`,
`ok: true`. It is a JSON endpoint, not an HTML page or a 404.

**Self-test** (`src/selftest.py`): ALL GREEN.

```
config ...................... OK
apps script endpoint ........ OK (wrote 1 row)
census api key .............. OK
census api .................. OK (NAICS 5616, 95 establishments)
playwright .................. OK
watch sources ............... OK (all 8 reachable)
```

**Real daily run** `20261030-1604`: exit 0, `wrote 35 rows, 1 escalations`.
Every row below was read back from the sheet through the endpoint:

| Tab | Rows from this run | Content |
|---|---|---|
| Agent Log | 23 | census, edgar, 8 scrape results, person candidates marked UNVERIFIED with page URL and pairing direction |
| Investment Research | 1 | NAICS 5619 Other support services: 110 establishments (Hamilton 71, Butler 19, Warren 12, Clermont 8), CBP 2022, source URL included |
| Opportunities | 2 | Form D: Bruin Fund LP (Cincinnati, OH); FXPLM MARKETS LTD (Louisville, KY). Both SEC links return 200 and their indexes contain the Form D documents |
| Escalations | 1 | MEDIUM, New fund close |
| Agent Memory | 8 | One per source; all 0 failures; content hashes stored for change detection |

## What I fixed on this Mac (already merged upstream)

1. **Installer.** Playwright 1.48 pins greenlet 3.1.1, which fails to compile on
   Python 3.14 (`member access into incomplete type '_PyInterpreterFrame'`).
   Moved the pin to `playwright==1.58.0`. Also removed the stale
   "service-account key" message from `install.sh`.
2. **EDGAR filtered on nothing.** `locationCode=OH` is silently ignored: the API
   returned all 1,301 Form Ds nationally, and the code labelled them OH/KY/IN.
   The plural `locationCodes=` actually filters (12 for OH that week). Each hit's
   `biz_locations` is now also re-checked against the state, and hits are
   deduped by accession number.
3. **Census requires a key.** Keyless calls now 302 to `missing_key.html`, and
   bad or unactivated keys go to `invalid_key.html`. Added `census_api_key`:
   `config.load()` refuses to run without it, and `selftest.py` reports the key
   on its own line.
4. **Wrong titles at REAG.** REAG prints each title above the name. The scraper
   assumed below, so every person was given the next person's title (for
   example "Scott Mashuda — CO-FOUNDER AND COO", which is Torquato's). The
   extractor now works out each page's direction and returns nothing if the
   page is ambiguous. Title words match on whole words only ("Partnerships" no
   longer counts as "partner"). Title-shaped lines such as "Managing Director"
   and "VICE PRESIDENT" are no longer treated as names. All-caps names
   (Silverstone) are accepted and kept as printed.
5. **404s counted as OK.** An HTTP status of 400 or above now fails the source
   instead of hashing the error page.
6. **Image-only team pages.** River Cities shows names only in profile-link
   URLs. On team pages, the content hash now covers the page's links as well as
   its text, so a hire or departure there still registers.
7. **Moved URLs.** Northcreek → `/meet-the-team/`. REAG → `/about-us/`. The old
   `/team/` URL returns 404. CFA → `/society-events/upcoming-events`. Goering →
   `goeringcenter.com/calendar/`. "RC Capital" renamed to River Cities Capital,
   as the site's own footer gives it.

## Still open / not verified by me

- **Daily email not confirmed from this session.** `emailDailyWorkReport` has
  to be run from the Apps Script editor, which I cannot reach. Commit `38bb8fa`
  suggests an email has already gone out, but I have not seen one.
- **Weekly job not run.** `run_weekly.py` has not been executed on this Mac.
  launchd will first run it on Sunday at 17:00.
- **Zero candidates by design** at River Cities (names only in image links) and
  Northcreek (names printed with no titles). Change detection still covers both
  through the content hash. Joshua C. Irons at REAG is skipped because his
  printed title ("Marketing & Business Development") contains no title word.
  These are misses, not guesses.
- **Mac asleep at 07:15 means the run is skipped** until the Mac wakes. See the
  README options (`pmset repeat wakeorpoweron`).
- **The self-test advances the Census NAICS rotation** by one step each time it
  runs. This is harmless, but repeated self-tests skip sectors.

No unresolved errors.
