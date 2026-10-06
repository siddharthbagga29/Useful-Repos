"""Turns a validated conversation into an answer. Shared by the API and the eval runner,
so what gets evaluated is exactly what visitors get."""

from __future__ import annotations

from collections.abc import Iterator

from jarvis.knowledge import Brief
from jarvis.llm.base import AnswerBackend, Delta, Refused, Reset, StreamEvent, Turn
from jarvis.public.prompts import REFUSAL_MESSAGE, build_system_prompt


class PublicResponder:
    def __init__(self, brief: Brief, backend: AnswerBackend) -> None:
        self.brief = brief
        self.backend = backend
        self.system_prompt = build_system_prompt(brief)

    def stream(self, turns: list[Turn]) -> Iterator[StreamEvent]:
        return self.backend.stream_answer(self.system_prompt, turns)

    def answer(self, turns: list[Turn]) -> str:
        parts: list[str] = []
        for event in self.stream(turns):
            if isinstance(event, Delta):
                parts.append(event.text)
            elif isinstance(event, Reset):
                parts.clear()
            elif isinstance(event, Refused):
                return REFUSAL_MESSAGE
        return "".join(parts).strip()
