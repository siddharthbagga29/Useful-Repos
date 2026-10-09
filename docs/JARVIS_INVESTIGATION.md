# Jarvis repair log: false LinkedIn success, wake word per turn, model consistency

Date: 2026-10-09.

**Where the work ran:**
- Code, tests and real Chromium: this build container. It has no microphone or speaker, cannot
  reach Ollama's model registry or linkedin.com, and has no connection to your Mac.
- Real Ollama/Qwen, the microphone and LinkedIn: only on your Mac.

**Baseline:**
- Branch `claude/resume-one-page-keywords-lfau66`, clean tree at `16f5897`.
- 177 tests passing.
- Entry point `jarvis-owner` (`jarvis.owner.cli:main`), Python 3.12 venv on the Mac.
- Model from `jarvis/.env`.

## Bug A: "I added your portfolio to LinkedIn" when nothing had changed

**Evidence from the code (the Mac's `~/.jarvis/audit.jsonl` would show the exact call;
`jarvis-owner --actions` now prints it):**
- No tool could edit LinkedIn.
  - `open_url` only opens a page.
  - The optional `browser_*` tools use a throwaway browser with no LinkedIn session. On the Mac,
    Playwright wasn't installed, so they returned "CAPABILITY GAP".
- The agent returned the model's final sentence unchecked.
- A 4B model asked to "open LinkedIn and add my portfolio" can open the page (or fail to) and
  then say it's done. Nothing stopped that sentence reaching you.

**Hypotheses from the brief, settled:**
- **Confirmed as the cause:**
  - 1: it only opened LinkedIn.
  - 2: the editing capability was missing.
  - 8 and 11: success was reported without execution results.
  - 12: the tool layer and the model's report disagreed.
- **Not applicable:**
  - 3 to 7, 9 and 10: these all need real browser control of an authenticated LinkedIn
    session, which didn't exist.

**Fixed:**
- **`owner/agent.py`:**
  - An action ledger records what ran, with its outcome and a turn ID. The same turn ID appears
    in the audit log.
  - A false-claim guard: a reply claiming a change ("I've added …") is replaced with a correction
    unless a state-changing action actually succeeded.
  - Self-reporting tools (`Tool.speaks`): their own verified outcome is the reply, so the model
    can't rephrase BLOCKED as done.
  - The last action is passed to the next turn, so "where did you put it?" resolves from the
    record.
  - A new `recent_actions` tool.
- **`owner/linkedin.py`:**
  - Workflow: check current state, open the editor, fill the field, save once, then reload and
    look for the link.
  - Statuses: VERIFIED, ALREADY_PRESENT, ASSISTED, NEEDS_LOGIN, BLOCKED, FAILED, UNVERIFIED,
    NOT_FOUND, UNAVAILABLE.
  - Save is never retried, to avoid duplicates.
  - Assisted mode is the default because LinkedIn's User Agreement prohibits automated tools.
    Automated mode is an opt-in, using Jarvis's own Chromium profile that you sign into yourself.
- **Tests:**
  - `tests/test_truthful.py` reproduces Bug A and covers the guards.
  - `tests/test_linkedin.py` runs real Chromium against a stand-in site
    (`tests/linkedin_site.py`) for all ten failure modes in the brief.
- **Mutation check:** with the verification step removed, two of those tests fail. So a reported
  success really does depend on the reload.
- **Real-CLI reproduction:** a stand-in Ollama whose model opens LinkedIn and then claims it's
  done. The output is now: "To be accurate: I haven't done that, and nothing was changed. What
  actually ran: open https://www.linkedin.com/in/siddharth-bagga-sid29/ (error)". In this
  container `open` doesn't exist; on the Mac it reads "(ok)".

**Not verified:**
- The live LinkedIn editor's labels ("Add website", "Website URL", "Website type", "Save") come
  from LinkedIn's current UI and haven't been checked against the live site. If they differ, the
  workflow reports BLOCKED ("couldn't find the Website field"), never success.

## Bug B: "Hey Jarvis" needed before every turn

**Evidence:**
- After each answer the loop listened for `follow_up_seconds` (6 s), then went back to the wake
  word. That window was the only "session".
- The microphone kept the whole wait before speech, so up to the full wait went to Whisper on
  every turn.
- There was no barge-in.
- There was no protection against acting on a mis-heard command.

**Fixed:**
- **`owner/session.py`:** an explicit state machine (STANDBY, LISTENING, THINKING, SPEAKING,
  INTERRUPTED, RECOVERING, ERROR).
  - One wake word opens a conversation, which stays open until `SESSION_IDLE_SECONDS` (default
    30) of silence or an exit phrase ("go to sleep", "that's all").
  - "Hey Jarvis, do X" works in one breath.
  - Low-confidence transcripts are never acted on; he asks again.
  - Two unclear turns in a row return him to standby.
  - Microphone errors reopen the device, at most 3 times with backoff, then ERROR.
  - Every transition and turn is logged with timing to `~/.jarvis/events.jsonl`, without
    transcripts.
- **`owner/voice.py`:**
  - 0.3 s lead-in instead of the whole wait.
  - The listening chime is skipped by the recorder.
  - Whisper confidence is measured.
  - Device `reopen()`.
  - Barge-in: "Hey Jarvis" while he's speaking stops `say`.
- **Tests:**
  - `tests/test_session.py` (scripted microphone): one wake word then 5 turns, a pronoun
    follow-up, exit phrases, unclear speech, the opening line, barge-in, microphone recovery and
    permanent loss, and standby-then-wake.
  - `tests/test_voice_audio.py` (synthetic audio frames): lead-in trimming, timeout, the chime,
    and barge-in killing speech.

**Limits:**
- Listening and speaking are not simultaneous: macOS `say` has no echo cancellation, so only the
  wake word can interrupt him, not arbitrary speech.
- Real microphone and recognition quality are only testable on the Mac
  (`jarvis-owner --voice-check`, then a live session).

## Bug C: model and configuration consistency

**Evidence:**
- One model, `JARVIS_OLLAMA_MODEL`, serves every agent turn. There are no sub-agents with other
  models; transcription is faster-whisper and speech is macOS `say`.
- `JARVIS_FAST_MODEL` and `JARVIS_RESEARCH_BACKEND` were documented but never read.
- Nothing checked that the model can call tools. A model without tool support would chat but
  never act, which is another route to "I did it".
- Plain `qwen3:4b` is a "thinking" build: 12.5 s for one sentence on the Mac.

**Fixed:**
- The dead settings are removed, and `--doctor` names them if they're still set.
- `check_model` reads Ollama's `/api/show` capabilities at startup and in `--doctor`:
  - no `tools` capability: refused, with the fix;
  - `thinking` capability: noted as slow.
- `scripts/start.sh` switches a thinking model to `qwen3:4b-instruct` (it keeps a backup of
  `.env`).

**Tests:**
- Capability refusal and the notes.
- A model missing according to `/api/show`.
- A malformed tool call is rejected, never executed.

## Results

- **Python:** 207 tests, ruff, ruff format and mypy strict all pass. That includes 12 LinkedIn
  tests in real Chromium against the stand-in site.
- **Real Ollama, microphone, speaker and live LinkedIn:** blocked from this container. Each is
  covered by a test you run on the Mac (`--doctor`, `--voice-check`, a live session, and one
  authorised LinkedIn run).
