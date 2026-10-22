"""Accessibility audit of the research pages with axe-core (WCAG 2.0/2.1 A and AA, plus best practice).

    npm i --no-save axe-core@4.10.2
    npx vite preview --port 4173 &
    python3 e2e/a11y.py node_modules/axe-core/axe.min.js            # research page + all case studies
    python3 e2e/a11y.py node_modules/axe-core/axe.min.js / /lab/   # specific paths
    python3 e2e/a11y.py node_modules/axe-core/axe.min.js --states  # also interactive states (explorer, tabs)

A11Y_BASE overrides the server (default http://localhost:4173). CHROME overrides the browser binary.
Prints each violated rule with pages and nodes, then axe's "needs review" items (reported, not failed).
Exits 1 if any rule is violated or an interactive check fails, 0 otherwise. An axe pass is not proof of
WCAG conformance: it can't judge meaning, reading order, or most of what a screen-reader user hears.
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("A11Y_BASE", "http://localhost:4173").rstrip("/")
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
CASES = ["dcf", "risk-tolerance", "strategy-lab", "deal-lab", "twin-engine", "sentinel", "jarvis", "high-properties"]
TAGS = "['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']"

args = sys.argv[1:]
if not args:
    sys.exit(__doc__)
AXE = args.pop(0)
STATES = "--states" in args
paths = [a for a in args if a != "--states"] or ["/research/"] + [f"/research/{c}/" for c in CASES]

violations: dict[str, dict] = {}
review: dict[str, set] = {}
failures: list[str] = []


def scan(page, label: str) -> None:
    page.add_script_tag(path=AXE)
    r = page.evaluate(f"axe.run(document, {{ runOnly: {{ type: 'tag', values: {TAGS} }} }})")
    for v in r["violations"]:
        e = violations.setdefault(f"{v['id']} [{v['impact']}] {v['help']}", {"pages": set(), "nodes": []})
        e["pages"].add(label)
        for n in v["nodes"][:3]:
            if len(e["nodes"]) < 6:
                e["nodes"].append(n["target"][0] + " :: " + (n.get("failureSummary") or "")[:160].replace("\n", " "))
    for v in r["incomplete"]:
        review.setdefault(v["id"], set()).add(label)


def check(name: str, ok: bool) -> None:
    print(("pass  " if ok else "FAIL  ") + name)
    if not ok:
        failures.append(name)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    for name, vp, mob in [("desk", (1440, 900), False), ("phone", (390, 844), True)]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, is_mobile=mob, has_touch=mob)
        for path in paths:
            pg = ctx.new_page()
            pg.goto(BASE + path)
            pg.wait_for_timeout(2500)
            scan(pg, f"{path}@{name}")
            pg.close()
        ctx.close()

    if STATES:
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.goto(BASE + "/research/")
        pg.wait_for_timeout(2500)
        # tabs: arrows move between them
        pg.get_by_test_id("tab-detail").focus()
        pg.keyboard.press("ArrowRight")
        pg.wait_for_timeout(700)  # let the panel transition finish; mid-fade colours aren't real contrast
        check("tabs: ArrowRight selects the next tab", pg.get_by_test_id("tab-timeline").get_attribute("aria-selected") == "true")
        check("tabs: focus follows the selection", pg.evaluate("document.activeElement?.dataset.testid") == "tab-timeline")
        scan(pg, "/research/@timeline-tab")
        # explorer: a real modal
        pg.get_by_test_id("city-explore").focus()
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(600)
        inside = "!!document.activeElement?.closest('[role=dialog]')"
        check("explorer: focus moves into the dialog", pg.evaluate(inside))
        for _ in range(25):
            pg.keyboard.press("Tab")
        check("explorer: Tab stays inside the dialog", pg.evaluate(inside))
        check("explorer: the page behind is inert", pg.evaluate("document.getElementById('root').hasAttribute('inert')"))
        scan(pg, "/research/@explorer-open")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(500)
        check("explorer: Escape closes it", pg.get_by_test_id("city-explorer").count() == 0)
        check("explorer: focus returns to the Explore button", pg.evaluate("document.activeElement?.dataset.testid") == "city-explore")
        check("explorer: the page is usable again", not pg.evaluate("document.getElementById('root').hasAttribute('inert')"))
        pg.close()
    b.close()

for k, v in sorted(violations.items()):
    print(k, "|", len(v["pages"]), "pages:", sorted(v["pages"])[:4])
    for n in v["nodes"]:
        print("    ", n)
if review:
    print("needs manual review (axe could not decide; not counted as failures):")
    for k, v in sorted(review.items()):
        print(f"    {k}: {len(v)} page states")
print(f"TOTAL rules violated: {len(violations)}; interactive checks failed: {len(failures)}")
sys.exit(1 if violations or failures else 0)
