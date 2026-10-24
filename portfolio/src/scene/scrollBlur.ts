// Scroll-linked softening of the hero brain. The brain is sharp at the top of the page and softens as
// the visitor scrolls into the next section; scrolling back reverses it exactly. Only the scene
// canvas (the brain and its particle field) is filtered; text, navigation and panels never are.
//
// Kept free of DOM access so the mapping can be tested in Node.

/** Largest blur, in CSS px: phones get less, so the brain still reads as a brain behind the copy. */
export const MAX_BLUR = { desktop: 8, mobile: 5 } as const;

/** Phone layout breakpoint, the same one the scene and its scrim use. */
export const MOBILE_MAX_WIDTH = 760;

/** Below this the filter is removed rather than set to a near-zero blur (no extra compositing at rest). */
export const BLUR_EPSILON = 0.05;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Ease in and out, so the softening starts and settles gently rather than at a constant rate. */
export const smoothstep = (p: number) => {
  const x = clamp01(p);
  return x * x * (3 - 2 * x);
};

/**
 * The scroll distance over which the blur goes from 0 to its maximum: the bottom of the hero, kept
 * within 0.6 to 1.2 viewport heights so a very short or very tall hero still gives a gradual change.
 */
export function blurRange(heroBottom: number, viewportHeight: number): number {
  const lo = 0.6 * viewportHeight;
  const hi = 1.2 * viewportHeight;
  const r = Number.isFinite(heroBottom) && heroBottom > 0 ? heroBottom : viewportHeight;
  return Math.max(1, Math.min(hi, Math.max(lo, r)));
}

/** Blur in CSS px for a scroll position. 0 at the top, rising smoothly to `max` at `range`. */
export function blurFor(scrollY: number, range: number, max: number): number {
  if (!(range > 0) || !(max > 0)) return 0;
  return max * smoothstep(scrollY / range);
}

/** How quickly the blur follows scroll: about 63% of the way in this many ms, whatever the frame rate. */
export const EASE_MS = 110;

/**
 * One easing step toward the target, by elapsed time rather than per frame, so a slow phone and a
 * 120 Hz laptop settle in the same time. A jump (a restored scroll position, a key press) still eases.
 */
export function approach(current: number, target: number, dtMs: number, tau = EASE_MS): number {
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.01 ? target : next;
}

/** The CSS filter value for a blur amount. */
export const filterFor = (px: number) => (px > BLUR_EPSILON ? `blur(${px.toFixed(2)}px)` : "none");
