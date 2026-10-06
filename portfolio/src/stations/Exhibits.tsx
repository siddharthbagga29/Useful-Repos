import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { EXHIBITS } from "../data/site.ts";

export function Exhibits() {
  return (
    <Panel id="exhibits" label="Exhibits">
      <Kicker>Station 04 · exhibits</Kicker>
      <motion.h2 className="sec" variants={rise}>
        Every claim has a file
      </motion.h2>
      <motion.div className="worklist" variants={rise}>
        {EXHIBITS.map((e, i) => (
          <motion.a key={e.id} className="work" href={e.url} target="_blank" rel="noopener noreferrer" whileHover="hover" initial="rest" animate="rest">
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <motion.span className="ttl" variants={{ rest: { x: 0 }, hover: { x: 14, color: "var(--hot)" } }}>
              {e.title}
            </motion.span>
            <motion.span className="meta" variants={{ rest: { opacity: 0.7 }, hover: { opacity: 1 } }}>
              {e.kind} ↗
            </motion.span>
            <motion.i className="underline" variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }} />
          </motion.a>
        ))}
      </motion.div>
    </Panel>
  );
}
