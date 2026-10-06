# The Daily Agent

Replaces the reminder email. A fresh Claude session fires every morning, reads
the live workbook and its own memory, does real work, leaves it for you to
review, and records what it learned.

Routine ID: `trig_014V1pDpCcciWTf4HWjZ2kn9` · fires **07:30 ET daily**

---

## §1. What "trained" actually means here

There is no fine-tuning. Be clear-eyed about the mechanism, because it determines
what the agent can and cannot become:

| Layer | File | What it does |
|---|---|---|
| **Standing context** | `agent/CONTEXT.md` | Your verified facts, constraints, market, hard rules. Read in full every run. This is the "training." |
| **Procedure** | `agent/RUNBOOK.md` | The seven steps it executes, in priority order |
| **Memory** | `agent/MEMORY.md` | Rewritten at the end of every run, read at the start of the next. Standing lessons, what got replies, what failed, corrections |
| **Live state** | The Google Sheet | Who is overdue, what is in progress, what is flagged |

**The evolution is real but it is bounded.** Each run is a cold session that
becomes competent by reading those four things. What accumulates is the *record*,
not the model. In practice that is most of what you wanted: by week six the agent
knows that the critique ask gets replies and the generic follow-up does not,
because a previous run wrote that down.

What it will never do is develop intuition you did not write down. So the memory
file is the asset — if a run reports something useful and you disagree, correct it
there, and every future run inherits the correction.

---

## §2. The team

One orchestrator dispatches eight specialists, each defined in `.claude/agents/`
with its own instructions, tools and standards. Nothing reaches you ungated.

| Agent | Does | Model |
|---|---|---|
| **research-analyst** | Census CBP, BLS QCEW, SEC EDGAR, Form D, Ohio SOS. Every figure carries a reproducible query URL | sonnet |
| **people-sourcer** | Named contacts from firms' own team pages, titles verbatim, second-sourced | sonnet |
| **company-radar** | Target companies by NAICS and county. Never a private-company financial | sonnet |
| **portfolio-builder** | Advances the live project. Assumption register, sensitivities, returns attribution, downside-first | sonnet |
| **outreach-writer** | Messages in your voice. Refuses to draft without a real reason to write | opus |
| **opportunity-scout** | Fund closes, events, openings — each eligibility-screened before it is surfaced | sonnet |
| **verification-auditor** | Adversarial. Fetches every cited URL and checks it says what was claimed | sonnet |
| **quality-overseer** | Scores the day 0–10. Gate at 9.5. Its job is to fail work | opus |

**Dispatch is conditional, not habitual.** The orchestrator reads live state and
sends only what today needs: follow-ups due → outreach-writer; no uncontacted
people left → people-sourcer; Wednesday → company-radar; first of the month →
opportunity-scout's SEC Form D fund-close screen.

**Priority when time is short:** replies → follow-ups → research → everything else.

---

## §2b. The quality gate

Every run is scored out of 10 across six dimensions before anything reaches you:
legitimacy 2.0 · credibility 2.0 · research depth 2.0 · analysis quality 2.0 ·
deep thinking 1.5 · usefulness 0.5. Full rubric: `agent/QUALITY-RUBRIC.md`.

**Below 9.5 → remediate and resubmit, maximum two loops**, then ship with the
score and every unresolved defect stated at the top of the report.

Three things make the score mean something rather than being self-flattery:

1. **It is arithmetic, not impressionistic.** The overseer counts sourced claims,
   dead links, tier violations and eligibility checks. The number follows from the
   counts.
2. **No score above 9.0 without a named defect.** If it cannot point at something
   specific, the review did not happen and the score is void.
3. **Eight hard-fail conditions cap the run at 4.0** regardless of volume — an
   unsourced claim, a fabricated figure, a draft implying you can work now, a role
   surfaced without an eligibility check. One integrity failure cannot be averaged
   away by producing a lot of other things.

**Read it as self-assessment, because it is.** It reliably catches sloppiness and
fabrication. It cannot certify that a judgment call was wise — that is what your
verification pass over "DATA ADDED" is for.

Expect early runs to score in the 8s. A system that hits 9.5 on day one is
grading itself generously.

---

## §3. Autonomy — what runs without you

Everything except one thing:

