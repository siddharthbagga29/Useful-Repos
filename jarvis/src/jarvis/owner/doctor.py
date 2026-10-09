"""`jarvis-owner --doctor`: prove each stage works on this Mac, and say how to fix what doesn't.

Checks, in the order a request flows: configuration (which model, and where that choice came from),
every Ollama install on PATH and in /Applications, the running server's version and who owns its
port, whether the model is installed, a real request through Jarvis's own backend, the voice
dependencies, and the website link's port. Nothing here calls a paid service or prints a secret.
"""

from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from jarvis.config import RETIRED, ConfigError, OwnerSettings, load_owner, owner_env
from jarvis.core.router import mac_ram_gb, recommend_model
from jarvis.llm.ollama_backend import LocalModelError, check_model, probe, warm_up

APP_BINARY = Path("/Applications/Ollama.app/Contents/Resources/ollama")
Run = Callable[[list[str]], tuple[int, str]]
Client = Callable[[str], httpx.Client]


def _client(url: str) -> httpx.Client:
    return httpx.Client(base_url=url, timeout=5.0)


def _run(argv: list[str]) -> tuple[int, str]:
    try:
        p = subprocess.run(argv, capture_output=True, text=True, timeout=20)
        return p.returncode, (p.stdout + p.stderr).strip()
    except (OSError, subprocess.SubprocessError) as exc:
        return 127, str(exc)


@dataclass
class Report:
    lines: list[str] = field(default_factory=list)
    failed: int = 0

    def ok(self, text: str) -> None:
        self.lines.append(f"  ✓ {text}")

    def warn(self, text: str, fix: str = "") -> None:
        self.lines.append(f"  ! {text}")
        if fix:
            self.lines += [f"      {line}" for line in fix.splitlines()]

    def fail(self, text: str, fix: str = "") -> None:
        self.failed += 1
        self.lines.append(f"  ✗ {text}")
        if fix:
            self.lines += [f"      {line}" for line in fix.splitlines()]

    def head(self, text: str) -> None:
        self.lines.append(f"\n{text}")

    def text(self) -> str:
        verdict = (
            "All checks passed."
            if not self.failed
            else f"{self.failed} problem(s) found; fix them top to bottom."
        )
        return "\n".join([*self.lines, "", verdict])


def ollama_binaries(path_env: str, app_binary: Path = APP_BINARY) -> list[Path]:
    """Every distinct `ollama` executable: each PATH entry, plus the app's bundled one."""
    seen: dict[Path, Path] = {}
    candidates = [Path(d) / "ollama" for d in path_env.split(os.pathsep) if d]
    candidates.append(app_binary)
    for c in candidates:
        if c.is_file() and os.access(c, os.X_OK):
            seen.setdefault(c.resolve(), c)
    return list(seen.values())


VERSION = re.compile(r"(\d+\.\d+\.\d+)")


def parse_versions(output: str) -> tuple[str, str]:
    """`ollama -v` prints the server version, and a "client version is X" warning on mismatch.
    Returns (reported_version, client_version_if_warned)."""
    client = ""
    m = re.search(r"client version is\s+(\d+\.\d+\.\d+)", output)
    if m:
        client = m.group(1)
    main = re.search(r"version is\s+(\d+\.\d+\.\d+)", output)
    return (main.group(1) if main else ""), client


def _mismatch_fix(binaries: list[str]) -> str:
    brew = any("homebrew" in b or "/usr/local/" in b for b in binaries)
    steps = [
        "Two Ollama versions are mixed. Keep exactly one (your downloaded models are not touched):",
        "  1. Quit Ollama from the menu bar, then run:  pkill -f 'ollama serve'",
    ]
    if brew:
        steps.append("  2. Remove the Homebrew copy:  brew uninstall ollama")
    else:
        steps.append("  2. Remove any extra copy shown above, keeping /Applications/Ollama.app")
    steps += [
        "  3. Open the Ollama app again (it updates itself) and wait 5 seconds",
        "  4. Run:  ollama -v     (one version, no 'Warning: client version')",
        "  5. Run:  jarvis-owner --doctor",
    ]
    return "\n".join(steps)


