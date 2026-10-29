"""
SEC EDGAR Form D — new private fund closes.

Why this matters more than a job board: a manager that just closed a vehicle
has capital it must deploy and frequently adds junior headcount, and those
seats at two-to-six person firms are never posted anywhere. This is the closest
public proxy for a PitchBook fund-close screen, and it is free.
"""
from __future__ import annotations
import datetime as dt
import requests

EFTS = "https://efts.sec.gov/LATEST/search-index"


def recent_form_d(cfg: dict, states=("OH", "KY", "IN"), days: int = 7) -> dict:
    """Returns {'filings': [...], 'errors': [...]}.

    Uses EDGAR's full-text search JSON endpoint. Any non-200 or shape change is
    reported rather than silently returning nothing — a scraper that fails
    quietly is worse than one that fails loudly.
    """
    out = {"filings": [], "errors": []}
    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    headers = {"User-Agent": cfg["user_agent"], "Accept": "application/json"}

    seen = set()
    for st in states:
        # `locationCodes` (plural) filters on principal place of business. The
        # singular `locationCode` is silently ignored and returns every Form D
        # in the country, so each hit is re-checked against biz_locations below.
        url = (f"{EFTS}?q=&forms=D"
               f"&dateRange=custom&startdt={since}&enddt={dt.date.today().isoformat()}"
               f"&locationCodes={st}")
        try:
            r = requests.get(url, timeout=30, headers=headers)
            if r.status_code != 200:
                out["errors"].append(f"{st}: HTTP {r.status_code} — {url}")
                continue
            hits = (r.json().get("hits", {}) or {}).get("hits", [])
            for h in hits[:25]:
                src = h.get("_source", {})
                names = src.get("display_names") or []
                locs = src.get("biz_locations") or []
                if not any(l.strip().endswith(f", {st}") for l in locs):
                    continue
                adsh = (h.get("_id") or "").split(":")[0].replace("-", "")
                if adsh in seen:          # one hit per document, not per filing
                    continue
                seen.add(adsh)
                cik = (src.get("ciks") or [""])[0]
                link = (f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{adsh}/"
                        if cik and adsh else "https://www.sec.gov/edgar/search/")
                out["filings"].append({
                    "name": names[0].split("  (CIK")[0].strip() if names else "(name not in index)",
                    "state": st,
                    "location": next(l for l in locs if l.strip().endswith(f", {st}")),
                    "filed": src.get("file_date", ""),
                    "url": link,
                })
        except Exception as e:
            out["errors"].append(f"{st}: {e} — {url}")
    return out
