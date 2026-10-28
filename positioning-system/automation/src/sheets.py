"""
Sheet access via the Apps Script Web App.

WHY NOT THE SHEETS API: Google's Secure-by-Default org policy
(iam.disableServiceAccountKeyCreation) blocks service-account key downloads on
consumer accounts, so the standard gspread path is unavailable. Apps Script
already holds full access to this workbook and has never failed, so the Mac
posts to it instead. No Google Cloud project, no OAuth consent screen, no key
file on disk.

Writes are append-only: the agent adds rows to its own tabs and never edits a
cell a human wrote.
"""
from __future__ import annotations
import datetime as dt
import requests

AGENT_LOG = "Agent Log"
ESCALATIONS = "Escalations"
AGENT_MEMORY = "Agent Memory"

HEADERS = {
    AGENT_LOG: ["Run ID", "Timestamp", "Module", "Action", "Result",
                "Items", "Source URL", "Duration (s)", "Notes"],
    ESCALATIONS: ["Escalation ID", "Raised", "Severity", "Category", "What happened",
                  "Why it needs you", "Suggested action", "Source URL",
                  "Status", "Resolved", "Notes"],
    AGENT_MEMORY: ["Source ID", "Kind", "Org", "URL", "Last Success", "Last Failure",
                   "Consecutive Failures", "Total Runs", "Items Found (last)",
                   "Items Found (total)", "Content Hash", "Priority", "Notes"],
}


def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


class SheetError(RuntimeError):
    pass


class Book:
    """Buffers writes and flushes them in one POST. Fewer round trips, and a
    partial run cannot leave half a batch behind."""

    def __init__(self, cfg: dict):
        self.url = cfg["ingest_url"].strip()
        self.token = cfg["ingest_token"].strip()
        if not self.url.startswith("https://script.google.com/"):
            raise SheetError(
                f"ingest_url does not look like an Apps Script Web App URL: {self.url!r}\n"
                "Deploy Ingest.gs as a Web App and paste the /exec URL."
            )
        self._pending: dict[str, list[list]] = {}

    # ---- reads -------------------------------------------------------------

    def read(self, tab: str) -> list[dict]:
        try:
            r = requests.get(self.url, params={"token": self.token, "tab": tab}, timeout=60)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise SheetError(f"read {tab!r} failed: {e}") from e
        if not data.get("ok"):
            raise SheetError(f"read {tab!r} refused: {data.get('error')}")
        return data.get("rows", [])

    # ---- buffered writes ---------------------------------------------------

    def append(self, tab: str, rows: list[list]) -> int:
        if not rows:
            return 0
        self._pending.setdefault(tab, []).extend([[("" if c is None else c) for c in r] for r in rows])
        return len(rows)

    def flush(self) -> dict:
        if not self._pending:
            return {"ok": True, "written": 0}
        writes = [{"tab": t, "headers": HEADERS.get(t, []), "rows": rows}
                  for t, rows in self._pending.items()]
        try:
            r = requests.post(self.url, json={"token": self.token, "writes": writes}, timeout=120)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise SheetError(
                f"flush failed ({sum(len(v) for v in self._pending.values())} rows held): {e}"
            ) from e
        if not data.get("ok"):
            raise SheetError(f"flush refused: {data.get('error')}")
        self._pending.clear()
        return data

    # ---- agent-owned writes ------------------------------------------------

    def log(self, run_id, module, action, result, items=0, url="", secs=0.0, notes=""):
        self.append(AGENT_LOG, [[run_id, _now(), module, action, result,
                                 items, url, round(secs, 1), notes]])

    def escalate(self, run_id, severity, category, what, why, suggested, url="", notes=""):
        """severity: HIGH (same-day email) | MEDIUM (weekly) | LOW (sheet only)"""
        eid = f"ESC-{run_id}-{category[:12].replace(' ', '')}"
        self.append(ESCALATIONS, [[eid, _now(), severity, category, what, why,
                                   suggested, url, "OPEN", "", notes]])
        return eid

    def selftest(self) -> dict:
        """Proves the endpoint, token and sheet are all reachable before a real run."""
        self.append(AGENT_LOG, [[
            "SELFTEST", _now(), "selftest", "connectivity check", "OK", 1, "", 0,
            "If you can read this row, the Mac can write to the sheet.",
        ]])
        return self.flush()