- All research, data pulls and analysis
- Sourcing named people; building the company radar
- Advancing the portfolio project
- Event and opportunity discovery, including eligibility screening
- Verification sweeps; writing the queue, memory and reports; committing and pushing
- Scoring the work and remediating it

**The one exception: messages to third parties stop at Gmail Drafts.** Everything
up to the send is automated — the research, the choice of who to contact, the
personalised message. You click send.

That is about reversibility, not caution. Every other action is undoable: a bad
row gets deleted, a bad memo rewritten. A message sent to a partner at a
four-person Cincinnati firm while your authorisation is pending is not undoable,
and the market is small enough that one of them costs the cluster rather than the
contact. **Say the word and I will lift it** — it is one line in the context file.

Beyond that:

1. **You are mid-adjustment-of-status.** A message that implies you can work now
   is a problem no apology fixes.
2. **Cincinnati private capital is a few hundred people.** One bad send to a
   partner or a recruiter is not one lost contact — it is the cluster.
3. **The message is the product.** Drafting is where you decide what you actually
   think about someone's market. Automate that and you have automated away the
   thing being built. `11-automation-architecture.md` §4 made this argument before
   the agent existed; the agent does not get an exemption.

It also will not: claim you are authorised to work, accept or solicit anything of
value, submit an application, form an entity, invent a person or a figure, or
mention a role without checking the posting requirements against your record.

---

## §3b. The report you get

Format is fixed, and it leads with work done, never with a task list:

```
WHAT I DID TODAY        every output, one line, with where it is
DATA ADDED — VERIFY THIS  every row written, each with its source URL
QUALITY SCORE: X.X / 10   dimension scores + named defects
FLAGS                   counsel review, eligibility closed, blocked items
WHAT I LEARNED          the one lesson written to memory
WAITING ON YOU          usually "nothing"
```

**"DATA ADDED — VERIFY THIS" is the section you asked for.** One click per row to
check it against its source. That is your whole job in this system now.

## §4. If it has no connectors

The Routine was created without Gmail / Drive / Calendar attached — this plan
does not allow pinning connectors to a Routine from inside a session.

**Degraded mode** (what happens until you fix it): the agent cannot read the
workbook or leave Gmail drafts. It still clones the repo, does research, writes
each intended draft in full to `agent/drafts/YYYY-MM-DD-<name>.md`, writes the
report to `agent/reports/YYYY-MM-DD.md`, updates memory, and commits. Nothing is
lost — you read it in the repo instead of your inbox.

**To fix:** open the Routine in claude.ai → Settings → Routines, and attach
Gmail, Google Drive and Google Calendar. Then it runs at full capability.

---

## §5. Controlling it

| Want | Do |
|---|---|
| Pause it | claude.ai → Routines → disable, or ask me to disable `trig_014V1pDpCcciWTf4HWjZ2kn9` |
| Change the time | Ask me — currently `30 11 * * *` UTC = 07:30 ET. **Shifts to 06:30 when EST begins in November**; tell me and I'll move it |
| Change what it does | Edit `agent/RUNBOOK.md` and push. The next run reads the new version |
| Change what it knows | Edit `agent/CONTEXT.md` |
| Correct a lesson | Edit `agent/MEMORY.md` — corrections there are permanent |
| Let it send outreach email | Tell me explicitly. I will not make that change on my own |
| Change the quality bar | Edit `agent/QUALITY-RUBRIC.md`. 9.5 is demanding by design |
| Add or retire a specialist | Add or remove a file in `.claude/agents/` and update the dispatch table in `agent/RUNBOOK.md` |

---

## §6. What to watch in the first two weeks

The failure mode of an agent like this is not that it breaks — it is that it
keeps producing plausible output you stop reading.

Three checks:

1. **Is every draft specific?** If one reads like it could go to anyone, the
   agent is padding. Tell me and I will tighten the tone rules.
2. **Is the memory file accumulating real lessons** — or restating the runbook?
   "The critique ask got a reply" is a lesson. "Made progress on outreach" is not.
3. **Does the report ever say the run was thin?** If every day looks productive,
   it is flattering you. An honest thin report is the signal it is working.

Reset the loop at week two: read the fourteen reports together and ask which
single activity actually produced a second conversation. Then tell me, and I will
rewrite the runbook around that.
