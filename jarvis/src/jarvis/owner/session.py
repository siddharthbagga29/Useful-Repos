"""The voice conversation as an explicit state machine.

  STANDBY --"Hey Jarvis"--> LISTENING --speech--> THINKING --reply--> SPEAKING --> LISTENING ...
     ^                         |  \\--unclear--> (ask again, stay LISTENING)
     |                         |  \\--"go to sleep" / idle timeout--> STANDBY
     |                         \\--mic error--> RECOVERING --reopened--> LISTENING (or ERROR)
     \\---- SPEAKING --"Hey Jarvis" (barge-in)--> INTERRUPTED --> LISTENING

One wake word opens a conversation; it stays open across turns until SESSION_IDLE_SECONDS of
silence or an exit phrase, so follow-ups ("where did you put it?") need no wake word. The agent
keeps the conversation history and the action ledger across turns.

Honest limits: listening and speaking are not simultaneous (macOS `say` has no echo cancellation),
so the microphone is muted while he talks; barge-in works by spotting "Hey Jarvis" over his own
voice, not arbitrary speech. Every transition is written to an event log (no transcripts).
"""

from __future__ import annotations

import re
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol

WAKE_PREFIX = re.compile(r"^\W*(?:(?:hey|hi|hello|okay|ok)\W+)?jarvis\b\W*", re.IGNORECASE)
EXIT = re.compile(
    r"^(?:thanks?(?: you)?\W*)?(?:go to sleep|sleep now|that'?s all|that will be all|goodbye|"
    r"good ?bye|bye|stop listening|you can go|i'?m done|we'?re done)\W*$",
    re.IGNORECASE,
)
MIN_CONFIDENCE = 0.3  # below this, ask again rather than act on a guess
MAX_MISSES = 2  # consecutive unclear turns before going back to standby
MAX_RECOVERIES = 3


class State(StrEnum):
    STANDBY = "standby"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"
    RECOVERING = "recovering"
    ERROR = "error"


@dataclass(frozen=True)
class Utterance:
    text: str
    confidence: float = 1.0  # 0..1, from the recogniser
    heard_speech: bool = True  # False: nothing but silence until the timeout


class Voice(Protocol):
    def listen_detailed(self, start_timeout: float, ignore_seconds: float = 0.0) -> Utterance: ...
    def say(self, text: str, voice_name: str, interruptible: bool = False) -> bool: ...
    def wait_for_wake_word(self, timeout: float | None = None) -> bool: ...
    def reopen(self) -> None: ...


class Agent(Protocol):
    def handle(self, text: str, turn_id: str = "") -> str: ...


class Events(Protocol):
    def record(self, **fields: Any) -> None: ...


def without_wake_word(heard: str) -> str:
    """'Hey Jarvis, what's next?' -> "what's next?"; a bare 'Hey Jarvis.' -> ''."""
    return WAKE_PREFIX.sub("", heard, count=1).strip()


def is_exit(request: str) -> bool:
    return len(request.split()) <= 6 and bool(EXIT.match(request.strip()))


