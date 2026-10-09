"""The LinkedIn workflow against a stand-in site in real Chromium: every failure is reported as it
is, and only a link seen after a reload counts as done. The live site is never touched here."""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from jarvis.owner.linkedin import BrowserUnavailable, LinkedIn, lists, needs_login
from linkedin_site import FakeLinkedIn

PORTFOLIO = "https://siddharthbagga29.github.io/"
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")


def test_url_matching_and_login_detection() -> None:
    assert lists("Website\nsiddharthbagga29.github.io (Portfolio)", PORTFOLIO)
    assert lists("https://www.siddharthbagga29.github.io/", PORTFOLIO)
    assert not lists("Website\nsiddharthbagga29.github.io.evil.com", PORTFOLIO + "x")
    assert needs_login("https://www.linkedin.com/checkpoint/challenge/123")
    assert needs_login("https://www.linkedin.com/authwall?trk=x")
    assert not needs_login("https://www.linkedin.com/in/me/overlay/contact-info/")


def test_assisted_mode_never_claims_it_was_done(tmp_path: Path) -> None:
    opened: list[str] = []
    copied: list[str] = []
    li = LinkedIn(
        "https://www.linkedin.com/in/siddharth-bagga-sid29/",
        PORTFOLIO,
        automated=False,
        profile_dir=tmp_path,
        open_url=opened.append,
        copy=copied.append,
    )
    out = li.add_portfolio()
    assert out.status == "ASSISTED" and "haven't changed anything" in out.summary
    assert copied == [PORTFOLIO]
    assert opened == ["https://www.linkedin.com/in/siddharth-bagga-sid29/edit/contact-info/"]
    check = li.check_portfolio()
    assert check.status == "UNAVAILABLE" and "can't confirm" in check.summary


def test_browser_cannot_be_launched(tmp_path: Path) -> None:
    def broken() -> Any:
        raise BrowserUnavailable("CAPABILITY GAP: no Playwright here")

    li = LinkedIn(
        "https://www.linkedin.com/in/x/", PORTFOLIO, automated=True, profile_dir=tmp_path,
        open_url=print, copy=print, launcher=broken,
    )  # fmt: skip
    out = li.add_portfolio()
    assert out.status == "UNAVAILABLE" and "CAPABILITY GAP" in out.summary
    li.close()


# --- real Chromium against the stand-in site ---------------------------------------------------

pw = pytest.importorskip("playwright.sync_api")
needs_chrome = pytest.mark.skipif(not Path(CHROME).exists(), reason="no Chromium at CHROME")


@pytest.fixture
def site() -> Iterator[FakeLinkedIn]:
    s = FakeLinkedIn()
    yield s
    s.stop()


@pytest.fixture
def li(site: FakeLinkedIn, tmp_path: Path) -> Iterator[LinkedIn]:
    client = LinkedIn(
        site.profile,
        PORTFOLIO,
        automated=True,
        profile_dir=tmp_path / "profile",
        open_url=print,
        copy=print,
        executable_path=CHROME,
        headless=True,
        nav_timeout_ms=4000,
        save_timeout_s=1.5,
    )
    yield client
    client.close()


@needs_chrome
def test_success_is_verified_after_a_reload(site: FakeLinkedIn, li: LinkedIn) -> None:
    out = li.add_portfolio()
    assert out.status == "VERIFIED", out.report()
    assert site.state["websites"] == [PORTFOLIO] and site.state["saves"] == 1
    assert "link present after reload" in out.steps
    again = li.check_portfolio()  # "where did you put it?" reads the real page
    assert again.status == "VERIFIED" and "under Website" in again.summary


@needs_chrome
def test_existing_link_is_not_added_twice(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.state["websites"] = [PORTFOLIO]
    out = li.add_portfolio()
    assert out.status == "ALREADY_PRESENT" and site.state["saves"] == 0


@needs_chrome
def test_no_session_stops_at_sign_in(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.state["logged_in"] = False
    out = li.add_portfolio()
    assert out.status == "NEEDS_LOGIN" and "never see your password" in out.summary
    assert site.state["saves"] == 0


@needs_chrome
def test_edit_form_does_not_open(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.state["mode"] = "no_edit_dialog"
    out = li.add_portfolio()
    assert out.status == "BLOCKED" and "nothing was changed" in out.summary
    assert site.state["saves"] == 0


@needs_chrome
def test_field_cannot_be_found(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.state["mode"] = "no_field"
    out = li.add_portfolio()
    assert out.status == "BLOCKED" and "Website field" in out.summary
    assert site.state["saves"] == 0


@needs_chrome
def test_save_rejected(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.state["mode"] = "save_error"
    out = li.add_portfolio()
    assert out.status == "FAILED" and "Something went wrong" in out.summary
    assert site.state["saves"] == 1  # never retried


@needs_chrome
def test_acknowledged_but_not_persisted(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.state["mode"] = "ack_not_persist"
    out = li.add_portfolio()
    assert out.status == "UNVERIFIED" and "didn't stick" in out.summary
    assert "LinkedIn closed the editor" in out.steps and site.state["saves"] == 1


@needs_chrome
def test_timeout_after_save_is_uncertain_not_success(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.state["mode"] = "save_hangs"
    out = li.add_portfolio()
    assert out.status == "UNVERIFIED" and "no confirmation in time" in out.steps
    assert site.state["saves"] == 1  # one click, no retry


@needs_chrome
def test_browser_error_mid_task_is_a_failure(site: FakeLinkedIn, li: LinkedIn) -> None:
    site.stop()  # the site goes away: navigation throws
    out = li.add_portfolio()
    assert out.status == "FAILED" and "not claiming" in out.summary
