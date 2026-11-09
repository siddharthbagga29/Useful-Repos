"""Builds 06_FIRST_ACQUISITION_MODEL.xlsx with live formulas.

Run from the project folder:
    python3 model/build_model.py
then recalculate (LibreOffice) so cached values exist for viewers.

Every hardcoded number is an INPUT (blue text) with a basis note beside it.
Nothing here is a verified figure for any real target company.
"""
import csv
import pathlib

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "06_FIRST_ACQUISITION_MODEL.xlsx"

F = "Arial"
BLUE = Font(name=F, color="0000FF", size=10)
BLACK = Font(name=F, color="000000", size=10)
GREEN = Font(name=F, color="008000", size=10)
BOLD = Font(name=F, bold=True, size=10)
TITLE = Font(name=F, bold=True, size=14, color="1F3864")
HDR = Font(name=F, bold=True, size=10, color="FFFFFF")
NOTE = Font(name=F, italic=True, size=9, color="595959")
HDR_FILL = PatternFill("solid", fgColor="1F3864")
SEC_FILL = PatternFill("solid", fgColor="D9E1F2")
KEY_FILL = PatternFill("solid", fgColor="FFFF00")
OUT_FILL = PatternFill("solid", fgColor="E2EFDA")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)

USD = '$#,##0;($#,##0);"-"'
PCT = '0.0%;(0.0%);"-"'
MULT = '0.00"x";(0.00"x");"-"'
NUM = '#,##0;(#,##0);"-"'

SCEN = ["Conservative", "Base", "Aggressive", "Downside"]
SCOL = {"Conservative": "B", "Base": "C", "Aggressive": "D", "Downside": "E"}

wb = Workbook()


def style_range(ws, rng, font=None, fill=None, fmt=None, border=None, align=None):
    for row in ws[rng]:
        for c in row:
            if font:
                c.font = font
            if fill:
                c.fill = fill
            if fmt:
                c.number_format = fmt
            if border:
                c.border = border
            if align:
                c.alignment = align


def header_row(ws, row, labels, start_col=1):
    for i, lab in enumerate(labels):
        c = ws.cell(row=row, column=start_col + i, value=lab)
        c.font = HDR
        c.fill = HDR_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def section(ws, row, text, ncols):
    ws.cell(row=row, column=1, value=text).font = BOLD
    for col in range(1, ncols + 1):
        ws.cell(row=row, column=col).fill = SEC_FILL


# ---------------------------------------------------------------- README
ws = wb.active
ws.title = "README"
ws["A1"] = "Bagga Holdings — First Acquisition Model (Fire & Life Safety ITM)"
ws["A1"].font = TITLE
lines = [
    ("Purpose", "Screen a first acquisition: sources & uses, debt service, DSCR, free cash flow, exit, IRR, MOIC, sponsor/operator/investor economics, and downside sensitivity."),
    ("Status", "ILLUSTRATIVE. No figure in the scenario columns is a real company's result. Replace inputs with a target's CIM / QoE data before any use."),
    ("How to use", "1) Edit only blue cells on 'Inputs' (yellow = key levers). 2) Read 'Summary'. 3) Stress on 'Sensitivity'. 4) For a real target, fill the 'Deal_Template' column."),
    ("Colour code", "Blue text = hardcoded input. Black = formula. Green = link to another sheet. Yellow fill = key assumption to diligence first. Green fill = key output."),
    ("Financing reality", "SBA 7(a)/504 is NOT assumed: since 1-Mar-2026 SBA requires 100% of direct and indirect owners to be U.S. citizens/nationals (Policy Notice 5000-876441; incorporated in SOP 50 10 8, carried into SOP 50 10 8.1 effective 1-Oct-2026). See 08_FINANCING_AND_IMMIGRATION_GATES.md."),
    ("Tax simplification", "Cash taxes modelled at entity level for conservatism. Most small targets are pass-through (LLC/S-corp); real tax depends on structure — CPA review required."),
    ("IRR method", "No interim distributions are modelled (cash accumulates), so IRR = MOIC^(1/hold) - 1 over a 5-year hold. Real IRR depends on timing of distributions."),
    ("DSCR definition", "(Adj. EBITDA - sponsor fee - maintenance capex - cash taxes) / (senior + seller interest + scheduled principal). Lenders define DSCR differently — get each lender's definition in writing."),
    ("Promote terms", "Default promote tiers (10% / 15% / 20%) are deliberately BELOW survey medians for established independent sponsors (Citrin Cooperman 2025: 64% reach >=25% max carry) because a first-time sponsor has no track record. Source register: 13_SOURCE_REGISTER.md."),
    ("Rebuild", "python3 model/build_model.py  (then recalculate in Excel/LibreOffice)."),
]
for i, (k, v) in enumerate(lines, start=3):
    ws.cell(row=i, column=1, value=k).font = BOLD
    c = ws.cell(row=i, column=2, value=v)
    c.font = BLACK
    c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[i].height = 42
ws.column_dimensions["A"].width = 20
ws.column_dimensions["B"].width = 120

# ---------------------------------------------------------------- INPUTS
wi = wb.create_sheet("Inputs")
wi["A1"] = "Inputs — edit blue cells only"
wi["A1"].font = TITLE
wi["A2"] = "All $ in US dollars. Scenario columns are illustrative targets, not real companies."
wi["A2"].font = NOTE
header_row(wi, 4, ["Input", "Conservative", "Base", "Aggressive", "Downside", "Basis / source (A = assumption to verify)"])

