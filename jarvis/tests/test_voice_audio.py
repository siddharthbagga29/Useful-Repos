"""VoiceIO's recording and speaking logic with a synthetic microphone (no audio hardware)."""

from __future__ import annotations

from typing import Any

import pytest

np = pytest.importorskip("numpy")


def fake_voiceio(levels: list[int]) -> Any:
    """A VoiceIO whose microphone yields 80 ms frames at the given loudness (RMS)."""
    from jarvis.owner.voice import VoiceIO

    v = VoiceIO.__new__(VoiceIO)
    v._np = np  # type: ignore[attr-defined]
    v.SAMPLE_RATE, v.FRAME, v.SILENCE_RMS = 16000, 1280, 300  # type: ignore[attr-defined]
    feed = iter(levels)
    v._frame = lambda: np.full(1280, next(feed, 0), dtype=np.int16)  # type: ignore[method-assign]
    return v


def test_long_wait_keeps_only_a_short_lead_in() -> None:
    # 20 s of silence, 1 s of speech, then silence: only ~0.3 s of lead-in is kept
    v = fake_voiceio([0] * 250 + [1000] * 12 + [0] * 30)
    audio = v.record_utterance(start_timeout=30.0)
    seconds = len(audio) / 16000
    assert 1.0 < seconds < 3.0  # speech + lead-in + trailing pause, not the 20 s wait


def test_nothing_said_returns_none_at_the_timeout() -> None:
    v = fake_voiceio([0] * 200)
    assert v.record_utterance(start_timeout=2.0) is None


def test_chime_at_start_is_ignored() -> None:
    # a loud 0.24 s chime, then silence: with ignore_seconds it is not taken for speech
    v = fake_voiceio([3000] * 3 + [0] * 100)
    assert v.record_utterance(start_timeout=2.0, ignore_seconds=0.35) is None


def test_barge_in_stops_speech_on_the_wake_word(monkeypatch: pytest.MonkeyPatch) -> None:
    import jarvis.owner.voice as voice_mod

    v = fake_voiceio([0] * 50)
    heard = iter([False, False, True])
    events: list[str] = []

    class Wake:
        def heard(self, frame: Any) -> bool:
            return next(heard, False)

        def reset(self) -> None:
            events.append("wake reset")

    class Stream:
        active = True

        def is_active(self) -> bool:
            return self.active

        def stop_stream(self) -> None:
            self.active = False
            events.append("mic off")

        def start_stream(self) -> None:
            self.active = True

    class Proc:
        running = True

        def poll(self) -> int | None:
            return None if self.running else 0

        def terminate(self) -> None:
            self.running = False
            events.append("speech stopped")

        def wait(self, timeout: float) -> int:
            return 0

    v._wake, v._stream = Wake(), Stream()
    monkeypatch.setattr(voice_mod.sys, "platform", "darwin")
    monkeypatch.setattr(voice_mod.subprocess, "Popen", lambda argv: Proc())
    assert v.say("A long answer.", "Daniel", interruptible=True) is True
    assert "speech stopped" in events and events[-2:] == ["mic off", "wake reset"]
