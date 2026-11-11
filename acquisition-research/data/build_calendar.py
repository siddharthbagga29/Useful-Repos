"""Generates 10_90_DAY_EXECUTION_CALENDAR.md and print/calendar.json.

Every day has EXACTLY three goals:
  1 CAREER / INCOME   2 ACQUISITION INTELLIGENCE   3 NETWORK / FINANCIAL FOUNDATION
Each goal = (action, minutes, deliverable, done_when).

Run from the project folder:  python3 data/build_calendar.py
"""
import datetime as dt
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
START = dt.date(2026, 11, 10)  # Day 1 = Tuesday

# ------------------------------------------------------------------ weekly parameters (week 1..13)
CASES = {1: "A2 ABM ← Able (worked example, file 05 §4)", 2: "F5 Summit ← Total Life Safety (West Chester OH)",
         3: "A1 Rollins ← Fox Pest Control", 4: "F1 APi ← Chubb", 5: "X1 Zips Car Wash (failure)",
         6: "F3 + F4 CertaSite build → APi exit", 7: "X4 Kidde-Fenwal (PFAS)", 8: "X2 Rentokil ← Terminix",
         9: "A3 EMCOR ← Miller Electric", 10: "F6 Pye-Barker roll-up", 11: "X3 Encompass vs X5 Comfort Systems",
         12: "A6 APi ← Elevated", 13: "X7 Search funds benchmark"}
SKILLS = {1: ("NFPA 25/72/10 + Ohio 1301:7-7-09 cheat sheet", "1-page code cheat sheet"),
          2: ("EBITDA normalisation: add-backs vs owner replacement cost", "1-page adjustments memo on a case"),
          3: ("Rebuild the LBO from blank: sources & uses + P&L", "Your own sheet matching file 06 Base S&U"),
          4: ("Rebuild the LBO: debt schedule + DSCR", "Your DSCR within ±0.02x of file 06 Base"),
          5: ("Working-capital peg mechanics", "1-page explainer with a numeric example"),
          6: ("QoE red flags: cash revenue, add-back inflation", "List of 10 red flags with tests"),
          7: ("Purchase agreement basics: reps, indemnity, escrow", "1-page glossary with 12 terms"),
          8: ("Seller-note terms: IO, standby, subordination", "Term sheet for the Base seller note"),
          9: ("LOI anatomy: price, structure, exclusivity, conditions", "Annotated sample LOI (counsel-safe, personal study)"),
          10: ("Operator equity: profits interest, vesting, leaver terms", "1-page summary vs file 07 §4"),
          11: ("Environmental diligence: Phase I, AFFF/PFAS questions", "12-question environmental checklist"),
          12: ("First-100-days integration plan for an ITM target", "1-page 100-day plan"),
          13: ("IC memo writing", "Final 6-page thesis memo")}
ANSWERS = {1: "Walk me through your résumé", 2: "Why sell-side M&A?", 3: "Walk me through a deal you underwrote",
           4: "How do you normalise EBITDA?", 5: "What drives value in a services business?", 6: "Pitch me an industry (fire ITM)",
           7: "Walk me through an LBO", 8: "What is DSCR and why it matters", 9: "What is a working-capital peg?",
           10: "Tell me about a mistake", 11: "Why Cincinnati?", 12: "Work authorisation (approved phrasing)",
           13: "Full mock interview with a friend/mentor"}
FIRMS = {1: "FIRM-006 RKCA + FIRM-007 Silverstone", 2: "FIRM-008 REAG + FIRM-009 MelCap", 3: "FIRM-001 Roebling + FIRM-002 RC Capital",
         4: "FIRM-003 Brixey & Meyer + FIRM-004 Revitalize", 5: "FIRM-014 Stonehenge + FIRM-017 Centerfield",
         6: "FIRM-005 Northcreek + FIRM-015 Crane Group", 7: "FIRM-010 Cincinnatus + FIRM-011 Loring Group",
         8: "FIRM-012 Vigran + FIRM-013 Argentarii", 9: "2 QoE / transaction-advisory firms (find & verify)",
         10: "2 M&A law firms in Cincinnati (find & verify)", 11: "2 commercial banks' middle-market teams (find & verify)",
         12: "2 independent sponsors active in Ohio (find & verify)", 13: "Re-rank all 30 target employers"}
