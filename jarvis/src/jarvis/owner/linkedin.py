"""LinkedIn: put the portfolio link in Contact info, and check that it is there, with proof.

Two modes, chosen by Siddharth (JARVIS_LINKEDIN_AUTOMATION):

- assisted (default). LinkedIn's User Agreement prohibits automated tools on its site, so by
  default Jarvis does not drive the account. He opens the contact-info editor in the normal
  browser and copies the link; Siddharth pastes and saves. Jarvis reports exactly that ("waiting
  for you"), never "done".
- automated (opt-in). Jarvis drives his own visible Chromium window with a saved profile that
  Siddharth signs into himself, once (Jarvis never sees or types the password). Every edit is
  verified by reloading the contact info and finding the link there.

Status of every run (the "STATUS:" line the agent reports from):
  VERIFIED         saved and seen in a fresh contact-info view
  ALREADY_PRESENT  the link was already there; nothing changed
  ASSISTED         editor opened, link copied; Siddharth finishes it
  NEEDS_LOGIN      LinkedIn wants a sign-in; the window is left on the sign-in page
  BLOCKED          a step couldn't be done (form or field not found); nothing saved
  FAILED           LinkedIn rejected the save, or the browser failed
  UNVERIFIED       Save was clicked but the link isn't in the reloaded contact info
  NOT_FOUND        (check) the link isn't listed
  UNAVAILABLE      no browser automation on this Mac (CAPABILITY GAP)

Save is never retried automatically: a second click after an uncertain outcome could add the
link twice. Ambiguous evidence is reported as UNVERIFIED, not as success.
"""

from __future__ import annotations

import contextlib
import re
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

LOGIN_MARKERS = ("/login", "/checkpoint", "/authwall", "/uas/", "/signup")
ADD_WEBSITE = re.compile(r"add website", re.IGNORECASE)
WEBSITE_URL = re.compile(r"website url", re.IGNORECASE)
WEBSITE_TYPE = re.compile(r"website type", re.IGNORECASE)
SAVE = re.compile(r"^\s*save\s*$", re.IGNORECASE)


@dataclass
class Outcome:
    status: str
    summary: str  # one spoken sentence or two
    steps: list[str] = field(default_factory=list)

    def report(self) -> str:
        lines = [self.summary, f"STATUS: {self.status}"]
        if self.steps:
            lines.append("STEPS: " + "; ".join(self.steps))
        return "\n".join(lines)


def normalise(url: str) -> str:
    u = re.sub(r"^https?://", "", url.strip().lower())
    return u.removeprefix("www.").rstrip("/")


def lists(text: str, url: str) -> bool:
    """Whether contact-info text shows the URL (LinkedIn displays it without the scheme)."""
    body = re.sub(r"https?://", "", text.lower()).replace("www.", "")
    return normalise(url) in body


def needs_login(url: str) -> bool:
    return any(marker in url for marker in LOGIN_MARKERS)


class BrowserUnavailable(RuntimeError):
    """Playwright or its Chromium isn't installed."""