# (key, label, values[4], fmt, note, key_flag)
INPUTS = [
    ("__sec", "DEAL"),
    ("rev", "LTM revenue ($)", [4_700_000, 5_550_000, 7_500_000, 5_550_000], USD, "A: target profile band in 03_TOP_INDUSTRY_DEEP_DIVE.md §8", False),
    ("rep_ebitda", "Reported EBITDA before owner adjustments ($)", [760_000, 1_010_000, 1_510_000, 1_010_000], USD, "A: from seller P&L; must be tied to tax returns and bank statements by QoE", True),
    ("addbacks", "Owner add-backs: owner salary, perks, personal expenses ($)", [165_000, 165_000, 190_000, 165_000], USD, "A: each add-back needs documentary support; reject 'one-time' items that recur", True),
    ("replace", "Replacement cost of owner's role: GM/operator fully loaded ($, negative)", [-175_000, -175_000, -200_000, -175_000], USD, "A: market salary + bonus + benefits for operating partner; the most-skipped adjustment", True),
    ("onetime", "Verified one-time items ($)", [0, 0, 0, 0], USD, "A: only with invoices / QoE support", False),
    ("entry_mult", "Entry multiple (x Adjusted EBITDA)", [4.75, 5.25, 6.00, 5.25], MULT, "Security Sales roll-up study: small fire & life-safety firms 4.9x-11.7x EBITDA (Feb-2018 to May-2022); broker indications 5-7x. See 13_SOURCE_REGISTER S-21", True),
    ("bs_cash", "Cash left on balance sheet at close ($)", [150_000, 200_000, 300_000, 200_000], USD, "A: minimum operating cash; payroll is weekly/bi-weekly for technicians", False),
    ("qoe", "Quality of earnings & diligence ($)", [45_000, 55_000, 75_000, 55_000], USD, "A: obtain 3 quotes from QoE providers", False),
    ("legal", "Legal, closing & insurance review ($)", [90_000, 110_000, 150_000, 110_000], USD, "A: M&A counsel quote", False),
    ("lender_fee", "Lender fee (% of senior debt)", [0.015, 0.015, 0.015, 0.015], PCT, "A: verify with lender term sheet", False),
    ("close_fee", "Sponsor closing fee (% of EV)", [0.02, 0.02, 0.02, 0.02], PCT, "Citrin Cooperman 2025 Independent Sponsor Report (via summaries): 82% charge a closing fee; 56% of those use 2%", False),
    ("fee_roll", "Share of closing fee rolled into equity", [0.5, 0.5, 0.5, 0.5], PCT, "A: capital providers commonly require part of the fee to be reinvested", False),
    ("__sec", "FINANCING (non-SBA)"),
    ("sr_lev", "Senior term debt (x Adjusted EBITDA)", [1.75, 2.25, 2.75, 2.25], MULT, "A: conventional bank cash-flow loan; lender appetite for a first-time sponsor must be tested", True),
    ("sr_rate", "Senior interest rate", [0.09, 0.0875, 0.085, 0.0875], PCT, "A: floating-rate assumption; get term sheets", False),
    ("sr_amort", "Senior amortisation (years)", [7, 7, 7, 7], NUM, "A", False),
    ("sweep", "Excess cash sweep to senior (%)", [0.5, 0.5, 0.5, 0.5], PCT, "A: common in bank credit agreements", False),
    ("sn_pct", "Seller note (% of EV)", [0.15, 0.175, 0.15, 0.175], PCT, "A: negotiated; subordinated to senior", True),
    ("sn_rate", "Seller note interest rate", [0.06, 0.06, 0.06, 0.06], PCT, "A", False),
    ("sn_io", "Seller note interest-only years", [2, 2, 2, 2], NUM, "A: negotiate IO to protect early DSCR", False),
    ("sn_term", "Seller note term (years)", [8, 7, 7, 7], NUM, "A: balance repaid at exit if outstanding", False),
    ("roll_pct", "Seller rollover equity (% of EV)", [0.15, 0.10, 0.10, 0.10], PCT, "A: keeps seller aligned through transition", False),
    ("op_inv", "Operating partner cash co-invest ($)", [50_000, 75_000, 100_000, 75_000], USD, "A: 'skin in the game' test for the operator", False),
    ("__sec", "OPERATIONS"),
    ("growth", "Revenue growth per year", [0.03, 0.06, 0.09, 0.06], PCT, "A: IBISWorld fire & security installation contractors grew at 3.2% CAGR (5 yrs to 2025); upside requires pricing + deficiency-repair conversion", True),
    ("margin_step", "EBITDA margin change per year (fraction, 0.005 = +50 bps)", [0.0, 0.005, 0.0075, 0.005], '0.00%', "A: from pricing discipline and repair-conversion; APi reported 13.2% company-wide adj. EBITDA margin in 2025 (mix includes projects)", True),
    ("shock", "Permanent EBITDA shock from Year 2 (negative = decline)", [0.0, 0.0, 0.0, -0.25], PCT, "Downside: loss of license holder / key techs / largest contracts", True),
    ("mcapex", "Maintenance capex (% of revenue)", [0.02, 0.02, 0.02, 0.02], PCT, "A: service vans, test gauges, software; confirm from fixed-asset register", False),
    ("gcapex", "Growth capex per year ($)", [0, 50_000, 100_000, 50_000], USD, "A: new vans/techs to add inspection routes", False),
    ("nwc", "Net working capital (% of incremental revenue)", [0.15, 0.15, 0.15, 0.15], PCT, "A: verify DSO on inspection & repair invoices", False),
    ("tax", "Cash tax rate (entity-level simplification)", [0.26, 0.26, 0.26, 0.26], PCT, "A: CPA to confirm; Ohio levies CAT on gross receipts, not corporate income tax", False),
    ("mfee", "Sponsor management fee (% of EBITDA)", [0.04, 0.05, 0.05, 0.05], PCT, "McGuireWoods deal study / Citrin 2025: 5% of EBITDA most common; may be capped by investors", False),
    ("__sec", "EXIT (Year 5)"),
    ("exit_mult", "Exit multiple (x Year-5 EBITDA)", [4.75, 5.75, 7.00, 4.50], MULT, "A: base assumes +0.5x for scale and inspection mix; Ohio strategic buyers active 2025-26 (see 04 case studies)", True),
    ("exit_cost", "Exit transaction costs (% of exit EV)", [0.03, 0.03, 0.03, 0.03], PCT, "A", False),
    ("__sec", "WATERFALL (first-time sponsor terms)"),
    ("hurdle", "Investor IRR hurdle for any promote", [0.08, 0.08, 0.08, 0.08], PCT, "A: typical preferred-return style hurdle", False),
    ("t1", "Promote tier 1 (above hurdle)", [0.10, 0.10, 0.10, 0.10], PCT, "A: below survey medians deliberately", False),
    ("t2_moic", "Tier 2 starts at investor gross MOIC of", [2.5, 2.5, 2.5, 2.5], MULT, "A", False),
    ("t2", "Promote tier 2", [0.15, 0.15, 0.15, 0.15], PCT, "A", False),
    ("t3_moic", "Tier 3 starts at investor gross MOIC of", [3.0, 3.0, 3.0, 3.0], MULT, "A", False),
    ("t3", "Promote tier 3", [0.20, 0.20, 0.20, 0.20], PCT, "A: Citrin 2025: 64% of sponsors reach >=25% max carry (established sponsors)", False),
    ("mip", "Operator profits interest (% of equity gain)", [0.075, 0.075, 0.075, 0.075], PCT, "A: vests over 4-5 years; see 07_OPERATING_PARTNER_PROFILE.md", True),
    ("hold", "Hold period (years) — fixed at 5 in this model", [5, 5, 5, 5], NUM, "Model structure; do not change without rebuilding", False),
]

ref = {}  # key -> row
r = 5
for item in INPUTS:
    if item[0] == "__sec":
        section(wi, r, item[1], 6)
        r += 1
        continue
    key, label, vals, fmt, note, keyflag = item
    wi.cell(row=r, column=1, value=label).font = BLACK
    for j, v in enumerate(vals):
        c = wi.cell(row=r, column=2 + j, value=v)
        c.font = BLUE
        c.number_format = fmt
        c.border = BOX
        if keyflag:
            c.fill = KEY_FILL
    n = wi.cell(row=r, column=6, value=note)
    n.font = NOTE
    n.alignment = Alignment(wrap_text=True, vertical="top")
    ref[key] = r
    r += 1

# derived inputs (formulas)
section(wi, r, "DERIVED (formulas — do not edit)", 6)
r += 1
DERIVED = [
    ("adj_ebitda", "Adjusted EBITDA ($)", "={c}%d+{c}%d+{c}%d+{c}%d" % (ref["rep_ebitda"], ref["addbacks"], ref["replace"], ref["onetime"]), USD),
    ("adj_margin", "Adjusted EBITDA margin", "=IFERROR({c}%d/{c}%d,0)", PCT),
    ("ev", "Enterprise value / purchase price ($)", "={c}%d*{c}%d", USD),
]
d_rows = {}
for key, label, f, fmt in DERIVED:
    d_rows[key] = r
    r += 1
