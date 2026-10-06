import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useJarvis } from "./JarvisProvider.tsx";
import { JarvisConsole } from "./JarvisConsole.tsx";
import { Orb } from "./Orb.tsx";

/** Full-screen Jarvis (deep link: /#jarvis) plus the floating launcher that opens it from anywhere. */
export function JarvisOverlay() {
  const j = useJarvis();

  useEffect(() => {
    if (!j.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && j.setOpen(false);
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [j.open, j]);

  return (
    <>
      <AnimatePresence>
        {!j.open && (
          <motion.button
            className="launcher"
            onClick={() => j.setOpen(true)}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Talk to Jarvis"
          >
            <Orb status={j.status} size={30} />
            <span>
              Ask Jarvis
              <kbd>⌘K</kbd>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {j.open && (
          <motion.div
            className="overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Jarvis console"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && j.setOpen(false)}
          >
            <motion.div
              className="overlay-panel"
              initial={{ y: 40, scale: 0.96, opacity: 0, filter: "blur(6px)" }}
              animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: 30, scale: 0.97, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              <JarvisConsole variant="full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
