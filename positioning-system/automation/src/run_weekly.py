"""
Weekly report. Writes a 'Weekly Report' row the Apps Script emails.

Python never sends mail: Apps Script already holds Gmail and runs on Google's
servers whether or not the laptop is open. Keeping email there means no SMTP
credentials on disk and one less thing to break.
"""
from __future__ import annotations
import datetime as dt, sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from automation.src.config import load
from automation.src.sheets import Book, HEADERS, AGENT_LOG, ESCALATIONS, AGENT_MEMORY

REPORT_TAB = "Weekly Report"
HEADERS[REPORT_TAB] = ["Week ending", "Runs", "Census pulls", "Establishments logged",
                  "Form D filings", "Sources watched", "Changes detected",
                        "Open escalations (HIGH)", "Open escalations (MEDIUM)",
                        "Dead sources", "Narrative", "Emailed"]


def _recent(rows, field, days):
    cut = dt.datetime.now() - dt.timedelta(days=days)
    out = []
    for r in rows:
        try:
            if dt.datetime.fromisoformat(str(r.get(field, ""))[:19]) >= cut:
                out.append(r)
        except ValueError:
            continue
    return out


def main() -> int:
    cfg = load()
    book = Book(cfg)

    def safe(tab):
        try:
            return book.read(tab)
        except Exception:
            return []

    logs = _recent(safe(AGENT_LOG), "Timestamp", 7)
    escs = [e for e in safe(ESCALATIONS) if str(e.get("Status", "")).upper() == "OPEN"]
    mems = safe(AGENT_MEMORY)

    runs = len({r.get("Run ID") for r in logs if r.get("Run ID")})
    census_rows = [r for r in logs if r.get("Module") == "census" and r.get("Result") == "OK"]
    estabs = sum(int(r.get("Items", 0) or 0) for r in census_rows)
    formd = sum(int(r.get("Items", 0) or 0) for r in logs if r.get("Module") == "edgar")
    changes = len([r for r in logs if r.get("Result") == "CHANGED"])
    high = len([e for e in escs if str(e.get("Severity")).upper() == "HIGH"])
    med = len([e for e in escs if str(e.get("Severity")).upper() == "MEDIUM"])
    dead = [m for m in mems if int(m.get("Consecutive Failures", 0) or 0) >= 3]

    cats = Counter(e.get("Category", "?") for e in escs)
    top = ", ".join(f"{k} ({v})" for k, v in cats.most_common(4)) or "none"

    if runs == 0:
        narrative = ("No runs completed this week. The Mac was asleep, launchd did not "
                     "fire, or the script errored before writing. Check "
                     "~/.positioning-os/logs/daily.err.")
    else:
        narrative = (
            f"{runs} runs. Census logged {estabs} establishments across "
            f"{len(census_rows)} pulls. {formd} Form D filings surfaced in OH/KY/IN. "
            f"{changes} watched pages changed. "
            f"Open escalations by category: {top}. "
            + (f"{len(dead)} source(s) retired after repeated failure and need a URL check. "
               if dead else "")
            + ("Nothing requires you urgently." if high == 0
               else f"{high} HIGH escalation(s) need a decision from you.")
        )

    book.append(REPORT_TAB, [[
        dt.date.today().isoformat(), runs, len(census_rows), estabs, formd,
        len(mems), changes, high, med, len(dead), narrative, "NO",
    ]])
    book.flush()
    print(f"weekly report written: {runs} runs, {high} HIGH, {med} MEDIUM open")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
