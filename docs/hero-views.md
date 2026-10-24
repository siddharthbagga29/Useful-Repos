# Opening view: desktop and mobile specification

The reference for how the home page's opening view looks on each class of screen. Change it here first,
then in code, then re-run the baselines.

## Layers, back to front

| # | Layer | Element | Job |
|---|---|---|---|
| 1 | Scene | `.den-canvas` (WebGL, `src/scene/den.ts`) | The tunnel of particles and Jarvis's particle brain, which forms from the tunnel in the first ~4 s |
| 2 | Wash | `.den-scrim` | A dark violet wash over the scene with a circular **window** cut where the brain floats |
| 3 | Ring | `.den-ring` | A hairline ring around the window (desktop only) |
| 4 | Content | `main` | Copy, buttons, panels. Never filtered by any of the layers above |

## Behaviour by screen

| | Desktop (≥ 1025 px wide with a mouse) | Tablet and small laptop window (761–1024 px, or touch) | Phone (≤ 760 px) |
|---|---|---|---|
| Brain at the top | Sharp, inside an open window 1.75 × its radius | Sharp, canvas at 0.66 opacity | Sharp, canvas at 0.66 opacity, rendered at up to 2× |
| Around the brain | Tunnel softened (backdrop `blur(5px)`) and washed (0.46): the **blend** | Washed (0.50), no backdrop filter | Washed (0.50), no backdrop filter |
| On scroll | The window closes (the iris) over the first 6 % of the page, and the canvas blurs with scroll, 0 → 8 px | Canvas fades to 0.12 and blurs 0 → 8 px | Canvas fades to 0.12 and blurs 0 → 5 px |
| If the window would sit behind body copy | Window narrows to the brain's core (1.0 × radius), wash 0.72; the brain stays sharp | n/a (no window) | n/a (no window) |
| Hero body copy | `#d8d5cb` with a tight shadow and a soft halo | Same, heavier halo | Same, heavier halo |

Why tablets and phones have no window or backdrop filter: on iPhone Safari a mask or backdrop filter over
a live WebGL canvas didn't composite reliably, so those screens dim the canvas itself.

**Reduced motion:** a single still frame, no scroll blur; the wash still deepens on scroll.
**More contrast or reduced transparency:** a near-solid wash (0.94) and no ring.

## Where each value lives

| Value | File |
|---|---|
| Window ratio, wash, backdrop blur, phone/tablet dimming, copy colour | `portfolio/src/scene/backdrop.css` (`--win`, `.den-scrim`, media queries) |
| Window ratio used by the readability check | `portfolio/src/scene/Backdrop.tsx` (`veil()`, must equal `--win`) |
| Scroll blur maximums, range, easing | `portfolio/src/scene/scrollBlur.ts` |
| Render resolution and the slow-phone step-down | `portfolio/src/scene/den.ts` (`dprCap`, `watchFrameRate`) |

## Baselines

Screens covered: 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720 (2×), 820×1180 tablet (2×), 390×844
phone (3×), each at the top, 300 px and 900 px of scroll.

```
cd portfolio && npx vite preview --port 4173 &
python3 e2e/hero_views.py <outdir>
```

It prints each view's layer state (window open, backdrop, wash, canvas opacity, blur) and saves a
screenshot per view. The e2e suite (`den_scene` and `brain_blur` in `e2e/e2e.py`) asserts the rules in the
table: sharp at the top, the blend on desktop, the brain inside its window, blur rising and reversing with
scroll, the maximums, only the canvas ever blurred, restored scroll, reduced motion and phone resolution.

Not covered: real iPhone/Safari rendering and real-device frame rates (the tests use software WebGL).
