"""Interfaces shared by every backend.

Two shapes, matching the two halves of the system:

* ``AnswerBackend`` streams a plain-text answer. It has no way to accept tools, so the
  public service cannot be given tools by mistake.
* ``AgentSession`` runs a tool-using conversation for the owner agent. Each backend keeps
  its own provider-native transcript and only ever appends to it.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol


@dataclass(frozen=True)
class Turn:
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True)
class Delta:
    """A chunk of answer text."""

    text: str


@dataclass(frozen=True)
class Reset:
    """Discard the text streamed so far; a fallback model is restarting the answer."""


@dataclass(frozen=True)
class Refused:
    """The model declined and no fallback produced an answer."""

    category: str | None = None


StreamEvent = Delta | Reset | Refused


class AnswerBackend(Protocol):
    name: str

    def stream_answer(self, system: str, turns: list[Turn]) -> Iterator[StreamEvent]: ...


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ToolResult:
    call_id: str
    name: str
    content: str
    is_error: bool = False


@dataclass(frozen=True)
class AgentStep:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    refused: bool = False
    truncated: bool = False


class AgentSession(Protocol):
    def send_user(self, text: str) -> AgentStep: ...

    def send_tool_results(self, results: list[ToolResult]) -> AgentStep: ...
