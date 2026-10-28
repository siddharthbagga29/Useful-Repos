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

    print("\nALL GREEN — scheduled runs will work." if not bad
          else f"\n{bad} check(s) failed. Fix those before trusting the schedule.")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