TARGET_ROWS = {1: 25, 2: 40, 3: 50, 4: 60, 5: 70, 6: 75, 7: 80, 8: 85, 9: 90, 10: 95, 11: 100, 12: 100, 13: 100}
FOUNDATION = {1: ("Write the household budget baseline together (actual last 3 months)", "Budget sheet with monthly total"),
              2: ("Open/label a separate high-yield account for the 2-3-yr reserve", "Account exists, named 'Reserve'"),
              3: ("Get 2 term-life quotes for each spouse", "4 quotes saved"),
              4: ("Get 1 long-term disability quote", "Quote saved"),
              5: ("List 3 estate attorneys for wills/POA (incl. QDOT question, file 14 §5)", "3 names + contact"),
              6: ("Run the first monthly money meeting (file 14 §7)", "Notes + 1 decision recorded"),
              7: ("Open/label the parents' fund account; set a monthly amount", "Account + amount set"),
              8: ("Pull free credit reports; check for errors", "3 reports reviewed"),
              9: ("Get 1 umbrella liability quote", "Quote saved"),
              10: ("Net-worth snapshot: liquid / retirement / illiquid columns", "Snapshot saved"),
              11: ("Shortlist 2 cross-border tax advisers for later (file 08 §6)", "2 names saved"),
              12: ("Reserve progress check vs spouse's goal", "% of target recorded"),
              13: ("90-day money review: what changed, next 90-day target", "1-page review")}


def g(action, mins, deliverable, done):
    return {"action": action, "min": mins, "deliverable": deliverable, "done": done}


def standard_day(w, wd):
    """wd: 0=Mon..6=Sun"""
    case = CASES[w]
    skill, skill_del = SKILLS[w]
    if wd == 0:  # Mon
        return [g("Tailor one résumé variant (rotate: M&A / TAS / PE-backed finance)", 30, "1 résumé file saved, dated", "File saved; no 'Financial Mathematics', no authorisation claim"),
                g(f"Case study part 1 — facts & economics: {case}", 45, "Case card fields 1-8 filled", "Every number has a source ID or 'n/d'"),
                g("Identify 2 new contacts (Circle 1-3, file 09 §8) and log in CRM", 25, "2 CRM rows with source URL", "2 rows saved with today's date")]
    if wd == 1:  # Tue
        return [g(f"Draft & rehearse interview answer: '{ANSWERS[w]}'", 30, "Written answer ≤200 words + 1 recorded run", "Said aloud twice; recording kept"),
                g(f"Grow the target list to {TARGET_ROWS[w]} rows (SFM certified companies, CBP, websites)", 45, f"Target sheet at {TARGET_ROWS[w]} rows", "Each row: name, city, source URL; no revenue guesses"),
                g("Send follow-ups due in CRM (follow-ups beat new names)", 25, "All due follow-ups sent", "CRM 'Follow-up due' count = 0")]
    if wd == 2:  # Wed
        return [g(f"Research employers: {FIRMS[w]}", 30, "2 employer notes (deal types, team, sector)", "Notes saved with source URLs"),
                g(f"Skill block: {skill}", 45, skill_del, "Deliverable saved in /bagga-acquisition-research/notes"),
                g("Request 1 informational conversation (never a job ask)", 20, "1 request sent", "Message sent and logged")]
    if wd == 3:  # Thu
        if w <= 2:
            net = g("Read 07 §1-3; write your 5 operator must-haves in your own words", 25, "5-line operator spec", "Saved")
        else:
            net = g("Operator pipeline: identify 1 potential operator (branch/service manager)", 25, "1 operator row in CRM", "Row has employer, title, source URL")
        return [g("Technical drill: 20 min LBO/accounting flashcards + 1 timed mini-model", 30, "Mini-model saved", "Completed within 25 min"),
                g(f"Case study part 2 — verdict (questions I-J): {case}", 40, "Verdict + 'what I'd negotiate'", "One-line lesson added to lessons log"),
                net]
    if wd == 4:  # Fri
        fa, fd = FOUNDATION[w]
        return [g("Update LinkedIn activity: comment thoughtfully on 2 posts from target firms", 20, "2 comments", "Posted; no claims of authorisation"),
                g("Industry reading: 1 trade/industry article on fire & life safety M&A; 3 bullet takeaways", 30, "3 bullets in research log", "Logged with URL + date"),
                g(fa, 30, fd, "Done and noted in money log")]
    if wd == 5:  # Sat (light)
        return [g("Light: read one chapter / article on M&A process (20 min)", 20, "3 bullets", "Logged"),
                g("Light: enrich 5 target rows (service lines, # locations from websites)", 30, "5 enriched rows", "Fields filled with source URL"),
                g("Light: 15 min — reply to any messages; protect the rest of the day for family", 15, "Inbox for contacts = 0", "Done")]
    # Sun — weekly review trio
    return [g("Weekly review: score the week (file 11 scorecard)", 25, "Weekly scorecard filled", "Score recorded on dashboard"),
            g("Risk register review (file 12) + set next week's acquisition focus", 20, "Updated register; next week's case chosen", "Initialled & dated"),
            g("Plan next week's outreach (names for Mon/Wed/Thu) + protected time with spouse", 20, "5 names queued; family block on calendar", "Calendar updated")]


