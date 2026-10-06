import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState, type KeyboardEvent } from "react";
import { KIND_LABEL, PROJECTS, progress, type AgentKind, type Project } from "./projects.ts";
import { useBrain, nextRun } from "../brain/useBrain.ts";
import type { BrainState } from "../brain/engine.ts";
import { bus } from "../jarvis/bus.ts";
import "./city.css";

// Isometric projection. World units: plots are 14 × 14 on a 3 × 3 grid; roads run along multiples of 14.
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
  script: "#ff7a45",
  local: "#c084fc",
};

const FLOOR = 2.4;
const BRAIN: [number, number] = [1, 1];
const FOUNDRY: [number, number] = [0, 0];
const BASE: string = import.meta.env.BASE_URL;

// Fit the view to the ground diamond and the tallest sign.
const VIEWBOX = (() => {
  const g = [iso(-3, -3), iso(3 * P + 3, -3), iso(3 * P + 3, 3 * P + 3), iso(-3, 3 * P + 3)];
  const minX = Math.min(...g.map((q) => q[0])) - 6;
  const maxX = Math.max(...g.map((q) => q[0])) + 6;
  const top = iso(1.5 * P, 1.5 * P, 36 + 3.5)[1] - 50;
  const bottom = Math.max(...g.map((q) => q[1])) + 6;
  return `${minX} ${top} ${maxX - minX} ${bottom - top}`;
})();

type Sel = { type: "project"; p: Project } | { type: "brain" } | { type: "foundry" };

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function Box({ x, y, z, w, d, h, color, wire = false }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string; wire?: boolean }) {
  const top = pts([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]);
  const right = pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]);
  const left = pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]);
  if (wire)
    return (
      <g className="wire" stroke={color}>
        <polygon points={left} />
        <polygon points={right} />
        <polygon points={top} />
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

/** Lit windows on the two visible faces of one floor. */
function Windows({ x, y, z, w, d, h, seed }: { x: number; y: number; z: number; w: number; d: number; h: number; seed: number }) {
  const out = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = 0.8 + (i * (w - 1.6)) / n;
    const lit = (seed * 7 + i * 3) % 5 !== 0;
    const delay = ((seed * 13 + i * 5) % 17) / 3;
    const zz = z + h * 0.3;
    const hh = h * 0.42;
    const ww = (w - 1.6) / n - 0.5;
    out.push(<polygon key={`l${i}`} className={lit ? "win on" : "win"} style={{ animationDelay: `${delay}s` }} points={pts([x + a, y + d, zz], [x + a + ww, y + d, zz], [x + a + ww, y + d, zz + hh], [x + a, y + d, zz + hh])} />);
    const b = 0.8 + (i * (d - 1.6)) / n;
    const lit2 = (seed * 5 + i * 7) % 4 !== 0;
    out.push(<polygon key={`r${i}`} className={lit2 ? "win on" : "win"} style={{ animationDelay: `${delay + 1.1}s` }} points={pts([x + w, y + b, zz], [x + w, y + b + ww, zz], [x + w, y + b + ww, zz + hh], [x + w, y + b, zz + hh])} />);
  }
  return <g>{out}</g>;
}

