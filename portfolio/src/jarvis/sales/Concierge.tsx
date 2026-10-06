import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONTACT, type StationId } from "../../data/site.ts";
import { track } from "../../lib/track.ts";
import { bus } from "../bus.ts";
import { useJarvis } from "../JarvisProvider.tsx";
import { canSpeak } from "../speech.ts";
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
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  engine.current ??= new Proactive();

  const busy = useCallback(() => {
    const a = document.activeElement as HTMLElement | null;
    return j.open || !!document.querySelector(".cx-back, .pal-back") || !!a?.closest("input, textarea, select, [contenteditable]");
  }, [j.open]);

  const say = useCallback(
    (l: Line) => {
      if (mutedRef.current || !canSpeak()) return;
      if (!unlocked.current) {
        pendingSpeech.current = l;
        return;
      }
      j.speakScript(parseScript(fill(l.text, { name: j.visitor?.name })));
    },
    [j],
  );

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
      } else if (a === "snooze") {
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

  // the landing effect runs once; it reads the latest callbacks through this ref
  const latest = useRef({ show, busy, j });
  latest.current = { show, busy, j };

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
      const { j: jv } = latest.current;
      if (p && !mutedRef.current && canSpeak()) jv.speakScript(parseScript(fill(p.text, { name: jv.visitor?.name })));
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

  const text = line ? displayText(fill(line.text, { name: j.visitor?.name })) : "";
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
            <button type="button" className="greet-x" aria-label="Close" onClick={close}>
              ✕
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={line.id} role="status" aria-live="polite" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {text}
            </motion.p>
          </AnimatePresence>
          <div className="greet-chips">
            {line.chips.map((c) => (
              <button key={c.label} type="button" className={c.next === "close.call" ? "greet-go" : ""} onClick={() => choose(c)} data-testid={`chip-${c.label}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="greet-row">
            {canSpeak() && (
              <button type="button" className="greet-mute" onClick={toggleMute} aria-pressed={muted} data-testid="greet-mute">
                {muted ? "🔇 Voice off" : "🔊 Voice on"}
              </button>
            )}
            <button type="button" className="greet-later" onClick={() => run("snooze")}>
              Not now
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
