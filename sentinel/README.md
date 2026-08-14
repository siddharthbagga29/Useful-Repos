# Sentinel — AI Liability Telemetry & Coverage

A six-page static site for an AI assurance and liability business. The research
was verified first, the models were re-anchored on what survived verification,
and the pages were generated from those outputs. No figure on the site is
hand-typed.

## Deploy

Drag this folder onto <https://app.netlify.com/drop> and it is live. Every page
has **no external dependencies** — no CDN, no web fonts, no remote images, no
runtime network calls — so each one also opens correctly straight from disk
(`file://`), which is how it is developed and tested.

## The site

| URL | Page | Intent it serves |
|---|---|---|
| `/` | Home | What the company is, in one screen |
| `/coverage.html` | Coverage & pricing | What it sells and what it costs |
| `/evidence.html` | The loss record | What AI failure has actually cost |
| `/research.html` | Market research | Sector exposure, market sizing, ROI |
| `/method.html` | Method | How every number was produced |
| `/contact.html` | Contact | Get an indicative quote |

Six separate documents rather than one long scroll, because a single page cannot
rank for six different search intents and a buyer who wants pricing should not
have to scroll past a research dashboard to reach it. Each page carries its own
`<title>`, meta description, canonical, Open Graph card and JSON-LD, all
asserted unique by the backtest.

## Layout

| Path | What it is |
|---|---|
| `*.html` | The six built pages. Self-contained; nothing to serve alongside them. |
| `index2.html` | Byte-identical copy of `index.html` (that name was already in circulation). Excluded from the sitemap and disallowed in `robots.txt` so it cannot be indexed as a second home page. |
| `sitemap.xml`, `robots.txt`, `_headers` | Crawl surface and real HTTP security headers. |
| `og.jpg` | 1200×630 social card, rendered by the same shader as the hero. |
| `src/pages.js` | The content model: every page's title, description, h1, intro and body. |
| `src/build.js` | Generates all six pages, per-page CSP hashes, sitemap, robots, `_headers`. |
| `src/app.js` | All behavior: reveal, scroll-formed robot, charts, pricing tables, form. |
| `src/tw.css`, `src/tailwind.config.js` | Tailwind source and theme. |
| `src/frag.glsl`, `src/bake.js` | The raymarched hero bust and its build-time renderer. |
| `src/bust.datauri` | The baked render, inlined by the build. Regenerate with `node src/bake.js`. |
| `evidence.json` | 29 claims, graded A/B/C/D, each with sources and a plain-English gloss. |
| `montecarlo_v2.py` → `mc_v2.json` | Strategy viability. 60,000 trials, seed 20260808. |
| `pricing.py` → `pricing.json` | Actuarial pricing. 400,000 simulations, seed 4711. |
| `src/reel.datauri`, `src/reel.json` | The 11-view turntable atlas and its geometry. |
| `backtest.js` | 332 headless assertions across all six pages. Needs `playwright-core`. |
| `guards.js` | The failure-audit layer. Runs every guard in `failures.json` and proves each one can fail. |
| `failures.json` | Every defect that reached a built artifact, its root cause, and why the tests missed it. |
| `verify.js` | Piece-by-piece walk of the shipped build, starting at `index2.html`. 15 pieces, 78 measurements. |
| `audit.js` | Core Web Vitals, CLS, idle GPU, leak probe, CSP. `node audit.js <slug>`. |

Full rebuild:

```
python3 montecarlo_v2.py && python3 pricing.py \
  && node src/bake.js && node src/build.js && node backtest.js
```

`src/bake.js` is only needed when the shader changes; the baked results are
committed. `BAKE_ONLY=hero` skips the turntable and finishes in seconds.

Dependencies are not vendored here. If `node_modules` is not at the repo root,
point `NODE_PATH` at one that has `playwright-core`, `chart.js` and
`tailwindcss`.

## Page weight is chosen, not inherited

Payloads are selected per page from what the markup actually contains, so no
page carries a library it never calls:

