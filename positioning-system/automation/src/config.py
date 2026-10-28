"""Configuration loading. Fails loudly rather than running on defaults."""
from __future__ import annotations
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _expand(p: str) -> Path:
    return Path(os.path.expanduser(p)).resolve()


def load(path: str | None = None) -> dict:
    cfg_path = Path(path) if path else ROOT / "config.json"
    if not cfg_path.exists():
        sys.exit(
            f"No config at {cfg_path}.\n"
            f"Copy config.example.json to config.json and fill in your values."
        )
    cfg = json.loads(cfg_path.read_text())

    sa = _expand(cfg["service_account_file"])
    if not sa.exists():
        sys.exit(
            f"Service account key not found at {sa}.\n"
            f"See automation/README.md step 2 — this is the Google credential, "
            f"and nothing can read or write the sheet without it."
        )
    cfg["service_account_file"] = str(sa)

    state = _expand(cfg.get("state_dir", "~/.positioning-os/state"))
    state.mkdir(parents=True, exist_ok=True)
    cfg["state_dir"] = str(state)
    return cfg
