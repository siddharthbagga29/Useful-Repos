"""Builds Wholesale_Deal_Analyzer_v2.xlsx — the fixed analyzer plus a live Monte Carlo sheet.

    python build_analyzer.py            # writes Wholesale_Deal_Analyzer_v2.xlsx next to this file

Fixes against v1:
  1. The end buyer's profit now includes selling, closing and holding costs (v1 left them out, so
     a flipper's margin was overstated by roughly ten points of ARV).
  2. The rehab contingency the notes recommend (15%) is actually applied to MAO and to the buyer.
  3. One minimum-buyer-margin input drives both the guidance and the GO signal (v1 said ~20% in the
     note but tested 15% in the formula).
  4. Return on cash divides by all cash at risk — EMD plus marketing — not EMD alone.
  5. An expected-profit line weights the fee by the chance the assignment actually closes and
     counts the EMD you lose when it doesn't.
"""

from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

MONEY = '$#,##0;($#,##0);-'
PCT = "0.0%"
YELLOW = PatternFill("solid", fgColor="FFF2CC")
GREY = PatternFill("solid", fgColor="EDEDED")
BOLD = Font(bold=True)
TITLE = Font(bold=True, size=14)
HEAD = Font(bold=True, color="1F4E78")
NOTE = Font(italic=True, color="595959", size=9)
THIN = Border(bottom=Side(style="thin", color="BFBFBF"))
TRIALS = 1000

wb = Workbook()
ws = wb.active
ws.title = "Deal Analyzer"
ws.column_dimensions["A"].width = 44
ws.column_dimensions["B"].width = 18
ws.column_dimensions["C"].width = 64

rows: list[tuple] = []


def put(r: int, label: str, value=None, fmt: str | None = None, note: str = "", *, inp=False, bold=False) -> None:
    ws.cell(r, 1, label).font = BOLD if bold else Font()
    if value is not None:
        c = ws.cell(r, 2, value)
        if fmt:
            c.number_format = fmt
        if inp:
            c.fill = YELLOW
        if bold:
            c.font = BOLD
    if note:
        ws.cell(r, 3, note).font = NOTE


def head(r: int, text: str) -> None:
    ws.cell(r, 1, text).font = HEAD
    for col in range(1, 4):
        ws.cell(r, col).border = THIN


ws["A1"] = "WHOLESALE DEAL ANALYZER v2 — Ohio (edit yellow cells)"
ws["A1"].font = TITLE
ws["A2"] = "Monte Carlo sheet re-runs 1,000 trials every time you press F9 (Cmd+= on Mac)."
ws["A2"].font = NOTE

head(3, "STEP 1 — INPUTS")
put(4, "ARV (After-Repair Value)", 160000, MONEY, "What it sells for fully renovated — pull comps", inp=True)
put(5, "Estimated rehab cost", 40000, MONEY, "Contractor walk-through, before contingency", inp=True)
put(6, "Rehab contingency %", 0.15, PCT, "Buffer for overruns — applied below (v1 recommended it but never used it)", inp=True)
put(7, "Rule of thumb % (0.70 standard)", 0.70, PCT, "0.70 tight markets, 0.65 slow ones", inp=True)
put(8, "Your target assignment fee", 10000, MONEY, "Your profit — $5K–15K typical in OH", inp=True)
put(9, "Earnest money deposit (EMD)", 500, MONEY, "YOUR cash at risk — $100–1,000 typical", inp=True)
put(10, "Marketing cost to find this deal", 800, MONEY, "Mail / skip-trace / gas amortized per deal", inp=True)
put(11, "Buyer's selling + closing + holding costs", 0.10, PCT, "% of ARV: agent ~5–6%, closing ~2%, holding/financing ~2–3%", inp=True)
put(12, "Minimum buyer margin for a GO", 0.20, PCT, "Flippers want ~20%+ of ARV after ALL costs", inp=True)
put(13, "Chance the assignment closes", 0.70, PCT, "Your own close rate on contracted deals", inp=True)
put(14, "EMD lost if a deal falls through", 0.50, PCT, "0% with a solid inspection/assignment contingency; 100% if you're in breach", inp=True)