for key, label, f, fmt in DERIVED:
    rr = d_rows[key]
    wi.cell(row=rr, column=1, value=label).font = BOLD
    for j, s in enumerate(SCEN):
        col = SCOL[s]
        if key == "adj_ebitda":
            formula = f.replace("{c}", col)
        elif key == "adj_margin":
            formula = "=IFERROR(%s%d/%s%d,0)" % (col, d_rows["adj_ebitda"], col, ref["rev"])
        else:
            formula = "=%s%d*%s%d" % (col, d_rows["adj_ebitda"], col, ref["entry_mult"])
        c = wi.cell(row=rr, column=2 + j, value=formula)
        c.font = BLACK
        c.number_format = fmt
        c.fill = OUT_FILL
        c.border = BOX
ref.update(d_rows)

wi.column_dimensions["A"].width = 58
for col in "BCDE":
    wi.column_dimensions[col].width = 15
wi.column_dimensions["F"].width = 90
wi.freeze_panes = "B5"

# Legend + example row note
wi.cell(row=r + 1, column=1, value="Legend: blue = input; yellow = diligence these first; green fill = formula output. Example of realistic format: Base column.").font = NOTE


def I(key, scen):
    """Absolute reference to an Inputs cell for a scenario."""
    return "Inputs!$%s$%d" % (SCOL[scen], ref[key])


# ---------------------------------------------------------------- SOURCES & USES
wsu = wb.create_sheet("Sources_Uses")
wsu["A1"] = "Sources & Uses at Close"
wsu["A1"].font = TITLE
header_row(wsu, 3, ["Line", "Conservative", "Base", "Aggressive", "Downside"])
SU = [
    ("__sec", "USES"),
    ("u_ev", "Purchase price (enterprise value)", lambda s: "=" + I("ev", s)),
    ("u_cash", "Cash to balance sheet", lambda s: "=" + I("bs_cash", s)),
    ("u_qoe", "Quality of earnings & diligence", lambda s: "=" + I("qoe", s)),
    ("u_legal", "Legal & closing", lambda s: "=" + I("legal", s)),
    ("u_lfee", "Lender fee", lambda s: "=%s*%s*%s" % (I("lender_fee", s), I("sr_lev", s), I("adj_ebitda", s))),
    ("u_sfee", "Sponsor closing fee", lambda s: "=%s*%s" % (I("close_fee", s), I("ev", s))),
    ("u_total", "TOTAL USES", None),
    ("__sec", "SOURCES"),
    ("s_sr", "Senior term debt", lambda s: "=%s*%s" % (I("sr_lev", s), I("adj_ebitda", s))),
    ("s_sn", "Seller note", lambda s: "=%s*%s" % (I("sn_pct", s), I("ev", s))),
    ("s_roll", "Seller rollover equity", lambda s: "=%s*%s" % (I("roll_pct", s), I("ev", s))),
    ("s_op", "Operating partner co-invest", lambda s: "=" + I("op_inv", s)),
    ("s_fee", "Sponsor rolled closing fee (equity in lieu of cash)", None),
    ("s_inv", "Investor cash equity (plug)", None),
    ("s_total", "TOTAL SOURCES", None),
    ("__sec", "CHECKS & STRUCTURE"),
    ("chk", "Sources minus uses (must be 0)", None),
    ("eq_total", "Total equity", None),
    ("eq_pct", "Equity as % of total sources", None),
    ("debt_x", "Total debt / Adjusted EBITDA at close", None),
    ("founder_cash", "Founder cash required at close", None),
]
su = {}
r = 4
for item in SU:
    if item[0] == "__sec":
        section(wsu, r, item[1], 5)
        r += 1
        continue
    su[item[0]] = r
    r += 1
for key, label, fn in [x for x in SU if x[0] != "__sec"]:
    rr = su[key]
    wsu.cell(row=rr, column=1, value=label).font = BOLD if key in ("u_total", "s_total", "s_inv", "chk") else BLACK
    for j, s in enumerate(SCEN):
        col = get_column_letter(2 + j)
        if fn:
            f = fn(s)
            font = GREEN
        elif key == "u_total":
            f = "=SUM(%s%d:%s%d)" % (col, su["u_ev"], col, su["u_sfee"])
            font = BLACK
        elif key == "s_fee":
            f = "=%s%d*%s" % (col, su["u_sfee"], I("fee_roll", s))
            font = BLACK
        elif key == "s_inv":
            f = "=%s%d-SUM(%s%d:%s%d)" % (col, su["u_total"], col, su["s_sr"], col, su["s_fee"])
            font = BLACK
        elif key == "s_total":
            f = "=SUM(%s%d:%s%d)" % (col, su["s_sr"], col, su["s_inv"])
            font = BLACK
        elif key == "chk":
            f = "=ROUND(%s%d-%s%d,2)" % (col, su["s_total"], col, su["u_total"])
            font = BLACK
        elif key == "eq_total":
            f = "=%s%d+%s%d+%s%d+%s%d" % (col, su["s_roll"], col, su["s_op"], col, su["s_fee"], col, su["s_inv"])
            font = BLACK
        elif key == "eq_pct":
            f = "=IFERROR(%s%d/%s%d,0)" % (col, su["eq_total"], col, su["s_total"])
            font = BLACK
        elif key == "debt_x":
            f = "=IFERROR((%s%d+%s%d)/%s,0)" % (col, su["s_sr"], col, su["s_sn"], I("adj_ebitda", s))
            font = BLACK
        elif key == "founder_cash":
            f = 0
            font = BLUE
        c = wsu.cell(row=rr, column=2 + j, value=f)
        c.font = font
        c.number_format = PCT if key == "eq_pct" else (MULT if key == "debt_x" else USD)
        c.border = BOX
        if key in ("u_total", "s_total", "s_inv", "eq_total"):
            c.fill = OUT_FILL
wsu.cell(row=su["founder_cash"], column=6, value="Input: the founder brings $0 cash; his equity is the rolled fee + promote. Change only if you truly have the cash after reserves.").font = NOTE
wsu.column_dimensions["A"].width = 52
for col in "BCDE":
    wsu.column_dimensions[col].width = 16
wsu.column_dimensions["F"].width = 80


def SUref(key, scen):
    return "Sources_Uses!$%s$%d" % (get_column_letter(2 + SCEN.index(scen)), su[key])


