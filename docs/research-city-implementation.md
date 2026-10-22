# Research City 2.0: implementation log

**Current phase:** iterations 1–4 are pushed (feature branch at `17a6ea7`). Iteration 5 (shape legend, kind labels in the work index, action-pin check) is committed locally and not pushed. Nothing is deployed.

| Status | Items |
|---|---|
| IMPLEMENTED | Manifest, event model, feeds, city refactor, case pages, nav and work index, Brain workflow fix (source) |
| TESTED | All of the above: unit tests, e2e and the quality gate (results below) |
| VERIFIED | In a production build served locally, headless Chromium at 1440 px and 390 px. Not on the live site or on a real iPhone |
| REMAINING | Home-page accessibility findings (needs approval); visual polish (see Next steps) |
| BLOCKED | Total-return data and refresh; High Properties' deployed functions |
| USER INPUT REQUIRED | Deploy approval; Sentinel visibility; default-branch payload clean-up |

The audit, risk register and baseline are in [research-city-audit.md](research-city-audit.md).

## What changed, and where

| Area | Files | What it does |
|---|---|---|
| Canonical inventory | `portfolio/src/research/manifest.ts` | 8 projects with stable ids, district, category, data source and freshness tolerance, pipeline, repository paths, limitations and agents. Each milestone has an **evidence grade**: deployed, validated, result, tested, implemented, unverified or planned. No runtime status lives here |
| Presentation | `layout.ts` | Plots and colours, kept separate so layout can't change claims |
| Event model | `events.ts` | Schema v1, `validateEvent` (rejects with a reason, never throws), safe-link allowlist, dedupe by `eventId`, bounded history (200), explicit `TRANSITIONS` table, `reduce()` to one state per project, derived staleness, an `unseen()` replay guard |
| Validation | `validation.ts` | Research validity, judged apart from job execution. Three checks: deflated Sharpe ≥ 95%, holdout Sharpe above SPY's, holdout drawdown within 5 pp of SPY's. The best possible result is "provisional", never "validated" (price-only data; the holdout has been shown publicly) |
| Sources | `sources.ts`, `scripts/city-evidence.ts`, `evidence.json` | Converts verified records into events: GitHub Actions runs (Brain, Jarvis CI), Brain promotions, git commits, lab-check and the release gate at build time |
| Feed | `feed.ts` | One shared store (`useSyncExternalStore`) that starts from the build snapshot. It refreshes the public Actions run lists at most once per 10 minutes per session (2 unauthenticated calls), falls back without guessing, derives staleness every minute, and keeps the animation queue and marker. `?demo=events` runs a labelled demo |
| City | `City.tsx`, `city.css` | Still by default. Bots move only while a job is verifiably running, once per new event, or on an explicit replay. Status tags combine text and icon (RUN OK, FAILED, STALE, DATA STALE), not colour alone. Adds search, district and status filters, selection focus, a timeline tab, an evidence-graded dossier and the data conduit (amber when stale). The camera is bounded |
| Case studies | `scripts/case-pages.ts`, `research/<id>/index.html`, `case.tsx`, `CaseStudy.tsx`, `CaseModules.tsx`, `cases.ts`, `case.css` | A real page per project with 12 sections in an order suited to the project type. Analytical modules compute from the same artifacts the site uses: DCF grid from `valueDcf`, OPS, cost sweep and Monte Carlo from `research.json`, deal analysis and simulation from `deal/model.ts`, run ledgers from Actions, Brain validation from the state |
| Navigation | `SiteNav.tsx`, `WorkIndex.tsx` | Global navigation: Overview, Research City, four disciplines, About; a menu on narrow screens. A plain work index lets the portfolio read without the city |
| Brain reliability | `deploy/brain.yml`, `scripts/brain-run.ts`, `src/brain/engine.ts` | Checks out `main`. `--min-gap-hours 2` skips duplicate scheduled runs (the cause of run #49). Records `provenance` (run id, number, sha, data as-of) |
| Honest copy | `stations/Research.tsx`, `ResearchHQ.tsx`, `BrainConsole.tsx` | "around the clock" became "every six hours on a fixed snapshot". "LIVE" became "Latest committed state". The pulsing dot was removed |
| Protection | `research/main.tsx`, `case.tsx` | The same view-only deterrence as the home page |

## How motion maps to events

| Event | Source | Reaction |
|---|---|---|
| `research_run_started` | Actions run open (< 1 h old) | Centre tower bands animate; the Evolver bot loops to the tower while running; tag ▶ RUNNING |
| `research_run_succeeded` | Actions run completed, success | One green plot pulse; the Evolver makes one trip; tag ✓ RUN OK. Validation unchanged |
| `research_run_failed` | Actions run completed, not success | Red pulse and a dashed red outline that stays until the next success; tag ✕ FAILED; the last success is kept |
| `test_suite_*` | Jarvis CI run completed | Same pattern on Jarvis with the CI bot |
| `release_gate_*` | lab-check and eval at build time | Pulse and the deploy bot's trip, on a return visit |
| `candidate_promoted` | Brain state log | Pulse on the centre tower |
| `dataset_stale` | Derived: data as-of + tolerance | Amber DATA STALE tag; dashed amber conduit; Foundry STALE tag. Execution status is not changed |
| `pipeline_stale` | Derived: last success + 2 × interval + 1 h | ! STALE tag. Never hides a failure; never interrupts a run |
| `change_committed` | git | Timeline entry; pulse on a return visit |
| Selection, filter, camera | User input | Focus and recede, filter dimming, bounded pan and zoom |

**Replay rule.** A first visit records "now" as seen, so nothing replays. On a later visit, up to the 3 newest unseen real events play once each, oldest first, and the marker advances. Demo events never touch the marker. With `prefers-reduced-motion`, nothing travels: pulses become a static outline for 3.2 s, and the state is always in text.

## Test results (this iteration)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -b` | clean |
| City unit tests | `npm run test:city` | 24/24 pass: validation, rejection, safe links, dedupe, bounds, transitions, failure keeps last success, time order, stale rules, replay guard, demo isolation, validation ≠ execution, manifest integrity (ids, pages, plots, every `repo:` ref exists, shipped needs a repo ref) |
| Agent, city, lab-check, eval | `npm test` | agent 23/23 · city 24/24 · lab-check all passing (38) · eval all passing |
| Production build | `npm run build` | pass (8 case pages, evidence: 20 commits, 30 Brain runs, 17 CI runs, lab-check 38 pass) |
| e2e | `python3 e2e/e2e.py http://localhost:4173/ <shots>` | **199/199 passing** (147 before, plus 52 new city and case-page checks: idle stillness, first visit replays nothing, return visit pulses once, refresh replays nothing, filters, keyboard, timeline links, demo labelled and isolated, failure shown, reduced motion, 8 case pages × 12 sections, no phone overflow, private source unlinked) |
| Quality gate | `npm run -s jarvis:loop` | APPROVED, S = 10.0/10 (tsc, lint, tests 25/25) |
| Brain duplicate guard | `brain-run.ts` at +30 min with `--min-gap-hours 2`, then at +3 h | skipped, then ran and wrote provenance |
| Jarvis | `pytest` | 225 passed |
| trading | `npm test` | 10/10 |

**Performance, measured in headless Chromium:**

| Page | Running animations at idle |
|---|---|
| /research/ before | 185 (+12 SMIL) |
| /research/ after | 0 |
| Case pages | 0 |
| Home (backdrop, not the city) | 9 (unchanged) |

- No horizontal overflow at 390 px on /research/ or any case page.
- Bundles (raw): City 93.6 KB; research entry 37 KB; case entry 36.7 KB.
- Frame-rate numbers in headless Chromium aren't representative, so none are claimed.

**Accessibility:**

- Buildings and bots are buttons with labels; Enter or Space selects.
- Filters have labels.
- Events are announced through a polite live region.
- Status is carried by text and icon.
- Visible focus styles; reduced motion respected.
- axe-core: 0 violations on the research pages (iteration 2).

**Screenshots:** `docs/research-city/baseline/` and `docs/research-city/after/`, same viewports.

## Blocked / user input required

- **USER INPUT REQUIRED:** is Sentinel's code private (as the brief says) or public (it is in this public repository)? Until you decide, case-study source links stay off.
- **USER INPUT REQUIRED:** clean the injected payload from the default branch `claude/high-properties-v4-overhaul-ktwy5t` (commit `93a6d69`).
- **USER INPUT REQUIRED:** deploy. Nothing was deployed. The Brain workflow fix and the new pages go live only through `scripts/deploy.sh`, which the owner authorizes.
- **BLOCKED:** total-return data (distributions) and an automated refresh. A data source is needed; until then, every Brain result is capped at provisional.
- **BLOCKED:** High Properties' deployed functions and Supabase policies. This needs access to the High-Properties repository and Vercel project.

## Iteration 2 (2026-10-22)

| Item | Result |
|---|---|
| Pin GitHub Actions to commit SHAs | Done in `deploy/brain.yml`, `deploy/cloudflare-pages.yml` and `.github/workflows/jarvis.yml`. The SHAs were resolved from the action repositories and equal the current major tags, so behaviour is unchanged. Jarvis CI runs on this push and confirms the pins resolve |
| Accessibility audit | `e2e/a11y.py` (axe-core 4.10.2, WCAG 2.0/2.1 A + AA + best practice). Before: 2 rules failing on research pages (nested landmark; keyboard-unreachable scroll regions). After: **0 violations** on /research/ and all 8 case pages, desktop and phone. Colour contrast passes |
| Regression | `npm run test:city` 24/24; city e2e (research_city, research_and_lab, city_explorer) 0 failing; `tsc` clean |

## Iteration 3 (2026-10-22): code integrity and accessibility

| Item | Result |
|---|---|
| Hidden-code cleanup | Removed the 22 files that rewritten commit `efcc955` added under `.vscode/` and `public/fonts/`. They include an editor task that ran on folder open and a script disguised as a font. Details, confirmed vs unknown, are in [security/2026-10-code-integrity-review.md](security/2026-10-code-integrity-review.md) |
| Regression guard | `tools/repo-integrity.mjs` reads every tracked file and fails on disguised code, code hidden after whitespace, editor auto-run, install hooks, a dev script running a stray file, eval combined with spawn, and Ethereum RPC lookups. It detects every variant found in history. It runs in `npm test`, first in `deploy.sh`, and in `.github/workflows/integrity.yml` (read-only, on every push) |
| Explorer dialog | Focus moves in; the page behind is `inert`; Tab wraps; Escape closes and returns focus to the Explore button |
| Side-panel tabs | ARIA tabs pattern: arrows and Home/End, roving tab index, tabs linked to their panel |
| Terminal and Jarvis (home) | Terminal output is a focusable, labelled `role="log"`; the Jarvis status strip is a focusable labelled group; the greeting is named "Jarvis greeting" |
| `e2e/a11y.py` | Default page list (research + 8 case studies), `A11Y_BASE` override, "needs review" items reported, and `--states` interactive checks (tabs, explorer focus, inert, Escape, focus return) |
| Results | Integrity clean (765 files); `npm test` passing; build OK; e2e **205/205**; axe 0 violations on research pages at both viewports and in interactive states, with 8/8 interactive checks passing. Home page: 3 rules remain, all outside the Terminal/Jarvis scope (audit A3) |
| Not covered | Screen readers, WebKit/Safari, zoom and reflow, manual contrast on gradient backgrounds (axe marks 11 states for review) |

## Iteration 4 (2026-10-22): CI releases, Cloudflare workflow, visuals, project kinds

| Item | Result |
|---|---|
| Node 24 action releases | `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0 and `actions/setup-python` v7.0.0, pinned to SHAs checked against the release tags. setup-python v7.1.0 was skipped because it was one day old. Behaviour changes from the release notes: the actions run on Node 24; checkout keeps credentials in a temp file (git push still works) and refuses fork checkouts under `pull_request_target`/`workflow_run` (not used here); setup-node no longer injects a placeholder `NODE_AUTH_TOKEN` and may auto-cache, so `package-manager-cache: false` keeps the old behaviour |
| Cloudflare workflow (`deploy/cloudflare-pages.yml`, not active: it lives outside `.github/workflows`) | The gate reads both secrets through `env`; a missing secret gives a visible "deploy skipped" notice, not a silent success. The token is scoped to the two steps that call Cloudflare. Wrangler is pinned (3.114.17), checkout doesn't persist credentials, there's a 10-minute timeout, and a project-create error is reported instead of swallowed. No secrets were added and the workflow was not enabled |
| Building shapes | Massing follows discipline: research is a slim tower with a setback, underwriting is a broad block, AI systems have a setback and a mast, and product engineering has a low annex. Edge, roof and ground-shadow lines give depth. Floors still equal milestones |
| District labels | Each building's sign now names its district, instead of floating ground labels that buildings and bots covered |
| Project kinds | `nature` in the manifest: analysis, backtest, simulation, interactive model, prototype, live system, or "live system (not verified)", each with a reason. Shown on every case page and in the city dossier. A unit test rejects "live" without a deployed milestone, "interactive" without a demo link, and "not verified" without an unverified milestone |
| Motion | No new animation. Idle stillness e2e passes |
| Results | `npm test` passing (city 25/25); build OK; e2e **205/205**; axe 0 violations, 8/8 interactive checks; quality gate APPROVED 10.0/10; integrity clean (765 files) |

## Iteration 5 (2026-10-22): legend, labels everywhere, pin check

| Item | Result |
|---|---|
| Shape legend | One line under the city map says what the shapes mean (slim stepped tower = research and quant, broad block = underwriting, mast = AI and automation, side wing = product) and that floors are milestones. Shapes now carry information, not just decoration |
| Kind labels in the work index | The plain project list shows each project's kinds too, so the labels match on the city, the dossier, the case pages and the index |
| `tools/check-actions.mjs` | Fails if any `uses:` in `.github/workflows/` or `portfolio/deploy/` is not a full commit SHA followed by a version comment. Runs in `npm test` and in the integrity workflow. Tested against a tag pin and a SHA without a comment (both rejected) |
| Results | `npm test` passing; build OK; e2e **205/205** (idle stillness passes); axe 0 violations, 8/8 interactive checks; quality gate APPROVED 10.0/10 |

## Next steps

1. Home-page accessibility findings (A2 in the audit), if the owner approves changes outside Terminal and Jarvis.
2. After deploy, confirm on a phone that the Actions refresh works from the browser (CORS and rate limits), and that the Brain state shows its provenance after the first run under the new workflow.

## Recovery

Every change is in git on `claude/resume-one-page-keywords-lfau66`. To roll back the city alone, revert the iteration commit. The old `projects.ts` was replaced by `manifest.ts`; `scripts/site-index.ts` was updated to match. `brain/state.json` gained only an optional field, so older states still load and older sites ignore it.
