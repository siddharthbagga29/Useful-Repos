"""Local persistence: notes Jarvis was asked to remember, and an audit trail of every tool call."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Memory:
    def __init__(self, path: Path) -> None:
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, created_at TEXT, text TEXT)"
        )
        self._db.commit()
        self._lock = threading.Lock()

    def add_note(self, text: str) -> int:
        with self._lock:
            cursor = self._db.execute(
                "INSERT INTO notes (created_at, text) VALUES (?, ?)", (_now(), text)
            )
            self._db.commit()
            return int(cursor.lastrowid or 0)

    def notes(self, limit: int = 20) -> list[str]:
        with self._lock:
            rows = self._db.execute(
                "SELECT text FROM notes ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [row[0] for row in reversed(rows)]


class AuditLog:
    """Append-only JSON lines: what was proposed, what Siddharth decided, what happened."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()

    def record(self, **fields: Any) -> None:
        line = json.dumps({"ts": _now(), **fields}, ensure_ascii=False, default=str)
        with self._lock, self._path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")


def recent_actions_report(path: Path, limit: int = 30) -> str:
    """The audit log as a readable timeline of actions (no arguments, which may be personal)."""
    if not path.exists():
        return "No actions recorded yet."
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines()[-2000:]:
        try:
            r = json.loads(raw)
        except ValueError:
            continue
        if r.get("event") == "FALSE_CLAIM_CORRECTED":
            lines.append(f"{r['ts'][:16]}  turn {r.get('turn', '?')}  corrected a false claim")
        ran = r.get("event") in ("EXECUTION_COMPLETED", "EXECUTION_FAILED")
        refused = r.get("decision") in ("declined", "invalid", "rejected")
        if r.get("event") != "FALSE_CLAIM_CORRECTED" and "tool" in r and (ran or refused):
            how = r.get("status") or r.get("decision") or r.get("outcome") or "?"
            lines.append(f"{r['ts'][:16]}  turn {r.get('turn', '?')}  {r['tool']}: {how}")
    return "\n".join(lines[-limit:]) or "No actions recorded yet."
