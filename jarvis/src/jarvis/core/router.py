"""Model routing and the hardware check.

Routine work stays on a free local model; the owner can opt a stronger (possibly cloud) model into
heavier work. Sensitive/private tasks stay local unless he explicitly allows otherwise.

  kind        default
  classify    fast local model
  chat        local model
  tools       local model with tool calling (Qwen 3 by default)
  research    local model, or Claude if JARVIS_RESEARCH_BACKEND=anthropic
"""

from __future__ import annotations

import platform
import subprocess
from dataclasses import dataclass

KINDS = ("classify", "chat", "tools", "research")


@dataclass(frozen=True)
class Route:
    backend: str  # "ollama" | "anthropic"
    model: str


def recommend_model(ram_gb: float) -> str:
    """A tool-capable local model that fits this Mac comfortably alongside everything else."""
    if ram_gb < 12:
        return "qwen3:4b-instruct"  # never "thinks" first: fast enough for conversation
    if ram_gb < 24:
        return "qwen3:8b"
    if ram_gb < 48:
        return "qwen3:14b"
    return "qwen3:30b"


def mac_ram_gb() -> float:
    try:
        out = subprocess.run(
            ["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=5
        ).stdout
        return int(out.strip()) / 1024**3
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0.0


class Router:
    def __init__(
        self,
        tools_model: str,
        fast_model: str = "",
        research_backend: str = "ollama",
        cloud_model: str = "claude-opus-5-5",
        allow_cloud_for_private: bool = False,
    ) -> None:
        self._tools = tools_model
        self._fast = fast_model or tools_model
        self._research_backend = research_backend
        self._cloud = cloud_model
        self._allow_private = allow_cloud_for_private

    def route(self, kind: str, *, private: bool = False) -> Route:
        if kind not in KINDS:
            raise ValueError(f"kind must be one of {KINDS}")
        cloud_ok = not private or self._allow_private
        if kind == "research" and self._research_backend == "anthropic" and cloud_ok:
            return Route("anthropic", self._cloud)
        if kind == "classify":
            return Route("ollama", self._fast)
        return Route("ollama", self._tools)


def doctor(current_model: str) -> str:
    """A plain report: chip, memory, recommended local model, and whether Ollama is reachable."""
    ram = mac_ram_gb()
    lines = [f"Machine: {platform.machine()} · {platform.system()} {platform.release()}"]
    lines.append(f"Memory: {ram:.0f} GB" if ram else "Memory: unknown (not a Mac?)")
    rec = recommend_model(ram) if ram else "qwen3:8b"
    lines.append(f"Recommended local model: {rec} (current: {current_model})")
    try:
        tags = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=10)
        have = tags.stdout
        lines.append("Ollama: running" if tags.returncode == 0 else "Ollama: not running")
        if rec.split(":")[0] not in have:
            lines.append(f"Next: ollama pull {rec}  then set JARVIS_OLLAMA_MODEL={rec}")
    except (OSError, subprocess.SubprocessError):
        lines.append("Ollama: not installed (brew install ollama)")
    return "\n".join(lines)
