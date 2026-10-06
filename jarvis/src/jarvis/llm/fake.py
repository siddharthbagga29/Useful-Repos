"""Deterministic backends for tests and for `jarvis-eval --backend fake` dry runs."""

from __future__ import annotations

from collections.abc import Callable, Iterator

from jarvis.llm.base import AgentStep, Delta, StreamEvent, ToolResult, Turn


class FakeAnswerBackend:
    name = "fake"

    def __init__(
        self, respond: Callable[[str, list[Turn]], list[StreamEvent]] | None = None
    ) -> None:
        self._respond = respond or (lambda _system, turns: [Delta(f"echo: {turns[-1].content}")])
        self.calls: list[tuple[str, list[Turn]]] = []

    def stream_answer(self, system: str, turns: list[Turn]) -> Iterator[StreamEvent]:
        self.calls.append((system, list(turns)))
        yield from self._respond(system, turns)


class ScriptedAgentSession:
    """Replays a fixed list of steps and records what the agent sent back."""

    def __init__(self, steps: list[AgentStep]) -> None:
        self._steps = list(steps)
        self.user_messages: list[str] = []
        self.tool_results: list[list[ToolResult]] = []

    def send_user(self, text: str) -> AgentStep:
        self.user_messages.append(text)
        return self._next()

    def send_tool_results(self, results: list[ToolResult]) -> AgentStep:
        self.tool_results.append(list(results))
        return self._next()

    def _next(self) -> AgentStep:
        if not self._steps:
            return AgentStep(text="(script exhausted)")
        return self._steps.pop(0)