# ---------------------------------------------------------------- MODEL SHEETS
MROWS = [
    ("year", "Year"),
    ("rev", "Revenue"),
    ("margin", "Adj. EBITDA margin (pre-shock)"),
    ("ebitda_pre", "Adj. EBITDA (pre-shock)"),
    ("shockf", "Shock factor"),
    ("ebitda", "Adjusted EBITDA"),
    ("mfee", "Sponsor management fee"),
    ("mcapex", "Maintenance capex"),
    ("gcapex", "Growth capex"),
    ("nwc", "Change in net working capital"),
    ("sr_int", "Senior interest"),
    ("sn_int", "Seller note interest"),
    ("taxable", "Taxable income proxy (capex used as tax depreciation)"),
    ("tax", "Cash taxes"),
    ("ufcf", "Free cash flow before debt service (after tax)"),
    ("sr_prin", "Senior scheduled principal"),
    ("sn_prin", "Seller note principal"),
    ("ds", "Total debt service"),
    ("lfcf", "Levered free cash flow"),
    ("sweep", "Cash sweep to senior"),
    ("cash_build", "Net cash build"),
    ("__sec", "BALANCES"),
    ("sr_beg", "Senior debt — beginning"),
    ("sr_end", "Senior debt — ending"),
    ("sn_beg", "Seller note — beginning"),
    ("sn_end", "Seller note — ending"),
    ("cash", "Cash balance"),
    ("net_debt", "Net debt"),
    ("__sec", "CREDIT STATISTICS"),
    ("dscr", "DSCR (x)"),
    ("sr_x", "Senior debt / EBITDA (x)"),
    ("tot_x", "Total debt / EBITDA (x)"),
]
EXIT_ROWS = [
    ("min_dscr", "Minimum DSCR, years 1-5", MULT),
    ("exit_ev", "Exit enterprise value", USD),
    ("exit_cost", "Exit costs", USD),
    ("exit_sr", "Repay senior debt", USD),
    ("exit_sn", "Repay seller note", USD),
    ("exit_cash", "Plus balance-sheet cash", USD),
    ("exit_eq", "Exit equity value", USD),
    ("entry_eq", "Total equity invested at close", USD),
    ("gain", "Equity gain", USD),
    ("mip", "Operator profits interest (MIP)", USD),
    ("dist", "Distributable to equity holders", USD),
    ("g_moic", "Gross MOIC — all equity", MULT),
    ("g_irr", "Gross IRR — all equity", PCT),
    ("pb_eq", "Promote-bearing equity (investors + seller rollover + operator)", USD),
    ("pb_gross", "Their gross proceeds", USD),
    ("pb_moic", "Their gross MOIC", MULT),
    ("pb_irr", "Their gross IRR", PCT),
    ("prom_rate", "Promote rate earned", PCT),
    ("promote", "Sponsor promote ($)", USD),
    ("inv_net", "Investor net proceeds (incl. rollover & operator co-invest)", USD),
    ("inv_moic", "Investor net MOIC", MULT),
    ("inv_irr", "Investor net IRR", PCT),
    ("__sec", "FOUNDER (SPONSOR) ECONOMICS — PRE-TAX, 5 YEARS", None),
    ("f_fee_cash", "Closing fee received in cash", USD),
    ("f_mfees", "Management fees received (5 yrs)", USD),
    ("f_eq", "Exit proceeds on rolled-fee equity", USD),
    ("f_prom", "Promote", USD),
    ("f_total", "TOTAL founder pre-tax (5 yrs)", USD),
    ("__sec", "OPERATOR ECONOMICS — PRE-TAX, EXCLUDING SALARY", None),
    ("o_inv", "Operator co-invest net proceeds", USD),
    ("o_mip", "Operator profits interest", USD),
    ("o_total", "TOTAL operator equity value at exit", USD),
]