class VoiceSession:
    def __init__(
        self,
        agent: Agent,
        voice: Voice,
        voice_name: str,
        events: Events,
        *,
        idle_seconds: float = 30.0,
        barge_in: bool = True,
        chime: Callable[[str], None] = lambda name: None,
        show: Callable[[str], None] = print,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._agent = agent
        self._voice = voice
        self._name = voice_name
        self._events = events
        self._idle = idle_seconds
        self._barge_in = barge_in
        self._chime = chime
        self._show = show
        self._clock = clock
        self._sleep = sleep
        self.state = State.STANDBY
        self.session = ""

    # --- transitions -----------------------------------------------------------------------

    def _to(self, state: State, **detail: Any) -> None:
        self._events.record(
            session=self.session, event="STATE", frm=self.state.value, to=state.value, **detail
        )
        self.state = state

    def _say(self, text: str) -> bool:
        """Speak; True if he was interrupted by the wake word."""
        self._to(State.SPEAKING)
        return self._voice.say(text, self._name, interruptible=self._barge_in)

    def _listen(self, wait: float, ignore: float = 0.0) -> Utterance | None:
        """None means the microphone failed and couldn't be recovered."""
        self._to(State.LISTENING)
        for attempt in range(MAX_RECOVERIES + 1):
            try:
                return self._voice.listen_detailed(wait, ignore_seconds=ignore)
            except Exception as exc:  # device unplugged, input overflow, ...
                if attempt == MAX_RECOVERIES:
                    break
                self._to(State.RECOVERING, error=type(exc).__name__, attempt=attempt + 1)
                self._show(f"(microphone problem: {exc}; reconnecting)")
                self._sleep(0.5 * 2**attempt)
                try:
                    self._voice.reopen()
                except Exception as again:  # recorded; the next attempt tries again
                    self._events.record(
                        session=self.session, event="REOPEN_FAILED", error=type(again).__name__
                    )
        self._to(State.ERROR, reason="microphone unavailable")
        return None

    # --- the conversation ------------------------------------------------------------------

    def start(self, opening: str = "") -> bool:
        """Open a conversation (after the wake word, or with an opening line). Returns False if
        the microphone is gone for good."""
        self.session = uuid.uuid4().hex[:6]
        self._events.record(session=self.session, event="SESSION_START")
        ignore = 0.0
        if opening:
            self._show(f"jarvis> {opening}")
            self._say(opening)
        else:
            self._chime("Tink")  # heard the wake word: talk now
            ignore = 0.35  # don't mistake the chime for the start of speech
        ok = self._converse(ignore)
        self._events.record(session=self.session, event="SESSION_END", reason=self._end_reason)
        self._to(State.STANDBY)
        self._show("(standby: say 'Hey Jarvis')")
        return ok

    def _converse(self, ignore: float) -> bool:
        misses = 0
        while True:
            heard = self._listen(self._idle, ignore)
            ignore = 0.0
            if heard is None:
                self._end_reason = "microphone"
                return False
            if not heard.heard_speech:
                self._end_reason = "idle"
                return True
            request = without_wake_word(heard.text)
            if heard.text and not request:  # just "Hey Jarvis" mid-conversation
                self._say("Yes?")
                continue
            if not request or heard.confidence < MIN_CONFIDENCE:
                misses += 1
                self._events.record(
                    session=self.session,
                    event="UNCLEAR",
                    confidence=round(heard.confidence, 2),
                    chars=len(heard.text),
                )
                if misses >= MAX_MISSES:
                    self._say("I'm not catching you clearly. Say 'Hey Jarvis' when you're ready.")
                    self._end_reason = "unclear"
                    return True
                if heard.text:
                    self._show(f"(unclear: {heard.text!r})")
                self._say("Sorry, I didn't catch that. Could you say it again?")
                continue
            misses = 0
            if is_exit(request):
                self._show(f"you> {request}")
                self._say("Very good. I'll be here.")
                self._end_reason = "exit phrase"
                return True
            if self._turn(request):  # he was cut off by "Hey Jarvis": listen for the new request
                self._chime("Tink")
                ignore = 0.35

    def _turn(self, request: str) -> bool:
        turn = uuid.uuid4().hex[:8]
        self._show(f"you> {request}")
        self._to(State.THINKING, turn=turn)
        self._chime("Pop")  # got it, working on it
        self._show("(thinking...)")
        started = self._clock()
        reply = self._agent.handle(request, turn_id=turn)
        thought = self._clock() - started
        self._show(f"jarvis> {reply}")
        self._show(f"({thought:.1f}s)")
        interrupted = self._say(reply)
        self._events.record(
            session=self.session,
            event="TURN",
            turn=turn,
            think_s=round(thought, 2),
            chars_in=len(request),
            chars_out=len(reply),
            interrupted=interrupted,
        )
        if interrupted:
            self._to(State.INTERRUPTED, turn=turn)
            self._show("(interrupted)")
        return interrupted

    _end_reason = "idle"

    def run(self, opening: str = "") -> int:
        """Standby until "Hey Jarvis", converse, repeat. Returns an exit code on mic failure."""
        if not self.start(opening):
            return 2
        while True:
            try:
                self._voice.wait_for_wake_word()
            except Exception as exc:
                self._to(State.RECOVERING, error=type(exc).__name__)
                self._show(f"(microphone problem: {exc}; reconnecting)")
                try:
                    self._voice.reopen()
                except Exception:
                    self._to(State.ERROR, reason="microphone unavailable")
                    self._show("The microphone is unavailable. Check it and restart Jarvis.")
                    return 2
                continue
            if not self.start():
                return 2
