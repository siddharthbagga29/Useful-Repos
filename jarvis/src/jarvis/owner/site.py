"""What Jarvis knows about Siddharth's website and his work in progress.

- ``SiteIndex``: every page, section, project, bot, exhibit, brief section and research note on the
  portfolio, with the URL where it lives (built by portfolio/scripts/site-index.ts).
- ``status_report``: what's done, in progress and next, from portfolio/agent/tasks.json,
  the Brain's latest state and the recent commits. It opens every session, so Jarvis starts
  proactive: he says where things stand and offers to take the next step.
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from jarvis.owner.research import UrlLedger


@dataclass(frozen=True)
class Entry:
    id: str
    kind: str
    title: str
    url: str
    text: str


class SiteIndex:
    def __init__(self, entries: list[Entry], ledger: UrlLedger | None = None) -> None:
        self.entries = entries
        self._ledger = ledger

    @classmethod
    def load(cls, path: Path, ledger: UrlLedger | None = None) -> SiteIndex:
        if not path.exists():
            return cls([], ledger)
        raw: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        return cls([Entry(**e) for e in raw.get("entries", [])], ledger)

    def search(self, query: str, limit: int = 5) -> list[Entry]:
        words = {w for w in re.findall(r"[a-z0-9]+", query.lower()) if len(w) > 2}
        if not words:
            return []

        def score(e: Entry) -> float:
            title = e.title.lower()
            body = e.text.lower()
            return sum(3 * (w in title) + (w in body) for w in words)

        hits = sorted((e for e in self.entries if score(e) > 0), key=score, reverse=True)[:limit]
        if self._ledger:
            for e in hits:
                self._ledger.add(e.url)
        return hits

    def describe(self, query: str) -> str:
        hits = self.search(query)
        if not hits:
            return "Nothing on the site matches that."
        return "\n".join(f"- {e.title} — {e.url}\n  {e.text[:400]}" for e in hits)


def _days(due: str, today: date) -> int:
    return (datetime.strptime(due, "%Y-%m-%d").date() - today).days


def status_report(
    repo: Path, today: date | None = None, ledger: UrlLedger | None = None
) -> dict[str, Any]:
    """Facts only; the agent turns them into speech."""
    today = today or date.today()
    tasks_file = repo / "portfolio" / "agent" / "tasks.json"
    tasks: list[dict[str, Any]] = (
        json.loads(tasks_file.read_text(encoding="utf-8"))["tasks"] if tasks_file.exists() else []
    )
    done = sorted(
        (t for t in tasks if t["status"] == "done"),
        key=lambda t: t.get("completedAt", ""),
        reverse=True,
    )
    open_ = sorted((t for t in tasks if t["status"] != "done"), key=lambda t: t["due"])
    for t in open_:
        if t.get("link") and ledger:
            ledger.add(t["link"])
    commits: list[str] = []
    try:
        log = subprocess.run(
            ["git", "-C", str(repo), "log", "-5", "--format=%s"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        commits = [
            c for c in log.stdout.splitlines() if c and not c.startswith("Record the deploy")
        ]
    except (OSError, subprocess.SubprocessError):
        pass
    return {
        "recently_done": [t["title"] for t in done[:3]],
        "in_progress": [t["title"] for t in open_ if t["status"] == "in_progress"],
        "next": [
            {
                "id": t["id"],
                "title": t["title"],
                "due_in_days": _days(t["due"], today),
                "blocked_on": t.get("blockedOn"),
                "link": t.get("link"),
            }
            for t in open_[:4]
        ],
        "recent_changes": commits[:3],
    }


def opening_line(report: dict[str, Any], hour: int) -> str:
    """The proactive greeting: where things stand, then one offer he can answer with yes."""
    part = "morning" if 5 <= hour < 12 else "afternoon" if hour < 18 else "evening"
    bits = [f"Good {part}."]
    if report["recently_done"]:
        bits.append(f"Most recently finished: {report['recently_done'][0]}.")
    if report["in_progress"]:
        bits.append(f"In progress: {report['in_progress'][0]}.")
    nxt = report["next"][0] if report["next"] else None
    if not nxt:
        return " ".join([*bits, "Nothing is waiting on you. What shall we do?"])
    when = (
        "overdue"
        if nxt["due_in_days"] < 0
        else "due today"
        if nxt["due_in_days"] == 0
        else f"due in {nxt['due_in_days']} days"
    )
    if nxt["blocked_on"]:
        bits.append(f"Next: {nxt['title']}, {when}. I need {nxt['blocked_on']} from you for that.")
        return " ".join([*bits, "Shall I open it so you can get it?"])
    bits.append(f"Next: {nxt['title']}, {when}.")
    return " ".join([*bits, "Shall I open it and walk you through it?"])