OVERRIDES = {
    1: [g("Change degree to 'M.S. Finance' on résumé, LinkedIn, bios", 30, "Corrected résumé + LinkedIn", "Zero occurrences of 'Financial Mathematics'"),
        g("Run the 2 Census CBP queries (file 03 §A2); start target sheet from Ohio SFM certified-company records", 60, "Target sheet with ≥25 sourced rows", "≥25 rows, each with source URL"),
        g("Email 3 immigration attorneys (AILA directory) to book a consult; attach file 08 §5 AQ1-AQ10", 30, "3 emails sent", "3 sent; consult date requested")],
    2: [g("Apply the other résumé fixes in positioning-system/01-diagnosis.md §B", 40, "Résumé v-corrected", "All 4 flagged claims fixed or removed"),
        g("Read files 02 and 03 end-to-end; write the 3 reasons to reject fire in your own words", 40, "3-line note", "Saved"),
        g("Set up CRM tabs: Deal pros / Industry / Capital / Operators", 25, "CRM with 4 tabs + columns", "Tabs exist; 0 unsourced rows")],
    3: [g("Draft 'Why sell-side M&A?' answer", 25, "Answer ≤200 words", "Rehearsed aloud twice"),
        g("Case A2 worked example (file 05 §4): redo every calculation yourself without looking", 35, "Your own D-table for ABM/Able", "Your 12.8x and 8.3x match the file"),
        g("Follow up with attorneys not yet replied; confirm a consult date", 15, "Consult date confirmed or 2nd round sent", "Logged")],
    5: [g("Light: read file 04 'At a glance' table (20 min)", 20, "3 bullets", "Logged"),
        g("Start the NFPA 25/72/10 + Ohio 1301:7-7-09 cheat sheet (sources: S-30, S-32)", 30, "Half-page draft", "Saved; finish on Wed of week 2"),
        g("Light: 15 min — reply to messages; protect the rest of the day", 15, "Inbox for contacts = 0", "Done")],
    17: [g("Thanksgiving — light: 10 min re-read your 30-second introduction", 10, "Read once", "Done"),
         g("Light: note one thing learned this month about fire ITM", 10, "1 sentence", "Logged"),
         g("Family day. Send 1 thank-you note to someone who helped you", 10, "1 note", "Sent")],
    21: [g("Counsel consult target date: bring files 08 + positioning-system/18", 60, "Written answers or follow-up letter requested", "Answers saved to /06 Immigration"),
         g("Update file 08 §3 table with counsel's answers (permitted / not / pending)", 30, "Updated table", "Every row has a status"),
         g("Flag any activity now cleared/blocked in CRM + calendar", 15, "Flags updated", "Done")],
    30: [g("Phase-1 review: résumé variants ×3 done? 12 answers drafted? (file 11 milestones)", 30, "Milestone checklist", "Each item ✔ or reason written"),
         g("Phase-1 review: target list ≥60, 4 cases done, model rebuilt", 30, "Acquisition milestone checklist", "Each item ✔ or reason written"),
         g("Phase-1 review: contacts in CRM ≥10, 3 conversation requests sent; reserve % recorded", 30, "Network/money checklist", "Each item ✔ or reason written")],
    38: [g("Field test prep: write the 6 questions you'll ask (file 02 §6 factors)", 25, "Question list", "Saved"),
         g("Field test: request 3 short calls with FIRE managers/techs (former or current)", 30, "3 requests", "Sent & logged"),
         g("Field test: request 3 short calls with PEST managers/techs", 30, "3 requests", "Sent & logged")],
    39: [g("Interview answer: 'Pitch me an industry' — draft both fire and pest versions", 30, "2 pitches", "Saved"),
         g("Field test: hold/record notes from any fire or pest call; score factors 1-5", 45, "Call notes + scores", "Scores entered in overlay sheet"),
         g("Follow up unanswered field-test requests", 15, "Follow-ups sent", "Logged")],
    40: [g("Light career: update target employer list with any field-test insights", 20, "List updated", "Saved"),
         g("Field test: second batch of calls/notes; update overlay scores", 45, "Updated overlay", "data/cincinnati_overlay.csv edited with evidence"),
         g("Ask each contact: 'Who else should I talk to?' — log referrals", 20, "Referrals logged", "≥1 referral or 'none'")],
    41: [g("Technical drill: 30 min", 30, "Mini-model", "Done"),
         g("Field test: final calls; write a half-page per industry", 45, "2 half-pages", "Saved"),
         g("Thank-you notes to everyone who spoke with you", 20, "Notes sent", "Sent = calls held")],
    42: [g("Light: LinkedIn — 2 thoughtful comments", 15, "2 comments", "Posted"),
         g("Re-run python3 data/score_industries.py with updated overlay", 40, "New ranking output", "Output saved to notes"),
         g("Book next month's money meeting date", 10, "Date set", "On calendar")],
    43: [g("Update 09 §6 résumé thesis bullet for the chosen industry", 20, "Bullet updated", "Saved"),
         g("DECISION DAY: lock fire or switch to pest; write a one-page decision memo", 60, "Decision memo", "Signed & dated; files 01/02 updated if switched"),
         g("Tell your spouse the decision and what it means for the next 6 months", 20, "Conversation held", "Done")],
    44: [g("Interview answer refresh: 'Why this industry?'", 20, "Answer", "Rehearsed"),
         g("Insurance-agency primary research (3 hrs split: 60 min today): carrier appointment & change-of-control rules", 60, "Notes with sources", "≥3 primary sources"),
         g("Light: reply to messages; holiday plans", 10, "Inbox clear", "Done")],
    45: [g("Christmas Eve — light: 10 min reading", 10, "—", "Done"),
         g("Light: 10 min — note one question you still can't answer about the deal", 10, "1 question", "Logged"),
         g("Family time", 10, "—", "Done")],
    46: [g("Christmas — rest", 5, "—", "Done"),
         g("Rest", 5, "—", "Done"),
         g("Call parents", 15, "Call", "Done")],
    52: [g("Light: 15 min — write 3 career wins of 2026", 15, "3 wins", "Logged"),
         g("Light: 15 min — write 3 acquisition lessons of 2026", 15, "3 lessons", "Logged"),
         g("New Year's Eve with family", 5, "—", "Done")],
    53: [g("New Year — rest; glance at file 11 dashboard", 5, "—", "Done"),
         g("Rest", 5, "—", "Done"),
         g("Write next-90-day intention with your spouse (3 lines)", 20, "3 lines", "Saved")],
    60: [g("Phase-2 review: 8 informational conversations held? (file 11)", 30, "Checklist", "Each item ✔ or reason"),
         g("Phase-2 review: industry locked; 8 cases; thesis memo outline exists", 30, "Checklist", "Each item ✔ or reason"),
         g("Phase-2 review: 5 operator candidates; reserve % recorded", 30, "Checklist", "Each item ✔ or reason")],
    68: [g("Queue application packet #1-2 (NOT submitted until EAD + counsel)", 40, "2 packets in 'Queued' folder", "Each packet tailored; not sent"),
         g("Thesis memo: write sections 1-2 (question, market)", 45, "2 sections drafted", "≥1,000 words with sources"),
         g("If counsel cleared it: ask 1 commercial banker for an informational chat about LMM lending", 20, "1 request or 'not cleared' noted", "Logged")],
    75: [g("Milestone: 10 application packets queued? If not, queue the gap", 40, "Packets queued", "Count = 10"),
         g("Milestone: operator pipeline ≥10 names; rank top 3", 40, "Ranked list", "Top 3 have 2 sources each"),
         g("Milestone: 15 conversations requested to date", 20, "Count recorded", "Number on dashboard")],
    89: [g("Final mock interview (60 min) with a mentor; note 3 fixes", 60, "3 fixes", "Logged"),
         g("Thesis memo final proofread + source check (every number → S-xx)", 45, "Final memo PDF", "0 unsourced numbers"),
         g("Thank 5 people who helped this quarter", 15, "5 notes", "Sent")],
    90: [g("90-DAY REVIEW: career — score vs milestones; set next-90 career goal", 30, "Review page", "Signed & dated"),
         g("90-DAY REVIEW: acquisition — industry, operator pipeline, target list; next-90 goal", 30, "Review page", "Signed & dated"),
         g("90-DAY REVIEW: network & money — with spouse; next-90 goal; celebrate", 30, "Review page", "Signed & dated")],
}

