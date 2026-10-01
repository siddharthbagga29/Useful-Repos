# Six-Month Private Markets Positioning System

Built 2026-09-08. Owner: Siddharth Bagga. Location: Cincinnati, OH.

This is an operating system, not an essay. It is designed so that on any given
morning you open one Google Sheet, read three tasks, and execute for 2–3 hours.

---

## READ THIS FIRST — two honest limitations

### 1. Your materials were received and used

Résumé (`Siddharth_Bagga_Resume_2026.pdf`) and the Google Drive folder
(7 files) were read on 2026-09-08 and are the primary source for the diagnosis.
Verified facts extracted from them are listed in `01-diagnosis.md` §A, with each
fact tagged to the document it came from.

**One thing takes priority over everything else in this repo.** Cross-checking the
résumé against your own transcript, diploma and capstone files surfaced four
claims that your own documents do not support. In a market as small and
interconnected as Cincinnati private capital, a single caught overstatement
costs you multiple relationships at once. Read `01-diagnosis.md` §B before you
send any outreach. Fixing those four lines is the highest-return action in the
entire six months, and it takes about ninety minutes.

### 2. I did not fabricate 100 named individuals

The prompt asks for a database of ~130 named people, and separately says
"DO NOT HALLUCINATE." Those two instructions collide. Generating names, titles and
"recent activity" for individuals at small private firms from model memory is exactly
the failure mode section 39 forbids, and a networking list that is 30% wrong is worse
than no list — one wrong title in a cold email ends the conversation.

**What you get instead, which is better:**

- `05-people-and-firms.md` — a **verified register of real firms and institutions**
  (each with a source URL and a verification status), because firms are verifiable
  from primary sources and are stable.
- A **People Sourcing Protocol**: a repeatable 12-minute-per-person procedure that
  takes you from that firm register to named individuals *with primary-source
  citations*, at roughly 5 people/hour. 100 people ≈ 20 hours of your time, spread
  over weeks 1–6, and every row lands in the CRM already VERIFIED.
- The CRM columns and formulas that hold them.

This is deliberate. You are building a relationship asset you will rely on for a
decade; it should be built from firm team pages and Form ADV, not from my recall.

---

## Map of the system

| File | Prompt section | What it is |
|---|---|---|
| `00-START-HERE.md` | §14, §15, §41 | The first 5 hours, the daily playbook, the Friday/Sunday checklists |
| `01-diagnosis.md` | §4 | Self-administered diagnostic, scored |
| `02-positioning-and-paths.md` | §2, §4L, §5, §21 | 14 career paths scored; natural-market analysis; story scripts |
| `03-geography.md` | §6 | Cincinnati + 9 secondary markets ranked |
| `04-organizations.md` | §7 | Tier 1–4 organization table, verified |
| `05-people-and-firms.md` | §8, §9, §19, §32 | Verified firm register + People Sourcing Protocol + relationship tiers |
| `06-target-company-radar.md` | §18 | Company radar + sourcing method, no fabricated financials |
| `07-investment-portfolio.md` | §16 | 6 portfolio projects, specced, sequenced |
| `08-conversation-portfolio.md` | §17 | Companies / industries / transactions / themes to own |
| `09-networking-system.md` | §20, §21, §22 | Event SOP, outreach scripts, reputation calendar |
| `10-sheets-architecture.md` | §10 | All 15 sheets: columns, dropdowns, formulas, formatting |
| `11-automation-architecture.md` | §11, §34 | Pipeline diagram, 7-field spec per automation |
| `12-daily-weekly-os.md` | §13, §25, §35, §36 | Morning SOP, weekly scorecard, self-improvement loop |
| `13-six-month-roadmap.md` | §24 | Months 1–6 with KPIs and deliverables |
| `14-ead-arrival-and-100-day.md` | §29, §30, §31 | Activation-day plan; 100-day launch; 30 target employers |
| `15-business-preparation.md` | §28 | Business blueprint, preparation vs. execution line |
| `16-financial-and-credit.md` | §26, §27 | Financial model + credit strategy |
| `17-evidence-base.md` | §23, §37, §38 | Claim / evidence / source / date / confidence |
| `18-immigration-counsel-questions.md` | §1 | Questions for your attorney. Not legal advice. |
| `19-verification-protocol.md` | §12, §38, §39 | Source hierarchy and verification states |
| `20-pitchbook-playbook.md` | — | How to use your UC PitchBook access, and its three hard constraints |
| `21-daily-agent.md` | — | The daily agent that replaced the reminder email: what it does, what it will not do |
| `agent/` | — | `CONTEXT.md` (what it knows) · `RUNBOOK.md` (what it does) · `MEMORY.md` (what it learned) |
| `apps-script/` | §10, §11 | Code that builds the entire workbook and runs the daily engine |
| `data/` | — | Seed CSVs you can paste straight into the workbook |

---

## Setup (30 minutes, once)

1. Create a new Google Sheet. Name it `Positioning OS`.
2. Extensions → Apps Script. Delete the placeholder.
3. Paste `apps-script/BuildWorkbook.gs`. Save. Run `buildWorkbook`. Authorise.
4. Add a second file, paste `apps-script/DailyEngine.gs`. Save.
5. Reload the sheet. A **Positioning OS** menu appears.
6. Menu → *Set up daily trigger*.
7. Import `data/organizations.csv` into the Organizations sheet and
   `data/firms-cincinnati.csv` into Target Companies (File → Import → Append).

Full instructions with troubleshooting: `apps-script/README.md`.

---

## The one-line version

Six months is enough time to become the person a Cincinnati lower-middle-market
investor already knows and has already seen think, so that the day your work
authorisation lands you are not applying — you are accepting a conversation that
started in month two.
