# JARVIS progress

Status as of 2026-10-09. "Verified" means seen working in a running program, not just in a unit test.
Checks at this commit: Python 120 tests, ruff, mypy strict all pass. Portfolio: unit tests 25/25,
Jarvis loop approved at 10.0/10, build passes, browser e2e all passing.

## Phase 1: Discovery and architecture

- **IMPLEMENTED**: `docs/JARVIS_ARCHITECTURE.md` (current state, target design, data flow, security
  boundaries, autonomy levels, memory, visitor intelligence, Perspective Engine options, risks);
  `CLAUDE.md` engineering rules.
- **REMAINING**: none.

## Phase 2: Jarvis core

- **IMPLEMENTED**:
  - `core/tasks.py`: persistent task engine with statuses queued, planning, running,
    waiting_for_user, blocked, completed, failed, cancelled. Every step is logged, final states
    can't be changed, and running work is re-queued after a restart.
  - `core/policy.py`: risk levels 0-3, plus `strict` mode.
  - `core/router.py`: model routing, and Qwen model choice by Mac memory.
  - `core/notify.py`: notifications.
  - `core/activity.py`: activity feed.
  - `core/retry.py`: self-healing retries.
  - Tool registry: every tool has a level, schema, timeout and audit entry.
- **TESTED**:
  - `tests/test_core.py`: lifecycle, immutability, restart recovery, spoken summary from counts,
    policy, routing, retry.
  - `test_every_tool_has_a_level_and_writes_need_a_yes`.
- **VERIFIED**:
  - `jarvis-owner --serve --headless` in a container.
  - `/activity` and `/status` served from stored data.
  - 403 without the token, and 403 with a foreign Origin.
  - `--doctor` runs.
- **REMAINING**: none for this phase.

## Phase 3: Memory

- **IMPLEMENTED**: `core/memory.py` covers episodes, project states, decisions, preferences and
  keyword recall. Credential-like text is refused. Preferences feed the prompt but can't change
  the policy. Tools: `recall`, `record_decision`, `set_preference`.
