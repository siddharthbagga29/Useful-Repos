"""Proves the whole chain before you trust a scheduled run.

Checks, in order: config present → endpoint reachable → token accepted →
row lands in the sheet → Census key accepted → Census API answers → Playwright launches.
Each failure names exactly what to fix.
"""
from __future__ import annotations
import sys
from pathlib import Path
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from automation.src import census
from automation.src.config import load
from automation.src.sheets import Book


def main() -> int:
    bad = 0
    cfg = load()
    print("config ...................... OK")

    try:
        res = Book(cfg).selftest()
        print(f"apps script endpoint ........ OK (wrote {res.get('written', 0)} row)")
        print("   → check the Agent Log tab for a SELFTEST row")
    except Exception as e:
        print(f"apps script endpoint ........ FAILED\n   {e}")
        print("   fix: redeploy Ingest.gs as a Web App ('Anyone' access), re-copy the /exec URL,")
        print("        and confirm the token matches setupIngestToken output")
        bad += 1

    key_ok = False
    try:
        c0 = cfg["counties"][0]["fips"]
        r = requests.get(census.url_for(cfg["census_year"], cfg["naics_rotation"][0], c0,
                                        cfg["census_api_key"]),
                         timeout=30, allow_redirects=False,
                         headers={"User-Agent": cfg["user_agent"]})
        problem = census.key_problem(r)
        if problem:
            print(f"census api key .............. FAILED\n   {problem}")
            print(f"   fix: {census.KEY_HELP}")
            bad += 1
        else:
            print("census api key .............. OK")
            key_ok = True
    except Exception as e:
        print(f"census api key .............. FAILED\n   {e}")
        bad += 1

    try:
        if not key_ok:
            print("census api .................. SKIPPED (fix the key first)")
        else:
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
        return _finish(bad + 1)

    # Every watched URL, now, rather than discovered broken mid-run. A moved
    # team page is the likeliest failure here and the easiest to miss: the
    # agent keeps running and simply reports nothing.
    try:
        from automation.src import scrape
        srcs = cfg.get("watch_sources", [])
        results = scrape.fetch(srcs, cfg["user_agent"])
        dead = [x for x in srcs if not results.get(x["id"], {}).get("ok")]
        for x in srcs:
            r = results.get(x["id"], {})
            if r.get("ok"):
                found = len(r.get("people", [])) + len(r.get("events", []))
                print(f"   {x['org'][:30]:<32} OK   HTTP {r.get('http_status')}, "
                      f"{r.get('text_len', 0):>6} chars, {found} candidate(s)")
            else:
                print(f"   {x['org'][:30]:<32} DEAD {r.get('error', '')[:60]}")
                print(f"       {x['url']}")
        if dead:
            print(f"watch sources ............... {len(srcs) - len(dead)}/{len(srcs)} reachable")
            print("   fix: open each DEAD url, find where the page moved, and update")
            print("        that entry under watch_sources in config.json")
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
