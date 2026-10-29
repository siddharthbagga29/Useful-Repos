"""
The evolution layer.

Learning here is mechanical, not mystical: every source carries a success
record, a failure count, a yield and a content hash, and those numbers change
what the agent does tomorrow. Dead sources get dropped and escalated;
productive sources get scraped first. Nothing is "learned" that you cannot read
in a cell.

Append-only, like every other agent write. Each run adds one row per source and
the current state is simply the newest row for that Source ID. That keeps the
full history — you can see a source degrade over weeks — and it means the agent
never overwrites anything.
"""
from __future__ import annotations
import datetime as dt
from .sheets import Book, AGENT_MEMORY


def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def _int(v, default=0) -> int:
    try:
        return int(v or default)
    except (TypeError, ValueError):
        return default


class Memory:
    def __init__(self, book: Book):
        self.book = book
        self.latest: dict[str, dict] = {}
        self.degraded = ""      # non-empty when the read failed, not when empty

        # A missing tab is NOT an exception here: doGet answers ok with no rows.
        # So any exception means the read genuinely failed, and treating that as
        # "first run" silently empties the agent's memory - no stored hashes, so
        # nothing can register as changed, and retired sources come back to
        # life. The system would look healthy and detect nothing.
        try:
            for r in book.read(AGENT_MEMORY):          # oldest -> newest
                sid = r.get("Source ID")
                if sid:
                    self.latest[sid] = r               # last write wins
        except Exception as e:
            self.degraded = str(e)[:300]

    def get(self, sid: str) -> dict:
        return self.latest.get(sid, {})

    def hash_of(self, sid: str) -> str:
        return str(self.get(sid).get("Content Hash", "") or "")

    def failures(self, sid: str) -> int:
        return _int(self.get(sid).get("Consecutive Failures"))

    def priority(self, sid: str) -> int:
        return _int(self.get(sid).get("Priority"), 5)

    def should_skip(self, sid: str, limit: int) -> bool:
        """A source that has failed `limit` runs in a row is not scraped again
        until a human looks at it. Hammering a dead URL is noise; the
        escalation is the useful output."""
        return self.failures(sid) >= limit

    def record(self, source: dict, ok: bool, items: int,
               content_hash: str = "", note: str = "") -> None:
        sid = source["id"]
        prev = self.get(sid)
        fails = 0 if ok else self.failures(sid) + 1
        # Productive sources float up; flaky ones sink. 1 = scraped first.
        priority = max(1, min(9, 5 - (1 if items else 0) + fails))

        row = [
            sid, source.get("kind", ""), source.get("org", ""), source.get("url", ""),
            _now() if ok else (prev.get("Last Success", "") or ""),
            (prev.get("Last Failure", "") or "") if ok else _now(),
            fails,
            _int(prev.get("Total Runs")) + 1,
            items,
            _int(prev.get("Items Found (total)")) + max(items, 0),
            content_hash or (prev.get("Content Hash", "") or ""),
            priority,
            note,
        ]
        self.book.append(AGENT_MEMORY, [row])
        self.latest[sid] = dict(zip(
            ["Source ID", "Kind", "Org", "URL", "Last Success", "Last Failure",
             "Consecutive Failures", "Total Runs", "Items Found (last)",
             "Items Found (total)", "Content Hash", "Priority", "Notes"], row))

    def ordered(self, sources: list[dict]) -> list[dict]:
        return sorted(sources, key=lambda s: self.priority(s["id"]))
