import { useEffect, useRef } from "react";
import { useJarvis } from "../jarvis/JarvisProvider.tsx";
import { MAX_BLUR, MOBILE_MAX_WIDTH, approach, blurFor, blurRange, filterFor } from "./scrollBlur.ts";
import "./backdrop.css";

// The page's living ground: the Den scene (tunnel + Jarvis's particle brain) behind everything, and,
// over it, the Atelier scrim: a translucent wash with a circular window cut where the brain floats,
// ringed by a fading hairline. The site's structure sits on top, unchanged.
//
// Readability rule, for every screen size: if the brain's window would sit behind any hero text
// (tablets in portrait, phones, short laptop windows, big zoom), the window closes and the veil
// deepens, so text always reads on a calm ground. Wide screens keep the open window.
//
// Depth on scroll: the brain is sharp at the top and softens, in proportion to scroll, as the visitor
// moves into the next section (up to 8px, 5px on phones); scrolling back sharpens it again. Only the
// scene canvas is filtered. The value eases toward its target each frame, so a restored scroll
// position starts sharp and settles rather than appearing pre-blurred. Reduced motion: no blur.
//
// three.js is loaded after first paint so it never delays the page. Without WebGL, or under automated
// testing without ?scene=1, the static gradient ground stays and nothing else changes.
export function Backdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const den = useRef<{ setTalking(on: boolean): void; dispose(): void } | null>(null);
  const j = useJarvis();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const params = new URLSearchParams(location.search);
    if (navigator.webdriver && !params.has("scene")) return;
    const gl = (() => {
      try {
        const probe = document.createElement("canvas"); // probe elsewhere: a context made here would lose antialiasing
        return !!(probe.getContext("webgl") || probe.getContext("experimental-webgl"));
      } catch {
        return false;
      }
    })();
    if (!gl) return;
    let cancelled = false;
    const root = document.documentElement;
    let layout: [number, number, number] | null = null;
    // body text only (the stats box and buttons carry their own solid ground), measured on the
    // rendered line boxes: a block element spans the row, its text doesn't
    const TEXT = "#hero .avail, #hero .sub"; // the headline is large and solid; it reads over anything
    const veil = () => {
      if (!layout) return;
      const [x, y, r] = layout;
      const hole = r * (matchMedia("(max-width: 760px)").matches ? 1.05 : 1.62);
      const range = document.createRange();
      let clash = false;
      for (const el of document.querySelectorAll<HTMLElement>(TEXT)) {
        range.selectNodeContents(el);
        for (const b of Array.from(range.getClientRects())) {
          if (!b.width) continue;
          const nx = Math.max(b.left, Math.min(x, b.right));
          const ny = Math.max(b.top, Math.min(y, b.bottom));
          if (Math.hypot(nx - x, ny - y) < hole) clash = true;
        }
        if (clash) break;
      }
      root.classList.toggle("den-veil", clash);
    };
    const go = async () => {
      const { Den } = await import("./den.ts");
      if (cancelled) return;
      const d = new Den({
        canvas: el,
        mobile: matchMedia("(max-width: 760px)").matches,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        onLayout: (x, y, r) => {
          root.style.setProperty("--den-x", `${x}px`);
          root.style.setProperty("--den-y", `${y}px`);
          root.style.setProperty("--den-r", `${r}px`);
          layout = [x, y, r];
          veil();
        },
      });
      den.current = d;
      d.start();
      root.classList.add("den-live");
    };
    const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = idle ? idle(() => void go(), { timeout: 1500 }) : window.setTimeout(() => void go(), 600);
    // scroll-linked softening of the brain layer (no React state: nothing re-renders on scroll)
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    let blur = 0;
    let target = 0;
    let blurRaf = 0;
    let range = innerHeight;
    const measure = () => {
      const hero = document.getElementById("hero");
      range = blurRange(hero ? hero.getBoundingClientRect().bottom + scrollY : innerHeight, innerHeight);
    };
    let last = 0;
    const tick = (now: number) => {
      blurRaf = 0;
      blur = approach(blur, target, last ? Math.min(100, now - last) : 16.7);
      last = blur === target ? 0 : now;
      el.style.filter = filterFor(blur);
      el.dataset.blur = blur.toFixed(2);
      if (blur !== target) blurRaf = requestAnimationFrame(tick);
    };
    const updateBlur = () => {
      if (reduced) return;
      target = blurFor(scrollY, range, phone.matches ? MAX_BLUR.mobile : MAX_BLUR.desktop);
      el.dataset.blurTarget = target.toFixed(2);
      if (!blurRaf) blurRaf = requestAnimationFrame(tick);
    };
    const remeasure = () => {
      measure();
      updateBlur();
    };
    el.dataset.blur = "0.00";
    el.dataset.blurTarget = "0.00";
    // the window closes as you leave the opening station, so the content reads on a calm ground
    const onScroll = () => {
      const h = root.scrollHeight - innerHeight;
      const p = h > 0 ? scrollY / h : 0;
      root.style.setProperty("--den-open", String(Math.max(0, 1 - p / 0.06)));
      if (p < 0.08) veil();
      updateBlur();
    };
    measure();
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", remeasure);
    addEventListener("load", remeasure);
    addEventListener("pageshow", remeasure); // back/forward cache: the old value is recomputed, never reused
    return () => {
      cancelled = true;
      if (!idle) clearTimeout(id);
      cancelAnimationFrame(blurRaf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", remeasure);
      removeEventListener("load", remeasure);
      removeEventListener("pageshow", remeasure);
      el.style.filter = "";
      den.current?.dispose();
      root.classList.remove("den-live", "den-veil");
    };
  }, []);

  useEffect(() => {
    den.current?.setTalking(j.status === "speaking");
  }, [j.status]);

  return (
    <div className="den" aria-hidden="true">
      <canvas ref={canvas} className="den-canvas" data-testid="den-canvas" />
      <div className="den-scrim" />
      <svg className="den-ring" viewBox="0 0 841 841" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="denRing" x1="420.5" y1="0" x2="420.5" y2="841" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="420.5" cy="420.5" r="420" stroke="url(#denRing)" />
      </svg>
    </div>
  );
}
