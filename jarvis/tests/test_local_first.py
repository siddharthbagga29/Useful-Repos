"""Local-first owner Jarvis: config precedence, the Ollama backend's failure modes, voice-loop
recovery, and the doctor. Regression for the incident where .env said qwen3:4b but Jarvis ran
qwen3:8b (nothing read .env, and the shell variable lacked the JARVIS_ prefix)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from jarvis.config import LLMSettings, load_owner, owner_env, read_env_file
from jarvis.llm.base import AgentStep
from jarvis.llm.ollama_backend import LocalModelError, OllamaAgentSession, explain, warm_up

# --- configuration -----------------------------------------------------------------------------


def write_env(tmp_path: Path, text: str) -> Path:
    p = tmp_path / ".env"
    p.write_text(text, encoding="utf-8")
    return p


def settings_for(environ: dict[str, str], *, model: str | None = None, ram: float = 8) -> Any:
    layered = owner_env(environ)
    return load_owner(layered.values, model=model, ram_gb=ram, origin=layered.origin)


def test_env_file_model_is_honoured_without_prefix(tmp_path: Path) -> None:
    env_file = write_env(tmp_path, "# mine\nOLLAMA_MODEL=qwen3:4b\n")
    s = settings_for({"JARVIS_ENV_FILE": str(env_file)}, ram=16)
    assert s.llm.ollama_model == "qwen3:4b"  # the incident: this used to load qwen3:8b
    assert s.llm.ollama_model_source == str(env_file)


def test_precedence_flag_then_environment_then_file_then_auto(tmp_path: Path) -> None:
    env_file = write_env(tmp_path, "JARVIS_OLLAMA_MODEL=qwen3:4b\nOLLAMA_MODEL=ignored:1b\n")
    base = {"JARVIS_ENV_FILE": str(env_file)}
    assert settings_for(base).llm.ollama_model == "qwen3:4b"  # prefixed line wins in the file
    env = {**base, "JARVIS_OLLAMA_MODEL": "qwen3:14b"}
    s = settings_for(env)
    assert (s.llm.ollama_model, s.llm.ollama_model_source) == ("qwen3:14b", "environment")
    s = settings_for(env, model="qwen3:30b")
    assert (s.llm.ollama_model, s.llm.ollama_model_source) == ("qwen3:30b", "--model flag")


def test_unprefixed_shell_variable_is_not_read(tmp_path: Path) -> None:
    # OLLAMA_* in the shell can belong to Ollama itself, so only JARVIS_ is read there.
    s = settings_for({"JARVIS_ENV_FILE": str(tmp_path / "none"), "OLLAMA_MODEL": "qwen3:14b"})
    assert s.llm.ollama_model == "qwen3:4b-instruct"
    assert s.llm.ollama_model_source == "auto: 8 GB memory"


@pytest.mark.parametrize(
    ("ram", "model"), [(8, "qwen3:4b-instruct"), (16, "qwen3:8b"), (0, "qwen3:8b")]
)
def test_auto_model_fits_the_mac(tmp_path: Path, ram: float, model: str) -> None:
    s = settings_for({"JARVIS_ENV_FILE": str(tmp_path / "none")}, ram=ram)
    assert s.llm.ollama_model == model
    assert s.llm.timeout_seconds == 120  # room for the first model load


def test_read_env_file_handles_quotes_export_and_comments(tmp_path: Path) -> None:
    p = write_env(
        tmp_path, 'export JARVIS_VOICE="Jamie (Premium)"\n# c\n\nAUTONOMY=strict\nBAD LINE\n'
    )
    values = read_env_file(p)
    assert values["JARVIS_VOICE"] == "Jamie (Premium)"
    assert values["JARVIS_AUTONOMY"] == "strict"


def test_banner_shows_the_model_actually_loaded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from jarvis.llm import ollama_backend
    from jarvis.owner import cli

    env_file = write_env(tmp_path, "OLLAMA_MODEL=qwen3:4b\n")
    monkeypatch.setenv("JARVIS_ENV_FILE", str(env_file))
    monkeypatch.setenv("JARVIS_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.delenv("JARVIS_OLLAMA_MODEL", raising=False)
    seen: list[str] = []

    def fake_warm_up(settings: LLMSettings) -> float:
        seen.append(settings.ollama_model)
        raise LocalModelError("not_running", "Ollama isn't running.")

    def fake_check(settings: LLMSettings) -> str:
        seen.append(settings.ollama_model)
        return "tools"

    monkeypatch.setattr(ollama_backend, "check_model", fake_check)
    monkeypatch.setattr(ollama_backend, "warm_up", fake_warm_up)
    assert cli.main([]) == 3  # a broken model is reported at startup, not after the wake word
    out = capsys.readouterr()
    assert f"ollama:qwen3:4b (from {env_file})" in out.out
    assert seen == ["qwen3:4b", "qwen3:4b"]  # banner, capability check and request agree
    assert "not_running" in out.err and "--doctor" in out.err
    assert "#pair-" not in out.out  # the pairing link is never in the startup log


def test_pair_flag_prints_link_only_on_request(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from jarvis.owner import cli

    monkeypatch.setenv("JARVIS_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("JARVIS_ENV_FILE", str(tmp_path / "none"))
    assert cli.main(["--pair"]) == 0
    assert "#pair-" in capsys.readouterr().out


# --- Ollama backend ----------------------------------------------------------------------------


def llm(**kw: Any) -> LLMSettings:
    return LLMSettings(backend="ollama", ollama_model="qwen3:4b", **kw)


def test_request_uses_configured_model_without_thinking() -> None:
    bodies: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "http://127.0.0.1:11434/api/chat"
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json={"message": {"role": "assistant", "content": "Ready."}})

    s = llm()
    http = httpx.Client(base_url=s.ollama_url, transport=httpx.MockTransport(handler))
    step = OllamaAgentSession(s, "system", [], http=http).send_user("hi")
    assert step == AgentStep(text="Ready.", tool_calls=[])
    b = bodies[0]
    assert b["model"] == "qwen3:4b" and b["think"] is False
    assert b["keep_alive"] == "30m" and b["options"]["num_ctx"] == 8192
    assert warm_up(s, http=http) >= 0


def raising(exc: Exception) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        raise exc

    return httpx.Client(base_url="http://127.0.0.1:11434", transport=httpx.MockTransport(handler))


def status(code: int, error: str) -> httpx.Client:
    return httpx.Client(
        base_url="http://127.0.0.1:11434",
        transport=httpx.MockTransport(lambda r: httpx.Response(code, json={"error": error})),
    )


@pytest.mark.parametrize(
    ("http", "kind", "says"),
    [
        (raising(httpx.ConnectError("refused")), "not_running", "Open the Ollama app"),
        (raising(httpx.ReadTimeout("slow")), "timeout", "took longer"),
        (status(404, 'model "qwen3:4b" not found'), "model_missing", "ollama pull qwen3:4b"),
        (
            status(500, "llama runner process has terminated: invalid argument: --no-map"),
            "runner_mismatch",
            "--doctor",
        ),
        (status(500, "out of memory"), "server_error", "out of memory"),
    ],
)
def test_failures_are_explained(http: httpx.Client, kind: str, says: str) -> None:
    with pytest.raises(LocalModelError) as info:
        OllamaAgentSession(llm(), "s", [], http=http).send_user("hi")
    assert info.value.kind == kind and says in str(info.value)


def test_non_qwen_models_are_not_sent_think() -> None:
    from jarvis.llm.ollama_backend import _options

    assert "think" not in _options(LLMSettings(ollama_model="llama3.1:8b"))
    assert explain(LocalModelError("timeout", "x"), llm()).kind == "timeout"


# --- agent and voice loop recovery -------------------------------------------------------------


class BrokenThenFine:
    def __init__(self) -> None:
        self.sessions = 0

    def __call__(self) -> Any:
        self.sessions += 1
        n = self.sessions

        class S:
            def send_user(self, text: str) -> AgentStep:
                if n == 1:
                    raise LocalModelError("not_running", "Ollama isn't running.")
                return AgentStep(text="Here you are.", tool_calls=[])

            def send_tool_results(self, results: Any) -> AgentStep:
                raise AssertionError

        return S()


def make_agent(tmp_path: Path, factory: Any) -> Any:
    from jarvis.owner.agent import OwnerAgent
    from jarvis.owner.confirm import DenyAll
    from jarvis.owner.memory import AuditLog

    return OwnerAgent(factory, {}, DenyAll(), AuditLog(tmp_path / "a.jsonl"))


def test_model_failure_is_spoken_and_the_next_turn_recovers(tmp_path: Path) -> None:
    factory = BrokenThenFine()
    agent = make_agent(tmp_path, factory)
    assert "Ollama isn't running" in agent.handle("hello")
    assert agent.handle("hello again") == "Here you are."
    assert factory.sessions == 2  # fresh local session; no other provider is tried
    assert "model" in (tmp_path / "a.jsonl").read_text()


def test_mic_is_paused_while_jarvis_speaks() -> None:
    from jarvis.owner.voice import VoiceIO

    events: list[str] = []

    class Stream:
        active = True

        def is_active(self) -> bool:
            return self.active

        def stop_stream(self) -> None:
            self.active = False
            events.append("mic off")

        def start_stream(self) -> None:
            self.active = True
            events.append("mic on")

    class Wake:
        def reset(self) -> None:
            events.append("wake reset")

    v = VoiceIO.__new__(VoiceIO)
    v._stream, v._wake = Stream(), Wake()  # type: ignore[attr-defined]
    v.say("Yes?", "Daniel")
    assert events == ["mic off", "mic on", "wake reset"]


# --- doctor ------------------------------------------------------------------------------------


def test_doctor_parses_a_version_mismatch() -> None:
    from jarvis.owner.doctor import parse_versions

    out = "ollama version is 0.40.1\nWarning: client version is 0.32.5"
    assert parse_versions(out) == ("0.40.1", "0.32.5")
    assert parse_versions("ollama version is 0.40.1") == ("0.40.1", "")


def test_doctor_finds_every_install(tmp_path: Path) -> None:
    from jarvis.owner.doctor import ollama_binaries

    dirs = []
    for d in ("brew", "local"):
        p = tmp_path / d
        p.mkdir()
        exe = p / "ollama"
        exe.write_text("#!/bin/sh\n")
        exe.chmod(0o755)
        dirs.append(str(p))
    found = ollama_binaries(":".join(dirs), app_binary=tmp_path / "missing")
    assert [f.parent.name for f in found] == ["brew", "local"]


def test_doctor_reports_mismatch_with_the_exact_fix(tmp_path: Path) -> None:
    from jarvis.owner.doctor import run_doctor

    brew = tmp_path / "homebrew" / "bin"
    brew.mkdir(parents=True)
    (brew / "ollama").write_text("#!/bin/sh\n")
    (brew / "ollama").chmod(0o755)

    def run(argv: list[str]) -> tuple[int, str]:
        if argv[-1] == "-v":
            return 0, "ollama version is 0.40.1\nWarning: client version is 0.32.5"
        return 0, ""

    environ = {
        "PATH": str(brew),
        "JARVIS_ENV_FILE": str(tmp_path / "none"),
        "JARVIS_OLLAMA_URL": "http://127.0.0.1:9",  # nothing listens: no server
    }
    r = run_doctor(environ=environ, run=run, ram_gb=8, live=False)
    text = r.text()
    assert "model: qwen3:4b-instruct  (from auto: 8 GB memory)" in text
    assert "no Ollama server answering" in text and r.failed >= 1

    def server(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/version":
            return httpx.Response(200, json={"version": "0.40.1"})
        return httpx.Response(200, json={"models": [{"name": "qwen3:4b-instruct"}]})

    def client(url: str) -> httpx.Client:
        return httpx.Client(base_url=url, transport=httpx.MockTransport(server))

    r = run_doctor(environ=environ, run=run, ram_gb=8, live=False, client=client)
    text = r.text()
    assert "version mismatch: server 0.40.1" in text
    assert "brew uninstall ollama" in text and "models are not touched" in text


def test_doctor_flags_unprefixed_shell_variable(tmp_path: Path) -> None:
    from jarvis.owner.doctor import Report, check_config

    r = Report()
    check_config(
        r, {"OLLAMA_MODEL": "qwen3:14b", "JARVIS_ENV_FILE": str(tmp_path / "none")}, ram_gb=8
    )
    assert "OLLAMA_MODEL=qwen3:14b in your shell is ignored" in r.text()
    assert "using qwen3:4b-instruct" in r.text()

    env_file = tmp_path / ".env"
    env_file.write_text("OLLAMA_MODEL=qwen3:4b\n")
    quiet = Report()  # shell and .env agree (Siddharth's Mac): nothing to warn about
    check_config(quiet, {"OLLAMA_MODEL": "qwen3:4b", "JARVIS_ENV_FILE": str(env_file)}, ram_gb=8)
    assert "!" not in quiet.text()


def test_pasted_shell_comment_is_ignored() -> None:
    from jarvis.owner.cli import strip_comment

    pasted = ["--doctor", "#", "fix", "any", "✗", "it", "prints"]
    assert strip_comment(pasted) == ["--doctor"]
    assert strip_comment(["--voice", "--serve", "#start", "talking"]) == ["--voice", "--serve"]
    assert strip_comment(["--model", "qwen3:4b"]) == ["--model", "qwen3:4b"]


# --- reasoning never reaches Siddharth ---------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "shown"),
    [
        (
            "Okay, let's see. The user asks...\n</think>\n\nYes, Siddharth. I can hear you.",
            "Yes, Siddharth. I can hear you.",
        ),
        ("<think>plan</think>Done, sir.", "Done, sir."),
        ("Plain answer.", "Plain answer."),
        ("<think>still thinking when cut off", ""),
    ],
)
def test_visible_reply_drops_reasoning(raw: str, shown: str) -> None:
    from jarvis.llm.ollama_backend import visible_reply

    assert visible_reply(raw) == shown


def test_reasoning_is_stripped_from_agent_replies_and_history() -> None:
    leaked = "Wait, the user is simulating...\n</think>\n\nYes, I can hear you."

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"message": {"role": "assistant", "content": leaked}})

    s = llm()
    http = httpx.Client(base_url=s.ollama_url, transport=httpx.MockTransport(handler))
    session = OllamaAgentSession(s, "system", [], http=http)
    assert session.send_user("Can you hear me?").text == "Yes, I can hear you."
    assert "simulating" not in json.dumps(session._messages)


def test_instruct_models_are_not_sent_think() -> None:
    from jarvis.llm.ollama_backend import _options

    assert "think" not in _options(LLMSettings(ollama_model="qwen3:4b-instruct"))
    assert _options(LLMSettings(ollama_model="qwen3:8b"))["think"] is False


def test_probe_detects_a_thinking_model() -> None:
    from jarvis.llm.ollama_backend import probe

    def thinking(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"message": {"content": "hmm\n</think>\nYes."}})

    def direct(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"message": {"content": "Ready, sir."}})

    s = llm()
    for handler, thought, reply in ((thinking, True, "Yes."), (direct, False, "Ready, sir.")):
        http = httpx.Client(base_url=s.ollama_url, transport=httpx.MockTransport(handler))
        _, text, did_think = probe(s, http=http)
        assert (text, did_think) == (reply, thought)


def test_speech_is_short_and_free_of_markup() -> None:
    from jarvis.owner.voice import for_speech

    assert for_speech("**Yes**, sir. \\boxed{Done}") == "Yes, sir. Done"
    long = "This is a sentence that goes on. " * 40
    spoken = for_speech(long)
    assert len(spoken) <= 450 and spoken.endswith(".")


def test_context_note_is_not_a_bracketed_transcript(tmp_path: Path) -> None:
    sent: list[str] = []

    class Session:
        def send_user(self, text: str) -> AgentStep:
            sent.append(text)
            return AgentStep(text="Yes, sir.", tool_calls=[])

        def send_tool_results(self, results: Any) -> AgentStep:
            raise AssertionError

    agent = make_agent(tmp_path, lambda: Session())
    agent.said("Shall I open it?")
    agent.handle("Can you hear me?")
    assert (
        sent[0]
        == '(Your last words to Siddharth were: "Shall I open it?")\n\nSiddharth: Can you hear me?'
    )


# --- the wake word is never sent to the model as a question ------------------------------------


@pytest.mark.parametrize(
    ("heard", "expected"),
    [
        ("Hey Jarvis", ""),
        ("Hey, Jarvis.", ""),
        ("jarvis", ""),
        ("Hey Jarvis, what's next on my list?", "what's next on my list?"),
        ("OK Jarvis open LinkedIn", "open LinkedIn"),
        ("Tell Jarvis's story", "Tell Jarvis's story"),
    ],
)
def test_without_wake_word(heard: str, expected: str) -> None:
    from jarvis.owner.session import without_wake_word

    assert without_wake_word(heard) == expected


def test_empty_model_reply_is_not_reported_as_done(tmp_path: Path) -> None:
    class Session:
        def send_user(self, text: str) -> AgentStep:
            return AgentStep(text="", tool_calls=[])

        def send_tool_results(self, results: Any) -> AgentStep:
            raise AssertionError

    agent = make_agent(tmp_path, lambda: Session())
    assert agent.handle("hello") == "Sorry, I lost my thread. Say that again?"


# --- model capabilities --------------------------------------------------------------------


def show(caps: Any) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/show"
        body = {"capabilities": caps} if caps is not None else {"details": {}}
        return httpx.Response(200, json=body)

    return httpx.Client(base_url="http://127.0.0.1:11434", transport=httpx.MockTransport(handler))


def test_model_without_tools_is_refused() -> None:
    from jarvis.llm.ollama_backend import check_model

    with pytest.raises(LocalModelError) as info:
        check_model(llm(), http=show(["completion"]))
    assert info.value.kind == "no_tools" and "qwen3:4b-instruct" in str(info.value)


def test_capability_notes() -> None:
    from jarvis.llm.ollama_backend import check_model

    assert check_model(llm(), http=show(["completion", "tools"])) == "tools"
    assert "reasons before answering" in check_model(
        llm(), http=show(["completion", "tools", "thinking"])
    )
    assert "not reported" in check_model(llm(), http=show(None))


def test_missing_model_reported_by_show() -> None:
    from jarvis.llm.ollama_backend import check_model

    with pytest.raises(LocalModelError) as info:
        check_model(llm(), http=status(404, "model 'qwen3:4b' not found"))
    assert info.value.kind == "model_missing"


def test_malformed_tool_call_is_rejected_not_executed(tmp_path: Path) -> None:
    """A model emitting unparseable arguments gets an error back; nothing runs."""
    from jarvis.owner.agent import OwnerAgent
    from jarvis.owner.confirm import DenyAll
    from jarvis.owner.memory import AuditLog

    replies = iter(
        [
            {"role": "assistant", "content": "", "tool_calls": [
                {"function": {"name": "open_url", "arguments": "{not json"}}]},
            {"role": "assistant", "content": "Sorry, I couldn't do that."},
        ]
    )  # fmt: skip

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"message": next(replies)})

    from jarvis.config import DEFAULT_BRIEF
    from jarvis.knowledge import Brief
    from jarvis.owner.mac import MacActions
    from jarvis.owner.memory import Memory
    from jarvis.owner.tools import build_registry

    ran: list[list[str]] = []
    tools = build_registry(
        Brief.load(DEFAULT_BRIEF), MacActions(runner=lambda a: ran.append(a) or ""),  # type: ignore[func-returns-value]
        Memory(tmp_path / "m.sqlite3"), "Work",
    )  # fmt: skip
    s = llm()
    http = httpx.Client(base_url=s.ollama_url, transport=httpx.MockTransport(handler))
    agent = OwnerAgent(
        lambda: OllamaAgentSession(s, "sys", [t.spec for t in tools.values()], http=http),
        tools,
        DenyAll(),
        AuditLog(tmp_path / "a.jsonl"),
    )
    assert agent.handle("open something") == "Sorry, I couldn't do that."
    assert ran == []
    audit = (tmp_path / "a.jsonl").read_text()
    assert '"decision": "invalid"' in audit