# Thesis memo writing in weeks 10-13 (replace Thursday case part 2 in weeks 12-13? keep cases; use Friday reading slot)
THESIS = {10: "Thesis memo outline (6 sections)", 11: "Thesis memo section 3 (target profile) + 4 (economics)",
          12: "Thesis memo section 5 (risks) + 6 (recommendation)", 13: "Thesis memo full draft review"}

days = []
for i in range(90):
    date = START + dt.timedelta(days=i)
    dn = i + 1
    # week number: week 1 = Tue Nov 10 .. Sun Nov 15
    w = 1 if dn <= 6 else 2 + (dn - 7) // 7
    wd = date.weekday()
    goals = OVERRIDES.get(dn) or standard_day(w, wd)
    if dn not in OVERRIDES and wd == 4 and w in THESIS:
        goals[1] = g(THESIS[w], 45, THESIS[w] + " saved", "Word count ≥600 and every number sourced")
    if dn not in OVERRIDES and wd == 2 and w == 7:
        goals[1] = g("Insurance-agency research block 2 (60 min): small-agency multiples, retention — primary sources only", 60, "Notes", "≥3 primary sources")
    if dn not in OVERRIDES and wd == 3 and w == 7:
        goals[1] = g("Insurance-agency verdict: keep as research list, replace pest as alternate, or drop", 45, "Half-page verdict", "Decision recorded in file 02 §7")
    assert len(goals) == 3
    days.append({"day": dn, "date": date.isoformat(), "dow": date.strftime("%a"), "week": w, "goals": goals,
                 "total": sum(x["min"] for x in goals)})

