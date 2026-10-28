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
NAME_RE = re.compile(r"^[A-Z][a-z'’\-]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z'’\-]+$")


def _hash(text: str) -> str:
    return hashlib.sha256(" ".join(text.split()).encode("utf-8")).hexdigest()[:16]


def _people_candidates(lines: list[str]) -> list[dict]:
    """Conservative: a name-looking line immediately followed by a title-looking
    line. Misses plenty. Invents nothing."""
    out, seen = [], set()
    for i, line in enumerate(lines[:-1]):
        name = line.strip()
        if not NAME_RE.match(name) or len(name) > 40 or name in seen:
            continue
        nxt = lines[i + 1].strip()
        if not nxt or len(nxt) > 90:
            continue
        if any(w in nxt.lower() for w in TITLE_WORDS):
            seen.add(name)
            out.append({"name": name, "title_as_printed": nxt})
    return out


def _events_candidates(lines: list[str]) -> list[str]:
    pat = re.compile(
        r"\b(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
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
            res = {"ok": False, "hash": "", "text_len": 0,
                   "people": [], "events": [], "error": ""}
            try:
                page.goto(s["url"], timeout=timeout_ms, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)   # let client-side rendering settle
                text = page.inner_text("body")
                lines = [l for l in text.splitlines() if l.strip()]
                res["ok"] = True
                res["hash"] = _hash(text)
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
