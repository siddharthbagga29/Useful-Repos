# PART IX — Google Sheets Architecture

**Build it by running the script, not by hand.** `apps-script/BuildWorkbook.gs`
creates all 15 sheets with headers, dropdowns, formulas and conditional
formatting in one run. This file documents *why* each piece is shaped the way it
is, and gives you the formulas as text so you can modify them.

Google Sheets, not Excel, as requested — and the choice matters: the Apps Script
layer, the daily trigger and the email brief only exist because it is Sheets.

---

## Sheet 1 — Dashboard

Read-only except the four amber baseline cells (B22:B25, from
`01-diagnosis.md` §H). Organised so the **red block is at the top** — the design
principle is that the only thing you must read every morning is what is broken.

Key formulas (sheet names quoted because they contain spaces):

```
Follow-ups overdue      =COUNTIFS('People CRM'!P2:P,"<="&TODAY(),'People CRM'!P2:P,"<>")
Unverified people       =COUNTIF('People CRM'!AB2:AB,"UNVERIFIED")
Counsel review needed   =COUNTIF(Opportunities!L2:L,"Yes")
Projects past due       =COUNTIFS('Portfolio Projects'!L2:L,"<"&TODAY(),
                                  'Portfolio Projects'!J2:J,"<>COMPLETE",
                                  'Portfolio Projects'!L2:L,"<>")
Total contacts          =COUNTA('People CRM'!B2:B)
New contacts this week  =COUNTIFS('People CRM'!N2:N,">="&TODAY()-7)
Conversations this week =COUNTIFS('People CRM'!O2:O,">="&TODAY()-7)
A-tier count            =COUNTIF('People CRM'!H2:H,"A")
Avg relationship score  =IFERROR(ROUND(AVERAGE('People CRM'!Z2:Z),2),0)
Portfolio hours         =IFERROR(SUM('Portfolio Projects'!H2:H),0)
Research hrs this week  =IFERROR(SUMIFS('Investment Research'!N2:N,
                                        'Investment Research'!B2:B,">="&TODAY()-7),0)
Next event              =IFERROR(TEXT(MINIFS(Events!D2:D,Events!D2:D,">="&TODAY()),
                                      "ddd d mmm"),"none scheduled")
Tier 1 source share     =IFERROR(TEXT(COUNTIF('Sources & Verification'!E2:E,"Tier 1*")
                                /COUNTA('Sources & Verification'!A2:A),"0%"),"-")
```

---

## Sheet 2 — People CRM (32 columns)

`Person ID · Full Name · Title · Organization · Org Type · City · Focus/Sector ·
Tier · Priority Score · Source Type · Shared Connection · UC Connection ·
Association · First Contact · Last Contact · Next Contact · Cadence Days ·
Days Since Contact ƒ · Follow-Up Due ƒ · Conversation Topic · Their Interests ·
Value I Can Give · Intros Received · Intros Given · Events Together ·
Relationship Strength · Opportunity · Verification Status · Source URL ·
Date Verified · Confidence · Notes`

Computed (ƒ), entered once in row 2 as array formulas:
```
R2  =ARRAYFORMULA(IF($O$2:$O$1000="","",TODAY()-$O$2:$O$1000))
S2  =ARRAYFORMULA(IF($P$2:$P$1000="","",IF($P$2:$P$1000<=TODAY(),"DUE","")))
```

Dropdowns: Org Type · Tier (A/B/C/D) · Verification Status · Confidence.

Conditional formatting: entire row red when Next Contact is due or past ·
A-tier names blue · Verification Status colour-coded.

**Design notes.**
- **`Value I Can Give` is mandatory and is why this CRM works.** The daily engine
  prints it back at you inside every follow-up task, so an empty cell shows up as
  "DECIDE BEFORE SENDING". This is the column that stops you sending "just
  checking in" messages.
- **`Cadence Days` implements the tier rhythm** — A: 30–45, B: 60, C: 90.
  Wolff & Moser (2009) found *maintaining* contacts is separable from *using*
  them and predicts salary growth [R, `17-evidence-base.md`]. Cadence is how you
  operationalise maintenance.
- **`Source URL` + `Date Verified` on a *person* row** is unusual and deliberate.
  It is what lets `flagStaleVerification` demote a row to OUTDATED after 90 days
  — because titles at small firms change silently.

---

## Sheet 3 — Organizations (19 columns)

`Org ID · Name · Type · Location · Purpose · Approx Members · Why I Fit ·
Cost Per Year · Event Cadence · Tier · Join Status · Applied Date · Joined Date ·
Key Contacts · URL · Verification Status · Date Verified · Confidence · Notes`

Dropdowns: Org Type · Org Tier (1–4) · Join Status · Verification · Confidence.
Seed data: `data/organizations.csv`.

Cost per member-meeting, if you want to rank ROI honestly:
```
=IFERROR($H2/($I2*12),"")     where I = events attended per month
```

---

## Sheet 4 — Target Companies (22 columns)

Full column list in `06-target-company-radar.md` §2.

**The column that matters: `Revenue Basis`** — `REPORTED / RANGE-PUBLIC /
ESTIMATE / UNKNOWN`. Conditional formatting turns the revenue cell **red** if a
number is present and the basis is blank or UNKNOWN. This is a deliberate
tripwire: the sheet refuses to let an unsourced private-company revenue figure
sit there looking authoritative.

---

## Sheet 5 — Events (19 columns)

