import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { EDGES, FOLDERS, NOTES, TAGS, type Folder, type Note } from "./vault.ts";
import { Markdown } from "./Markdown.tsx";

const W = 900;
const H = 660;

/** Deterministic force layout, computed once: repulsion, springs on links, a pull toward each folder's anchor. */
function layout(): Record<string, { x: number; y: number }> {
  const anchors: Record<Folder, [number, number]> = { thesis: [0, -60], data: [-300, 160], model: [0, 170], review: [320, 60], reference: [-280, -190] };
  const pos = NOTES.map((n, i) => {
    const a = (i / NOTES.length) * Math.PI * 2;
    const [ax, ay] = anchors[n.folder];
    return { id: n.id, x: ax + Math.cos(a) * 60, y: ay + Math.sin(a) * 60, vx: 0, vy: 0, f: n.folder };
  });
  const idx = Object.fromEntries(pos.map((p, i) => [p.id, i]));
  for (let it = 0; it < 500; it++) {
    const cool = 1 - it / 500;
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i]!;
        const b = pos[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) (dx = 1), (dy = 0.5), (d2 = 1.25);
        const f = 5200 / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
    for (const [s, t] of EDGES) {
      const a = pos[idx[s]!]!;
      const b = pos[idx[t]!]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 125) * 0.02;
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
    for (const p of pos) {
      const [ax, ay] = anchors[p.f];
      p.vx += (ax - p.x) * 0.012;
      p.vy += (ay - p.y) * 0.012;
      p.x += Math.max(-12, Math.min(12, p.vx)) * cool;
      p.y += Math.max(-12, Math.min(12, p.vy)) * cool;
      p.vx *= 0.55;
      p.vy *= 0.55;
      p.x = Math.max(-W / 2 + 40, Math.min(W / 2 - 40, p.x));
      p.y = Math.max(-H / 2 + 30, Math.min(H / 2 - 30, p.y));
    }
  }
  // fit to the canvas, leaving room for labels
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (W - 190) / Math.max(1, x1 - x0);
  const sy = (H - 90) / Math.max(1, y1 - y0);
  return Object.fromEntries(pos.map((p) => [p.id, { x: (p.x - (x0 + x1) / 2) * sx, y: (p.y - (y0 + y1) / 2) * sy - 8 }]));
}

