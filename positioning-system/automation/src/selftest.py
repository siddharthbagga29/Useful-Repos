"""Proves the whole chain before you trust a scheduled run.

Checks, in order: config present → endpoint reachable → token accepted →
row lands in the sheet → Census API answers → Playwright launches.
Each failure names exactly what to fix.
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from automation.src import census
from automation.src.config import load
from automation.src.sheets import Book


def main() -> int:
    bad = 0
    cfg = load()
    print("config ...................... OK")
    print("census api key .............. "
          + ("OK" if cfg.get("census_api_key") else
             "MISSING (unkeyed calls get throttled; see the warning above)"))

    try:
        res = Book(cfg).selftest()
        print(f"apps script endpoint ........ OK (wrote {res.get('written', 0)} row)")
        print("   → check the Agent Log tab for a SELFTEST row")
    except Exception as e:
        print(f"apps script endpoint ........ FAILED\n   {e}")
        print("   fix: redeploy Ingest.gs as a Web App ('Anyone' access), re-copy the /exec URL,")
        print("        and confirm the token matches setupIngestToken output")
        bad += 1

    try:
        c = census.pull(cfg)
        if c["rows"]:
            print(f"census api .................. OK (NAICS {c['naics']}, {c['total']} establishments)")
        else:
            print(f"census api .................. FAILED\n   {'; '.join(c['errors'][:2])}")
            print("   fix: Census may have retired that vintage — lower census_year in config.json")
            bad += 1
    except Exception as e:
        print(f"census api .................. FAILED\n   {e}")
        bad += 1

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True)
            b.close()
        print("playwright .................. OK")
    except Exception as e:
        print(f"playwright .................. FAILED\n   {e}")
        print("   fix: ~/.positioning-os/venv/bin/python -m playwright install chromium")
        bad += 1
        return _finish(bad)

    # Every watched URL, checked now rather than discovered broken mid-run.
    # A moved team page is the most common failure here and the easiest to miss,
    # because the agent keeps running and simply reports nothing.
    try:
        from automation.src import scrape
        srcs = cfg.get("watch_sources", [])
        results = scrape.fetch(srcs, cfg["user_agent"])
        dead = []
        for s_ in srcs:
            r = results.get(s_["id"], {})
            if r.get("ok"):
                found = len(r.get("people", [])) + len(r.get("events", []))
                print(f"  {s_['org'][:34]:<36} OK  (HTTP {r.get('http_status')}, "
                      f"{r.get('text_len', 0)} chars, {found} candidate(s))")
            else:
                dead.append(s_)
                print(f"  {s_['org'][:34]:<36} DEAD  {r.get('error', '')[:70]}")
                print(f"      {s_['url']}")
        if dead:
            print(f"watch sources ............... {len(srcs) - len(dead)}/{len(srcs)} reachable")
            print("   fix: open each dead URL in a browser, find where the page moved,")
            print("        and update that entry in config.json watch_sources")
            bad += 1
        else:
            print(f"watch sources ............... OK (all {len(srcs)} reachable)")
    except Exception as e:
        print(f"watch sources ............... FAILED\n   {e}")
        bad += 1

    return _finish(bad)


def _finish(bad: int) -> int:
    print("\nALL GREEN — scheduled runs will work." if not bad
          else f"\n{bad} check(s) failed. Fix those before trusting the schedule.")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
