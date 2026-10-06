# Agent Memory

The agent rewrites this file at the end of every run and reads it at the start of
the next. This is where "learning" actually lives — not in model weights, but in
an accumulating record of what worked for *this person* in *this market*.

Keep it under ~300 lines. When it grows past that, compress the oldest entries
into the Standing Lessons section and delete the detail.

---

## Standing lessons (what has proven true, carried forward)

- *(nothing yet — first run will begin populating this)*

## Open questions the agent is tracking

- Does UC's PitchBook licence still work, and what are its exact export limits?
- Marla at JPMorgan: full name and title still unknown. She initiated the Allyson
  referral, which makes her the more valuable node.
- Has the immigration consultation been booked? Several decisions are gated on it.
- Which Project 1 sector did he choose? (commercial & industrial services is the
  recommendation — closest to his actual Turnkey experience)

## Things that produced a reply

| Date | Who | Channel | What the message did | Outcome |
|---|---|---|---|---|
| | | | | |

## Things that produced nothing

| Date | What was tried | Why it probably failed |
|---|---|---|

## Infrastructure facts established by diagnosis (do not re-derive)

Verified 2026-10-06 from `get_session` on cse_012YXDNXuNcgi3mgdczaKTy2, a real
fired run — not inferred.

- **Fired sessions have NO connectors.** Their tool list is: Bash, Write, Edit,
  Read, Glob, Grep, Agent, NotebookEdit, WebFetch, WebSearch, TaskStop, Artifact,
  and the claude-code-remote MCP (add_repo, check_repo_access, list_repos,
  trigger tools). **No Gmail, no Google Drive, no Google Calendar.**
- Consequence: a fired run cannot email, cannot read the workbook, and cannot
  leave Gmail drafts until the owner attaches connectors to the Routine at
  claude.ai. This is not fixable from inside a session.
- **Fired sessions start with no repository attached** (`sources: []`). `add_repo`
  must be called before any clone.
- The fired session **does** have the `Artifact` tool — so a report can always be
  delivered as a published page even with no Gmail and no repo. That is the
  third delivery channel.
- Failure mode observed twice: the run ends in ~90 seconds having produced
  nothing and said nothing. The prompt now mandates a minimum viable run
  (one Census CBP pull, which needs only WebSearch/WebFetch) and a three-channel
  delivery chain, so a blocked run still produces and still reports.

## Corrections — mistakes made and the rule now in force

| Date | Mistake | Rule added |
|---|---|---|
| 2026-10-06 | Built the daily agent assuming fired sessions inherit the parent's connectors and repo. They inherit neither. Two scheduled runs and one manual test produced nothing, silently. | Never assume a scheduled session's environment. Inventory tools at the start of every run, define a minimum viable run that needs no connectors, and deliver through a fallback chain. |
| 2026-10-01 | Dashboard baseline scores were documented as B22:B25; the real block is rows 36–39, so four live formulas were overwritten. | Verify a cell reference against the built sheet before instructing a paste. Now moot: `repairDashboard_()` restores any clobbered Dashboard formula on every daily run. |

## Per-specialist lessons

What each agent has learned about doing its own job well for this person.

| Specialist | Lesson | Added |
|---|---|---|
| research-analyst | | |
| people-sourcer | | |
| company-radar | | |
| portfolio-builder | | |
| outreach-writer | | |
| verification-auditor | | |
| opportunity-scout | | |
| quality-overseer | | |

## Run log

| Date | Score | Loops | Outputs | Defects named | Flags |
|---|---|---|---|---|---|