`Event ID · Name · Host Org · Date · City · Format · Cost · Registration Status ·
Registered Date · Target People IDs · Pre-Brief Done · Questions Prepared ·
Attended · People Met · Follow-Ups Sent · ROI Score · URL · Verification Status · Notes`

Event ROI, computed after the fact:
```
=IFERROR(($N2*2+$O2*3)/MAX($G2,1),"")
```
People met counts double, follow-ups sent count triple, per dollar. **[I]** The
weighting is intentional: attending is worth little, meeting is worth something,
*following up* is worth the most — and this ratio is what tells you after four
months which organisations to renew.

---

## Sheet 6 — Investment Research (15 columns)

`Research ID · Date · Subject · Type · Question · Key Finding · Key Numbers ·
Source Tier · Source URL · Date Verified · Confidence · Feeds Project ·
Reusable Talking Point · Hours · Notes`

**[I]** `Reusable Talking Point` is the column that converts research into
conversation. Every research entry must produce one sentence you could say out
loud at an event. If it cannot, the research was academic rather than useful, and
you should notice that.

---

## Sheet 7 — Portfolio Projects (22 columns)

Includes `Publicly Shareable`, `Confidentiality Note`, `Verification Method` and
`Reviewer` — the four fields that enforce `07-investment-portfolio.md` §5.
A project is not COMPLETE until Reviewer is filled in.

```
Progress   =IFERROR($H2/$G2,"")      hours logged / est hours
```

---

## Sheet 8 — Applications (16 columns)

`Ready To Submit` (Yes/No) and status `Held (not authorized)` exist because for
the next six months this sheet holds **prepared, unsubmitted** applications.
That is the entire point: on activation day you submit, you do not write.

---

## Sheet 9 — Skills Gap (16 columns)

```
F2  =ARRAYFORMULA(IF($B$2:$B$1000="","",$E$2:$E$1000-$D$2:$D$1000))    Gap
O2  =ARRAYFORMULA(IF($M$2:$M$1000="","",$M$2:$M$1000+$N$2:$N$1000))    Next Rep Date
```

`Interval Days` implements expanding-interval spaced repetition (Cepeda et al.,
2006 [R]). Start at 3, then roughly double after each successful rep: 3 → 7 → 16
→ 35 → 70. `Evidence Of Level` forces you to name *why* you rated yourself a 4 —
which is the difference between a skills tracker and a wish list.

---

## Sheet 10 — Daily Tasks (11 columns)

`Date · Task ID · Slot · Task · Linked Record · Est Min · Approved · Status ·
Actual Min · Output Produced · Notes`

Written by the engine with Status `Proposed`. **You** set Approved. `Actual Min`
vs `Est Min` is what tells you, by month two, that the system's estimates are
wrong and by how much.

---

## Sheet 11 — Weekly Review (25 columns)

Metrics in B:Q, score in R, the five improvement questions in S:Y.

### Weekly score

```
Score = min(20, NewContacts×2)
      + min(20, Conversations×2)
      + min(10, FollowUpsSent)
      + min(10, IntrosReceived×5)
      + min(10, EventsAttended×5)
      + min(15, ResearchHours×1.5)
      + min(10, (Models+Memos)×5)
      + min(5,  Posts×2.5)
      = 100
```

⚠️ Implementation note: `MIN()` is **not** array-aware inside `ARRAYFORMULA`, so
the built formula expresses each cap as `IF(x>cap,cap,x)`. If you edit the
weights by hand, keep that form.

**[I] Why every component is capped.** Without caps, a week of 40 LinkedIn
connections scores like a week of two real conversations and a finished memo.
The caps encode the actual thesis of this system: breadth is worth something up
to a point, and depth is worth more. A perfect 100 is roughly 10 new contacts,
10 conversations, 10 follow-ups, 2 introductions, 2 events, 10 research hours,
2 completed deliverables and 2 published pieces. That is a very good week and it
should be rare.

---

## Sheet 12 — Opportunities (14 columns)

**`Authorization Required` and `Counsel Review Needed` are the two most important
cells in the workbook.** A `Yes` in either turns the whole row red, and the daily
engine raises it as an ADMIN task. This is the structural safeguard that stops an
exciting opportunity from quietly becoming an immigration problem.

---

## Sheet 13 — Personal Financial Profile

Vertical: `Line Item · Current · 6-Mo · 12-Mo · 24-Mo · Notes`, in four blocks —
Cash Flow, Liquidity, Credit, Debt & Investment. Pre-seeded with the two figures
you gave (≈$1,600 monthly expenses, ≈$1,500 desired emergency credit buffer).
Detail in `16-financial-and-credit.md`.

---

## Sheet 14 — Business Ideas (16 columns)

Carries `Authorization Gate` and `Validation Step (non-commercial)` for the same
reason Sheet 12 does. See `15-business-preparation.md`.

---

## Sheet 15 — Sources & Verification (12 columns)

`Source ID · Claim · Category · Source Name · Source Tier · URL · Date Accessed ·
Date Verified · Verification Status · Confidence · Re-Verify Due ƒ · Notes`

```
K2  =ARRAYFORMULA(IF($H$2:$H$1000="","",$H$2:$H$1000+90))
```

**[I]** This sheet is the audit trail for everything you will say out loud. Its
real function is behavioural: knowing you have to log the URL makes you go and
find the URL.

---

## Config (hidden-ish)

Holds every dropdown vocabulary in labelled columns; all validations point at
ranges here rather than hard-coded lists, so changing a vocabulary in one place
updates every sheet. Do not delete it.
