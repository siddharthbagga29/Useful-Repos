import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { Counter } from "../ui/Counter.tsx";

const STATS = [
  { to: 6, prefix: "$", suffix: "M+", k: "acquisition pipeline underwritten" },
  { to: 21, prefix: "$", suffix: "M", k: "upside equity case ($3.5M base)" },
  { to: 75, suffix: "%", k: "faster executive decisions, month one" },
  { to: 5, suffix: " mo", k: "to promotion" },
  { to: 6, prefix: "−", suffix: "%", k: "operating expenses" },
];

export function Numbers() {
  return (
    <Panel id="numbers" label="The numbers">
      <Kicker>The numbers</Kicker>
      <motion.h2 className="sec" variants={rise}>
        What 14 months of work produced
      </motion.h2>
      <motion.div className="statrow" variants={rise}>
        {STATS.map((s) => (
          <motion.div key={s.k} className="stat" whileHover={{ y: -4 }}>
            <div className="v">
              <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
            </div>
            <div className="k">{s.k}</div>
          </motion.div>
        ))}
      </motion.div>
      <motion.p className="sub" variants={rise}>
        Normalized EBITDA. <b>IRR/MOIC</b> at every entry and exit point. Purchase-price sensitivity. A seller's plan is a
        claim — <b>backlog is evidence</b>.
      </motion.p>
    </Panel>
  );
}
