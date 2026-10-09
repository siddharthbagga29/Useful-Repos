"""Local models via Ollama's REST API. Runs on the owner's Mac at zero marginal cost."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx

from jarvis.config import LLMSettings
from jarvis.llm.base import AgentStep, Delta, StreamEvent, ToolCall, ToolResult, ToolSpec, Turn


def _http(settings: LLMSettings) -> httpx.Client:
    return httpx.Client(base_url=settings.ollama_url, timeout=float(settings.timeout_seconds))


class OllamaAnswerBackend:
    name = "ollama"

    def __init__(self, settings: LLMSettings, http: httpx.Client | None = None) -> None:
        self._settings = settings
        self._http = http or _http(settings)

    def stream_answer(self, system: str, turns: list[Turn]) -> Iterator[StreamEvent]:
        payload = {
            "model": self._settings.ollama_model,
            "stream": True,
            "messages": [{"role": "system", "content": system}]
            + [{"role": t.role, "content": t.content} for t in turns],
        }
        with self._http.stream("POST", "/api/chat", json=payload) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                text = chunk.get("message", {}).get("content", "")
                if text:
                    yield Delta(text)
                if chunk.get("done"):
                    break


class OllamaAgentSession:
    """Needs a tool-capable model such as qwen3 or llama3.1; plain llama3 cannot call tools."""

    def __init__(
        self,
        settings: LLMSettings,
        system: str,
        tools: list[ToolSpec],
        http: httpx.Client | None = None,
    ) -> None:
        self._settings = settings
        self._http = http or _http(settings)
        self._tools = [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema,
                },
            }
            for t in tools
        ]
        self._messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
        self._counter = 0

    def send_user(self, text: str) -> AgentStep:
        self._messages.append({"role": "user", "content": text})
        return self._call()

    def send_tool_results(self, results: list[ToolResult]) -> AgentStep:
        for r in results:
            self._messages.append({"role": "tool", "tool_name": r.name, "content": r.content})
        return self._call()

    def _call(self) -> AgentStep:
        response = self._http.post(
            "/api/chat",
            json={
                "model": self._settings.ollama_model,
                "stream": False,
                "messages": self._messages,
                "tools": self._tools,
            },
        )
        response.raise_for_status()
        message = response.json().get("message", {})
        self._messages.append(message)
        calls: list[ToolCall] = []
        for raw in message.get("tool_calls") or []:
            function = raw.get("function", {})
            arguments = function.get("arguments", {})
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except json.JSONDecodeError:
                    arguments = {"__unparseable__": arguments}
            self._counter += 1
            calls.append(
                ToolCall(
                    id=f"ollama_{self._counter}",
                    name=str(function.get("name", "")),
                    arguments=arguments if isinstance(arguments, dict) else {},
                )
            )
        return AgentStep(text=str(message.get("content") or ""), tool_calls=calls)
