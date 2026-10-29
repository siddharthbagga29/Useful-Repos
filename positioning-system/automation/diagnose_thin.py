"""One-off probe: what do the two near-empty team pages actually contain?

River Cities and Northcreek answer 200 with under 900 characters and yield
nobody, while Roebling returns 6308. Either the content arrives after the 1.5s
wait the daily run allows, or those URLs are not the team page at all. This
prints both pages under three wait strategies, plus their profile links, so the
cause is read off the output rather than guessed at.

Run once, by hand:
  ~/.positioning-os/venv/bin/python src/../diagnose_thin.py
"""
from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from automation.src.config import load
from playwright.sync_api import sync_playwright

TARGETS = ("rccapital-team", "northcreek-team")
STRATEGIES = [("domcontentloaded +1.5s (what the daily run does)", "domcontentloaded", 1500),
              ("domcontentloaded +8s", "domcontentloaded", 8000),
              ("networkidle +2s", "networkidle", 2000)]


def main() -> int:
    cfg = load()
    srcs = [s for s in cfg["watch_sources"] if s["id"] in TARGETS]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=cfg["user_agent"])
        page = ctx.new_page()
        for s in srcs:
            print("=" * 74)
            print(f"{s['org']} — {s['url']}")
            for label, wait, pause in STRATEGIES:
                try:
                    r = page.goto(s["url"], timeout=45000, wait_until=wait)
                    page.wait_for_timeout(pause)
                    text = page.inner_text("body")
                    print(f"\n  [{label}]")
                    print(f"  HTTP {r.status if r else '?'} — {len(text)} chars — "
                          f"landed on {page.url}")
                    if label.startswith("networkidle"):
                        print("  ---------------- text ----------------")
                        for line in [l.strip() for l in text.splitlines() if l.strip()][:40]:
                            print("   ", line[:88])
                        hrefs = page.eval_on_selector_all("a[href]", "e => e.map(x => x.href)")
                        keys = ("team", "people", "bio", "profile", "about", "leadership")
                        links = sorted({h.split("#")[0] for h in hrefs
                                        if any(k in h.lower() for k in keys)})
                        print("  ------------ profile-ish links ------------")
                        for h in links[:20]:
                            print("   ", h)
                        if not links:
                            print("    (none)")
                except Exception as e:
                    print(f"\n  [{label}] FAILED: {str(e)[:170]}")
        ctx.close()
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