def check_config(r: Report, environ: dict[str, str], ram_gb: float = 0) -> OwnerSettings | None:
    r.head("Configuration")
    layered = owner_env(environ)
    if layered.file:
        r.ok(f"read settings file {layered.file}")
    else:
        r.ok("no jarvis/.env file (defaults and environment only)")
    try:
        s = load_owner(layered.values, origin=layered.origin, ram_gb=ram_gb)
    except ConfigError as exc:
        r.fail(f"invalid setting: {exc}", "Fix that line in jarvis/.env and run --doctor again.")
        return None
    shell_model = environ.get("OLLAMA_MODEL", "")
    if shell_model and not environ.get("JARVIS_OLLAMA_MODEL") and shell_model != s.llm.ollama_model:
        # Only worth a word when it disagrees with what Jarvis will actually use.
        r.warn(
            f"OLLAMA_MODEL={shell_model} in your shell is ignored (Jarvis reads "
            f"JARVIS_OLLAMA_MODEL there); using {s.llm.ollama_model}",
            f"To use {shell_model}:  jarvis-owner --model {shell_model}   or put "
            f"OLLAMA_MODEL={shell_model} in jarvis/.env",
        )
    if s.llm.backend != "ollama":
        r.warn(
            "JARVIS_LLM_BACKEND=anthropic: answers use Claude, a paid API",
            "Remove that line to stay free and local.",
        )
    else:
        r.ok("backend: ollama (local, free); no cloud fallback")
    r.ok(f"model: {s.llm.ollama_model}  (from {s.llm.ollama_model_source})")
    return s


def check_ollama(
    r: Report, s: OwnerSettings, run: Run, path_env: str, ram_gb: float, client: Client = _client
) -> bool:
    r.head("Ollama")
    bins = ollama_binaries(path_env)
    if not bins:
        r.fail(
            "Ollama is not installed",
            "Install the app from https://ollama.com/download, open it once, then re-run.",
        )
        return False
    versions: dict[str, str] = {}
    client_warned = ""
    for b in bins:
        _, out = run([str(b), "-v"])
        v, client_v = parse_versions(out)
        versions[str(b)] = client_v or v or "unknown"
        client_warned = client_warned or client_v
    for path, v in versions.items():
        r.ok(f"found {path}  (version {v})")
    on_path = shutil.which("ollama", path=path_env)
    if on_path:
        r.ok(f"`ollama` in Terminal runs {on_path}")

    server = ""
    try:
        with client(s.llm.ollama_url) as h:
            server = str(h.get("/api/version").json().get("version", ""))
            tags = [m.get("name", "") for m in h.get("/api/tags").json().get("models", [])]
    except httpx.HTTPError:
        r.fail(
            f"no Ollama server answering at {s.llm.ollama_url}",
            "Open the Ollama app (menu-bar llama icon), wait 5 seconds, re-run.",
        )
        return False
    r.ok(f"server running, version {server}")
    _, owner = run(["lsof", "-nP", "-iTCP:11434", "-sTCP:LISTEN"])
    if owner.strip():
        proc = owner.splitlines()[-1].split()[0] if len(owner.splitlines()) > 1 else owner
        r.ok(f"port 11434 owned by: {proc}")

    distinct = {v for v in versions.values() if v != "unknown"} | ({server} if server else set())
    if client_warned or len(distinct) > 1:
        r.fail(
            f"version mismatch: server {server}, installs {sorted(set(versions.values()))}",
            _mismatch_fix(list(versions)),
        )
        return False
    r.ok("client and server versions match")

    model = s.llm.ollama_model
    if not any(t == model or t == f"{model}:latest" for t in tags):
        r.fail(
            f"model {model} is not downloaded (installed: {', '.join(tags) or 'none'})",
            f"Run:  ollama pull {model}",
        )
        return False
    r.ok(f"model {model} is downloaded")
    if ram_gb:
        rec = recommend_model(ram_gb)
        size = re.search(r":(\d+)b", model)
        rec_size = re.search(r":(\d+)b", rec)
        if size and rec_size and int(size.group(1)) > int(rec_size.group(1)):
            r.warn(
                f"{model} is large for {ram_gb:.0f} GB; replies will be slow and the Mac may swap",
                f"Recommended: {rec}.  Put OLLAMA_MODEL={rec} in jarvis/.env",
            )
    return True


