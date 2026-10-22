# Research City 2.0: Phase Zero audit

Audit date: 2026-10-22.

| | |
|---|---|
| **Branch** | `claude/resume-one-page-keywords-lfau66` |
| **Base commit** | `0927c2b` |
| **Who** | Claude Code, for the owner |
| **Where** | A cloud container. It can reach github.com, raw.githubusercontent.com and api.github.com through a proxy. It cannot reach `*.github.io` or the owner's Mac. |

Every finding below is marked by how it was checked:

- **[verified]** read in the code, or run and observed.
- **[observed]** seen in a live record, such as a GitHub Actions run.
- **[unverified]** stated somewhere, not checked.

## 1. Architecture map

```
Useful-Repos (this repository, public)
├─ portfolio/                  Vite 8 + React 19 + TypeScript, framer-motion, three.js (home backdrop only)
│  ├─ index.html               home: résumé stations, compact Research City (src/stations/Research.tsx)
│  ├─ research/index.html      Research HQ: City, Brain console, knowledge graph
│  ├─ research/<id>/index.html NEW: one static case-study entry per project (generated)
│  ├─ lab/ deal/               Strategy Lab, Deal Lab
│  ├─ src/research/            city, manifest, events, feeds, case studies
│  ├─ src/brain/               Brain engine (pure TS) + console + state loader
│  ├─ scripts/                 build-time: site index, case pages, evidence snapshot, research, lab-check, brain-run
│  └─ deploy/                  workflow sources copied into the Pages repo by scripts/deploy.sh
├─ jarvis/                     Python service (owner's Mac) — CI: .github/workflows/jarvis.yml
├─ trading/                    paper-mode execution gate for the Brain's champion (not wired to the site)
├─ sentinel/                   Sentinel static site + research harness
├─ projects/                   Twin-Engine dashboard, Deal Analyzer workbook builder
├─ positioning-os/             Apps Script webhook (site analytics → Google Sheet)
└─ *.js, *.html at root        High Properties: a flat upload (imports ../lib/*, which isn't here)

siddharthbagga29.github.io (Pages repo)
├─ the built portfolio (copied from portfolio/dist by scripts/deploy.sh)
├─ brain/evolve.mjs, brain/weekly.json, brain/state.json
└─ .github/workflows/brain.yml (every 6 h) · cloudflare-pages.yml (inactive without secrets)
```

**Build and publish [verified].** The site is built from maintainable source in `portfolio/` with `npm run build`. `scripts/deploy.sh` then:

1. runs the quality gate (`jarvis:loop`, `eval`, `lab-check`);
2. builds;
3. copies `dist/` into the Pages repo, keeping the live `brain/state.json`;
4. pushes.

The published site is reproducible from source. No compiled bundles are edited by hand.

**Research City rendering [verified].** One React component, `src/research/City.tsx`, renders hand-built isometric SVG (polygons with a projection function) with framer-motion. three.js is used only by the home page backdrop (`src/scene/den.ts`), not by the city. WebGL is not needed for the city, so the 2.5D SVG was kept and improved rather than rewritten.

## 2. Repository inventory

| Path | What | Tests |
|---|---|---|
| `portfolio/` | Site source | `npm test` (agent, city, lab-check, eval), `e2e/e2e.py` (Playwright) |
| `jarvis/` | Python service | `make check`: ruff, mypy, pytest. 225 tests pass in this audit |
| `trading/` | Paper execution gate | `npm test`: 10/10 pass in this audit |
| `sentinel/` | Static site + harness | `backtest.js`: claims 332 assertions, not re-run here |
| `projects/twin-engine-dashboard/` | Next.js concept | `scripts/render-preview.ts` |
| `projects/deal-analyzer/` | Workbook builder (Python) | Cross-checked by lab-check |
| `positioning-os/` | Analytics webhook | `harness.test.mjs` |
| root `*.js` | High Properties copy | None runnable here |

## 3. Project inventory (canonical, `portfolio/src/research/manifest.ts`)

