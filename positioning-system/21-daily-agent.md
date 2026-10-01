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

## §2. What it does each morning

| Step | Action | Priority logic |
|---|---|---|
| 0 | Load context, memory, runbook, live workbook | — |
| 1 | Check Gmail for replies from CRM contacts | A reply outranks everything |
| 2 | **Follow-ups due** — up to 3 Gmail drafts | Maintenance beats prospecting, always |
| 3 | One new contact, sourced from a firm team page | Only if the follow-up queue is under three |
| 4 | Advance the live portfolio project with one bounded research pull | Wednesdays: five companies to the radar |
| 5 | Event pre-brief if one is within 48h; calendar blocks | — |
| 6 | Guardrails — counsel flags, unverified rows, stale verifications | Surfaced at the top of the report |
| 7 | Rewrite memory, commit, send you one report | — |

Monthly it runs a fund-close screen against **SEC Form D filings** by Ohio,
Kentucky and Indiana managers — the public proxy for the PitchBook screen in
`20-pitchbook-playbook.md` §2, since the agent has no PitchBook access and
could not lawfully use yours.

---

## §3. The line it will not cross

**It drafts. You send.** It will never send an email to a third party. Drafts
land in Gmail; the only message it sends is the report to you.

This is deliberate, and it is not timidity:

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
| Let it send email | Tell me explicitly. I will not make that change on my own |

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