| Page | Size | Carries |
|---|---|---|
| method | 169 KB | app, CSS, hero bust |
| coverage | 178 KB | + `pricing.json` |
| contact | 180 KB | + `pricing.json` |
| evidence | 195 KB | + `evidence.json` |
| research | 387 KB | + `pricing.json` + Chart.js (204 KB) |
| index | 321 KB | + the 154 KB turntable atlas |

Chart.js is 204 KB and only one page draws charts. Shipping it everywhere would
have added a megabyte across the site for nothing. The build detects the need
from the markup (`<canvas id="chart…">`), so a page that grows a chart starts
shipping the library on the next build without anyone maintaining a list.

## The hero backdrop

A raymarched signed-distance-field robot bust: cranium with a machined crown
seam, tilted face plate, emissive visor slits, cheek vents, canted shoulder
pauldrons, a glowing chest core ring and panel lines cut with `smax`. Gunmetal
material with a GGX specular lobe, a fresnel rim light gated to the light's own
side, and hemisphere ambient.

It is rendered **once at build time** and shipped as inline JPEG data URIs. The
shipped pages contain no WebGL at all — no context creation, no shader compile,
no context-loss handling, no GPU variance between machines. Because the render
is offline, quality is free: 2× supersampling and a chroma-gated bloom that no
runtime budget would allow.

### It turns to follow you

The build also renders an **eleven-view turntable** across a ±23° arc and lays
it out as one horizontal strip. On the home page the bust tracks the pointer,
with a few pixels of counter-parallax underneath it.

The strip is an **image layer moved by `transform`**, not a canvas, and that is
the whole design rather than a preference. The first version blitted one cell
per frame into a canvas and measured **88 ms per scroll frame at 2× DPR against
17 ms without it** — the identical failure that cost this project three rounds
of optimisation on the backdrop before that was moved out of a canvas too. A
canvas sits in the compositing path and is re-rastered as the page scrolls above
it even when its pixels never change. An image layer is a cached texture: the
compositor moves it and never re-rasters it. Selecting a view is a `translateX`
of a whole cell width; scrolling now measures **20.6 ms, the same as with the
layer removed entirely.**

Gating the canvas off during scroll was tried first and is the wrong shape — it
defends against a cost instead of not incurring it, and it did not even work
reliably.

The view **snaps** to the nearest cell; there is no cross-fade. Blending
adjacent views was tried and does not work at this cell count: 4.6° apart, two
superimposed heads at comparable alpha read as two heads. The alternatives were
tripling a 154 KB payload or shrinking the cells until the only sharp thing in
the hero went soft. Eleven discrete poses stepped through with an eased target
is a servo moving, which is what the subject is.

It is off entirely under `prefers-reduced-motion`, off below 1024px, stopped
when the hero leaves the viewport or the tab is hidden, and frame-gated to 20fps
when idling. With JavaScript disabled the still is the backdrop and nothing is
missing.

Three problems were solved in the render rather than papered over in CSS:

- **The rim light was flooding whole faces teal.** It was a diffuse term
  (`pow(dot(n, l), k)`) wearing a rim light's name. A rim light lives on the
  silhouette, so it now needs two gates: a fresnel term to confine it to the
  edge, and `dot(n, rimDir)` to confine it to the side the light is actually on.
- **The key highlight bloomed into a lamp stuck to the head.** A
  luminance-only bloom threshold cannot tell a white specular hit from a cyan
  emissive. The threshold is now weighted by distance from neutral toward
  green-blue, so metal highlights stay crisp and only the visor and core glow.
- **The image's bounding box read as a faint rectangle behind the hero.** A
  JPEG has no alpha, so whatever fills the empty studio is painted onto the page
  as an opaque block. The shader now resolves its frame edges to the page's
  exact background colour (`#05070a`), per-axis rather than radially, and the
  boundary disappears because there is nothing there to see.

Legibility is enforced, not hoped for. The copy sits on a glass panel on the
left; the bust is anchored right, masked out of the copy column entirely, and a
directional scrim sits over both. The backtest hides the copy, screenshots the
hero, finds the **brightest pixel actually behind the text**, and requires WCAG
AA against it. Current measurement: **6.64:1**.

Honest framing: this is a stylized product render produced by a distance-field
shader written for this page. It is not a photoreal 3D asset, and it is not
AI-generated imagery — there is no image model in this pipeline.

