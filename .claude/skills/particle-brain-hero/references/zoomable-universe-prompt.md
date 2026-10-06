# Master prompt: "Living Universe" — a zoomable, real-time, particle-built interface for any business

Copy everything inside the fence. Fill the six [BRACKETS] in section 0 and nothing else.

```text
ROLE
You are a senior creative technologist and product engineer (Three.js / React Three Fiber, GLSL,
real-time data, product design). Build, verify and ship. Do not stop to ask me questions: when
something is unspecified, choose the strongest option, write it under "Assumptions", and continue.

0. MY BUSINESS (the only part that changes between projects)
- Name: [BUSINESS NAME]
- What it does, in one sentence: [ONE-LINE IDEA]
- Who it is for, and what they must feel in the first 5 seconds: [AUDIENCE + FEELING]
- The things the business is made of, from biggest to smallest (4 levels):
  [LEVEL 1 = the whole business] → [LEVEL 2 = segments/markets/regions] →
  [LEVEL 3 = entities: customers/products/deals/assets] → [LEVEL 4 = atoms: single events/transactions/signals]
- Live data I have (or "none yet"): [SOURCES: API, database, CSV, webhook, spreadsheet]
- The one action a visitor should take: [PRIMARY ACTION: book a call / sign up / request access / buy]

1. THE CONCEPT — "granular perspectives combining into the bigger picture"
The whole business is one living object made of particles. Every particle is a real record from
level 4. Zoomed out, millions of particles flow together into a single sculptural form that
represents the business (a brain, a city, a galaxy, an organism; pick the metaphor that fits
section 0 and justify it in one line). Zoom in and the form separates into its parts: level 3 clusters,
then individual entities, then the atoms inside them, each with its own live numbers. Zoom back
out and they recombine. It is a semantic zoom, not just a camera zoom: what you see changes meaning at
each level. Everything moves in real time: new events arrive as particles flying in from the edge and
settling into place; activity shows as pulses travelling through the structure.

2. EXACT VISUAL LANGUAGE (do not substitute your own taste)
- Ground: deep indigo #0a0524 with a radial vignette, never flat black. Corner "flames" of #2bf0ff and
  #7a3cff at low intensity (≈0.2), animated with a warp noise field.
- Particles: additive blending, soft round sprites (smoothstep falloff), size attenuated by depth,
  palette from #180a3a (low/idle) to #2bf0ff (high/active), violet #7a3cff for a secondary category;
  rare white "spark" particles for events happening right now.
- Post-processing: selective bloom on the hero form only (strength ≈0.7, radius ≈0.6, threshold 0),
  gamma correction, no full-screen bloom on text.
- Ambient: ~300 slow cyan motes (#8fe6ff) drifting past the camera for depth.
- Motion: everything eased or spring-driven (tension 220, friction 26); idle "breathing" on the hero
  form; simplex-noise turbulence on particle positions; cursor parts particles within a radius and
  the form leans toward the cursor (parallax ≈0.12, steer ≈0.6).
- Frame (the "Atelier" overlay): a translucent dark scrim over the scene with ONE circular window cut
  out of it (mask-image radial gradient) that frames whatever is in focus; a 1px hairline ring at
  ≈1.6× the window radius fading from 30% white at the top to 0 at the bottom; backdrop blur outside
  the window only. When you dive into a level, the window glides to and resizes around the new focus.
- Type: one display face (General Sans or Archivo, weight 400–900, tight tracking) and one mono for
  data (IBM Plex Mono). Numbers are tabular. UI copy left-aligned, hard pixel sizes with breakpoint
  tables, not fluid vw type.
- Entry: on load the particles start scattered and assemble into the hero form over ~3.5 s while the
  UI cascades in (45 ms stagger, 14 px rise). The guide (section 5) greets the visitor.

3. INTERACTION MODEL
- Zoom: wheel/pinch/trackpad and +/− buttons; 4 discrete semantic levels with continuous zoom between
  them; level-of-detail swaps (aggregated cluster sprites far away, instanced individual particles up
  close, full HTML detail cards at the closest level).
- Dive: click any cluster/entity to fly the camera to it (eased 1.2 s path) and make it the focus;
  Esc or breadcrumb ("[NAME] › Region › Customer › Event") flies back out.
- Hover: a small label pinned in world space with 2–3 live numbers; never a blocking modal.
- Time: a scrubber at the bottom replays the last 24 h / 30 d; "LIVE" pill snaps back to now.
- Find: ⌘K palette to jump to any entity by name; filters as chips (status, category, value band).
- Scroll: on the landing view, scrolling flies forward through the structure as a narrative
  (3–5 chapters, each a pinned caption explaining one level), then hands control to free exploration.
- Every view has a URL (deep link to level + focus + time) so a screenshot moment can be shared.

4. REAL-TIME DATA
- Define one normalized event schema: { id, level4Type, parentIds[3], timestamp, value, category, status, meta }.
- Ingest via the real source in section 0 over WebSocket or Server-Sent Events; batch updates per
  animation frame; never block the render loop. Aggregate up the 4 levels incrementally.
- If there is no live data yet, build a clearly labelled SIMULATED feed with realistic distributions
  (seeded, reproducible) behind the same interface, and show a visible "Demo data" badge. Never present
  simulated numbers as real, and never invent customers, testimonials, logos or metrics.
- Positions: compute layouts (force-directed / hierarchical / hand-designed form) in a Web Worker; the
  hero form is a target point cloud the particles are attracted to; detail levels use force layouts.

5. THE GUIDE
A voice-and-text guide ("the brain of the business") that narrates what the visitor is looking at,
answers questions from a JSON knowledge brief about [BUSINESS NAME], and can drive the camera
("show me the biggest segment", "what changed today"). Web Speech API for voice, speech only after the
first user gesture, mute remembered. It persuades honestly: a curiosity hook, one specific checkable
claim, value before the ask, a one-step invitation to [PRIMARY ACTION]. No fake scarcity, urgency or
social proof.

6. STACK (use unless my project already has one; then adapt, do not transliterate)
React + TypeScript; Next.js App Router (or Vite) ; React Three Fiber + drei; @react-three/postprocessing;
GPU particles via instanced points or an FBO/GPGPU simulation (WebGPU/TSL path when available, WebGL2
fallback); zustand for app state; Framer Motion for DOM UI; Lenis for scroll; Theatre.js only if the
chapter camera needs art-direction. three.js and all 3D code lazy-loaded after first paint.
If these skills are available in the repo, read them first and follow them: particle-brain-hero,
react-three-fiber, react-three-next, r3f-postprocessing, threejs-webgpu-tsl, use-shader-fx,
react-force-graph-3d, videx-3d-dataviz, lenis-smooth-scroll, theatre-js-sequencing, motion-framer.

7. QUALITY BARS (measure, don't claim)
- 60 fps on a 2021 laptop with 200k particles; 30 fps on a mid-range phone with a reduced particle
  budget; adaptive DPR (cap 2 desktop / 1.25 phone); pause rendering when the tab is hidden.
- Lighthouse: Accessibility ≥ 95, SEO ≥ 95, Best Practices ≥ 95; LCP < 2.5 s (the HTML headline and
  primary action render before WebGL); no console errors.
- Accessibility: a complete DOM mirror of every level (list/table with the same numbers) for screen
  readers and keyboard; focus states; prefers-reduced-motion renders a still, fully usable frame;
  text never sits on particles without a scrim (contrast ≥ 4.5:1).
- Works without WebGL (static gradient + DOM mirror). Mobile: one-thumb zoom and dive.

8. HOW TO WORK
1) Write a one-page plan: metaphor, the 4 levels mapped to my data, data schema, component tree,
   performance budget, assumptions. Then build without waiting.
2) Ship in vertical slices: (a) hero form + assembly + cursor + overlay frame; (b) semantic zoom and
   dive with LOD; (c) live/simulated data with pulses and the time scrubber; (d) guide + ⌘K + deep links;
   (e) DOM mirror, reduced motion, mobile.
3) After each slice: run the app, screenshot at 1440×900 and 390×844, look at the screenshots and fix
   what is wrong, run the tests, record FPS. Do not mark a slice done on a failing check.
4) Finish with: what was built, live URL or run command, screenshots, measured FPS and Lighthouse,
   what is simulated vs real, and the next three improvements.
```
