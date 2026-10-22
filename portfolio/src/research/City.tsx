import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORIES,
  DISTRICTS,
  EVIDENCE_LABEL,
  KIND_LABEL,
  NATURE_LABEL,
  PROJECTS,
  SHIPPED,
  caseRoute,
  pending,
  progress,
  shipped,
  type Agent,
  type AgentKind,
  type CategoryId,
  type DistrictId,
  type Evidence,
  type Project,
  type ProjectId,
} from "./manifest.ts";
import { COLORS, DISTRICT_COLORS, FOUNDRY, PLOTS } from "./layout.ts";
import { ago, consume, replayLatest, useCityFeed, when, type Feed } from "./feed.ts";
import type { CityEvent, Execution, ProjectState } from "./events.ts";
import { assessChampion, VALIDATION_LABEL } from "./validation.ts";
import { WORKFLOWS } from "./sources.ts";
import { bus } from "../jarvis/bus.ts";
import "./city.css";

// The Research City. Every building is a project from the canonical manifest; every floor a
// milestone, drawn by the strength of its evidence (lit: shipped and checkable here; hatched: claimed
// but not verified here; scaffolding: planned). Every bot is an automated job.
//
// Motion rule: the scene is still unless something real happened. A bot moves while its job is
// verifiably running, or once when a new verified event arrives (newer than this visitor's last
// visit), or when the visitor asks for a replay. Selection and the camera move only on input.

// Isometric projection. World units: plots are 15 × 15 on a 3 × 3 grid; roads run along multiples of P.
const K = 10;
const C = Math.cos(Math.PI / 6) * K;
const S = 0.5 * K;
const Z = 6.2;
const P = 15;
const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * C, (x + y) * S - z * Z];
const pts = (...ps: [number, number, number][]) => ps.map(([x, y, z]) => iso(x, y, z).join(",")).join(" ");

export const KIND_COLOR: Record<AgentKind, string> = {
  scheduled: "#22d3ee",
  ci: "#4ade80",
  deploy: "#fbbf24",
  script: "#ff8a5c",
  local: "#c084fc",
};

const FLOOR = 2.4;
const CENTRE: ProjectId = "strategy-lab";
const BASE: string = import.meta.env.BASE_URL;
const PULSE_MS = 3200;

const VIEWBOX = (() => {
  const g = [iso(-3, -3), iso(3 * P + 3, -3), iso(3 * P + 3, 3 * P + 3), iso(-3, 3 * P + 3)];
  const minX = Math.min(...g.map((q) => q[0])) - 6;
  const maxX = Math.max(...g.map((q) => q[0])) + 6;
  const top = iso(1.5 * P, 1.5 * P, 36 + 3.5)[1] - 58;
  const bottom = Math.max(...g.map((q) => q[1])) + 6;
  return `${minX} ${top} ${maxX - minX} ${bottom - top}`;
})();
const VB = VIEWBOX.split(" ").map(Number) as [number, number, number, number];

export const EXEC: Record<Execution, { label: string; short: string; icon: string; tone: "ok" | "run" | "err" | "warn" | "idle" }> = {
  idle: { label: "No automated pipeline", short: "", icon: "○", tone: "idle" },
  unavailable: { label: "Status unavailable", short: "NO DATA", icon: "?", tone: "idle" },
  running: { label: "Running now", short: "RUNNING", icon: "▶", tone: "run" },
  succeeded: { label: "Last run succeeded", short: "RUN OK", icon: "✓", tone: "ok" },
  failed: { label: "Last run failed", short: "FAILED", icon: "✕", tone: "err" },
  stale: { label: "Stale: missed its schedule", short: "STALE", icon: "!", tone: "warn" },
};

const TONE_COLOR = { ok: "#4ade80", run: "#22d3ee", err: "#f87171", warn: "#fbbf24", idle: "#94a3b8", info: "#a78bfa" } as const;
const eventTone = (e: CityEvent): keyof typeof TONE_COLOR =>
  e.status === "failed" ? "err" : e.status === "started" ? "run" : e.status === "succeeded" ? "ok" : e.status === "warning" ? "warn" : "info";
const EVENT_ICON: Record<CityEvent["status"], string> = { started: "▶", succeeded: "✓", failed: "✕", warning: "!", info: "•" };

type Tab = "detail" | "timeline" | "crew";
const TAB_ORDER: Tab[] = ["detail", "timeline", "crew"];

type Sel = { type: "project"; id: ProjectId } | { type: "foundry" } | { type: "agent"; id: ProjectId; k: number };

const turn = ([i, j]: [number, number], rot: number): [number, number] => {
  let q: [number, number] = [i, j];
  for (let n = 0; n < ((rot % 4) + 4) % 4; n++) q = [2 - q[1], q[0]];
  return q;
};

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

const byId = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

function Box({ x, y, z, w, d, h, color, look = "solid" }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string; look?: "solid" | "wire" | "hatch" }) {
  const top = pts([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]);
  const right = pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]);
  const left = pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]);
  if (look === "wire")
    return (
      <g className="wire" stroke={color}>
        <polygon points={left} />
        <polygon points={right} />
        <polygon points={top} />
      </g>
    );
  if (look === "hatch")
    return (
      <g className="hatch" stroke={color}>
        <polygon points={left} fill="url(#rc-hatch)" />
        <polygon points={right} fill="url(#rc-hatch)" />
        <polygon points={top} fill={shade(color, 0.35)} fillOpacity={0.35} />
      </g>
    );
  return (
    <g>
      <polygon points={left} fill={shade(color, 0.42)} />
      <polygon points={right} fill={shade(color, 0.28)} />
      <polygon points={top} fill={shade(color, 0.7)} />
    </g>
  );
}

/** Lit windows on one shipped floor. Static: lights don't flicker to fake activity. */
function Windows({ x, y, z, w, d, h }: { x: number; y: number; z: number; w: number; d: number; h: number }) {
  const out = [];
  const n = 3;
  const zz = z + h * 0.3;
  const hh = h * 0.42;
  for (let i = 0; i < n; i++) {
    const a = 0.8 + (i * (w - 1.6)) / n;
    const ww = (w - 1.6) / n - 0.5;
    out.push(<polygon key={`l${i}`} className="win" points={pts([x + a, y + d, zz], [x + a + ww, y + d, zz], [x + a + ww, y + d, zz + hh], [x + a, y + d, zz + hh])} />);
    const b = 0.8 + (i * (d - 1.6)) / n;
    out.push(<polygon key={`r${i}`} className="win" points={pts([x + w, y + b, zz], [x + w, y + b + ww, zz], [x + w, y + b + ww, zz + hh], [x + w, y + b, zz + hh])} />);
  }
  return <g>{out}</g>;
}

function floorLook(e: Evidence): "solid" | "hatch" | "wire" {
  return SHIPPED.includes(e) ? "solid" : e === "unverified" ? "hatch" : "wire";
}

/** A status pill above a sign. Text and icon carry the meaning; colour only repeats it. */
function Tag({ x, y, text, tone }: { x: number; y: number; text: string; tone: keyof typeof TONE_COLOR }) {
  const w = 10 + text.length * 5.9;
  return (
    <g className={`rc-tag t-${tone}`} transform={`translate(${x},${y})`}>
      <rect x={-w / 2} y={-8.6} width={w} height={12} rx={6} stroke={TONE_COLOR[tone]} />
      <text y={0.6} textAnchor="middle" fill={TONE_COLOR[tone]}>
        {text}
      </text>
    </g>
  );
}

function PlotPulse({ i, j, tone, k }: { i: number; j: number; tone: keyof typeof TONE_COLOR; k: string }) {
  return (
    <motion.polygon
      key={k}
      className="rc-pulse"
      points={pts([i * P + 1, j * P + 1, 0], [i * P + P - 1, j * P + 1, 0], [i * P + P - 1, j * P + P - 1, 0], [i * P + 1, j * P + P - 1, 0])}
      stroke={TONE_COLOR[tone]}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.6, 1, 0] }}
      transition={{ duration: PULSE_MS / 1000, ease: "easeInOut" }}
    />
  );
}

