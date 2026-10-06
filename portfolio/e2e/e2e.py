"""End-to-end checks against the production build (vite preview on :4173).

Speech recognition can't run headless, so a fake SpeechRecognition is injected that "hears"
whatever the test puts in window.__heard. speechSynthesis is wrapped to record what Jarvis says.

    npm run build && npx vite preview --port 4173 &  python3 e2e/e2e.py [base_url] [shots_dir]
"""

from __future__ import annotations

import os
import sys

from playwright.sync_api import Page, expect, sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "test-results"
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

FAKE_VOICE = """
(() => {
  window.__heard = [];
  window.__spoken = [];
  class FakeRecognition {
    constructor() { this.continuous = false; this.interimResults = false; }
    start() {
      setTimeout(() => this.onstart && this.onstart(), 10);
      this._t = setInterval(() => {
        const text = window.__heard.shift();
        if (!text) return;
        const res = [{ transcript: text }]; res.isFinal = true;
        this.onresult && this.onresult({ resultIndex: 0, results: [res] });
        if (!this.continuous) { clearInterval(this._t); setTimeout(() => this.onend && this.onend(), 10); }
      }, 50);
    }
    stop() { clearInterval(this._t); this.onend && this.onend(); }
    abort() { clearInterval(this._t); }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  const fakeSynth = {
    speaking: false,
    getVoices: () => [{ name: "Daniel", lang: "en-GB" }],
    cancel() {},
    speak(u) { window.__spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 5); },
  };
  Object.defineProperty(window, "speechSynthesis", { value: fakeSynth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();
"""

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'pass' if ok else 'FAIL'}  {name}{'' if ok else '  — ' + detail}")
    if not ok:
        failures.append(name)


def jarvis_last(page: Page) -> str:
    page.wait_for_timeout(1300)  # let the typewriter finish
    return page.locator(".overlay .jx-msg.a").last.inner_text()


