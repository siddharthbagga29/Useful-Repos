import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Act } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";

/**
 * The analyst at his three-monitor desk, seen from behind. What he does follows the page:
 * typing on the hero, sensitivities on the model, the terminal, reading the dossier, briefing
 * Jarvis, coffee at the end. Every tap makes him stamp something APPROVED; scrolling speeds him up.
 */
export function Analyst({ act, doing, energy }: { act: Act; doing: string; energy: React.RefObject<number> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const actRef = useRef<Act>(act);
  const [stamping, setStamping] = useState(false);
  const stampRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    actRef.current = act;
  }, [act]);

  useEffect(
    () =>
      bus.on((e) => {
        if (e.type === "tap") {
          stampRef.current = performance.now();
          setStamping(true);
          clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setStamping(false), 750);
        }
      }),
    [],
  );

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const st = { t: 0, cells: [] as number[], chart: [] as number[], term: 0, last: "" as Act };
    let raf = 0;

    const fit = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = cv.clientWidth || 220;
      const H = Math.round(W * 0.68);
      if (cv.width !== Math.round(W * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [W, H] as const;
    };

    const draw = () => {
      const [W, H] = fit();
      const s = W / 250;
      const t = st.t;
      const now = performance.now();
      const stamping = now - stampRef.current < 700;
      const a: Act = stamping ? "stamp" : actRef.current;
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.5;
      const base = H * 0.8;

      // desk
      ctx.beginPath();
      ctx.moveTo(W * 0.06, base);
      ctx.lineTo(W * 0.94, base);
      ctx.lineTo(W * 0.86, base + 10 * s);
      ctx.lineTo(W * 0.14, base + 10 * s);
      ctx.closePath();
      ctx.fillStyle = "#2e2620";
      ctx.fill();

      const mon = (mx: number, my: number, mw: number, mh: number, render: (x: number, y: number, w: number, h: number) => void) => {
        ctx.fillStyle = "#0a0c12";
        ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
        render(mx, my, mw, mh);
        ctx.fillStyle = "#1a1f2e";
        ctx.fillRect(mx + mw / 2 - 3, my + mh, 6, 6 * s);
        const g = ctx.createRadialGradient(mx + mw / 2, my + mh / 2, 2, mx + mw / 2, my + mh / 2, mw);
        g.addColorStop(0, "rgba(120,190,255,.10)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(mx - mw * 0.5, my - mh * 0.4, mw * 2, mh * 2);
      };
      const sheet = (x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = "#0b2518";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "rgba(73,221,139,.17)";
        ctx.lineWidth = 1;
        for (let c = 1; c < 6; c++) {
          ctx.beginPath();
          ctx.moveTo(x + (w * c) / 6, y);
          ctx.lineTo(x + (w * c) / 6, y + h);
          ctx.stroke();
        }
        for (let r = 1; r < 6; r++) {
          ctx.beginPath();
          ctx.moveTo(x, y + (h * r) / 6);
          ctx.lineTo(x + w, y + (h * r) / 6);
          ctx.stroke();
        }
        for (const k of st.cells) {
          const rr = Math.floor(k / 6);
          const cc = k % 6;
          ctx.fillStyle = cc === 5 ? "rgba(255,176,32,.85)" : "rgba(180,255,214,.72)";
          ctx.fillRect(x + (cc * w) / 6 + 2, y + (rr * h) / 6 + h / 14, (w / 6) * 0.6, 1.8);
        }
      };
      const chart = (x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = "#0a1726";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "rgba(88,214,255,.13)";
        for (let g2 = 1; g2 < 3; g2++) {
          ctx.beginPath();
          ctx.moveTo(x, y + (h * g2) / 3);
          ctx.lineTo(x + w, y + (h * g2) / 3);
          ctx.stroke();
        }
        if (st.chart.length > 1) {
          ctx.beginPath();
          st.chart.forEach((v, i) => {
            const px = x + (w * i) / Math.max(1, st.chart.length - 1);
            const py = y + h - h * v;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          });
          ctx.strokeStyle = "#58d6ff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      };
      const term = (x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = "#140d04";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(255,176,32,.75)";
        const n = Math.max(2, st.term);
        for (let i = 0; i < n && i < 7; i++) ctx.fillRect(x + 3, y + 4 + (i * (h - 8)) / 7, w * (0.3 + ((i * 53) % 6) / 9), 1.6);
      };
      const mw = W * 0.22;
      const mh = mw * 0.68;
      mon(cx - mw * 1.62, base - mh - 30 * s, mw, mh, sheet);
      mon(cx - mw * 0.5, base - mh - 36 * s, mw, mh * 1.1, chart);
      mon(cx + mw * 0.66, base - mh - 30 * s, mw, mh, term);

      // analyst
      const busy = a === "type" || a === "model" || a === "command";
      const bob = busy && !reduce ? Math.sin(t / 7) * 1.1 * s : 0;
      const ty = base - 6 * s + bob;
      ctx.beginPath();
      ctx.ellipse(cx, base + 6 * s, 30 * s, 8 * s, 0, 0, 7);
      ctx.fillStyle = "rgba(0,0,0,.4)";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 20 * s, ty + 4 * s);
      ctx.quadraticCurveTo(cx, ty - 30 * s, cx + 20 * s, ty + 4 * s);
      ctx.lineTo(cx + 16 * s, ty + 16 * s);
      ctx.lineTo(cx - 16 * s, ty + 16 * s);
      ctx.closePath();
      const gr = ctx.createLinearGradient(cx, ty - 28 * s, cx, ty + 16 * s);
      gr.addColorStop(0, "#3a4a6b");
      gr.addColorStop(1, "#232d45");
      ctx.fillStyle = gr;
      ctx.fill();

      const tilt = a === "listen" ? 0.18 : 0;
      const hy = ty - 38 * s + (a === "command" ? -2 * s : 0);
      ctx.save();
      ctx.translate(cx, hy);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.arc(0, 0, 12 * s, 0, 7);
      ctx.fillStyle = "#241a14";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 9 * s, 5.5 * s, 0, Math.PI);
      ctx.fillStyle = "#c98f63";
      ctx.fill();
      // headset
      ctx.beginPath();
      ctx.arc(0, 0, 12 * s, Math.PI * 1.08, Math.PI * 1.92);
      ctx.strokeStyle = `rgba(88,214,255,${0.3 + Math.sin(t / 16) * 0.1 + (a === "talk" || a === "listen" ? 0.4 : 0)})`;
      ctx.lineWidth = 1.8 * s;
      ctx.stroke();
      ctx.restore();

      // voice waves when briefing Jarvis or listening
      if (a === "talk" || a === "listen") {
        for (let i = 0; i < 3; i++) {
          const ph = ((t * 0.9 + i * 12) % 36) / 36;
          ctx.beginPath();
          ctx.arc(cx + 13 * s, hy, (8 + ph * 18) * s, -0.6, 0.6);
          ctx.strokeStyle = `rgba(${a === "talk" ? "255,74,28" : "21,194,107"},${(1 - ph) * 0.6})`;
          ctx.lineWidth = 1.4 * s;
          ctx.stroke();
        }
      }

      // arms
      ctx.strokeStyle = "#3a4a6b";
      ctx.lineWidth = 6 * s;
      ctx.lineCap = "round";
      const speed = 4 / (1 + Math.min(3, energy.current ?? 0));
      let a1 = 0;
      let a2 = 0;
      if (a === "type" || a === "model") {
        a1 = Math.sin(t / speed) * 3 * s;
        a2 = Math.sin(t / speed + Math.PI) * 3 * s;
      }
      if (a === "command") a1 = Math.sin(t / 9) * 1.4 * s;
      if (a === "docs") {
        a1 = Math.sin(t / 12) * 5 * s;
        a2 = -2 * s;
      }
      if (a === "coffee") a2 = -10 * s - Math.max(0, Math.sin(t / 22)) * 7 * s;
      if (a === "talk") a1 = Math.sin(t / 10) * 2 * s;
      const stampP = stamping ? (now - stampRef.current) / 700 : 0;
      if (a === "stamp") a2 = -16 * s * Math.sin(Math.min(1, stampP * 2) * Math.PI) + 6 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 14 * s, ty);
      ctx.lineTo(cx - 20 * s, ty + 12 * s + a1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 14 * s, ty);
      ctx.lineTo(cx + 20 * s, ty + 12 * s + a2);
      ctx.stroke();

      // props
      if (a === "docs" || a === "stamp") {
        const pw = 22 * s;
        const ph = 15 * s;
        const px = cx + 26 * s;
        const py = base - 4 * s;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.2);
        ctx.fillStyle = "#f4f1e8";
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        ctx.fillStyle = "rgba(0,0,0,.22)";
        for (let li = 0; li < 4; li++) ctx.fillRect(-pw / 2 + 3, -ph / 2 + 4 + li * 3, pw * 0.66, 1);
        if (a === "docs") {
          const fl = Math.abs(Math.sin(t / 16));
          ctx.fillStyle = "rgba(255,255,255,.92)";
          ctx.fillRect(-pw / 2, -ph / 2, pw * fl, ph);
        }
        if (a === "stamp" && stampP > 0.45) {
          ctx.rotate(-0.25);
          ctx.strokeStyle = "rgba(179,48,43,.85)";
          ctx.lineWidth = 1.2 * s;
          ctx.strokeRect(-pw * 0.45, -4 * s, pw * 0.9, 8 * s);
          ctx.fillStyle = "rgba(179,48,43,.9)";
          ctx.font = `700 ${4.6 * s}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText("APPROVED", 0, 1.7 * s);
        }
        ctx.restore();
      }
      if (a === "coffee") {
        const mx2 = cx + 22 * s;
        const my2 = base - 6 * s - Math.max(0, Math.sin(t / 22)) * 7 * s;
        ctx.fillStyle = "#e8ecf5";
        ctx.fillRect(mx2 - 5 * s, my2 - 7 * s, 10 * s, 9 * s);
        ctx.beginPath();
        ctx.ellipse(mx2, my2 - 7 * s, 5 * s, 2.4 * s, 0, 0, 7);
        ctx.fillStyle = "#4a2f1d";
        ctx.fill();
        if (!reduce)
          for (let sp = 0; sp < 3; sp++) {
            const k = (t * 0.8 + sp * 14) % 30;
            ctx.beginPath();
            ctx.arc(mx2 + Math.sin((t + sp * 20) / 12) * 3 * s, my2 - 12 * s - k * s * 0.8, 1.8 * s, 0, 7);
            ctx.fillStyle = `rgba(220,228,242,${(1 - k / 30) * 0.3})`;
            ctx.fill();
          }
      }
    };

    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 32 || document.hidden) return; // ~30 fps is plenty for a 200px sprite
      last = now;
      const a = actRef.current;
      if (a !== st.last) {
        if (a === "type" || a === "model") {
          st.cells = [];
          if (a === "model") st.chart = [];
        }
        if (a === "command") st.term = 0;
        st.last = a;
      }
      const boost = 1 + Math.min(3, energy.current ?? 0);
      st.t += boost * 2;
      const t = Math.floor(st.t);
      if (a === "type" && t % 4 === 0 && st.cells.length < 36) st.cells.push(st.cells.length);
      if (a === "model") {
        if (t % 4 === 0 && st.chart.length < 22)
          st.chart.push(0.22 + 0.52 * Math.min(1, st.chart.length / 19) + Math.sin(st.chart.length / 2.3) * 0.07);
        if (t % 6 === 0 && st.cells.length < 36) st.cells.push(st.cells.length);
      }
      if (a === "command" && t % 10 === 0 && st.term < 7) st.term++;
      draw();
    };

    if (reduce) {
      st.cells = Array.from({ length: 36 }, (_, i) => i);
      st.chart = Array.from({ length: 22 }, (_, j) => 0.22 + 0.52 * Math.min(1, j / 19) + Math.sin(j / 2.3) * 0.07);
      st.term = 7;
      draw();
      const id = setInterval(draw, 500);
      return () => clearInterval(id);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, energy]);

  return (
    <div className="desk" aria-hidden>
      <canvas ref={canvas} />
      <div className="desk-act">
        <AnimatePresence mode="wait">
          <motion.span key={stamping ? "stamp" : doing} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}>
            {stamping ? "approved ✓" : doing}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
