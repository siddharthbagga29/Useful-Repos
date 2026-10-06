"""Backends are tested against stand-ins for the SDK and Ollama, so no key or network is needed."""

from __future__ import annotations

import json
from types import SimpleNamespace as NS
from typing import Any

import httpx

from jarvis.config import LLMSettings
from jarvis.llm.anthropic_backend import (
    FALLBACK_BETA,
    AnthropicAgentSession,
    AnthropicAnswerBackend,
)
from jarvis.llm.base import Delta, Refused, Reset, ToolResult, ToolSpec, Turn
from jarvis.llm.ollama_backend import OllamaAgentSession, OllamaAnswerBackend


class FakeStream:
    def __init__(self, events: list[Any], final: Any) -> None:
        self._events, self._final = events, final

    def __enter__(self) -> FakeStream:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def __iter__(self) -> Any:
        return iter(self._events)

    def get_final_message(self) -> Any:
        return self._final


class FakeAnthropic:
    def __init__(self, stream: FakeStream | None = None, replies: list[Any] | None = None) -> None:
        self.stream_kwargs: dict[str, Any] = {}
        self.create_calls: list[dict[str, Any]] = []
        self._stream, self._replies = stream, list(replies or [])
        self.beta = NS(messages=NS(stream=self._do_stream, create=self._do_create))

    def _do_stream(self, **kwargs: Any) -> FakeStream:
        self.stream_kwargs = kwargs
        assert self._stream is not None
        return self._stream

    def _do_create(self, **kwargs: Any) -> Any:
        # Snapshot messages: the session mutates its list after the call returns.
        self.create_calls.append({**kwargs, "messages": list(kwargs["messages"])})
        return self._replies.pop(0)


def text_delta(text: str) -> Any:
    return NS(type="content_block_delta", delta=NS(type="text_delta", text=text))


def test_answer_stream_sends_fallbacks_effort_and_cached_system() -> None:
    fake = FakeAnthropic(
        stream=FakeStream([text_delta("Hi")], NS(stop_reason="end_turn", stop_details=None))
    )
    backend = AnthropicAnswerBackend(LLMSettings(), client=fake)  # type: ignore[arg-type]
    events = list(backend.stream_answer("SYSTEM", [Turn("user", "q")]))
    assert events == [Delta("Hi")]
    kw = fake.stream_kwargs
    assert kw["model"] == "claude-opus-5-5"
    assert kw["fallbacks"] == "default" and kw["betas"] == [FALLBACK_BETA]
    assert kw["output_config"] == {"effort": "medium"}
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "tools" not in kw  # the public path never sends tools


def test_fallback_block_resets_and_refusal_is_reported() -> None:
    events = [
        text_delta("declined partial"),
        NS(type="content_block_start", content_block=NS(type="fallback")),
        text_delta("rescued"),
    ]
    final = NS(stop_reason="refusal", stop_details=NS(category="cyber"))
    backend = AnthropicAnswerBackend(
        LLMSettings(), client=FakeAnthropic(stream=FakeStream(events, final))
    )  # type: ignore[arg-type]
    out = list(backend.stream_answer("S", [Turn("user", "q")]))
    assert out == [Delta("declined partial"), Reset(), Delta("rescued"), Reset(), Refused("cyber")]


def test_models_without_fallback_support_omit_it() -> None:
    fake = FakeAnthropic(stream=FakeStream([], NS(stop_reason="end_turn", stop_details=None)))
    backend = AnthropicAnswerBackend(LLMSettings(model="claude-haiku-4-5"), client=fake)  # type: ignore[arg-type]
    list(backend.stream_answer("S", [Turn("user", "q")]))
    assert "fallbacks" not in fake.stream_kwargs and "output_config" not in fake.stream_kwargs


def tool_spec() -> ToolSpec:
    return ToolSpec(
        "search_brief",
        "d",
        {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
    )


def test_agent_session_is_append_only_and_parses_tool_calls() -> None:
    tool_use = NS(type="tool_use", id="tu_1", name="search_brief", input={"query": "cfa"})
    thinking = NS(type="thinking", thinking="")
    first = NS(content=[thinking, tool_use], stop_reason="tool_use")
    second = NS(content=[NS(type="text", text="Not sat yet.")], stop_reason="end_turn")
    fake = FakeAnthropic(replies=[first, second])
    session = AnthropicAgentSession(LLMSettings(), "SYS", [tool_spec()], client=fake)  # type: ignore[arg-type]

    step = session.send_user("cfa?")
    assert step.tool_calls[0].name == "search_brief" and step.tool_calls[0].arguments == {
        "query": "cfa"
    }
    assert fake.create_calls[0]["tools"][0]["strict"] is True

    done = session.send_tool_results([ToolResult("tu_1", "search_brief", "line")])
    assert done.text == "Not sat yet."
    sent = fake.create_calls[1]["messages"]
    assert sent[0] == {"role": "user", "content": "cfa?"}
    assert (
        sent[1]["content"] is first.content
    )  # assistant content echoed unchanged, thinking included
    assert sent[2]["content"][0] == {
        "type": "tool_result",
        "tool_use_id": "tu_1",
        "content": "line",
        "is_error": False,
    }


def test_truncated_tool_call_is_not_executed() -> None:
    tool_use = NS(type="tool_use", id="tu_1", name="search_brief", input={})
    fake = FakeAnthropic(replies=[NS(content=[tool_use], stop_reason="max_tokens")])
    step = AnthropicAgentSession(LLMSettings(), "S", [tool_spec()], client=fake).send_user("x")  # type: ignore[arg-type]
    assert step.truncated and step.tool_calls == []


def test_ollama_stream_and_tool_calls() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if body["stream"]:
            lines = [
                {"message": {"content": "Hel"}},
                {"message": {"content": "lo"}},
                {"done": True},
            ]
            return httpx.Response(200, text="\n".join(json.dumps(x) for x in lines))
        assert body["tools"][0]["function"]["name"] == "search_brief"
        msg = {
            "role": "assistant",
            "content": "",
            "tool_calls": [{"function": {"name": "search_brief", "arguments": '{"query": "x"}'}}],
        }
        return httpx.Response(200, json={"message": msg})

    http = httpx.Client(base_url="http://ollama", transport=httpx.MockTransport(handler))
    answer = OllamaAnswerBackend(LLMSettings(backend="ollama"), http=http)
    assert list(answer.stream_answer("S", [Turn("user", "q")])) == [Delta("Hel"), Delta("lo")]

    session = OllamaAgentSession(LLMSettings(backend="ollama"), "S", [tool_spec()], http=http)
    step = session.send_user("q")
    assert step.tool_calls[0].arguments == {"query": "x"}  # string arguments are decoded
