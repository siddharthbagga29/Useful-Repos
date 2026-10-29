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


def _is_title(line: str) -> bool:
    t = line.strip()
    return bool(t) and len(t) <= 90 and any(w in t.lower() for w in TITLE_WORDS)


def _people_candidates(lines: list[str]) -> list[dict]:
    """Conservative: a name-looking line with a title-looking line beside it.
    Misses plenty. Invents nothing.

    Both neighbours are checked, because the layout is not a constant. Some
    team pages print the title above the name — REAG does — and reading only
    the line below hands every person the NEXT person's title. That error is
    invisible in the sheet and surfaces as a cold email addressing someone by
    a job that belongs to their colleague, which is the precise failure the
    verification protocol exists to prevent.

    When a name has a title-looking line on both sides there is no honest way
    to choose, so the title is left unresolved rather than guessed.
    """
    out, seen = [], set()
    for i, line in enumerate(lines):
        name = line.strip()
        if not NAME_RE.match(name) or len(name) > 40 or name in seen:
            continue
        above = lines[i - 1].strip() if i > 0 else ""
        below = lines[i + 1].strip() if i + 1 < len(lines) else ""
        a, b = _is_title(above), _is_title(below)
        if a and b:
            title, where = "", "AMBIGUOUS - title-like text above and below"
        elif b:
            title, where = below, "line below the name"
        elif a:
            title, where = above, "line above the name"
        else:
            continue
        seen.add(name)
        out.append({"name": name, "title_as_printed": title, "title_position": where})
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
            res = {"ok": False, "hash": "", "text_len": 0, "http_status": None,
                   "people": [], "events": [], "error": ""}
            try:
                # goto() does not raise on 4xx/5xx. Without this check a moved
                # team page returns ok=True, the error page gets hashed, and
                # the next run reports a "change" that is really a 404.
                resp = page.goto(s["url"], timeout=timeout_ms,
                                 wait_until="domcontentloaded")
                status = resp.status if resp is not None else 0
                if status >= 400 or status == 0:
                    res["error"] = (f"HTTP {status or 'no response'} — page did not load. "
                                    f"The URL has most likely moved.")
                    res["http_status"] = status
                    results[s["id"]] = res
                    continue
                res["http_status"] = status
                page.wait_for_timeout(1500)   # let client-side rendering settle
                text = page.inner_text("body")
                lines = [l for l in text.splitlines() if l.strip()]
                if len(text.strip()) < 200:
                    res["error"] = (f"Loaded (HTTP {status}) but rendered only "
                                    f"{len(text.strip())} characters — probably a "
                                    f"redirect, consent wall or client-side block.")
                    results[s["id"]] = res
                    continue
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
