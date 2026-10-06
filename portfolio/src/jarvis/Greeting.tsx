import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useJarvis } from "./JarvisProvider.tsx";
import { canSpeak } from "./speech.ts";

// Jarvis greets every new visitor. Browsers only allow speech after the visitor's first tap or key
// press, so the greeting appears as text at once and is spoken on that first gesture: once per visit,
// never when muted (the mute is remembered on this device).
export const GREETING = "Hello, you're in Siddharth's den. I'm Jarvis, his assistant. Ask me about his deals, his models, or his research.";

const get = (s: Storage | undefined, k: string) => {
  try {
    return s?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const put = (s: Storage | undefined, k: string, v: string) => {
  try {
    s?.setItem(k, v);
  } catch {
    /* private mode */
  }
};
const session = typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
const local = typeof localStorage !== "undefined" ? localStorage : undefined;

export function Greeting() {
  const j = useJarvis();
  const [show, setShow] = useState(false);
  const [muted, setMuted] = useState(() => get(local, "jv-greet-voice") === "off");
  const spoken = useRef(get(session, "jv-greeted") === "1");
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    if (spoken.current || /^#(jarvis|connect)$/.test(location.hash)) return;
    const t = setTimeout(() => setShow(true), 1200);
    const hide = setTimeout(() => setShow(false), 16000);
    const onGesture = (e: Event) => {
      if (spoken.current) return;
      if ((e.target as HTMLElement | null)?.closest?.(".greet-mute, .greet-x")) return;
      spoken.current = true;
      put(session, "jv-greeted", "1");
      if (!mutedRef.current && canSpeak()) j.speak(GREETING);
      off();
    };
    const off = () => {
      removeEventListener("pointerup", onGesture, true);
      removeEventListener("keydown", onGesture, true);
    };
    addEventListener("pointerup", onGesture, true);
    addEventListener("keydown", onGesture, true);
    return () => {
      clearTimeout(t);
      clearTimeout(hide);
      off();
    };
  }, []);

  useEffect(() => {
    if (j.open) setShow(false);
  }, [j.open]);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    put(local, "jv-greet-voice", m ? "off" : "on");
    if (m) j.stopSpeaking();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="greet" role="status" aria-live="polite" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} data-testid="greeting">
          <div className="greet-who">
            <i aria-hidden /> JARVIS
          </div>
          <p>{GREETING}</p>
          <div className="greet-row">
            <button type="button" className="greet-go" onClick={() => (setShow(false), j.setOpen(true))}>
              Ask Jarvis
            </button>
            {canSpeak() && (
              <button type="button" className="greet-mute" onClick={toggleMute} aria-pressed={muted} data-testid="greet-mute">
                {muted ? "🔇 Voice off" : "🔊 Voice on"}
              </button>
            )}
            <button type="button" className="greet-x" aria-label="Dismiss" onClick={() => setShow(false)}>
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