function Building({ p, selected, onSelect, reduce }: { p: Project; selected: boolean; onSelect: () => void; reduce: boolean }) {
  const [i, j] = p.plot;
  const x = i * P + 3.75;
  const y = j * P + 3.75;
  const w = 7.5;
  const d = 7.5;
  const done = p.milestones.filter(([, m]) => m).length;
  const total = p.milestones.length;
  const roofZ = done * FLOOR;
  const topZ = total * FLOOR;
  const [lx, ly] = iso(x + w / 2, y + d / 2, topZ + 5);
  const pct = Math.round(progress(p) * 100);
  const [mx, my] = iso(x + w, y, topZ + 3);
  const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect());
  return (
    <g className={`bld${selected ? " sel" : ""}`} role="button" tabIndex={0} aria-label={`${p.name}: ${done} of ${total} milestones shipped`} aria-pressed={selected} onClick={onSelect} onKeyDown={key} data-testid={`bld-${p.id}`}>
      <polygon className="plot" points={pts([i * P + 2, j * P + 2, 0], [i * P + P - 2, j * P + 2, 0], [i * P + P - 2, j * P + P - 2, 0], [i * P + 2, j * P + P - 2, 0])} style={{ stroke: selected ? p.color : undefined }} />
      {p.milestones.map(([, m], k) =>
        m ? (
          <motion.g key={k} initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + k * 0.09, type: "spring", stiffness: 200, damping: 20 }}>
            <Box x={x} y={y} z={k * FLOOR} w={w} d={d} h={FLOOR - 0.25} color={p.color} />
            <Windows x={x} y={y} z={k * FLOOR} w={w} d={d} h={FLOOR} seed={k + p.id.length} />
          </motion.g>
        ) : (
          <Box key={k} x={x} y={y} z={k * FLOOR} w={w} d={d} h={FLOOR - 0.25} color={p.color} wire />
        ),
      )}
      {done < total ? (
        <g className="crane">
          <line className="mast" x1={iso(x + w, y, roofZ)[0]} y1={iso(x + w, y, roofZ)[1]} x2={mx} y2={my} stroke={p.color} />
          <g>
            {!reduce && <animateTransform attributeName="transform" type="rotate" values={`-14 ${mx} ${my};14 ${mx} ${my};-14 ${mx} ${my}`} dur={`${9 + (p.id.length % 4)}s`} repeatCount="indefinite" />}
            <line className="jib" x1={mx - 26} y1={my} x2={mx + 14} y2={my} stroke={p.color} />
            <line className="cable" x1={mx - 20} y1={my} x2={mx - 20} y2={my + 10} stroke={p.color}>
              {!reduce && <animate attributeName="y2" values={`${my + 6};${iso(x + w, y, roofZ + 1)[1]};${my + 6}`} dur="5s" repeatCount="indefinite" />}
            </line>
          </g>
          {!reduce && <circle className="spark" cx={iso(x + w * 0.6, y + d, roofZ + 0.6)[0]} cy={iso(x + w * 0.6, y + d, roofZ + 0.6)[1]} r={1.6} />}
        </g>
      ) : (
        <motion.circle className="beacon" cx={iso(x + w / 2, y + d / 2, roofZ + 0.8)[0]} cy={iso(x + w / 2, y + d / 2, roofZ + 0.8)[1]} r={2.2} fill={p.color} animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }} transition={{ duration: 2.4, repeat: Infinity }} />
      )}
      <g className="sign" transform={`translate(${lx},${ly})`}>
        <rect x={-52} y={-19} width={104} height={25} rx={5} />
        <text y={-7} textAnchor="middle" className="sign-n">
          {p.name}
        </text>
        <rect x={-40} y={-1} width={80} height={2.6} rx={1.3} className="sign-bar" />
        <rect x={-40} y={-1} width={(80 * pct) / 100} height={2.6} rx={1.3} fill={p.color} />
      </g>
    </g>
  );
}

