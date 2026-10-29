"""
Daily run. Executed by launchd on the Mac.

Order is deliberate: the deterministic Census pull runs FIRST and is isolated,
so a browser failure can never cost you the one deliverable that always works.
Every stage is wrapped; one failure never aborts the run.
"""
from __future__ import annotations
import datetime as dt, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from automation.src import census, edgar, scrape
from automation.src.config import load
from automation.src.memory import Memory
from automation.src.sheets import Book


def main() -> int:
    cfg = load()
    run_t0 = time.time()
    run_id = dt.datetime.now().strftime("%Y%m%d-%H%M")
    book = Book(cfg)
    mem = Memory(book)
    escalations = 0

    # ---- 1. Census: the deliverable that cannot fail for browser reasons ----
    t0 = time.time()
    try:
        c = census.pull(cfg)
        if c["rows"]:
            detail = "; ".join(f"{r['county']} {r['estab']} estab / {r['emp']} emp" for r in c["rows"])
            book.append("Investment Research", [[
                f"CBP-{run_id}-{c['naics']}", dt.date.today().isoformat(),
                f"NAICS {c['naics']}" + (f" — {c['label']}" if c["label"] else ""),
                "Market sizing",
                f"How many establishments in NAICS {c['naics']} operate in the four-county region?",
                f"{c['total']} establishments across Hamilton, Butler, Warren, Clermont (CBP {cfg['census_year']})",
                detail, "Tier 1 - Primary/Gov/SEC", c["rows"][0]["url"],
                dt.date.today().isoformat(), "High", "P1 sector thesis",
                f"There are {c['total']} establishments in NAICS {c['naics']} across the four counties "
                f"— that is the acquirable universe before any size filter.",
                0.25, "Auto-pulled by run_daily.py",
            ]])
        book.log(run_id, "census", f"CBP NAICS {c['naics']}",
                 "OK" if c["rows"] else "FAILED", c["total"],
                 c["rows"][0]["url"] if c["rows"] else "", time.time() - t0,
                 "; ".join(c["errors"])[:400])
        if c["errors"] and not c["rows"]:
            book.escalate(run_id, "HIGH", "Data source down",
                          "Census CBP returned nothing for every county.",
                          "The daily primary-source deliverable produced no data.",
                          "Open one of the failing URLs by hand; if Census changed its "
                          "vintage, bump census_year in config.json.",
                          notes="; ".join(c["errors"])[:400])
            escalations += 1
    except Exception as e:
        book.log(run_id, "census", "CBP", "EXCEPTION", 0, "", time.time() - t0, str(e)[:400])

    # ---- 2. EDGAR Form D: new fund closes = hiring signal -------------------
    t0 = time.time()
    try:
        f = edgar.recent_form_d(cfg)
        for i, fil in enumerate(f["filings"][:10], 1):
            book.append("Opportunities", [[
                f"OPP-{run_id}-{fil['state']}-{i}", "Deal",
                f"New Form D filing: {fil['name']} ({fil['location']}), filed {fil['filed']}",
                "", fil["name"], "Identified", "",
                "A manager that just closed a vehicle must deploy it, and small firms "
                "add junior headcount when they do. These seats are never posted.",
                "Read the filing; if it is a buyout or credit fund in range, source the team page.",
                dt.date.today().isoformat(), "No", "No", "OPEN", fil["url"],
            ]])
        book.log(run_id, "edgar", "Form D OH/KY/IN",
                 "OK" if f["filings"] else "EMPTY", len(f["filings"]), "",
                 time.time() - t0, "; ".join(f["errors"])[:400])
        if f.get("unlocated") and not f.get("located"):
            book.escalate(run_id, "HIGH", "Form D screening disabled",
                          "EDGAR returned hits but none carried a location field.",
                          "No filing could be confirmed as OH/KY/IN, so the agent wrote "
                          "none. Writing them would have filled Opportunities with "
                          "out-of-region filings that look exactly like real leads.",
                          "Open the EDGAR search by hand and check whether biz_locations "
                          "was renamed, then update edgar.py.",
                          notes="; ".join(f["errors"])[:360])
            escalations += 1

        if f["filings"]:
            book.escalate(run_id, "MEDIUM", "New fund close",
                          f"{len(f['filings'])} new Form D filings in OH/KY/IN.",
                          "Fund closes are the highest-signal hiring lead available to you.",
                          "Review the Opportunities rows; source team pages for any in range.")
            escalations += 1
    except Exception as e:
        book.log(run_id, "edgar", "Form D", "EXCEPTION", 0, "", time.time() - t0, str(e)[:400])

    # ---- 3. Watch sources: change detection + candidate extraction ----------
    t0 = time.time()
    limit = cfg.get("max_consecutive_failures_before_escalation", 3)
    live = [s for s in cfg["watch_sources"] if not mem.should_skip(s["id"], limit)]
    skipped = [s for s in cfg["watch_sources"] if mem.should_skip(s["id"], limit)]

    for s in skipped:
        book.escalate(run_id, "MEDIUM", "Scraper retired",
                      f"{s['org']} ({s['url']}) has failed {mem.failures(s['id'])} runs in a row.",
                      "The agent has stopped scraping it rather than hammering a dead URL.",
                      "Open the URL. If the site moved, update watch_sources in config.json.",
                      url=s["url"])
        escalations += 1

    try:
        results = scrape.fetch(mem.ordered(live), cfg["user_agent"])
        for s in live:
            r = results.get(s["id"], {})
            items = len(r.get("people", [])) + len(r.get("events", []))
            changed = bool(r.get("hash")) and r["hash"] != mem.hash_of(s["id"]) and mem.hash_of(s["id"]) != ""

            if r.get("ok") and changed:
                if s["kind"] == "team":
                    book.escalate(run_id, "HIGH", "Team page changed",
                                  f"{s['org']}'s team page changed since the last run.",
                                  "A change on a small firm's team page is almost always a hire, "
                                  "a departure or a promotion — and a new hire is the single best "
                                  "reason to make contact.",
                                  "Open the page, confirm what changed, and add the person to the CRM "
                                  "with their title copied verbatim.", url=s["url"])
                else:
                    book.escalate(run_id, "MEDIUM", "New events posted",
                                  f"{s['org']}'s event page changed.",
                                  "Events have weeks of lead time; this is the window to register.",
                                  "Check for a new date and register if it is open to non-members.",
                                  url=s["url"])
                escalations += 1

            for pers in r.get("people", [])[:6]:
                book.append("Agent Log", [[
                    run_id, dt.datetime.now().isoformat(timespec="seconds"), "scrape",
                    "person candidate", "UNVERIFIED — confirm title on the page before use",
                    1, s["url"], 0,
                    f"{pers['name']} — "
                    f"{pers['title_as_printed'] or '(title not extracted)'} — {s['org']}"
                    + (f" [{pers['title_position']}]"
                       if pers.get("title_position") else ""),
                ]])

            mem.record(s, ok=bool(r.get("ok")), items=items, content_hash=r.get("hash", ""),
                       note=r.get("error", "")[:200])
            book.log(run_id, "scrape", f"{s['org']} ({s['kind']})",
                     "CHANGED" if changed else ("OK" if r.get("ok") else "FAILED"),
                     items, s["url"], 0, r.get("error", "")[:300])
    except Exception as e:
        book.log(run_id, "scrape", "playwright", "EXCEPTION", 0, "", time.time() - t0, str(e)[:400])
        book.escalate(run_id, "HIGH", "Scraper crashed",
                      "Playwright raised before any source was processed.",
                      "No change detection ran today.",
                      "Run `python -m playwright install chromium` and re-run run_daily.py.",
                      notes=str(e)[:300])
        escalations += 1

    book.log(run_id, "run", "daily complete", "OK", escalations, "",
             time.time() - run_t0, f"{escalations} escalations raised")

    # One POST for the whole run. A failure here is loud and keeps the rows.
    try:
        res = book.flush()
        print(f"run {run_id}: wrote {res.get('written', 0)} rows, {escalations} escalations")
    except Exception as e:
        print(f"run {run_id}: FLUSH FAILED — {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
