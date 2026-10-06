import { motion } from "framer-motion";
import { useEffect } from "react";
import { City } from "./City.tsx";
import { Graph } from "./Graph.tsx";
import { BrainConsole } from "../brain/BrainConsole.tsx";
import { loadAnalytics, track } from "../lib/track.ts";

const BASE: string = import.meta.env.BASE_URL;

export function ResearchHQ() {
  useEffect(() => {
    loadAnalytics();
    track("page_view", { page: "research" }, true);
  }, []);
  return (
    <div className="lab hq">
      <header className="nav">
        <a className="nav-id" href={BASE}>
          <span className="mono-mark" aria-hidden>
            SB
          </span>
          <span className="nav-name">
            Research HQ
            <em>Siddharth Bagga · research</em>
          </span>
        </a>
        <nav className="nav-links" aria-label="Research HQ">
          <a href="#city">City</a>
          <a href="#brain">Brain</a>
          <a href="#graph">Graph</a>
          <a href={`${BASE}lab/`}>Strategy Lab</a>
          <a href={`${BASE}deal/`}>Deal Lab</a>
        </nav>
        <div className="nav-cta">
          <a className="nav-btn" href={BASE}>
            ← Portfolio
          </a>
          <a className="nav-btn hot" href={`${BASE}#connect`}>
            Get in touch
          </a>
        </div>
      </header>
      <main className="lab-main">
        <motion.section className="lab-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="kicker">Research HQ · projects as infrastructure</div>
          <h1>
            The research <em>city</em>
          </h1>
          <p className="sub">
            Every project is a building and every lit floor a shipped milestone; scaffolding is what's still under construction. Every bot is a real
            automated job: a scheduled search, a CI test run, a release gate or a reproducible script. At the centre, the Brain evolves trading strategies
            every six hours against a holdout it is never allowed to see.
          </p>
        </motion.section>

        <section id="city" className="hq-sec">
          <h2 className="vh">The research city</h2>
          <City />
        </section>

        <section id="brain" className="hq-sec">
          <div className="kicker">The Brain · self-evolving search</div>
          <h2 className="sec">Mutate → test → rate → remember</h2>
          <p className="hq-lede">
            Each run picks a hypothesis by UCB1, mutates its best strategy, backtests the children on 2016–2021 data only, scores them out of 100, and plays
            each challenger against the champion fold by fold with Elo ratings. Losers are logged with the reason they lost, and that reason steers the next
            mutation.
          </p>
          <BrainConsole />
        </section>

        <section id="graph" className="hq-sec">
          <div className="kicker">Research vault · knowledge graph</div>
          <h2 className="sec">How the work connects</h2>
          <p className="hq-lede">
            My research notes are an Obsidian vault in four folders: core theses, data pipelines, models and simulations, and peer-review logs of what I got
            wrong. Click a node to read the note; filter by tag; drag to pan.
          </p>
          <Graph />
        </section>
      </main>
    </div>
  );
}
