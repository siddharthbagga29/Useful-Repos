import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STATIONS, TAPE, type Act, type StationId } from "./data/site.ts";
import { bus } from "./jarvis/bus.ts";
import { useJarvis } from "./jarvis/JarvisProvider.tsx";
import { JarvisOverlay } from "./jarvis/JarvisOverlay.tsx";
import { Analyst } from "./ui/Analyst.tsx";
import { CommandPalette } from "./ui/CommandPalette.tsx";
import { Hero } from "./stations/Hero.tsx";
import { Numbers } from "./stations/Numbers.tsx";
import { Terminal } from "./stations/Terminal.tsx";
import { Model } from "./stations/Model.tsx";
import { DealRoom } from "./stations/DealRoom.tsx";
import { Exhibits } from "./stations/Exhibits.tsx";
import { JarvisStation } from "./stations/JarvisStation.tsx";
import { Contact } from "./stations/Contact.tsx";
import { Experience } from "./stations/Experience.tsx";
import { Nav } from "./ui/Nav.tsx";
import { Connect } from "./ui/Connect.tsx";

const N = STATIONS.length;

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}

export default function App() {
  const reduce = useReducedMotion();
  const wide = useMedia("(min-width: 761px) and (min-height: 560px)");
  const horizontal = wide && !reduce;
  const j = useJarvis();

  const rig = useRef<HTMLDivElement>(null);
  const film = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const [active, setActive] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // horizontal film driven by vertical scroll
  const { scrollYProgress: rigProgress } = useScroll({ target: rig, offset: ["start start", "end end"] });
  const { scrollY, scrollYProgress: pageProgress } = useScroll();
  const smooth = useSpring(rigProgress, { stiffness: 150, damping: 30, mass: 0.35 });
  const x = useTransform(smooth, (p) => -p * dist);
  const progress = horizontal ? smooth : pageProgress;

  // scroll energy makes the analyst work faster
  const velocity = useVelocity(scrollY);
  const energy = useRef(0);
  useMotionValueEvent(velocity, "change", (v) => {
    energy.current = Math.min(3, Math.abs(v) / 1200);
  });
  useEffect(() => {
    const id = setInterval(() => (energy.current *= 0.85), 120);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    if (!horizontal || !film.current) return;
    const el = film.current;
    const measure = () => setDist(Math.max(0, el.scrollWidth - innerWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      removeEventListener("resize", measure);
    };
  }, [horizontal]);

  useMotionValueEvent(rigProgress, "change", (p) => {
    if (horizontal) setActive(Math.min(N - 1, Math.max(0, Math.round(p * (N - 1)))));
    if (p > 0.004) setScrolled(true);
  });
  useMotionValueEvent(scrollY, "change", (y) => y > 10 && setScrolled(true));

  // vertical mode: active station from intersection
  useEffect(() => {
    if (horizontal) return;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setActive(STATIONS.findIndex((s) => s.id === (e.target as HTMLElement).dataset.station));
      },
      { threshold: 0.45 },
    );
    document.querySelectorAll<HTMLElement>("[data-station]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [horizontal]);

  const go = useCallback(
    (id: StationId) => {
      const i = STATIONS.findIndex((s) => s.id === id);
      if (i < 0) return;
      if (horizontal && rig.current) {
        const top = rig.current.offsetTop + (rig.current.offsetHeight - innerHeight) * (i / (N - 1));
        scrollTo({ top, behavior: "smooth" });
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      }
      setActive(i);
    },
    [horizontal, reduce],
  );

  useEffect(
    () =>
      bus.on((e) => {
        if (e.type === "navigate") go(e.station);
      }),
    [go],
  );

  // keyboard: 1–8 jump, J opens Jarvis, arrows step stations
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], .cx-back") || e.metaKey || e.ctrlKey || e.altKey || j.open) return;
      const k = e.key;
      if (/^[1-9]$/.test(k)) go(STATIONS[+k - 1]!.id);
      else if (k === "j" || k === "J") j.setOpen(true);
      else if (horizontal && (k === "ArrowRight" || k === "ArrowLeft")) {
        e.preventDefault();
        go(STATIONS[Math.min(N - 1, Math.max(0, active + (k === "ArrowRight" ? 1 : -1)))]!.id);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [go, j, active, horizontal]);

  const station = STATIONS[active] ?? STATIONS[0];
  const act: Act = j.status === "listening" || j.status === "armed" ? "listen" : j.status === "speaking" || j.status === "thinking" ? "talk" : station.act;
  const doing = j.status === "listening" ? "listening to you" : j.status === "speaking" ? "briefing you" : j.status === "thinking" ? "pulling the file" : station.doing;

  const stations = (
    <>
      <Hero />
      <Numbers />
      <Experience />
      <Terminal />
      <Model />
      <DealRoom />
      <Exhibits />
      <JarvisStation />
      <Contact />
    </>
  );

  return (
    <>
      <a className="skip" href="#jarvis" onClick={(e) => (e.preventDefault(), j.setOpen(true))}>
        Skip to Jarvis
      </a>
      <Tape />
      <Nav active={station.id} />
      <main>
        {horizontal ? (
          <div className="rig" ref={rig} style={{ height: `${N * 115}vh` }}>
            <div className="vp">
              <motion.div className="film" ref={film} style={{ x }}>
                {stations}
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="stack">{stations}</div>
        )}
      </main>

      <Analyst act={act} doing={doing} energy={energy} />

      <nav className="dots" aria-label="Stations">
        {STATIONS.map((s, i) => (
          <button key={s.id} aria-label={s.label} aria-current={i === active} onClick={() => go(s.id)}>
            <span className="dot-label">{s.label}</span>
          </button>
        ))}
      </nav>

      <motion.div className="progress" style={{ scaleX: progress }} />
      <AnimatePresence>
        {!scrolled && (
          <motion.div className="hint" initial={{ opacity: 0 }} animate={{ opacity: 1, x: horizontal ? [0, 6, 0] : 0, y: horizontal ? 0 : [0, 5, 0] }} exit={{ opacity: 0 }} transition={{ repeat: Infinity, duration: 1.6 }}>
            {horizontal ? "Scroll →" : "Scroll ↓"}
          </motion.div>
        )}
      </AnimatePresence>

      <TapBursts />
      <Cursor />
      <JarvisOverlay />
      <CommandPalette />
      <Connect />
    </>
  );
}

function Tape() {
  const reduce = useReducedMotion();
  const items = [...TAPE, ...TAPE, ...TAPE, ...TAPE];
  return (
    <div className="tape" role="marquee" aria-label="Market tape, as of 2 Oct 2026">
      <motion.div className="tape-r" animate={reduce ? undefined : { x: ["0%", "-50%"] }} transition={{ duration: 70, ease: "linear", repeat: Infinity }}>
        {items.map(([k, v, d], i) => (
          <span key={i}>
            <b>{k}</b> <u className={d}>{v}</u>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// Things an analyst actually types, says, or checks. Shown wherever you tap.
const TAPS = [
  "=XNPV(B13,C9:G9,C2:G2)", "F9", "Ctrl+Shift+L", "Alt E S V", "+25 bps", "IRR 22.4%", "MOIC 2.6x", "⌘S ×3",
  "=INDEX(MATCH())", "BS balances ✓", "Circ ref: iterative ✓", "LTM → NTM", "TV 62% of EV — check it",
  "Plug = 0", "Ctrl+[", "Paste values only", "Backlog > plan?", "Normalize EBITDA", "Mid-year convention",
  "Accretive ✓", "Sources = Uses", "Stamp: APPROVED", "v7_FINAL_v2.xlsx",
];

function TapBursts() {
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; t: string }[]>([]);
  const reduce = useReducedMotion();
  useEffect(() => {
    let n = 0;
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, .overlay, .pal-back, .jx, .cx-back, .nav, input[type=range]")) return;
      bus.emit({ type: "tap" });
      if (reduce) return;
      const t = TAPS[Math.floor(Math.random() * TAPS.length)]!;
      const id = ++n;
      setBursts((b) => [...b.slice(-6), { id, x: e.clientX, y: e.clientY, t }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100);
    };
    addEventListener("pointerdown", onDown);
    return () => removeEventListener("pointerdown", onDown);
  }, [reduce]);
  return (
    <div className="bursts" aria-hidden>
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.span
            key={b.id}
            className="burst"
            style={{ left: b.x, top: b.y }}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -64, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            {b.t}
          </motion.span>
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {bursts.slice(-1).map((b) => (
          <motion.i key={`r${b.id}`} className="ripple" style={{ left: b.x, top: b.y }} initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 3, opacity: 0 }} transition={{ duration: 0.6 }} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Cursor() {
  const fine = useMedia("(hover: hover) and (pointer: fine)");
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const sx = useSpring(mx, { stiffness: 500, damping: 40, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 500, damping: 40, mass: 0.4 });
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!fine) return;
    const move = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    const over = (e: PointerEvent) => setBig(!!(e.target as HTMLElement).closest("a, button, input, select, [role=switch], .cell, td"));
    addEventListener("pointermove", move);
    addEventListener("pointerover", over);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerover", over);
    };
  }, [fine, mx, my]);
  if (!fine) return null;
  return <motion.div className="cursor" style={{ x: sx, y: sy }} animate={{ width: big ? 56 : 28, height: big ? 56 : 28, backgroundColor: big ? "rgba(255,74,28,.15)" : "rgba(255,74,28,0)" }} />;
}
