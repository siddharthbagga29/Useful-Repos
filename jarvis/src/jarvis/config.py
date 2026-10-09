"""Typed settings loaded from environment variables (prefix ``JARVIS_``).

Settings are frozen dataclasses so a running process cannot mutate them, and every
value is validated at startup: a bad deploy fails loudly instead of misbehaving later.

Owner (Mac) precedence, highest first, one rule for every setting:
  1. command-line flags (``jarvis-owner --model qwen3:4b``)
  2. the process environment, ``JARVIS_`` prefix required (``JARVIS_OLLAMA_MODEL=...``)
  3. ``jarvis/.env`` (or the file named by ``JARVIS_ENV_FILE``); the ``JARVIS_`` prefix is
     optional there, and a prefixed line wins over an unprefixed one
  4. defaults; the local model defaults to the Qwen 3 size that fits this Mac's memory
The public service reads only the process environment (Docker's ``--env-file``).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BRIEF = PACKAGE_ROOT / "knowledge" / "brief.md"
REPO_ROOT = PACKAGE_ROOT.parent
DEFAULT_SITE_INDEX = REPO_ROOT / "portfolio" / "public" / "jarvis" / "site-index.json"
DEFAULT_ENV_FILE = PACKAGE_ROOT / ".env"
FALLBACK_OLLAMA_MODEL = "qwen3:8b"  # when the Mac's memory can't be read

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
    ollama_model: str = FALLBACK_OLLAMA_MODEL
    timeout_seconds: int = 60
    # Where ollama_model came from, shown in the startup banner and by --doctor.
    ollama_model_source: str = "default"
    ollama_num_ctx: int = 8192  # Ollama's own default (often 4096) truncates the tool list
    ollama_keep_alive: str = "30m"  # keep the model loaded between requests


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


def read_env_file(path: Path) -> dict[str, str]:
    """KEY=VALUE lines; comments, blanks and `export ` are allowed. Unprefixed keys also count as
    JARVIS_ keys in this file (it is Jarvis's own file), unless the prefixed key is also present."""
    raw: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.removeprefix("export ").partition("=")
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key:
            raw[key] = value
    out = dict(raw)
    for key, value in raw.items():
        if not key.startswith("JARVIS_"):
            out.setdefault(f"JARVIS_{key}", value)
    return out


@dataclass(frozen=True)
class OwnerEnv:
    values: dict[str, str]
    file: Path | None  # the .env file that was read, if any
    origin: dict[str, str]  # JARVIS_ key -> "environment" or the file path


def owner_env(environ: Mapping[str, str] | None = None) -> OwnerEnv:
    """The process environment layered over jarvis/.env (environment wins)."""
    environ = os.environ if environ is None else environ
    path = Path(environ.get("JARVIS_ENV_FILE", "") or DEFAULT_ENV_FILE).expanduser()
    file_values = read_env_file(path) if path.is_file() else {}
    origin = {k: str(path) for k in file_values if k.startswith("JARVIS_") and file_values[k]}
    origin |= {k: "environment" for k, v in environ.items() if k.startswith("JARVIS_") and v}
    return OwnerEnv({**file_values, **environ}, path if file_values else None, origin)


def default_local_model(ram_gb: float) -> str:
    from jarvis.core.router import recommend_model

    return recommend_model(ram_gb) if ram_gb > 0 else FALLBACK_OLLAMA_MODEL


def load_llm(
    env: Mapping[str, str], *, default_backend: str, default_timeout: int = 60
) -> LLMSettings:
    return LLMSettings(
        backend=_choice(env, "LLM_BACKEND", default_backend, ("anthropic", "ollama")),
        model=_get(env, "MODEL", "claude-opus-5-5"),
        effort=_choice(env, "EFFORT", "medium", EFFORT_LEVELS),
        max_tokens=_int(env, "MAX_TOKENS", 2048, 256, 64000),
        ollama_url=_get(env, "OLLAMA_URL", "http://127.0.0.1:11434"),
        ollama_model=_get(env, "OLLAMA_MODEL", "qwen3:8b"),
        timeout_seconds=_int(env, "LLM_TIMEOUT_SECONDS", default_timeout, 5, 600),
        ollama_num_ctx=_int(env, "OLLAMA_NUM_CTX", 8192, 2048, 131072),
        ollama_keep_alive=_get(env, "OLLAMA_KEEP_ALIVE", "30m"),
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


def load_owner(
    env: Mapping[str, str] | None = None,
    *,
    model: str | None = None,
    ram_gb: float | None = None,
    origin: Mapping[str, str] | None = None,
) -> OwnerSettings:
    """`env=None` reads the process environment over jarvis/.env (see the module docstring).
    `model` is the --model flag. `ram_gb` is for tests; by default the Mac is asked."""
    if env is None:
        layered = owner_env()
        env, origin = layered.values, layered.origin
    origin = origin or {}
    llm = load_llm(env, default_backend="ollama", default_timeout=120)
    configured = _get(env, "OLLAMA_MODEL", "auto")
    if model:
        llm = replace(llm, ollama_model=model, ollama_model_source="--model flag")
    elif configured != "auto":
        source = origin.get("JARVIS_OLLAMA_MODEL", "environment")
        llm = replace(llm, ollama_model=configured, ollama_model_source=source)
    else:
        if ram_gb is None:
            from jarvis.core.router import mac_ram_gb

            ram_gb = mac_ram_gb()
        chosen = default_local_model(ram_gb)
        why = f"auto: {ram_gb:.0f} GB memory" if ram_gb > 0 else "default"
        llm = replace(llm, ollama_model=chosen, ollama_model_source=why)
    return OwnerSettings(
        llm=llm,
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
