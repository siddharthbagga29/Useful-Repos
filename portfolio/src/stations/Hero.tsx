import { motion } from "framer-motion";
import { Panel, rise } from "../ui/Panel.tsx";
import { CONTACT } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";

const HUD: [string, string][] = [
  ["CLASS", "Valuation & Diligence Analyst"],
  ["LEVEL", "Associate"],
  ["XP", "14 months · 11 full-time"],
  ["SPAWNED", "May 2025 · M.S. Fin. Math"],
  ["PERKS", "Financial Math · Monte Carlo · Valuation"],
];

export function Hero() {
  return (
    <Panel id="hero" label="Introduction">
      <motion.div className="avail" variants={rise}>
        <span className="pulse" aria-hidden />
        {CONTACT.availability}
      </motion.div>
      <motion.h1 className="mega" variants={rise}>
        Siddharth
        <br />
        <em>Bagga</em>
      </motion.h1>
      <motion.p className="sub" variants={rise}>
        Diligence and valuation analyst for private capital, with an M.S. in Financial Mathematics. For a Managing Partner deploying it, I built
        the <b>evidence behind every go/no-go</b>: normalized earnings, downside cases, and the memo. I want to do that work for families and
        principals who think in decades.
      </motion.p>
      <motion.dl className="hud" variants={rise}>
        {HUD.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </motion.dl>
      <motion.div className="row" variants={rise}>
        <motion.button className="cta hot" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => bus.emit({ type: "open_connect" })} data-testid="hero-connect">
          Get in touch
        </motion.button>
        <motion.a className="cta" href={CONTACT.resume} target="_blank" rel="noopener" whileHover={{ scale: 1.04 }} data-testid="hero-resume">
          Résumé (PDF)
        </motion.a>
        <motion.button className="cta" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => bus.emit({ type: "open_jarvis" })}>
          Talk to my Jarvis
        </motion.button>
        <motion.a className="cta" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.04 }}>
          LinkedIn ↗
        </motion.a>
      </motion.div>
    </Panel>
  );
}