head(15, "STEP 2 — MAXIMUM ALLOWABLE OFFER (MAO)")
put(16, "Rehab incl. contingency", "=B5*(1+B6)", MONEY, "What the buyer will actually spend")
put(17, "ARV x rule %", "=B4*B7", MONEY, "The 70% ceiling on total investment")
put(18, "Less: rehab incl. contingency", "=-B16", MONEY)
put(19, "Less: your assignment fee", "=-B8", MONEY)
put(20, "MAO — max you offer the seller", "=MAX(0,B17+B18+B19)", MONEY, "Offer at or BELOW this. This is the whole game.", bold=True)

head(22, "STEP 3 — YOUR NUMBERS")
put(23, "Actual price you contract with seller", 60000, MONEY, "Aim at/below MAO in B20", inp=True)
put(24, "Price you assign to end buyer", "=B23+B8", MONEY, "Seller price + your fee")
put(25, "Your gross profit (assignment fee)", "=B8", MONEY)
put(26, "Your net profit if it closes", "=B8-B10", MONEY, "Fee minus marketing")
put(27, "Cash you put at risk", "=B9+B10", MONEY, "EMD + marketing (v1 counted EMD only)")
put(28, "Return on cash at risk", "=IF(B27=0,0,B26/B27)", PCT, "Net profit / (EMD + marketing)")
put(29, "Expected profit (weighted by close rate)", "=B13*B26-(1-B13)*(B10+B9*B14)", MONEY, "Closes: net profit. Falls through: lose marketing + the EMD share in B14", bold=True)

head(31, "STEP 4 — DOES IT WORK FOR YOUR END BUYER?")
ws["A32"] = "A cash buyer/flipper only says yes if THEY still profit after every cost."
ws["A32"].font = NOTE
put(33, "Buyer's all-in (assign + rehab + costs)", "=B24+B16+B4*B11", MONEY, "v1 omitted selling/closing/holding costs")
put(34, "Buyer's projected profit", "=B4-B33", MONEY, "ARV minus their true all-in")
put(35, "Buyer's margin vs ARV", "=IF(B4=0,0,B34/B4)", PCT, "Compared with the minimum in B12")

head(37, "STEP 5 — GO / NO-GO SIGNAL")
put(
    38,
    "Deal signal",
    '=IF(B23>B20,"NO-GO: offer above MAO",IF(B35<B12,"WEAK: buyer margin below "&TEXT(B12,"0%"),IF(B29<=0,"NO-GO: expected profit ≤ 0","GO")))',
    None,
    "GO needs: offer ≤ MAO, buyer margin ≥ B12, expected profit > 0",
    bold=True,
)
put(39, "Monte Carlo: chance the deal works", "='Monte Carlo'!F5", PCT, "Share of 1,000 simulated outcomes where it closes at a profit", bold=True)

head(41, "OHIO MEDIAN PRICE REFERENCE (2026) — verify before relying on these")
put(42, "Cleveland median", "~$135,000")
put(43, "Dayton median", "~$130,000")
put(44, "Columbus median", "~$290,000")
put(45, "Cincinnati", "varies widely by neighborhood — pull local comps")
put(46, "Note", "NE Ohio (Cuyahoga, Lake) has deepest distressed pipeline")
ws["A48"] = (
    "Sources (from v1): ATTOM Q3 2025 flip data; realestateskills.com OH 2026 guide; ORC 5301.95 "
    "(SB155, eff. 3/2/2026). Figures are estimates — verify locally. Not legal or investment advice."
)
ws["A48"].font = NOTE

pct_dv = DataValidation(type="decimal", operator="between", formula1="0", formula2="1", showErrorMessage=True, error="Enter a percentage between 0% and 100%")
ws.add_data_validation(pct_dv)
for ref in ("B6", "B7", "B11", "B12", "B13", "B14"):
    pct_dv.add(ref)
pos_dv = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", showErrorMessage=True, error="Must be zero or more")
ws.add_data_validation(pos_dv)
for ref in ("B4", "B5", "B8", "B9", "B10", "B23"):
    pos_dv.add(ref)

# --------------------------------------------------------------- Monte Carlo sheet
mc = wb.create_sheet("Monte Carlo")
widths = {"A": 8, "B": 14, "C": 14, "D": 14, "E": 12, "F": 12, "G": 14, "H": 4, "I": 40, "J": 14}
for k, v in widths.items():
    mc.column_dimensions[k].width = v
