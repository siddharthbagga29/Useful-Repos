import { motion } from "framer-motion";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { JarvisConsole } from "../jarvis/JarvisConsole.tsx";

export function JarvisStation() {
  return (
    <Panel id="jarvis" label="Jarvis" className="panel-jarvis">
      <Kicker>Station 05 · jarvis</Kicker>
      <motion.h2 className="sec" variants={rise}>
        My personal Jarvis
      </motion.h2>
      <motion.p className="sub" variants={rise}>
        Built by me, running <b>entirely in your browser</b>: voice in, voice out, agents, skills and memory. No servers, no
        API keys, <b>$0</b>. Answers are worked out on your device; voice uses your browser's own speech service.
      </motion.p>
      <motion.div variants={rise} className="jv-wrap">
        <JarvisConsole variant="station" />
      </motion.div>
    </Panel>
  );
}
