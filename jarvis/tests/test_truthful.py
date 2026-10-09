"""Bug A: Jarvis said he'd added the portfolio link to LinkedIn when nothing had been changed.

Reproduced here with a scripted model that opens LinkedIn and then claims success. The agent
must report what actually ran, let the LinkedIn workflow speak for itself, and answer "where did
you put it?" from the records."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from jarvis.config import DEFAULT_BRIEF
from jarvis.knowledge import Brief
from jarvis.llm.base import AgentStep, ToolCall
from jarvis.llm.fake import ScriptedAgentSession
from jarvis.owner.agent import OwnerAgent, honest
from jarvis.owner.confirm import DenyAll
from jarvis.owner.linkedin import LinkedIn, Outcome
from jarvis.owner.mac import MacActions
from jarvis.owner.memory import AuditLog, Memory
from jarvis.owner.tools import build_registry


class Yes:
    def __init__(self) -> None:
        self.asked: list[str] = []

    def confirm(self, summary: str) -> bool:
        self.asked.append(summary)
        return True


class FakeLinkedIn(LinkedIn):
    """The real class with its browser step replaced by a fixed outcome."""

    def __init__(self, tmp: Path, outcome: Outcome) -> None:
        super().__init__(
            "https://www.linkedin.com/in/siddharth-bagga-sid29/",
            "https://siddharthbagga29.github.io/",
            automated=True,
            profile_dir=tmp,
            open_url=lambda u: None,
            copy=lambda t: None,
        )
        self.outcome = outcome
        self.calls = 0

    def add_portfolio(self) -> Outcome:
        self.calls += 1
        return self.outcome

    def check_portfolio(self) -> Outcome:
        return Outcome(
            "VERIFIED",
            "Yes: your LinkedIn contact info lists siddharthbagga29.github.io under Website.",
        )


def call(name: str, **args: Any) -> AgentStep:
    return AgentStep(text="", tool_calls=[ToolCall(id=f"c_{name}", name=name, arguments=args)])


def agent_with(
    tmp_path: Path, steps: list[AgentStep], linkedin: LinkedIn | None = None, confirm: Any = None
) -> tuple[OwnerAgent, list[list[str]], Path]:
    opened: list[list[str]] = []
    audit = tmp_path / "audit.jsonl"
    holder: dict[str, OwnerAgent] = {}
    tools = build_registry(
        Brief.load(DEFAULT_BRIEF),
        MacActions(runner=lambda argv: opened.append(argv) or "ok"),  # type: ignore[func-returns-value]
        Memory(tmp_path / "m.sqlite3"),
        "Work",
        linkedin=linkedin,
        recent_actions=lambda: holder["a"].recent_actions(),
    )
    session = ScriptedAgentSession(steps)
    agent = OwnerAgent(lambda: session, tools, confirm or Yes(), AuditLog(audit))
    holder["a"] = agent
    return agent, opened, audit


def test_bug_a_reproduced_claim_after_only_opening_linkedin_is_corrected(tmp_path: Path) -> None:
    agent, opened, audit = agent_with(
        tmp_path,
        [
            call("open_url", url="https://www.linkedin.com/in/siddharth-bagga-sid29/"),
            AgentStep(text="I've added your portfolio link to your LinkedIn contact info."),
        ],
    )
    reply = agent.handle("Open my LinkedIn and add my portfolio URL to my contact info")
    assert opened  # LinkedIn really was opened...
    assert reply.startswith("To be accurate: I haven't done that, and nothing was changed.")
    assert "open https://www.linkedin.com/in/siddharth-bagga-sid29/ (ok)" in reply  # ...only that
    records = [json.loads(line) for line in audit.read_text().splitlines()]
    assert any(r.get("event") == "FALSE_CLAIM_CORRECTED" for r in records)


def test_claim_with_no_action_at_all_is_corrected(tmp_path: Path) -> None:
    agent, _, _ = agent_with(tmp_path, [AgentStep(text="Done, I've updated your profile.")])
    assert "nothing was changed" in agent.handle("update my LinkedIn")


def test_honest_replies_pass_through(tmp_path: Path) -> None:
    agent, _, _ = agent_with(
        tmp_path, [AgentStep(text="I can't edit LinkedIn myself; shall I open it for you?")]
    )
    assert agent.handle("add my portfolio") == (
        "I can't edit LinkedIn myself; shall I open it for you?"
    )


def test_verified_workflow_speaks_for_itself(tmp_path: Path) -> None:
    li = FakeLinkedIn(
        tmp_path,
        Outcome(
            "VERIFIED",
            "Done: siddharthbagga29.github.io is now in your LinkedIn contact info under Website.",
        ),
    )
    yes = Yes()
    agent, _, _ = agent_with(
        tmp_path,
        [call("linkedin_add_portfolio"), AgentStep(text="(model paraphrase, ignored)")],
        linkedin=li,
        confirm=yes,
    )
    reply = agent.handle("add my portfolio to LinkedIn")
    assert reply.startswith("Done: siddharthbagga29.github.io is now in your LinkedIn")
    assert yes.asked and "LinkedIn contact info" in yes.asked[0]  # level 2: asked first
    assert li.calls == 1


@pytest.mark.parametrize(
    ("status", "summary"),
    [
        ("BLOCKED", "I couldn't find the Website field in LinkedIn's editor, so nothing changed."),
        ("NEEDS_LOGIN", "LinkedIn wants you to sign in first."),
        ("UNVERIFIED", "I clicked Save, but after reloading, the link isn't there."),
    ],
)
def test_failed_workflow_cannot_be_turned_into_success(
    tmp_path: Path, status: str, summary: str
) -> None:
    li = FakeLinkedIn(tmp_path, Outcome(status, summary))
    agent, _, _ = agent_with(
        tmp_path,
        [call("linkedin_add_portfolio"), AgentStep(text="All done, I've added it!")],
        linkedin=li,
    )
    assert agent.handle("add my portfolio to LinkedIn") == summary
    # ...and a later claim of success is still caught, because nothing changed
    agent2, _, _ = agent_with(
        tmp_path,
        [call("linkedin_add_portfolio"), AgentStep(text="x"), AgentStep(text="I've added it.")],
        linkedin=FakeLinkedIn(tmp_path, Outcome(status, summary)),
    )
    agent2.handle("add my portfolio to LinkedIn")
    assert "nothing was changed" in agent2.handle("did you add it?")


def test_declined_action_is_not_reported_as_done(tmp_path: Path) -> None:
    li = FakeLinkedIn(tmp_path, Outcome("VERIFIED", "Done."))
    agent, _, _ = agent_with(
        tmp_path,
        [call("linkedin_add_portfolio"), AgentStep(text="I've added it to LinkedIn.")],
        linkedin=li,
        confirm=DenyAll(),
    )
    reply = agent.handle("add my portfolio to LinkedIn")
    assert li.calls == 0 and "nothing was changed" in reply


def test_where_did_you_put_it_resolves_from_the_record(tmp_path: Path) -> None:
    li = FakeLinkedIn(tmp_path, Outcome("VERIFIED", "Done: it's under Website."))
    sent: list[str] = []

    class Session(ScriptedAgentSession):
        def send_user(self, text: str) -> AgentStep:
            sent.append(text)
            return super().send_user(text)

    steps = [
        call("linkedin_add_portfolio"),
        AgentStep(text="ok"),
        call("linkedin_check_portfolio"),
        AgentStep(text="ok"),
    ]
    session = Session(steps)
    tools = build_registry(
        Brief.load(DEFAULT_BRIEF),
        MacActions(runner=lambda argv: "ok"),
        Memory(tmp_path / "m.sqlite3"),
        "Work",
        linkedin=li,
    )
    agent = OwnerAgent(lambda: session, tools, Yes(), AuditLog(tmp_path / "a.jsonl"))
    agent.handle("add my portfolio to LinkedIn")
    reply = agent.handle("where did you put it?")
    assert "Your most recent action: add https://siddharthbagga29.github.io/" in sent[1]
    assert "VERIFIED" in sent[1]
    assert reply.startswith("Yes: your LinkedIn contact info lists")  # read from the real page
    assert "VERIFIED" in agent.recent_actions()


def test_recent_actions_tool_reports_real_outcomes(tmp_path: Path) -> None:
    agent, _, _ = agent_with(
        tmp_path,
        [
            call("open_url", url="https://www.linkedin.com/"),
            AgentStep(text="Opened it."),
            call("recent_actions"),
            AgentStep(text="I opened LinkedIn, that's all."),
        ],
    )
    agent.handle("open LinkedIn")
    assert agent.handle("what did you do?") == "I opened LinkedIn, that's all."
    assert "open https://www.linkedin.com/: ok" in agent.recent_actions()


def test_honest_unit_rules() -> None:
    from jarvis.owner.agent import ActionRecord

    opened = ActionRecord("t", "2026-10-09T10:00:00", "open_url", "open x", 1, "ok")
    drafted = ActionRecord("t", "2026-10-09T10:00:00", "draft_email", "draft", 2, "ok")
    verified = ActionRecord("t", "2026-10-09T10:00:00", "li", "add", 2, "ok", "VERIFIED")
    blocked = ActionRecord("t", "2026-10-09T10:00:00", "li", "add", 2, "ok", "BLOCKED")
    assert honest("I've opened it.", [opened], []) is None
    assert honest("I've opened it.", [], []) is not None
    assert honest("I've added it.", [opened], []) is not None
    assert honest("I've created the draft.", [drafted], []) is None
    assert honest("I've added it.", [blocked], []) is not None
    assert honest("It's been added, as I said.", [], [verified]) is None
    assert honest("Here are three papers.", [], []) is None


def test_actions_report_lists_outcomes_without_arguments(tmp_path: Path) -> None:
    from jarvis.owner.memory import recent_actions_report

    agent, _, audit = agent_with(
        tmp_path,
        [
            call("open_url", url="https://www.linkedin.com/in/x/"),
            AgentStep(text="I've added it."),
        ],
    )
    agent.handle("add my portfolio")
    report = recent_actions_report(audit)
    assert "open_url: ok" in report and "corrected a false claim" in report
    assert "linkedin.com/in/x" not in report  # arguments stay in the audit log only
    assert recent_actions_report(tmp_path / "none.jsonl") == "No actions recorded yet."


def test_doctor_names_retired_settings_and_linkedin_mode(tmp_path: Path) -> None:
    from jarvis.config import load_owner
    from jarvis.owner.doctor import Report, check_linkedin, check_retired

    r = Report()
    check_retired(r, {"JARVIS_FOLLOW_UP_SECONDS": "6", "JARVIS_FAST_MODEL": ""})
    assert "JARVIS_FOLLOW_UP_SECONDS no longer does anything" in r.text()
    assert "FAST_MODEL" not in r.text()  # blank means unset
    r = Report()
    check_linkedin(r, load_owner({"JARVIS_STATE_DIR": str(tmp_path)}, ram_gb=8))
    assert "assisted mode" in r.text()


def test_linkedin_profile_setting_is_validated() -> None:
    from jarvis.config import ConfigError, load_owner

    with pytest.raises(ConfigError):
        load_owner({"JARVIS_LINKEDIN_PROFILE": "https://evil.example/in/x"}, ram_gb=8)
    s = load_owner({"JARVIS_LINKEDIN_AUTOMATION": "on"}, ram_gb=8)
    assert s.linkedin_automation and s.session_idle_seconds == 30.0 and s.barge_in


# --- audit 2026-10-09: the phrase-matching guard missed 5 of 8 realistic false claims ----------

MISSED_BEFORE = [
    "Your portfolio is now on LinkedIn.",
    "Successfully added the link to your contact info.",
    "I went ahead and updated your LinkedIn.",
    "Added! It's on your profile now.",
    "Your LinkedIn now shows the portfolio under Website.",
    "Sure, adding it to your LinkedIn now.",
    "I'll add it to your contact info right away.",
]


@pytest.mark.parametrize("claim", MISSED_BEFORE)
def test_any_unhedged_reply_to_a_change_request_without_a_change_is_corrected(
    tmp_path: Path, claim: str
) -> None:
    agent, _, _ = agent_with(
        tmp_path,
        [
            call("open_url", url="https://www.linkedin.com/in/siddharth-bagga-sid29/"),
            AgentStep(text=claim),
        ],
    )
    reply = agent.handle("Open my LinkedIn and add my portfolio URL to my contact info")
    assert reply.startswith("To be accurate: I haven't done that"), reply


@pytest.mark.parametrize(
    "hedged",
    [
        "I can't edit LinkedIn myself. Shall I open the editor for you?",
        "I couldn't find the Website field, so nothing was changed.",
        "Which URL should I add, the portfolio or the research page?",
    ],
)
def test_honest_or_questioning_replies_to_change_requests_pass(tmp_path: Path, hedged: str) -> None:
    agent, _, _ = agent_with(tmp_path, [AgentStep(text=hedged)])
    assert agent.handle("add my portfolio to LinkedIn") == hedged


def test_questions_are_not_change_requests(tmp_path: Path) -> None:
    agent, _, _ = agent_with(tmp_path, [AgentStep(text="Your next step is the LinkedIn link.")])
    assert agent.handle("what should I add next?") == "Your next step is the LinkedIn link."


def test_an_old_success_does_not_cover_later_claims(tmp_path: Path) -> None:
    li = FakeLinkedIn(tmp_path, Outcome("VERIFIED", "Done: it's under Website."))
    agent, _, _ = agent_with(
        tmp_path,
        [
            call("linkedin_add_portfolio"),
            AgentStep(text="ok"),
            AgentStep(text="It's under Website, where I added it."),  # next turn: fine
            AgentStep(text="Noted."),
            AgentStep(text="Noted."),
            AgentStep(text="I've updated your calendar too."),  # three turns later: false
        ],
        linkedin=li,
    )
    agent.handle("add my portfolio to LinkedIn")
    assert agent.handle("where did you put it?") == "It's under Website, where I added it."
    agent.handle("thanks")
    agent.handle("ok")
    assert "nothing was changed" in agent.handle("did you update my calendar?")


def test_verified_reports_are_never_second_guessed(tmp_path: Path) -> None:
    li = FakeLinkedIn(
        tmp_path, Outcome("BLOCKED", "I couldn't find the Website field, so nothing changed.")
    )
    agent, _, _ = agent_with(
        tmp_path, [call("linkedin_add_portfolio"), AgentStep(text="x")], linkedin=li
    )
    assert agent.handle("add my portfolio") == (
        "I couldn't find the Website field, so nothing changed."
    )