- **TESTED**: memory layers, recall, and secret refusal (found and fixed a gap: `sk-ant-…` keys
  weren't caught).
- **REMAINING**: semantic (embedding) recall. Keyword recall is used for now; a local embedding
  model is a later option.

## Phase 4: Browser and research agents

- **IMPLEMENTED**:
  - Research: OpenAlex search with retraction flags, DuckDuckGo web search, reading pages,
    downloading arXiv and open-access PDFs (checked to really be PDFs).
  - `owner/workflows.py`: the persistent research task runs search → verify → rank → retrieve →
    report.md → notify.
  - `owner/browser.py`: optional Playwright window with open, snapshot, click (level 1; submit
    raises it to level 2) and type (level 2). Password and payment fields are refused. Page text
    is wrapped as data.
- **TESTED**:
  - Workflow end to end with a fake network: transient failure healed, retracted and
    unidentifiable papers excluded, non-PDF handled, report, notification, episode.
  - The no-results and crash paths.
  - Browser safety with a fake driver.
- **VERIFIED**: the real `PlaywrightDriver` against real (headless) Chromium. It classified the
  elements correctly (link, text field, password field marked sensitive, submit button, plain
  button), and typing and submitting worked.
- **BLOCKED**: live OpenAlex/arXiv calls from this build container. The network policy blocks
  them, so they are verified only with recorded responses.
- **USER INPUT REQUIRED**: run `pip install -e '.[browser]' && playwright install chromium` on the
  Mac to turn on the visible browser.

## Phase 5: Mac agent

- **IMPLEMENTED**:
  - Calendar (read, and create with a yes).
  - Mail drafts with a yes (there is no send tool).
  - Opening links and saved files.
  - macOS notification banners.
  - A confirmation dialog, used for requests that come from the website.
  - Every AppleScript call passes text as arguments, never as code.
- **TESTED**: argv safety, the `open_file` path restriction, the dialog parsing.
- **USER INPUT REQUIRED**: the first run on the Mac. macOS will ask for Calendar, Mail and
  microphone permissions.

## Phase 6: Voice

- **IMPLEMENTED**:
  - "Hey Jarvis" wake word (openWakeWord, free) and faster-whisper speech-to-text.
  - macOS `say`, picking the best British voice.
  - 6-second follow-up listening without the wake word.
  - A spoken "yes" approves steps.
  - Spoken task updates via the notifier, with quiet hours.
- **CAPABILITY GAP**:
  - True barge-in (interrupting Jarvis mid-sentence) isn't implemented. `say` plays to the end
    first.
  - Needed: echo-cancelled input plus a stoppable audio player. Planned next for voice.
- **USER INPUT REQUIRED**: download the Jamie (Premium) voice on the Mac (see the setup doc).

## Phase 7: Portfolio (website changes limited to Terminal and Jarvis, as instructed)

- **IMPLEMENTED**:
  - `portfolio/src/jarvis/sdk.ts`: client SDK, `createJarvis({application, contextProvider,
    token})`.
  - Pairing link.
  - The Terminal becomes the owner command center when paired: BRIEF, TASKS, ALERTS, YES, UNPAIR,
    live notifications, and free text sent to the Mac.
  - The Jarvis console routes to the Mac when linked.
  - Site knowledge index (85 entries).
- **TESTED / VERIFIED** (e2e, real Chromium, against the production build):
  - A visitor never calls the bridge and sees no change.
  - Pairing scrubs the token from the URL.
  - The brief shows needs-you, running, done and next.
  - Every call carries the token.
  - YES reaches the Mac with the app name.
  - Site commands still run locally.
  - UNPAIR forgets the token.
- **REMAINING**: none.

## Phase 8: Perspective Engine

- **BLOCKED**:
  - Perspective Engine is a claude.ai artifact. Its Content Security Policy forbids calls to
    `127.0.0.1`, so it can't reach the Mac gateway.
  - Its source is not in any connected repo.
- **USER INPUT REQUIRED**: choose one.
  1. Connect its source repo. It then gets `sdk.ts` with `application: "perspective-engine"`, the
     same way the portfolio does.
  2. Rebuild it as a page on the portfolio domain.
  3. Expose the gateway through Cloudflare Tunnel + Cloudflare Access (login-protected). This is
     more exposure, so only on request.
- No change was made to it, per the instruction to touch only the Terminal and Jarvis.

## Phase 9: Visitor intelligence

- **IMPLEMENTED**:
  - In-page anonymous signals: rage clicks, dead clicks, hunting scroll, stalls.
  - These drive restrained concierge help, with patience growing after a dismissal.
  - A `visitor_signal` event.
- **TESTED**: unit tests for the thresholds and for the rule that help is never shown while the
  visitor is engaged.
- **CAPABILITY GAP**: Cloudflare Web Analytics is aggregate only. It can't trigger per-visitor
  actions, and nothing claims it does.

## Phase 10: Proactivity

- **IMPLEMENTED**:
  - The opening line is built from stored state: tasks summary, overdue next steps, and the
    offered action.
  - "Yes, do it" works by voice, keyboard and the website Terminal.
  - Notifications for task complete, input needed and errors.
  - Visitor-side cooldowns.
- **REMAINING**: scheduled check-ins, such as a morning brief at a set time. Run at login via
  launchd for now (see the operations doc).

## Phase 11: Hardening

- **IMPLEMENTED / TESTED**:
  - SSRF checks, including after redirects.
  - Prompt-injection containment: page text is labelled as data, untrusted links need a yes, and
    there is no send tool.
  - Path restrictions.
  - Argv-only AppleScript.
  - Secret refusal.
  - Bounded retries.
  - Token and origin gate.
  - Documented in `docs/JARVIS_SECURITY.md`.

## Phase 12: Deployment

- **IMPLEMENTED**:
  - Setup guide (`docs/JARVIS_SETUP.md`).
  - Operations guide (`docs/JARVIS_OPERATIONS.md`), including a launchd run-at-login recipe.
  - Updated `.env.example`.
  - The website deploys through `scripts/deploy.sh`, which is gated on the Jarvis loop.
- **USER INPUT REQUIRED**: install on the Mac (setup doc), then run `jarvis-owner --doctor` and
  tell me the RAM figure if you want the model choice tuned.

## Still open from earlier work

- Search Console verification tag.
- LinkedIn and GitHub profile links (Jarvis tracks these as overdue next steps).
- The High Properties source.
- Instagram handle and captions.
- The HSBC consultant firm name (not shown until you confirm it).

## Incident 2026-10-09: wrong model, Ollama runner error, voice stalls

- **Root causes (confirmed in code):**
  - `jarvis/.env` was never read.
  - Only `JARVIS_`-prefixed variables were read.
  - The default model was `qwen3:8b` regardless of memory.
  - Qwen 3 "thinking" made every spoken reply slow.
  - The mic recorded Jarvis's own voice.
  - The silence threshold was fixed.
  - One failed model call could end the voice loop.
- **Root cause (on the Mac, from your report):** the `--no-map` runner error matches two Ollama
  installs of different versions. `--doctor` now detects this and prints the removal steps.
- **Fixed:**
  - Layered config: `--model` > `JARVIS_*` environment > `jarvis/.env` > memory-based auto.
  - The banner names the model's source.
  - Model warm-up at startup.
  - Plain-English model errors with no cloud fallback.
  - Mic muted while Jarvis speaks.
  - Room calibration.
  - Whisper VAD (speech filter).
  - Resilient conversation loop.
  - `--doctor`, `--voice-check`, and `--pair` (the pairing link is no longer in the startup log).
- **Tested:**
  - `tests/test_local_first.py`, 26 cases, including the qwen3:4b-vs-8b regression.
  - Full suite: 143 tests pass.
- **Verified:**
  - The real `jarvis-owner` against a stand-in Ollama server: model from `.env`, the banner
    matches the request, `think:false` was sent, and a clear exit when Ollama is down.
  - `--doctor` output.
- **BLOCKED here:**
  - Real Ollama/Qwen inference: the model download is blocked in the build container.
  - Microphone and speaker: there is no audio hardware here.
- **USER INPUT REQUIRED:** run `jarvis-owner --doctor`, then `jarvis-owner --voice-check`, on
  the Mac.
- **VERIFIED on the Mac (2026-10-09, `jarvis-owner --doctor`):**
  - arm64, macOS (Darwin 25.5), 8 GB.
  - Model `qwen3:4b`, read from `jarvis/.env`.
  - One Ollama install (Homebrew, 0.40.1); the client and server match.
  - Real inference through Jarvis's backend: 6.5 s on first load, 0.2 s warm.
  - Voice packages and macOS speech are present.
  - Port 8765 is free.
- **Next:** `jarvis-owner --voice-check` (microphone, transcription, wake word), then a live
  `--voice --serve` session.

### Follow-up: Jarvis spoke his reasoning (2026-10-09)

- **Root cause:**
  - Ollama's plain `qwen3:4b` appears to be a reasoning ("thinking") build. Its output matches:
    the reasoning ended in `</think>` with no opening tag.
  - Jarvis printed and spoke the raw reply.
  - The context note `[You just said to Siddharth: ...]` led the model to treat the
    conversation as a "simulation".
- **Fixed:**
  - Reasoning is stripped from every reply and from the conversation history, including replies
    cut off mid-thought.
  - Speech drops markup and is limited to a few sentences.
  - The context note is rephrased.
  - A new rule: never claim an action without calling its tool.
  - The 8 GB default is now `qwen3:4b-instruct` (non-thinking).
  - `--doctor` asks a real one-sentence question and flags a thinking model, with the fix.
- **Verified:** the real `jarvis-owner` against a stand-in Ollama returning the exact leaked
  reply prints and speaks only "Yes, Siddharth. I can hear you."
