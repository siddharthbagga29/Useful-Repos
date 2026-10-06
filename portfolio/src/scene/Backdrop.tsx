import { useEffect, useRef } from "react";
import { useJarvis } from "../jarvis/JarvisProvider.tsx";
import "./backdrop.css";

// The page's living ground: the Den scene (tunnel + Jarvis's particle brain) behind everything, and,
// over it, the Atelier scrim: a translucent wash with a circular window cut where the brain floats,
// ringed by a fading hairline. The site's structure sits on top, unchanged.
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
        },
      });
      den.current = d;
      d.start();
      root.classList.add("den-live");
    };
    const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = idle ? idle(() => void go(), { timeout: 1500 }) : window.setTimeout(() => void go(), 600);
    // the window closes as you leave the opening station, so the content reads on a calm ground
    const onScroll = () => {
      const h = root.scrollHeight - innerHeight;
      const p = h > 0 ? scrollY / h : 0;
      root.style.setProperty("--den-open", String(Math.max(0, 1 - p / 0.06)));
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelled = true;
      if (!idle) clearTimeout(id);
      removeEventListener("scroll", onScroll);
      den.current?.dispose();
      root.classList.remove("den-live");
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