export function Graph() {
  const pos = useMemo(layout, []);
  const degree = useMemo(() => {
    const d: Record<string, number> = {};
    for (const [a, b] of EDGES) (d[a] = (d[a] ?? 0) + 1), (d[b] = (d[b] ?? 0) + 1);
    return d;
  }, []);
  const [tag, setTag] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<Note | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const neighbours = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    for (const [a, b] of EDGES) {
      if (a === hover) s.add(b);
      if (b === hover) s.add(a);
    }
    return s;
  }, [hover]);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // pinch or ⌘/Ctrl-scroll zooms; ordinary scrolling moves the page
      e.preventDefault();
      setView((v) => ({ ...v, k: Math.max(0.6, Math.min(2.6, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(null);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id: string) => {
    const n = NOTES.find((x) => x.id === id);
    if (n) setOpen(n);
  };
  const vbW = W / view.k;
  const vbH = H / view.k;
  const viewBox = `${-vbW / 2 - view.x} ${-vbH / 2 - view.y} ${vbW} ${vbH}`;

  const down = (e: RPointerEvent) => {
    if ((e.target as Element).closest(".gn")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || !svg.current) return;
    const scale = vbW / svg.current.clientWidth;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x) * scale, y: d.vy + (e.clientY - d.y) * scale }));
  };
  const up = () => (drag.current = null);

  return (
    <div className="graph">
      <div className="graph-bar">
        <div className="graph-tags" role="toolbar" aria-label="Filter by tag">
          <button type="button" className={tag === null ? "on" : ""} onClick={() => setTag(null)}>
            all
          </button>
          {TAGS.map((t) => (
            <button key={t} type="button" className={tag === t ? "on" : ""} onClick={() => setTag(tag === t ? null : t)} data-testid={`tag-${t}`}>
              #{t}
            </button>
          ))}
        </div>
        <div className="graph-zoom">
          <button type="button" aria-label="Zoom in" onClick={() => setView((v) => ({ ...v, k: Math.min(2.6, v.k * 1.25) }))}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => setView((v) => ({ ...v, k: Math.max(0.6, v.k / 1.25) }))}>
            −
          </button>
          <button type="button" aria-label="Reset view" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
            ⟲
          </button>
        </div>
      </div>
      <svg ref={svg} className="graph-svg" viewBox={viewBox} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="group" aria-label="Knowledge graph of research notes. Drag to pan; use the buttons to zoom.">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="rgba(255,255,255,.35)" />
          </marker>
        </defs>
        {EDGES.map(([a, b], i) => {
          const p = pos[a]!;
          const q = pos[b]!;
          const dim = (neighbours && !(neighbours.has(a) && neighbours.has(b))) || (tag && !(NOTES.find((n) => n.id === a)!.tags.includes(tag) || NOTES.find((n) => n.id === b)!.tags.includes(tag)));
          const r = 6 + Math.sqrt(degree[b] ?? 0) * 2.6 + 3;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          return <line key={i} className={`ge${dim ? " dim" : ""}${neighbours && !dim ? " hot" : ""}`} x1={p.x} y1={p.y} x2={q.x - (dx / d) * r} y2={q.y - (dy / d) * r} markerEnd="url(#arr)" />;
        })}
        {NOTES.map((n) => {
          const p = pos[n.id]!;
          const r = 6 + Math.sqrt(degree[n.id] ?? 0) * 2.6;
          const c = FOLDERS[n.folder].color;
          const dim = (neighbours && !neighbours.has(n.id)) || (tag && !n.tags.includes(tag));
          const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(n));
          return (
            <g
              key={n.id}
              className={`gn${dim ? " dim" : ""}`}
              transform={`translate(${p.x},${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${n.id} (${FOLDERS[n.folder].label})`}
              onClick={() => setOpen(n)}
              onKeyDown={key}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
              data-testid="gnode"
            >
              <circle r={r + 5} fill={c} opacity={0.12} />
              <circle r={r} fill={c} filter="url(#glow)" />
              <circle r={r * 0.42} fill="#0a0b0e" opacity={0.55} />
              <text y={r + 13} textAnchor="middle" className="gl">
                {n.id}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="graph-legend">
        {(Object.keys(FOLDERS) as Folder[]).map((f) => (
          <span key={f}>
            <i style={{ background: FOLDERS[f].color }} />
            {FOLDERS[f].dir} · {FOLDERS[f].label}
          </span>
        ))}
      </div>
      <details className="graph-index">
        <summary>All {NOTES.length} notes as a list</summary>
        {(Object.keys(FOLDERS) as Folder[]).map((f) => (
          <div key={f}>
            <div className="ds-h">{FOLDERS[f].dir}</div>
            <ul>
              {NOTES.filter((n) => n.folder === f).map((n) => (
                <li key={n.id}>
                  <button type="button" className="md-wiki" onClick={() => setOpen(n)}>
                    {n.id}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
      <AnimatePresence>
        {open && (
          <motion.div className="note-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
            <motion.article className="note" role="dialog" aria-modal="true" aria-label={open.id} initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, opacity: 0 }} data-testid="note-modal">
              <header>
                <span className="note-f" style={{ color: FOLDERS[open.folder].color }}>
                  {FOLDERS[open.folder].dir}/
                </span>
                <button type="button" className="note-x" aria-label="Close" onClick={() => setOpen(null)} autoFocus>
                  ✕
                </button>
              </header>
              <div className="md">
                <Markdown text={open.body} onLink={go} />
              </div>
              <footer>
                {open.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
                {EDGES.some(([, b]) => b === open.id) && (
                  <span className="note-back-l">
                    Linked from:{" "}
                    {EDGES.filter(([, b]) => b === open.id).map(([a]) => (
                      <button key={a} type="button" className="md-wiki" onClick={() => go(a)}>
                        {a}
                      </button>
                    ))}
                  </span>
                )}
              </footer>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