function BrainTower({ gen, selected, onSelect, reduce }: { gen: number | null; selected: boolean; onSelect: () => void; reduce: boolean }) {
  const [i, j] = BRAIN;
  const cx = i * P + P / 2;
  const cy = j * P + P / 2;
  const h = 36;
  const [ox, oy] = iso(cx, cy, h + 3.5);
  const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect());
  return (
    <g className={`bld brain${selected ? " sel" : ""}`} role="button" tabIndex={0} aria-pressed={selected} onClick={onSelect} onKeyDown={key} data-testid="bld-brain">
      <polygon className="plot" points={pts([i * P + 2, j * P + 2, 0], [i * P + P - 2, j * P + 2, 0], [i * P + P - 2, j * P + P - 2, 0], [i * P + 2, j * P + P - 2, 0])} />
      <Box x={cx - 4.5} y={cy - 4.5} z={0} w={9} d={9} h={3} color="#1f2937" />
      <Box x={cx - 2.2} y={cy - 2.2} z={3} w={4.4} d={4.4} h={h - 3} color="#0e7490" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
        <motion.polygon key={k} className="brain-band" points={pts([cx + 2.2, cy - 2.2, 5 + k * 3], [cx + 2.2, cy + 2.2, 5 + k * 3], [cx + 2.2, cy + 2.2, 5.6 + k * 3], [cx + 2.2, cy - 2.2, 5.6 + k * 3])} animate={reduce ? undefined : { opacity: [0.15, 1, 0.15] }} transition={{ duration: 1.8, delay: k * 0.22, repeat: Infinity }} />
      ))}
      <motion.ellipse cx={ox} cy={oy + 6} rx={22} ry={8} className="ring" animate={reduce ? undefined : { rx: [20, 26, 20], opacity: [0.7, 0.25, 0.7] }} transition={{ duration: 3, repeat: Infinity }} />
      <circle cx={ox} cy={oy} r={9} fill="url(#core)" />
      <motion.circle cx={ox} cy={oy} r={9} className="core-pulse" animate={reduce ? undefined : { r: [9, 16, 9], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.2, repeat: Infinity }} />
      <g className="sign brain-sign" transform={`translate(${ox},${oy - 22})`}>
        <rect x={-56} y={-20} width={112} height={27} rx={5} />
        <text y={-8} textAnchor="middle" className="sign-n">
          THE BRAIN
        </text>
        <text y={3} textAnchor="middle" className="sign-s">
          {gen === null ? "loading…" : `generation ${gen.toLocaleString("en-US")}`}
        </text>
      </g>
    </g>
  );
}

function Foundry({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const [i, j] = FOUNDRY;
  const x = i * P + 2.5;
  const y = j * P + 3;
  const [lx, ly] = iso(x + 1, y + 9, 12); // sign offset to the left so the Brain doesn't hide it
  const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect());
  return (
    <g className={`bld${selected ? " sel" : ""}`} role="button" tabIndex={0} aria-pressed={selected} onClick={onSelect} onKeyDown={key} data-testid="bld-foundry">
      <polygon className="plot" points={pts([i * P + 2, j * P + 2, 0], [i * P + P - 2, j * P + 2, 0], [i * P + P - 2, j * P + P - 2, 0], [i * P + 2, j * P + P - 2, 0])} />
      <Box x={x} y={y + 3} z={0} w={9} d={5} h={3.5} color="#64748b" />
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <Box x={x + 0.6 + k * 3} y={y} z={0} w={2.2} d={2.2} h={7 + k} color="#94a3b8" />
          <polygon className="silo-cap" points={pts([x + 0.6 + k * 3, y, 7 + k], [x + 2.8 + k * 3, y, 7 + k], [x + 2.8 + k * 3, y + 2.2, 7 + k], [x + 0.6 + k * 3, y + 2.2, 7 + k])} />
        </g>
      ))}
      <g className="sign" transform={`translate(${lx},${ly})`}>
        <rect x={-52} y={-20} width={104} height={27} rx={5} />
        <text y={-8} textAnchor="middle" className="sign-n">
          Data Foundry
        </text>
        <text y={3} textAnchor="middle" className="sign-s">
          561 weeks · vault
        </text>
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