| ID | Project | District | Pipeline | Evidence in this repo |
|---|---|---|---|---|
| `dcf` | S&P Global multi-scenario DCF | Capital Markets | none | Illustrative site model; capstone files not here |
| `risk-tolerance` | Risk Tolerance Analysis | Capital Markets | none | None. Report PDF only. **Was missing from the city; added.** |
| `strategy-lab` | Strategy Lab & the Brain | Capital Markets | Brain (Actions) | Code, tests, research artifacts, run history |
| `deal-lab` | Deal Lab | Investment & Underwriting | none | Code, workbook builder, lab-check ties |
| `twin-engine` | Twin-Engine | Investment & Underwriting | none | Code, metrics, preview |
| `sentinel` | Sentinel | Risk & Reliability | none | Code and data present; harness not re-run |
| `jarvis` | Jarvis | Automation & Product Systems | Jarvis CI (Actions) | Code, 225 tests, CI run history |
| `high-properties` | High Properties | Automation & Product Systems | none | Handler source only, not runnable here |

**Discovered, not added to the city.** Both need an owner decision.

- **`trading/`.** It executes the Brain's champion through the Robinhood MCP and is in paper mode (`config.json` `"mode": "paper"`) [verified]. It is recorded as a Strategy Lab milestone, "Paper-mode execution gate". It was not touched, and the site has no connection to it.
- **`positioning-os/`.** Site analytics into a Google Sheet. It is infrastructure, not a portfolio project.

## 4. Verified features and unverified claims

| Claim (where it appeared) | Status | Evidence |
|---|---|---|
| Brain runs every 6 h on GitHub Actions | **verified** [observed] | 55 runs listed, run #55 at 2026-10-22 04:43Z |
| Brain never selects on the holdout | **verified** | `selectionData()` slices; lab-check scrambles holdout prices and asserts identical choices |
| "evolves strategies around the clock" (home page) | **overstated** → fixed | It runs every 6 h, on a fixed data snapshot |
| Brain market data refreshes | **false if implied** | `weekly.json` is a manual snapshot as of 2026-09-21; no refresh mechanism exists |
| "LIVE" badge on the Brain console | **misleading** → renamed | It reads the last committed state, not a live process |
| Jarvis "79 tests passing" (city bot) | **stale** → removed | 225 pass today |
| Jarvis "21/21 eval cases" | **stale** → removed | `eval_cases.toml` has 23 cases; the portfolio eval passes all of its checks |
| Jarvis CI "a release stops if one fails" | **partly** | True for the deploy gate (`scripts/eval.ts`); in CI `jarvis-eval --min-pass-rate 0` never fails |
| Sentinel "332 assertions" | **unverified** | Harness not re-run in this audit |
| Sentinel "code is private" (brief) | **contradicted** | `sentinel/` is in this public repository. **USER INPUT REQUIRED**; source links withheld meanwhile |
| High Properties "WhatsApp follow-up, admin console" | implemented in source copy | `whatsapp.js`, `admin.js`; deployment not verified |
| High Properties admin authorization in handlers | **verified for the handler** | All 7 admin actions call `requireRole` first; destructive ones need `admin`. `requireRole` itself (lib/auth.js) is not in this copy |
| DCF "within 10% of consensus" | **unverified here** | Stated in the capstone report; workbook not in repo |
| Deal Lab NO-GO, 29% works | **verified** | `analyze()`/`simulate()` recomputed in the case page |
| OPS and Monte Carlo results | **verified** | `research.json` regenerable by `scripts/research.ts`; values rendered from it |

## 5. Security and reliability findings

