import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { CONTACT } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";
import { CopyEmail } from "../ui/Connect.tsx";

const PATHS = [
  { intent: "hiring" as const, title: "Hiring?", text: "Interview request, pre-written. Add your name and send.", cta: "Request an interview" },
  { intent: "network" as const, title: "Networking?", text: "Coffee chat or a call to trade notes on deals.", cta: "Start a conversation" },
  { intent: "deal" as const, title: "Project?", text: "Diligence, valuation or modelling support.", cta: "Describe the project" },
];

export function Contact() {
  return (
    <Panel id="contact" label="Contact">
      <Kicker>Where this goes</Kicker>
      <motion.h2 className="mega mega-sm" variants={rise}>
        Wall Street <em>Next</em>
      </motion.h2>
      <motion.p className="sub" variants={rise}>
        Commercial due diligence, valuation, strategy. Relocating to New York for the right desk. Every message gets a reply.
      </motion.p>
      <motion.div className="paths" variants={rise}>
        {PATHS.map((p) => (
          <motion.button key={p.intent} className="path" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => bus.emit({ type: "open_connect", intent: p.intent })} data-testid={`path-${p.intent}`}>
            <b>{p.title}</b>
            <span>{p.text}</span>
            <em>{p.cta} →</em>
          </motion.button>
        ))}
      </motion.div>
      <motion.div className="direct" variants={rise}>
        <div>
          <span className="lbl">Email</span>
          <span className="val" data-testid="contact-email">
            {CONTACT.email}
          </span>
        </div>
        <div>
          <span className="lbl">Phone</span>
          <a className="val" href={CONTACT.phoneHref}>
            {CONTACT.phone}
          </a>
        </div>
        <div className="row">
          <CopyEmail className="chip" />
          <a className="chip" href={CONTACT.vcard} download="Siddharth-Bagga.vcf" data-testid="contact-vcard">
            Save contact
          </a>
          <a className="chip" href={CONTACT.resume} target="_blank" rel="noopener">
            Résumé PDF
          </a>
          <a className="chip" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn ↗
          </a>
        </div>
      </motion.div>
      <motion.p className="foot" variants={rise}>
        Built with React 19 and Framer Motion. Jarvis is my own build: Web Speech for voice, a retrieval engine over my brief, and an optional on-device LLM on WebGPU.
      </motion.p>
    </Panel>
  );
}