## The pinned figure

The home page keeps the scroll-formed figure. A **humanoid robot assembles from
particles** as you scroll a pinned section: head with antenna and visor band,
shoulder pauldrons, chest plate and core, two arms with elbows and hands,
pelvis, two legs with knees and feet. 247 nodes, 217 bones, flying in from
scattered origins and locking into limbs in waves; complete by 78% depth.

Five failure modes are mounted on the body part each one is actually about:

| Body part | Failure mode | Cost |
|---|---|---|
| Eye | Hallucination — it sees what is not there | $5,000 + sanctions |
| Mouth | Misrepresentation — what it says binds you | Company held bound |
| Hand | Disparate impact — it sorts people | Nationwide collective |
| Foot | Physical control — it moves in the world | $243,000,000 |
| Chest core | Training data — what it is made of | $1,500,000,000 |

The copy panel sits over the torso, deliberately narrower and shorter than the
figure so the crown, both arms and both legs stay visible, and shows one failure
at a time. Geometry is authored y-up and flipped once at draw time; sizing is
solved from the figure's own extents, so a narrow screen gets a properly
proportioned figure with the arms tucked in.

The backtest samples the canvas in five bands and requires ink in the head, both
arms and the legs. This is not paranoia: a `var` shadowing bug once put `NaN`
into every node's x-coordinate, and the chest bloom still painted — so "the
canvas has pixels" passed while the robot was gone.

## How the pricing is derived

Standard excess-of-loss ratemaking, not a markup on a competitor's rate card:

1. **Frequency** — Poisson, base 6% per insured per year, modified by sector
   (0.9×–2.4×), revenue band, and whether the system is under telemetry.
2. **Severity** — three-component lognormal mixture, calibrated so simulated
   quantiles reproduce the five adjudicated outcomes on the evidence page:
   p50 $82k · p90 $1.3M · p99 $32M · p99.9 $336M · p99.99 $1.2B.
3. **Layer** — Monte Carlo the aggregate annual loss ceded to (limit xs attachment).
4. **Loading** — 28% expense, 10% profit, plus a risk load proportional to the
   layer's coefficient of variation. A new line with no credible history has to
   charge for parameter uncertainty.

Layers whose rate on line exceeds 4% are **declined rather than quoted** — at
that burn rate the policy is a payment plan, not a risk transfer.

**Competitor rates are labeled SIMULATED.** Armilla, Testudo, AIUC and HSB write
on Lloyd's and surplus-lines paper, where rates are not publicly filed. Limits
and paper are verified from trade press; the rates are inferred from published
cyber rate-on-line ranges and marked as such on the page.

Structured data reflects this. The coverage page emits `Service`, not `Product`
with an `offers.price` — these are modeled technical premiums, not bound quotes,
and emitting them as a price would be a misrepresentation dressed as schema.

## Evidence grading

- **A** — court docket, regulator, statistical agency, standards body
- **B** — named-company disclosure or reputable trade / business press
- **C** — vendor or self-interested survey, shown only with the conflict disclosed
- **D** — syndicated report-mill projection with no traceable basis

Tier D claims stay in the ledger, struck through, so a reader can see what was
rejected and why. Four were discarded, including the widely-quoted "$6.8B in
2025 → $34.2B by 2034" AI liability market figure, which fails a sanity check
against Munich Re's measurement of the *entire* global cyber market at $15.3B.

## Security

Every page ships a hash-based Content-Security-Policy: `default-src 'none'`,
one SHA-256 per inline script and per inline stylesheet, no `unsafe-inline` and
no `unsafe-eval`. Because payloads differ per page, so do the hashes; `_headers`
carries the union (a header applies to every path) and the browser enforces the
intersection of header and meta.

`frame-ancestors` is spec-ignored inside `<meta>`, so it ships only as a real
header alongside `X-Frame-Options`, HSTS, `nosniff`, `Referrer-Policy`,
`Permissions-Policy` and COOP/CORP.

The site holds **no customer data**. The contact form composes a `mailto:` in
the reader's own client; nothing is transmitted and nothing is stored beyond a
single UI preference (`sentinel-pe`).

