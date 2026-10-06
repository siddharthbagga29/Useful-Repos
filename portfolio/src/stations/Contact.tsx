import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { CONTACT } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";

export function Contact() {
  return (
    <Panel id="contact" label="Contact">
      <Kicker>Where this goes</Kicker>
      <motion.h2 className="mega" variants={rise}>
        Wall
        <br />
        Street
        <br />
        <em>Next</em>
      </motion.h2>
      <motion.p className="sub" variants={rise}>
        Commercial due diligence, valuation, strategy. Relocating for the right desk.
        <br />
        <a href={`mailto:${CONTACT.email}`}>
          <b>{CONTACT.email}</b>
        </a>{" "}
        ·{" "}
        <a href={CONTACT.phoneHref}>
          <b>{CONTACT.phone}</b>
        </a>
      </motion.p>
      <motion.div className="row" variants={rise}>
        <motion.a className="cta hot" href={`mailto:${CONTACT.email}`} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          Email me
        </motion.a>
        <motion.a className="cta" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.04 }}>
          LinkedIn ↗
        </motion.a>
        <motion.button className="cta" onClick={() => bus.emit({ type: "open_jarvis", agent: "digest" })} whileHover={{ scale: 1.04 }}>
          Ask Jarvis
        </motion.button>
      </motion.div>
      <motion.p className="foot" variants={rise}>
        Built with React 19 and Framer Motion. Jarvis is my own build: Web Speech for voice, a retrieval engine over my brief, and an optional on-device LLM on WebGPU. Free to run, private by design.
      </motion.p>
    </Panel>
  );
}
