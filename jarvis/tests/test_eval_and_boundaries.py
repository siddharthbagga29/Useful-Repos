from __future__ import annotations

import ast
from pathlib import Path

import pytest

from jarvis.eval.runner import DEFAULT_CASES, Case, grade, load_cases, main, run
from jarvis.knowledge import Brief
from jarvis.llm.base import Delta
from jarvis.llm.fake import FakeAnswerBackend
from jarvis.public.prompts import CANARY
from jarvis.public.responder import PublicResponder

SRC = Path(__file__).resolve().parents[1] / "src" / "jarvis"


def test_bundled_cases_load_and_are_unique() -> None:
    cases = load_cases(DEFAULT_CASES)
    assert len(cases) >= 10
    assert {"cfa-status", "ai-identity", "prompt-extraction"} <= {c.id for c in cases}


def test_grading_is_whole_word_and_handles_curly_quotes() -> None:
    case = Case("c", "q", require_any=[["hasn't", "has not"]], forbid=["ai"])
    assert grade(case, "He hasn\u2019t sat it.").passed
    assert grade(case, "He said so, but he has not.").passed  # "said" must not match "ai"
    assert not grade(case, "Yes, an AI says he has not.").passed
    prefix = Case("p", "q", require_any=[["illustrat*"]])
    assert grade(prefix, "It is illustrative.").passed


def test_canary_leak_always_fails() -> None:
    assert not grade(Case("c", "q"), f"My rules start with [{CANARY}]").passed


def test_run_uses_the_real_public_prompt(brief: Brief) -> None:
    backend = FakeAnswerBackend(lambda _s, _t: [Delta("He has not sat the CFA exam.")])
    results = run(PublicResponder(brief, backend), [Case("cfa", "Is he a CFA?", [["has not sat"]])])
    assert results[0].passed
    assert CANARY in backend.calls[0][0]


def test_cli_dry_run_exit_code_reflects_pass_rate(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--backend", "fake", "--min-pass-rate", "0"]) == 0
    assert main(["--backend", "fake"]) == 1  # the echo backend cannot pass the real cases
    assert "passed" in capsys.readouterr().out


def _imports(package: str) -> set[str]:
    found: set[str] = set()
    for path in (SRC / package).rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                found.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                found.add(node.module)
    return found


def test_public_never_imports_owner() -> None:
    assert not any(name.startswith("jarvis.owner") for name in _imports("public"))


def test_owner_opens_no_network_listener() -> None:
    forbidden = (
        "fastapi",
        "uvicorn",
        "starlette",
        "socket",
        "socketserver",
        "http.server",
        "jarvis.public",
    )
    leaks = {name for name in _imports("owner") if name.startswith(forbidden)}
    assert leaks == set()


def test_answer_backends_cannot_accept_tools() -> None:
    import inspect

    from jarvis.llm.anthropic_backend import AnthropicAnswerBackend
    from jarvis.llm.ollama_backend import OllamaAnswerBackend

    for backend in (AnthropicAnswerBackend, OllamaAnswerBackend):
        params = inspect.signature(backend.stream_answer).parameters
        assert list(params) == ["self", "system", "turns"]
