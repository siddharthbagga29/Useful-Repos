"""Reproducible industry scorecard. Run: python3 data/score_industries.py"""
import csv, pathlib
here = pathlib.Path(__file__).parent
crit = ["recurring","margins","fragmentation","valuation","capex","simplicity","management","financing","geography","concentration","lifestyle"]
base = dict(zip(crit,[12,12,12,10,8,10,10,8,7,5,6]))
founder = dict(zip(crit,[12,12,9,10,10,12,12,12,2,5,4]))
assert sum(base.values())==100 and sum(founder.values())==100
rows=list(csv.DictReader(open(here/"industry_scores.csv")))
out=[]
for r in rows:
    b=sum(float(r[c])*base[c] for c in crit)/100
    f=sum(float(r[c])*founder[c] for c in crit)/100
    pen=sum(float(v) for k,v in r.items() if k.startswith("pen_"))
    out.append((r["industry"],round(b,2),round(f,2),pen,round(f-0.1*pen,2),r["evidence_confidence"]))
out.sort(key=lambda x:-x[4])
print(f"{'Industry':45s} Base  Founder Pen  RiskAdj  Confidence")
for i,o in enumerate(out,1):
    print(f"{i:2d}. {o[0]:41s} {o[1]:5.2f} {o[2]:6.2f} {o[3]:4.0f} {o[4]:7.2f}  {o[5]}")

# ---- Gates: evidence confidence >= Medium; not real-estate-collateral dependent
gate_fail={"Self-storage":"Capital gate: real-estate equity","Car washes (express)":"Capital gate: real-estate & equipment"}
print("\nEligible after gates (confidence >= Medium and capital gate):")
ok=[o for o in out if o[5] in ("Medium","Medium-High") and o[0] not in gate_fail]
for i,o in enumerate(ok,1): print(f"{i}. {o[0]} {o[4]}")
# ---- Cincinnati overlay: fire vs pest
ov=list(csv.DictReader(open(here/"cincinnati_overlay.csv")))
fo=sum(float(r["weight"])*float(r["fire"]) for r in ov)/100
po=sum(float(r["weight"])*float(r["pest"]) for r in ov)/100
fr=[o for o in out if o[0].startswith("Fire")][0][4]; pr=[o for o in out if o[0].startswith("Pest")][0][4]
print(f"\nOverlay: fire {fo:.2f} pest {po:.2f}")
for x in (0,0.1,0.2,0.3):
    print(f" overlay weight {x:.0%}: fire {(1-x)*fr+x*fo:.2f} pest {(1-x)*pr+x*po:.2f}")
be=(pr-fr)/((fo-fr)-(po-pr))
print(f" break-even overlay weight: {be:.1%}")