function statusTags(st: ProjectState | undefined): { text: string; tone: keyof typeof TONE_COLOR }[] {
  if (!st) return [];
  const out: { text: string; tone: keyof typeof TONE_COLOR }[] = [];
  const x = EXEC[st.execution];
  if (x.short) out.push({ text: `${x.icon} ${x.short}`, tone: x.tone });
  if (st.dataStale) out.push({ text: "! DATA STALE", tone: "warn" });
  return out;
}

interface BuildingProps {
  p: Project;
  plot: [number, number];
  state?: ProjectState;
  selected: boolean;
  dim: boolean;
  pulse: CityEvent | null;
  reduce: boolean;
  onSelect: () => void;
}

/**
 * Building massing by discipline, so a district reads at a glance. Floors still map one-to-one to
 * milestones; only the footprint, setback and rooftop differ.
 */
/** plain words for the legend, so the massing carries meaning rather than decoration */
const SHAPE_WORDS: Record<CategoryId, string> = {
  "research-quant": "slim stepped tower",
  "investment-underwriting": "broad block",
  "ai-automation": "tower with a mast",
  "product-engineering": "block with a side wing",
};
const SHAPES: Record<CategoryId, { w: number; d: number; inset: number; setbackAt: number; annex: boolean; antenna: boolean }> = {
  "research-quant": { w: 6.6, d: 6.6, inset: 1.0, setbackAt: 0.6, annex: false, antenna: false },
  "investment-underwriting": { w: 9, d: 8.2, inset: 0, setbackAt: 1, annex: false, antenna: false },
  "ai-automation": { w: 7, d: 7, inset: 0.7, setbackAt: 0.7, annex: false, antenna: true },
  "product-engineering": { w: 7.2, d: 6.2, inset: 0, setbackAt: 1, annex: true, antenna: false },
};

