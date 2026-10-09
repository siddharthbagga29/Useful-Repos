from __future__ import annotations

from pathlib import Path

import pytest

from jarvis.config import ConfigError, load_owner, load_public
from jarvis.knowledge import Brief


def test_brief_loads_with_stable_version(brief: Brief) -> None:
    again = Brief.load(Path(__file__).resolve().parents[1] / "knowledge" / "brief.md")
    assert brief.version == again.version
    assert len(brief.version) == 12


def test_brief_states_the_facts_jarvis_must_get_right(brief: Brief) -> None:
    text = brief.text
    assert "has NOT sat the exam" in text  # CFA
    assert (
        "22 months in total: 14 in the US, 11 of them full-time, and 8 in India" in text
    )  # tenure
    assert "NOT the capstone's result" in text  # site demo model
    assert "within 10% of analyst consensus" in text


def test_brief_search_ranks_relevant_lines(brief: Brief) -> None:
    hits = brief.search("CFA exam")
    assert hits and "CFA" in hits[0]
    assert brief.search("") == []


def test_empty_brief_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "brief.md"
    path.write_text("   \n")
    with pytest.raises(ValueError):
        Brief.load(path)


def test_public_defaults_are_safe() -> None:
    settings = load_public({})
    assert settings.host == "127.0.0.1"
    assert settings.trust_proxy_headers is False
    assert settings.allowed_origins == ()
    assert settings.llm.backend == "anthropic"
    assert settings.llm.model == "claude-opus-5-5"


def test_owner_defaults_to_local_model() -> None:
    settings = load_owner({})
    assert settings.llm.backend == "ollama"
    assert settings.voice_confirm is True  # hands-free: important steps are confirmed by voice
    assert settings.autonomy == "standard" and settings.bridge_port == 8765


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("JARVIS_PORT", "not-a-number"),
        ("JARVIS_PORT", "70000"),
        ("JARVIS_EFFORT", "extreme"),
        ("JARVIS_LLM_BACKEND", "openai"),
        ("JARVIS_TRUST_PROXY_HEADERS", "maybe"),
    ],
)
def test_bad_environment_fails_loudly(key: str, value: str) -> None:
    with pytest.raises(ConfigError):
        load_public({key: value})


def test_origins_parse_from_csv() -> None:
    settings = load_public({"JARVIS_ALLOWED_ORIGINS": "https://a.example, https://b.example ,"})
    assert settings.allowed_origins == ("https://a.example", "https://b.example")


def test_wake_threshold_is_validated() -> None:
    from jarvis.config import ConfigError, load_owner

    assert load_owner({"JARVIS_WAKE_THRESHOLD": "0.7"}).wake_threshold == 0.7
    assert load_owner({}).wake_threshold == 0.5
    with pytest.raises(ConfigError):
        load_owner({"JARVIS_WAKE_THRESHOLD": "2"})