function Bot({ path, color, packet, delay, speed, reduce, label }: { path: [number, number][]; color: string; packet: string; delay: number; speed: number; reduce: boolean; label: string }) {
  const screen = path.map(([x, y]) => iso(x, y, 0));
  const segs = screen.slice(1).map((p, k) => Math.hypot(p[0] - screen[k]![0], p[1] - screen[k]![1]));
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const times = [0, ...segs.map((s) => (acc += s) / total)];
  const [x0, y0] = screen[0]!;
  return (
    <motion.g
      className="bot"
      initial={{ x: x0, y: y0 }}
      animate={reduce ? { x: x0, y: y0 } : { x: screen.map((p) => p[0]), y: screen.map((p) => p[1]) }}
      transition={reduce ? undefined : { duration: total / speed, times, repeat: Infinity, ease: "linear", delay, repeatDelay: 0.8 }}
    >
      <title>{label}</title>
      <circle cx={0} cy={-5} r={7} fill={color} className="bot-glow" />
      <ellipse cx={0} cy={0.8} rx={3.8} ry={1.5} className="bot-shadow" />
      <rect x={-2.6} y={-7.6} width={5.2} height={7} rx={1.8} className="bot-body" />
      <circle cx={0} cy={-9.8} r={2.6} className="bot-head" />
      <rect x={-1.7} y={-10.6} width={3.4} height={1.3} rx={0.6} fill={color} />
      <rect x={2.9} y={-8} width={3.2} height={3.2} rx={0.6} fill={packet} className="bot-packet" />
    </motion.g>
  );
}

