"""Claude via the official Anthropic SDK."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import anthropic

from jarvis.config import LLMSettings
from jarvis.llm.base import (
    AgentStep,
    Delta,
    Refused,
    Reset,
    StreamEvent,
    ToolCall,
    ToolResult,
    ToolSpec,
    Turn,
)

# Server-side fallback: when a safety classifier declines, the API re-runs the request on
# Anthropic's recommended model for that refusal category, inside the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"
FALLBACK_MODELS = frozenset(
    {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
)


def _client(settings: LLMSettings) -> anthropic.Anthropic:
    # Credentials resolve from the environment (ANTHROPIC_API_KEY or an `ant auth login` profile).
    return anthropic.Anthropic(timeout=float(settings.timeout_seconds), max_retries=2)


def _request_options(settings: LLMSettings) -> dict[str, Any]:
    options: dict[str, Any] = {}
    if not settings.model.startswith("claude-haiku"):
        options["output_config"] = {"effort": settings.effort}
    if settings.model in FALLBACK_MODELS:
        options["betas"] = [FALLBACK_BETA]
        options["fallbacks"] = "default"
    return options


def _system(text: str) -> list[dict[str, Any]]:
    # The system prompt is byte-identical across requests, so it is the cacheable prefix.
    return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]


class AnthropicAnswerBackend:
    name = "anthropic"

    def __init__(self, settings: LLMSettings, client: anthropic.Anthropic | None = None) -> None:
        self._settings = settings
        self._client = client or _client(settings)

    def stream_answer(self, system: str, turns: list[Turn]) -> Iterator[StreamEvent]:
        with self._client.beta.messages.stream(
            model=self._settings.model,
            max_tokens=self._settings.max_tokens,
            system=_system(system),  # type: ignore[arg-type]
            messages=[{"role": t.role, "content": t.content} for t in turns],
            **_request_options(self._settings),
        ) as stream:
            for event in stream:
                if event.type == "content_block_start" and event.content_block.type == "fallback":
                    # A model declined mid-answer and another is taking over: drop its partial text.
                    yield Reset()
                elif event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield Delta(event.delta.text)
            final = stream.get_final_message()
        if final.stop_reason == "refusal":
            details = final.stop_details
            yield Reset()
            yield Refused(category=details.category if details else None)


class AnthropicAgentSession:
    """Tool-using conversation. The transcript is append-only (required for preserved thinking)."""

    def __init__(
        self,
        settings: LLMSettings,
        system: str,
        tools: list[ToolSpec],
        client: anthropic.Anthropic | None = None,
    ) -> None:
        self._settings = settings
        self._client = client or _client(settings)
        self._system = _system(system)
        self._tools = [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
                "strict": True,
            }
            for t in tools
        ]
        self._messages: list[dict[str, Any]] = []

    def send_user(self, text: str) -> AgentStep:
        self._messages.append({"role": "user", "content": text})
        return self._call()

    def send_tool_results(self, results: list[ToolResult]) -> AgentStep:
        # All results for one assistant turn go back in a single user message.
        self._messages.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": r.call_id,
                        "content": r.content,
                        "is_error": r.is_error,
                    }
                    for r in results
                ],
            }
        )
        return self._call()

    def _call(self) -> AgentStep:
        response = self._client.beta.messages.create(
            model=self._settings.model,
            max_tokens=self._settings.max_tokens,
            system=self._system,  # type: ignore[arg-type]
            tools=self._tools,  # type: ignore[arg-type]
            messages=self._messages,  # type: ignore[arg-type]
            **_request_options(self._settings),
        )
        if response.content:
            # Append the full content (thinking and tool_use blocks included), never a rewrite.
            self._messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason == "refusal":
            return AgentStep(text="", refused=True)
        text = "".join(block.text for block in response.content if block.type == "text")
        if response.stop_reason == "max_tokens":
            # A truncated tool input can parse as a valid partial object: never run it.
            return AgentStep(text=text, truncated=True)
        calls = [
            ToolCall(id=block.id, name=block.name, arguments=dict(block.input))
            for block in response.content
            if block.type == "tool_use"
        ]
        return AgentStep(text=text, tool_calls=calls)
