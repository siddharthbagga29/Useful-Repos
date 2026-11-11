"""
Loads the acquisition plan into the workbook. Run once; safe to re-run.

The plan in ../../acquisition-research is the spine of everything that follows.
The 90-day calendar is the daily script Nexus reads back; the gates are what
must be true before an LOI exists at all; the case library is the study
schedule. None of it is invented here — every row is copied from the pack, and
where the pack says a figure is undisclosed it stays undisclosed.

Re-running is safe because each tab is only written when it is empty. The point
is to seed, not to overwrite work done in the sheet afterwards.
"""
from __future__ import annotations
import datetime as dt
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from automation.src.config import load
from automation.src.sheets import Book, PLAN, DEALS, OPERATORS, CASES, GATES, SCORECARD

PACK = Path(__file__).resolve().parents[3] / "acquisition-research"
BLOCKS = ["CAREER", "ACQUISITION", "NETWORK"]

# File 01 §3 answer 10. Nothing here is legal advice; gate 1 and 2 exist
# precisely because that judgement is counsel's, not this system's.
LOI_GATES = [
    ("G1", "LOI gate", "Legal clearance",
     "Written counsel answers on ownership, fees, officer roles and guarantees",
     "Yes"),
    ("G2", "LOI gate", "Immigration status",
     "EAD with 12+ months remaining, or a green card", "Yes"),
    ("G3", "LOI gate", "Household reserves",
     "6+ months of household reserves, untouched", "No"),
    ("G4", "LOI gate", "Signed operator",
     "Signed operating partner with verified references", "No"),
    ("G5", "LOI gate", "Capital indications",
     "2+ written equity indications and a lender conversation", "No"),
    ("G6", "LOI gate", "Model passes",
     "Model clears 1.25x Base DSCR and 1.0x Downside DSCR", "No"),
]

IC_RULES = [
    ("IC01", "Max entry multiple 6.0x adjusted EBITDA below $1.5m EBITDA"),
    ("IC02", "Adjusted EBITDA must subtract the owner's replacement cost"),
    ("IC03", "Senior leverage <= 2.25x; total debt <= 3.25x at close"),
    ("IC04", "Minimum DSCR >= 1.25x Base and >= 1.0x in a -25% EBITDA downside"),
    ("IC05", "Investor net IRR >= 20% Base without multiple expansion beyond +0.5x"),
    ("IC06", "No personal guarantee beyond an agreed cap, never above liquid net worth"),
    ("IC07", "No deal without a signed operator"),
    ("IC08", "No action outside written counsel clearance"),
    ("IC09", "Walk away if add-backs exceed 20% of EBITDA without documents"),
    ("IC10", "Walk away from any target with unresolved AFFF/PFAS history"),
]


def _calendar() -> dict:
    f = PACK / "print" / "calendar.json"
    if not f.exists():
        sys.exit(f"No calendar at {f}. Is acquisition-research/ present?")
    return json.loads(f.read_text())


def plan_rows(cal: dict) -> list[list]:
    rows = []
    for d in cal["days"]:
        for i, g in enumerate(d["goals"]):
            rows.append([
                d["day"], d["date"], d["dow"], d["week"],
                BLOCKS[i] if i < len(BLOCKS) else f"EXTRA {i + 1}",
                g.get("action", ""), g.get("min", ""),
                g.get("deliverable", ""), g.get("done", ""),
                "", "", "", "", "",
            ])
    return rows


def case_rows(cal: dict) -> list[list]:
    """The study schedule. Prices and multiples are deliberately left blank —
    file 04 holds them with their sources, and several are n/d. Copying a
    number here without its source would make it look confirmed."""
    rows = []
    for day, label in sorted(cal.get("cases", {}).items(), key=lambda kv: int(kv[0])):
        m = re.match(r"^([A-Z]\d+)\s+(.+?)\s*(?:←|<-)\s*(.+)$", str(label).strip())
        if m:
            cid, acquirer, target = m.group(1), m.group(2), m.group(3)
        else:
            cid, acquirer, target = f"C{day}", "", str(label)
        rows.append([cid, acquirer.strip(), target.strip(), "", "", "", "", "",
                     "", day, "NOT STARTED", "", "See acquisition-research/04"])
    return rows


def gate_rows() -> list[list]:
    rows = [[gid, kind, name, req, "NOT MET", "", "", counsel,
             "From acquisition-research/01 answer 10 and file 08 section 4"]
            for gid, kind, name, req, counsel in LOI_GATES]
    rows += [[rid, "IC rule", text, text, "ACTIVE", "", "", "No",
              "Written before deal #1 — acquisition-research/01 section 7"]
             for rid, text in IC_RULES]
    return rows


def main() -> int:
    cfg = load()
    book = Book(cfg)
    cal = _calendar()
    today = dt.date.today().isoformat()

    def seed(tab: str, rows: list[list], what: str) -> None:
        try:
            existing = book.read(tab)
        except Exception as e:
            print(f"{tab}: could not read ({str(e)[:120]}) — skipped, "
                  f"re-run once the endpoint answers", file=sys.stderr)
            return
        if existing:
            print(f"{tab}: {len(existing)} rows already — left alone")
            return
        book.append(tab, rows)
        print(f"{tab}: seeding {len(rows)} {what}")

    seed(PLAN, plan_rows(cal), "goals (90 days x 3)")
    seed(CASES, case_rows(cal), "case studies")
    seed(GATES, gate_rows(), "gates and IC rules")

    # These three are filled by research, not by the pack. Seeding one row
    # creates the tab with its headers so the first run has somewhere to write.
    seed(DEALS, [["", "", "", "", "", "", "", "", "", "UNKNOWN", "", "", "",
                  "", "", "UNVERIFIED", "", "", "", "", "Empty", "", ""]],
         "placeholder row")
    seed(OPERATORS, [["", "", "", "", "", "", "", "", "", "", "",
                      "UNVERIFIED", "", "Empty", "", ""]], "placeholder row")
    seed(SCORECARD, [[1, "", "", "", "", "", "", "", "", "", "", "", "",
                      f"Seeded {today}. Week 1 of the 90-day plan."]],
         "placeholder row")

    res = book.flush()
    print(f"wrote {res.get('written', 0)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
