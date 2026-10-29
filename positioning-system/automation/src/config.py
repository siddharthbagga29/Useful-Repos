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

    for key in ("ingest_url", "ingest_token"):
        val = str(cfg.get(key, "")).strip()
        if not val or val.startswith("PASTE_"):
            sys.exit(
                f"config.json is missing {key}.\n"
                f"Deploy apps-script/Ingest.gs as a Web App, run setupIngestToken, "
                f"and paste both values. See automation/README.md step 1."
            )

    key = str(cfg.get("census_api_key", "") or "").strip()
    if not key or key.startswith("PASTE_"):
        cfg["census_api_key"] = ""
        print("WARNING: no census_api_key in config.json. The Census API now "
              "throttles unkeyed callers, so pulls will start failing. "
              "Request one free at https://api.census.gov/data/key_signup.html",
              file=sys.stderr)
    else:
        cfg["census_api_key"] = key

    state = _expand(cfg.get("state_dir", "~/.positioning-os/state"))
    state.mkdir(parents=True, exist_ok=True)
    cfg["state_dir"] = str(state)
    return cfg
