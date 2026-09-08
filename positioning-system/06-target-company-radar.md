# PART VI — Target Company Radar

## The rule that governs this entire file

**I will not produce revenue, EBITDA, or valuation figures for private companies.**

Aggregator sites publish private-company "revenue" that is modelled from employee
counts and industry averages, and it is routinely wrong by an order of magnitude.
Repeating such a number to someone who knows the company — and in Cincinnati LMM,
someone always knows the company — is the fastest way to be dismissed as
unserious.

Every quantitative field in your radar therefore carries a **Revenue Basis**
column with exactly one of: `REPORTED` (company or SEC filing), `RANGE-PUBLIC`
(a published list such as the Business Courier's, cite the list and year),
`ESTIMATE` (your own, with the method written out), `UNKNOWN`. Default is
`UNKNOWN` and that is a perfectly good answer.

---

## §1. Where to source companies — in verification order

| Tier | Source | What it gives you | Cost |
|---|---|---|---|
| 1 | **SEC EDGAR full-text search** (<https://efts.sec.gov/LATEST/search-index?q=>) | Public comps, and private companies named in acquirers' 8-Ks and 10-Ks | Free |
| 1 | **Ohio Secretary of State business search** | Entity existence, registered agent, officers, formation date | Free |
| 1 | **BLS QCEW** county-level employment and wages by NAICS | Sector size and growth *in Hamilton County specifically* | Free |
| 1 | **Census County Business Patterns** | Establishment counts by size band and NAICS — the best free proxy for how many $5–50M companies exist in a sector locally | Free |
| 1 | **SBA SBIC directory** | Which lenders are licensed to finance LMM deals in Ohio | Free |
| 2 | **Deloitte Cincinnati 100** program books (published PDFs) | Named large private companies, by year [R] | Free |
| 2 | **Cincinnati Business Courier lists** — Largest Private Companies, Largest Family-Owned (69 companies, 16 counties, >$13B combined 2025 revenue) [R] | Names and published revenue *ranges* | Subscription |
| 2 | **Goering Center member directory / Professional Services Registry** [R] | Member companies = owner-operated businesses, self-selected as growth-minded | Membership |
| 3 | **Axial, PitchBook, PrivSource** | Lead discovery only | Paid / limited free |
| 4 | Aggregator "company profile" sites | **Discovery only. Never a financial figure.** | Free |

**[I]** The combination almost nobody uses, and which will make your Project 1
thesis genuinely original: **Census CBP establishment-size bands + BLS QCEW
wage/employment trend, both filtered to Hamilton/Butler/Warren/Clermont counties
and one 4-digit NAICS code.** That produces a defensible, primary-sourced count
of how many acquirable companies exist in your sector and whether the sector is
growing locally. No aggregator sells that; most LMM sponsors have not built it.
Ten hours of work, and it is the single most credible thing you could put in
front of a Cincinnati investor.

---

## §2. Radar structure — Sheet 4 columns

`Company ID · Name · City · Sector · NAICS · Ownership Type · Employee Band ·
Revenue Estimate · **Revenue Basis** · Estimate Method · Growth Signal ·
Acquisition Relevance (1–5) · Strategic Relevance (1–5) · Likely Decision Maker ·
Linked Person ID · Source · URL · Verification Status · Date Verified ·
Confidence · Next Action · Notes`

Ownership Type dropdown: `Founder-owned · Family-owned · PE-backed ·
ESOP · Public · Subsidiary · Unknown`

**[I]** Ownership Type is the highest-signal column. Founder-owned and
family-owned with an ageing principal is the entire LMM thesis; PE-backed means
someone got there first and the next event is years away.

---

## §3. Seeded companies — verified names only, no financials

Public companies (all figures verifiable from EDGAR — go get them yourself):

| Company | Note | Verify at |
|---|---|---|
| Kroger | Greater Cincinnati's highest-ranked Fortune 500 company, 2026 list [R] | EDGAR: KR |
| Procter & Gamble | Fortune 500, Cincinnati HQ [R] | EDGAR: PG |
| GE Aerospace | Fortune 500, Greater Cincinnati [R] | EDGAR: GE |
| Cintas | Fortune 500, Greater Cincinnati [R] | EDGAR: CTAS |
| Cincinnati Financial | Fortune 500 [R]; also note its stated push into lower-mid-market investing [R] | EDGAR: CINF |

Private:

| Company | Note | Verify at |
|---|---|---|
| Total Quality Logistics | Region's largest private company; Clermont County [R] | Company site; Courier list |
| Taylor Logistics | 7th-generation family-owned 3PL, named on the 2026 Courier family-owned list [R] | <https://taylorlogistics.com/> |

⚠️ Greater Cincinnati held **eight** Fortune 500 headquarters on the 2026 list
[R]; I could confirm five by name. The remaining three are **UNVERIFIED** — get
them from Fortune's own list, not from me. This is exactly the kind of gap where
a plausible guess would cost you more than the blank.

**[I] On Cincinnati Financial specifically:** it is publicly reported to be pushing
into lower-middle-market investing for "better alpha" [R]. A public company whose
strategy is moving toward *your* market, headquartered in *your* city, with
public filings you can read — that is an unusually good subject for Project 5 and
an unusually good conversation opener with anyone in the local insurance-capital
world.

---

## §4. Building the radar — the weekly rhythm

Do not attempt a big list. Add **five companies per week**, each fully sourced,
for twenty-four weeks: 120 companies, every one defensible.

Weekly loop (45 minutes, Wednesdays):
1. Pick one 4-digit NAICS inside your Project 1 sector.
2. Census CBP: how many establishments in that NAICS, in the four core counties,
   in the 20–99 and 100–499 employee bands? Record the number and the query URL.
3. Ohio SOS or the company's own site: identify five named companies in that band.
4. For each: ownership type, decision-maker name if published, one growth signal
   (new location, hiring, award, press release) with its URL.
5. Set Revenue Basis honestly. `UNKNOWN` is the expected answer and costs nothing.
6. Cross-link any company to a Person ID already in Sheet 2.

**[I]** After twelve weeks you will be able to say, to a sponsor, with sources:
*"There are N founder-owned companies in this NAICS in the four-county area in
the 20–99 employee band; here are fourteen of them by name; here is which ones
have had an ownership event in the last three years."* Almost nobody walks into
that conversation with that. It is also, notably, pure research — it involves no
employment, no service to any company, and no compensation.
