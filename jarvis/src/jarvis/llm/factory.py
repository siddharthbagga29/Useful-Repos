"""Choose a backend from settings. Imports are lazy, so neither provider needs the other."""

from __future__ import annotations

from jarvis.config import LLMSettings
from jarvis.llm.base import AgentSession, AnswerBackend, ToolSpec


def answer_backend(settings: LLMSettings) -> AnswerBackend:
    if settings.backend == "anthropic":
        from jarvis.llm.anthropic_backend import AnthropicAnswerBackend

        return AnthropicAnswerBackend(settings)
    from jarvis.llm.ollama_backend import OllamaAnswerBackend

    return OllamaAnswerBackend(settings)


def agent_session(settings: LLMSettings, system: str, tools: list[ToolSpec]) -> AgentSession:
    if settings.backend == "anthropic":
        from jarvis.llm.anthropic_backend import AnthropicAgentSession

        return AnthropicAgentSession(settings, system, tools)
    from jarvis.llm.ollama_backend import OllamaAgentSession

    return OllamaAgentSession(settings, system, tools)
