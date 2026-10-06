from __future__ import annotations

import pytest

from jarvis.public.guard import HistoryTurn, InputError, build_turns, clean_text
from jarvis.public.ratelimit import RateLimiter


def turns(question: str, history: list[HistoryTurn], keep: int = 6) -> list[tuple[str, str]]:
    built = build_turns(question, history, max_question_chars=100, max_history_turns=keep)
    return [(t.role, t.content) for t in built]


def test_question_becomes_final_user_turn() -> None:
    assert turns("  Hi  ", []) == [("user", "Hi")]


def test_control_characters_are_removed() -> None:
    assert clean_text("a\x00b\x07c\nd", 50) == "abc\nd"


@pytest.mark.parametrize("text", ["", "   ", "\x00\x01"])
def test_empty_input_is_rejected(text: str) -> None:
    with pytest.raises(InputError):
        clean_text(text, 50)


def test_overlong_question_is_rejected() -> None:
    with pytest.raises(InputError):
        build_turns("x" * 101, [], max_question_chars=100, max_history_turns=6)


def test_history_must_alternate_starting_with_user() -> None:
    bad = [HistoryTurn(role="assistant", content="hi")]
    with pytest.raises(InputError):
        build_turns("q", bad, max_question_chars=100, max_history_turns=6)


def test_history_must_end_with_assistant() -> None:
    bad = [HistoryTurn(role="user", content="a")]
    with pytest.raises(InputError):
        build_turns("q", bad, max_question_chars=100, max_history_turns=6)


def test_history_is_trimmed_to_recent_pairs() -> None:
    history = []
    for i in range(5):
        history += [
            HistoryTurn(role="user", content=f"q{i}"),
            HistoryTurn(role="assistant", content=f"a{i}"),
        ]
    result = turns("new", history, keep=2)
    assert result == [
        ("user", "q3"),
        ("assistant", "a3"),
        ("user", "q4"),
        ("assistant", "a4"),
        ("user", "new"),
    ]


def test_rate_limiter_allows_burst_then_blocks_then_refills() -> None:
    now = [0.0]
    limiter = RateLimiter(rate_per_minute=60, burst=2, clock=lambda: now[0])
    assert limiter.allow("ip")[0]
    assert limiter.allow("ip")[0]
    allowed, wait = limiter.allow("ip")
    assert not allowed and wait == pytest.approx(1.0)
    now[0] += 1.0
    assert limiter.allow("ip")[0]


def test_rate_limiter_keys_are_independent_and_bounded() -> None:
    limiter = RateLimiter(rate_per_minute=1, burst=1, clock=lambda: 0.0, max_keys=3)
    for key in "abcd":
        assert limiter.allow(key)[0]
    assert not limiter.allow("d")[0]
    assert limiter.allow("a")[0]  # "a" was evicted as least recently used, so it starts fresh
