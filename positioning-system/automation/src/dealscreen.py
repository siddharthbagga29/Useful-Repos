"""
The deal screen — the Opportunity Scout's rubric.

Source of truth: acquisition-research/01 answer 4 (ideal first acquisition),
answer 5 (price range) and section 7 (the ten IC rules). Nothing here is a
judgement of my own; it is those criteria made mechanical.

THE DESIGN PROBLEM: almost nothing on that list is knowable from public data.
Revenue mix, add-backs, site concentration and whether the owner will carry a
note are discovered in conversation, months in. A screen that demanded them
would score every target zero forever.

So the screen reports three separate things and never blends them:

  score       — of the criteria that ARE known, how many does this target pass
  known       — how much of the profile has been established at all
  disqualifiers — hard stops from the IC rules, which no score can outweigh
  caveats     — things to handle, which are NOT stops

That last split matters. Northern Kentucky needs KY credentials and an EBITDA
that has not yet had a market-rate GM deducted is not yet an adjusted EBITDA —
but neither is a reason to walk away from a firm nobody has spoken to. Only
three things are: a price above 6.0x, undocumented add-backs above 20%, and an
unresolved AFFF/PFAS history. Treating a caveat as a stop would have silently
removed all of Northern Kentucky, the plan's own second region.

A high score on two known fields is not a good target; it is an unexamined
one. Promotion to an Opportunity requires geography, no disqualifier, and
enough of the profile filled in that a human would recognise the firm. That
threshold is deliberately low, because the point of surfacing a target is to
start the work of knowing it - not to assert that it is a buy.
"""
from __future__ import annotations

# File 01 answer 4 and answer 5.
OHIO_COUNTIES = {"hamilton", "butler", "warren", "clermont"}
KY_COUNTIES = {"boone", "kenton", "campbell"}
REV_MIN, REV_MAX = 3_500_000, 8_000_000
EBITDA_MIN, EBITDA_MAX = 600_000, 1_500_000
ITM_SHARE_MIN = 50          # percent of revenue from inspection/service/monitoring
INSTALL_SHARE_MAX = 30
MULTIPLE_MAX = 6.0          # IC rule 1 — walk away above this
SITES_MIN = 400
PROMOTE_AT = 3              # criteria that must be KNOWN before surfacing


def _num(v):
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace("$", "").replace(",", "").replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def _county(row) -> str:
    return str(row.get("County") or "").strip().lower().replace(" county", "")


def screen(row: dict) -> dict:
    """Returns {score, max, known, criteria, disqualifiers, geography, promote}."""
    crit: list[tuple[str, bool, str]] = []    # (name, passed, evidence)
    unknown: list[str] = []
    dq: list[str] = []          # walk away (IC rules 1, 9, 10)
    caveats: list[str] = []     # handle, but keep looking

    county = _county(row)
    in_ohio = county in OHIO_COUNTIES
    in_ky = county in KY_COUNTIES
    if county:
        crit.append(("Geography", in_ohio or in_ky,
                     f"{row.get('County')} ({'Ohio first' if in_ohio else 'NKY — needs KY credentials' if in_ky else 'outside the first region'})"))
        if in_ky:
            caveats.append("Northern Kentucky: KY sprinkler licences are issued to "
                           "the firm and name a certificate holder (S-31). Ohio "
                           "counties come first, but this stays on the list.")
    else:
        unknown.append("County")

    rev = _num(row.get("Est Revenue Band"))
    if rev is not None:
        crit.append(("Revenue $3.5-8m", REV_MIN <= rev <= REV_MAX, f"${rev:,.0f}"))
    else:
        unknown.append("Revenue")

    eb = _num(row.get("Adj EBITDA"))
    if eb is not None:
        crit.append(("Adj EBITDA $0.6-1.5m", EBITDA_MIN <= eb <= EBITDA_MAX, f"${eb:,.0f}"))
        if str(row.get("Owner Replacement Deducted", "")).strip().lower() not in ("yes", "true", "y"):
            caveats.append("IC rule 2: a market-rate GM has not been confirmed as "
                           "deducted, so treat this as unadjusted EBITDA until the "
                           "P&L is seen.")
    else:
        unknown.append("Adj EBITDA")

    itm = _num(row.get("ITM Share %"))
    if itm is not None:
        crit.append((f"ITM share >={ITM_SHARE_MIN}%", itm >= ITM_SHARE_MIN, f"{itm:.0f}%"))
    else:
        unknown.append("ITM share")

    inst = _num(row.get("Install Share %"))
    if inst is not None:
        crit.append((f"New install <={INSTALL_SHARE_MAX}%", inst <= INSTALL_SHARE_MAX, f"{inst:.0f}%"))

    sites = _num(row.get("Active Sites"))
    if sites is not None:
        crit.append((f"Sites >={SITES_MIN}", sites >= SITES_MIN, f"{sites:.0f}"))

    conc = _num(row.get("Largest Customer %"))
    if conc is not None:
        crit.append(("No customer >10%", conc <= 10, f"largest {conc:.0f}%"))

    mult = _num(row.get("Asking Multiple"))
    if mult is not None:
        crit.append((f"Multiple <={MULTIPLE_MAX}x", mult <= MULTIPLE_MAX, f"{mult:.2f}x"))
        if mult > MULTIPLE_MAX:
            dq.append(f"IC rule 1: asking {mult:.2f}x exceeds the 6.0x ceiling. Walk away.")

    addbacks = _num(row.get("Add-backs % of EBITDA"))
    if addbacks is not None and addbacks > 20:
        documented = str(row.get("Add-backs Documented", "")).strip().lower() in ("yes", "true", "y")
        if not documented:
            dq.append(f"IC rule 9: add-backs are {addbacks:.0f}% of EBITDA and "
                      f"undocumented. Walk away.")

    if str(row.get("AFFF/PFAS History", "")).strip().lower() in ("yes", "unresolved", "y", "true"):
        dq.append("IC rule 10: unresolved AFFF/PFAS history. Walk away.")

    cert = str(row.get("Certificate No") or "").strip()
    if cert:
        crit.append(("Ohio-certified company (ORC 3737.65)", True, f"cert {cert}"))
    else:
        unknown.append("Ohio certification")

    passed = sum(1 for _, ok, _ in crit if ok)
    return {
        "score": passed,
        "max": len(crit),
        "known": len(crit),
        "unknown": unknown,
        "criteria": crit,
        "disqualifiers": dq,
        "caveats": caveats,
        "geography": "ohio" if in_ohio else "nky" if in_ky else "outside" if county else "unknown",
        # Promotion is about being worth a look, never about being a buy.
        "promote": (not dq) and (in_ohio or in_ky) and len(crit) >= PROMOTE_AT,
    }


def summary(row: dict, s: dict) -> str:
    bits = [f"{s['score']}/{s['max']} known criteria met"]
    if s["unknown"]:
        bits.append("not yet established: " + ", ".join(s["unknown"]))
    if s.get("caveats"):
        bits.append("handle: " + " ".join(s["caveats"]))
    if s["disqualifiers"]:
        bits.append("STOP — " + " ".join(s["disqualifiers"]))
    return ". ".join(bits)
