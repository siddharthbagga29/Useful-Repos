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


def url_for(year: str, naics: str, county_fips: str) -> str:
    return (f"https://api.census.gov/data/{year}/cbp"
            f"?get=ESTAB,EMP,NAICS2017_LABEL"
            f"&for=county:{county_fips}&in=state:39&NAICS2017={naics}")


def pull(cfg: dict) -> dict:
    naics_list = cfg["naics_rotation"]
    naics = naics_list[_rotation_index(cfg["state_dir"], len(naics_list))]
    out = {"naics": naics, "label": "", "rows": [], "errors": [], "total": 0}

    for c in cfg["counties"]:
        u = url_for(cfg["census_year"], naics, c["fips"])
        try:
            r = requests.get(u, timeout=30, headers={"User-Agent": cfg["user_agent"]})
            if r.status_code != 200:
                out["errors"].append(f"{c['name']}: HTTP {r.status_code} — {u}")
                continue
            data = r.json()
            if not data or len(data) < 2:
                out["errors"].append(f"{c['name']}: no rows — {u}")
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
            out["rows"].append({"county": c["name"], "estab": estab, "emp": emp, "url": u})
        except Exception as e:
            out["errors"].append(f"{c['name']}: {e} — {u}")
        time.sleep(0.4)   # be polite to a public API
    return out
