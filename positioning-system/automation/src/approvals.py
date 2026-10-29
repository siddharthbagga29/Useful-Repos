"""
Turning a tap into work.

An approval that only changes a cell is a checkbox. When a fund close is
approved from the phone, the next run has to produce something: here, a Target
Companies row for the firm, carrying the SEC filing as its source, so the
decision lands in the CRM where the rest of the pipeline already lives.

What this deliberately does NOT do is go and find the firm's team page and
write down who works there. No search result is trustworthy enough to turn into
a named contact without a human looking, and a plausible wrong name costs more
than a missing one. Instead the approval raises one escalation carrying a
search link, so the sourcing is a two-minute job done by someone who can tell
the right firm from a similarly named one.
"""
from __future__ import annotations
import datetime as dt
from urllib.parse import quote_plus

QUEUED = "QUEUED"


def _already_queued(note: str) -> bool:
    return QUEUED in str(note or "")


def process(book, run_id: str) -> dict:
    """Reads Opportunities, acts on anything APPROVED and not yet queued."""
    out = {"queued": 0, "errors": [], "names": []}
    try:
        rows = book.read("Opportunities")
    except Exception as e:
        out["errors"].append(f"could not read Opportunities: {str(e)[:200]}")
        return out

    for r in rows:
        if str(r.get("Status", "")).upper() != "APPROVED":
            continue
        if _already_queued(r.get("Notes")):
            continue

        firm = str(r.get("Organization") or "").strip()
        if not firm:
            continue
        filing = str(r.get("Notes") or "").split(" | ")[0].strip()
        today = dt.date.today().isoformat()

        book.append("Target Companies", [[
            f"FIRM-{run_id}-{out['queued'] + 1}", firm, "", "Fund manager — Form D filer",
            "", "Private", "", "", "UNKNOWN", "", "Filed Form D within the last 7 days",
            "", "", "UNVERIFIED", "", "SEC EDGAR Form D", filing,
            "SECONDARY VERIFIED", today, "Medium",
            "Source the team page and confirm every title on the firm's own site",
            f"Added because you approved {r.get('Opp ID')} from Telegram. "
            f"Fund closes precede junior hiring at small managers.",
        ]])

        book.escalate(
            run_id, "MEDIUM", "Approved — needs sourcing",
            f"{firm} is now on the radar after you approved its Form D filing.",
            "The firm is in Target Companies but has no named people. A fund "
            "manager is only useful once you know who decides.",
            "Open the search link, find the team page, and add each person with "
            "their title copied verbatim.",
            url="https://duckduckgo.com/?q=" + quote_plus(f'"{firm}" team OR people OR professionals'),
        )

        out["queued"] += 1
        out["names"].append(firm)

        # Mark it so the next run does not queue it again. Append-only elsewhere,
        # but this cell is the agent's own bookkeeping, not a human's note.
        book.mark_opportunity(str(r.get("Opp ID")), QUEUED)

    return out