model_refs = {}
for s in SCEN:
    ws = wb.create_sheet("Model_" + s)
    ws["A1"] = "Operating & Debt Model — %s scenario" % s
    ws["A1"].font = TITLE
    ws["A2"] = "Driven entirely by the '%s' column of Inputs. Years 1-5 after close." % s
    ws["A2"].font = NOTE
    header_row(ws, 4, ["$ unless stated", "Close (Y0)", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"])
    rows = {}
    r = 5
    for key, label in MROWS:
        if key == "__sec":
            section(ws, r, label, 7)
            r += 1
            continue
        rows[key] = r
        ws.cell(row=r, column=1, value=label).font = BOLD if key in ("ebitda", "ufcf", "lfcf", "dscr") else BLACK
        r += 1
    cols = ["B", "C", "D", "E", "F", "G"]
    for i, col in enumerate(cols):
        yr = i  # 0..5
        prev = cols[i - 1] if i > 0 else None

        def W(key, val, fmt=USD, font=BLACK):
            c = ws["%s%d" % (col, rows[key])]
            c.value = val
            c.number_format = fmt
            c.font = font
            c.border = BOX

        W("year", yr, '0', BLACK)
        if yr == 0:
            W("rev", "=" + I("rev", s), USD, GREEN)
            W("ebitda", "=" + I("adj_ebitda", s), USD, GREEN)
            W("margin", "=" + I("adj_margin", s), PCT, GREEN)
            W("sr_end", "=" + SUref("s_sr", s), USD, GREEN)
            W("sn_end", "=" + SUref("s_sn", s), USD, GREEN)
            W("cash", "=" + I("bs_cash", s), USD, GREEN)
            W("net_debt", "=%s%d+%s%d-%s%d" % (col, rows["sr_end"], col, rows["sn_end"], col, rows["cash"]))
            W("tot_x", "=IFERROR((%s%d+%s%d)/%s%d,0)" % (col, rows["sr_end"], col, rows["sn_end"], col, rows["ebitda"]), MULT)
            W("sr_x", "=IFERROR(%s%d/%s%d,0)" % (col, rows["sr_end"], col, rows["ebitda"]), MULT)
            continue
        c = col
        p = prev
        W("rev", "=%s%d*(1+%s)" % (p, rows["rev"], I("growth", s)))
        W("margin", "=%s%d+%s" % (p, rows["margin"], I("margin_step", s)), PCT)
        W("ebitda_pre", "=%s%d*%s%d" % (c, rows["rev"], c, rows["margin"]))
        W("shockf", "=IF(%s%d>=2,1+%s,1)" % (c, rows["year"], I("shock", s)), '0.00')
        W("ebitda", "=%s%d*%s%d" % (c, rows["ebitda_pre"], c, rows["shockf"]))
        W("mfee", "=-%s*MAX(0,%s%d)" % (I("mfee", s), c, rows["ebitda"]))
        W("mcapex", "=-%s*%s%d" % (I("mcapex", s), c, rows["rev"]))
        W("gcapex", "=-%s" % I("gcapex", s))
        W("nwc", "=-%s*(%s%d-%s%d)" % (I("nwc", s), c, rows["rev"], p, rows["rev"]))
        W("sr_beg", "=%s%d" % (p, rows["sr_end"]))
        W("sn_beg", "=%s%d" % (p, rows["sn_end"]))
        W("sr_int", "=-%s%d*%s" % (c, rows["sr_beg"], I("sr_rate", s)))
        W("sn_int", "=-%s%d*%s" % (c, rows["sn_beg"], I("sn_rate", s)))
        W("taxable", "=%s%d+%s%d+%s%d+%s%d+%s%d+%s%d" % (c, rows["ebitda"], c, rows["mfee"], c, rows["sr_int"], c, rows["sn_int"], c, rows["mcapex"], c, rows["gcapex"]))
        W("tax", "=-MAX(0,%s%d*%s)" % (c, rows["taxable"], I("tax", s)))
        W("ufcf", "=%s%d+%s%d+%s%d+%s%d+%s%d+%s%d" % (c, rows["ebitda"], c, rows["mfee"], c, rows["mcapex"], c, rows["gcapex"], c, rows["nwc"], c, rows["tax"]))
        W("sr_prin", "=-MIN(%s%d,%s/%s)" % (c, rows["sr_beg"], SUref("s_sr", s), I("sr_amort", s)))
        W("sn_prin", "=IF(%s%d<=%s,0,-MIN(%s%d,%s/(%s-%s)))" % (c, rows["year"], I("sn_io", s), c, rows["sn_beg"], SUref("s_sn", s), I("sn_term", s), I("sn_io", s)))
        W("ds", "=%s%d+%s%d+%s%d+%s%d" % (c, rows["sr_int"], c, rows["sn_int"], c, rows["sr_prin"], c, rows["sn_prin"]))
        W("lfcf", "=%s%d+%s%d+%s%d+%s%d+%s%d" % (c, rows["ufcf"], c, rows["sr_int"], c, rows["sn_int"], c, rows["sr_prin"], c, rows["sn_prin"]))
        W("sweep", "=-MAX(0,MIN(%s%d*%s,%s%d+%s%d))" % (c, rows["lfcf"], I("sweep", s), c, rows["sr_beg"], c, rows["sr_prin"]))
        W("cash_build", "=%s%d+%s%d" % (c, rows["lfcf"], c, rows["sweep"]))
        W("sr_end", "=%s%d+%s%d+%s%d" % (c, rows["sr_beg"], c, rows["sr_prin"], c, rows["sweep"]))
        W("sn_end", "=%s%d+%s%d" % (c, rows["sn_beg"], c, rows["sn_prin"]))
        W("cash", "=%s%d+%s%d" % (p, rows["cash"], c, rows["cash_build"]))
        W("net_debt", "=%s%d+%s%d-%s%d" % (c, rows["sr_end"], c, rows["sn_end"], c, rows["cash"]))
        W("dscr", "=IFERROR((%s%d+%s%d+%s%d+%s%d)/-%s%d,0)" % (c, rows["ebitda"], c, rows["mfee"], c, rows["mcapex"], c, rows["tax"], c, rows["ds"]), MULT)
        W("sr_x", "=IFERROR(%s%d/%s%d,0)" % (c, rows["sr_end"], c, rows["ebitda"]), MULT)
        W("tot_x", "=IFERROR((%s%d+%s%d)/%s%d,0)" % (c, rows["sr_end"], c, rows["sn_end"], c, rows["ebitda"]), MULT)
    # conditional emphasis on DSCR row
    for col in "CDEFG":
        ws["%s%d" % (col, rows["dscr"])].fill = OUT_FILL

    # Exit & returns block
    r = rows["tot_x"] + 2
    section(ws, r, "EXIT, RETURNS & WATERFALL (exit at end of Year 5)", 7)
    r += 1
    er = {}
    for key, label, fmt in EXIT_ROWS:
        if key == "__sec":
            section(ws, r, label, 7)
            r += 1
            continue
        er[key] = r
        ws.cell(row=r, column=1, value=label).font = BOLD if key in ("g_moic", "g_irr", "inv_moic", "inv_irr", "f_total", "min_dscr", "o_total") else BLACK
        r += 1
    G = lambda k: "G%d" % rows[k]
    B = lambda k: "B%d" % er[k]
    F = {
        "min_dscr": "=MIN(C%d:G%d)" % (rows["dscr"], rows["dscr"]),
        "exit_ev": "=%s*%s" % (I("exit_mult", s), G("ebitda")),
        "exit_cost": "=-%s*%s" % (I("exit_cost", s), B("exit_ev")),
        "exit_sr": "=-%s" % G("sr_end"),
        "exit_sn": "=-%s" % G("sn_end"),
        "exit_cash": "=%s" % G("cash"),
        "exit_eq": "=SUM(%s:%s)" % (B("exit_ev"), B("exit_cash")),
        "entry_eq": "=" + SUref("eq_total", s),
        "gain": "=%s-%s" % (B("exit_eq"), B("entry_eq")),
        "mip": "=%s*MAX(0,%s)" % (I("mip", s), B("gain")),
        "dist": "=MAX(0,%s-%s)" % (B("exit_eq"), B("mip")),
        "g_moic": "=IFERROR(%s/%s,0)" % (B("dist"), B("entry_eq")),
        "g_irr": "=IF(%s<=0,-1,%s^(1/%s)-1)" % (B("g_moic"), B("g_moic"), I("hold", s)),
        "pb_eq": "=%s+%s+%s" % (SUref("s_inv", s), SUref("s_roll", s), SUref("s_op", s)),
        "pb_gross": "=IFERROR(%s*%s/%s,0)" % (B("dist"), B("pb_eq"), B("entry_eq")),
        "pb_moic": "=IFERROR(%s/%s,0)" % (B("pb_gross"), B("pb_eq")),
        "pb_irr": "=IF(%s<=0,-1,%s^(1/%s)-1)" % (B("pb_moic"), B("pb_moic"), I("hold", s)),
        "prom_rate": "=IF(%s<%s,0,IF(%s<%s,%s,IF(%s<%s,%s,%s)))" % (B("pb_irr"), I("hurdle", s), B("pb_moic"), I("t2_moic", s), I("t1", s), B("pb_moic"), I("t3_moic", s), I("t2", s), I("t3", s)),
        "promote": "=%s*MAX(0,%s-%s)" % (B("prom_rate"), B("pb_gross"), B("pb_eq")),
        "inv_net": "=%s-%s" % (B("pb_gross"), B("promote")),
        "inv_moic": "=IFERROR(%s/%s,0)" % (B("inv_net"), B("pb_eq")),
        "inv_irr": "=IF(%s<=0,-1,%s^(1/%s)-1)" % (B("inv_moic"), B("inv_moic"), I("hold", s)),
        "f_fee_cash": "=%s*(1-%s)" % (SUref("u_sfee", s), I("fee_roll", s)),
        "f_mfees": "=-SUM(C%d:G%d)" % (rows["mfee"], rows["mfee"]),
        "f_eq": "=IFERROR(%s*%s/%s,0)" % (B("dist"), SUref("s_fee", s), B("entry_eq")),
        "f_prom": "=%s" % B("promote"),
        "f_total": "=SUM(%s:%s)" % (B("f_fee_cash"), B("f_prom")),
        "o_inv": "=IFERROR(%s*%s/%s,0)" % (B("inv_net"), SUref("s_op", s), B("pb_eq")),
        "o_mip": "=%s" % B("mip"),
        "o_total": "=%s+%s" % (B("o_inv"), B("o_mip")),
    }
    for key, label, fmt in [x for x in EXIT_ROWS if x[0] != "__sec"]:
        c = ws["B%d" % er[key]]
        c.value = F[key]
        c.number_format = fmt
        c.font = BLACK
        c.border = BOX
        if key in ("g_moic", "g_irr", "inv_moic", "inv_irr", "f_total", "min_dscr", "o_total"):
            c.fill = OUT_FILL
    ws.column_dimensions["A"].width = 58
    for col in "BCDEFG":
        ws.column_dimensions[col].width = 15
    ws.freeze_panes = "B5"
    model_refs[s] = (rows, er)

# ---------------------------------------------------------------- SUMMARY
wsm = wb.create_sheet("Summary", 1)
wsm["A1"] = "Scenario Summary — read this first"
wsm["A1"].font = TITLE
wsm["A2"] = "IC rule: do not proceed if minimum DSCR < 1.25x in Base, or < 1.00x in Downside, or if founder needs personal cash beyond reserves."
wsm["A2"].font = NOTE
header_row(wsm, 4, ["Metric", "Conservative", "Base", "Aggressive", "Downside"])
SUMMARY = [
    ("Adjusted EBITDA at close", lambda s: "=" + I("adj_ebitda", s), USD),
    ("Adjusted EBITDA margin", lambda s: "=" + I("adj_margin", s), PCT),
    ("Entry multiple", lambda s: "=" + I("entry_mult", s), MULT),
    ("Purchase price (EV)", lambda s: "=" + I("ev", s), USD),
    ("Total uses", lambda s: "=" + SUref("u_total", s), USD),
    ("Senior debt", lambda s: "=" + SUref("s_sr", s), USD),
    ("Seller note", lambda s: "=" + SUref("s_sn", s), USD),
    ("Investor cash equity required", lambda s: "=" + SUref("s_inv", s), USD),
    ("Total equity % of sources", lambda s: "=" + SUref("eq_pct", s), PCT),
    ("Total debt / EBITDA at close", lambda s: "=" + SUref("debt_x", s), MULT),
    ("Year-1 DSCR", lambda s: "=Model_%s!C%d" % (s, model_refs[s][0]["dscr"]), MULT),
    ("Minimum DSCR (Y1-Y5)", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["min_dscr"]), MULT),
    ("Year-5 EBITDA", lambda s: "=Model_%s!G%d" % (s, model_refs[s][0]["ebitda"]), USD),
    ("Exit equity value", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["exit_eq"]), USD),
    ("Gross MOIC (all equity)", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["g_moic"]), MULT),
    ("Gross IRR (all equity)", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["g_irr"]), PCT),
    ("Investor net MOIC", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["inv_moic"]), MULT),
    ("Investor net IRR", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["inv_irr"]), PCT),
    ("Founder pre-tax total, 5 yrs", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["f_total"]), USD),
    ("  of which promote", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["f_prom"]), USD),
    ("  of which fees (closing cash + management)", lambda s: "=Model_%s!B%d+Model_%s!B%d" % (s, model_refs[s][1]["f_fee_cash"], s, model_refs[s][1]["f_mfees"]), USD),
    ("Operator equity value at exit (ex-salary)", lambda s: "=Model_%s!B%d" % (s, model_refs[s][1]["o_total"]), USD),
    ("Founder cash at close", lambda s: "=" + SUref("founder_cash", s), USD),
]
srow = {}
for i, (label, fn, fmt) in enumerate(SUMMARY, start=5):
    wsm.cell(row=i, column=1, value=label).font = BOLD if not label.startswith("  ") else BLACK
    srow[label] = i
    for j, s in enumerate(SCEN):
        c = wsm.cell(row=i, column=2 + j, value=fn(s))
        c.font = GREEN
        c.number_format = fmt
        c.border = BOX
        if label in ("Minimum DSCR (Y1-Y5)", "Gross IRR (all equity)", "Investor net MOIC", "Founder pre-tax total, 5 yrs"):
            c.fill = OUT_FILL
