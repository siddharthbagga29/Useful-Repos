import { motion, useReducedMotion } from "framer-motion";
import type { Status } from "./JarvisProvider.tsx";

const COLORS: Record<Status, string> = {
  idle: "var(--hot)",
  armed: "var(--amber)",
  listening: "var(--grn)",
  thinking: "var(--cyan)",
  speaking: "var(--hot)",
};

/** Jarvis's face: concentric rings whose motion tells you what it's doing. */
export function Orb({ status, size = 56 }: { status: Status; size?: number }) {
  const reduce = useReducedMotion();
  const c = COLORS[status];
  const active = status === "listening" || status === "speaking";
  return (
    <div className="orb" style={{ width: size, height: size }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="orb-ring"
          style={{ borderColor: c }}
          animate={
            reduce
              ? { opacity: 0.5 }
              : active
                ? { scale: [1, 1.5 + i * 0.18], opacity: [0.7, 0] }
                : status === "thinking"
                  ? { rotate: 360, opacity: 0.6 - i * 0.15 }
                  : { scale: [1, 1.08, 1], opacity: 0.35 - i * 0.1 }
          }
          transition={
            active
              ? { duration: status === "listening" ? 1.1 : 1.5, repeat: Infinity, delay: i * 0.32, ease: "easeOut" }
              : status === "thinking"
                ? { duration: 1.2 + i * 0.4, repeat: Infinity, ease: "linear" }
                : { duration: 3.2, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }
          }
        />
      ))}
      <motion.span
        className="orb-core"
        style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${c} 55%, #0008)` }}
        animate={reduce ? {} : { scale: status === "speaking" ? [1, 1.12, 0.96, 1.08, 1] : status === "listening" ? [1, 1.06, 1] : 1 }}
        transition={{ duration: status === "speaking" ? 0.9 : 1.2, repeat: Infinity }}
      />
    </div>
  );
}
