"""Long-term memory layers beyond notes: episodes, project state, decisions and preferences.

- Episodes: dated events ("researched agentic memory; saved 3 papers").
- Projects: per-project state lines (what's complete, in progress, pending).
- Decisions: decision, reason, project, source, date.
- Preferences: learned or stated preferences. These shape behaviour only; they can never change
  security policy (that lives in configuration the owner controls).

Never store secrets here: values that look like keys or passwords are refused.
"""

from __future__ import annotations

import re
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS episodes (at TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (
  project TEXT NOT NULL, item TEXT NOT NULL, state TEXT NOT NULL, at TEXT NOT NULL,
  PRIMARY KEY (project, item)
);
CREATE TABLE IF NOT EXISTS decisions (
  at TEXT NOT NULL, project TEXT, decision TEXT NOT NULL, reason TEXT, source TEXT
);
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, at TEXT NOT NULL
);
"""

SECRETISH = re.compile(
    r"(sk[-_][A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|api[_ -]?key"
    r"|password|passwd|secret|token\s*[:=]|-----BEGIN)",
    re.IGNORECASE,
)
PROJECT_STATES = ("complete", "in_progress", "blocked", "waiting_for_user", "pending", "risk")


class SecretRefused(ValueError):
    """Memory never stores anything that looks like a credential."""


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _clean(text: str, limit: int = 1000) -> str:
    if SECRETISH.search(text):
        raise SecretRefused("That looks like a credential; it belongs in Keychain, not memory.")
    return text.strip()[:limit]


class Journal:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()
        with self._lock:
            self._db.executescript(SCHEMA)

    def episode(self, kind: str, text: str) -> None:
        with self._lock:
            self._db.execute("INSERT INTO episodes VALUES (?,?,?)", (_now(), kind, _clean(text)))
            self._db.commit()

    def episodes(self, limit: int = 20, since: str | None = None) -> list[tuple[str, str, str]]:
        with self._lock:
            if since:
                rows = self._db.execute(
                    "SELECT at, kind, text FROM episodes WHERE at>=? ORDER BY at DESC LIMIT ?",
                    (since, limit),
                ).fetchall()
            else:
                rows = self._db.execute(
                    "SELECT at, kind, text FROM episodes ORDER BY at DESC LIMIT ?", (limit,)
                ).fetchall()
        return [(a, k, t) for a, k, t in rows]

    def set_project(self, project: str, item: str, state: str) -> None:
        if state not in PROJECT_STATES:
            raise ValueError(f"state must be one of {PROJECT_STATES}")
        with self._lock:
            self._db.execute(
                "INSERT OR REPLACE INTO projects VALUES (?,?,?,?)",
                (_clean(project, 100), _clean(item, 300), state, _now()),
            )
            self._db.commit()

    def project(self, project: str) -> dict[str, list[str]]:
        with self._lock:
            rows = self._db.execute(
                "SELECT item, state FROM projects WHERE project=? ORDER BY at", (project,)
            ).fetchall()
        out: dict[str, list[str]] = {s: [] for s in PROJECT_STATES}
        for item, state in rows:
            out[state].append(item)
        return {k: v for k, v in out.items() if v}

    def decide(self, decision: str, reason: str = "", project: str = "", source: str = "") -> None:
        with self._lock:
            self._db.execute(
                "INSERT INTO decisions VALUES (?,?,?,?,?)",
                (_now(), project[:100], _clean(decision, 500), _clean(reason, 500), source[:200]),
            )
            self._db.commit()

    def decisions(self, project: str = "", limit: int = 20) -> list[tuple[str, str, str, str]]:
        with self._lock:
            rows = self._db.execute(
                "SELECT at, project, decision, reason FROM decisions "
                "WHERE (?='' OR project=?) ORDER BY at DESC LIMIT ?",
                (project, project, limit),
            ).fetchall()
        return [(a, p, d, r) for a, p, d, r in rows]

    def prefer(self, key: str, value: str) -> None:
        with self._lock:
            self._db.execute(
                "INSERT OR REPLACE INTO preferences VALUES (?,?,?)",
                (_clean(key, 100), _clean(value, 300), _now()),
            )
            self._db.commit()

    def preferences(self) -> dict[str, str]:
        with self._lock:
            rows = self._db.execute("SELECT key, value FROM preferences ORDER BY key").fetchall()
        return {k: v for k, v in rows}

    def recall(self, query: str, limit: int = 8) -> list[str]:
        """Plain keyword recall across episodes and decisions (data for the agent, not commands)."""
        words = [w for w in re.findall(r"[a-z0-9]+", query.lower()) if len(w) > 2]
        if not words:
            return []
        hits: list[tuple[int, str]] = []
        for at, kind, text in self.episodes(limit=500):
            score = sum(w in text.lower() for w in words)
            if score:
                hits.append((score, f"{at[:10]} {kind}: {text}"))
        for at, project, decision, reason in self.decisions(limit=200):
            blob = f"{decision} {reason} {project}".lower()
            score = sum(w in blob for w in words)
            if score:
                hits.append((score, f"{at[:10]} decision ({project or 'general'}): {decision}"))
        return [t for _, t in sorted(hits, key=lambda h: -h[0])[:limit]]
