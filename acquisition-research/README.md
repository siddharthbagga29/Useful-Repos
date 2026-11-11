# Bagga Holdings — Acquisition Research & Founder Execution

Built 2026-11-09. Companion to `../positioning-system/` (which stays unchanged).

## Start here (in this order)

| # | Open | Why |
|---|---|---|
| 1 | **`print/BAGGA_PRINT_PACK.pdf`** | 26 pages to print: plan on one page, daily card, routine flowchart, 🔒 counsel gate, deal screen, six LOI gates, capital stack, operator checklist, case card, weekly review, wall dashboard, stop-doing poster, money waterfall, and **13 weekly calendar pages** (landscape) |
| 2 | `01_EXECUTIVE_INVESTMENT_RECOMMENDATION.md` | The IC answer and the 12 conclusions |
| 3 | `10_90_DAY_EXECUTION_CALENDAR.md` | Day 1 = Tue 10 Nov 2026. Exactly three goals a day |
| 4 | `06_FIRST_ACQUISITION_MODEL.xlsx` | Open the *Summary* tab; edit blue cells on *Inputs* |

## All files

| File | Brief § | Contents |
|---|---|---|
| 01_EXECUTIVE_INVESTMENT_RECOMMENDATION.md | 15 | Recommendation, 12 IC answers, IC rules, evidence gaps |
| 02_INDUSTRY_COMPARISON.md | 3-4 | 16 industries, weights, penalties, gates, Cincinnati overlay |
| 03_TOP_INDUSTRY_DEEP_DIVE.md | 5, 8 | Top-5 market research (A-L); first acquisition profile; financing options; 3+1 scenarios |
| 04_REAL_ACQUISITION_CASE_STUDIES.md | 6 | 20 real transactions, 17 fields each where disclosed |
| 05_CASE_STUDY_ANALYSIS_WORKBOOK.md | 7 | Method, A-J questions for all 20, worked example (ABM/Able), template |
| 06_FIRST_ACQUISITION_MODEL.xlsx | 7-8, 11 | Live-formula LBO (1,111 formulas, 0 errors), sensitivity, deal template, scorecard, household goals |
| 07_OPERATING_PARTNER_PROFILE.md | 9 | Profile, comp/equity, governance, 20 interview questions, verification |
| 08_FINANCING_AND_IMMIGRATION_GATES.md | 10 | 2025-26 rule changes, 7 activities separated, 6 gates, counsel questions |
| 09_CAREER_AND_NETWORKING_PLAN.md | 12 | Path recommendation, titles, employers, résumé, interviews, 90-day job plan |
| 10_90_DAY_EXECUTION_CALENDAR.md | 13 | 90 days × 3 goals with time, deliverable, completion condition |
| 11_DAILY_THREE_GOALS_TRACKER.md | 13 | Daily card, weekly scorecard, review, dashboard, milestones, stop-doing list |
| 12_RISK_REGISTER.md | — | 18 risks, heat map, review protocol |
| 13_SOURCE_REGISTER.md | — | Every source with ID, URL, retrieval date, verification status |
| 14_JOINT_FINANCIAL_PLAN.md | 11 | Household plan (added because §11 had no file in the list) |

## Regenerate

```bash
python3 data/score_industries.py          # industry ranking
python3 model/build_model.py              # Excel model (then recalc in Excel/LibreOffice)
python3 data/build_calendar.py            # calendar markdown + print/calendar.json
python3 print/build_print_pack.py && node print/render_pdf.cjs   # print pack PDF
```

## Integrity notes

- Facts were captured from web-search extracts on 2026-11-09. The session's network policy blocked opening pages directly, so every source is marked **SR — open the link and confirm before quoting.**
- No private-company revenue, EBITDA or price has been invented. Undisclosed figures say **n/d**.
- Not legal, tax or immigration advice. File 08 lists the questions for counsel.
