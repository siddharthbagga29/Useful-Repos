# JARVIS architecture

One Jarvis platform, several clients. This document records what exists (verified by reading the
code), what is proposed, and where the security boundaries sit. Progress lives in
[JARVIS_PROGRESS.md](JARVIS_PROGRESS.md); engineering rules in [/CLAUDE.md](../CLAUDE.md).

## 1. Current architecture (verified, 2026-10-08)

| Area | What exists | Where |
| --- | --- | --- |
| Repository | One repo, `siddharthbagga29/Useful-Repos` (private). Apps live in folders, not a workspace. | `/` |
| Portfolio | Vite 8 + React 19 + framer-motion, TypeScript 7, static build | `portfolio/` |
| Deployment | GitHub Pages (`siddharthbagga29.github.io`, pushed by `portfolio/scripts/deploy.sh`), optional Cloudflare Pages mirror (inactive until two repo secrets exist) | `portfolio/deploy/` |
| Analytics | Cloudflare Web Analytics beacon (cookieless, aggregate RUM, no custom events) injected when `VITE_CF_BEACON_TOKEN` is set; first-party anonymous events to a Google Apps Script sheet (`track.ts`) | `portfolio/src/lib/track.ts` |
| Public Jarvis (browser) | Instant engine over the brief (intents, retrieval, citations, guard), optional on-device WebLLM, Web Speech in/out, "Hey Jarvis" wake mode in the browser, digest, research sub-agent | `portfolio/src/jarvis/` |
| Visitor concierge | Proactive sales playbook (critic-gated), tour protocol, studio voice clips (Kokoro/ElevenLabs), restraint rules | `portfolio/src/jarvis/sales/` |
| Quality gate | Actor-critic loop: tsc, Biome, tests, conversation/honesty/state/resilience scoring; deploys refuse unless it approves | `portfolio/src/agent/` |
| Jarvis service (Python) | Public FastAPI API (Claude/Ollama, guard, rate limits, contacts) and the owner agent on the Mac | `jarvis/` |
| Owner agent (Mac) | Tool registry with local JSON-schema validation, confirmation gate, audit log (JSONL), notes memory (SQLite), Mail/Calendar via AppleScript, openWakeWord + faster-whisper + `say` | `jarvis/src/jarvis/owner/` |
| LLM abstraction | `AgentSession` / answer backends for Anthropic and Ollama, scripted fakes for tests | `jarvis/src/jarvis/llm/` |
| Project status | `portfolio/agent/tasks.json` (owner's to-dos), Brain state (`brain/state.json`, GitHub Actions every 6 h) | — |
| Perspective Engine | A claude.ai artifact ("Perspective Engine City", built Vite app, `db` capability). **Its source is not in this repository or any branch of it.** | artifact `D4mz6TQGSr2Lcm6hCo2tTg` |
| MCP / tools in Claude Code | Robinhood MCP (trading workspace), skills in `.claude/skills/`. No Playwright MCP configured. | `.claude/`, `trading/` |
| Secrets | `.env` files are git-ignored; bridge token in `~/.jarvis/bridge_token` (0600) | — |
| Tests | Python: pytest (≈94), ruff, mypy. Portfolio: node:test agent suite, Playwright e2e (Python), lab checks, eval | — |

## 2. Proposed architecture

```
                         YOU  (voice · text · browser)
                                   │
            ┌──────────────────────┼─────────────────────────┐
            ▼                      ▼                         ▼
   Portfolio client         Perspective Engine client    Mac voice loop
   (public site + owner     (artifact; context adapter   ("Hey Jarvis",
    link when paired)        only, see §8)                follow-ups)
            │                      │                         │
            └──────────── Jarvis client SDK (sdk.ts) ────────┘
                                   │  authenticated (token + origin), 127.0.0.1
                                   ▼
                     ┌───────────────────────────────┐
                     │  JARVIS CORE (Python, Mac)     │
                     │  context · memory · tasks      │
                     │  policy · audit · activity     │
                     │  model router · notifier       │
                     └──────────────┬────────────────┘
                                    │ tool router (validated, risk-tiered, timed, audited)
          ┌───────────────┬─────────┴──────┬────────────────┬───────────────┐
          ▼               ▼                ▼                ▼               ▼
     Research agent   Browser agent    Mac tools       Site knowledge   Project status
     OpenAlex, web    Playwright       Mail drafts,    site-index.json  tasks.json, Brain,
     search, arXiv    (optional) /     Calendar, open, (85 entries)     git log
                      open+read        notifications
```

Public visitors never reach the core: the public site ships no token, and the core listens on
127.0.0.1 only. Visitor Jarvis stays the in-browser engine over public knowledge.

### Module layout (adapted to this repo rather than forced into a new monorepo)

```
jarvis/src/jarvis/
  core/        tasks.py (task engine) · policy.py (risk levels) · memory.py (episodic, project,
               decisions, preferences) · activity.py (feed) · router.py (model routing) ·
               notify.py (speech, macOS notifications)
  owner/       agent.py (operating loop) · tools.py (registry) · research.py · site.py ·
               browser.py · bridge.py (127.0.0.1 gateway) · voice.py · mac.py · cli.py
  llm/         provider abstraction (Anthropic, Ollama, fakes)
  public/      public API (unchanged)
portfolio/src/jarvis/
  sdk.ts       client SDK: createJarvis({ application, contextProvider })
  owner.ts     pairing + transport to the Mac gateway
```

## 3. Data flow: "Jarvis, find three recent papers on agentic memory and save the best one"

1. Voice loop: wake word → faster-whisper → text.
2. Agent loop (OBSERVE → UNDERSTAND → PLAN): the model calls `start_research(topic)`.
3. Policy engine: `start_research` is level 0 (read-only + writes inside `~/Jarvis/research/`).
4. Task engine creates a persistent task (`queued → running`), each step recorded as an action.
5. Research agent: OpenAlex search → verify each candidate (resolvable link, year, citation count,
   second-source check against arXiv/DOI) → retrieve open PDFs into `~/Jarvis/research/<slug>/`
   → write `report.md` with citations → task `completed` (or `waiting_for_user` / `failed`).
6. Episodic memory records the outcome; activity feed and audit log update.
7. Notifier: macOS notification + spoken summary built from task data, never from a guess.

## 4. Security boundaries

| Boundary | Control |
| --- | --- |
| Public web → Mac | No route. Gateway binds 127.0.0.1; every request needs the pairing token (constant-time compare) and an allow-listed Origin; Private Network Access headers only for those origins. |
| Model → tools | Tools are an allow-list. Arguments are validated locally against JSON Schema before anything runs. Unknown tools are rejected and audited. |
| Risk | Policy levels 0–3 (§5). Level 2–3 need an explicit yes (spoken "yes/confirm", macOS dialog, or terminal). No tool exists for sending email, paying, deleting files, changing credentials or running arbitrary shell. |
| External content | Pages, papers, search results and tool output are DATA. The prompt says so; the URL ledger only lets Jarvis auto-open links found by his own tools or on trusted hosts, so a planted link needs a yes. |
| SSRF | `read_webpage` accepts public `https://` only; localhost, private ranges, `.local/.internal/.lan` are refused. |
| Paths | File writes are confined to `~/Jarvis/` and `~/Downloads/Jarvis/` (resolved-path check). |
| Secrets | Environment / Keychain only; never in memory, prompts, logs or the repo. |
| Self-modification | Learned preferences are stored separately from policy; policy changes are a code/config change by the owner. |

## 5. Autonomy levels (policy engine)

| Level | Behaviour | Examples |
| --- | --- | --- |
| 0 automatic | runs, audited | site lookup, status, search, read page, summarise, research task, task-state updates |
| 1 automatic in scope | runs, audited, scope-checked | open links Jarvis found / trusted hosts, save to `~/Jarvis/`, download a paper, open a downloaded file |
| 2 confirm | waits for a yes | calendar events, email drafts, remembering a note, opening an untrusted link, browser form submission |
| 3 always confirm | waits for a yes, every time, even in permissive configs | anything financial, credential, security or destructive (no such tools exist today) |

`JARVIS_AUTONOMY=strict` raises every level-1 action to level 2.

## 6. Memory

| Layer | Store | Contents |
| --- | --- | --- |
| Working | agent session | current conversation and task |
| Episodic | SQLite `episodes` | dated events: research done, actions taken, outcomes |
| Project | SQLite `projects` + `tasks.json` | per-project state and the owner's to-dos |
| Decisions | SQLite `decisions` | decision, reason, project, source, date |
| Preferences | SQLite `preferences` | learned and explicit preferences (never policy) |
| Notes | SQLite `notes` (existing) | things the owner asked Jarvis to remember |

## 7. Visitor intelligence (portfolio)

Cloudflare Web Analytics stays the aggregate performance/RUM layer; it does not provide per-visitor
custom events and is not used to drive interventions. A first-party, anonymous, session-scoped
detector (`sales/signals.ts`) spots rage clicks, dead clicks, back-and-forth scrolling and long
stalls; the concierge's existing restraint rules (cooldown, per-visit cap, once per line, never while
typing, "Not now" silences) decide whether to offer help. No keystrokes, form contents, audio or
identity are captured. Counts go to the existing anonymous event sheet.

