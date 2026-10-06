# Siddharth Bagga — brief

Single source of truth for both assistants. Every answer Jarvis gives about
Siddharth must be traceable to a line in this file. Edit facts here, nowhere else.

## Who
- Siddharth Bagga. Valuation and commercial due diligence analyst.
- Based in Cincinnati, OH; relocating, New York preferred.
- Email: siddharthbagga29@gmail.com. Phone: (860) 595-8333.
- LinkedIn: linkedin.com/in/siddharth-bagga-sid29
- Looking for: a seat with a family office, private wealth team or lower-middle-market private equity
  firm; also commercial due diligence, valuation and investment analysis roles.
- He does not offer investment advice or manage anyone's money. Visitors asking him to invest for
  them, or for personal investment recommendations, should be told that plainly and offered a
  conversation instead.

## Education
- M.S., Financial Mathematics — University of Cincinnati, Jan 2024 to May 2025.
- Graduate Certificate, Quantitative Finance — University of Cincinnati, Jan 2025 to May 2025.
- B.Com (Honors), Finance — Delhi University, Nov 2020 to May 2023.

## Credentials
- Bloomberg Market Concepts (Fixed Income, Capital Market Analysis, Interest Rate Risk).
- CFA Level I: awarded a merit-based exam-fee scholarship in 2025. He has NOT sat the exam.
  He is not a CFA charterholder or candidate who has passed Level I.
- Scholar, Strategic Management — Indian Institute of Science (IISc), Bangalore.

## Experience (14 months in total, 11 of them full-time)
### Strategic Finance Lead — Turnkey Services Pro, Cincinnati — Jan 2026 to Jun 2026
- Promoted from Financial Associate after five months.
- Underwrote a $6M+ multi-state acquisition pipeline in property services.
- Market work: addressable market sizing by metro, competitive positioning, peer benchmarking,
  entry-cost modelling.
- Target diligence: normalized EBITDA; tested seller revenue forecasts against backlog and
  pipeline conversion instead of accepting them; IRR/MOIC at multiple entry and exit points;
  purchase-price sensitivity; deal structuring.
- Wrote the go/no-go investment memoranda that governed every capital deployment decision,
  presented them to the Managing Partner and defended them under challenge.
- Valued private, illiquid companies with DCF (12% WACC, 3% terminal growth) and EBITDA-multiple
  comparables. Equity assessments ranged from a $3.5M base case to a $21M upside case.
- Identified cost and revenue levers that cut operating expenses 6%.
- Authored Reg D offering materials for LP capital raises on a deal-by-deal private equity platform.

### Financial Associate — Turnkey Services Pro, Cincinnati — Aug 2025 to Jan 2026
- Joined with no finance function: raw bank statements and scattered invoices.
- Built the first working models: DCF, free cash flow, AR/AP, job costing.
- Improved executive decision-making efficiency 75% in the first month, per the Managing Partner.
- Produced the company's first investment prospectus and capital-raise package.

### Wealth Management Intern — Cerity Partners, Cincinnati — Jan 2025 to Mar 2025
- Reconciled high-volume client transactions and fund movements under U.S. GAAP and internal controls.
- Cut daily reporting turnaround 30% by restructuring how portfolio data reached senior advisors.

## Projects
- S&P Global multi-scenario DCF (M.S. capstone): benchmarked against Moody's and MSCI, with WACC
  sensitivity and free-cash-flow projections across interest-rate environments. Its finding was a
  valuation within 10% of analyst consensus.
- Risk Tolerance Analysis: investor profiling with survey design, a scoring model and portfolio-fit mapping.
- Both reports are linked from the Exhibits section of his portfolio.

## The interactive model on the portfolio site
- The S&P Global DCF on the site is an ILLUSTRATION. It uses SPGI's reported revenue
  (2023: $12.497B, 2024: $14.208B, 2025: $15.336B) with estimated cash flows.