def check_inference(r: Report, s: OwnerSettings) -> None:
    r.head("Local model (a real request through Jarvis's backend)")
    try:
        first = warm_up(s.llm)
        again = warm_up(s.llm)
    except LocalModelError as exc:
        fix = _mismatch_fix([]) if exc.kind == "runner_mismatch" else ""
        r.fail(f"{exc.kind}: {exc}", fix)
        return
    try:
        r.ok(f"capabilities: {check_model(s.llm)}")
    except LocalModelError as exc:
        r.fail(str(exc))
        return
    r.ok(f"model loaded and answered in {first:.1f}s (first load)")
    r.ok(f"second answer in {again:.1f}s (kept in memory for {s.llm.ollama_keep_alive})")
    try:
        seconds, reply, thought = probe(s.llm)
    except LocalModelError as exc:
        r.fail(f"{exc.kind}: {exc}")
        return
    if thought:
        r.warn(
            f"{s.llm.ollama_model} reasons to itself before every answer ({seconds:.1f}s for one "
            "sentence). Jarvis hides that text, but you still wait for it",
            "For fast conversation use the non-thinking build:\n"
            "  ollama pull qwen3:4b-instruct\n"
            "  then set OLLAMA_MODEL=qwen3:4b-instruct in jarvis/.env",
        )
    else:
        r.ok(f"a spoken-length answer took {seconds:.1f}s: {reply[:80]!r}")


def check_voice(r: Report, s: OwnerSettings, run: Run) -> None:
    r.head("Voice")
    missing = []
    for mod in ("pyaudio", "openwakeword", "faster_whisper", "numpy"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    if missing:
        r.fail(
            f"voice packages missing: {', '.join(missing)}",
            "brew install portaudio && pip install -e '.[voice]'",
        )
    else:
        r.ok("voice packages installed (wake word, speech-to-text, microphone)")
    if sys.platform == "darwin":
        code, _ = run(["say", "-v", "?"])
        if code == 0:
            r.ok("macOS speech available")
        else:
            r.fail("`say` not available")
    r.ok("to test the microphone, wake word and speech end to end:  jarvis-owner --voice-check")


def check_retired(r: Report, values: dict[str, str]) -> None:
    for key, why in RETIRED.items():
        if values.get(key):
            r.warn(f"{key} no longer does anything: {why}", f"Remove {key} from jarvis/.env")


def check_linkedin(r: Report, s: OwnerSettings) -> None:
    r.head("LinkedIn")
    r.ok(f"profile {s.linkedin_profile}; portfolio {s.portfolio_url}")
    if not s.linkedin_automation:
        r.ok(
            "assisted mode: Jarvis opens the editor and copies the link; you save it "
            "(LINKEDIN_AUTOMATION=on lets him do it, at your account's risk)"
        )
        return
    try:
        __import__("playwright.sync_api")
    except ImportError:
        r.fail(
            "LINKEDIN_AUTOMATION is on but Playwright isn't installed",
            "pip install -e '.[browser]' && playwright install chromium",
        )
        return
    signed_in = (s.state_dir / "browser").exists()
    r.ok("automated mode: Playwright installed")
    r.ok(
        "Jarvis's browser profile exists"
        if signed_in
        else "first use opens Jarvis's browser on LinkedIn's sign-in page; sign in there once"
    )


def check_bridge(r: Report, s: OwnerSettings, run: Run) -> None:
    r.head("Website link")
    _, out = run(["lsof", "-nP", f"-iTCP:{s.bridge_port}", "-sTCP:LISTEN"])
    if out.strip():
        r.warn(
            f"port {s.bridge_port} is already in use (another Jarvis still running?)",
            "Stop it with Ctrl-C in its window, or:  pkill -f jarvis-owner",
        )
    else:
        r.ok(f"port {s.bridge_port} free; --serve listens on 127.0.0.1 only")


def run_doctor(
    *,
    environ: dict[str, str] | None = None,
    run: Run = _run,
    ram_gb: float | None = None,
    live: bool = True,
    client: Client = _client,
) -> Report:
    environ = dict(os.environ) if environ is None else environ
    r = Report()
    ram = mac_ram_gb() if ram_gb is None else ram_gb
    r.head("This Mac")
    r.ok(
        f"{platform.machine()} · {platform.system()} {platform.release()} · Python "
        f"{platform.python_version()} · {sys.prefix}"
    )
    r.ok(
        f"memory: {ram:.0f} GB, best local model: {recommend_model(ram)}"
        if ram
        else "memory: unknown (not a Mac?)"
    )
    s = check_config(r, environ, ram)
    if s is None:
        return r
    path_env = environ.get("PATH", "")
    if check_ollama(r, s, run, path_env, ram, client) and live:
        check_inference(r, s)
    check_voice(r, s, run)
    check_retired(r, owner_env(environ).values)
    check_linkedin(r, s)
    check_bridge(r, s, run)
    return r
