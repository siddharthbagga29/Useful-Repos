"""
Opportunity Scout — weekly promotion of screened targets.

Runs weekly rather than daily on purpose. A target found on Monday is worth
more on Sunday, because four days of research have been added to it: a
certificate number, an ITM share, a conversation. Surfacing it the moment it
appears would mean presenting a name and nothing else, and a decision asked on
no information trains the owner to stop reading.

So the week accumulates and Sunday promotes. Only targets that clear the screen
in dealscreen.py are promoted, each carrying what is known, what is not, and
anything to handle. Every promoted row starts with Authorization Cleared = No
and Counsel Reviewed = No, because nothing here is actionable as employment or
as a deal until counsel says so.
"""
from __future__ import annotations
import datetime as dt

from . import dealscreen


def _existing_target_ids(opps: list[dict]) -> set[str]:
    out = set()
    for o in opps:
        src = str(o.get("Notes") or "")
        for part in src.split("|"):
            part = part.strip()
            if part.startswith("TARGET:"):
                out.add(part[7:].strip())
    return out


def promote(book, run_id: str, limit: int = 8) -> dict:
    """Screens Deal Pipeline and writes the passers into Opportunities."""
    out = {"screened": 0, "promoted": 0, "blocked": 0, "names": [], "errors": []}
    try:
        targets = book.read("Deal Pipeline")
        opps = book.read("Opportunities")
    except Exception as e:
        out["errors"].append(str(e)[:200])
        return out

    already = _existing_target_ids(opps)
    today = dt.date.today().isoformat()

    for t in targets:
        tid = str(t.get("Target ID") or "").strip()
        name = str(t.get("Name") or "").strip()
        if not tid or not name:
            continue
        out["screened"] += 1
        if tid in already:
            continue

        s = dealscreen.screen(t)
        if s["disqualifiers"]:
            out["blocked"] += 1
            # A walk-away is a finding, not silence: record it on the target.
            book.append("Agent Log", [[
                run_id, dt.datetime.now().isoformat(timespec="seconds"), "scout",
                "target disqualified", "BLOCKED", 1, t.get("Source URL", ""), 0,
                f"{name} — " + " ".join(s["disqualifiers"])[:260],
            ]])
            continue
        if not s["promote"]:
            continue
        if out["promoted"] >= limit:
            break

        why = (f"Fire & life safety ITM target in {t.get('County')}. "
               f"{dealscreen.summary(t, s)}")
        next_action = ("Confirm the certificate on the Ohio SFM record, then "
                       "establish revenue mix and whether the owner would carry "
                       "a note. Nothing is actionable until counsel clears it.")

        book.append("Opportunities", [[
            f"OPP-{run_id}-T{out['promoted'] + 1}", "Acquisition target",
            f"{name} ({t.get('City') or t.get('County')})", "", name,
            "Identified", "", why, next_action, today,
            "No", "No", "OPEN",
            f"TARGET:{tid} | {t.get('Source URL', '')}",
        ]])
        out["promoted"] += 1
        out["names"].append(name)

    return out
