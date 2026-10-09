"""The voice conversation state machine, with a scripted microphone (no audio hardware here).

These prove the control flow: one wake word, many turns, no wake word between them, honest
handling of unclear speech, exits, idle timeouts, barge-in and microphone recovery. Whether the
real microphone and Whisper hear Siddharth well is a separate, on-device test (--voice-check).
"""

from __future__ import annotations

from typing import Any

import pytest

from jarvis.owner.session import State, Utterance, VoiceSession, is_exit, without_wake_word


class Events:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def record(self, **fields: Any) -> None:
        self.rows.append(fields)

    def of(self, event: str) -> list[dict[str, Any]]:
        return [r for r in self.rows if r.get("event") == event]


class ScriptedVoice:
    """Plays back utterances; anything else (an Exception) is raised from listen."""

    def __init__(self, script: list[Any], wakes: int = 0, interrupt_on: str = "") -> None:
        self.script = list(script)
        self.wakes = wakes
        self.interrupt_on = interrupt_on
        self.said: list[str] = []
        self.reopened = 0
        self.ignored: list[float] = []

    def listen_detailed(self, start_timeout: float, ignore_seconds: float = 0.0) -> Utterance:
        self.ignored.append(ignore_seconds)
        if not self.script:
            return Utterance("", 0.0, heard_speech=False)  # silence until the timeout
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item if isinstance(item, Utterance) else Utterance(item, 0.9)

    def say(self, text: str, voice_name: str, interruptible: bool = False) -> bool:
        self.said.append(text)
        return bool(self.interrupt_on) and self.interrupt_on in text

    def wait_for_wake_word(self, timeout: float | None = None) -> bool:
        if self.wakes <= 0:
            raise KeyboardInterrupt  # end of the test script
        self.wakes -= 1
        return True

    def reopen(self) -> None:
        self.reopened += 1


class Agent:
    """Remembers the conversation like the real agent does (one session across turns)."""

    def __init__(self) -> None:
        self.heard: list[str] = []
        self.turn_ids: list[str] = []

    def handle(self, text: str, turn_id: str = "") -> str:
        self.heard.append(text)
        self.turn_ids.append(turn_id)
        if "where did you put it" in text.lower():
            last = next((h for h in reversed(self.heard[:-1]) if "linkedin" in h.lower()), "")
            return f"In your LinkedIn contact info, from when you asked: {last}"
        return f"Answer {len(self.heard)}."


def make(voice: ScriptedVoice, **kw: Any) -> tuple[VoiceSession, Agent, Events, list[str]]:
    agent, events, chimes = Agent(), Events(), []
    s = VoiceSession(
        agent, voice, "Daniel", events, chime=chimes.append, show=lambda line: None,
        sleep=lambda s: None, **kw,
    )  # fmt: skip
    return s, agent, events, chimes


def test_one_wake_word_then_five_turns_without_it() -> None:
    voice = ScriptedVoice(
        [
            "Hey Jarvis, add my portfolio to LinkedIn",  # wake word and request in one breath
            "Where did you put it?",  # follow-up with a pronoun, no wake word
            "What's next on my list?",
            "Find three papers on agentic memory",
            "Read me the first title",
        ]
    )
    s, agent, events, chimes = make(voice)
    assert s.start() is True
    assert agent.heard[0] == "add my portfolio to LinkedIn"
    assert len(agent.heard) == 5 and not any("jarvis" in h.lower() for h in agent.heard)
    assert "add my portfolio to LinkedIn" in voice.said[1]  # the pronoun resolved from context
    assert len({t for t in agent.turn_ids}) == 5  # one correlation ID per turn
    assert len(events.of("SESSION_START")) == 1 and events.of("SESSION_END")[0]["reason"] == "idle"
    assert s.state is State.STANDBY
    assert chimes[0] == "Tink" and chimes.count("Pop") == 5
    assert voice.ignored[0] == 0.35  # the wake chime isn't mistaken for speech


def test_opening_line_starts_a_conversation_without_a_wake_word() -> None:
    voice = ScriptedVoice(["yes"])
    s, agent, _, chimes = make(voice)
    s.start(opening="Shall I open LinkedIn?")
    assert voice.said[0] == "Shall I open LinkedIn?" and agent.heard == ["yes"]
    assert "Tink" not in chimes  # no wake chime when he spoke first


@pytest.mark.parametrize("phrase", ["Jarvis, go to sleep", "That's all", "thanks, goodbye"])
def test_exit_phrase_ends_the_conversation(phrase: str) -> None:
    voice = ScriptedVoice(["What's next?", phrase, "this must not be handled"])
    s, agent, events, _ = make(voice)
    s.start()
    assert agent.heard == ["What's next?"]
    assert voice.said[-1] == "Very good. I'll be here."
    assert events.of("SESSION_END")[0]["reason"] == "exit phrase"


def test_exit_phrases_are_not_triggered_by_ordinary_requests() -> None:
    assert is_exit("go to sleep") and is_exit("Thanks, that's all")
    assert not is_exit("remind me to go to sleep early tonight")
    assert not is_exit("that's all the papers you found?")


