import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 140, damping: 20 } },
};

/** One station of the film. Children marked with `variants={rise}` stagger in when it enters view. */
export function Panel({ id, label, children, className = "" }: { id: string; label: string; children: ReactNode; className?: string }) {
  return (
    <motion.section
      id={id}
      className={`panel ${className}`}
      aria-label={label}
      data-station={id}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ amount: 0.35, once: false }}
    >
      {children}
    </motion.section>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <motion.div className="kicker" variants={rise}>
      {children}
    </motion.div>
  );
}
