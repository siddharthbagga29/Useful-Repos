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

    fixes = {
        "ingest_url": "Deploy apps-script/Ingest.gs as a Web App, run setupIngestToken, "
                      "and paste both values. See automation/README.md step 1.",
        "ingest_token": "Deploy apps-script/Ingest.gs as a Web App, run setupIngestToken, "
                        "and paste both values. See automation/README.md step 1.",
        "census_api_key": "Census refuses keyless requests. Get a free key at "
                          "https://api.census.gov/data/key_signup.html, activate it from "
                          "the email, and paste it. See automation/README.md step 2.",
    }
    for key, fix in fixes.items():
        val = str(cfg.get(key, "")).strip()
        if not val or val.startswith("PASTE_"):
            sys.exit(f"config.json is missing {key}.\n{fix}")

    state = _expand(cfg.get("state_dir", "~/.positioning-os/state"))
    state.mkdir(parents=True, exist_ok=True)
    cfg["state_dir"] = str(state)
    return cfg
