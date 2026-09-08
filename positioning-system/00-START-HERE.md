# START HERE — The Execution Layer

If you read nothing else in this repo, read this file. Everything else exists to
make this file work.

---

## PART XX — YOUR FIRST 5 HOURS

The objective is not to consume information. At the end of hour 5 you have: a live
workbook, six verified organisations with dated next-events, two event registrations,
25 real named people in a CRM with sources, one portfolio project scoped with source
documents downloaded, and three outreach messages actually sent.

Do these in order. Do not skip ahead. Set a timer per hour.

### HOUR 1 — Build the machine (0:00–1:00)

| Min | Action | Output |
|---|---|---|
| 0–15 | Create Google Sheet `Positioning OS`. Paste `BuildWorkbook.gs`, run `buildWorkbook`, authorise. | 15 sheets exist with headers, dropdowns, formatting |
| 15–25 | Paste `DailyEngine.gs`. Reload. Menu → *Set up daily trigger*. | Automation live |
| 25–35 | Import `data/organizations.csv` and `data/firms-cincinnati.csv`. | ~30 seeded rows |
| 35–55 | Open `01-diagnosis.md`. Complete Instruments A–D. Enter the four scores into Dashboard cells B22:B25. | Your baseline, numerically |
| 55–60 | Open `16-financial-and-credit.md`. Enter your 5 known financial data points into Sheet 13. | Financial baseline |

**Do not** spend hour 1 reading. Build.

### HOUR 2 — Lock the institutional access (1:00–2:00)

Open `04-organizations.md`. For each of the six Tier 1 organisations, open the
organisation's **own website** (not my summary, not a blog) and record in Sheet 3:
current membership cost, current membership categories, the date of the next public
event, and whether non-members may attend it.

| Min | Action | Output |
|---|---|---|
| 0–30 | Verify the 6 Tier 1 orgs from primary sources. Set Verification Status = VERIFIED and Date Verified = today. | 6 verified rows |
| 30–45 | Register for the **two nearest events that are open to non-members**. Pay if under $75. | 2 rows in Sheet 5 with Registration Status = REGISTERED |
| 45–55 | Email the membership contact at CFA Society Cincinnati and ACG Cincinnati asking what category fits someone not currently employed in the industry, and what the student/affiliate/candidate rate is. Use the script in `09-networking-system.md` §Org Inquiry. | 2 emails sent |
| 55–60 | Log all of it. Sheet 15 gets one row per URL you relied on. | Audit trail started |

**Why this is hour 2 and not hour 5:** organisation membership and event calendars
have lead times of weeks. Everything else in this system compounds faster if the
first event is already on the calendar.

### HOUR 3 — Put 25 real people in the CRM (2:00–3:00)

Open `05-people-and-firms.md` and run the **People Sourcing Protocol** against the
verified firm register. You are working from firm *Team* / *Our People* pages —
primary sources — not from search-engine summaries.

Target: 25 rows. Realistic rate is 5–8/hour once warmed up; if you get 18, that is
fine. Each row must have: name, exact title as printed, firm, the firm page URL,
today's date in Date Verified, and a relationship tier guess.

Prioritise in this order: Cincinnati LMM PE (Tier A firms) → Cincinnati M&A boutiques
→ Northcreek/private credit → UC Lindner finance faculty and Johnson Investment
Institute staff → Goering Center leadership.

**Do not** send anything yet. Hour 3 is collection only.

### HOUR 4 — Start the portfolio project that differentiates you (3:00–4:00)

Open `07-investment-portfolio.md`. Project 1 is the **Cincinnati LMM acquisition
thesis**, not a DCF. Reason: every candidate has a DCF; almost none has an original
regional thesis, and the thesis is the thing that makes a partner want a second
conversation.

