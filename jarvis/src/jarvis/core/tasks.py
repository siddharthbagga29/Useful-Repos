"""The task engine: every meaningful thing Jarvis does is a persistent task with recorded actions.

Status always comes from stored data, so "three things are complete, one is running, and I need
your decision on one" is a count, never a guess. Tasks survive restarts: anything that was running
when Jarvis stopped is re-queued with a note, so it is never reported as finished when it wasn't.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

STATUSES = (
    "queued",
    "planning",
    "running",
    "waiting_for_user",
    "blocked",
    "completed",
    "failed",
    "cancelled",
)
PRIORITIES = ("low", "normal", "high", "critical")
FINAL = {"completed", "failed", "cancelled"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, kind TEXT, params TEXT,
  status TEXT NOT NULL, priority TEXT NOT NULL, created_at TEXT NOT NULL,
  started_at TEXT, completed_at TEXT, parent_id TEXT, required_input TEXT,
  result TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS actions (
  task_id TEXT NOT NULL, at TEXT NOT NULL, summary TEXT NOT NULL, ok INTEGER NOT NULL
);
"""


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


@dataclass
class TaskAction:
    at: str
    summary: str
    ok: bool


@dataclass
class Task:
    id: str
    title: str
    status: str
    priority: str
    created_at: str
    description: str = ""
    kind: str = ""
    params: dict[str, Any] = field(default_factory=dict)
    started_at: str | None = None
    completed_at: str | None = None
    parent_id: str | None = None
    required_input: str | None = None
    result: Any = None
    error: str | None = None
    actions: list[TaskAction] = field(default_factory=list)


class TaskError(ValueError):
    """An invalid task operation (unknown id, bad status, changing a finished task)."""


class TaskEngine:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()  # background tasks and the agent share one store
        with self._lock:
            self._db.executescript(SCHEMA)

    def create(
        self,
        title: str,
        *,
        description: str = "",
        kind: str = "",
        params: dict[str, Any] | None = None,
        priority: str = "normal",
        parent_id: str | None = None,
    ) -> Task:
        if priority not in PRIORITIES:
            raise TaskError(f"priority must be one of {PRIORITIES}")
        task_id = uuid.uuid4().hex[:8]
        with self._lock:
            self._db.execute(
                "INSERT INTO tasks (id,title,description,kind,params,status,priority,created_at,"
                "parent_id) VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    task_id,
                    title[:200],
                    description[:2000],
                    kind,
                    json.dumps(params or {}),
                    "queued",
                    priority,
                    now(),
                    parent_id,
                ),
            )
            self._db.commit()
        return self.get(task_id)

    def get(self, task_id: str) -> Task:
        with self._lock:
            row = self._db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row is None:
                raise TaskError(f"no task {task_id!r}")
            acts = self._db.execute(
                "SELECT at, summary, ok FROM actions WHERE task_id=? ORDER BY rowid", (task_id,)
            ).fetchall()
        return self._task(row, [TaskAction(a, s, bool(o)) for a, s, o in acts])

    @staticmethod
    def _task(row: tuple[Any, ...], actions: list[TaskAction]) -> Task:
        (tid, title, desc, kind, params, status, prio, created, started, completed, parent, req,
         result, error) = row  # fmt: skip
        return Task(
            id=tid,
            title=title,
            description=desc or "",
            kind=kind or "",
            params=json.loads(params or "{}"),
            status=status,
            priority=prio,
            created_at=created,
            started_at=started,
            completed_at=completed,
            parent_id=parent,
            required_input=req,
            result=json.loads(result) if result else None,
            error=error,
            actions=actions,
        )

    def act(self, task_id: str, summary: str, ok: bool = True) -> None:
        with self._lock:
            self._db.execute(
                "INSERT INTO actions VALUES (?,?,?,?)", (task_id, now(), summary[:500], int(ok))
            )
            self._db.commit()

    def transition(
        self,
        task_id: str,
        status: str,
        *,
        result: Any = None,
        error: str | None = None,
        required_input: str | None = None,
    ) -> Task:
        if status not in STATUSES:
            raise TaskError(f"status must be one of {STATUSES}")
        task = self.get(task_id)
        if task.status in FINAL:
            raise TaskError(f"task {task_id} is already {task.status}")
        sets = ["status=?", "required_input=?"]
        vals: list[Any] = [status, required_input if status == "waiting_for_user" else None]
        if status == "running" and not task.started_at:
            sets.append("started_at=?")
            vals.append(now())
        if status in FINAL:
            sets.append("completed_at=?")
            vals.append(now())
        if result is not None:
            sets.append("result=?")
            vals.append(json.dumps(result, default=str))
        if error is not None:
            sets.append("error=?")
            vals.append(error[:1000])
        with self._lock:
            # Only fixed column names are interpolated; every value is a bound parameter.
            sql = f"UPDATE tasks SET {', '.join(sets)} WHERE id=?"  # noqa: S608
            self._db.execute(sql, (*vals, task_id))
            self._db.commit()
        self.act(
            task_id, f"status → {status}" + (f": {error}" if error else ""), status != "failed"
        )
        return self.get(task_id)

    def find(self, statuses: tuple[str, ...] | None = None, limit: int = 50) -> list[Task]:
        q = "SELECT id FROM tasks"
        args: tuple[Any, ...] = ()
        if statuses:
            q += f" WHERE status IN ({','.join('?' * len(statuses))})"
            args = statuses
        q += " ORDER BY created_at DESC LIMIT ?"
        with self._lock:
            ids = [r[0] for r in self._db.execute(q, (*args, limit)).fetchall()]
        return [self.get(i) for i in ids]

    def recover(self) -> list[Task]:
        """Re-queue work that was running when Jarvis last stopped, with a note saying so."""
        stale = self.find(("running", "planning"))
        for t in stale:
            with self._lock:
                self._db.execute("UPDATE tasks SET status='queued' WHERE id=?", (t.id,))
                self._db.commit()
            self.act(t.id, "interrupted when Jarvis stopped; re-queued to resume", ok=False)
        return stale

    def counts(self) -> dict[str, int]:
        with self._lock:
            rows = self._db.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status").fetchall()
        return {s: n for s, n in rows}

    def summary(self, since: str | None = None) -> str:
        """One spoken sentence, built only from stored task data."""
        c = self.counts()
        if since:
            with self._lock:
                (done,) = self._db.execute(
                    "SELECT COUNT(*) FROM tasks WHERE status='completed' AND completed_at>=?",
                    (since,),
                ).fetchone()
        else:
            done = c.get("completed", 0)
        parts = []
        if done:
            parts.append(f"{_n(done)} {'thing is' if done == 1 else 'things are'} complete")
        if c.get("running", 0):
            parts.append(f"{_n(c['running'])} {'is' if c['running'] == 1 else 'are'} running")
        if c.get("queued", 0):
            parts.append(f"{_n(c['queued'])} queued")
        tail = []
        if c.get("waiting_for_user", 0):
            n = c["waiting_for_user"]
            tail.append(f"I need your decision on {_n(n)} {'item' if n == 1 else 'items'}")
        if c.get("failed", 0):
            tail.append(f"{_n(c['failed'])} failed")
        if not parts and not tail:
            return "No tasks yet."
        text = ", ".join(parts)
        if tail:
            text = f"{text}, and {' and '.join(tail)}" if text else " and ".join(tail)
        return text[0].upper() + text[1:] + "."


_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]


def _n(n: int) -> str:
    return _WORDS[n] if 0 <= n < len(_WORDS) else str(n)
