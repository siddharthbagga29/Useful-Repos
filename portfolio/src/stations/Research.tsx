import { motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";

const City = lazy(() => import("../research/City.tsx").then((m) => ({ default: m.City })));
const BASE: string = import.meta.env.BASE_URL;

// Research as a city: every building a project, every floor a milestone, every bot a real automated job.
// The city loads when the visitor gets within a screen of it, and its bots rest when it's out of view.
export function Research() {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setNear(!!e?.isIntersecting);
      if (e?.isIntersecting) setSeen(true);
    }, { rootMargin: "60% 60% 60% 60%" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Panel id="research" label="Credibility and research" className="panel-research">
      <motion.div className="rs-head" variants={rise}>
        <div>
          <Kicker>Credibility &amp; research</Kicker>
          <h2 className="sec">The research city</h2>
        </div>
        <p>
          Each building is a project and each lit floor a shipped milestone; scaffolding is what's left. Every bot is a real automated job, and the Brain
          at the centre evolves strategies around the clock. Click any building.{" "}
          <a href={`${BASE}research/`} className="rs-more">
            Open Research HQ ↗
          </a>
        </p>
      </motion.div>
      <motion.div variants={rise} className="rs-city" ref={box}>
        {seen ? (
          <Suspense fallback={<div className="rs-loading">Raising the city…</div>}>
            <City compact active={near} />
          </Suspense>
        ) : (
          <div className="rs-loading">Raising the city…</div>
        )}
      </motion.div>
    </Panel>
  );
}