mc["A1"] = "MONTE CARLO — 1,000 live trials (press F9 to re-run)"
mc["A1"].font = TITLE
mc["A2"] = "Each trial draws an ARV, a rehab overrun and whether the deal closes, then recomputes the buyer's margin and your profit."
mc["A2"].font = NOTE

# assumptions
assumptions = [
    (3, "ARV uncertainty (std dev)", 0.08, "Comps are rarely tighter than ±8%"),
    (4, "Rehab overrun: mean", 0.10, "Average overrun on the base estimate, before contingency"),
    (5, "Rehab overrun: std dev", 0.15, "Spread of overruns"),
    (6, "Other fall-through risk", "='Deal Analyzer'!B13", "From the analyzer's close rate"),
]
mc["I3"] = "ASSUMPTIONS (edit yellow)"
mc["I3"].font = HEAD
for r, label, val, note in assumptions:
    mc.cell(r + 1, 9, label)
    c = mc.cell(r + 1, 10, val)
    c.number_format = PCT
    if not str(val).startswith("="):
        c.fill = YELLOW
    mc.cell(r + 1, 11, note).font = NOTE

# summary block (rows 3–9, columns A–G)
mc["A3"] = "RESULTS"
mc["A3"].font = HEAD
summary = [
    ("A4", "Trials", "B4", f"=COUNT(B{12}:B{11 + TRIALS})", "0"),
    ("A5", "Deal works (closes at a profit)", "F5", f"=COUNTIF(G12:G{11 + TRIALS},\">0\")/B4", PCT),
    ("A6", "Buyer margin ≥ minimum", "F6", f"=COUNTIF(F12:F{11 + TRIALS},TRUE)/B4", PCT),
    ("A7", "Average profit per deal", "F7", f"=AVERAGE(G12:G{11 + TRIALS})", MONEY),
    ("A8", "Chance you lose money", "F8", f"=COUNTIF(G12:G{11 + TRIALS},\"<0\")/B4", PCT),
    ("A9", "Buyer margin: 5th / median / 95th pct", "D9", f"=PERCENTILE(E12:E{11 + TRIALS},0.05)", PCT),
]
for lab_ref, label, val_ref, formula, fmt in summary:
    mc[lab_ref] = label
    mc[val_ref] = formula
    mc[val_ref].number_format = fmt
    mc[val_ref].font = BOLD
mc["E9"] = f"=MEDIAN(E12:E{11 + TRIALS})"
mc["F9"] = f"=PERCENTILE(E12:E{11 + TRIALS},0.95)"
for ref in ("E9", "F9"):
    mc[ref].number_format = PCT
    mc[ref].font = BOLD

hdr = ["Trial", "ARV draw", "Rehab draw", "Buyer all-in", "Buyer margin", "Buyer bites", "Your profit"]
for i, h in enumerate(hdr, start=1):
    c = mc.cell(11, i, h)
    c.font = BOLD
    c.fill = GREY
DA = "'Deal Analyzer'!"
for t in range(TRIALS):
    r = 12 + t
    mc.cell(r, 1, t + 1)
    mc.cell(r, 2, f"=MAX(0,{DA}$B$4*(1+NORM.INV(RAND(),0,$J$4)))").number_format = MONEY
    mc.cell(r, 3, f"={DA}$B$5*MAX(0.9,1+NORM.INV(RAND(),$J$5,$J$6))").number_format = MONEY
    mc.cell(r, 4, f"={DA}$B$24+C{r}+B{r}*{DA}$B$11").number_format = MONEY
    mc.cell(r, 5, f"=IF(B{r}=0,0,(B{r}-D{r})/B{r})").number_format = PCT
    mc.cell(r, 6, f"=E{r}>={DA}$B$12")
    mc.cell(r, 7, f"=IF(AND(F{r},RAND()<$J$7),{DA}$B$8-{DA}$B$10,-({DA}$B$10+{DA}$B$9*{DA}$B$14))").number_format = MONEY
mc.freeze_panes = "A12"

for sheet in (ws, mc):
    for row in sheet.iter_rows():
        for c in row:
            c.alignment = Alignment(vertical="center", wrap_text=c.column == 3 and sheet is ws)

out = Path(__file__).with_name("Wholesale_Deal_Analyzer_v2.xlsx")
wb.save(out)
print(f"wrote {out}")
