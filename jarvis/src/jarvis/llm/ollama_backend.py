"""Local models via Ollama's REST API. Runs on the owner's Mac at zero marginal cost.

Failures are translated into `LocalModelError` with a plain-English cause (Ollama not running,
model not pulled, CLI/server version mismatch, timeout), and nothing ever falls back to a paid
cloud model: the caller reports the problem instead.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx

from jarvis.config import LLMSettings
from jarvis.llm.base import AgentStep, Delta, StreamEvent, ToolCall, ToolResult, ToolSpec, Turn


class LocalModelError(RuntimeError):
    """The local model couldn't answer. `kind` is one of: not_running, model_missing,
    runner_mismatch, server_error, timeout, bad_response."""

    def __init__(self, kind: str, message: str) -> None:
        super().__init__(message)
        self.kind = kind


def _http(settings: LLMSettings) -> httpx.Client:
    # First use loads the model from disk, which takes a while on an 8 GB Mac: generous read
    # timeout, but a fast connect timeout so "Ollama isn't running" is reported in seconds.
    timeout = httpx.Timeout(float(settings.timeout_seconds), connect=5.0)
    return httpx.Client(base_url=settings.ollama_url, timeout=timeout)


def _options(settings: LLMSettings) -> dict[str, Any]:
    body: dict[str, Any] = {
        "model": settings.ollama_model,
        "keep_alive": settings.ollama_keep_alive,
        "options": {"num_ctx": settings.ollama_num_ctx},
    }
    if settings.ollama_model.startswith("qwen3"):
        # Qwen 3 "thinks" out loud before answering by default: many seconds of hidden text per
        # reply. Spoken conversation wants the answer, so thinking is off for this family.
        body["think"] = False
    return body


def explain(exc: Exception, settings: LLMSettings) -> LocalModelError:
    """Turn a transport/HTTP failure into a cause Siddharth can act on."""
    model = settings.ollama_model
    if isinstance(exc, LocalModelError):
        return exc
    if isinstance(exc, httpx.ConnectError):
        return LocalModelError(
            "not_running",
            f"Ollama isn't running at {settings.ollama_url}. Open the Ollama app, then try again.",
        )
    if isinstance(exc, httpx.TimeoutException):
        return LocalModelError(
            "timeout",
            f"{model} took longer than {settings.timeout_seconds}s. The first answer after a "
            "restart loads the model; if it keeps happening, use a smaller model "
            "(jarvis-owner --doctor recommends one).",
        )
    if isinstance(exc, httpx.HTTPStatusError):
        try:
            detail = str(exc.response.json().get("error", ""))
        except (ValueError, AttributeError):
            detail = exc.response.text[:300]
        if exc.response.status_code == 404 or "not found" in detail.lower():
            return LocalModelError(
                "model_missing", f"The model {model} isn't installed. Run: ollama pull {model}"
            )
        if "invalid argument" in detail or "unknown flag" in detail or "--no-map" in detail:
            return LocalModelError(
                "runner_mismatch",
                "Ollama's server started a model runner from a different Ollama version "
                f"({detail.strip()}). Two Ollama installs are mixed; run jarvis-owner --doctor "
                "for the exact fix.",
            )
        return LocalModelError(
            "server_error", f"Ollama returned {exc.response.status_code}: {detail.strip()}"
        )
    if isinstance(exc, (httpx.HTTPError, ValueError)):
        return LocalModelError("bad_response", f"Ollama request failed: {exc}")
    return LocalModelError("bad_response", f"{type(exc).__name__}: {exc}")


class OllamaAnswerBackend:
    name = "ollama"

    def __init__(self, settings: LLMSettings, http: httpx.Client | None = None) -> None:
        self._settings = settings
        self._http = http or _http(settings)

    def stream_answer(self, system: str, turns: list[Turn]) -> Iterator[StreamEvent]:
        payload = {
            **_options(self._settings),
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
        try:
            response = self._http.post(
                "/api/chat",
                json={
                    **_options(self._settings),
                    "stream": False,
                    "messages": self._messages,
                    "tools": self._tools,
                },
            )
            response.raise_for_status()
            message = response.json().get("message", {})
        except Exception as exc:
            raise explain(exc, self._settings) from exc
        message.pop("thinking", None)  # never sent back: it only bloats the context
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


def warm_up(settings: LLMSettings, http: httpx.Client | None = None) -> float:
    """Load the model into memory with a one-token request; returns seconds taken.
    Raises LocalModelError with the cause if it can't."""
    import time

    client = http or _http(settings)
    start = time.monotonic()
    body = {**_options(settings), "stream": False, "messages": [{"role": "user", "content": "hi"}]}
    body["options"] = {**body["options"], "num_predict": 1}
    try:
        r = client.post("/api/chat", json=body)
        r.raise_for_status()
        r.json()
    except Exception as exc:
        raise explain(exc, settings) from exc
    return time.monotonic() - start
