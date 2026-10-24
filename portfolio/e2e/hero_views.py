"""Hero view matrix: the opening view at the screen sizes in docs/hero-views.md, at the top and two scroll
positions, with the layer state that decides how it looks. Screenshots are the baseline to compare against.

    npx vite preview --port 4173 &
    python3 e2e/hero_views.py OUTDIR            # HERO_BASE overrides http://localhost:4173

Needs software WebGL (SwiftShader), so it is slow; frame rates here are not representative.
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
BASE = os.environ.get("HERO_BASE", "http://localhost:4173").rstrip("/")
VIEWS = [("d1920", 1920, 1080, 1, False), ("d1536", 1536, 864, 1, False), ("d1440", 1440, 900, 1, False), ("d1366", 1366, 768, 1, False),
         ("d1280", 1280, 720, 2, False), ("t820", 820, 1180, 2, True), ("p390", 390, 844, 3, True)]
FR = "new Promise(r => { let n = 0; const f = () => (++n >= 3 ? r(0) : requestAnimationFrame(f)); requestAnimationFrame(f); })"
ST = """(() => { const r = document.documentElement, s = getComputedStyle(document.querySelector('.den-scrim')), c = document.querySelector('.den-canvas');
  return { veil: r.classList.contains('den-veil'), backdrop: s.backdropFilter, mask: (s.maskImage || '').slice(0, 40), bg: s.backgroundColor,
    canvasOp: getComputedStyle(c).opacity, blur: c.dataset.blur, open: r.style.getPropertyValue('--den-open'), r: r.style.getPropertyValue('--den-r') }; })()"""
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for name, w, h, dpr, mob in VIEWS:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, is_mobile=mob, has_touch=mob)
        pg = ctx.new_page()
        pg.goto(BASE + "/?scene=1")
        pg.wait_for_function("document.documentElement.classList.contains('den-live')", timeout=60000)
        pg.wait_for_timeout(9000)
        for y in (0, 300, 900):
            pg.evaluate(f"window.scrollTo(0, {y})"); pg.evaluate(FR)
            pg.wait_for_function("(() => { const c = document.querySelector('.den-canvas'); return c.dataset.blur === c.dataset.blurTarget; })()", timeout=30000)
            pg.wait_for_timeout(600)
            res[f"{name}@{y}"] = pg.evaluate(ST)
            pg.screenshot(path=f"{OUT}/{name}-{y}.png")
        ctx.close()
    b.close()
print(json.dumps(res, indent=1))