## 8. Perspective Engine

It is a claude.ai artifact. Its page cannot call `127.0.0.1` (the artifact sandbox blocks network
requests to other hosts), so it cannot reach the Mac core directly. Options, in order:
1. The artifact's own runtime capabilities (its `db`, and asking Claude) for an in-artifact Jarvis
   that knows the artifact's context; no Mac actions.
2. A public, authenticated gateway (Cloudflare Tunnel + Access in front of the bridge) once the
   owner wants Mac actions from anywhere; requires his Cloudflare account and a decision.
3. Reuse `sdk.ts` with a Perspective Engine context provider once its source repository is connected.

## 9. Risks, assumptions, open questions

- **Risk:** local model quality limits tool use; mitigated by the router (§ router.py) and a cloud fallback the owner can enable.
- **Risk:** voice false positives on "yes"; the accepted phrases are a short fixed set and silence declines.
- **Assumption:** the Mac is Apple Silicon with ≥16 GB RAM; `jarvis-owner doctor` checks and recommends a model.
- **Open:** where Perspective Engine's source lives (needed for phase 8).
- **Open:** whether to expose the gateway beyond the Mac (Cloudflare Tunnel + Access).
- **Open:** Playwright on the Mac (`pip install -e '.[browser]' && playwright install chromium`) versus open+read fallback.
