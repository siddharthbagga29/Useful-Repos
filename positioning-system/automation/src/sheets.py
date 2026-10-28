"""
Google Sheets access.

Deliberately append-only for agent output. The agent never edits a cell a human
wrote; it adds rows to its own tabs. That makes every automated change trivially
reviewable and impossible to confuse with your own edits.
"""
from __future__ import annotations
import datetime as dt
import gspread
from google.oauth2.service_account import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Tabs the agent owns. Created on first run if absent.
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


class Book:
    def __init__(self, cfg: dict):
        creds = Credentials.from_service_account_file(
            cfg["service_account_file"], scopes=SCOPES)
        self.gc = gspread.authorize(creds)
        self.ss = self.gc.open_by_key(cfg["spreadsheet_id"])
        self._cache: dict[str, gspread.Worksheet] = {}

    def tab(self, name: str) -> gspread.Worksheet:
        if name in self._cache:
            return self._cache[name]
        try:
            ws = self.ss.worksheet(name)
        except gspread.WorksheetNotFound:
            cols = len(HEADERS.get(name, [])) or 20
            ws = self.ss.add_worksheet(title=name, rows=2000, cols=cols)
            if name in HEADERS:
                ws.update([HEADERS[name]], "A1")
                ws.format("A1:Z1", {"textFormat": {"bold": True}})
        self._cache[name] = ws
        return ws

    def append(self, tab_name: str, rows: list[list]) -> int:
        if not rows:
            return 0
        self.tab(tab_name).append_rows(rows, value_input_option="USER_ENTERED")
        return len(rows)

    def read(self, tab_name: str) -> list[dict]:
        try:
            return self.tab(tab_name).get_all_records()
        except Exception:
            return []

    # ---- agent-owned writes ------------------------------------------------

    def log(self, run_id, module, action, result, items=0, url="", secs=0.0, notes=""):
        self.append(AGENT_LOG, [[run_id, _now(), module, action, result,
                                 items, url, round(secs, 1), notes]])

    def escalate(self, run_id, severity, category, what, why, suggested, url="", notes=""):
        """severity: HIGH (email immediately) | MEDIUM (weekly) | LOW (log only)"""
        eid = f"ESC-{run_id}-{category[:12].replace(' ', '')}"
        self.append(ESCALATIONS, [[eid, _now(), severity, category, what, why,
                                   suggested, url, "OPEN", "", notes]])
        return eid
