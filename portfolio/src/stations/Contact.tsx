import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { CONTACT } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";
import { CopyEmail } from "../ui/Connect.tsx";
import { Schedule } from "../ui/Schedule.tsx";

const PATHS = [
  { intent: "hiring" as const, title: "Building a team?", text: "Family office, private wealth or LMM PE seat. Interview request, pre-written.", cta: "Request an interview" },
  { intent: "network" as const, title: "Connecting?", text: "A coffee or a call — principals, advisors, operators, alumni.", cta: "Start a conversation" },
  { intent: "deal" as const, title: "Compare notes?", text: "A deal, a thesis or a model you want pressure-tested in conversation.", cta: "Talk shop" },
];

export function Contact() {
  return (
    <Panel id="contact" label="Contact">
      <Kicker>Where this goes</Kicker>
      <motion.h2 className="mega mega-sm" variants={rise}>
        Patient capital <em>next</em>
      </motion.h2>
      <motion.p className="sub" variants={rise}>
        Family offices, private wealth, lower-middle-market private equity. Relocating to New York for the right seat. Every message gets a reply.
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
      <Schedule />
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