def desktop(p) -> None:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script(FAKE_VOICE)
    page = ctx.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(BASE)
    expect(page.locator("h1.mega")).to_contain_text("Siddharth")
    expect(page.get_by_test_id("greeting")).to_be_visible(timeout=4000)
    check("Jarvis greets on landing", "Siddharth's den" in page.get_by_test_id("greeting").inner_text())
    check("greeting stays silent until the visitor interacts", page.evaluate("window.__spoken.length") == 0)
    check("character sheet: class and perks", "Valuation & Diligence Analyst" in page.locator(".hud").inner_text() and "Monte Carlo" in page.locator(".hud").inner_text())
    page.screenshot(path=f"{SHOTS}/desktop-hero.png")

    html = page.content().lower()
    import re as _re
    gh = set(_re.findall(r'https://github\.com/[^"\s<]+', html))
    check("no OpenJarvis link; GitHub links only to his own profile and repos", "openjarvis" not in html and all(u.rstrip("/") == "https://github.com/siddharthbagga29" or u.startswith("https://github.com/siddharthbagga29/") for u in gh), str(gh))
    check("JSON-LD Person present", page.locator('script[type="application/ld+json"]').count() == 1)
    check("canonical + og:image", page.locator('link[rel="canonical"]').count() == 1 and page.locator('meta[property="og:image"]').count() == 1)

    # horizontal film: scroll moves the film and the analyst changes activity
    page.mouse.wheel(0, 1400)
    page.wait_for_timeout(1200)
    film_x = page.evaluate("getComputedStyle(document.querySelector('.film')).transform")
    check("scroll drives the horizontal film", film_x not in ("none", "matrix(1, 0, 0, 1, 0, 0)"), film_x)
    page.keyboard.press("4")
    page.wait_for_timeout(1500)
    check("key 4 → terminal is the active dot", page.locator(".dots button[aria-current=true]").get_attribute("aria-label") == "Terminal")
    check("analyst activity follows the station", "pulling the tape" in page.locator(".desk-act").inner_text().lower(), page.locator(".desk-act").inner_text())
    page.wait_for_timeout(300)
    check("first key press speaks the greeting once", sum("Siddharth's den" in t for t in page.evaluate("window.__spoken")) == 1, str(page.evaluate("window.__spoken"))[:200])
    page.get_by_label("Terminal command (F1–F6 run the shortcuts)").focus()
    page.keyboard.press("F3")
    page.wait_for_timeout(400)
    check("terminal: F3 runs VAL", "VALUATION WORK" in page.get_by_test_id("term-log").inner_text())
    page.screenshot(path=f"{SHOTS}/desktop-terminal.png")

    # terminal answers a plain-English question through Jarvis
    term = page.get_by_label("Terminal command")
    term.fill("is he a cfa charterholder?")
    term.press("Enter")
    page.wait_for_timeout(600)
    log = page.get_by_test_id("term-log").inner_text()
    check("terminal routes questions to Jarvis", "JARVIS ▸" in log and "has not sat" in log, log[-300:])

    # tap → analyst stamps
    page.mouse.click(700, 160)
    try:  # the stamp shows for 700 ms; poll instead of sampling once
        page.wait_for_function("document.querySelector('.desk-act').innerText.toLowerCase().includes('approved')", timeout=700, polling=50)
        stamped = True
    except Exception:
        stamped = False
    check("tap makes the analyst stamp", stamped, page.locator(".desk-act").inner_text())
    check("tap shows a finance burst", page.locator(".burst").count() >= 1)

    # Jarvis overlay: skill drives the DCF
    page.locator(".launcher").click()
    expect(page.locator(".overlay")).to_be_visible()
    check("#jarvis deep link set", page.evaluate("location.hash") == "#jarvis")
    box = page.get_by_label("Message Jarvis").last
    box.fill("set WACC to 10%")
    box.press("Enter")
    try:  # answers type out progressively; wait for the figure rather than sampling once
        page.wait_for_function("[...document.querySelectorAll('.overlay .jx-msg.a')].pop()?.innerText.includes('$85.1B')", timeout=4000)
    except Exception:
        pass
    check("Jarvis answers set_dcf with the model's number", "$85.1B" in jarvis_last(page), jarvis_last(page))
    page.screenshot(path=f"{SHOTS}/desktop-jarvis.png")
    page.keyboard.press("Escape")
    page.wait_for_timeout(1600)
    check("set_dcf moved the page to the model", page.locator(".dots button[aria-current=true]").get_attribute("aria-label") == "The model")
    eq = page.locator(".eqbox .v").inner_text()
    check("model shows $85.1B at 10% WACC", "85.1" in eq, eq)
    page.screenshot(path=f"{SHOTS}/desktop-model.png")

    # voice: push-to-talk
    page.locator(".launcher").click()
    page.evaluate("window.__spoken = []")
    page.evaluate("window.__heard.push('how much work experience does he have')")
    page.get_by_label("Talk to Jarvis").last.click()
    page.wait_for_timeout(1200)
    last = jarvis_last(page)
    check("voice question answered", "14 months" in last, last)
    spoken = page.evaluate("window.__spoken.join(' ')")
    check("answer is spoken aloud", "14 months" in spoken, spoken[:200])

    # voice: wake word, then a navigation skill
    page.get_by_role("switch", name="“Hey Jarvis”").last.click()
    page.wait_for_timeout(300)
    page.evaluate("window.__heard.push('hey jarvis take me to the deal room')")
    page.wait_for_timeout(1500)
    check("“Hey Jarvis …” wake phrase handled", "deal room" in jarvis_last(page).lower(), jarvis_last(page))
    page.get_by_role("switch", name="“Hey Jarvis”").last.click()

    # digest agent speaks section by section
    page.evaluate("window.__spoken = []")
    box = page.get_by_label("Message Jarvis").last
    box.fill("brief me")
    box.press("Enter")
    page.wait_for_timeout(1500)
    check("briefing renders six sections", page.locator(".overlay .digest p").count() == 6)
    check("briefing is read aloud", len(page.evaluate("window.__spoken")) >= 6, str(page.evaluate("window.__spoken.length")))

    # research agent cites sources
    page.locator(".rail-item", has_text="Research").click()
    box.fill("Is he a CFA charterholder and how did he price the pipeline?")
    box.press("Enter")
    page.wait_for_timeout(900)
    check("research splits and cites", "[1]" in jarvis_last(page) and "EBITDA" in jarvis_last(page), jarvis_last(page)[:200])
    page.locator(".overlay .jx-msg.a").last.get_by_role("button", name="trace").click(force=True)
    check("trace is inspectable", page.locator(".overlay .jx-trace li").count() >= 3)
    page.screenshot(path=f"{SHOTS}/desktop-research.png")

    # memory survives a reload
    page.locator(".rail-item", has_text="Chat").click()
    box.fill("I'm Priya from Evercore")
    box.press("Enter")
    page.wait_for_timeout(500)
    page.reload()
    page.wait_for_timeout(800)
    check("memory persists across reloads", "Welcome back, Priya" in page.locator(".overlay").inner_text())
    page.keyboard.press("Escape")
    expect(page.locator(".overlay")).to_have_count(0)  # let the overlay finish closing before the next shortcut

    # command palette
    page.keyboard.press("Control+k")
    expect(page.locator(".pal")).to_be_visible()
    page.keyboard.type("exhibits")
    page.keyboard.press("Enter")
    try:
        page.wait_for_function("document.querySelector('.dots button[aria-current=true]')?.getAttribute('aria-label') === 'Exhibits'", timeout=6000)
    except Exception:
        pass
    diag = page.evaluate("({active: document.querySelector('.dots button[aria-current=true]')?.getAttribute('aria-label'), y: scrollY|0, pal: !!document.querySelector('.pal'), focus: document.activeElement?.tagName + '.' + document.activeElement?.className, overlay: !!document.querySelector('.overlay'), hash: location.hash})")
    check("⌘K palette navigates", page.locator(".dots button[aria-current=true]").get_attribute("aria-label") == "Exhibits", str(diag))
    check("exhibits link to Drive", page.locator("a.work[href*='drive.google.com']").count() == 6)

    real = [e for e in errors if "fonts.g" not in e and "Failed to load resource" not in e]
    check("no console errors", not real, "; ".join(real)[:400])
    browser.close()


