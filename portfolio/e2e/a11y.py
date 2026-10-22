"""Accessibility audit of the research pages with axe-core (WCAG 2.0/2.1 A and AA, plus best practice).

    npm i --no-save axe-core@4.10.2
    npx vite preview --port 4173 &
    python3 e2e/a11y.py node_modules/axe-core/axe.min.js /research/ /research/strategy-lab/ ...

Prints each violated rule with the pages and first few nodes; exits 1 if any rule is violated.
"""
import os
import sys
from playwright.sync_api import sync_playwright
AXE = sys.argv[1]
paths = sys.argv[2:]
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"))
    for name, vp, mob in [("desk", (1440, 900), False), ("phone", (390, 844), True)]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, is_mobile=mob, has_touch=mob)
        for path in paths:
            pg = ctx.new_page()
            pg.goto(f"http://localhost:4173{path}"); pg.wait_for_timeout(2500)
            pg.add_script_tag(path=AXE)
            r = pg.evaluate("axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })")
            for v in r["violations"]:
                key = (v["id"], v["impact"])
                e = out.setdefault(f"{v['id']} [{v['impact']}] {v['help']}", {"pages": set(), "nodes": []})
                e["pages"].add(f"{path}@{name}")
                for n in v["nodes"][:3]:
                    if len(e["nodes"]) < 6: e["nodes"].append(n["target"][0] + " :: " + (n.get("failureSummary") or "")[:160].replace("\n", " "))
            pg.close()
        ctx.close()
    b.close()
for k, v in sorted(out.items()):
    print(k, "|", len(v["pages"]), "pages:", sorted(v["pages"])[:4])
    for n in v["nodes"]: print("    ", n)
print("TOTAL rules violated:", len(out))
sys.exit(1 if out else 0)
