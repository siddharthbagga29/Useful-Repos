import { motion } from "framer-motion";
import { CONTACT, STATIONS, type StationId } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";

const LINKS: { id: StationId; label: string }[] = [
  { id: "experience", label: "Experience" },
  { id: "model", label: "Model" },
  { id: "dealroom", label: "Deal room" },
  { id: "exhibits", label: "Work" },
  { id: "jarvis", label: "Jarvis" },
];

/** Always-visible navigation: who this is, where to go, and the two actions that matter. */
export function Nav({ active }: { active: StationId }) {
  return (
    <header className="nav">
      <a
        className="nav-id"
        href="#hero"
        onClick={(e) => {
          e.preventDefault();
          bus.emit({ type: "navigate", station: "hero" });
        }}
      >
        <span className="mono-mark" aria-hidden>
          SB
        </span>
        <span className="nav-name">
          Siddharth Bagga
          <em>Valuation · CDD</em>
        </span>
      </a>
      <nav className="nav-links" aria-label="Sections">
        {LINKS.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            aria-current={active === l.id ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              bus.emit({ type: "navigate", station: l.id });
            }}
          >
            {l.label}
            {active === l.id && <motion.i layoutId="nav-underline" className="nav-u" />}
          </a>
        ))}
      </nav>
      <div className="nav-cta">
        <a className="nav-btn" href={CONTACT.resume} target="_blank" rel="noopener" data-testid="nav-resume">
          Résumé
        </a>
        <motion.button className="nav-btn hot" whileTap={{ scale: 0.95 }} onClick={() => bus.emit({ type: "open_connect" })} data-testid="nav-connect">
          Get in touch
        </motion.button>
      </div>
    </header>
  );
}

export const STATION_IDS = STATIONS.map((s) => s.id);