class LinkedIn:
    def __init__(
        self,
        profile_url: str,
        portfolio_url: str,
        *,
        automated: bool,
        profile_dir: Path,
        open_url: Callable[[str], object],
        copy: Callable[[str], object],
        executable_path: str | None = None,
        headless: bool = False,
        nav_timeout_ms: int = 20_000,
        save_timeout_s: float = 15.0,
        launcher: Callable[[], Any] | None = None,
    ) -> None:
        self.profile_url = profile_url.rstrip("/") + "/"
        self.portfolio_url = portfolio_url
        self.automated = automated
        self._profile_dir = profile_dir
        self._open_url = open_url
        self._copy = copy
        self._exe = executable_path
        self._headless = headless
        self._nav_ms = nav_timeout_ms
        self._save_s = save_timeout_s
        self._launcher = launcher or self._launch
        self._pw: Any = None
        self._context: Any = None
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="jarvis-linkedin")
        self._lock = threading.Lock()

    @property
    def view_url(self) -> str:
        return self.profile_url + "overlay/contact-info/"

    @property
    def edit_url(self) -> str:
        return self.profile_url + "edit/contact-info/"

    # --- the two operations the tools expose ---------------------------------------------

    def add_portfolio(self) -> Outcome:
        if not self.automated:
            self._copy(self.portfolio_url)
            self._open_url(self.edit_url)
            return Outcome(
                "ASSISTED",
                "I've opened your LinkedIn contact-info editor and copied your portfolio link. "
                "Paste it under Website, choose Portfolio and press Save; I haven't changed "
                "anything myself. Ask me to check once you've saved.",
                ["copied link to clipboard", f"opened {self.edit_url}"],
            )
        return self._on_browser(self._add)

    def check_portfolio(self) -> Outcome:
        if not self.automated:
            self._open_url(self.view_url)
            return Outcome(
                "UNAVAILABLE",
                "I can't read your LinkedIn myself in assisted mode, so I can't confirm it. "
                "I've opened your contact info so you can see.",
                [f"opened {self.view_url}"],
            )
        return self._on_browser(self._check)

    def close(self) -> None:
        def stop() -> None:
            if self._context is not None:
                self._context.close()
            if self._pw is not None:
                self._pw.stop()
            self._context = self._pw = None

        with contextlib.suppress(Exception):  # closing must never raise during shutdown
            self._pool.submit(stop).result(timeout=10)
        self._pool.shutdown(wait=False)

    # --- browser plumbing (every Playwright call happens on one worker thread) -------------

    def _on_browser(self, work: Callable[[Any], Outcome]) -> Outcome:
        def run() -> Outcome:
            try:
                page = self._page()
            except BrowserUnavailable as exc:
                return Outcome("UNAVAILABLE", str(exc))
            try:
                return work(page)
            except Exception as exc:  # the browser died, the network failed, etc.
                return Outcome(
                    "FAILED",
                    f"The browser step failed ({type(exc).__name__}). I don't know whether "
                    "anything was saved, so I'm not claiming it was.",
                    [str(exc)[:200]],
                )

        with self._lock:
            return self._pool.submit(run).result(
                timeout=self._save_s + 4 * self._nav_ms / 1000 + 30
            )

    def _launch(self) -> Any:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise BrowserUnavailable(
                "CAPABILITY GAP: LinkedIn automation needs Playwright. On the Mac run: "
                "pip install -e '.[browser]' && playwright install chromium"
            ) from exc
        self._profile_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._pw = sync_playwright().start()
        try:
            return self._pw.chromium.launch_persistent_context(
                str(self._profile_dir), headless=self._headless, executable_path=self._exe
            )
        except Exception as exc:
            self._pw.stop()
            self._pw = None
            raise BrowserUnavailable(
                f"CAPABILITY GAP: Jarvis's browser couldn't start ({exc}). "
                "Run: playwright install chromium"
            ) from exc

    def _page(self) -> Any:
        if self._context is None:
            self._context = self._launcher()
        pages = self._context.pages
        page = pages[0] if pages else self._context.new_page()
        page.set_default_timeout(self._nav_ms)
        return page

    def _goto(self, page: Any, url: str) -> bool:
        """Navigate; False if LinkedIn sent us to a sign-in or security check."""
        page.goto(url, wait_until="domcontentloaded")
        return not needs_login(page.url)

    def _login_needed(self, steps: list[str]) -> Outcome:
        return Outcome(
            "NEEDS_LOGIN",
            "LinkedIn wants you to sign in first. I've left the sign-in page open in my browser "
            "window: sign in there yourself (I never see your password), then ask me again.",
            [*steps, "stopped at LinkedIn sign-in"],
        )

    def _contact_text(self, page: Any, steps: list[str]) -> str | Outcome:
        if not self._goto(page, self.view_url):
            return self._login_needed(steps)
        dialog = page.get_by_role("dialog")
        try:
            dialog.first.wait_for(state="visible", timeout=self._nav_ms)
        except Exception:
            return Outcome(
                "BLOCKED",
                "Your LinkedIn contact info didn't open, so I couldn't read it.",
                [*steps, "contact-info view did not appear"],
            )
        steps.append("read contact info")
        return str(dialog.first.inner_text())

    # --- the workflows ---------------------------------------------------------------------

    def _check(self, page: Any) -> Outcome:
        steps: list[str] = []
        text = self._contact_text(page, steps)
        if isinstance(text, Outcome):
            return text
        if lists(text, self.portfolio_url):
            return Outcome(
                "VERIFIED",
                f"Yes: your LinkedIn contact info lists {normalise(self.portfolio_url)} under "
                "Website. I've left it open in my browser window.",
                steps,
            )
        return Outcome(
            "NOT_FOUND",
            "Your portfolio link is not in your LinkedIn contact info.",
            steps,
        )

    def _add(self, page: Any) -> Outcome:
        steps: list[str] = []
        before = self._contact_text(page, steps)  # 1. current state
        if isinstance(before, Outcome):
            return before
        if lists(before, self.portfolio_url):
            return Outcome(
                "ALREADY_PRESENT",
                "Your portfolio link is already in your LinkedIn contact info, so I left it as "
                "it is.",
                steps,
            )

        if not self._goto(page, self.edit_url):  # 2. the editor
            return self._login_needed(steps)
        dialog = page.get_by_role("dialog").first
        try:
            dialog.wait_for(state="visible", timeout=self._nav_ms)
        except Exception:
            return Outcome(
                "BLOCKED",
                "LinkedIn's contact-info editor didn't open, so nothing was changed.",
                [*steps, "edit form did not appear"],
            )
        steps.append("opened contact-info editor")

        add = dialog.get_by_role("button", name=ADD_WEBSITE)  # 3. the field
        if add.count():
            add.first.click()
            steps.append("clicked Add website")
        fields = dialog.get_by_label(WEBSITE_URL)
        if not fields.count():
            return Outcome(
                "BLOCKED",
                "I couldn't find the Website field in LinkedIn's editor (their page may have "
                "changed), so nothing was changed.",
                [*steps, "Website URL field not found"],
            )
        empty = [f for f in fields.all() if not f.input_value().strip()]
        target = empty[-1] if empty else fields.last
        target.fill(self.portfolio_url)
        steps.append("entered the portfolio URL")
        kind = dialog.get_by_label(WEBSITE_TYPE)
        if kind.count():
            try:
                kind.last.select_option(label="Portfolio")
                steps.append("set type to Portfolio")
            except Exception:
                steps.append("couldn't set the website type (left as is)")

        save = dialog.get_by_role("button", name=SAVE)  # 4. save, once
        if not save.count():
            return Outcome(
                "BLOCKED",
                "I couldn't find LinkedIn's Save button, so nothing was saved.",
                [*steps, "Save button not found"],
            )
        save.first.click()
        steps.append("clicked Save")
        acknowledged, error = self._await_save(page, dialog)
        if error:
            return Outcome(
                "FAILED",
                f"LinkedIn didn't accept the change: {error}",
                [*steps, f"LinkedIn error: {error}"],
            )
        steps.append("LinkedIn closed the editor" if acknowledged else "no confirmation in time")

        after = self._contact_text(page, steps)  # 5. verify in a fresh view
        if isinstance(after, Outcome):
            after.status = "UNVERIFIED"
            after.summary = "I clicked Save but couldn't re-open your contact info to confirm it."
            return after
        if lists(after, self.portfolio_url):
            return Outcome(
                "VERIFIED",
                f"Done: {normalise(self.portfolio_url)} is now in your LinkedIn contact info "
                "under Website. I reloaded it to make sure it saved.",
                [*steps, "link present after reload"],
            )
        return Outcome(
            "UNVERIFIED",
            "I clicked Save, but after reloading, the link isn't in your contact info, so it "
            "didn't stick. I haven't retried, to avoid adding it twice.",
            [*steps, "link absent after reload"],
        )

    def _await_save(self, page: Any, dialog: Any) -> tuple[bool, str]:
        """(acknowledged, error_text): the editor closing is the acknowledgement; an alert in it
        is a rejection; neither within the timeout is uncertain."""
        waited = 0.0
        while waited < self._save_s:
            if not dialog.is_visible():
                return True, ""
            alert = dialog.get_by_role("alert")
            if alert.count() and alert.first.is_visible():
                return False, str(alert.first.inner_text()).strip()[:200] or "an error"
            page.wait_for_timeout(250)
            waited += 0.25
        return False, ""