def connect_and_links(p) -> None:
    """Every link resolves; the reach-out flow sends, falls back, and pre-writes correctly."""
    from urllib.parse import parse_qs, urlparse
    import urllib.request

    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script(FAKE_VOICE)
    page = ctx.new_page()
    page.goto(BASE)
    page.wait_for_timeout(900)

    # --- SEO surface ---
    title = page.title()
    check("title leads with the name", title.startswith("Siddharth Bagga") and len(title) <= 75, title)
    desc = page.locator('meta[name="description"]').get_attribute("content") or ""
    check("meta description ≤160 chars, has keywords", len(desc) <= 160 and "Financial Mathematics" in desc, str(len(desc)))
    raw = urllib.request.urlopen(BASE).read().decode()
    check("prerendered HTML carries crawlable bio", "Strategic Finance Lead" in raw and "M.S. Financial Mathematics" in raw and "<h1>Siddharth Bagga</h1>" in raw)
    check("one h1 after hydration", page.locator("h1").count() == 1, str(page.locator("h1").count()))
    for path in ["lab/", "Siddharth_Bagga_Resume.pdf", "siddharth-bagga.vcf", "robots.txt", "sitemap.xml", "llms.txt", "og.png", "favicon.svg", "site.webmanifest", "jarvis/"]:
        try:
            code = urllib.request.urlopen(BASE + path).status
        except Exception as e:  # noqa: BLE001
            code = str(e)
        check(f"asset /{path} is served", code == 200, str(code))

    # --- every anchor on the page ---
    anchors = page.evaluate("""() => [...document.querySelectorAll('a[href]')].map(a => ({href: a.getAttribute('href'), target: a.target, rel: a.rel, text: a.textContent.trim().slice(0,40)}))""")
    bad = []
    for a in anchors:
        h = a["href"]
        if h.startswith("http"):
            if not h.startswith("https://"):
                bad.append(f"not https: {h}")
            if a["target"] != "_blank" or "noopener" not in a["rel"]:
                bad.append(f"external without new tab/noopener: {h}")
        elif h.startswith("mailto:"):
            if "siddharthbagga29@gmail.com" not in h:
                bad.append(f"bad mailto {h}")
        elif h.startswith("tel:"):
            if h != "tel:+18605958333":
                bad.append(f"bad tel {h}")
        elif h.startswith("/") or h.startswith("#"):
            pass
        else:
            bad.append(f"odd href {h}")
    check(f"all {len(anchors)} links well-formed", not bad, "; ".join(bad[:5]))
    drive = {a["href"] for a in anchors if "drive.google.com" in a["href"]}
    check("six Drive exhibits linked", len(drive) == 6, str(len(drive)))
    internal = {a["href"] for a in anchors if a["href"].startswith("/") and len(a["href"]) > 1}
    for h in internal:
        code = urllib.request.urlopen(BASE.rstrip("/") + h).status
        check(f"internal link {h} → 200", code == 200, str(code))

    # --- composer: opened from nav, pre-written, compose links correct ---
    page.get_by_test_id("nav-connect").click()
    expect(page.locator(".cx")).to_be_visible()
    check("#connect deep link set", page.evaluate("location.hash") == "#connect")
    page.get_by_test_id("cx-send").click()
    check("validation blocks an empty send", page.locator(".cx-err").count() == 2)
    page.fill("#cx-name", "Priya Shah")
    page.fill("#cx-email", "priya@evercore.com")
    page.fill("#cx-company", "Evercore")
    page.fill("#cx-role", "CDD Associate")
    body = page.locator(".cx-preview pre").inner_text()
    check("message is pre-written from the fields", "I'm Priya Shah at Evercore" in body and "CDD Associate" in body and body.startswith("Hi Siddharth"), body[:120])
    g = urlparse(page.get_by_test_id("cx-gmail").get_attribute("href"))
    q = parse_qs(g.query)
    check("Gmail compose link pre-filled", g.netloc == "mail.google.com" and q.get("to") == ["siddharthbagga29@gmail.com"] and "Priya Shah" in q.get("body", [""])[0] and "CDD Associate" in q.get("su", [""])[0], str(q)[:200])
    o = urlparse(page.get_by_test_id("cx-outlook").get_attribute("href"))
    check("Outlook compose link pre-filled", o.netloc == "outlook.office.com" and parse_qs(o.query).get("to") == ["siddharthbagga29@gmail.com"])
    m = page.get_by_test_id("cx-mailto").get_attribute("href")
    check("mail-app link pre-filled", m.startswith("mailto:siddharthbagga29@gmail.com?subject=") and "body=" in m)

    # relay failure → fallback, message preserved
    page.route("https://formsubmit.co/**", lambda r: r.fulfill(status=500, body="{}"))
    page.get_by_test_id("cx-send").click()
    expect(page.locator(".cx-warn")).to_be_visible()
    check("relay failure shows the email fallbacks", page.get_by_test_id("cx-gmail").is_visible())
    page.unroute("https://formsubmit.co/**")

    # relay success → sent, payload correct
    sent: list[dict] = []
    def ok(route):
        import json as _j
        sent.append(_j.loads(route.request.post_data or "{}"))
        route.fulfill(status=200, content_type="application/json", body='{"success":"true","message":"sent"}')
    page.route("https://formsubmit.co/**", ok)
    page.get_by_test_id("cx-send").click()
    expect(page.get_by_test_id("cx-sent")).to_be_visible()
    pl = sent[-1] if sent else {}
    check("one click sends name, email, company and message", pl.get("name") == "Priya Shah" and pl.get("email") == "priya@evercore.com" and pl.get("company") == "Evercore" and "Hi Siddharth" in pl.get("message", "") and pl.get("_replyto") == "priya@evercore.com", str(pl)[:200])
    page.screenshot(path=f"{SHOTS}/connect-sent.png")
    page.keyboard.press("Escape")

    # contact station paths open the composer with the right reason
    page.keyboard.press("0")
    page.wait_for_timeout(1500)
    page.get_by_test_id("path-network").click()
    expect(page.locator(".cx")).to_be_visible()
    check("contact path preselects the reason", page.locator(".cx-intents label.on").inner_text().startswith("Let's connect"))
    check("draft remembered for the visitor", page.input_value("#cx-name") == "Priya Shah")
    page.screenshot(path=f"{SHOTS}/connect-form.png")
    page.keyboard.press("Escape")

    # Jarvis: interest opens the composer
    page.locator(".launcher").click()
    box = page.get_by_label("Message Jarvis").last
    box.fill("We're interested in interviewing him")
    box.press("Enter")
    page.wait_for_timeout(900)
    check("Jarvis opens the composer on interest", page.locator(".cx").is_visible())
    browser.close()