If a CRM or lead view is ever added on top of this:

> Client-side gating is obscurity, NOT security. For real customer lead data,
> set AUTH_MODE='supabase' and serve CRM data only after server-side auth.

No API key belongs in this HTML, ever.

## Scrolling: how the lag was actually fixed

Frame timing during real wheel gestures at Retina resolution, isolating one
layer at a time:

| Configuration | p50 frame | Effective |
|---|---|---|
| Animated fullscreen canvas | 100 ms | 10 fps |
| Shader cut 15 → 3 octaves, 6 fps cap | 33 ms | 30 fps |
| Canvas static, still in the DOM | 33 ms | 30 fps |
| **Canvas → cached image layer** | **17 ms** | **60 fps** |
| No backdrop at all | 17 ms | 60 fps |

The decisive row is the fourth. A `<canvas>` sits in the compositing path and is
re-rastered as the page scrolls above it **even when its pixels never change**;
an image layer is cached by the compositor and costs nothing. The current build
goes one step further and does not render at runtime at all.

Two things that were **not** the cause, and were measured rather than assumed:
`backdrop-filter` on 31 panels (disabling it changed nothing, and removing it
was slightly worse) and canvas size (shrinking it changed nothing).

CDP attribution over 3.5 s: ScriptDuration **66 ms** against raster/paint
**1,710 ms** — the residual is software rasterization in headless, not the
page's JavaScript.

A JS smooth-scroll library (Lenis) was tried and **removed**. Native scrolling
is driven by the compositor thread and stays smooth when the main thread is
busy; any JS scroll library moves scrolling onto the main thread, where it
competes with canvas work. Measured inside the pinned section: **Lenis ON
30 fps, Lenis OFF 60 fps.** The backtest asserts no scroll library is present so
nobody reintroduces one without re-measuring.

## Frame budget

- **Scroll-linked robot** — native refresh rate, never capped. Capping this is
  what makes scrolling feel broken on a 60/120 Hz display. Glows are pre-baked
  sprites (a `createRadialGradient` per node per frame cost 30 fps) and edges
  are batched into five paths instead of ~217 stroke calls.
- **Hero backdrop** — rendered at build time. Zero runtime cost.
- **Page backdrop** — pure CSS gradients on a fixed layer. No image, no bytes.
- **Idle** — nothing. One shared `Ticker`; subscribers return whether they still
  want frames and the loop stops entirely when none do. Zero rAF, zero GPU,
  measured over a clean sample.

## Verifying a copy you already have

`node verify.js` starts at `index2.html` — the file that has been in local
circulation — and walks outward through every layer it depends on, reporting a
measured fact for each rather than a bare pass mark: what is inlined and how
big, what the CSP actually allows, the resolution and edge luminance of the
render, whether the turntable's extreme views genuinely differ, the contrast of
hero copy against sampled backdrop pixels, frame pacing at 2× DPR, and how the
page behaves with JavaScript off.

It prints the SHA-256 of `index2.html` first. Compare it against your copy:

```
shasum -a 256 ~/Downloads/index2.html
```

A different hash means your saved file predates this build.

Three harnesses, three jobs, and none of them substitutes for another:

| | asks |
|---|---|
| `verify.js` | what *is* this artifact? — 15 pieces, 78 measurements |
| `backtest.js` | did anything break? — 332 assertions |
| `guards.js` | can these checks even fail? — 17 mutation-verified guards |

## The failure-audit layer

`failures.json` records every defect that reached a built artifact on this
project — twenty of them, in nine classes — with its root cause and, the field
that matters, **why the tests in place at the time did not catch it**. A bug
that was caught is just work; a bug that shipped past a green suite is a hole in
the suite, and the fix is the guard, not the patch.

`node guards.js` makes that ledger executable. For each entry it runs the guard
against a clean build, then **reintroduces the original defect into the source,
rebuilds, and requires the same guard to fail.**

That second step is the point. A regression test that has never been observed to
fail is not evidence of anything, and three of the twenty incidents here are
exactly that failure mode — a check matching a substring that is always present,
or measuring the thing it was supposed to measure against. Writing this layer
immediately caught **six of its own guards being unfalsifiable**, including one
that compared a collapsed canvas' backing store against the canvas' own
collapsed box and therefore could never fail.

