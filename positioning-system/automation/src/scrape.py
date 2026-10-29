"""
Playwright scraping of firm team pages and event calendars.

DESIGN RULE THAT MATTERS: this module never asserts that a person holds a
title. It detects *change* and extracts *candidates*.

Change detection is reliable and high-signal — "Roebling's team page changed
since last week" is almost always a hire, a departure or a promotion, and it is
a genuine reason to reach out. Name/title extraction from arbitrary HTML is not
reliable, so every extracted person is written UNVERIFIED with the page URL,
and the human confirms the title before it is ever used in a message. That is
the same standard the rest of the system runs on.
"""
from __future__ import annotations
import hashlib, re
from playwright.sync_api import sync_playwright

TITLE_WORDS = (
    "partner", "principal", "managing director", "director", "vice president",
    "associate", "analyst", "founder", "president", "chief", "cfo", "coo", "ceo",
    "head of", "counsel", "controller",
)
# Whole words only: "partner" must not match "Partnerships".
TITLE_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in TITLE_WORDS) + r")\b", re.I)
NAME_RE = re.compile(r"^[A-Z][a-z'’\-]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z'’\-]+$")
# Some firms print names in capitals ("MARK A. GREENBERG"). Kept as printed.
CAPS_NAME_RE = re.compile(r"^[A-Z][A-Z'’\-]+(?:\s+[A-Z]\.?)?\s+[A-Z][A-Z'’\-]+$")


def _hash(text: str) -> str:
    return hashlib.sha256(" ".join(text.split()).encode("utf-8")).hexdigest()[:16]


def _is_title(line: str) -> bool:
    return bool(line) and len(line) <= 90 and bool(TITLE_RE.search(line))


def _is_name(line: str) -> bool:
    # "Managing Director" and "VICE PRESIDENT" are name-shaped; a title word wins.
    return (len(line) <= 40 and bool(NAME_RE.match(line) or CAPS_NAME_RE.match(line))
            and not _is_title(line))


def _people_candidates(lines: list[str]) -> list[dict]:
    """Conservative: pairs a name-looking line with an adjacent title-looking
    line. Misses plenty. Invents nothing.

    Pages differ on whether the title sits below the name (Roebling) or above it
    (REAG). Pairing the wrong way gives every person the *next* person's title,
    so the layout is decided per page by which side titles appear on more
    often. A tie means the page is ambiguous and nothing is returned."""
    lines = [l.strip() for l in lines]
    names = [i for i, l in enumerate(lines) if _is_name(l)]
    after = sum(1 for i in names if i + 1 < len(lines) and _is_title(lines[i + 1]))
    before = sum(1 for i in names if i > 0 and _is_title(lines[i - 1]))

    out, seen = [], set()

    # A page that alternates title/name ties: every name has a title on both
    # sides, which is precisely the REAG layout this pairing exists to handle.
    # Returning nothing would throw away the one reliable fact on the page —
    # who appears on it. So the names are kept and only the title, the part
    # that cannot be assigned honestly, is dropped. A name with no title still
    # earns its place in the CRM; a name with a colleague's title does not.
    # No title sits next to any name: this is a page of headings and link text,
    # not a team page. Emitting these would fill the log with "About Us".
    if after == 0 and before == 0:
        return []

    if after == before:
        for i in names:
            if lines[i] in seen:
                continue
            seen.add(lines[i])
            out.append({"name": lines[i], "title_as_printed": "",
                        "title_position": "not extracted — titles appear on both "
                                          "sides of every name on this page"})
        return out

    step = 1 if after > before else -1
    where = "the line below the name" if step == 1 else "the line above the name"
    for i in names:
        j = i + step
        if not 0 <= j < len(lines) or lines[i] in seen or not _is_title(lines[j]):
            continue
        seen.add(lines[i])
        out.append({"name": lines[i], "title_as_printed": lines[j],
                    "title_position": where})
    return out


def _events_candidates(lines: list[str]) -> list[str]:
    pat = re.compile(
        r"\b(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
        r"|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}\b"
        r"|(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})",
        re.I)
    return [l.strip() for l in lines if pat.search(l) and 10 < len(l.strip()) < 160][:15]


def fetch(sources: list[dict], user_agent: str, timeout_ms: int = 30000) -> dict[str, dict]:
    """Returns {source_id: {ok, hash, text_len, people, events, error}}."""
    results: dict[str, dict] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=user_agent)
        page = ctx.new_page()
        for s in sources:
            res = {"ok": False, "hash": "", "text_len": 0, "http_status": None,
                   "people": [], "events": [], "error": ""}
            try:
                resp = page.goto(s["url"], timeout=timeout_ms, wait_until="domcontentloaded")
                # A 404 page still has a body; hashing it would look like a live source.
                if resp is not None:
                    res["http_status"] = resp.status
                    if resp.status >= 400:
                        raise RuntimeError(f"HTTP {resp.status} at {page.url}")
                page.wait_for_timeout(1500)   # let client-side rendering settle
                text = page.inner_text("body")
                lines = [l for l in text.splitlines() if l.strip()]
                # A consent wall or a client-side block answers 200 with almost
                # nothing. Hashing that would read as a change on the next run.
                if len(text.strip()) < 200:
                    raise RuntimeError(
                        f"HTTP {res['http_status']} but only {len(text.strip())} "
                        f"characters rendered — consent wall, redirect or JS block")
                res["ok"] = True
                fingerprint = text
                if s.get("kind") == "team":
                    # Some team pages are image cards with the name only in the
                    # profile link (/team/jane-doe/). Hash the links too, so an
                    # added or removed profile registers as a change.
                    hrefs = page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
                    fingerprint += "\n" + "\n".join(sorted({h.split("#")[0] for h in hrefs}))
                res["hash"] = _hash(fingerprint)
                res["text_len"] = len(text)
                if s.get("kind") == "team":
                    res["people"] = _people_candidates(lines)
                elif s.get("kind") == "events":
                    res["events"] = _events_candidates(lines)
            except Exception as e:
                res["error"] = str(e)[:300]
            results[s["id"]] = res
        ctx.close()
        browser.close()
    return results
