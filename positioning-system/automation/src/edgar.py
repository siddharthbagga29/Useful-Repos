"""
SEC EDGAR Form D — new private fund closes.

Why this matters more than a job board: a manager that just closed a vehicle
has capital it must deploy and frequently adds junior headcount, and those
seats at two-to-six person firms are never posted anywhere. This is the closest
public proxy for a PitchBook fund-close screen, and it is free.

VERIFICATION RULE: this module does not trust its own query. Earlier it passed
locationCode to the full-text endpoint and then stamped every hit OH/KY/IN on
the strength of having asked for them. If that parameter is ignored — or
renamed, which search APIs do without notice — the result is a sheet full of
filings from anywhere in the country wearing an Ohio label, each one looking
exactly as credible as a real one. Nothing downstream could catch it.

So the state is read back from each hit and checked. A hit whose location
cannot be established from the response is dropped, never guessed. If no hit
in a whole run carries a location field, the module reports that the response
shape changed and returns no filings at all, because silently returning
plausible rows is the one outcome worth preventing.
"""
from __future__ import annotations
import datetime as dt
import requests

FTS = "https://efts.sec.gov/LATEST/search-index"
SEARCH_UI = "https://www.sec.gov/edgar/search/#/forms=D"

# Key names the index has been seen to use for the filer's location. Tried in
# order; the first present on a hit wins.
_STATE_KEYS = ("biz_states", "biz_state", "inc_states", "inc_state", "state", "states")


def _state_of(src: dict) -> str:
    """The filer's state as the response reports it, or '' if it does not."""
    for k in _STATE_KEYS:
        v = src.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip().upper()
        if isinstance(v, (list, tuple)) and v:
            first = str(v[0]).strip().upper()
            if first:
                return first
    return ""


def recent_form_d(cfg: dict, states=("OH", "KY", "IN"), days: int = 7) -> dict:
    """Returns {'filings': [...], 'errors': [...], 'dropped': int, 'shape_ok': bool}.

    Every filing returned carries a state read from the response, not from the
    query. 'dropped' counts hits discarded for being outside the target states.
    """
    out = {"filings": [], "errors": [], "dropped": 0, "shape_ok": False}
    today = dt.date.today()
    since = (today - dt.timedelta(days=days)).isoformat()
    headers = {"User-Agent": cfg["user_agent"], "Accept": "application/json"}
    wanted = {s.upper() for s in states}

    located = unlocated = 0
    seen: set[tuple[str, str]] = set()

    for st in sorted(wanted):
        url = (f"{FTS}?q=%22%22&forms=D&dateRange=custom"
               f"&startdt={since}&enddt={today.isoformat()}&locationCode={st}")
        try:
            r = requests.get(url, timeout=30, headers=headers)
            if r.status_code != 200:
                out["errors"].append(f"{st}: HTTP {r.status_code} — {url}")
                continue
            hits = (r.json().get("hits", {}) or {}).get("hits", [])
        except Exception as e:
            out["errors"].append(f"{st}: {e} — {url}")
            continue

        for h in hits[:40]:
            src = h.get("_source", {}) or {}
            found = _state_of(src)
            if not found:
                unlocated += 1
                continue
            located += 1
            if found not in wanted:
                out["dropped"] += 1
                continue

            names = src.get("display_names") or []
            name = names[0] if names else "(name not in index)"
            adsh = (h.get("_id") or "").split(":")[0].replace("-", "")
            cik = str((src.get("ciks") or [""])[0])
            key = (name, adsh)
            if key in seen:
                continue
            seen.add(key)

            link = (f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{adsh}/"
                    if cik and adsh else SEARCH_UI)
            out["filings"].append({
                "name": name,
                "state": found,          # read back, not assumed
                "filed": src.get("file_date", ""),
                "url": link,
            })

    if located == 0 and unlocated > 0:
        # The query returned rows but none carried a location. Asserting a state
        # here is exactly the failure this module exists to avoid.
        out["filings"] = []
        out["errors"].append(
            f"EDGAR response carried no location field on any of {unlocated} hits "
            f"(tried {', '.join(_STATE_KEYS)}). Form D screening returned nothing "
            f"rather than label filings with an unverified state. Check the "
            f"response shape at {SEARCH_UI}"
        )
    else:
        out["shape_ok"] = located > 0
        if unlocated:
            out["errors"].append(
                f"{unlocated} hit(s) had no location field and were dropped.")
    return out