def den_scene(p) -> None:
    # The living background (three.js). Off under automation unless ?scene=1; software WebGL here.
    browser = p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "?scene=1")
    page.wait_for_function("document.documentElement.classList.contains('den-live')", timeout=60000)
    check("den: particle scene starts", True)
    r = float(page.evaluate("parseFloat(document.documentElement.style.getPropertyValue('--den-r'))"))
    x = float(page.evaluate("parseFloat(document.documentElement.style.getPropertyValue('--den-x'))"))
    check("den: brain framed right of the hero copy", r > 100 and x > 900, f"r={r} x={x}")
    check("den: content still sits above the scene", page.evaluate("getComputedStyle(document.querySelector('main')).zIndex") == "1")
    check("den: no script errors", not errors, "; ".join(errors)[:300])
    page.goto(BASE)
    page.wait_for_timeout(2500)
    check("den: skipped under automation without ?scene", not page.evaluate("document.documentElement.classList.contains('den-live')"))
    browser.close()


def research_and_lab(p) -> None:
    browser = p.chromium.launch(executable_path=CHROME)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(BASE)
    page.wait_for_timeout(800)
    page.keyboard.press("8")
    page.wait_for_timeout(1600)
    check("key 8 → research section", page.locator(".dots button[aria-current=true]").get_attribute("aria-label") == "Research")
    check("research city: seven projects + Brain + Foundry", page.locator("[data-testid^='bld-']").count() == 9, str(page.locator("[data-testid^='bld-']").count()))
    check("research city: one bot per automated job", page.locator(".city .bot").count() == 17, str(page.locator(".city .bot").count()))
    page.locator(".city-pick button", has_text="Deal Lab").click()
    page.wait_for_timeout(500)
    check("city: picking a district opens its dossier", "underwriting row" in page.get_by_test_id("dossier").inner_text().lower())
    page.get_by_test_id("bld-high-properties").click(force=True)
    page.wait_for_timeout(500)
    check("city: only the public repo is linked", page.locator("[data-testid=dossier] a[href*='github.com']").count() == 1)
    page.get_by_test_id("pick-brain").click()
    page.wait_for_function("document.querySelector('[data-testid=dossier]').innerText.toLowerCase().includes('strategies tried')", timeout=8000)
    check("city: Brain dossier shows the live generation", "strategies tried" in page.get_by_test_id("dossier").inner_text().lower())
    check("no fork presented as own work", "odysseus" not in page.content().lower())
    page.screenshot(path=f"{SHOTS}/research.png")
    check("nav links the Strategy Lab", page.get_by_test_id("nav-lab").get_attribute("href") == "/lab/")
    sched = page.locator("#schedule")
    check("Calendly scheduler present", sched.count() == 1)
    check("scheduler length follows the link", "Book 30 minutes" in sched.inner_text(), sched.inner_text()[:60])
    sched.scroll_into_view_if_needed()
    page.get_by_test_id("sched-open").click()
    frame = page.locator(".sched-frame")
    check("scheduler opens Calendly", frame.count() == 1 and (frame.get_attribute("src") or "").startswith("https://calendly.com/siddharthbagga29/30min?"))

    page.goto(BASE + "lab/")
    page.wait_for_timeout(1200)
    check("lab renders KPIs", page.locator(".kpi").count() == 6)
    cagr0 = page.locator(".kpi .v").first.inner_text()
    page.get_by_role("button", name="Trend on SPY").click()
    page.wait_for_timeout(700)
    cagr1 = page.locator(".kpi .v").first.inner_text()
    check("preset changes the result", cagr0 != cagr1, f"{cagr0} -> {cagr1}")
    check("equity + drawdown charts drawn", page.locator(".chart svg path").count() >= 3)
    check("stress windows include 2022", "2022 rate shock" in page.locator(".lab-stress").inner_text())
    check("lab carries the not-advice disclosure", "Not investment advice" in page.locator(".lab-flag").inner_text())
    check("OPS replication table: 5 algorithms + SPY", page.locator(".ops-table tbody tr").count() == 6)
    check("OPS finding states the cost result", "bps" in page.locator(".finding").inner_text() and "PAMR" in page.locator(".finding").inner_text())
    check("Monte Carlo table: 10 strategies", page.locator(".mc-table tbody tr").count() == 10)
    before = page.locator(".mc-explorer .hb.s").first.evaluate("e => getComputedStyle(e).height")
    page.select_option("#mc-strat", "olmar")
    page.wait_for_timeout(800)
    after = page.locator(".mc-explorer .hb.s").first.evaluate("e => getComputedStyle(e).height")
    check("Monte Carlo explorer redraws per strategy", before != after or page.locator(".mc-explorer").inner_text().count("OLMAR") >= 1)
    page.get_by_role("radio", name="Volatility target").click()
    page.locator("#tv").fill("8")
    page.wait_for_timeout(500)
    check("vol target lowers volatility", float(page.locator(".kpi").nth(1).locator(".v").inner_text().rstrip("%")) < 15)
    page.screenshot(path=f"{SHOTS}/lab.png", full_page=True)
    # Deal Lab
    page.goto(BASE + "deal/")
    page.wait_for_timeout(1000)
    check("deal lab: workbook example is a NO-GO", "NO-GO" in page.get_by_test_id("deal-signal").inner_text())
    check("deal lab: shows that v1 said GO", "v1 workbook said: GO" in page.get_by_test_id("deal-signal").inner_text())
    pw = page.get_by_test_id("deal-pworks").locator(".v").inner_text()
    check("deal lab: Monte Carlo ≈ 29% at defaults", pw in ("28%", "29%", "30%"), pw)
    page.locator("#d-contract").fill("45000")
    page.wait_for_timeout(600)
    check("deal lab: a $45k contract turns it GO", page.get_by_test_id("deal-signal").locator("b").inner_text() == "GO", page.get_by_test_id("deal-signal").inner_text()[:80])
    page.screenshot(path=f"{SHOTS}/deal.png", full_page=True)
    import urllib.request as _u
    check("deal lab: Excel model downloadable", _u.urlopen(BASE + "Wholesale_Deal_Analyzer_v2.xlsx").status == 200)
    # Twin-Engine concept
    page.goto(BASE + "projects/twin-engine/")
    page.wait_for_timeout(500)
    tw = page.inner_text("body")
    check("twin-engine: labelled illustrative", "illustrative sample data" in tw.lower())
    check("twin-engine: no typed-in IRR", "16.8%" not in tw and "trailing eight exits" not in tw)
    check("twin-engine: sold building is an Exit", "Exit" in tw)
    page.screenshot(path=f"{SHOTS}/twin.png", full_page=True)

    # Research HQ: Brain console, knowledge graph, note reader
    page.goto(BASE + "research/")
    page.wait_for_selector("[data-testid=brain-gen]", timeout=10000)
    gen = int(page.get_by_test_id("brain-gen").inner_text().replace(",", ""))
    check("brain: console shows a generation", gen >= 48, str(gen))
    check("brain: log has entries", page.locator("[data-testid=brain-log] li").count() > 10)
    check("brain: holdout caveat stated", "hindsight" in page.locator(".bc-note").inner_text())
    check("graph: every vault note is a node", page.locator("[data-testid=gnode]").count() == 28, str(page.locator("[data-testid=gnode]").count()))
    page.get_by_test_id("tag-underwriting").click()
    check("graph: tag filter dims other notes", page.locator(".gn.dim").count() > 10)
    page.get_by_test_id("tag-underwriting").click()
    page.locator("[data-testid=gnode]", has_text="Costs kill mean reversion").click()
    note = page.get_by_test_id("note-modal")
    check("graph: note opens", note.is_visible() and "PAMR" in note.inner_text())
    note.locator(".md-wiki", has_text="OPS replication").first.click()
    page.wait_for_timeout(300)
    check("graph: wiki links navigate between notes", "OPS replication" in page.get_by_test_id("note-modal").locator("h2").inner_text())
    page.keyboard.press("Escape")
    page.screenshot(path=f"{SHOTS}/research-hq.png", full_page=True)

    m = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    for path in ["deal/", "projects/twin-engine/", "research/"]:
        m.goto(BASE + path)
        m.wait_for_timeout(700)
        check(f"{path} mobile: no horizontal overflow", m.evaluate("document.documentElement.scrollWidth") <= 390, str(m.evaluate("document.documentElement.scrollWidth")))
    m.goto(BASE + "lab/")
    m.wait_for_timeout(1000)
    check("lab mobile: no horizontal overflow", m.evaluate("document.documentElement.scrollWidth") <= 390)
    m.screenshot(path=f"{SHOTS}/lab-mobile.png", full_page=True)
    real = [e for e in errors if "fonts.g" not in e and "Failed to load resource" not in e]
    check("lab: no console errors", not real, "; ".join(real)[:300])
    browser.close()