**Confirmed problems:**

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | P0 | Injected malware in this branch's history (`api.js`, `sentinel/src/tailwind.config.js`, `package.json` dev script) | Commits `93a6d69`, `5f416f8` | Removed in `6ecd080`. The default branch `claude/high-properties-v4-overhaul-ktwy5t` **still carries the `93a6d69` payload**. **USER INPUT REQUIRED** to clean it |
| R1 | P1 | Brain run #49 failed: a duplicate scheduled run evolved a stale checkout and lost the push race | Job 118768049694: evolve ✓, commit ✕ | Fixed in `deploy/brain.yml` (checkout `main`) and `brain-run.ts --min-gap-hours 2`. Ships on next deploy |
| R2 | P1 | Brain state carried no run provenance; the site couldn't tie a state to the run that wrote it | `state.json` schema | Fixed: `provenance` (run id, number, sha, data as-of). Optional, backward compatible |
| R3 | P1 | Research validity: prices exclude distributions; bonds understated, equity/gold favoured | `weekly.json.source` | Documented everywhere the data appears; validation capped at "provisional". **BLOCKED**: needs a total-return data source |
| R4 | P1 | Research validity: the holdout is shown publicly on every champion, and the ETF set was chosen in 2026 | Code and brief | Documented; the only untouched test is forward data (planned milestone) |
| R5 | P1 | Execution success was presented as research success ("champion", "LIVE") | City and console copy | Separate execution and validation states. The live champion fails validation (DSR 77.2% < 95%) |
| R6 | P2 | 185 perpetual animations on /research/ implied constant work (bots, flicker, flowing roads, pulsing tower) | Baseline `getAnimations()` | Removed: 0 when idle; motion only on events |
| R7 | P2 | When the live Brain state can't load, the site silently showed the build copy (generation 48) | Baseline screenshot | Source is now labelled; unavailable says so |
| R8 | P2 | Third-party actions pinned to tags (`@v4`), not commit SHAs | `brain.yml`, `cloudflare-pages.yml`, `jarvis.yml` | **Fixed (iteration 2):** pinned to the commits the major tags pointed to on 2026-10-22, resolved with `git ls-remote` from the action repositories (checkout v4.4.0 `11d5960`, setup-node v4.4.0 `49933ea`, setup-python v5.6.0 `a26af69`). No change in what runs |
| A1 | P2 | Accessibility (research pages): the dossier `<aside>` was nested in another landmark; scrollable tables and the Brain log weren't keyboard-reachable | axe-core 4.10.2 | **Fixed (iteration 2):** named regions, `tabIndex=0` with a visible focus ring. axe: 0 violations on /research/ and all 8 case pages at 1440 and 390 px |
| A2 | P2 | Accessibility (home page, outside this scope): scrollable Model grid, Experience and terminal regions not focusable; an empty table header; duplicate `#jarvis` landmark name; tape and hint outside landmarks | axe-core 4.10.2 on `/` | Not changed: the owner limits home-page changes to the Terminal and Jarvis. **USER INPUT REQUIRED** to fix the rest |

**Risks still to investigate:**

| ID | Sev | Risk |
|---|---|---|
| U1 | P1 | High Properties: deployed Vercel functions, environment and Supabase RLS were not inspected. The root copy can't run (`../lib/*` missing) |
| U2 | P2 | The Brain workflow has `contents: write` on the whole Pages repo. That is needed to commit state, but a compromised action could rewrite the site. Mitigations: SHA pinning; a separate state branch |
| U3 | P3 | Analytics script and Apps Script webhook load on every page (`lib/track.ts`); out of scope here |

**Checked clean [verified]:**

- No secrets in `dist/`. The `AKIA…` strings are base64 WASM inside web-llm.
- `npm audit --omit=dev`: 0 vulnerabilities.
- No `dangerouslySetInnerHTML` or `innerHTML` writes in `src/`.
- Every `target="_blank"` has `rel="noopener noreferrer"`.
- Event links are restricted to https on four known hosts (`safeUrl`, unit-tested).

## 6. Prioritized backlog

| Pri | Item | Phase |
|---|---|---|
| P0 | Clean the payload from the default branch (owner) | Owner decision |
| P1 | Canonical manifest; Risk Tolerance added; evidence grades | Done |
| P1 | Event model, state machine, dedupe, bounded history; execution ≠ validation ≠ freshness | Done |
| P1 | Brain duplicate-run fix and provenance | Done (source); deploy pending |
| P1 | Case-study page for every project | Done |
| P1 | Total-return data and automated refresh | Blocked: data source needed |
| P2 | Pin actions to SHAs | Next |
| P2 | High Properties deployed-function review | Needs access to the High-Properties repo and Vercel |
| P3 | Visual polish: district labels on the ground, building silhouettes per project type | Later |

## 7. Baseline

The baseline was taken before any change.

- **Screenshots:** `docs/research-city/baseline/` (desktop 1440×900 and phone 390×844; /research/ and /).
- **Metrics:** `docs/research-city/baseline/report.json`. On /research/, 185 running web animations and 12 SMIL animations.
- **Tests:**
  - e2e: 147/147 passing (previous session).
  - eval: all passing.
  - lab-check: 38 checks passing.
  - Jarvis pytest: 225 passed.
  - trading: 10/10.
