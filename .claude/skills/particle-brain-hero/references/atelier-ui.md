(Siddharth's prompt, saved verbatim. Apply its frame to whatever stack the page uses; the 3000+ customers / stars line is template placeholder — never ship invented social proof.)

# Wear this UI: Atelier (dark theme)

Rebuild the interface below **over the asset you have just been asked to
build** — the gradient, scene or video is the page's living ground and the
composition floats on top of it. Match it one to one: the measurements,
the palette and the motion are the design, not suggestions.

## What it looks like

Light studio: a white scrim with a circle cut out of its middle,
left-hand copy, an empty gradient card, a giant faded wordmark

Everything belongs to Onda, the invented brand all thirty looks
share. Black is deliberate: in the app this composition floats over
a live gradient or 3D scene, so every opening it leaves — here, the
circle — reads as black until you drop an asset behind it.

Layout: full bleed, one screen, no scroll, and laid out in HARD
PIXELS — the numbers below are the ones in the Figma file, so at
1920 × 1080 the page renders at exactly 1:1. Nothing stretches with
the window; a window that cannot seat the frame picks a smaller set
of pixels from the breakpoint tables at the end of the composition
scope, and below 1024px the RESPONSIVE block restacks it as a phone.
Motion: the app's spring cascade, ported verbatim (see the script).

## The rules that make it this composition

- **It never paints its own ground.** There is no page background of its own —
  the asset fills the whole viewport behind it, and every panel here is either
  opaque, translucent glass, or absent so the asset shows through. If you give
  the page a solid background colour you have removed the point of it.
- **Units are PIXELS, measured at a 1920×1080 canvas.** Nothing scales fluidly.
  The design values hold at that size and the RESPONSIVE block steps them down
  through media queries, ending in a stacked phone layout. Keep the pixel
  values; do not convert them to rem or percentages.
- **This is the dark theme.** Its palette is below. The light theme is a
  different row with different tokens — do not mix them, and do not "improve"
  the contrast: a panel that reads washed here is deliberate, because a live
  asset is moving underneath it.
- **Adapt, do not transliterate.** The reference is plain HTML and CSS with no
  build step. Port it into whatever the user is actually building in — a React
  or Next component, Astro, Vue, plain HTML — keeping the structure, the
  measurements and the class semantics.

## Palette — dark theme

- `--font-general`: `"General Sans", system-ui, sans-serif`
- `--font-onest`: `"Onest", system-ui, sans-serif`
- `--font-mono`: `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas,
    "Liberation Mono", monospace`
- `--lk-serif`: `"Didot", "Bodoni 72", "Playfair Display", Georgia,
    "Times New Roman", serif`
- `--lk-script`: `"Snell Roundhand", "Savoye LET", "Bradley Hand",
    "Segoe Script", cursive`
- `--radius-pill`: `999px`
- `--lk-asset`: `#080808`

## The composition — markup

```html

  <div class="lk-stage">
    <!-- The asset sits here, behind the composition: the gradient, scene or
         video this UI is being built over. Full-bleed, and first in the DOM
         so it stays behind everything else. -->
    <div class="lk-bg" id="lkBg"></div>

    <div class="uip-layer lk lk-atelier">
      <!-- Figma "Subtract" — the boolean: a full-bleed white-at-90%
           rectangle MINUS a Ø524 circle at the frame's centre. The hole
           is the composition's window onto whatever sits behind it; it
           is empty on purpose, so the background layer (the video the
           tester loads, a gradient, a live scene) shows through it
           sharp while the rest of the page reads blurred and washed. -->
      <div class="lk-scrim"></div>

      <!-- Figma "Frame 2" -->
      <div class="lkx-giant" aria-hidden="true">
        <span>O</span><span>N</span><span>D</span><span>A</span>
      </div>

      <!-- Figma "Rectangle 6" — empty in the design -->
      <div class="lkx-device" data-rise="5"></div>

      <!-- Figma "Ellipse 2" -->
      <svg class="lkx-ring" viewBox="0 0 841 841" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="lkAtRing" x1="420.5" y1="0" x2="420.5" y2="841" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffffff" stop-opacity="0.3" />
            <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
          </linearGradient>
        </defs>
        <circle cx="420.5" cy="420.5" r="420" stroke="url(#lkAtRing)" />
      </svg>

      <!-- Figma "Frame 5" -->
      <div class="lkx-cta" data-rise="4">
        <span class="lk-pill lk-pill-dark">Chat with us</span>
        <span class="lk-pill lk-pill-ghost">Our works</span>
      </div>

      <!-- Figma "Frame 6" -->
      <div class="lkx-nav" data-rise="0">
        <span class="lk-brand"><span class="lk-mark" aria-hidden="true"></span>Onda</span>
        <span class="lkx-links">
          <span>About</span>
          <span>Careers</span>
          <span>Partners</span>
        </span>
        <span class="lkx-contact">Contact</span>
      </div>

      <!-- Figma "Frame 55" -->
      <div class="lkx-plate" data-rise="6">
        <span class="lkx-platetext"><b>Vondelix</b><i>Last work</i></span>
        <svg class="lkx-arrow" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M1.46967 10.4697C1.17678 10.7626 1.17678 11.2374 1.46967 11.5303C1.76256 11.8232 2.23744 11.8232 2.53033 11.5303L2 11L1.46967 10.4697ZM11.75 2C11.75 1.58579 11.4142 1.25 11 1.25L4.25 1.25C3.83579 1.25 3.5 1.58579 3.5 2C3.5 2.41421 3.83579 2.75 4.25 2.75H10.25V8.75C10.25 9.16421 10.5858 9.5 11 9.5C11.4142 9.5 11.75 9.16421 11.75 8.75L11.75 2ZM2 11L2.53033 11.5303L11.5303 2.53033L11 2L10.4697 1.46967L1.46967 10.4697L2 11Z" fill="#f2f2f2" />
        </svg>
      </div>

      <!-- Figma "Frame 12" -->
      <div class="lkx-left">
        <span class="lkx-tagline" data-rise="1"><span class="lk-mark" aria-hidden="true"></span>Creative Agency</span>
        <h1 class="lkx-h1" data-rise="2">We start from zero, shipping only what matters</h1>
        <div class="lkx-proof" data-rise="3">
          <span class="lkx-customers">3000+ customers</span>
          <span class="lkx-stars">★★★★★</span>
        </div>
      </div>
    </div>
  </div>
```

## The composition — styles

Reset first (the app gets this from Tailwind's Preflight; standalone it has to
be spelled out), then the tokens, the composition itself, and the responsive
steps.

```css

/* ══ Reset ═══════════════════════════════════════════════════════════
 * The app gets this from Tailwind's Preflight; standalone it has to be
 * spelled out. Only the parts the compositions actually depend on —
 * notably headings and paragraphs losing their UA margins, and
 * `border-style: solid` by default so a bare `border-width` still
 * paints. */
*,
*::before,
*::after {
  box-sizing: border-box;
  border: 0 solid;
}

h1, h2, h3, h4, h5, h6 {
  font-size: inherit;
  font-weight: inherit;
}

p, h1, h2, h3, h4, h5, h6, figure, blockquote, dl, dd, pre, hr {
  margin: 0;
}

ul, ol, menu {
  margin: 0;
  padding: 0;
  list-style: none;
}

b, strong { font-weight: bolder; }

code, kbd, samp, pre {
  font-family: var(--font-mono);
  font-size: 1em;
}

small { font-size: 80%; }

img, svg, video, canvas {
  display: block;
  max-width: 100%;
}

button, input, select, textarea {
  margin: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  background: transparent;
}

/* ══ Tokens ══════════════════════════════════════════════════════════
 * The subset of the app's design tokens this page actually reads.
 * Mirrors `src/app/globals.css`; edit freely — nothing here feeds back
 * into the app. */
:root {
  --font-general: "General Sans", system-ui, sans-serif;
  --font-onest: "Onest", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  --lk-serif: "Didot", "Bodoni 72", "Playfair Display", Georgia,
    "Times New Roman", serif;
  --lk-script: "Snell Roundhand", "Savoye LET", "Bradley Hand",
    "Segoe Script", cursive;
  --radius-pill: 999px;

  /* The page ground, and what the composition's openings reveal. In
   * the app a live gradient or 3D scene shows through a scrim mask, a
   * window cut-out or a full-bleed band. Swap in
   * any paint — a gradient, an image, a video behind .lk-stage — to
   * see the look the way the product shows it. */
  --lk-asset: #080808;

  /* ── The design unit ──────────────────────────────────
   * The pixel. This composition is laid out in the numbers the Figma
   * file carries — no viewport units, no percentage widths, and no
   * `rem` scale solved from the window — so the frame renders at 1:1,
   * and a window too small to seat it picks a different set of pixels
   * from the breakpoint tables at the end of the composition scope.
   *
   * `font-size` is therefore pinned rather than computed. The look
   * library's shared `.lk*` primitives are still written in `rem` and
   * read it; the Atelier scope overrides every one of them it uses. */
}

html {
  font-size: 16px;
  background: var(--lk-asset);
}

body {
  margin: 0;
  /* One screen, never a scrollbar — these are single-view compositions,
   * not scrolling pages. */
  height: 100svh;
  overflow: hidden;
  background: var(--lk-asset);
  font-family: var(--font-onest), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Full bleed. Black is the page's ground colour, not a frame around
 * it — the composition runs edge to edge like any real site. */
.lk-stage {
  position: relative;
  width: 100%;
  height: 100svh;
  overflow: hidden;
  background: var(--lk-asset);
}

/* The composition layer. In the app this is scaled 1.5x inside the
 * modal's media frame; here it simply fills the screen, because the
 * root font size already carries the scale. */
.uip-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}

/* ── Entry state ──────────────────────────────────────────────────
 * Elements that cascade in start hidden so nothing flashes before the
 * script takes over. The script itself sets `.lk-js` on <html>, so
 * with JS off the rule never matches and the page renders fully — no
 * blank composition.
 *
 * `will-change` deliberately does NOT live here: it would create a
 * permanent stacking context on every cascading element, trapping the
 * `z-index` of anything inside — which is how a headline ends up
 * painted behind the window it is supposed to sit over. The script
 * sets it inline for the flight and clears it on settle. */
html.lk-js [data-rise] {
  opacity: 0;
}

/* ══ Look-library primitives ═════════════════════════════════════════
 * The shared `.lk*` vocabulary every look composes from — pills, chips,
 * inputs, the Onda lockup, page scrims, asset windows, and the `.lkx-*`
 * inner set (nav, copy, headline, CTA row). Verbatim from globals.css;
 * the scope below overrides it at equal specificity by coming later. */
/* ── Look library primitives (`.lk*`) ────────────────────────────────
 * Shared vocabulary for the thirty looks in `components/ui/ui-looks/`:
 * pills, chips, inputs, the Onda lockup, page scrims and asset
 * windows. Look scopes below override freely — base first, scopes
 * later, same specificity.
 *
 * Two recipes for "opaque page, asset shows through":
 *  - `.lk-scrim` — an inset page fill; looks with a soft opening add a
 *    `mask-image` gradient (transparent centre = the asset).
 *  - `.lk-win`  — a window card whose enormous box-shadow paints the
 *    page colour (`--lk-page`) around itself; the root's
 *    `overflow: hidden` crops it. One window per look; multi-window
 *    looks (bento) use an SVG alpha mask on the scrim instead.
 * Both stay OUTSIDE the spring cascade — a page fill must never ride
 * a spring. */

.lk {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.94);
}

.lk-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.lk-mark {
  width: 0.62rem;
  height: 0.62rem;
  flex: none;
  border: 2px solid currentColor;
  border-radius: 50%;
}

.lk-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: fit-content;
  padding: 0.34rem 0.8rem;
  border-radius: var(--radius-pill);
  font-size: 0.66rem;
  font-weight: 550;
  white-space: nowrap;
}

.lk-pill-lg {
  padding: 0.55rem 1.1rem;
  font-size: 0.76rem;
}

.lk-pill-solid {
  background: rgba(255, 255, 255, 0.95);
  color: #0d0d0d;
  font-weight: 600;
}

.lk-pill-dark {
  background: rgba(13, 13, 13, 0.92);
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

.lk-pill-ghost {
  border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
}

.lk-pill-glass {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.95);
}

.lk-pill-blue {
  background: #7c7c7c;
  color: rgba(255, 255, 255, 0.97);
  font-weight: 600;
}

.lk-pill-lime {
  background: #c8c8c8;
  color: #202020;
  font-weight: 600;
}

.lk-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
  background: color-mix(in srgb, currentColor 6%, transparent);
  font-size: 0.58rem;
  white-space: nowrap;
}

.lk-mono {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.05em;
}

.lk-input {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.64rem;
  white-space: nowrap;
}

.lk-scrim {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--lk-page);
}

.lk-win {
  position: absolute;
  z-index: 1;
  border-radius: var(--lk-win-r, 1rem);
  box-shadow: 0 0 0 300rem var(--lk-page);
}

/* Shared inner vocabulary — every look restyles these in its scope. */

.lk .lkx-nav {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.2rem;
  font-size: 0.66rem;
}

.lk .lkx-links {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.64rem;
  opacity: 0.88;
  white-space: nowrap;
}

.lk .lkx-navstart,
.lk .lkx-navend {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.lk .lkx-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.8rem;
  padding: 0 1.2rem;
  margin-top: 1.6rem;
}

.lk .lkx-h1 {
  font-family: var(--font-general), system-ui, sans-serif;
  font-size: 2.1rem;
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.02em;
}

.lk .lkx-sub {
  font-size: 0.7rem;
  line-height: 1.5;
  opacity: 0.78;
}

.lk .lkx-para {
  font-size: 0.6rem;
  line-height: 1.55;
  opacity: 0.8;
}

.lk .lkx-cta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.lk .lkx-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.lk .lkx-textlink {
  font-size: 0.66rem;
  font-weight: 600;
  white-space: nowrap;
}

.lk .lkx-wordmark {
  font-family: var(--font-general), system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.lk .lkx-orb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  color: #0d0d0d;
  font-size: 0.6rem;
  font-style: normal;
}

.lk .lkx-orb-dark {
  background: #0d0d0d;
  color: rgba(255, 255, 255, 0.95);
}

.lk .lkx-avatars {
  display: inline-flex;
}

.lk .lkx-avatars i {
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  background: linear-gradient(140deg, #888888, #a1a1a1);
}

.lk .lkx-avatars i + i {
  margin-left: -0.35rem;
  background: linear-gradient(140deg, #b7b7b7, #7c7c7c);
}

.lk .lkx-avatars i + i + i {
  background: linear-gradient(140deg, #bbbbbb, #6f6f6f);
}

/* Interactive chrome — mock controls accept the pointer and answer
 * with instant hover/press feedback (state swaps only; motion stays
 * spring-only). Everywhere else the media keeps the pointer. */
.lk .lk-pill,
.lk .lk-chip,
.lk .lk-input,
.lk .lkx-textlink,
.lk .lkx-links span {
  pointer-events: auto;
  cursor: pointer;
}

.lk .lk-input { cursor: text; }

.lk .lk-pill:hover {
  filter: brightness(1.08);
  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 20%, transparent);
}

.lk .lk-pill:active { filter: brightness(0.92); }

.lk .lk-chip:hover {
  background: color-mix(in srgb, currentColor 14%, transparent);
}

.lk .lk-input:hover {
  border-color: color-mix(in srgb, currentColor 45%, transparent);
}

.lk .lkx-links span:hover,
.lk .lkx-textlink:hover {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 0.25em;
}

/* Middle compositions centre vertically — the copy block claims the
 * free height between nav and whatever grounds the page. */
.lk-spotlight .lkx-copy,
.lk-promptbar .lkx-copy,
.lk-orbit .lkx-copy,
.lk-handwritten .lkx-copy {
  flex: 1;
  justify-content: center;
  margin-top: 0;
}

.lk-emerald .lkx-copy {
  flex: 1;
  justify-content: center;
  margin-top: 0;
  padding-bottom: 3.6rem; /* stay clear of the logo wall */
}

.lk-launch .lkx-copy {
  position: absolute;
  left: 0;
  right: 0;
  top: 3rem;
  bottom: 43%; /* the app window's band */
  justify-content: center;
  margin-top: 0;
}

.lk-horizon .lkx-copy {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 48%; /* the glass footer takes the rest */
  justify-content: center;
  margin-top: 0;
}

.lk-serene .lkx-copy {
  position: absolute;
  left: 0;
  right: 0;
  top: 2.6rem;
  bottom: 40%; /* the testimonial band */
  justify-content: center;
  margin-top: 0;
}

/* ══ Atelier — the composition ══════════════════════════════════════════════
 * Everything specific to `.lk-atelier`. This is the block to work in.
 *
 * A 1:1 port of the Figma frame "Frame 1" (1920 × 1080, node 2088:56),
 * laid out in HARD PIXELS. Every length below is the number the file
 * carries, unscaled — 30px is 30px, 72px is 72px — and a window that
 * cannot seat the frame at 1:1 gets its own table of pixels from the
 * breakpoints further down rather than a stretched copy of this one.
 * Nothing here is a viewport unit, a percentage width, or a `rem`.
 *
 * The one thing that IS measured against the window is the composition's
 * anchoring, and that is the design's own doing: the circle is centred
 * in the frame, so the copy column, the card, the actions row and the
 * plate all hang off `50%` at a fixed pixel offset. That is a constant
 * distance from the centre line, not a stretchy one — move the window
 * and the blocks travel together, keeping their size.
 *
 * The centrepiece is Figma's boolean SUBTRACT: a full-bleed rectangle
 * (white at 90%, 8px backdrop blur) with a Ø524 circle punched out of
 * its middle. Here that is one masked layer — `.lk-scrim` — so the
 * asset behind it (the video the tester loads, a gradient, a scene)
 * reads washed and blurred everywhere EXCEPT inside the circle, where
 * it comes through untouched. The circle is a hole, not a fill: there
 * is deliberately nothing painted in it. */

.lk-atelier {
  /* Figma "Subtract" — fill #FFFFFF at 90%, minus Ø524 (r 262).
   * Inverted: the wash over the asset goes dark, the hole stays a hole.
   * Only the paint changes — the mask, the blur and the Ø524 are the
   * composition and are left exactly as the file has them.
   *
   * The scrim sits ABOVE the page ground, not at it: the hole reads
   * because it is darker than the wash around it, which is the same
   * relationship the light version has the other way up. Taking the
   * scrim all the way to black would close the circle — the one thing
   * the composition is built around. */
  --lk-page: rgba(26, 26, 26, 0.94);

  /* ── Dark theme palette ───────────────────────────────────────────
   * Everything on this page sits on the scrim, so inverting the scrim
   * inverts everything with it. The card and the plate were white
   * washes reading against a white ground; on a dark one they come
   * down to a low light film, which keeps them as lit surfaces instead
   * of turning them into slabs. */
  --at-ink: #f2f2f2;
  --at-dim: rgba(242, 242, 242, 0.42);
  --at-film: rgba(255, 255, 255, 0.1);      /* card + plate fill      */
  --at-filmedge: rgba(255, 255, 255, 0.08);
  --at-cta: #f2f2f2;                        /* the solid pill         */
  --at-cta-ink: #0c0c0c;

  /* A hairline is a hairline at every size, so it sits outside the
   * table below and never scales with the rest. */
  --at-hair: 1px;

  /* ── The frame, 1:1 ───────────────────────────────────────────────
   * Straight off the Figma file. Every rule below reads this table
   * rather than carrying a length of its own, so a breakpoint is one
   * more copy of it in its own pixels — which is also the trade: the
   * tiers do NOT derive from this table, they restate it, and a change
   * here has to be carried down to the ones that should follow it. */
  --at-edge: 30px;           --at-navtop: 16px;         --at-hole: 262px;
  --at-ring: 841px;          --at-blur: 8px;            --at-ui: 24px;
  --at-mark: 18px;           --at-markgap: 8px;         --at-copyw: 763px;
  --at-colgap: 40px;         --at-h1: 72px;             --at-proof: 22px;
  --at-proofh: 28px;         --at-proofgap: 19px;       --at-customersw: 183.36px;
  --at-startrack: 2.2px;     --at-ctagap: 16px;         --at-pillx: 48px;
  --at-btnh: 64px;           --at-radius: 32px;         --at-cardw: 450px;
  --at-cardh: 448px;         --at-platew: 451px;        --at-plateh: 66px;
  --at-plateedge: 29px;      --at-platex: 32px;         --at-plater: 41px;
  --at-plategap: 22px;       --at-arrow: 13px;          --at-giant: 285px;
  --at-giantline: 228px;     --at-giantdrop: -64px;

  font-family: var(--font-general), system-ui, sans-serif;
  color: var(--at-ink);
}

/* The subtract. The mask is opaque (= keep the white) everywhere and
 * transparent (= the hole) inside the circle; the sliver of ramp at
 * the end only antialiases the edge. `backdrop-filter` rides the same
 * mask, so the blur stops dead at the circle exactly as it does in
 * Figma — inside the hole the asset is sharp and unfiltered. */
.lk-atelier .lk-scrim {
  --at-mask: radial-gradient(
    circle var(--at-hole) at 50% 50%,
    transparent 99.4%,
    #000 100%
  );
  background: var(--lk-page);
  -webkit-backdrop-filter: blur(var(--at-blur));
  backdrop-filter: blur(var(--at-blur));
  -webkit-mask-image: var(--at-mask);
  mask-image: var(--at-mask);
}

/* Figma "Ellipse 2" — Ø841 hairline, its stroke fading from 30% black
 * at the top to nothing at the bottom. Concentric with the hole and
 * well clear of it (r 420.5 against r 262).
 *
 * `max-width: none` is load-bearing, not tidying: the reset caps every
 * svg at `100%`, and on a phone this ring is deliberately WIDER than
 * the window. Left capped it keeps its height and loses its width, and
 * the circle silently becomes an ellipse. */
.lk-atelier .lkx-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 3;
  width: var(--at-ring);
  height: var(--at-ring);
  max-width: none;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* ── Figma "Frame 6" · the nav ───────────────────────────────────── */

.lk-atelier .lkx-nav {
  position: absolute;
  left: var(--at-edge);
  right: var(--at-edge);
  top: var(--at-navtop);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  height: var(--at-ui);
  padding: 0;
  font-size: var(--at-ui);
  line-height: 1;
}

/* The five bar items space out across the bar itself, not inside a
 * nested group — `display: contents` hands the three middle links
 * straight to the nav's own `space-between`, which is how Figma's
 * auto-layout distributes them. */
.lk-atelier .lkx-links {
  display: contents;
  font-size: inherit;
  opacity: 1;
}

.lk-atelier .lkx-contact {
  text-decoration: underline;
  text-decoration-thickness: from-font;
  text-underline-position: from-font;
}

.lk-atelier .lk-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--at-markgap);
  font-size: var(--at-ui);
  font-weight: 400;
  letter-spacing: normal;
  color: var(--at-ink);
}

/* Figma "Ellipse 3" — an 18px ring, 1px of the page ink. */
.lk-atelier .lk-mark {
  width: var(--at-mark);
  height: var(--at-mark);
  flex: none;
  border: var(--at-hair) solid var(--at-ink);
  border-radius: 50%;
}

/* ── Figma "Frame 12" · the copy column ──────────────────────────── */

/* Top-aligned with the circle: the column starts exactly one hole
 * radius above centre, which is where Figma puts it (y 278 = 540−262). */
.lk-atelier .lkx-left {
  position: absolute;
  left: var(--at-edge);
  top: calc(50% - var(--at-hole));
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--at-colgap);
  width: var(--at-copyw);
  text-align: left;
}

.lk-atelier .lkx-tagline {
  display: inline-flex;
  align-items: center;
  gap: var(--at-markgap);
  height: var(--at-ui);
  font-size: var(--at-ui);
  line-height: 1;
  color: var(--at-ink);
  opacity: 1;
}

/* 763 / 72 is the measure Figma breaks this on, and the two scale
 * together at every breakpoint — which is what keeps the headline on
 * its three lines instead of rewrapping tier by tier. */
.lk-atelier .lkx-h1 {
  width: 100%;
  font-size: var(--at-h1);
  font-weight: 400;
  line-height: 1;
  letter-spacing: normal;
  color: var(--at-ink);
}

.lk-atelier .lkx-proof {
  display: flex;
  align-items: center;
  gap: var(--at-proofgap);
  height: var(--at-proofh);
  font-size: var(--at-proof);
  line-height: var(--at-proofh);
  opacity: 1;
  color: var(--at-ink);
}

/* Figma gives the label a fixed 183.362px box, so the 19px gap lands
 * the stars at x 202.362 whatever the string happens to measure. */
.lk-atelier .lkx-customers { min-width: var(--at-customersw); }

.lk-atelier .lkx-stars {
  font-family: var(--font-onest), system-ui, sans-serif;
  color: var(--at-dim);
  letter-spacing: var(--at-startrack);
}

/* ── Figma "Frame 5" · the actions ───────────────────────────────── */

/* Bottom-aligned with the circle, the mirror of the copy column: the
 * row ends one hole radius below centre (y 802 = 540+262), which from
 * the foot of the window is the same offset read the other way. */
.lk-atelier .lkx-cta {
  position: absolute;
  left: var(--at-edge);
  bottom: calc(50% - var(--at-hole));
  z-index: 4;
  display: flex;
  align-items: flex-start;
  gap: var(--at-ctagap);
}

/* Height is set rather than padded to, so the solid and the outlined
 * pill come out the same 64px whatever their strokes do. */
.lk-atelier .lk-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: auto;
  height: var(--at-btnh);
  padding: 0 var(--at-pillx);
  border-radius: var(--at-radius);
  font-size: var(--at-ui);
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
}

.lk-atelier .lk-pill-dark {
  background: var(--at-cta);
  color: var(--at-cta-ink);
}

/* `outline` rather than `border`, with the offset pulling it inside:
 * Figma aligns these hairlines INSIDE the frame, so the stroke must
 * not grow the box — the pill is 207 × 64 with or without it, exactly
 * like its solid neighbour. (An inset box-shadow would do the same
 * job, but the shared `.lk-pill:hover` already owns box-shadow.) */
.lk-atelier .lk-pill-ghost {
  border: 0;
  outline: var(--at-hair) solid rgba(242, 242, 242, 0.5);
  outline-offset: calc(-1 * var(--at-hair));
  background: transparent;
  color: var(--at-ink);
}

/* ── Figma "Rectangle 6" · the card ──────────────────────────────── */

/* Empty by design — a white-to-nothing wash that lets the blurred
 * asset read through its lower half. */
.lk-atelier .lkx-device {
  position: absolute;
  right: var(--at-edge);
  top: calc(50% - var(--at-hole));
  z-index: 2;
  width: var(--at-cardw);
  height: var(--at-cardh);
  padding: 0;
  border: var(--at-hair) solid var(--at-filmedge);
  border-radius: var(--at-radius);
  background: linear-gradient(180deg, var(--at-film) 0%, rgba(255, 255, 255, 0) 100%);
  box-shadow: none;
}

/* ── Figma "Frame 55" · the last-work plate ──────────────────────── */

/* One pixel wider than the card and one pixel further left, exactly as
 * the file has it, so the two still share a left edge at x 1440. Its
 * top is the actions row's, not the circle's: Figma starts both at
 * y 738 and simply lets this one run 2px lower. Inside stroke again,
 * so the frame stays 66 tall and not 68. */
.lk-atelier .lkx-plate {
  position: absolute;
  right: var(--at-plateedge);
  top: calc(50% + var(--at-hole) - var(--at-btnh));
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: var(--at-platew);
  height: var(--at-plateh);
  padding: 0 var(--at-platex);
  outline: var(--at-hair) solid var(--at-filmedge);
  outline-offset: calc(-1 * var(--at-hair));
  border-radius: var(--at-plater);
  background: var(--at-film);
  font-size: var(--at-ui);
  line-height: 1;
}

.lk-atelier .lkx-platetext {
  display: flex;
  align-items: center;
  gap: var(--at-plategap);
  white-space: nowrap;
}

.lk-atelier .lkx-platetext b {
  font-weight: 400;
  color: var(--at-ink);
}

.lk-atelier .lkx-platetext i {
  font-style: normal;
  color: var(--at-dim);
}

.lk-atelier .lkx-arrow {
  flex: none;
  width: var(--at-arrow);
  height: var(--at-arrow);
}

/* ── Figma "Frame 2" · the wordmark ──────────────────────────────── */

/* Four letters spread across the same 1860 measure as the nav, set in
 * General Sans Extralight at 285/228 — a line box shorter than the
 * type, so the glyphs overflow it and the frame crops the last 64px.
 * Each letter carries its own black-to-transparent gradient clipped to
 * the glyph; because the letters are flex items their gradient box IS
 * the 228px line box, which is the box Figma paints its fill in. */
.lk-atelier .lkx-giant {
  position: absolute;
  left: var(--at-edge);
  right: var(--at-edge);
  bottom: var(--at-giantdrop);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--at-giantline);
  font-family: var(--font-general), system-ui, sans-serif;
  font-size: var(--at-giant);
  font-weight: 200;
  line-height: var(--at-giantline);
  letter-spacing: normal;
  color: transparent;
  white-space: nowrap;
  pointer-events: none;
}

.lk-atelier .lkx-giant span {
  background-image: linear-gradient(
    180deg,
    rgba(242, 242, 242, 0.85) 0%,
    rgba(242, 242, 242, 0) 66.346%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

/* ══ The breakpoint tables ═════════════════════════════
 * Nothing above is fluid — every length is a pixel — so a window that
 * cannot seat the frame at 1:1 gets its own set of pixels rather than
 * a stretched version of these. Each tier restates the whole table, so
 * any breakpoint reads as a spec sheet without chasing what it
 * inherited from the one above.
 *
 * The scales come from what actually breaks first: the headline's
 * longest line running into the left edge of the circle. Measured, at
 * 1:1 that line ends at x 651 and the circle starts at x 698. Holding
 * 30px of that clearance at the NARROWEST window a tier covers gives
 *
 *     scale ≤ (width / 2 − 30) / 913
 *
 * and every number below is the largest scale that satisfies it —
 * which is also where each `max-width` comes from. Under 1024px no
 * scale satisfies it at all: the copy and the circle cannot stand side
 * by side, and the RESPONSIVE block restacks the page instead. */

/* ×0.83 — 1600 / 1680 / 1792 */
@media (max-width: 1885px) {
  .lk-atelier {
    --at-edge: 25px;           --at-navtop: 13px;         --at-hole: 217px;
    --at-ring: 698px;          --at-blur: 7px;            --at-ui: 20px;
    --at-mark: 15px;           --at-markgap: 7px;         --at-copyw: 633px;
    --at-colgap: 33px;         --at-h1: 60px;             --at-proof: 18px;
    --at-proofh: 23px;         --at-proofgap: 16px;       --at-customersw: 152.19px;
    --at-startrack: 1.83px;    --at-ctagap: 13px;         --at-pillx: 40px;
    --at-btnh: 53px;           --at-radius: 27px;         --at-cardw: 374px;
    --at-cardh: 372px;         --at-platew: 374px;        --at-plateh: 55px;
    --at-plateedge: 24px;      --at-platex: 27px;         --at-plater: 34px;
    --at-plategap: 18px;       --at-arrow: 11px;          --at-giant: 237px;
    --at-giantline: 189px;     --at-giantdrop: -53px;
  }
}

/* ×0.71 — 1440 / 1536 */
@media (max-width: 1585px) {
  .lk-atelier {
    --at-edge: 21px;           --at-navtop: 11px;         --at-hole: 186px;
    --at-ring: 597px;          --at-blur: 6px;            --at-ui: 17px;
    --at-mark: 13px;           --at-markgap: 6px;         --at-copyw: 542px;
    --at-colgap: 28px;         --at-h1: 51px;             --at-proof: 16px;
    --at-proofh: 20px;         --at-proofgap: 13px;       --at-customersw: 130.19px;
    --at-startrack: 1.56px;    --at-ctagap: 11px;         --at-pillx: 34px;
    --at-btnh: 45px;           --at-radius: 23px;         --at-cardw: 320px;
    --at-cardh: 318px;         --at-platew: 320px;        --at-plateh: 47px;
    --at-plateedge: 21px;      --at-platex: 23px;         --at-plater: 29px;
    --at-plategap: 16px;       --at-arrow: 9px;           --at-giant: 202px;
    --at-giantline: 162px;     --at-giantdrop: -45px;
  }
}

/* ×0.61 — 1280 / 1366 */
@media (max-width: 1364px) {
  .lk-atelier {
    --at-edge: 18px;           --at-navtop: 10px;         --at-hole: 160px;
    --at-ring: 513px;          --at-blur: 5px;            --at-ui: 15px;
    --at-mark: 11px;           --at-markgap: 5px;         --at-copyw: 465px;
    --at-colgap: 24px;         --at-h1: 44px;             --at-proof: 13px;
    --at-proofh: 17px;         --at-proofgap: 12px;       --at-customersw: 111.85px;
    --at-startrack: 1.34px;    --at-ctagap: 10px;         --at-pillx: 29px;
    --at-btnh: 39px;           --at-radius: 20px;         --at-cardw: 274px;
    --at-cardh: 273px;         --at-platew: 275px;        --at-plateh: 40px;
    --at-plateedge: 18px;      --at-platex: 20px;         --at-plater: 25px;
    --at-plategap: 13px;       --at-arrow: 8px;           --at-giant: 174px;
    --at-giantline: 139px;     --at-giantdrop: -39px;
  }
}

/* ×0.52 — 1024 landscape / small laptops */
@media (max-width: 1179px) {
  .lk-atelier {
    --at-edge: 16px;          --at-navtop: 8px;         --at-hole: 136px;
    --at-ring: 437px;         --at-blur: 4px;           --at-ui: 12px;
    --at-mark: 9px;           --at-markgap: 4px;        --at-copyw: 397px;
    --at-colgap: 21px;        --at-h1: 37px;            --at-proof: 11px;
    --at-proofh: 15px;        --at-proofgap: 10px;      --at-customersw: 95.35px;
    --at-startrack: 1.15px;   --at-ctagap: 8px;         --at-pillx: 25px;
    --at-btnh: 33px;          --at-radius: 17px;        --at-cardw: 234px;
    --at-cardh: 233px;        --at-platew: 235px;       --at-plateh: 34px;
    --at-plateedge: 15px;     --at-platex: 17px;        --at-plater: 21px;
    --at-plategap: 11px;      --at-arrow: 7px;          --at-giant: 148px;
    --at-giantline: 119px;    --at-giantdrop: -33px;
  }
}


/* ══ Short windows ═══════════════════════════════════
 * Height binds before width on a laptop with a shallow window. The
 * wordmark is pinned to the foot of the page and the actions row to
 * the circle, and holding 30px between them wants
 *
 *     height ≥ 856 × scale + 30
 *
 * so each tier above gets a height twin that trips at the point its
 * own table stops fitting. The `min-width` half stops a twin from
 * overriding a narrower tier that has already picked a smaller set. */

/* ×0.83 */
@media (max-height: 915px) and (min-width: 1886px) {
  .lk-atelier {
    --at-edge: 25px;           --at-navtop: 13px;         --at-hole: 217px;
    --at-ring: 698px;          --at-blur: 7px;            --at-ui: 20px;
    --at-mark: 15px;           --at-markgap: 7px;         --at-copyw: 633px;
    --at-colgap: 33px;         --at-h1: 60px;             --at-proof: 18px;
    --at-proofh: 23px;         --at-proofgap: 16px;       --at-customersw: 152.19px;
    --at-startrack: 1.83px;    --at-ctagap: 13px;         --at-pillx: 40px;
    --at-btnh: 53px;           --at-radius: 27px;         --at-cardw: 374px;
    --at-cardh: 372px;         --at-platew: 374px;        --at-plateh: 55px;
    --at-plateedge: 24px;      --at-platex: 27px;         --at-plater: 34px;
    --at-plategap: 18px;       --at-arrow: 11px;          --at-giant: 237px;
    --at-giantline: 189px;     --at-giantdrop: -53px;
  }
}

/* ×0.71 */
@media (max-height: 770px) and (min-width: 1586px) {
  .lk-atelier {
    --at-edge: 21px;           --at-navtop: 11px;         --at-hole: 186px;
    --at-ring: 597px;          --at-blur: 6px;            --at-ui: 17px;
    --at-mark: 13px;           --at-markgap: 6px;         --at-copyw: 542px;
    --at-colgap: 28px;         --at-h1: 51px;             --at-proof: 16px;
    --at-proofh: 20px;         --at-proofgap: 13px;       --at-customersw: 130.19px;
    --at-startrack: 1.56px;    --at-ctagap: 11px;         --at-pillx: 34px;
    --at-btnh: 45px;           --at-radius: 23px;         --at-cardw: 320px;
    --at-cardh: 318px;         --at-platew: 320px;        --at-plateh: 47px;
    --at-plateedge: 21px;      --at-platex: 23px;         --at-plater: 29px;
    --at-plategap: 16px;       --at-arrow: 9px;           --at-giant: 202px;
    --at-giantline: 162px;     --at-giantdrop: -45px;
  }
}

/* ×0.61 */
@media (max-height: 667px) and (min-width: 1365px) {
  .lk-atelier {
    --at-edge: 18px;           --at-navtop: 10px;         --at-hole: 160px;
    --at-ring: 513px;          --at-blur: 5px;            --at-ui: 15px;
    --at-mark: 11px;           --at-markgap: 5px;         --at-copyw: 465px;
    --at-colgap: 24px;         --at-h1: 44px;             --at-proof: 13px;
    --at-proofh: 17px;         --at-proofgap: 12px;       --at-customersw: 111.85px;
    --at-startrack: 1.34px;    --at-ctagap: 10px;         --at-pillx: 29px;
    --at-btnh: 39px;           --at-radius: 20px;         --at-cardw: 274px;
    --at-cardh: 273px;         --at-platew: 275px;        --at-plateh: 40px;
    --at-plateedge: 18px;      --at-platex: 20px;         --at-plater: 25px;
    --at-plategap: 13px;       --at-arrow: 8px;           --at-giant: 174px;
    --at-giantline: 139px;     --at-giantdrop: -39px;
  }
}

/* ×0.52 */
@media (max-height: 581px) and (min-width: 1180px) {
  .lk-atelier {
    --at-edge: 16px;          --at-navtop: 8px;         --at-hole: 136px;
    --at-ring: 437px;         --at-blur: 4px;           --at-ui: 12px;
    --at-mark: 9px;           --at-markgap: 4px;        --at-copyw: 397px;
    --at-colgap: 21px;        --at-h1: 37px;            --at-proof: 11px;
    --at-proofh: 15px;        --at-proofgap: 10px;      --at-customersw: 95.35px;
    --at-startrack: 1.15px;   --at-ctagap: 8px;         --at-pillx: 25px;
    --at-btnh: 33px;          --at-radius: 17px;        --at-cardw: 234px;
    --at-cardh: 233px;        --at-platew: 235px;       --at-plateh: 34px;
    --at-plateedge: 15px;     --at-platex: 17px;        --at-plater: 21px;
    --at-plategap: 11px;      --at-arrow: 7px;          --at-giant: 148px;
    --at-giantline: 119px;    --at-giantdrop: -33px;
  }
}

/* ×0.44 */
@media (max-height: 504px) and (min-width: 1024px) {
  .lk-atelier {
    --at-edge: 13px;          --at-navtop: 7px;         --at-hole: 115px;
    --at-ring: 370px;         --at-blur: 4px;           --at-ui: 11px;
    --at-mark: 8px;           --at-markgap: 4px;        --at-copyw: 336px;
    --at-colgap: 18px;        --at-h1: 32px;            --at-proof: 10px;
    --at-proofh: 12px;        --at-proofgap: 8px;       --at-customersw: 80.68px;
    --at-startrack: 0.97px;   --at-ctagap: 7px;         --at-pillx: 21px;
    --at-btnh: 28px;          --at-radius: 14px;        --at-cardw: 198px;
    --at-cardh: 197px;        --at-platew: 198px;       --at-plateh: 29px;
    --at-plateedge: 13px;     --at-platex: 14px;        --at-plater: 18px;
    --at-plategap: 10px;      --at-arrow: 6px;          --at-giant: 125px;
    --at-giantline: 100px;    --at-giantdrop: -28px;
  }
}

/* ×0.36 */
@media (max-height: 436px) and (min-width: 1024px) {
  .lk-atelier {
    --at-edge: 11px;          --at-navtop: 6px;         --at-hole: 94px;
    --at-ring: 303px;         --at-blur: 3px;           --at-ui: 9px;
    --at-mark: 6px;           --at-markgap: 3px;        --at-copyw: 275px;
    --at-colgap: 14px;        --at-h1: 26px;            --at-proof: 8px;
    --at-proofh: 10px;        --at-proofgap: 7px;       --at-customersw: 66.01px;
    --at-startrack: 0.79px;   --at-ctagap: 6px;         --at-pillx: 17px;
    --at-btnh: 23px;          --at-radius: 12px;        --at-cardw: 162px;
    --at-cardh: 161px;        --at-platew: 162px;       --at-plateh: 24px;
    --at-plateedge: 10px;     --at-platex: 12px;        --at-plater: 15px;
    --at-plategap: 8px;       --at-arrow: 5px;          --at-giant: 103px;
    --at-giantline: 82px;     --at-giantdrop: -23px;
  }
}

/* ══ RESPONSIVE ══════════════════════════════════════════════════════
 * Two things adapt, and they do different jobs.
 *
 * The SIZE is handled by the breakpoint tables at the end of the
 * composition scope: each one restates every length in its own hard
 * pixels, so a narrower window gets a smaller set of numbers rather
 * than a stretched version of the wide one.
 *
 * The LAYOUT is handled here. A phone is not a small desktop — a row
 * of six nav links and a headline cut for a wide measure do not
 * survive being shrunk — so the rules below restack the shared
 * `.lkx-*` vocabulary every look is built from, and the composition
 * scope further down adds whatever is specific to this one. 1024px is
 * where the wide layout gives out: below it no pixel size seats the
 * copy column beside the circle, so the page restacks instead.
 *
 * Work here rather than in the scope, so the desktop reading survives
 * whatever you change for the phone. */
@media (max-width: 1023px) {
  /* The nav link list is the first thing that cannot fit; brand and
   * primary action carry the bar on their own. Some looks group the
   * links in `.lkx-links`, others drop bare <span>s straight into the
   * bar — an unclassed direct child of the nav is a link by
   * construction, so both spellings go. */
  .lk .lkx-links,
  .lk .lkx-nav > span:not([class]) { display: none; }

  /* Display type is cut for a wide measure, so its hard line breaks —
   * which belong to the desktop composition — come out. The SIZE it
   * comes down to is not set here: it is a pixel in the phone table
   * below. A `.lk`-level `font-size` would out-cascade that table,
   * since it matches at the same specificity from further down the
   * stylesheet, and the composition would quietly render at the
   * library's default instead of its own. */
  .lk .lkx-h1 br,
  .lk .lkx-sub br { display: none; }

  .lk .lkx-sub {
    font-size: 0.8rem;
    max-width: 20rem;
  }

  .lk .lkx-copy {
    gap: 1rem;
    padding: 0 1.4rem;
  }

  .lk .lkx-cta {
    flex-wrap: wrap;
    justify-content: center;
  }

  /* ── Atelier on a phone ──────────────────────────────────────────
   * The Figma frame is 16:9 and sets its copy BESIDE the circle; a
   * portrait screen has no room for that, so the composition goes
   * single column — copy above the hole, actions below it — and two
   * things that earn their keep only on a wide screen drop out: the
   * empty gradient card, and the last-work plate. The plate is the
   * quieter of the two claims on the reader's attention and it sat
   * directly under the actions, so losing it gives the row below the
   * circle one job instead of two.
   *
   * The circle keeps the CENTRE of the window, exactly as it does at
   * 1:1. The copy and the actions do NOT hang off it: the copy sits a
   * fixed drop below the nav and the actions a fixed rise above the
   * foot, so both stay put and the circle takes the whole middle.
   * That is what `--at-copytop` and `--at-ctabot` measure — from the
   * top edge and the bottom edge — and the gap either one leaves to
   * the circle is simply what is left over.
   *
   * The ring keeps Figma's proportion to the hole (Ø841 against Ø524,
   * so 3.21 × the radius) and is therefore wider than a phone at these
   * sizes. Letting it run off both edges is the point: it reads as an
   * arc of something larger, the same way the wordmark does. */
  .lk-atelier {
    --at-edge: 40px;           --at-navtop: 28px;         --at-hole: 132px;
    --at-ring: 424px;          --at-copytop: 92px;        --at-ctabot: 120px;
    --at-blur: 8px;            --at-ui: 20px;             --at-mark: 15px;
    --at-markgap: 7px;         --at-colgap: 24px;         --at-h1: 58px;
    --at-proof: 18px;          --at-proofh: 24px;         --at-proofgap: 14px;
    --at-customersw: 0px;      --at-startrack: 1.8px;     --at-ctagap: 14px;
    --at-pillx: 34px;          --at-btnh: 54px;           --at-radius: 27px;
    --at-arrow: 11px;          --at-giant: 110px;         --at-giantline: 88px;
    --at-giantdrop: -18px;
  }

  .lk-atelier .lkx-left {
    left: var(--at-edge);
    right: var(--at-edge);
    top: var(--at-copytop);
    bottom: auto;
    width: auto;
  }

  .lk-atelier .lkx-cta {
    left: var(--at-edge);
    right: var(--at-edge);
    top: auto;
    bottom: var(--at-ctabot);
    justify-content: flex-start;
  }

  /* Decoration the stack cannot spend the height on. */
  .lk-atelier .lkx-device,
  .lk-atelier .lkx-plate { display: none; }
}

/* ── …and on a phone ─────────────────────────────────────────────── */
@media (max-width: 760px) {
  .lk-atelier {
    --at-edge: 24px;           --at-navtop: 22px;         --at-hole: 135px;
    --at-ring: 433px;          --at-copytop: 80px;        --at-ctabot: 100px;
    --at-ui: 17px;             --at-mark: 13px;           --at-markgap: 6px;
    --at-colgap: 20px;         --at-h1: 46px;             --at-proof: 16px;
    --at-proofh: 22px;         --at-proofgap: 12px;       --at-startrack: 1.6px;
    --at-ctagap: 12px;         --at-pillx: 28px;          --at-btnh: 48px;
    --at-radius: 24px;         --at-arrow: 10px;          --at-giant: 84px;
    --at-giantline: 67px;      --at-giantdrop: -13px;
  }
}

/* ── …and on a small one ─────────────────────────────────────────── */
@media (max-width: 560px) {
  .lk-atelier {
    --at-edge: 20px;           --at-navtop: 18px;         --at-hole: 150px;
    --at-ring: 482px;          --at-copytop: 76px;        --at-ctabot: 88px;
    --at-ui: 15px;             --at-mark: 11px;           --at-colgap: 16px;
    --at-h1: 42px;             --at-proof: 14px;          --at-proofh: 20px;
    --at-proofgap: 10px;       --at-startrack: 1.4px;     --at-ctagap: 10px;
    --at-pillx: 22px;          --at-btnh: 44px;           --at-radius: 22px;
    --at-arrow: 9px;           --at-giant: 66px;          --at-giantline: 53px;
    --at-giantdrop: -10px;
  }
}

@media (max-width: 400px) {
  .lk-atelier {
    --at-edge: 18px;           --at-hole: 150px;          --at-ring: 482px;
    --at-copytop: 72px;        --at-ctabot: 80px;         --at-ui: 14px;
    --at-mark: 10px;           --at-colgap: 14px;         --at-h1: 38px;
    --at-proof: 13px;          --at-proofh: 18px;         --at-ctagap: 8px;
    --at-pillx: 20px;          --at-btnh: 42px;           --at-radius: 21px;
    --at-arrow: 8px;           --at-giant: 58px;          --at-giantline: 46px;
    --at-giantdrop: -8px;
  }
}

@media (max-width: 360px) {
  .lk-atelier {
    --at-edge: 16px;           --at-hole: 125px;          --at-ring: 401px;
    --at-copytop: 66px;        --at-ctabot: 72px;         --at-ui: 13px;
    --at-h1: 32px;             --at-colgap: 12px;         --at-giant: 52px;
    --at-giantline: 42px;      --at-giantdrop: -7px;
  }
}

/* ══ Short windows, stacked ══════════════════════════════════════════
 * Centring the circle means the copy has to clear it going UP, so the
 * room above the centre line — half the window, less where the copy
 * starts, less how tall it is — is what caps the radius:
 *
 *     hole ≤ height / 2 − copytop − copy − clearance
 *
 * The copy's height is the one term CSS cannot see, since it turns on
 * how many lines the headline takes, so every band below is sized for
 * the TALLEST copy its width can produce. That is also why the bands
 * are width-scoped: a tablet's copy runs half again as tall as a
 * phone's, and one height rule for both would starve the phone to feed
 * the tablet. Each band states only the lengths that move. */

/* Tablet scale, headline at 58px. */
@media (min-width: 761px) and (max-width: 1023px) and (max-height: 1009px) {
  .lk-atelier {
    --at-hole: 100px; --at-ring: 321px; --at-copytop: 84px;
    --at-ctabot: 104px;
  }
}

/* Below this the tablet's own display type is what does not fit, so
 * the scale drops to the phone's and the circle gets the room back. */
@media (min-width: 761px) and (max-width: 1023px) and (max-height: 865px) {
  .lk-atelier {
    --at-edge: 20px;           --at-navtop: 18px;         --at-hole: 125px;
    --at-ring: 401px;          --at-copytop: 72px;        --at-ctabot: 90px;
    --at-ui: 15px;             --at-mark: 11px;           --at-markgap: 6px;
    --at-colgap: 16px;         --at-h1: 40px;             --at-proof: 14px;
    --at-proofh: 20px;         --at-proofgap: 10px;       --at-ctagap: 10px;
    --at-pillx: 22px;          --at-btnh: 44px;           --at-radius: 22px;
    --at-arrow: 9px;           --at-giant: 66px;          --at-giantline: 53px;
    --at-giantdrop: -10px;
  }
}

/* Large-phone scale, headline at 46px on two or three lines. */
@media (min-width: 561px) and (max-width: 760px) and (max-height: 899px) {
  .lk-atelier {
    --at-hole: 115px; --at-ring: 369px; --at-copytop: 74px;
    --at-ctabot: 90px;
  }
}

@media (min-width: 561px) and (max-width: 760px) and (max-height: 779px) {
  .lk-atelier {
    --at-hole: 80px; --at-ring: 257px; --at-copytop: 64px;
    --at-ctabot: 84px;
  }
}

/* Phone scale, headline at 42px. */
@media (min-width: 401px) and (max-width: 560px) and (max-height: 879px) {
  .lk-atelier {
    --at-hole: 115px; --at-ring: 369px; --at-copytop: 66px;
    --at-ctabot: 82px;
  }
}

@media (min-width: 401px) and (max-width: 560px) and (max-height: 775px) {
  .lk-atelier {
    --at-hole: 80px; --at-ring: 257px; --at-copytop: 58px;
    --at-ctabot: 76px;
  }
}

/* Small-phone scale, headline at 38px (32px under 360). */
@media (max-width: 400px) and (max-height: 815px) {
  .lk-atelier {
    --at-h1: 38px;    --at-hole: 140px; --at-ring: 449px; --at-copytop: 64px;
    --at-ctabot: 76px;
  }
}

@media (max-width: 400px) and (max-height: 735px) {
  .lk-atelier {
    --at-h1: 30px;    --at-hole: 105px; --at-ring: 337px; --at-copytop: 56px;
    --at-ctabot: 70px;
  }
}

/* ══ Very short windows, stacked ═════════════════════════════════════
 * A phone held sideways, and any window shaped like one. Four blocks
 * want stacking into ~400px of height and only three of them fit, so
 * the wordmark — decoration, and already three-quarters cropped by the
 * foot of the page — is the one that goes, and the display type steps
 * down band by band to keep the headline short.
 *
 * Width still scopes these, for the same reason it scopes the bands
 * above: a phone lying on its side is 800-odd pixels wide and puts the
 * headline on ONE line, where a deliberately narrowed window takes two
 * or three. Sizing both from the narrow case would leave a landscape
 * phone with a circle a sixth the size it has room for. */

/* Sideways: wide enough for a one-line headline once the type steps
 * down, so the circle keeps most of the height it can reach. */
@media (min-width: 561px) and (max-width: 1023px) and (max-height: 659px) {
  .lk-atelier {
    --at-edge: 16px;           --at-navtop: 12px;         --at-hole: 105px;
    --at-ring: 337px;          --at-copytop: 50px;        --at-ctabot: 26px;
    --at-blur: 6px;            --at-ui: 13px;             --at-mark: 9px;
    --at-markgap: 5px;         --at-colgap: 10px;         --at-h1: 30px;
    --at-proof: 12px;          --at-proofh: 16px;         --at-proofgap: 8px;
    --at-startrack: 1.2px;     --at-ctagap: 8px;          --at-pillx: 18px;
    --at-btnh: 34px;           --at-radius: 17px;         --at-arrow: 7px;
  }

  .lk-atelier .lkx-giant { display: none; }
}

@media (min-width: 561px) and (max-width: 1023px) and (max-height: 551px) {
  .lk-atelier {
    --at-hole: 90px;           --at-ring: 289px;          --at-copytop: 44px;
    --at-ctabot: 22px;         --at-h1: 26px;             --at-colgap: 8px;
  }
}

@media (min-width: 561px) and (max-width: 1023px) and (max-height: 465px) {
  .lk-atelier {
    --at-hole: 72px;           --at-ring: 231px;          --at-copytop: 44px;
    --at-ctabot: 18px;         --at-h1: 22px;             --at-btnh: 30px;
    --at-radius: 15px;
  }
}

@media (min-width: 561px) and (max-width: 1023px) and (max-height: 385px) {
  .lk-atelier {
    --at-hole: 48px;           --at-ring: 154px;          --at-copytop: 34px;
    --at-ctabot: 14px;         --at-ui: 12px;             --at-h1: 20px;
  }
}

/* Narrow AND short — a window squeezed on both axes rather than a
 * device. The headline takes two or three lines here whatever the
 * type does, so these bands stay conservative. */
@media (max-width: 560px) and (max-height: 659px) {
  .lk-atelier {
    --at-edge: 16px;           --at-navtop: 12px;         --at-hole: 90px;
    --at-ring: 289px;          --at-copytop: 44px;        --at-ctabot: 24px;
    --at-blur: 6px;            --at-ui: 13px;             --at-mark: 9px;
    --at-markgap: 5px;         --at-colgap: 10px;         --at-h1: 26px;
    --at-proof: 12px;          --at-proofh: 16px;         --at-proofgap: 8px;
    --at-startrack: 1.2px;     --at-ctagap: 8px;          --at-pillx: 18px;
    --at-btnh: 34px;           --at-radius: 17px;         --at-arrow: 7px;
  }

  .lk-atelier .lkx-giant { display: none; }
}

@media (max-width: 560px) and (max-height: 533px) {
  .lk-atelier {
    --at-hole: 66px;           --at-ring: 212px;          --at-copytop: 38px;
    --at-ctabot: 20px;         --at-h1: 22px;             --at-colgap: 8px;
    --at-btnh: 30px;           --at-radius: 15px;
  }
}

@media (max-width: 560px) and (max-height: 423px) {
  .lk-atelier {
    --at-hole: 38px;           --at-ring: 122px;          --at-copytop: 32px;
    --at-ctabot: 16px;         --at-ui: 12px;             --at-h1: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  html.lk-js [data-rise] { opacity: 1; }
}
```

## Motion — the entry cascade

A spring cascade runs once on load. It is the app's own, ported verbatim; keep
the ordering and the stagger, because the composition reads as assembling
itself rather than appearing.

```js
/* ══ The entry cascade ═══════════════════════════════════════════════
   * A 1:1 port of the app's `<Rise>` (src/components/ui/ui-looks/shared.tsx):
   * every `[data-rise]` element springs from y:14px / opacity:0 to rest,
   * staggered 45ms per step, on a react-spring `{ tension: 220, friction:
   * 26 }` — integrated here rather than eased, so the overshoot is the
   * real thing and not a bezier impression of it.
   *
   * Replay: press R. (There is no click-to-replay — the composition is
   * full bleed now, so every click would land on it.) */
  (() => {
    const STEP_MS = 45;
    const FROM_Y = 14;
    const TENSION = 220;
    const FRICTION = 26;
    const MASS = 1;
    const PRECISION = 0.01;
    const SUBSTEP = 1 / 240;

    const root = document.documentElement;
    root.classList.add("lk-js");

    const nodes = Array.from(document.querySelectorAll("[data-rise]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let generation = 0;

    const rest = (el) => {
      el.style.transform = "";
      el.style.opacity = "1";
      el.style.willChange = "";
    };

    const rise = (el, delayMs, gen) => {
      el.style.opacity = "0";
      el.style.transform = "translate3d(0," + FROM_Y + "px,0)";
      el.style.willChange = "transform, opacity";

      if (reduced) {
        window.setTimeout(() => { if (gen === generation) rest(el); }, delayMs);
        return;
      }

      let x = FROM_Y;
      let v = 0;
      let last = null;

      const frame = (now) => {
        if (gen !== generation) return;
        if (last === null) last = now;

        // Clamp the step so a backgrounded tab never explodes the integrator.
        const dt = Math.min((now - last) / 1000, 0.064);
        last = now;

        const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          const a = (-TENSION * x - FRICTION * v) / MASS;
          v += a * h;
          x += v * h;
        }

        // opacity rides the same normalised trajectory as y — one spring
        // shape, two properties, exactly as react-spring resolves it.
        const p = 1 - x / FROM_Y;
        el.style.transform = "translate3d(0," + x.toFixed(3) + "px,0)";
        el.style.opacity = String(Math.max(0, Math.min(1, p)));

        if (Math.abs(x) < PRECISION && Math.abs(v) < PRECISION) return rest(el);
        requestAnimationFrame(frame);
      };

      // The stagger is a timer, not a rAF countdown: comparing a rAF
      // timestamp against a `performance.now()` deadline quietly never
      // fires under a virtual clock, and it burns a frame per element
      // per tick besides.
      window.setTimeout(() => {
        if (gen === generation) requestAnimationFrame(frame);
      }, delayMs);
    };

    const play = () => {
      const gen = ++generation;
      nodes.forEach((el) => {
        const order = Number(el.dataset.rise) || 0;
        rise(el, order * STEP_MS, gen);
      });
    };

    play();

    addEventListener("keydown", (e) => {
      if (e.key === "r" || e.key === "R") play();
    });
  })();
  </script>

  <script>
  /*
```

## Fonts

The reference loads its typeface from Fontshare. Keep the family and the
weights; if the user's project already has a type system, map the display and
body roles onto it rather than adding a second font stack.