It also caught a live defect: the yaw plumbing had been overwritten in one copy
of `bake.js`, so all eleven turntable views had been rendered at the same angle.
The atlas shipped, the module ran, the diagnostics said fine, and the "rotation"
visible on screen was the 16 px parallax on its own.

Current state: **17 guards, all proven non-vacuous, 20/20 incidents covered.**

Fixes are held to not costing anything elsewhere by construction:

- Mutations are applied to source, the site is rebuilt into a temporary
  directory, and the artifact is discarded. Sources and baked renders are
  restored byte-for-byte, and the run verifies it.
- Each guard runs against a build where only its own defect is present, so it
  cannot pass by virtue of some other fix.
- Containment is delegated to `backtest.js`. `guards.js` proves a guard is real;
  the full suite proves the fix did not break anything else. Neither is
  sufficient alone.

Two findings worth keeping:

- The opacity-bucket defect **can no longer be reproduced by reverting its fix**
  — floating point leaves `frac` at 0.9999999999999999, one ulp below the
  boundary. It is currently masked by an accident, not only by the fix, so a
  refactor that makes the arithmetic exact would reintroduce it silently. The
  mutation restores both halves.
- Hero legibility is **not** carried by the scrim (removing it moved contrast by
  0.06) or by the copy panel's own fill (0.31). It is carried by the mask that
  deletes the bust from the copy column. That is the load-bearing protection,
  and now the guarded one.

```
node guards.js            all 17, mutation-verified   (~12 min; re-renders the bust)
node guards.js --fast     skip the three shader guards (~3 min)
node guards.js --list     print the ledger, run nothing
```

## What the backtest guarantees

`node backtest.js` — **332 assertions**, all against the shipped files in a real
browser from a `file://` URL.

Per page, all six:

- No console or page errors; no guarded feature threw; no internals on `window`.
- Exactly one `<h1>`; no skipped heading levels; `lang` declared.
- Title, description, canonical, robots, Open Graph and Twitter card present;
  JSON-LD parses and carries the right types.
- CSP present, `default-src 'none'`, hashes only, `frame-ancestors` absent from
  the meta form.
- Every visible text node measured against its *composited* background clears
  WCAG AA. Current floors: 6.64:1 over the hero bust, 5.36:1 on mobile.
- Nothing above the fold hidden on load, and nothing still hidden after
  scrolling the whole document.
- No dead in-page anchors; every internal link target exists; every external
  link is https + `_blank` + `noopener noreferrer`.
- Zero literal `style` attributes; every table captioned; every canvas labeled
  or hidden from assistive tech.

Across pages:

- Titles, descriptions, canonicals and h1s are **all distinct** — the standard
  way a multi-page site cannibalises its own results.
- Every canonical appears in the sitemap and points at its own URL.
- No orphans: every page is linked from at least two others (measured: five).

Plus the behavior: the turntable goes live, spans every baked view, turns with
the pointer, and is absent under reduced motion and below 1024px; assembly maps
monotonically to scroll depth with all five failure modes firing in order; five charts paint; the ROI calculator responds to
both selectors; the quote form blocks empty and invalid submits with per-field
`aria-invalid` and composes a `mailto` carrying the entered data; the mobile
disclosure menu reaches all six destinations, flips `aria-expanded` and returns
focus on Escape; all six pages remain readable with JavaScript disabled.

And the numbers: CLS 0.0000, FCP under 700 ms, DOMContentLoaded under 200 ms,
median scroll frame under 34 ms at 2× DPR on both the heaviest and the lightest
page — under headless software rasterization, which is slower than any real GPU.

Screenshots are off by default so test runs leave the tree clean. Set
`SENTINEL_SHOTS=/some/dir node backtest.js` to capture one per page.

## Not legal, financial, or insurance advice

This is a strategy and research artifact. It is not an offer of insurance, a
solicitation, financial advice, or a securities offering. Premiums shown are
modeled technical premiums, not quotes, and are not backed by bound capacity.
Case summaries describe public court records and are provided for analysis only.