r = 5 + len(SUMMARY) + 1
wsm.cell(row=r, column=1, value="IC GATE (formula)").font = BOLD
for j, s in enumerate(SCEN):
    col = get_column_letter(2 + j)
    thresh = 1.0 if s == "Downside" else 1.25
    c = wsm.cell(row=r, column=2 + j, value='=IF(%s%d>=%s,"PASS","FAIL")' % (col, srow["Minimum DSCR (Y1-Y5)"], thresh))
    c.font = BOLD
    c.border = BOX
wsm.cell(row=r + 1, column=1, value="Threshold: 1.25x minimum DSCR (Conservative/Base/Aggressive), 1.00x in Downside. Assumption — lenders set their own covenants.").font = NOTE
wsm.column_dimensions["A"].width = 46
for col in "BCDE":
    wsm.column_dimensions[col].width = 16

# ---------------------------------------------------------------- SENSITIVITY
wss = wb.create_sheet("Sensitivity")
wss["A1"] = "Downside Sensitivity — Base scenario"
wss["A1"].font = TITLE
wss["A2"] = "Closed-form approximations that reference Base inputs and the Base model. Use to see where the structure breaks, not as a forecast."
wss["A2"].font = NOTE
rb, eb = model_refs["Base"]
# Table 1: Year-3 DSCR vs EBITDA decline and senior leverage
wss["A4"] = "Table 1 — Year-3 DSCR: permanent EBITDA decline (rows) vs senior leverage x EBITDA (columns)"
wss["A4"].font = BOLD
levs = [1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
shocks = [0.0, -0.10, -0.20, -0.25, -0.30, -0.40]
wss["A5"] = "EBITDA change \\ Senior lev."
wss["A5"].font = BOLD
for j, L in enumerate(levs):
    c = wss.cell(row=5, column=2 + j, value=L)
    c.font = BLUE
    c.number_format = MULT
for i, sh in enumerate(shocks):
    rr = 6 + i
    c = wss.cell(row=rr, column=1, value=sh)
    c.font = BLUE
    c.number_format = PCT
    for j in range(len(levs)):
        colL = get_column_letter(2 + j)
        # Year-3 values from Base model: revenue E, pre-shock EBITDA E
        e3 = "(Model_Base!$E$%d*(1+$A%d))" % (rb["ebitda_pre"], rr)
        senior0 = "(%s$5*%s)" % (colL, I("adj_ebitda", "Base"))
        # senior balance at start of Y3 after two years of scheduled amortisation (ignores sweep — conservative)
        sbeg = "MAX(0,%s-2*%s/%s)" % (senior0, senior0, I("sr_amort", "Base"))
        sr_ds = "(%s*%s+MIN(%s,%s/%s))" % (sbeg, I("sr_rate", "Base"), sbeg, senior0, I("sr_amort", "Base"))
        sn_ds = "(-Model_Base!$E$%d-Model_Base!$E$%d)" % (rb["sn_int"], rb["sn_prin"])
        # simpler and safer tax proxy: tax on (EBITDA after fee - interest - capex)
        num = "(%s*(1-%s)+Model_Base!$E$%d-MAX(0,(%s*(1-%s)-%s*%s+Model_Base!$E$%d+Model_Base!$E$%d+Model_Base!$E$%d)*%s))" % (
            e3, I("mfee", "Base"), rb["mcapex"], e3, I("mfee", "Base"), sbeg, I("sr_rate", "Base"), rb["sn_int"], rb["mcapex"], rb["gcapex"], I("tax", "Base"))
        f = "=IFERROR(%s/(%s+%s),0)" % (num, sr_ds, sn_ds)
        c = wss.cell(row=rr, column=2 + j, value=f)
        c.number_format = MULT
        c.font = BLACK
        c.border = BOX
wss.cell(row=12, column=1, value="Read: any cell below 1.00x means the business cannot pay its debt from cash flow in Year 3 (when the seller note starts amortising). Ignores cash sweep, so slightly conservative.").font = NOTE

# Table 2: Gross MOIC vs exit multiple and EBITDA CAGR
wss["A14"] = "Table 2 — Gross equity MOIC: exit multiple (rows) vs EBITDA CAGR over 5 years (columns)"
wss["A14"].font = BOLD
cagrs = [-0.05, 0.0, 0.03, 0.06, 0.09, 0.12]
mults = [4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0]
wss["A15"] = "Exit multiple \\ EBITDA CAGR"
wss["A15"].font = BOLD
for j, g in enumerate(cagrs):
    c = wss.cell(row=15, column=2 + j, value=g)
    c.font = BLUE
    c.number_format = PCT
for i, m in enumerate(mults):
    rr = 16 + i
    c = wss.cell(row=rr, column=1, value=m)
    c.font = BLUE
    c.number_format = MULT
    for j in range(len(cagrs)):
        colL = get_column_letter(2 + j)
        e5 = "(%s*(1+%s$15)^5)" % (I("adj_ebitda", "Base"), colL)
        eq = "(($A%d*%s)*(1-%s)-Model_Base!$G$%d)" % (rr, e5, I("exit_cost", "Base"), rb["net_debt"])
        f = "=IFERROR(MAX(0,%s)/%s,0)" % (eq, SUref("eq_total", "Base"))
        c = wss.cell(row=rr, column=2 + j, value=f)
        c.number_format = MULT
        c.font = BLACK
        c.border = BOX
wss.cell(row=24, column=1, value="Holds Base-case Year-5 net debt constant across cells (approximation). Before MIP and promote.").font = NOTE

# Table 3: purchase price the business can carry
wss["A26"] = "Table 3 — Maximum supportable total debt at a target Year-1 DSCR (Base cash flow)"
wss["A26"].font = BOLD
header_row(wss, 27, ["Target DSCR", "Cash available for debt service (Y1)", "Blended debt constant (assumption)", "Max total debt", "Max debt / Adj. EBITDA"])
for i, t in enumerate([1.25, 1.35, 1.50, 1.75, 2.00]):
    rr = 28 + i
    wss.cell(row=rr, column=1, value=t).font = BLUE
    wss.cell(row=rr, column=1).number_format = MULT
    wss.cell(row=rr, column=2, value="=Model_Base!$C$%d+Model_Base!$C$%d+Model_Base!$C$%d+Model_Base!$C$%d" % (rb["ebitda"], rb["mfee"], rb["mcapex"], rb["tax"])).number_format = USD
    c = wss.cell(row=rr, column=3, value=0.20)
    c.font = BLUE
    c.number_format = PCT
    wss.cell(row=rr, column=4, value="=IFERROR(B%d/A%d/C%d,0)" % (rr, rr, rr)).number_format = USD
    wss.cell(row=rr, column=5, value="=IFERROR(D%d/%s,0)" % (rr, I("adj_ebitda", "Base"))).number_format = MULT
wss.cell(row=33, column=1, value="Debt constant = annual interest + principal per $1 of debt. 20% ≈ 8.75% rate amortising over ~7 years. Assumption — replace with lender terms.").font = NOTE
wss.column_dimensions["A"].width = 30
for col in "BCDEFGH":
    wss.column_dimensions[col].width = 16

# ---------------------------------------------------------------- DEAL TEMPLATE
wt = wb.create_sheet("Deal_Template")
wt["A1"] = "Acquisition Analysis Template (fill one column per deal)"
wt["A1"].font = TITLE
wt["A2"] = "Column B is a WORKED EXAMPLE using verified public figures: ABM Industries' acquisition of Able Services (8-K, 25-Aug-2021). 'n/d' = not publicly disclosed. Column C is yours."
wt["A2"].font = NOTE
header_row(wt, 4, ["Line item ($mm unless stated)", "Worked example: ABM / Able (2021)", "Your target", "Source / note"])
TPL = [
    ("Revenue", 1100, None, "ABM 8-K Ex-99.1 (25-Aug-2021): Able revenue ~$1.1bn", USD),
    ("Gross profit", "n/d", None, "Not publicly disclosed", USD),
    ("EBITDA (reported)", "n/d", None, "Not publicly disclosed", USD),
    ("Adjusted EBITDA", 65, None, "ABM 8-K: ~$65mm adjusted EBITDA, normalised for COVID-19", USD),
    ("Enterprise value", 830, None, "ABM 8-K: $830mm cash, subject to working-capital and net-debt adjustments", USD),
    ("Purchase multiple (EV / Adj. EBITDA)", "=IFERROR(B9/B8,\"n/a\")", "=IFERROR(C9/C8,\"n/a\")", "Formula", MULT),
    ("Expected cost synergies (mid-point)", 35, None, "ABM guided $30-40mm; mid-point used", USD),
    ("Multiple after full synergies", "=IFERROR(B9/(B8+B11),\"n/a\")", "=IFERROR(C9/(C8+C11),\"n/a\")", "Formula — synergy-adjusted multiple", MULT),
    ("Debt raised", "n/d", None, "Funded with cash on hand + revolver (amount drawn n/d)", USD),
    ("Equity", "n/a", None, "Strategic buyer — no deal-level equity", USD),
    ("Seller financing", 0, None, "None disclosed", USD),
    ("Normalised net working capital", "n/d", None, "Price subject to NWC adjustment", USD),
    ("Annual capital expenditure", "n/d", None, "", USD),
    ("Annual debt service", "n/a", None, "Corporate-level revolver", USD),
    ("DSCR", "n/a", None, "(EBITDA - capex - tax) / debt service", MULT),
    ("Free cash flow (EBITDA - capex - tax - ΔNWC)", "n/d", None, "", USD),
    ("Projected IRR", "n/a", None, "Use Model_ sheets for your target", PCT),
    ("Projected MOIC", "n/a", None, "", MULT),
    ("Downside: EBITDA -25% → DSCR", "n/a", None, "Use Sensitivity Table 1", MULT),
    ("Revenue mix: recurring / inspection %", 0.60, None, "ABM 10-Q: ~60% engineering, ~40% janitorial (service mix, not recurrence)", PCT),
]
for i, (lab, ex, yours, note, fmt) in enumerate(TPL, start=5):
    wt.cell(row=i, column=1, value=lab).font = BLACK
    c = wt.cell(row=i, column=2, value=ex)
    c.font = BLACK if (isinstance(ex, str) and ex.startswith("=")) else BLUE
    c.number_format = fmt
    c.border = BOX
    c2 = wt.cell(row=i, column=3, value=yours)
    c2.font = BLACK if (isinstance(yours, str) and yours.startswith("=")) else BLUE
    c2.number_format = fmt
    c2.border = BOX
    if yours is None:
        c2.fill = KEY_FILL
    wt.cell(row=i, column=4, value=note).font = NOTE
wt.column_dimensions["A"].width = 46
wt.column_dimensions["B"].width = 26
wt.column_dimensions["C"].width = 18
wt.column_dimensions["D"].width = 80

# ---------------------------------------------------------------- INDUSTRY SCORECARD
wsc = wb.create_sheet("Industry_Scorecard")
wsc["A1"] = "Industry Scorecard — weights are live inputs"
wsc["A1"].font = TITLE
crit = ["recurring", "margins", "fragmentation", "valuation", "capex", "simplicity", "management", "financing", "geography", "concentration", "lifestyle"]
crit_lab = ["Recurring rev. & retention", "EBITDA margin & cash conv.", "Fragmentation & availability", "Valuation (10 = cheap)", "Capex (10 = light)", "Operational simplicity", "Mgmt hiring & retention", "Financing feasibility", "Geographic expansion", "Customer concentration & resilience", "Founder lifestyle fit"]
base_w = [0.12, 0.12, 0.12, 0.10, 0.08, 0.10, 0.10, 0.08, 0.07, 0.05, 0.06]
fdr_w = [0.12, 0.12, 0.09, 0.10, 0.10, 0.12, 0.12, 0.12, 0.02, 0.05, 0.04]
header_row(wsc, 3, ["Industry"] + crit_lab + ["Base score", "Founder-weighted", "Risk penalty pts", "Risk-adjusted", "Evidence confidence"])
wsc.cell(row=4, column=1, value="Base weights (prompt)").font = BOLD
wsc.cell(row=5, column=1, value="Founder weights (<$10k, first deal)").font = BOLD
for j, (bw, fw) in enumerate(zip(base_w, fdr_w)):
    for rr, val in ((4, bw), (5, fw)):
        c = wsc.cell(row=rr, column=2 + j, value=val)
        c.font = BLUE
        c.number_format = '0%'
        c.fill = KEY_FILL
wsc.cell(row=4, column=13, value="=SUM(B4:L4)").number_format = '0%'
wsc.cell(row=5, column=13, value="=SUM(B5:L5)").number_format = '0%'
rows_csv = list(csv.DictReader(open(ROOT / "data" / "industry_scores.csv")))
for i, rw in enumerate(rows_csv, start=7):
    wsc.cell(row=i, column=1, value=rw["industry"]).font = BLACK
    for j, k in enumerate(crit):
        c = wsc.cell(row=i, column=2 + j, value=int(rw[k]))
        c.font = BLUE
        c.alignment = Alignment(horizontal="center")
    pen = sum(int(v) for kk, v in rw.items() if kk.startswith("pen_"))
    wsc.cell(row=i, column=13, value="=SUMPRODUCT(B%d:L%d,$B$4:$L$4)" % (i, i)).number_format = '0.00'
    wsc.cell(row=i, column=14, value="=SUMPRODUCT(B%d:L%d,$B$5:$L$5)" % (i, i)).number_format = '0.00'
    c = wsc.cell(row=i, column=15, value=pen)
    c.font = BLUE
    c.comment = Comment("Sum of 11 penalty factors scored 0/1/2 — see data/industry_scores.csv and 02_INDUSTRY_COMPARISON.md §4", "Model")
    wsc.cell(row=i, column=16, value="=N%d-0.1*O%d" % (i, i)).number_format = '0.00'
    wsc.cell(row=i, column=16).fill = OUT_FILL
    wsc.cell(row=i, column=17, value=rw["evidence_confidence"]).font = BLACK
wsc.cell(row=7 + len(rows_csv) + 1, column=1, value="Risk-adjusted = founder-weighted score - 0.1 x penalty points. Gates (applied in 02): evidence confidence >= Medium; not dependent on real-estate equity.").font = NOTE
wsc.column_dimensions["A"].width = 42
for j in range(2, 18):
    wsc.column_dimensions[get_column_letter(j)].width = 12
wsc.row_dimensions[3].height = 60
wsc.freeze_panes = "B7"

# ---------------------------------------------------------------- HOUSEHOLD & GOALS
wh = wb.create_sheet("Household_Goals")
wh["A1"] = "Household Capital Targets & Goal Economics"
wh["A1"].font = TITLE
wh["A2"] = "Pre-tax vs after-tax and enterprise value vs personal net worth are kept separate. All inputs are assumptions for planning."
wh["A2"].font = NOTE
header_row(wh, 4, ["Annual household spend (after tax)", "2-yr reserve", "3-yr reserve", "FI capital @ 3.9% SWR", "FI capital @ 3.5% SWR", "FI capital @ 3.0% SWR", "Pre-tax income needed (eff. tax below)"])
wh["I4"] = "Effective tax rate (A)"
wh["I4"].font = BOLD
wh["J4"] = 0.30
wh["J4"].font = BLUE
wh["J4"].number_format = PCT
wh["J4"].fill = KEY_FILL
for i, spend in enumerate([60_000, 80_000, 100_000, 150_000, 250_000, 500_000], start=5):
    c = wh.cell(row=i, column=1, value=spend)
    c.font = BLUE
    c.number_format = USD
    wh.cell(row=i, column=2, value="=A%d*2" % i).number_format = USD
    wh.cell(row=i, column=3, value="=A%d*3" % i).number_format = USD
    wh.cell(row=i, column=4, value="=A%d/0.039" % i).number_format = USD
    wh.cell(row=i, column=5, value="=A%d/0.035" % i).number_format = USD
    wh.cell(row=i, column=6, value="=A%d/0.03" % i).number_format = USD
    wh.cell(row=i, column=7, value="=A%d/(1-$J$4)" % i).number_format = USD
wh.cell(row=11, column=1, value="SWR sources: Morningstar 2025 safe withdrawal research — 3.9% for 30 years / 3.5% for 35 years at 90% success. 3.0% is an ASSUMPTION for 50+ year horizons (retiring at ~30). Withdrawals are from LIQUID portfolio, never from business enterprise value.").font = NOTE

wh["A13"] = "What it takes to reach the stated goals (founder share of a business portfolio)"
wh["A13"].font = BOLD
GOAL = [
    ("Target personal pre-tax income ($)", 3_000_000, USD, True),
    ("Target personal net worth ($)", 25_000_000, USD, True),
    ("Founder ownership of portfolio equity (%)", 0.25, PCT, True),
    ("Portfolio EV / EBITDA (x)", 7.0, MULT, True),
    ("Portfolio net debt / EBITDA (x)", 2.5, MULT, True),
    ("Share of EBITDA distributable to equity after debt service, capex, tax (%)", 0.40, PCT, True),
]
for i, (lab, val, fmt, inp) in enumerate(GOAL, start=14):
    wh.cell(row=i, column=1, value=lab).font = BLACK
    c = wh.cell(row=i, column=2, value=val)
    c.font = BLUE
    c.number_format = fmt
    c.fill = KEY_FILL
OUTG = [
    ("Portfolio EBITDA needed for the INCOME goal ($)", "=IFERROR(B14/(B16*B19),0)", USD),
    ("Portfolio EBITDA needed for the NET-WORTH goal ($)", "=IFERROR(B15/(B16*(B17-B18)),0)", USD),
    ("Implied portfolio enterprise value for income goal ($)", "=B21*B17", USD),
    ("Equivalent number of median search-fund-size companies ($2.5m EBITDA)", "=B21/2500000", '0.0'),
    ("Founder pre-tax value from the illustrative Base deal, 5 yrs (Summary sheet)", "=Summary!C%d" % srow["Founder pre-tax total, 5 yrs"], USD),
    ("Base-deal-equivalents needed for $25m (pre-tax, before reinvestment)", "=IFERROR(B15/B25,0)", '0.0'),
]
for i, (lab, f, fmt) in enumerate(OUTG, start=21):
    wh.cell(row=i, column=1, value=lab).font = BOLD
    c = wh.cell(row=i, column=2, value=f)
    c.number_format = fmt
    c.fill = OUT_FILL
    c.font = BLACK if not f.startswith("=Summary") else GREEN
wh.cell(row=28, column=1, value="Median search-fund acquisition (2024-25 cohort, Stanford GSB 2026 study via secondary summaries): ~$2.5m EBITDA, ~$16.0m purchase price, ~6.2x. Verify against the primary study.").font = NOTE
wh.column_dimensions["A"].width = 70
for col in "BCDEFG":
    wh.column_dimensions[col].width = 18
wh.column_dimensions["I"].width = 22

# fonts everywhere default Arial
for sheet in wb.worksheets:
    for row in sheet.iter_rows():
        for c in row:
            if c.font is None or c.font.name != F:
                c.font = Font(name=F, size=c.font.size if c.font else 10, bold=c.font.bold if c.font else False,
                              italic=c.font.italic if c.font else False, color=c.font.color if c.font else None)

wb.save(OUT)
print("saved", OUT)
