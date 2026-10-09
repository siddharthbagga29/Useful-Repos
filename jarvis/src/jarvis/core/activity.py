"""The activity feed: what's done, what's running, what needs the owner, from stored state only."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jarvis.core.tasks import TaskEngine

ICON = {
    "completed": "✓",
    "running": "→",
    "planning": "→",
    "queued": "·",
    "waiting_for_user": "⚠",
    "blocked": "⚠",
    "failed": "✗",
    "cancelled": "-",
}


@dataclass(frozen=True)
class FeedItem:
    icon: str
    status: str
    task_id: str
    title: str
    detail: str
    at: str


def feed(engine: TaskEngine, limit: int = 20) -> dict[str, Any]:
    """Grouped for the command center: needs you, running, done, failed; plus the summary line."""
    tasks = engine.find(limit=limit)

    def item(t: Any) -> dict[str, str]:
        last = t.actions[-1].summary if t.actions else ""
        detail = t.required_input or t.error or last
        return FeedItem(
            ICON.get(t.status, "·"),
            t.status,
            t.id,
            t.title,
            detail,
            t.completed_at or t.started_at or t.created_at,
        ).__dict__

    return {
        "summary": engine.summary(),
        "needs_you": [item(t) for t in tasks if t.status in ("waiting_for_user", "blocked")],
        "running": [item(t) for t in tasks if t.status in ("running", "planning", "queued")],
        "done": [item(t) for t in tasks if t.status == "completed"][:8],
        "failed": [item(t) for t in tasks if t.status == "failed"][:5],
    }