def mobile(p) -> None:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(FAKE_VOICE)
    page = ctx.new_page()
    page.goto(BASE)
    page.wait_for_timeout(900)
    page.screenshot(path=f"{SHOTS}/mobile-hero.png")
    sw = page.evaluate("document.documentElement.scrollWidth")
    check("mobile: no horizontal overflow", sw <= 390, str(sw))
    check("mobile: vertical stack", page.locator(".stack").count() == 1)
    page.locator("#jarvis").scroll_into_view_if_needed()
    page.wait_for_timeout(900)
    page.screenshot(path=f"{SHOTS}/mobile-jarvis.png")
    box = page.locator("#jarvis").get_by_label("Message Jarvis")
    box.fill("What are his gaps?")
    box.press("Enter")
    page.wait_for_timeout(900)
    txt = page.locator("#jarvis .jx-msg.a").last.inner_text()
    check("mobile: station Jarvis answers", "supervised" in txt, txt)
    page.locator("#model").scroll_into_view_if_needed()
    page.wait_for_timeout(700)
    page.screenshot(path=f"{SHOTS}/mobile-model.png")
    browser.close()


if __name__ == "__main__":
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        desktop(p)
        connect_and_links(p)
        research_and_lab(p)
        den_scene(p)
        mobile(p)
    print(f"\n{len(failures)} failing" if failures else "\nall passing")
    sys.exit(1 if failures else 0)