- It defaults to an 8.5% WACC, a reasonable rate for a large, low-leverage data business, and lands
  near SPGI's market cap (about $113.6B on 2 Oct 2026). That output is a demo calibration.
- It is NOT the capstone's result. Never present the site model's ~$111B output as his valuation.
- The 12% WACC on his resume belongs to the private-company work at Turnkey, which carried more risk.

## Live systems on the site
- Strategy Lab (/lab/): his research sandbox on weekly ETF prices from Dec 2015 to Sep 2026 (SPY, QQQ,
  IWM, EFA, AGG, TLT, GLD, VNQ). Signals use data up to week t and earn week t+1 (tested for look-ahead);
  trading costs are modelled; prices exclude dividends. It is hypothetical research, not a live
  trading system; no capital is managed with it.
- Strategy Lab research, online portfolio selection: he implemented algorithms from the Li & Hoi survey
  (EG, PAMR, OLMAR, uniform CRP) and stress-tested a claim from academic work, including a NYU Stern
  Glucksman Fellowship study, that mean-reversion algorithms such as PAMR deliver outstanding wealth.
  Frictionless, it replicates: PAMR compounded 10.5% a year vs 7.6% for equal weight.
  But PAMR trades about 55.4% of the portfolio every week; its edge is gone by
  5 bps of cost and out of sample (May 2021 to Sep 2026, 10 bps) it earned 0.8% a year.
  Exponentiated Gradient was the most robust: about 0.3% weekly turnover, edge intact at 50 bps.
- Strategy Lab Monte Carlo: 1,000 bootstrapped ten-year paths. No strategy reliably beat the S&P 500 on
  return (at most a few percent of paths). The defensive rules reliably cut drawdowns: 60/40 had a
  shallower drawdown than the S&P 500 in 99.8% of paths, volatility targeting in 91.5%,
  inverse volatility in 96.2%. That is the honest result: these rules trade return for
  smaller drawdowns; they do not have a high probability of outperforming.
- Deal Lab (/deal/) and Wholesale Deal Analyzer v2 (Excel): his Ohio wholesale real-estate analyzer, audited
  and rebuilt. v1 left the end buyer's selling, closing and holding costs out, never applied its own 15%
  rehab contingency, and used a 15% buyer-margin test while its note said 20%. On v1's own example
  (ARV $160,000, rehab $40,000, contract $60,000) v1 said GO; v2 says NO-GO: the true maximum allowable
  offer is $56,000 and the buyer's margin is 17.5%. A 1,000-trial Monte Carlo in the workbook, cross-checked
  against a 200,000-trial Python simulation, puts the chance the deal closes at a profit near 29%.
- Twin-Engine: a concept family-office dashboard for a two-market real-estate platform (US
  buy-fix-rent-refinance and India flips) with a Clean Books compliance index. The data in it is
  illustrative sample data, not real holdings. He rebuilt it so every figure is computed from the records.
- Sentinel: research on AI-failure losses: 29 public loss claims graded A to D by source quality,
  a 60,000-trial Monte Carlo of strategy viability and a 400,000-simulation pricing model.
  Code is private; a walkthrough is available on request.
- High Properties: a lead-generation web platform for a real-estate business (Vercel, Supabase,
  WhatsApp follow-up). The code is public on his GitHub.

## Tools
- Advanced Excel (VBA, PivotTables, XLOOKUP, dynamic models), Bloomberg Terminal, S&P Capital IQ,
  Thomson Reuters, Python (pandas, NumPy, statsmodels), SQL, R, Power BI, Tableau.

## Outside work
- Likes travelling, learning new things and picking up new skills.
- Keeps up fitness and takes care of his health.
- Enjoys meeting new people.

## Honest gaps (state them plainly when asked)
- Has not run expert-network or customer-interview programmes.
- Has not supervised junior colleagues.
- Associate-level candidate, not senior.
- Not covered in this brief: middle name, salary expectations, references, personal details beyond the above.