export function City({ compact = false, active = true }: { compact?: boolean; active?: boolean }) {
  const reduce = !!useReducedMotion();
  const { data } = useBrain(compact ? 0 : 120_000);
  const brain = data?.state ?? null;
  const [sel, setSel] = useState<Sel>({ type: "project", p: PROJECTS[0]! });

  const bots = useMemo(() => {
    const out: { key: string; path: [number, number][]; color: string; packet: string; delay: number; speed: number; label: string }[] = [];
    let n = 0;
    for (const p of PROJECTS) {
      p.agents.forEach((a, k) => {
        const target: [number, number] = a.kind === "script" || a.kind === "local" ? FOUNDRY : BRAIN;
        const path = target[0] === p.plot[0] && target[1] === p.plot[1] ? route(p.plot, BRAIN) : route(p.plot, target);
        out.push({ key: `${p.id}-${k}`, path, color: KIND_COLOR[a.kind], packet: p.color, delay: (n++ * 1.37) % 7, speed: 26 + ((n * 7) % 11), label: `${a.name} · ${p.name} · ${KIND_LABEL[a.kind]}` });
      });
    }
    return out;
  }, []);

  const order = useMemo(() => {
    const items: { k: string; depth: number; el: "brain" | "foundry" | Project }[] = [
      ...PROJECTS.map((p) => ({ k: p.id, depth: p.plot[0] + p.plot[1], el: p as Project })),
      { k: "brain", depth: BRAIN[0] + BRAIN[1], el: "brain" as const },
      { k: "foundry", depth: FOUNDRY[0] + FOUNDRY[1], el: "foundry" as const },
    ];
    return items.sort((a, b) => a.depth - b.depth);
  }, []);

  const roads = [];
  for (let k = 0; k <= 3; k++) {
    roads.push(<line key={`a${k}`} className="road" x1={iso(k * P, 0)[0]} y1={iso(k * P, 0)[1]} x2={iso(k * P, 3 * P)[0]} y2={iso(k * P, 3 * P)[1]} />);
    roads.push(<line key={`b${k}`} className="road" x1={iso(0, k * P)[0]} y1={iso(0, k * P)[1]} x2={iso(3 * P, k * P)[0]} y2={iso(3 * P, k * P)[1]} />);
    roads.push(<line key={`c${k}`} className="road-flow" x1={iso(k * P, 0)[0]} y1={iso(k * P, 0)[1]} x2={iso(k * P, 3 * P)[0]} y2={iso(k * P, 3 * P)[1]} />);
    roads.push(<line key={`d${k}`} className="road-flow" x1={iso(0, k * P)[0]} y1={iso(0, k * P)[1]} x2={iso(3 * P, k * P)[0]} y2={iso(3 * P, k * P)[1]} />);
  }

  const totalBots = bots.length;
  const shipped = PROJECTS.reduce((a, p) => a + p.milestones.filter(([, m]) => m).length, 0);
  const floors = PROJECTS.reduce((a, p) => a + p.milestones.length, 0);

  return (
    <div className={`city${compact ? " compact" : ""}`}>
      <div className="city-stage">
        <div className="city-hud" aria-hidden>
          <span>
            <b>{PROJECTS.length}</b> districts
          </span>
          <span>
            <b>{totalBots}</b> bots
          </span>
          <span>
            <b>
              {shipped}/{floors}
            </b>{" "}
            floors built
          </span>
          <span>
            <b>{brain ? brain.generation.toLocaleString("en-US") : "…"}</b> brain gens
          </span>
        </div>
        <svg className="city-svg" viewBox={VIEWBOX} role="group" aria-label="Research city: each building is a project, each floor a milestone, each bot an automated job">
          <defs>
            <radialGradient id="core">
              <stop offset="0" stopColor="#e0fbff" />
              <stop offset=".45" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#0e7490" stopOpacity=".2" />
            </radialGradient>
          </defs>
          <polygon className="ground" points={pts([-3, -3, 0], [3 * P + 3, -3, 0], [3 * P + 3, 3 * P + 3, 0], [-3, 3 * P + 3, 0])} />
          {roads}
          {order.map(({ k, el }) =>
            el === "brain" ? (
              <BrainTower key={k} gen={brain?.generation ?? null} selected={sel.type === "brain"} onSelect={() => setSel({ type: "brain" })} reduce={reduce} />
            ) : el === "foundry" ? (
              <Foundry key={k} selected={sel.type === "foundry"} onSelect={() => setSel({ type: "foundry" })} />
            ) : (
              <Building key={k} p={el} selected={sel.type === "project" && sel.p.id === el.id} onSelect={() => setSel({ type: "project", p: el })} reduce={reduce} />
            ),
          )}
          {active &&
            bots.map((b) => (
              <Bot {...b} key={b.key} reduce={reduce} />
            ))}
        </svg>
        <div className="city-pick" role="toolbar" aria-label="Choose a district">
          {PROJECTS.map((p) => (
            <button key={p.id} type="button" className={sel.type === "project" && sel.p.id === p.id ? "on" : ""} style={{ ["--c" as string]: p.color }} onClick={() => setSel({ type: "project", p })}>
              {p.name}
            </button>
          ))}
          <button type="button" className={sel.type === "brain" ? "on" : ""} style={{ ["--c" as string]: "#22d3ee" }} onClick={() => setSel({ type: "brain" })} data-testid="pick-brain">
            The Brain
          </button>
          <button type="button" className={sel.type === "foundry" ? "on" : ""} style={{ ["--c" as string]: "#94a3b8" }} onClick={() => setSel({ type: "foundry" })}>
            Data Foundry
          </button>
        </div>
        <div className="city-legend">
          {(Object.keys(KIND_COLOR) as AgentKind[]).map((k) => (
            <span key={k}>
              <i style={{ background: KIND_COLOR[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.aside
          key={sel.type === "project" ? sel.p.id : sel.type}
          className="dossier"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.22 }}
          aria-live="polite"
          data-testid="dossier"
        >
          {sel.type === "project" ? <ProjectDossier p={sel.p} /> : sel.type === "brain" ? <BrainDossier brain={brain} /> : <FoundryDossier />}
        </motion.aside>
      </AnimatePresence>
    </div>
  );
}

function ProjectDossier({ p }: { p: Project }) {
  const done = p.milestones.filter(([, m]) => m).length;
  const onHome = location.pathname === BASE;
  return (
    <>
      <div className="ds-k" style={{ color: p.color }}>
        {p.district}
      </div>
      <h3>{p.name}</h3>
      <div className="ds-prog">
        <div className="ds-bar">
          <motion.i style={{ background: p.color }} initial={{ width: 0 }} animate={{ width: `${progress(p) * 100}%` }} transition={{ duration: 0.8 }} />
        </div>
        <span>
          {done}/{p.milestones.length} floors · {Math.round(progress(p) * 100)}%
        </span>
      </div>
      <p className="ds-sum">{p.summary}</p>
      <dl className="ds-params">
        {p.params.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="ds-h">Crew</div>
      <ul className="ds-agents">
        {p.agents.map((a) => (
          <li key={a.name}>
            <i className="ds-bot" style={{ background: KIND_COLOR[a.kind] }} aria-hidden />
            <div>
              <b>{a.name}</b> <span className="ds-kind">{KIND_LABEL[a.kind]}</span>
              <p>{a.duty}</p>
              <p className="ds-out">→ {a.output}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="ds-h">Floors</div>
      <ul className="ds-ms">
        {p.milestones.map(([m, d]) => (
          <li key={m} className={d ? "on" : ""}>
            <span aria-hidden>{d ? "■" : "▢"}</span> {m}
            {!d && <em> · under construction</em>}
          </li>
        ))}
      </ul>
      {p.links.length > 0 && (
        <div className="ds-links">
          {p.links.map((l) =>
            l.station && onHome ? (
              <button key={l.label} className="chip" type="button" onClick={() => (l.station === "jarvis" ? bus.emit({ type: "open_jarvis" }) : bus.emit({ type: "navigate", station: l.station! }))}>
                {l.label}
              </button>
            ) : (
              <a key={l.label} className="chip" href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                {l.label} ↗
              </a>
            ),
          )}
        </div>
      )}
    </>
  );
}

function BrainDossier({ brain }: { brain: BrainState | null }) {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return (
    <>
      <div className="ds-k" style={{ color: "#22d3ee" }}>
        Central district
      </div>
      <h3>The Brain</h3>
      <p className="ds-sum">
        A self-improving research loop over the Strategy Lab's rule families. Every 6 hours it mutates strategies, backtests them on 2016–2021 only, scores
        them on an institutional rubric, plays challengers against the champion fold by fold with Elo ratings, and logs why each loser lost. 2021–2026 is a
        locked holdout it never sees.
      </p>
      {brain ? (
        <>
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
              <dt>Score · Elo</dt>
              <dd>
                {brain.champion.score.toFixed(1)}/100 · {brain.champion.elo}
              </dd>
            </div>
            <div>
              <dt>Deflated Sharpe</dt>
              <dd>{pct(brain.champion.is.dsr)} probability of real skill after all trials</dd>
            </div>
            {brain.champion.holdout && (
              <div>
                <dt>Holdout</dt>
                <dd>
                  Sharpe {brain.champion.holdout.sharpe.toFixed(2)} vs SPY {brain.champion.holdout.spySharpe.toFixed(2)}
                </dd>
              </div>
            )}
            <div>
              <dt>Next run</dt>
              <dd>{nextRun(brain.lastRun)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="ds-sum">Loading the latest generation…</p>
      )}
      <div className="ds-links">
        <a className="chip" href={`${BASE}research/#brain`}>
          Open the Brain log ↗
        </a>
      </div>
    </>
  );
}

function FoundryDossier() {
  return (
    <>
      <div className="ds-k" style={{ color: "#94a3b8" }}>
        Shared infrastructure
      </div>
      <h3>Data Foundry</h3>
      <p className="ds-sum">Where every district gets its inputs. Script bots haul data from here; scheduled and release bots report to the Brain.</p>
      <dl className="ds-params">
        <div>
          <dt>Market data</dt>
          <dd>8 ETFs · 561 weekly bars · split-adjusted closes, distributions excluded</dd>
        </div>
        <div>
          <dt>Deal inputs</dt>
          <dd>ARV, rehab, fee and buyer-cost assumptions from the v2 workbook</dd>
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
