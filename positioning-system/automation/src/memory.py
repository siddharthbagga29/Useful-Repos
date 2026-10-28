"""
The evolution layer.

Learning here is mechanical, not mystical: every source carries a success
record, a failure count, a yield, and a content hash. Those numbers change what
the agent does tomorrow — dead sources get dropped and escalated, productive
sources get priority. Nothing is "learned" that cannot be read in a cell.
"""
from __future__ import annotations
import datetime as dt
from .sheets import Book, AGENT_MEMORY


def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


class Memory:
    def __init__(self, book: Book):
        self.book = book
        self.rows = {r.get("Source ID"): r for r in book.read(AGENT_MEMORY) if r.get("Source ID")}

    def get(self, source_id: str) -> dict:
        return self.rows.get(source_id, {})

    def hash_of(self, source_id: str) -> str:
        return str(self.get(source_id).get("Content Hash", ""))

    def failures(self, source_id: str) -> int:
        try:
            return int(self.get(source_id).get("Consecutive Failures", 0) or 0)
        except (TypeError, ValueError):
            return 0

    def priority(self, source_id: str) -> int:
        """1 = scrape first. Rises (worse) with failures, falls with yield."""
        r = self.get(source_id)
        if not r:
            return 5
        try:
            p = int(r.get("Priority", 5) or 5)
        except (TypeError, ValueError):
            p = 5
        return p

    def should_skip(self, source_id: str, limit: int) -> bool:
        """A source that has failed `limit` times in a row is not scraped again
        until a human looks at it. Repeatedly hammering a dead URL is noise, and
        the escalation is the useful output."""
        return self.failures(source_id) >= limit

    def record(self, source, ok: bool, items: int, content_hash: str = "", note: str = ""):
        sid = source["id"]
        prev = self.get(sid)
        try:
            total_runs = int(prev.get("Total Runs", 0) or 0) + 1
            total_items = int(prev.get("Items Found (total)", 0) or 0) + max(items, 0)
        except (TypeError, ValueError):
            total_runs, total_items = 1, max(items, 0)

        fails = 0 if ok else self.failures(sid) + 1
        # Priority: productive sources float to the top, flaky ones sink.
        priority = max(1, min(9, 5 - (1 if items else 0) + fails))

        row = [sid, source.get("kind", ""), source.get("org", ""), source.get("url", ""),
               _now() if ok else prev.get("Last Success", ""),
               prev.get("Last Failure", "") if ok else _now(),
               fails, total_runs, items, total_items,
               content_hash or prev.get("Content Hash", ""), priority, note]

        ws = self.book.tab(AGENT_MEMORY)
        existing = [r.get("Source ID") for r in self.book.read(AGENT_MEMORY)]
        if sid in existing:
            ws.update([row], f"A{existing.index(sid) + 2}")
        else:
            ws.append_row(row, value_input_option="USER_ENTERED")
        self.rows[sid] = dict(zip(
            ["Source ID", "Kind", "Org", "URL", "Last Success", "Last Failure",
             "Consecutive Failures", "Total Runs", "Items Found (last)",
             "Items Found (total)", "Content Hash", "Priority", "Notes"], row))

    def ordered(self, sources: list[dict]) -> list[dict]:
        return sorted(sources, key=lambda s: self.priority(s["id"]))