function Building({ p, plot, state, selected, dim, pulse, reduce, onSelect }: BuildingProps) {
  const [i, j] = plot;
  const color = COLORS[p.id];
  const shape = SHAPES[p.category];
  const w = shape.w;
  const d = shape.d;
  const x = i * P + (P - w) / 2;
  const y = j * P + (P - d) / 2;
  const total = p.milestones.length;
  const topZ = total * FLOOR;
  const setFrom = Math.max(1, Math.floor(total * shape.setbackAt));
  const roofInset = total > setFrom ? shape.inset : 0;
  const [lx, ly] = iso(x + w / 2, y + d / 2, topZ + 5 + (shape.antenna ? 4 : 0));
  const pct = Math.round(progress(p) * 100);
  const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect());
  const tags = statusTags(state);
  const failed = state?.execution === "failed";
  const [ex, ey] = iso(x + w, y + d, 0);
  const [, etop] = iso(x + w, y + d, Math.min(topZ, setFrom * FLOOR) - 0.25);
  const [ax, ay] = iso(x + w / 2, y + d / 2, topZ - 0.25);
  return (
    <g
      className={`bld${selected ? " sel" : ""}${dim ? " recede" : ""}${failed ? " is-failed" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${p.title}: ${shipped(p).length} of ${total} milestones with evidence. ${state ? EXEC[state.execution].label : ""}${state?.dataStale ? ". Data stale" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={key}
      data-testid={`bld-${p.id}`}
      data-exec={state?.execution}
    >
      <polygon className="plot" points={pts([i * P + 2, j * P + 2, 0], [i * P + P - 2, j * P + 2, 0], [i * P + P - 2, j * P + P - 2, 0], [i * P + 2, j * P + P - 2, 0])} style={{ stroke: selected ? color : undefined }} />
      {failed && <polygon className="plot-fail" points={pts([i * P + 1.4, j * P + 1.4, 0], [i * P + P - 1.4, j * P + 1.4, 0], [i * P + P - 1.4, j * P + P - 1.4, 0], [i * P + 1.4, j * P + P - 1.4, 0])} />}
      {pulse && !reduce && <PlotPulse i={i} j={j} tone={eventTone(pulse)} k={pulse.eventId} />}
      {pulse && reduce && <polygon className="rc-pulse static" stroke={TONE_COLOR[eventTone(pulse)]} points={pts([i * P + 1, j * P + 1, 0], [i * P + P - 1, j * P + 1, 0], [i * P + P - 1, j * P + P - 1, 0], [i * P + 1, j * P + P - 1, 0])} />}
      <polygon className="bld-shadow" points={pts([x + 0.8, y + 0.8, 0], [x + w + 1.6, y + 0.8, 0], [x + w + 1.6, y + d + 1.6, 0], [x + 0.8, y + d + 1.6, 0])} />
      {p.milestones.map((m, k) => {
        const look = floorLook(m.evidence);
        const n = k >= setFrom ? shape.inset : 0;
        return (
          <g key={k}>
            <Box x={x + n} y={y + n} z={k * FLOOR} w={w - 2 * n} d={d - 2 * n} h={FLOOR - 0.25} color={color} look={look} />
            {look === "solid" && <Windows x={x + n} y={y + n} z={k * FLOOR} w={w - 2 * n} d={d - 2 * n} h={FLOOR} />}
          </g>
        );
      })}
      {shipped(p).length > 0 && <line className="bld-edge" x1={ex} y1={ey} x2={ex} y2={etop} stroke={shade(color, 1.35)} />}
      <polygon
        className="bld-roof"
        stroke={shade(color, 1.2)}
        points={pts([x + roofInset, y + roofInset, topZ - 0.25], [x + w - roofInset, y + roofInset, topZ - 0.25], [x + w - roofInset, y + d - roofInset, topZ - 0.25], [x + roofInset, y + d - roofInset, topZ - 0.25])}
      />
      {shape.antenna && (
        <g className="bld-antenna" stroke={shade(color, 1.2)}>
          <line x1={ax} y1={ay} x2={ax} y2={ay - 24} />
          <circle cx={ax} cy={ay - 24} r={1.4} fill={color} />
        </g>
      )}
      {/* product-engineering annex: a low wing in front of the main block, not a milestone */}
      {shape.annex && <Box x={x + 0.6} y={y + d} z={0} w={w - 1.2} d={2.2} h={FLOOR * 0.9} color={color} look="solid" />}
      <g className="sign" transform={`translate(${lx},${ly})`}>
        <rect x={-56} y={-25} width={112} height={31} rx={5} />
        <text y={-13} textAnchor="middle" className="sign-n">
          {p.title.length > 22 ? `${p.title.split(" ").slice(0, 2).join(" ")}` : p.title}
        </text>
        <text y={-4} textAnchor="middle" className="sign-d" fill={DISTRICT_COLORS[p.district]}>
          {DISTRICTS[p.district].toUpperCase()}
        </text>
        <rect x={-42} y={0} width={84} height={2.6} rx={1.3} className="sign-bar" />
        <rect x={-42} y={0} width={(84 * pct) / 100} height={2.6} rx={1.3} fill={color} />
        {tags.map((t, k) => (
          <Tag key={t.text} x={0} y={-33 - k * 13} text={t.text} tone={t.tone} />
        ))}
      </g>
    </g>
  );
}

/** The centre: Strategy Lab and the Brain. Its bands move only while a Brain run is verifiably running or a new run event arrives. */
function CentreTower({ p, state, gen, unavailable, selected, dim, pulse, reduce, onSelect }: Omit<BuildingProps, "plot"> & { gen: number | null; unavailable: boolean }) {
  const [i, j] = PLOTS[CENTRE];
  const cx = i * P + P / 2;
  const cy = j * P + P / 2;
  const h = 36;
  const [ox, oy] = iso(cx, cy, h + 3.5);
  const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect());
  const live = !reduce && (state?.execution === "running" || (pulse && pulse.status !== "warning"));
  const tags = statusTags(state);
  const failed = state?.execution === "failed";
  return (
    <g
      className={`bld brain${selected ? " sel" : ""}${dim ? " recede" : ""}${failed ? " is-failed" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${p.title}: ${state ? EXEC[state.execution].label : "status loading"}${state?.dataStale ? ". Data stale" : ""}`}
      onClick={onSelect}
      onKeyDown={key}
      data-testid={`bld-${p.id}`}
      data-exec={state?.execution}
    >
      <polygon className="plot" points={pts([i * P + 2, j * P + 2, 0], [i * P + P - 2, j * P + 2, 0], [i * P + P - 2, j * P + P - 2, 0], [i * P + 2, j * P + P - 2, 0])} />
      {failed && <polygon className="plot-fail" points={pts([i * P + 1.4, j * P + 1.4, 0], [i * P + P - 1.4, j * P + 1.4, 0], [i * P + P - 1.4, j * P + P - 1.4, 0], [i * P + 1.4, j * P + P - 1.4, 0])} />}
      {pulse && !reduce && <PlotPulse i={i} j={j} tone={eventTone(pulse)} k={pulse.eventId} />}
      <Box x={cx - 4.5} y={cy - 4.5} z={0} w={9} d={9} h={3} color="#1e293b" />
      <Box x={cx - 2.2} y={cy - 2.2} z={3} w={4.4} d={4.4} h={h - 3} color="#0e7490" />
      {Array.from({ length: 10 }, (_, k) => (
        <motion.polygon
          key={k}
          className="brain-band"
          points={pts([cx + 2.2, cy - 2.2, 5 + k * 3], [cx + 2.2, cy + 2.2, 5 + k * 3], [cx + 2.2, cy + 2.2, 5.6 + k * 3], [cx + 2.2, cy - 2.2, 5.6 + k * 3])}
          initial={{ opacity: 0.45 }}
          animate={live ? { opacity: [0.15, 1, 0.15] } : { opacity: 0.45 }}
          transition={live ? { duration: 1.6, delay: k * 0.12, repeat: state?.execution === "running" ? Infinity : 1 } : { duration: 0.3 }}
        />
      ))}
      <circle cx={ox} cy={oy} r={9} fill="url(#core)" />
      {live && <motion.circle cx={ox} cy={oy} r={9} className="core-pulse" initial={{ r: 9, opacity: 0.6 }} animate={{ r: [9, 17, 9], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2, repeat: state?.execution === "running" ? Infinity : 1 }} />}
      <g className="sign brain-sign" transform={`translate(${ox},${oy - 22})`}>
        <rect x={-62} y={-20} width={124} height={27} rx={5} />
        <text y={-8} textAnchor="middle" className="sign-n">
          STRATEGY LAB · BRAIN
        </text>
        <text y={3} textAnchor="middle" className="sign-s">
          {gen !== null ? `generation ${gen.toLocaleString("en-US")}` : unavailable ? "state unavailable" : "state loading…"}
        </text>
        {tags.map((t, k) => (
          <Tag key={t.text} x={0} y={-28 - k * 13} text={t.text} tone={t.tone} />
        ))}
      </g>
    </g>
  );
}

function Foundry({ plot, selected, dim, stale, asOf, onSelect }: { plot: [number, number]; selected: boolean; dim: boolean; stale: boolean; asOf: string; onSelect: () => void }) {
  const [i, j] = plot;
  const x = i * P + 2.5;
  const y = j * P + 3;
  const [lx, ly] = iso(x + 1, y + 9, 12);
  const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect());
  return (
    <g className={`bld${selected ? " sel" : ""}${dim ? " recede" : ""}`} role="button" tabIndex={0} aria-pressed={selected} aria-label={`Data Foundry: weekly ETF data as of ${asOf}${stale ? ", stale" : ""}`} onClick={onSelect} onKeyDown={key} data-testid="bld-foundry">
      <polygon className="plot" points={pts([i * P + 2, j * P + 2, 0], [i * P + P - 2, j * P + 2, 0], [i * P + P - 2, j * P + P - 2, 0], [i * P + 2, j * P + P - 2, 0])} />
      <Box x={x} y={y + 3} z={0} w={9} d={5} h={3.5} color="#64748b" />
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <Box x={x + 0.6 + k * 3} y={y} z={0} w={2.2} d={2.2} h={7 + k} color="#94a3b8" />
          <polygon className="silo-cap" points={pts([x + 0.6 + k * 3, y, 7 + k], [x + 2.8 + k * 3, y, 7 + k], [x + 2.8 + k * 3, y + 2.2, 7 + k], [x + 0.6 + k * 3, y + 2.2, 7 + k])} />
        </g>
      ))}
      <g className="sign" transform={`translate(${lx},${ly})`}>
        <rect x={-54} y={-20} width={108} height={27} rx={5} />
        <text y={-8} textAnchor="middle" className="sign-n">
          Data Foundry
        </text>
        <text y={3} textAnchor="middle" className="sign-s">
          ETF data as of {asOf}
        </text>
        {stale && <Tag x={0} y={-28} text="! STALE" tone="warn" />}
      </g>
    </g>
  );
}

/** Manhattan route along the road grid from a plot's front corner to a target plot's nearest corner, and back. */
function route(from: [number, number], to: [number, number]): [number, number][] {
  const a: [number, number] = [(from[0] + 1) * P, (from[1] + 1) * P];
  const corners: [number, number][] = [0, 1].flatMap((dx) => [0, 1].map((dy) => [(to[0] + dx) * P, (to[1] + dy) * P] as [number, number]));
  const b = corners.sort((u, v) => Math.abs(u[0] - a[0]) + Math.abs(u[1] - a[1]) - (Math.abs(v[0] - a[0]) + Math.abs(v[1] - a[1])))[0]!;
  const door: [number, number] = [a[0] - 2.6, a[1] - 2.6];
  const go: [number, number][] = [door, a, [b[0], a[1]], b];
  return [...go, ...go.slice(0, -1).reverse()];
}

type BotMode = { kind: "park" } | { kind: "loop" } | { kind: "once"; key: string };

function Bot({ path, color, packet, slot, mode, reduce, label, selected, onSelect }: { path: [number, number][]; color: string; packet: string; slot: number; mode: BotMode; reduce: boolean; label: string; selected: boolean; onSelect: () => void }) {
  const screen = path.map(([x, y]) => iso(x, y, 0));
  const segs = screen.slice(1).map((p, k) => Math.hypot(p[0] - screen[k]![0], p[1] - screen[k]![1]));
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const times = [0, ...segs.map((s) => (acc += s) / total)];
  // parked bots line up beside their building's door, so each one stays clickable
  const [x0, y0] = screen[0]!;
  const px = x0 - 7 + slot * 7;
  const py = y0 + 2 + slot * 1.5;
  const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect());
  const moving = !reduce && mode.kind !== "park";
  return (
    <motion.g
      className={`bot${selected ? " sel" : ""}${moving ? " moving" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={key}
      initial={{ x: px, y: py }}
      animate={moving ? { x: [px, ...screen.slice(1).map((p) => p[0]), px], y: [py, ...screen.slice(1).map((p) => p[1]), py] } : { x: px, y: py }}
      transition={moving ? { duration: total / 30, times: [0, ...times.slice(1, -1).map((t) => t * 0.96), 0.96, 1], ease: "linear", repeat: mode.kind === "loop" ? Infinity : 0 } : { duration: 0.4 }}
    >
      <title>{label}</title>
      <circle cx={0} cy={-5} r={8} className="bot-hit" />
      {selected && <circle cx={0} cy={-5} r={8} className="bot-ring" stroke={color} />}
      <ellipse cx={0} cy={0.8} rx={3} ry={1.2} className="bot-shadow" />
      <rect x={-2.1} y={-6.4} width={4.2} height={6} rx={1.5} className="bot-body" />
      <circle cx={0} cy={-8.2} r={2.1} className="bot-head" />
      <rect x={-1.4} y={-8.9} width={2.8} height={1.1} rx={0.5} fill={color} />
      {moving && <rect x={2.4} y={-6.8} width={2.6} height={2.6} rx={0.5} fill={packet} className="bot-packet" />}
    </motion.g>
  );
}

/** Pan, zoom and pinch for the explorer, in viewBox units so the drawing stays crisp. Bounded: 0.7× to 6×. */
function useCamera(svg: React.RefObject<SVGSVGElement | null>, on: boolean) {
  const [cam, setCam] = useState({ k: 1, x: 0, y: 0 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const toView = useCallback(
    (cx: number, cy: number) => {
      const el = svg.current;
      const m = el?.getScreenCTM();
      if (!el || !m) return { x: 0, y: 0, s: 1 };
      const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
      return { x: pt.x, y: pt.y, s: 1 / m.a };
    },
    [svg],
  );
  const bound = (c: { k: number; x: number; y: number }) => {
    const lim = (VB[2] * c.k) / 1.2;
    return { k: c.k, x: Math.max(-lim, Math.min(lim, c.x)), y: Math.max(-lim, Math.min(lim, c.y)) };
  };
  const zoomAt = useCallback((vx: number, vy: number, f: number) => {
    setCam((c) => {
      const k = Math.min(6, Math.max(0.7, c.k * f));
      const r = k / c.k;
      return bound({ k, x: vx - (vx - c.x) * r, y: vy - (vy - c.y) * r });
    });
  }, []);
  useEffect(() => {
    const el = svg.current;
    if (!el || !on) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = toView(e.clientX, e.clientY);
      zoomAt(v.x, v.y, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [svg, on, toView, zoomAt]);
  const handlers = on
    ? {
        onPointerDown: (e: RPointerEvent) => {
          ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          moved.current = 0;
        },
        onPointerMove: (e: RPointerEvent) => {
          const prev = ptrs.current.get(e.pointerId);
          if (!prev) return;
          const next = { x: e.clientX, y: e.clientY };
          if (ptrs.current.size === 2) {
            const other = [...ptrs.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
            if (other) {
              const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
              const d1 = Math.hypot(next.x - other.x, next.y - other.y);
              const mid = toView((next.x + other.x) / 2, (next.y + other.y) / 2);
              if (d0 > 0) zoomAt(mid.x, mid.y, d1 / d0);
              moved.current += Math.abs(d1 - d0);
            }
          } else {
            const s = toView(0, 0).s;
            const dx = (next.x - prev.x) * s;
            const dy = (next.y - prev.y) * s;
            moved.current += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
            if (moved.current > 4) {
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              setCam((c) => bound({ ...c, x: c.x + dx, y: c.y + dy }));
            }
          }
          ptrs.current.set(e.pointerId, next);
        },
        onPointerUp: (e: RPointerEvent) => void ptrs.current.delete(e.pointerId),
        onPointerCancel: (e: RPointerEvent) => void ptrs.current.delete(e.pointerId),
        onClickCapture: (e: React.MouseEvent) => {
          if (moved.current > 4) {
            e.stopPropagation();
            e.preventDefault();
          }
          moved.current = 0;
        },
      }
    : {};
  const centre = { x: VB[0] + VB[2] / 2, y: VB[1] + VB[3] / 2 };
  return {
    cam,
    handlers,
    zoom: (f: number) => zoomAt(centre.x, centre.y, f),
    pan: (dx: number, dy: number) => setCam((c) => bound({ ...c, x: c.x + dx, y: c.y + dy })),
    reset: () => setCam({ k: 1, x: 0, y: 0 }),
  };
}

// ---------------------------------------------------------------- filters

type StatusFilter = "all" | "running" | "failed" | "stale" | "succeeded" | "no-pipeline" | "open-work" | "unverified";
const STATUS_FILTERS: [StatusFilter, string][] = [
  ["all", "Any status"],
  ["succeeded", "Last run succeeded"],
  ["running", "Running"],
  ["failed", "Failed"],
  ["stale", "Stale (schedule or data)"],
  ["no-pipeline", "No automated pipeline"],
  ["open-work", "Has planned work"],
  ["unverified", "Has unverified claims"],
];

function matches(p: Project, st: ProjectState | undefined, q: string, district: DistrictId | "all", status: StatusFilter) {
  if (district !== "all" && p.district !== district) return false;
  const text = `${p.title} ${p.tags.join(" ")} ${DISTRICTS[p.district]} ${CATEGORIES[p.category]}`.toLowerCase();
  if (q && !q.toLowerCase().split(/\s+/).every((w) => text.includes(w))) return false;
  switch (status) {
    case "all":
      return true;
    case "running":
    case "failed":
    case "succeeded":
      return st?.execution === status;
    case "stale":
      return st?.execution === "stale" || !!st?.dataStale;
    case "no-pipeline":
      return p.pipeline === "none";
    case "open-work":
      return pending(p).length > 0;
    case "unverified":
      return p.milestones.some((m) => m.evidence === "unverified");
  }
}

// ---------------------------------------------------------------- the city

export function City({ compact = false, active = true, explore = false, onClose, initial }: { compact?: boolean; active?: boolean; explore?: boolean; onClose?: () => void; initial?: Sel }) {
  const reduce = !!useReducedMotion();
  const feed = useCityFeed();
  const brain = feed.brain;
  const [sel, setSel] = useState<Sel>(initial ?? { type: "project", id: CENTRE });
  const [focused, setFocused] = useState(false);
  const [rot, setRot] = useState(0);
  const [tab, setTab] = useState<Tab>("detail");
  const uid = useId();
  // ARIA tabs pattern: arrows and Home/End move between tabs; only the active tab is in the Tab order
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TAB_ORDER.indexOf(tab);
    const n = e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowLeft" ? (i + 2) % 3 : e.key === "Home" ? 0 : e.key === "End" ? 2 : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(TAB_ORDER[n]!);
    e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")[n]?.focus();
  };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<DistrictId | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const svg = useRef<SVGSVGElement>(null);
  const { cam, handlers, zoom, pan, reset } = useCamera(svg, explore);

  // the event being animated right now: the head of the shared queue. Only one visible city consumes it.
  const consumer = active && !open;
  const head = feed.queue[0] ?? null;
  const [pulse, setPulse] = useState<CityEvent | null>(null);
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    if (!consumer || !head) return;
    setPulse(head);
    setAnnounce(`${head.demo ? "Demo event" : "New event"}: ${byId(head.projectId).title}, ${head.title}`);
    const t = setTimeout(() => {
      setPulse(null);
      consume(head.eventId);
    }, PULSE_MS);
    return () => clearTimeout(t);
  }, [consumer, head]);

  const plotOf = useCallback((id: ProjectId) => turn(PLOTS[id], rot), [rot]);
  const foundryPlot = turn(FOUNDRY, rot);
  const visible = useMemo(() => new Set(PROJECTS.filter((p) => matches(p, feed.states[p.id], q, district, status)).map((p) => p.id)), [feed.states, q, district, status]);
  const filtering = visible.size < PROJECTS.length;

  const bots = useMemo(() => {
    const out: { key: string; p: Project; a: Agent; k: number; path: [number, number][]; color: string; label: string }[] = [];
    for (const p of PROJECTS) {
      const home = turn(PLOTS[p.id], rot);
      const target: [number, number] = turn(FOUNDRY, rot);
      p.agents.forEach((a, k) => {
        const to = a.kind === "script" || a.kind === "local" ? target : turn(PLOTS[CENTRE], rot);
        const path = to[0] === home[0] && to[1] === home[1] ? route(home, target) : route(home, to);
        out.push({ key: `${p.id}-${k}`, p, a, k, path, color: KIND_COLOR[a.kind], label: `${a.name} · ${p.title} · ${KIND_LABEL[a.kind]}${a.verification === "verified" ? "" : " · not verified"}` });
      });
    }
    return out;
  }, [rot]);

  const botMode = (b: (typeof bots)[number]): BotMode => {
    const st = feed.states[b.p.id];
    const job = b.a.kind === "scheduled" || b.a.kind === "ci";
    if (job && st?.execution === "running") return { kind: "loop" };
    if (pulse && pulse.projectId === b.p.id) {
      const t = pulse.eventType;
      const fits =
        ((t.startsWith("research_run") || t === "candidate_promoted") && b.a.kind === "scheduled") ||
        (t.startsWith("test_suite") && b.a.kind === "ci") ||
        (t.startsWith("release_gate") && b.a.kind === "deploy");
      if (fits) return { kind: "once", key: pulse.eventId };
    }
    return { kind: "park" };
  };

  const order = useMemo(() => {
    const items: { k: string; depth: number }[] = [...PROJECTS.map((p) => ({ k: p.id, depth: plotOf(p.id)[0] + plotOf(p.id)[1] })), { k: "foundry", depth: foundryPlot[0] + foundryPlot[1] }];
    return items.sort((a, b) => a.depth - b.depth);
  }, [plotOf, foundryPlot]);

  useEffect(() => {
    if (!explore) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      const step = 24 / cam.k;
      if (e.key === "Escape") onClose?.();
      else if (e.key === "+" || e.key === "=") zoom(1.25);
      else if (e.key === "-" || e.key === "_") zoom(0.8);
      else if (e.key === "r" || e.key === "R") setRot((r) => r + 1);
      else if (e.key === "0") reset();
      else if (e.key === "ArrowLeft") pan(step, 0);
      else if (e.key === "ArrowRight") pan(-step, 0);
      else if (e.key === "ArrowUp") pan(0, step);
      else if (e.key === "ArrowDown") pan(0, -step);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [explore, cam.k, onClose, zoom, pan, reset]);

  const pick = (s: Sel) => {
    setSel(s);
    setFocused(true);
    setTab("detail");
  };
  const selId: ProjectId | "foundry" = sel.type === "foundry" ? "foundry" : sel.id;
  const dimOf = (id: ProjectId | "foundry") => (focused && selId !== id) || (filtering && (id === "foundry" || !visible.has(id)));

  const roads = [];
  for (let k = 0; k <= 3; k++) {
    roads.push(<line key={`a${k}`} className="road" x1={iso(k * P, 0)[0]} y1={iso(k * P, 0)[1]} x2={iso(k * P, 3 * P)[0]} y2={iso(k * P, 3 * P)[1]} />);
    roads.push(<line key={`b${k}`} className="road" x1={iso(0, k * P)[0]} y1={iso(0, k * P)[1]} x2={iso(3 * P, k * P)[0]} y2={iso(3 * P, k * P)[1]} />);
  }
  // district grounds: a faint tint under each project's plot
  const grounds = PROJECTS.map((p) => {
    const [i, j] = plotOf(p.id);
    return <polygon key={`g-${p.id}`} className="district-ground" fill={DISTRICT_COLORS[p.district]} points={pts([i * P, j * P, 0], [i * P + P, j * P, 0], [i * P + P, j * P + P, 0], [i * P, j * P + P, 0])} />;
  });
  // the data conduit: Foundry → Strategy Lab. Amber and dashed while its data is stale.
  const lab = feed.states[CENTRE];
  const [fi, fj] = foundryPlot;
  const [ci, cj] = plotOf(CENTRE);
  const conduit = [iso(fi * P + P / 2, fj * P + P / 2, 0.2), iso(ci * P + P / 2, fj * P + P / 2, 0.2), iso(ci * P + P / 2, cj * P + P / 2, 0.2)];

  const pipelinesList = PROJECTS.filter((p) => p.pipeline !== "none");
  const counts = { ok: 0, running: 0, failed: 0, stale: 0, unavailable: 0 };
  for (const p of pipelinesList) {
    const e = feed.states[p.id]?.execution;
    if (e === "succeeded") counts.ok++;
    else if (e === "running") counts.running++;
    else if (e === "failed") counts.failed++;
    else if (e === "stale") counts.stale++;
    else counts.unavailable++;
  }
  const lastResearch = lab?.lastSuccess;
  const artifacts = PROJECTS.flatMap((p) => p.links).filter((l) => l.kind !== "page").length;
  const staleData = PROJECTS.filter((p) => feed.states[p.id]?.dataStale);

  return (
    <div className={`city${compact ? " compact" : ""}${explore ? " explore" : ""}${feed.demo ? " demo" : ""}`}>
      <div className="city-stage">
        {feed.demo && (
          <p className="city-demo" role="note">
            DEMO MODE · scripted events below are simulated to show how the city reacts. They are not real and are not saved.
          </p>
        )}
        <ul className="city-hud" aria-label="City health">
          <li>
            <b>{PROJECTS.length}</b> projects
          </li>
          <li>
            Pipelines <b>{counts.ok}</b> ok · <b>{counts.running}</b> running · <b className={counts.failed ? "hud-err" : ""}>{counts.failed}</b> failed · <b className={counts.stale ? "hud-warn" : ""}>{counts.stale}</b> stale
          </li>
          <li>
            Last research run{" "}
            <b>
              {lastResearch ? (
                <a href={lastResearch.url} target="_blank" rel="noopener noreferrer">
                  ✓ {ago(lastResearch.occurredAt, feed.now)}
                </a>
              ) : (
                "unknown"
              )}
            </b>
          </li>
          <li>
            Data{" "}
            <b className={staleData.length ? "hud-warn" : ""}>
              {staleData.length ? `! stale (as of ${feed.evidence.dataset.asOf})` : `as of ${feed.evidence.dataset.asOf}`}
            </b>
          </li>
          <li>
            <b>{artifacts}</b> public artifacts
          </li>
        </ul>
        <div className="city-ctl" role="toolbar" aria-label="City view">
          {explore ? (
            <>
              <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in" data-testid="city-zoom-in">
                +
              </button>
              <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom out">
                −
              </button>
              <button type="button" onClick={() => setRot((r) => r + 1)} aria-label="Turn the city" data-testid="city-rotate">
                ⟳
              </button>
              <button type="button" onClick={reset} aria-label="Reset the view">
                ⌂
              </button>
              <button type="button" className="city-close" onClick={onClose} aria-label="Close the explorer" data-testid="city-close">
                ✕
              </button>
            </>
          ) : (
            <button type="button" className="city-explore" onClick={() => setOpen(true)} data-testid="city-explore">
              ⤢ Explore
            </button>
          )}
        </div>
        {!compact && (
          <div className="city-filters" role="search" aria-label="Filter projects">
            <label>
              <span className="vh">Search projects</span>
              <input type="search" placeholder="Search projects, tags…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="city-search" />
            </label>
            <label>
              <span className="vh">District</span>
              <select value={district} onChange={(e) => setDistrict(e.target.value as DistrictId | "all")} data-testid="city-district">
                <option value="all">All districts</option>
                {(Object.keys(DISTRICTS) as DistrictId[]).map((d) => (
                  <option key={d} value={d}>
                    {DISTRICTS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="vh">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} data-testid="city-status">
                {STATUS_FILTERS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {filtering && (
              <span className="city-count" aria-live="polite">
                {visible.size} of {PROJECTS.length}
              </span>
            )}
          </div>
        )}
        <svg
          ref={svg}
          className="city-svg"
          viewBox={VIEWBOX}
          role="group"
          aria-label="Research city: each building is a project, each floor a milestone drawn by its evidence, each bot an automated job"
          data-testid={explore ? "city-explore-svg" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Escape" && focused && !explore) setFocused(false);
          }}
          {...handlers}
        >
          <defs>
            <radialGradient id="core">
              <stop offset="0" stopColor="#e0fbff" />
              <stop offset=".45" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#0e7490" stopOpacity=".2" />
            </radialGradient>
            <pattern id="rc-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="3" height="3" fill="rgba(255,255,255,.02)" />
              <line x1="0" y1="0" x2="0" y2="3" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
            </pattern>
          </defs>
          <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`} data-testid="city-cam" data-k={cam.k.toFixed(2)}>
            <polygon className="ground" points={pts([-3, -3, 0], [3 * P + 3, -3, 0], [3 * P + 3, 3 * P + 3, 0], [-3, 3 * P + 3, 0])} />
            {grounds}
            {roads}
            <polyline className={`conduit${lab?.dataStale ? " stale" : ""}`} points={conduit.map((p) => p.join(",")).join(" ")} />
            {order.map(({ k }) => {
              if (k === "foundry")
                return <Foundry key={k} plot={foundryPlot} selected={sel.type === "foundry"} dim={dimOf("foundry")} stale={!!lab?.dataStale} asOf={feed.evidence.dataset.asOf} onSelect={() => pick({ type: "foundry" })} />;
              const p = byId(k as ProjectId);
              const common = {
                p,
                state: feed.states[p.id],
                selected: sel.type !== "foundry" && sel.id === p.id,
                dim: dimOf(p.id),
                pulse: pulse && pulse.projectId === p.id ? pulse : null,
                reduce,
                onSelect: () => pick({ type: "project", id: p.id }),
              };
              return p.id === CENTRE ? <CentreTower key={k} {...common} gen={brain?.generation ?? null} unavailable={feed.brainSource === "unavailable"} /> : <Building key={k} {...common} plot={plotOf(p.id)} />;
            })}
            {bots.map((b) => {
              const mode: BotMode = active ? botMode(b) : { kind: "park" };
              return (
              <Bot
                key={`${b.key}-${rot}-${mode.kind === "once" ? mode.key : mode.kind}`}
                path={b.path}
                color={b.color}
                packet={COLORS[b.p.id]}
                slot={b.k}
                mode={mode}
                label={b.label}
                reduce={reduce}
                selected={sel.type === "agent" && sel.id === b.p.id && sel.k === b.k}
                onSelect={() => pick({ type: "agent", id: b.p.id, k: b.k })}
              />
              );
            })}
          </g>
        </svg>
        <p className="vh" aria-live="polite" data-testid="city-announce">
          {announce}
        </p>
        {explore && <p className="city-tip">Drag to pan · scroll or pinch to zoom · ⟳ turns the city · Esc closes</p>}
        <div className="city-pick" role="toolbar" aria-label="Choose a project">
          {PROJECTS.filter((p) => visible.has(p.id)).map((p) => {
            const st = feed.states[p.id];
            const x = st ? EXEC[st.execution] : null;
            return (
              <button key={p.id} type="button" className={sel.type !== "foundry" && sel.id === p.id ? "on" : ""} style={{ ["--c" as string]: COLORS[p.id] }} onClick={() => pick({ type: "project", id: p.id })} aria-pressed={sel.type !== "foundry" && sel.id === p.id}>
                {p.title}
                {x?.short ? <em className={`t-${x.tone}`}> {x.icon}</em> : null}
              </button>
            );
          })}
          <button type="button" className={sel.type === "foundry" ? "on" : ""} style={{ ["--c" as string]: "#94a3b8" }} onClick={() => pick({ type: "foundry" })} aria-pressed={sel.type === "foundry"}>
            Data Foundry
          </button>
          {focused && (
            <button type="button" className="city-clear" onClick={() => setFocused(false)}>
              Show all
            </button>
          )}
        </div>
        <div className="city-legend">
          <span>
            <i className="lg-solid" /> evidence here
          </span>
          <span>
            <i className="lg-hatch" /> claimed, not verified
          </span>
          <span>
            <i className="lg-wire" /> planned
          </span>
          {(Object.keys(KIND_COLOR) as AgentKind[]).map((k) => (
            <span key={k}>
              <i style={{ background: KIND_COLOR[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
        <p className="city-legend city-shapes">
          Shape shows the discipline, floors the milestones:{" "}
          {(Object.keys(SHAPE_WORDS) as CategoryId[]).map((c, i) => (
            <span key={c}>
              {i ? " · " : ""}
              {SHAPE_WORDS[c]} = {CATEGORIES[c]}
            </span>
          ))}
        </p>
      </div>
      <div className="city-side">
        <div className="ds-tabs" role="tablist" aria-label="Side panel" onKeyDown={onTabKey}>
          {TAB_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`${uid}-tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`${uid}-panel`}
              tabIndex={tab === k ? 0 : -1}
              onClick={() => setTab(k)}
              data-testid={`tab-${k}`}
            >
              {k === "detail" ? "Dossier" : k === "timeline" ? "Timeline" : `Bots · ${bots.length}`}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            role="tabpanel"
            id={`${uid}-panel`}
            aria-labelledby={`${uid}-tab-${tab}`}
            key={tab === "detail" ? `d-${sel.type}-${sel.type === "foundry" ? "" : sel.id}-${sel.type === "agent" ? sel.k : ""}` : tab}
            className="dossier"
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            data-testid="dossier"
          >
            {tab === "crew" ? (
              <CrewRoster bots={bots} feed={feed} selected={sel.type === "agent" ? `${sel.id}-${sel.k}` : null} onPick={(b) => pick({ type: "agent", id: b.p.id, k: b.k })} />
            ) : tab === "timeline" ? (
              <Timeline feed={feed} project={focused && sel.type !== "foundry" ? sel.id : null} />
            ) : sel.type === "project" ? (
              <ProjectDossier p={byId(sel.id)} feed={feed} onAgent={(k) => pick({ type: "agent", id: sel.id, k })} />
            ) : sel.type === "agent" ? (
              <AgentDossier p={byId(sel.id)} a={byId(sel.id).agents[sel.k]!} feed={feed} onProject={() => pick({ type: "project", id: sel.id })} />
            ) : (
              <FoundryDossier feed={feed} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {open && <CityExplorer initial={sel} onClose={() => setOpen(false)} />}
    </div>
  );
}

/**
 * The city full-screen, as a proper modal: focus moves into it, everything behind it is made `inert`
 * (unfocusable and hidden from screen readers), and closing returns focus to whatever opened it.
 */
function CityExplorer({ initial, onClose }: { initial: Sel; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = box.current;
    const silenced = [...document.body.children].filter((el) => el !== dialog && !el.hasAttribute("inert"));
    for (const el of silenced) el.setAttribute("inert", "");
    dialog?.focus();
    return () => {
      document.body.style.overflow = prev;
      for (const el of silenced) el.removeAttribute("inert");
      opener?.focus();
    };
  }, []);
  // Tab past the last control wraps to the first (and Shift+Tab the other way), so focus stays in the dialog
  const wrap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !box.current) return;
    // SVG buildings and bots have no offsetParent, so they count as visible by type
    const shown = (el: Element) => el instanceof SVGElement || (el as HTMLElement).offsetParent !== null;
    const items = [...box.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute("disabled") && shown(el));
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === box.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return createPortal(
    <motion.div ref={box} tabIndex={-1} onKeyDown={wrap} className="city-x" role="dialog" aria-modal="true" aria-label="Research city explorer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="city-explorer">
      <City explore onClose={onClose} initial={initial} />
    </motion.div>,
    document.body,
  );
}

// ---------------------------------------------------------------- side panel

function ExtLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  const ext = href.startsWith("http");
  return (
    <a href={href} target={ext ? "_blank" : undefined} rel={ext ? "noopener noreferrer" : undefined}>
      {children}
    </a>
  );
}

function EventLine({ e, now }: { e?: CityEvent; now: number }) {
  if (!e) return <span className="ds-none">None recorded</span>;
  return (
    <span>
      <span className={`ev-ico t-${eventTone(e)}`} aria-hidden>
        {EVENT_ICON[e.status]}
      </span>{" "}
      <ExtLink href={e.url}>{e.title}</ExtLink> <span className="ds-when">· {ago(e.occurredAt, now)}</span>
    </span>
  );
}

function sourceNote(feed: Feed, p: Project): string {
  if (p.pipeline === "none") return "Status comes from repository evidence only.";
  const w = WORKFLOWS.find((x) => x.projectId === p.id);
  if (!w) return "";
  const s = feed.sources[w.id];
  const where = s.state === "live" ? "fetched from GitHub just now" : s.state === "cached" ? `GitHub, cached ${ago(s.at, feed.now)}` : s.state === "build" ? `build snapshot from ${when(s.at)}` : "unavailable";
  return `From the public GitHub Actions run list of ${w.file} (${where}).${s.note ? ` ${s.note}` : ""}`;
}

/** what kind of thing this is (analysis, backtest, simulation…), each with its reason; text, not colour */
export function NatureBadges({ p }: { p: Project }) {
  return (
    <ul className="nature" aria-label="What this project is" data-testid="nature">
      {p.nature.map((n) => (
        <li key={n.kind} className={`nature-b nature-${n.kind}`} title={n.note}>
          <b>{NATURE_LABEL[n.kind]}</b> <span>{n.note}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatusBlock({ p, feed }: { p: Project; feed: Feed }) {
  const st = feed.states[p.id];
  const x = EXEC[st.execution];
  const assess = p.id === CENTRE ? assessChampion(feed.brain) : null;
  return (
    <dl className="ds-params ds-status" data-testid={`status-${p.id}`}>
      <div>
        <dt>Execution</dt>
        <dd>
          <span className={`pill t-${x.tone}`}>
            {x.icon} {x.label}
          </span>
          <small>{sourceNote(feed, p)}</small>
        </dd>
      </div>
      <div>
        <dt>Validation</dt>
        <dd>
          {assess ? (
            <>
              <span className={`pill t-${assess.status === "provisional" ? "ok" : assess.status === "not-validated" ? "warn" : "idle"}`}>{VALIDATION_LABEL[assess.status]}</span>
              <small>{assess.ceiling}</small>
            </>
          ) : st.lastGate ? (
            <>
              <EventLine e={st.lastGate} now={feed.now} />
              <small>A release check, not an independent validation of results.</small>
            </>
          ) : (
            <span className="pill t-idle">Manual verification required</span>
          )}
        </dd>
      </div>
      {p.pipeline !== "none" && (
        <>
          <div>
            <dt>Last attempt</dt>
            <dd>
              <EventLine e={st.lastAttempt} now={feed.now} />
            </dd>
          </div>
          <div>
            <dt>Last success</dt>
            <dd>
              <EventLine e={st.lastSuccess} now={feed.now} />
            </dd>
          </div>
          <div>
            <dt>Last failure</dt>
            <dd>
              <EventLine e={st.lastFailure} now={feed.now} />
            </dd>
          </div>
        </>
      )}
      <div>
        <dt>Data</dt>
        <dd>
          {p.data.label}
          {p.data.asOf && <small>As of {p.data.asOf}</small>}
          {st.dataStale && <span className="pill t-warn">! {st.dataStale.title}</span>}
        </dd>
      </div>
      <div>
        <dt>Latest change</dt>
        <dd>
          {st.lastChange ? (
            <>
              <ExtLink href={st.lastChange.url}>
                <code>{st.lastChange.commitSha?.slice(0, 7)}</code> {st.lastChange.title}
              </ExtLink>{" "}
              <span className="ds-when">· {ago(st.lastChange.occurredAt, feed.now)}</span>
              {st.lastChange.detail && <small className="t-warn">{st.lastChange.detail}</small>}
            </>
          ) : (
            <span className="ds-none">No commits in this repository</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

export function EvidenceList({ p }: { p: Project }) {
  return (
    <ul className="ds-ms">
      {p.milestones.map((m) => (
        <li key={m.label} className={`ev-${m.evidence}`}>
          <span className="ev-grade">{EVIDENCE_LABEL[m.evidence]}</span> {m.label}
        </li>
      ))}
    </ul>
  );
}

function ProjectDossier({ p, feed, onAgent }: { p: Project; feed: Feed; onAgent: (k: number) => void }) {
  const brain = p.id === CENTRE ? feed.brain : null;
  return (
    <>
      <div className="ds-k" style={{ color: COLORS[p.id] }}>
        {DISTRICTS[p.district]} · {CATEGORIES[p.category]}
      </div>
      <h3>{p.title}</h3>
      <a className="chip hot ds-case" href={caseRoute(p.id)} data-testid="case-link">
        Read the case study →
      </a>
      <p className="ds-sum">{p.summary}</p>
      <NatureBadges p={p} />
      <StatusBlock p={p} feed={feed} />
      {brain && (
        <>
          <div className="ds-h">The Brain · committed state</div>
          <dl className="ds-params">
            <div>
              <dt>Generation</dt>
              <dd>
                {brain.generation.toLocaleString("en-US")} · {brain.trials.toLocaleString("en-US")} strategies tried
              </dd>
            </div>
            <div>
              <dt>Champion</dt>
              <dd>{brain.champion.label}</dd>
            </div>
            <div>
              <dt>State read</dt>
              <dd>
                {feed.brainSource === "live" ? "Latest committed state on GitHub" : feed.brainSource === "site" ? "Copy published with the site (may lag the latest run)" : feed.brainSource}
                <small>
                  Written {when(brain.lastRun)}
                  {brain.provenance ? ` by workflow run #${brain.provenance.runNumber} on data as of ${brain.provenance.dataAsOf}` : " (this state predates run provenance)"}
                </small>
              </dd>
            </div>
          </dl>
        </>
      )}
      <div className="ds-h">Evidence by milestone</div>
      <EvidenceList p={p} />
      <div className="ds-h">Known limitations</div>
      <ul className="ds-lim">
        {p.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {p.agents.length > 0 && (
        <>
          <div className="ds-h">Bots</div>
          <ul className="ds-agents">
            {p.agents.map((a, k) => (
              <li key={a.name}>
                <button type="button" className="ds-agent" onClick={() => onAgent(k)} data-testid={`agent-${p.id}-${k}`}>
                  <i className="ds-bot" style={{ background: KIND_COLOR[a.kind], color: KIND_COLOR[a.kind] }} aria-hidden />
                  <div>
                    <b>{a.name}</b> <span className="ds-kind">{KIND_LABEL[a.kind]}</span>
                    <p>{a.duty}</p>
                    <p className="ds-out">
                      → {a.output}
                      {a.verification === "not-verified" && <em className="t-warn"> · not verified</em>}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="ds-h">Where to see it</div>
      <ViewLinks p={p} />
    </>
  );
}

function ViewLinks({ p }: { p: Project }) {
  const onHome = typeof location !== "undefined" && location.pathname === BASE;
  return (
    <div className="ds-links">
      <a className="chip" href={caseRoute(p.id)}>
        Case study
      </a>
      {p.links.map((l) =>
        l.station && onHome ? (
          <button key={l.label} className="chip" type="button" onClick={() => (l.station === "jarvis" ? bus.emit({ type: "open_jarvis" }) : bus.emit({ type: "navigate", station: "model" }))}>
            {l.label}
          </button>
        ) : (
          <a key={l.label} className="chip" href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}>
            {l.label} ↗
          </a>
        ),
      )}
    </div>
  );
}

function AgentDossier({ p, a, feed, onProject }: { p: Project; a: Agent; feed: Feed; onProject: () => void }) {
  const st = feed.states[p.id];
  const job = a.kind === "scheduled" || a.kind === "ci";
  const when =
    a.kind === "scheduled"
      ? "Every 6 hours on GitHub Actions"
      : a.kind === "ci"
        ? "On every push that touches its files"
        : a.kind === "deploy"
          ? "Before every deploy; a failure blocks it"
          : a.kind === "local"
            ? "On the owner's machine"
            : "On demand; same seed, same result";
  return (
    <>
      <div className="ds-k" style={{ color: KIND_COLOR[a.kind] }}>
        Bot · {p.title}
      </div>
      <h3>{a.name}</h3>
      <dl className="ds-params">
        <div>
          <dt>Task</dt>
          <dd>{a.duty}</dd>
        </div>
        <div>
          <dt>Last output</dt>
          <dd className="ds-out">{a.output}</dd>
        </div>
        <div>
          <dt>Runs</dt>
          <dd>{when}</dd>
        </div>
        {job && (
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`pill t-${EXEC[st.execution].tone}`}>
                {EXEC[st.execution].icon} {EXEC[st.execution].label}
              </span>
            </dd>
          </div>
        )}
        <div>
          <dt>Verified</dt>
          <dd>{a.verification === "verified" ? <>Defined in {a.source?.replace(/^repo:/, "")}</> : <span className="t-warn">Not verified from this repository</span>}</dd>
        </div>
      </dl>
      <div className="ds-h">Project progress</div>
      <div className="ds-prog">
        <div className="ds-bar">
          <i style={{ background: COLORS[p.id], width: `${progress(p) * 100}%` }} />
        </div>
        <span>
          {shipped(p).length}/{p.milestones.length} shipped
        </span>
      </div>
      <div className="ds-h">Still to build</div>
      <ul className="ds-ms">
        {pending(p).length ? (
          pending(p).map((m) => (
            <li key={m.label}>
              <span className="ev-grade">Planned</span> {m.label}
            </li>
          ))
        ) : (
          <li>Nothing planned</li>
        )}
      </ul>
      <div className="ds-h">Where to see it</div>
      <ViewLinks p={p} />
      <div className="ds-links">
        <button type="button" className="chip" onClick={onProject}>
          ← {p.title} dossier
        </button>
      </div>
    </>
  );
}

type BotInfo = { key: string; p: Project; a: Agent; k: number; color: string };

function CrewRoster({ bots, feed, selected, onPick }: { bots: BotInfo[]; feed: Feed; selected: string | null; onPick: (b: BotInfo) => void }) {
  return (
    <>
      <div className="ds-k" style={{ color: "#22d3ee" }}>
        Every automated job
      </div>
      <h3>Bots</h3>
      <p className="ds-sum">A bot stands still unless its job is verifiably running or a new event just arrived. Each one names where its definition lives.</p>
      {PROJECTS.filter((p) => p.agents.length).map((p) => (
        <div key={p.id} className="crew-g">
          <div className="crew-h" style={{ color: COLORS[p.id] }}>
            {p.title} · {EXEC[feed.states[p.id].execution].label}
          </div>
          <ul className="crew">
            {bots
              .filter((b) => b.p.id === p.id)
              .map((b) => (
                <li key={b.key}>
                  <button type="button" className={selected === b.key ? "on" : ""} onClick={() => onPick(b)} data-testid={`crew-${b.key}`}>
                    <i className="ds-bot" style={{ background: b.color, color: b.color }} aria-hidden />
                    <span>
                      <b>{b.a.name}</b>
                      <small>
                        {b.a.output}
                        {b.a.verification === "not-verified" ? " · not verified" : ""}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </>
  );
}

const SOURCE_LABEL: Record<CityEvent["source"], string> = {
  "github-actions": "GitHub Actions",
  "brain-state": "Brain state",
  git: "git",
  build: "build check",
  derived: "derived",
  demo: "DEMO",
};

export function Timeline({ feed, project, limit = 30 }: { feed: Feed; project: ProjectId | null; limit?: number }) {
  const [more, setMore] = useState(false);
  const [only, setOnly] = useState(!!project);
  const list = feed.store.events.filter((e) => !only || !project || e.projectId === project);
  const shown = more ? list : list.slice(0, limit);
  return (
    <div className="tl" data-testid="timeline">
      <div className="ds-k" style={{ color: "#22d3ee" }}>
        Verified events
      </div>
      <h3>Timeline</h3>
      <p className="ds-sum">
        Newest first. Every entry links to its source: a GitHub Actions run, a commit, a check run at build time, or a rule derived from those. {feed.store.rejected.length ? `${feed.store.rejected.length} malformed records were rejected.` : ""}
      </p>
      <div className="tl-bar">
        {project && (
          <label className="tl-only">
            <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> {byId(project).title} only
          </label>
        )}
        <button type="button" className="chip" onClick={() => replayLatest(only && project ? project : undefined)} data-testid="replay">
          ↻ Replay latest event
        </button>
      </div>
      <ol className="tl-list">
        {shown.map((e) => (
          <li key={e.eventId} className={`t-${eventTone(e)}${e.demo ? " is-demo" : ""}`} data-type={e.eventType}>
            <span className="tl-ico" aria-hidden>
              {EVENT_ICON[e.status]}
            </span>
            <div>
              <div className="tl-meta">
                <time dateTime={e.occurredAt}>{when(e.occurredAt)}</time> · <span style={{ color: COLORS[e.projectId] }}>{byId(e.projectId).title}</span> · {SOURCE_LABEL[e.source]}
                {e.sourceRunId && e.source === "github-actions" ? ` · run ${e.sourceRunId}` : ""}
                {e.demo ? " · not real" : ""}
              </div>
              <div className="tl-title">
                <span className="vh">{e.status}: </span>
                <ExtLink href={e.url}>{e.title}</ExtLink>
              </div>
              {e.detail && <p className="tl-detail">{e.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      {!more && list.length > limit && (
        <button type="button" className="chip" onClick={() => setMore(true)}>
          Show all {list.length}
        </button>
      )}
    </div>
  );
}

function FoundryDossier({ feed }: { feed: Feed }) {
  const d = feed.evidence.dataset;
  const stale = feed.states[CENTRE].dataStale;
  return (
    <>
      <div className="ds-k" style={{ color: "#94a3b8" }}>
        Shared infrastructure
      </div>
      <h3>Data Foundry</h3>
      <p className="ds-sum">Where the districts get their inputs. Script bots draw from here; scheduled and release bots report to the centre tower.</p>
      <dl className="ds-params">
        <div>
          <dt>Market data</dt>
          <dd>
            {d.weeks} weekly bars, {d.from} → {d.asOf}
            <small>{d.source}</small>
            {stale ? <span className="pill t-warn">! {stale.title}</span> : <span className="pill t-ok">✓ Within tolerance</span>}
          </dd>
        </div>
        <div>
          <dt>Refresh</dt>
          <dd>
            Manual snapshot. No automated refresh exists, so a successful Brain run re-searches the same history.
          </dd>
        </div>
        <div>
          <dt>Deal inputs</dt>
          <dd>Illustrative ARV, rehab, fee and buyer-cost assumptions from the v2 workbook</dd>
        </div>
        <div>
          <dt>Research vault</dt>
          <dd>Markdown notes linked into a knowledge graph</dd>
        </div>
      </dl>
      <div className="ds-links">
        <a className="chip" href={`${BASE}research/#graph`}>
          Open the knowledge graph ↗
        </a>
      </div>
    </>
  );
}