def test_unclear_speech_is_never_acted_on() -> None:
    voice = ScriptedVoice(
        [
            Utterance("delete everything", confidence=0.1),  # low confidence: never executed
            Utterance("", confidence=0.0),  # speech heard but nothing transcribed
        ]
    )
    s, agent, events, _ = make(voice)
    s.start()
    assert agent.heard == []
    assert voice.said[0] == "Sorry, I didn't catch that. Could you say it again?"
    assert "not catching you clearly" in voice.said[-1]
    assert events.of("SESSION_END")[0]["reason"] == "unclear"
    assert "delete everything" not in str(events.rows)  # no transcripts in the event log


def test_unclear_then_clear_continues_the_conversation() -> None:
    voice = ScriptedVoice([Utterance("mumble", confidence=0.1), "What's next?"])
    s, agent, _, _ = make(voice)
    s.start()
    assert agent.heard == ["What's next?"]


def test_bare_wake_word_mid_conversation_gets_yes() -> None:
    voice = ScriptedVoice(["Hey Jarvis.", "What's next?"])
    s, agent, _, _ = make(voice)
    s.start()
    assert voice.said[0] == "Yes?" and agent.heard == ["What's next?"]


def test_barge_in_stops_him_and_listens_for_the_new_request() -> None:
    voice = ScriptedVoice(["Tell me everything", "Actually, just the summary"], interrupt_on="1")
    s, agent, events, chimes = make(voice)
    s.start()
    assert agent.heard == ["Tell me everything", "Actually, just the summary"]
    turns = events.of("TURN")
    assert turns[0]["interrupted"] is True
    assert any(r.get("to") == "interrupted" for r in events.of("STATE"))
    assert voice.ignored[1] == 0.35 and chimes.count("Tink") == 2  # chime, then listen


def test_microphone_error_recovers_without_ending_the_conversation() -> None:
    voice = ScriptedVoice([OSError("Input overflowed"), "What's next?"])
    s, agent, events, _ = make(voice)
    assert s.start() is True
    assert voice.reopened == 1 and agent.heard == ["What's next?"]
    assert any(r.get("to") == "recovering" for r in events.of("STATE"))


def test_microphone_gone_for_good_is_an_error_not_a_hang() -> None:
    voice = ScriptedVoice([OSError("no device")] * 10)
    s, _, events, _ = make(voice)
    assert s.start() is False
    assert voice.reopened == 3
    assert any(r.get("to") == "error" for r in events.of("STATE"))


def test_run_returns_to_standby_and_wakes_again() -> None:
    voice = ScriptedVoice(["first question"], wakes=1)
    s, agent, events, _ = make(voice)
    voice.script += []  # first session ends on silence
    with pytest.raises(KeyboardInterrupt):  # the scripted mic ends after one more wake
        s.run(opening="Good evening.")
    assert agent.heard == ["first question"]
    assert len(events.of("SESSION_START")) == 2  # opening session + one after the wake word


def test_wake_word_stripping() -> None:
    assert without_wake_word("Hey Jarvis, what's next?") == "what's next?"
    assert without_wake_word("Hey, Jarvis.") == ""
    assert without_wake_word("Tell Jarvis's story") == "Tell Jarvis's story"


# --- audit 2026-10-09: background speech used the microphone stream from another thread ---------


def test_background_announcements_are_spoken_on_the_conversation_thread() -> None:
    import threading

    threads: list[int] = []

    class Recording(ScriptedVoice):
        def say(self, text: str, voice_name: str, interruptible: bool = False) -> bool:
            threads.append(threading.get_ident())
            return super().say(text, voice_name, interruptible)

        def listen_detailed(self, start_timeout: float, ignore_seconds: float = 0.0) -> Utterance:
            if len(self.script) == 1:  # while he listens, a research task finishes elsewhere
                worker = threading.Thread(target=s.announcements.put, args=("Research is done.",))
                worker.start()
                worker.join()
            return super().listen_detailed(start_timeout, ignore_seconds)

    voice = Recording(["first", "second"])
    s, _, events, _ = make(voice)
    s.start()
    assert "Research is done." in voice.said
    assert voice.said.index("Research is done.") > voice.said.index("Answer 1.")
    assert set(threads) == {threading.get_ident()}  # only the conversation loop spoke
    assert len(events.of("ANNOUNCEMENT")) == 1


def test_announcements_in_standby_are_spoken_without_a_wake_word() -> None:
    class Standby(ScriptedVoice):
        polls = 0

        def wait_for_wake_word(self, timeout: float | None = None) -> bool:
            self.polls += 1
            if self.polls == 1:
                s.announcements.put("Your research on agentic memory is done.")
                return False  # nobody said "Hey Jarvis" in that second
            raise KeyboardInterrupt

    voice = Standby([])
    s, _, _, _ = make(voice)
    with pytest.raises(KeyboardInterrupt):
        s.run()
    assert voice.said == ["Your research on agentic memory is done."]
