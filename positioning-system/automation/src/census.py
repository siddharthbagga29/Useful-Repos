"""
Census County Business Patterns. Deterministic, primary-source, reproducible.

Every figure written to the sheet carries the exact API URL that regenerates
it, so any number can be checked in one click. This is the backbone of the
Project 1 sector thesis.
"""
from __future__ import annotations
import json, time
from pathlib import Path
import requests


def _rotation_index(state_dir: str, length: int) -> int:
    f = Path(state_dir) / "naics_index.json"
    i = 0
    if f.exists():
        try:
            i = int(json.loads(f.read_text()).get("i", 0))
        except Exception:
            i = 0
    f.write_text(json.dumps({"i": (i + 1) % length}))
    return i % length


KEY_HELP = ("set census_api_key in config.json and activate it from the signup email "
            "(free: https://api.census.gov/data/key_signup.html)")


def url_for(year: str, naics: str, county_fips: str, key: str) -> str:
    return (f"https://api.census.gov/data/{year}/cbp"
            f"?get=ESTAB,EMP,NAICS2017_LABEL"
            f"&for=county:{county_fips}&in=state:39&NAICS2017={naics}"
            f"&key={key}")


def public_url(url: str, key: str) -> str:
    """The same query with the key stripped.

    The Source URL goes into a cell so any figure can be re-checked in one
    click, and the sheet gets shared. A Census key is cheap to replace but it
    is still a credential, and the URL without it names the query exactly —
    whoever opens it can use their own key. Reproducibility costs nothing here.
    """
    return url.replace(f"&key={key}", "") if key else url


def key_problem(r: requests.Response) -> str:
    """Census answers a bad key with a 302 to missing_key.html / invalid_key.html
    rather than an error status. Returns a description, or '' if the key is fine."""
    loc = r.headers.get("Location", "")
    if "missing_key" in loc:
        return "Census API key missing"
    if r.headers.get("X-DataWebAPI-KeyError") or "invalid_key" in loc:
        return "Census API key invalid or not yet activated"
    return ""


def pull(cfg: dict) -> dict:
    naics_list = cfg["naics_rotation"]
    naics = naics_list[_rotation_index(cfg["state_dir"], len(naics_list))]
    out = {"naics": naics, "label": "", "rows": [], "errors": [], "total": 0}
    key = str(cfg["census_api_key"]).strip()

    for c in cfg["counties"]:
        u = url_for(cfg["census_year"], naics, c["fips"], key)
        shown = public_url(u, key)
        try:
            r = requests.get(u, timeout=30, headers={"User-Agent": cfg["user_agent"]},
                             allow_redirects=False)
            problem = key_problem(r)
            if problem:
                out["errors"].append(f"{c['name']}: {problem} — {KEY_HELP}")
                continue
            if r.status_code != 200:
                out["errors"].append(f"{c['name']}: HTTP {r.status_code} — {shown}")
                continue
            data = r.json()
            if not data or len(data) < 2:
                out["errors"].append(f"{c['name']}: no rows — {shown}")
                continue
            head = data[0]
            ei, mi = head.index("ESTAB"), head.index("EMP")
            li = head.index("NAICS2017_LABEL") if "NAICS2017_LABEL" in head else -1
            estab = emp = 0
            for row in data[1:]:
                estab += int(row[ei] or 0)
                emp += int(row[mi] or 0)
                if li >= 0 and not out["label"]:
                    out["label"] = row[li]
            out["total"] += estab
            out["rows"].append({"county": c["name"], "estab": estab, "emp": emp, "url": shown})
        except Exception as e:
            out["errors"].append(f"{c['name']}: {e} — {shown}")
        time.sleep(0.4)   # be polite to a public API
    return out