| Min | Action | Output |
|---|---|---|
| 0–20 | Choose a sector from the four candidates in §Sector Selection. Write one paragraph on why that sector, in this region, now. | Sector locked |
| 20–45 | Build the source pack: download/bookmark the primary documents listed in §Source Pack for that sector (BLS QCEW county data, Census County Business Patterns, any public comparable's 10-K, trade association reports). | Sources in Drive |
| 45–60 | Create the Google Doc `P1 — <Sector> LMM Thesis` with the memo skeleton from §Memo Structure. Write only the "Question" section. | Project row in Sheet 7, status IN PROGRESS |

### HOUR 5 — Say who you are, out loud, to three people (4:00–5:00)

| Min | Action | Output |
|---|---|---|
| 0–20 | Write your 10s / 30s / 60s introductions using `02-positioning-and-paths.md` §Story. Say each out loud twice. Record the 30s on your phone and listen once. | Three scripts, rehearsed |
| 20–35 | Rewrite your LinkedIn headline and About section using the template. Publish. | Live profile |
| 35–55 | Send **three** outreach messages from your hour-3 list, using the *Curiosity* script in `09-networking-system.md`. Not a job ask. A specific question about their market that you could only ask having done hour 4. | 3 sent, logged in Sheet 2 |
| 55–60 | Menu → *Generate Tomorrow's Tasks*. Review the proposals. Approve 3. Close the laptop. | Tomorrow is pre-decided |

**End state after 5 hours:** a running system, 2 committed events, ~25 sourced
contacts, 1 project underway, 3 conversations opened, and a decided tomorrow.

---

## MY DAILY PLAYBOOK

Print this. Or make it Sheet 1 row 1. It does not change.

### EVERY MORNING (2h 15m)

```
☐  0:00  Open Dashboard. Read the red cells only.                       (5 min)
☐  0:05  Read today's 3 priorities (Relationship / Reputation / Opportunity).
☐  0:10  Approve or reject the proposed task list. Reject freely.        (5 min)
☐  0:15  RELATIONSHIP BLOCK                                             (45 min)
         ☐ Follow up with everyone in "Follow-Up Due" (usually 2–4)
         ☐ Contact 1 new person, with a specific question, never a job ask
         ☐ Log every send: Last Contact, Next Contact, Topic
☐  1:00  REPUTATION / INVESTMENT BLOCK                                  (75 min)
         ☐ Advance today's portfolio project by one named deliverable
         ☐ OR complete today's investment research question
         ☐ Record every external fact with source URL + date in Sheet 15
☐  2:15  CLOSE-OUT                                                      (15 min)
         ☐ Update CRM rows touched today
         ☐ Update project % complete and hours logged
         ☐ Schedule the next action for anyone contacted today
         ☐ Generate tomorrow's tasks; approve 3
```

**The three priorities, every single day, in this order:**

1. **RELATIONSHIP** — who gets contacted today? (Follow-ups first, new contact second.
   A follow-up is worth more than a new name; see `17-evidence-base.md` §Weak ties.)
2. **REPUTATION** — what do I produce today that is evidence of judgment? (A paragraph
   of a memo counts. A LinkedIn post about someone else's idea does not.)
3. **OPPORTUNITY** — what do I investigate today that could become a door?
   (A company, a sector, a person's portfolio, an event.)

If the day collapses to 30 minutes: do the follow-ups. Nothing else. Follow-ups are
the only irreversible loss — a relationship you let go cold costs you the whole
prior investment.

### EVERY FRIDAY (30 min)

```
☐ Review network      — who went cold? who moved a tier? who owes me nothing yet?
☐ Review opportunities — advance or kill every row in Sheet 12. Kill freely.
☐ Review investment work — is the current project on pace? if not, cut its scope.
☐ Review skills       — which spaced-repetition reps are overdue?
☐ Review financial position — utilisation, statement dates, runway months
```

### EVERY SUNDAY (45 min)

```
☐ Menu → Compute Weekly Score. Read the number, not the feelings.
☐ Answer the 8 improvement questions (12-daily-weekly-os.md §Self-improvement loop)
☐ Remove the lowest-value recurring task. Every week. Non-negotiable.
☐ Set next week's 5 targets in Sheet 11
☐ Schedule the week's events; put pre-briefs on the calendar 48h before each
☐ Select or continue the investment project; write down its next deliverable
```

---

## The rule that protects the whole system

**Nothing enters the database unverified.**

If you cannot produce a URL and a date for a fact, it goes in with status
UNVERIFIED and it does not get used in a conversation. A wrong AUM figure quoted to
a partner costs more than the entire week of research that produced it.

See `19-verification-protocol.md`.

---

## The rule that protects you legally

**Every opportunity row has an "Authorization Required?" column.**

Before you act on anything that looks like work — paid or unpaid, for a company or
a person, in exchange for anything of value — set that column to Y and route it to
`18-immigration-counsel-questions.md`. Do not resolve it yourself. Do not let me
resolve it. See §1 of that file for what I am and am not able to tell you.