PHASES = [(1, 30, "PHASE 1 — FOUNDATION", "Counsel booked & held · résumé corrected · thesis literacy · target list · model rebuilt"),
          (31, 60, "PHASE 2 — CONVERSATIONS & FIELD TEST", "Informational conversations · fire-vs-pest field test · industry locked · operator pipeline"),
          (61, 90, "PHASE 3 — PIPELINE-READY", "Thesis memo · 10 queued application packets · operator top-3 · 90-day review")]
MILESTONES = {7: "Counsel consult requested · résumé corrected · 25 target rows",
              14: "40 target rows · cases 1-2 done · code cheat sheet",
              21: "Counsel consult held (target) · LBO rebuild started · 10 CRM contacts",
              30: "PHASE-1 REVIEW · 60 rows · 4 cases · 3 résumé variants · 3 conversation requests",
              43: "INDUSTRY DECISION LOCKED (fire or pest)",
              60: "PHASE-2 REVIEW · 8 conversations · 8 cases · 5 operator candidates",
              75: "10 packets queued · operator pipeline 10 · 15 conversations requested",
              90: "90-DAY REVIEW · thesis memo final · 100 rows · 13 cases"}

out = ["# 10 — 90-Day Execution Calendar",
       "",
       f"**Day 1 = {START:%a %d %b %Y}** · **Day 90 = {(START + dt.timedelta(days=89)):%a %d %b %Y}** · Generated by `data/build_calendar.py` (edit there, re-run).",
       "",
       "**Rules:** exactly **three** goals a day, always in this order. **1 CAREER / INCOME · 2 ACQUISITION INTELLIGENCE · 3 NETWORK / FINANCIAL FOUNDATION.** Weekdays run 60–120 min, Saturdays ~60, Sundays ~65 (weekly review). Holidays are deliberately light.",
       "",
       "> **Status gate:** career tasks are *prepare and queue* until your EAD is in hand and counsel confirms (file 09). Any task touching fees, equity, signing or outreach to sellers waits for written counsel clearance (file 08).",
       "",
       "```mermaid",
       "flowchart LR",
       '    P1["Days 1-30<br/>FOUNDATION"] --> P2["Days 31-60<br/>CONVERSATIONS +<br/>FIELD TEST"]',
       '    P2 --> P3["Days 61-90<br/>PIPELINE-READY"]',
       '    P1 -.-> M1(("Day 21<br/>counsel"))',
       '    P2 -.-> M2(("Day 43<br/>industry locked"))',
       '    P3 -.-> M3(("Day 90<br/>review"))',
       "```",
       "",
       "## Milestones",
       "",
       "| Day | Date | Milestone |",
       "|---:|---|---|"]
