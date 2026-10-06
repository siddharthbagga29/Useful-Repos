---
name: particle-brain-hero
description: Siddharth's signature immersive background — the "Tunnel" three.js particle wormhole with a particle brain (Jarvis's head / a "Neuralink brain") that assembles from the particles, leans toward and parts around the cursor, pulses while Jarvis speaks and greets visitors, framed by the "Atelier" UI scrim (a wash with a circular window and a fading hairline ring). Use whenever Siddharth asks for "the brain", "particle brain", "Jarvis head", "Neuralink brain", "the tunnel / wormhole scene", "particles combining into something that moves with the mouse", "the Atelier look", "immersive/hypnotic background", or to put "something noticeable instead of a black background" on any page.
---

# Particle brain hero (Tunnel scene + Atelier frame)

Siddharth's own spec for this look lives in `references/` — **read both before building**:

- `references/tunnel-scene.md` — the Three.js "Tunnel" scene, value for value (geometry, shaders,
  colours, motion, the FinalPass composite). Treat every number as fixed.
- `references/atelier-ui.md` — the "Atelier" (dark) composition: the scrim with a Ø524 circle cut
  out of it, the fading ring, the copy column, pills, giant wordmark, spring cascade, breakpoint
  tables. Its own rule: *adapt, do not transliterate* — port it into the stack in use.

## What he asked for (his words, condensed)

- "Small particles combining to make a bigger thing and then moving when the mouse moves."
- "A brain-like structure which includes all my information and acts like Jarvis's main head or a
  Neuralink brain, which greets you as soon as you enter the page."
- "The structure of the website remains the same, but instead of a black background … something
  noticeable … infuse this in that."
- He wants it to persuade visitors to become clients or connect. **Do it honestly**: curiosity
  hooks, specific verifiable claims, value before the ask, a one-question first step. Never invent
  scarcity, urgency, customer counts, stars or testimonials (the Atelier template's
  "3000+ customers ★★★★★" is placeholder copy — replace it with real proof or drop it).

## Where it already exists — reuse before rebuilding

| Piece | File |
|---|---|
| Scene (tunnel, motes, FinalPass, brain, pupil) | `portfolio/src/scene/den.ts` |
| React mount, lazy-load, Atelier scrim + ring | `portfolio/src/scene/Backdrop.tsx`, `backdrop.css` |
| Jarvis greeting (text now, voice on first gesture) | `portfolio/src/jarvis/Greeting.tsx` |
| e2e checks | `portfolio/e2e/e2e.py` → `den_scene()` (needs `?scene=1` under automation) |

## How the spec was adapted (keep these decisions)

1. **three r0.143.0** from npm (`three@0.143.0`, `@types/three@0.143.2`), imported through Vite and
   loaded with a dynamic `import()` after first paint (`requestIdleCallback`). The spec's importmap
   and single `index.html` apply only when building a standalone page.
2. **Background, not a section.** A fixed full-viewport canvas behind `main` (`main { z-index: 1 }`);
   `html` carries a static indigo gradient so the page is never black while three.js loads.
3. **Brain.** ~22k points (9k on phones) sampled on a brain surface: two folded hemispheres
   (density follows a sine "gyri" field), a ridged cerebellum, a brainstem. Points start scattered
   through the tunnel and assemble over ~3.7 s. It is a child of the camera (fixed on screen), on
   the BLOOM layer so only it blooms; leans toward the cursor, parts around it, carries travelling
   "neural" pulse waves and sparks, and ripples while `useJarvis().status === "speaking"`.
4. **Pupil.** A dark radial disc behind the brain = the wormhole's throat, so the brain reads on
   black. The camera's `lookAt` is offset so the throat sits behind the brain on the opening
   station; the offset eases to zero as you scroll, so the flight then runs down the axis as the
   spec has it.
5. **Atelier infusion.** Only its signature: the masked scrim (circle window centred on the brain,
   radius ×1.62 desktop / ×1.05 phones), backdrop blur on desktop, and the ring at 3.21 × the
   window radius with the 30%→0 white gradient. The window closes after the first ~6% of scroll.
6. **Output-neutral performance cuts.** DPR capped (2 desktop, 1.25 phones); thinner tunnel grid on
   phones; the spec's torus composer renders a layer nothing is on (always black), so it is not run;
   rendering pauses when the tab is hidden; `prefers-reduced-motion` renders one still frame.
7. **Automation.** Skipped when `navigator.webdriver` unless `?scene=1` (software WebGL is slow).

## Checklist for a new page or variant

- Read both references; keep the spec's numbers unless a decision above says otherwise.
- Text must stay readable over the scene: veil ≥ 0.46 desktop, ≥ 0.7 phones, text-shadow on
  copy over particles. Screenshot at 1440×900 and 390×844 with `?scene=1` and look at it.
- Brain on screen must not sit under body copy on desktop (it lives right of the hero copy).
- Run `portfolio/e2e/e2e.py`; check Lighthouse; no console errors.
- Related skills in this folder: `threejs-webgl`, `r3f-postprocessing`, `lightweight-3d-effects`,
  `motion-framer`, `gsap-scrolltrigger`, `modern-web-design`.
