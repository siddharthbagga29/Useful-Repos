import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONTACT, type StationId } from "../../data/site.ts";
import { track } from "../../lib/track.ts";
import { bus } from "../bus.ts";
import { useJarvis } from "../JarvisProvider.tsx";
import { canSpeak } from "../speech.ts";
import { pickClip, type VoiceManifest } from "./clips.ts";
import { displayText, fill, parseScript } from "./markup.ts";
import raw from "./playbook.json";
import { DWELL_MS, Proactive } from "./proactive.ts";
import type { Action, Audience, Chip, Line, Playbook } from "./types.ts";

// Jarvis as the site's concierge. He opens the conversation, finds out who he's talking to, makes
// the case with one specific proof at a time, handles the usual objections straight, and closes on
// a 30-minute call. Lines come from playbook.json, which only ships after the critic approves it.
// Speech needs one tap or key press first (browser rule): until then, he speaks in text.

const PLAYBOOK = raw as Playbook;
const BASE: string = import.meta.env.BASE_URL;

const store = {
  get(s: Storage | undefined, k: string) {
    try {
      return s?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set(s: Storage | undefined, k: string, v: string) {
    try {
      s?.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
const session = typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
const local = typeof localStorage !== "undefined" ? localStorage : undefined;
// Studio voice clips (ElevenLabs), if they've been recorded. Fetched once; absent means browser voice.
let manifest: VoiceManifest | null = null;
const manifestReady: Promise<VoiceManifest | null> =
  typeof fetch === "undefined"
    ? Promise.resolve(null)
    : fetch(`${import.meta.env.BASE_URL}voice/manifest.json`)
        .then((r) => (r.ok ? (r.json() as Promise<VoiceManifest>) : null))
        .catch(() => null)
        .then((m) => (manifest = m && m.version === 1 ? m : null));

/** "Good morning" etc., by the visitor's own clock. */
const greet = () => {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

// The self-running tour: Jarvis drives the site himself, one stop at a time, and narrates. Any
// scroll, key press or tap outside his card hands control straight back to the visitor.
const TOUR: { id: string; station: StationId; act?: () => void }[] = [
  { id: "tour.numbers", station: "numbers" },
  { id: "tour.experience", station: "experience" },
  { id: "tour.model", station: "model", act: () => bus.emit({ type: "set_dcf", wacc: 9.5 }) },
  { id: "tour.dealroom", station: "dealroom" },
  { id: "tour.research", station: "research" },
  { id: "tour.end", station: "contact" },
];
const SETTLE_MS = 900; // let the film arrive before he speaks

/** How long a line takes to say (or read), with its pauses. */
function airtime(markup: string): number {
  const segs = parseScript(markup);
  const words = segs.reduce((a, s) => a + s.text.split(/\s+/).length, 0);
  const pauses = segs.reduce((a, s) => a + s.pauseAfterMs, 0);
  return Math.max(5000, (words / 2.6) * 1000 + pauses + 1200);
}

const CONNECT_INTENT: Record<Audience, "hiring" | "network" | "deal" | "other"> = { recruiter: "hiring", principal: "deal", founder: "deal", explorer: "network" };

export function Concierge({ station }: { station: string }) {
  const j = useJarvis();
  const [line, setLine] = useState<Line | null>(null);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => store.get(local, "jv-greet-voice") === "off");
  const engine = useRef<Proactive | null>(null);
  const unlocked = useRef(false); // the browser allows speech after the first gesture
  const pendingSpeech = useRef<Line | null>(null);
  const audience = useRef<Audience | null>((store.get(local, "jv-audience") as Audience | null) ?? null);
  const [tour, setTour] = useState<number | null>(null); // stop index while the tour runs
  const tourTimers = useRef<number[]>([]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  engine.current ??= new Proactive();

  const busy = useCallback(() => {
    const a = document.activeElement as HTMLElement | null;
    return j.open || !!document.querySelector(".cx-back, .pal-back") || !!a?.closest("input, textarea, select, [contenteditable]");
  }, [j.open]);

  const [studio, setStudio] = useState<VoiceManifest | null>(manifest);
  useEffect(() => {
    void manifestReady.then(setStudio);
  }, []);

  const say = useCallback(
    (l: Line) => {
      const g = greet();
      const clip = pickClip(manifest, l, g);
      if (mutedRef.current || (!canSpeak() && !clip)) return;
      if (!unlocked.current) {
        pendingSpeech.current = l;
        return;
      }
      const segs = parseScript(fill(l.text, { name: j.visitor?.name, greet: g }));
      if (clip) j.playClip(`${BASE}voice/${clip.file}`, segs);
      else j.speakScript(segs);
    },
    [j],
  );

  const stopTour = useCallback(() => {
    for (const t of tourTimers.current) clearTimeout(t);
    tourTimers.current = [];
    setTour(null);
  }, []);

  const run = useCallback(
    (a: Action) => {
      if (a === "open_schedule") {
        bus.emit({ type: "navigate", station: "contact" });
        setTimeout(() => bus.emit({ type: "open_schedule" }), 700);
      } else if (a === "open_connect") bus.emit({ type: "open_connect", intent: audience.current ? CONNECT_INTENT[audience.current] : "hiring" });
      else if (a === "open_resume") window.open(CONTACT.resume, "_blank", "noopener");
      else if (a === "run_digest") {
        setOpen(false);
        j.setOpen(true);
        j.runDigest();
      } else if (a === "open_jarvis") {
        setOpen(false);
        j.setOpen(true);
      } else if (a === "run_tour") {
        latest.current.runTour();
      } else if (a.startsWith("dcf:")) bus.emit({ type: "set_dcf", wacc: Number(a.slice(4)) });
      else if (a === "snooze") {
        latest.current.stopTour();
        engine.current?.snooze();
        j.stopSpeaking();
        setOpen(false);
      } else if (a.startsWith("navigate:")) bus.emit({ type: "navigate", station: a.slice(9) as StationId });
      else if (a.startsWith("href:")) location.href = `${BASE}${a.slice(5).replace(/^\//, "")}`;
    },
    [j],
  );

  const show = useCallback(
    (id: string, speak = true) => {
      const l = PLAYBOOK.lines[id];
      if (!l) return;
      setLine(l);
      setOpen(true);
      if (speak) say(l);
      if (l.action) run(l.action);
    },
    [say, run],
  );

  // Plan, act, report: navigate to the stop, act if the stop calls for it, narrate, move on.
  const runTour = useCallback(
    (from?: number) => {
      stopTour();
      engine.current?.setEngaged(true);
      const saved = Number(store.get(local, "jv-tour") ?? "0");
      let at = from ?? (saved > 0 && saved < TOUR.length ? saved : 0);
      track("jarvis_ask", { sales: "tour", choice: at === 0 ? "start" : `resume ${at + 1}` });
      const step = () => {
        const stop = TOUR[at];
        if (!stop) return;
        setTour(at);
        store.set(local, "jv-tour", String(at));
        bus.emit({ type: "navigate", station: stop.station });
        const t1 = window.setTimeout(() => {
          show(stop.id);
          stop.act?.();
          if (at === TOUR.length - 1) {
            store.set(local, "jv-tour", "done");
            setTour(null); // the last stop asks; the visitor answers
            return;
          }
          const l = PLAYBOOK.lines[stop.id];
          const t2 = window.setTimeout(() => {
            at += 1;
            step();
          }, airtime(l?.text ?? ""));
          tourTimers.current.push(t2);
        }, SETTLE_MS);
        tourTimers.current.push(t1);
      };
      step();
    },
    [show, stopTour],
  );

  // hand control back the moment the visitor does anything outside the card
  useEffect(() => {
    if (tour === null) return;
    const interrupt = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.(".concierge")) return;
      stopTour();
      j.stopSpeaking();
    };
    const opts = { capture: true, passive: true } as const;
    for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"]) addEventListener(ev, interrupt, opts);
    return () => {
      for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"]) removeEventListener(ev, interrupt, opts);
    };
  }, [tour, stopTour, j]);

  useEffect(() => stopTour, [stopTour]);

  // the landing effect runs once; it reads the latest callbacks through this ref
  const latest = useRef({ show, busy, j, runTour: runTour as (from?: number) => void, stopTour, say });
  latest.current = { show, busy, j, runTour, stopTour, say };

  const choose = (c: Chip) => {
    engine.current?.setEngaged(true);
    if (c.audience) {
      audience.current = c.audience;
      store.set(local, "jv-audience", c.audience);
    }
    track("jarvis_ask", { sales: line?.id ?? "", choice: c.label });
    if (c.action) run(c.action);
    if (c.next) show(c.next);
  };

  // landing: greet (first visit) or welcome back (returning visitor)
  useEffect(() => {
    const { j } = latest.current;
    if (store.get(session, "jv-greeted") === "1" || /^#(jarvis|connect)$/.test(location.hash)) {
      engine.current?.setEngaged(true); // seen this visit already: no second greeting
      return;
    }
    const returning = store.get(local, "jv-seen") === "1" || !!j.visitor?.name;
    store.set(local, "jv-seen", "1");
    const t = setTimeout(() => {
      const id = engine.current?.decide({ type: "landing", returning }, latest.current.busy());
      if (id) {
        store.set(session, "jv-greeted", "1");
        latest.current.show(id);
      }
    }, 1200);
    const onGesture = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.(".greet-mute, .greet-x")) return;
      if (unlocked.current) return;
      unlocked.current = true;
      const p = pendingSpeech.current;
      pendingSpeech.current = null;
      if (p) latest.current.say(p);
    };
    addEventListener("pointerup", onGesture, true);
    addEventListener("keydown", onGesture, true);
    return () => {
      clearTimeout(t);
      removeEventListener("pointerup", onGesture, true);
      removeEventListener("keydown", onGesture, true);
    };
  }, []);

  // lingering on a station
  useEffect(() => {
    const t = setTimeout(() => {
      const id = engine.current?.decide({ type: "dwell", station }, busy() || open);
      if (id) show(id);
    }, DWELL_MS);
    return () => clearTimeout(t);
  }, [station, busy, open, show]);

  // moving to leave (desktop)
  useEffect(() => {
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return;
      const id = engine.current?.decide({ type: "exit" }, busy());
      if (id) show(id, false); // no voice on the way out; it would startle
    };
    document.addEventListener("mouseout", onOut);
    return () => document.removeEventListener("mouseout", onOut);
  }, [busy, show]);

  useEffect(() => {
    if (j.open) setOpen(false);
  }, [j.open]);

  const close = () => {
    stopTour();
    setOpen(false);
    engine.current?.setEngaged(false);
    j.stopSpeaking();
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    store.set(local, "jv-greet-voice", m ? "off" : "on");
    if (m) j.stopSpeaking();
    else if (line) {
      unlocked.current = true;
      say(line);
    }
  };

  const text = line ? displayText(fill(line.text, { name: j.visitor?.name, greet: greet() })) : "";
  // memory: an unfinished tour can be picked up again, this visit or the next
  const savedStop = Number(store.get(local, "jv-tour") ?? "NaN");
  const canResume = tour === null && savedStop > 0 && savedStop < TOUR.length;
  const RESUME: Chip = { label: `Resume the tour (stop ${savedStop + 1})`, action: "run_tour" };
  const chips: Chip[] =
    line?.stage === "tour" && tour === null && line.chips.length === 0
      ? [RESUME, { label: "Book 30 minutes", next: "close.call" }]
      : line?.id === "open.return" && canResume
        ? [RESUME, ...line.chips]
        : (line?.chips ?? []);
  const state = tour !== null ? `PROTOCOL · TOUR ${tour + 1}/${TOUR.length}` : j.status === "speaking" ? "SPEAKING" : "ONLINE";
  return (
    <AnimatePresence>
      {open && line && (
        <motion.section
          key="concierge"
          className="greet concierge"
          aria-label="Jarvis"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          data-testid="greeting"
          data-line={line.id}
        >
          <div className="greet-who">
            <i aria-hidden className={j.status === "speaking" ? "talking" : ""} /> JARVIS
            <span className="greet-state" data-testid="jarvis-state">
              {state}
            </span>
            <button type="button" className="greet-x" aria-label="Close" onClick={close}>
              ✕
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={line.id} role="status" aria-live="polite" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {text}
            </motion.p>
          </AnimatePresence>
          {tour !== null && (
            <div className="greet-proto" aria-hidden>
              <i style={{ width: `${((tour + 1) / TOUR.length) * 100}%` }} />
            </div>
          )}
          <div className="greet-chips">
            {chips.map((c) => (
              <button key={c.label} type="button" className={c.next === "close.call" ? "greet-go" : ""} onClick={() => choose(c)} data-testid={`chip-${c.label}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="greet-row">
            {(canSpeak() || studio) && (
              <button type="button" className="greet-mute" onClick={toggleMute} aria-pressed={muted} data-testid="greet-mute">
                {muted ? "🔇 Voice off" : "🔊 Voice on"}
              </button>
            )}
            {studio && (
              <span className="greet-credit" data-testid="voice-credit">
                {studio.credit}
              </span>
            )}
            {tour !== null ? (
              <button type="button" className="greet-later" onClick={stopTour} data-testid="tour-stop">
                Stop the tour
              </button>
            ) : (
              <button type="button" className="greet-later" onClick={() => run("snooze")}>
                Not now
              </button>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