for dn, txt in MILESTONES.items():
    out.append(f"| {dn} | {(START + dt.timedelta(days=dn - 1)):%a %d %b} | {txt} |")
out.append("")
for p0, p1, title, sub in PHASES:
    out += [f"## {title} (Days {p0}–{p1})", "", f"*{sub}*", ""]
    cur_week = None
    for d in days[p0 - 1:p1]:
        if d["week"] != cur_week:
            cur_week = d["week"]
            out += [f"### Week {cur_week} — case: {CASES[cur_week]} · skill: {SKILLS[cur_week][0]}", ""]
        date = dt.date.fromisoformat(d["date"])
        flag = f" · ⭐ **{MILESTONES[d['day']]}**" if d["day"] in MILESTONES else ""
        out.append(f"**Day {d['day']} · {date:%a %d %b %Y} · {d['total']} min**{flag}")
        out.append("")
        labels = ["1 CAREER", "2 ACQUISITION", "3 NETWORK/FIN"]
        for lab, x in zip(labels, d["goals"]):
            out.append(f"- [ ] **{lab}** — {x['action']} · ⏱ {x['min']} min · 📦 {x['deliverable']} · ✅ *{x['done']}*")
        out.append("")
(ROOT / "10_90_DAY_EXECUTION_CALENDAR.md").write_text("\n".join(out))
(ROOT / "print").mkdir(exist_ok=True)
(ROOT / "print" / "calendar.json").write_text(json.dumps({"start": START.isoformat(), "days": days, "milestones": MILESTONES,
                                                          "cases": CASES, "skills": {k: v[0] for k, v in SKILLS.items()}}, indent=1, ensure_ascii=False))
tot = [d["total"] for d in days]
print("days", len(days), "min/max/avg minutes", min(tot), max(tot), sum(tot) / len(tot))
wk = [d["total"] for d in days if dt.date.fromisoformat(d["date"]).weekday() < 5 and d["day"] not in (17, 45, 46, 52, 53)]
print("weekday min/max", min(wk), max(wk))
