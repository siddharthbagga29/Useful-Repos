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
    page.wait_for_timeout(800)
    page.screenshot(path=f"{SHOTS}/desktop-hero.png")

    html = page.content().lower()
    check("no OpenJarvis / GitHub link on the site", "github.com" not in html and "openjarvis" not in html)
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
    page.wait_for_timeout(450)
    check("tap makes the analyst stamp", "approved" in page.locator(".desk-act").inner_text().lower())
    check("tap shows a finance burst", page.locator(".burst").count() >= 1)

    # Jarvis overlay: skill drives the DCF
    page.locator(".launcher").click()
    expect(page.locator(".overlay")).to_be_visible()
    check("#jarvis deep link set", page.evaluate("location.hash") == "#jarvis")
    box = page.get_by_label("Message Jarvis").last
    box.fill("set WACC to 10%")
    box.press("Enter")
    page.wait_for_timeout(900)
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

    # command palette
    page.keyboard.press("Control+k")
    expect(page.locator(".pal")).to_be_visible()
    page.keyboard.type("exhibits")
    page.keyboard.press("Enter")
    page.wait_for_timeout(1500)
    check("⌘K palette navigates", page.locator(".dots button[aria-current=true]").get_attribute("aria-label") == "Exhibits")
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
    for path in ["Siddharth_Bagga_Resume.pdf", "siddharth-bagga.vcf", "robots.txt", "sitemap.xml", "llms.txt", "og.png", "favicon.svg", "site.webmanifest", "jarvis/"]:
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
    page.keyboard.press("9")
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
        mobile(p)
    print(f"\n{len(failures)} failing" if failures else "\nall passing")
    sys.exit(1 if failures else 0)
