"""Typed settings loaded from environment variables (prefix ``JARVIS_``).

Settings are frozen dataclasses so a running process cannot mutate them, and every
value is validated at startup: a bad deploy fails loudly instead of misbehaving later.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BRIEF = PACKAGE_ROOT / "knowledge" / "brief.md"
REPO_ROOT = PACKAGE_ROOT.parent
DEFAULT_SITE_INDEX = REPO_ROOT / "portfolio" / "public" / "jarvis" / "site-index.json"

EFFORT_LEVELS = ("low", "medium", "high", "xhigh", "max")


class ConfigError(ValueError):
    """Raised when an environment variable holds an invalid value."""


def _get(env: Mapping[str, str], key: str, default: str) -> str:
    # An empty value means "unset", so a blank line copied from .env.example keeps the default.
    return env.get(f"JARVIS_{key}", "").strip() or default


def _int(env: Mapping[str, str], key: str, default: int, lo: int, hi: int) -> int:
    raw = _get(env, key, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise ConfigError(f"JARVIS_{key} must be an integer, got {raw!r}") from exc
    if not lo <= value <= hi:
        raise ConfigError(f"JARVIS_{key} must be between {lo} and {hi}, got {value}")
    return value


def _float(env: Mapping[str, str], key: str, default: float, lo: float, hi: float) -> float:
    raw = _get(env, key, str(default))
    try:
        value = float(raw)
    except ValueError as exc:
        raise ConfigError(f"JARVIS_{key} must be a number, got {raw!r}") from exc
    if not lo <= value <= hi:
        raise ConfigError(f"JARVIS_{key} must be between {lo} and {hi}, got {value}")
    return value


def _bool(env: Mapping[str, str], key: str, default: bool) -> bool:
    raw = _get(env, key, "true" if default else "false").lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise ConfigError(f"JARVIS_{key} must be a boolean, got {raw!r}")


def _choice(env: Mapping[str, str], key: str, default: str, options: tuple[str, ...]) -> str:
    value = _get(env, key, default).lower()
    if value not in options:
        raise ConfigError(f"JARVIS_{key} must be one of {options}, got {value!r}")
    return value


def _hours(env: Mapping[str, str], key: str) -> tuple[int, int] | None:
    raw = _get(env, key, "")
    if not raw:
        return None
    try:
        start, end = (int(x) for x in raw.split("-"))
    except ValueError as exc:
        raise ConfigError(f"JARVIS_{key} must look like 22-7, got {raw!r}") from exc
    if not (0 <= start <= 23 and 0 <= end <= 23):
        raise ConfigError(f"JARVIS_{key} hours must be 0-23")
    return start, end


def _csv(env: Mapping[str, str], key: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in _get(env, key, "").split(",") if part.strip())


@dataclass(frozen=True)
class LLMSettings:
    backend: str = "anthropic"  # "anthropic" | "ollama"
    model: str = "claude-opus-5-5"
    effort: str = "medium"
    max_tokens: int = 2048
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen3:8b"
    timeout_seconds: int = 60


@dataclass(frozen=True)
class PublicSettings:
    llm: LLMSettings = field(default_factory=LLMSettings)
    host: str = "127.0.0.1"
    port: int = 8080
    allowed_origins: tuple[str, ...] = ()
    trust_proxy_headers: bool = False
    rate_per_minute: int = 10
    rate_burst: int = 5
    max_question_chars: int = 600
    max_history_turns: int = 6
    contacts_db: Path = Path("var/contacts.sqlite3")
    ip_hash_salt: str = ""
    brief_path: Path = DEFAULT_BRIEF
    sheets_webhook: str = ""  # Positioning OS Apps Script /exec URL; contacts are forwarded there
    prompt_db: Path | None = None  # jarvis-bench database; its promoted prompt refinement is used


@dataclass(frozen=True)
class OwnerSettings:
    llm: LLMSettings = field(default_factory=LLMSettings)
    state_dir: Path = Path.home() / ".jarvis"
    max_agent_steps: int = 8
    default_calendar: str = "Calendar"
    voice_name: str = "auto"  # "auto" picks the best installed British voice (Jamie Premium first)
    voice_confirm: bool = (
        True  # in voice mode, important steps are confirmed by saying "yes" or "confirm"
    )
    whisper_model: str = "base.en"
    wake_engine: str = "openwakeword"  # "openwakeword" (free, no key) | "porcupine" (Picovoice key)
    wake_threshold: float = 0.5  # openWakeWord score that counts as "Hey Jarvis"
    picovoice_access_key: str = ""
    brief_path: Path = DEFAULT_BRIEF
    autonomy: str = (
        "standard"  # "standard": routine steps run on their own; "strict": everything asks
    )
    follow_up_seconds: float = (
        6.0  # after he replies, keep listening this long without the wake word
    )
    repo_dir: Path = REPO_ROOT
    site_index: Path = DEFAULT_SITE_INDEX
    bridge_port: int = 8765
    fast_model: str = ""  # optional smaller local model for quick classification
    research_backend: str = (
        "ollama"  # "anthropic" sends research summaries to Claude (opt-in, paid)
    )
    quiet_hours: tuple[int, int] | None = None  # e.g. (22, 7): no speech or banners
    bridge_origins: tuple[str, ...] = ("https://siddharthbagga29.github.io",)


def load_llm(env: Mapping[str, str], *, default_backend: str) -> LLMSettings:
    return LLMSettings(
        backend=_choice(env, "LLM_BACKEND", default_backend, ("anthropic", "ollama")),
        model=_get(env, "MODEL", "claude-opus-5-5"),
        effort=_choice(env, "EFFORT", "medium", EFFORT_LEVELS),
        max_tokens=_int(env, "MAX_TOKENS", 2048, 256, 64000),
        ollama_url=_get(env, "OLLAMA_URL", "http://127.0.0.1:11434"),
        ollama_model=_get(env, "OLLAMA_MODEL", "qwen3:8b"),
        timeout_seconds=_int(env, "LLM_TIMEOUT_SECONDS", 60, 5, 600),
    )


def load_public(env: Mapping[str, str] | None = None) -> PublicSettings:
    env = os.environ if env is None else env
    salt = _get(env, "IP_HASH_SALT", "")
    return PublicSettings(
        llm=load_llm(env, default_backend="anthropic"),
        host=_get(env, "HOST", "127.0.0.1"),
        port=_int(env, "PORT", 8080, 1, 65535),
        allowed_origins=_csv(env, "ALLOWED_ORIGINS"),
        trust_proxy_headers=_bool(env, "TRUST_PROXY_HEADERS", False),
        rate_per_minute=_int(env, "RATE_PER_MINUTE", 10, 1, 600),
        rate_burst=_int(env, "RATE_BURST", 5, 1, 100),
        max_question_chars=_int(env, "MAX_QUESTION_CHARS", 600, 50, 4000),
        max_history_turns=_int(env, "MAX_HISTORY_TURNS", 6, 0, 20),
        contacts_db=Path(_get(env, "CONTACTS_DB", "var/contacts.sqlite3")),
        ip_hash_salt=salt,
        brief_path=Path(_get(env, "BRIEF_PATH", str(DEFAULT_BRIEF))),
        sheets_webhook=_https(env, "SHEETS_WEBHOOK"),
        prompt_db=Path(_get(env, "PROMPT_DB", "")) if _get(env, "PROMPT_DB", "") else None,
    )


def _https(env: Mapping[str, str], key: str) -> str:
    value = _get(env, key, "")
    if value and not value.startswith("https://"):
        raise ConfigError(f"JARVIS_{key} must be an https:// URL")
    return value


def load_owner(env: Mapping[str, str] | None = None) -> OwnerSettings:
    env = os.environ if env is None else env
    return OwnerSettings(
        llm=load_llm(env, default_backend="ollama"),
        state_dir=Path(_get(env, "STATE_DIR", str(Path.home() / ".jarvis"))).expanduser(),
        max_agent_steps=_int(env, "MAX_AGENT_STEPS", 8, 1, 32),
        default_calendar=_get(env, "DEFAULT_CALENDAR", "Calendar"),
        voice_name=_get(env, "VOICE", "auto"),
        voice_confirm=_bool(env, "VOICE_CONFIRM", True),
        whisper_model=_get(env, "WHISPER_MODEL", "base.en"),
        wake_engine=_choice(env, "WAKE_ENGINE", "openwakeword", ("openwakeword", "porcupine")),
        wake_threshold=_float(env, "WAKE_THRESHOLD", 0.5, 0.05, 0.99),
        picovoice_access_key=_get(env, "PICOVOICE_ACCESS_KEY", ""),
        brief_path=Path(_get(env, "BRIEF_PATH", str(DEFAULT_BRIEF))),
        autonomy=_choice(env, "AUTONOMY", "standard", ("standard", "strict")),
        follow_up_seconds=_float(env, "FOLLOW_UP_SECONDS", 6.0, 0.0, 30.0),
        repo_dir=Path(_get(env, "REPO_DIR", str(REPO_ROOT))).expanduser(),
        site_index=Path(_get(env, "SITE_INDEX", str(DEFAULT_SITE_INDEX))).expanduser(),
        bridge_port=_int(env, "BRIDGE_PORT", 8765, 1024, 65535),
        fast_model=_get(env, "FAST_MODEL", ""),
        research_backend=_choice(env, "RESEARCH_BACKEND", "ollama", ("ollama", "anthropic")),
        quiet_hours=_hours(env, "QUIET_HOURS"),
        bridge_origins=_csv(env, "BRIDGE_ORIGINS") or ("https://siddharthbagga29.github.io",),
    )
