import { motion } from "framer-motion";
import { useEffect } from "react";
import { City } from "./City.tsx";
import { SiteNav } from "./SiteNav.tsx";
import { WorkIndex } from "./WorkIndex.tsx";
import { Graph } from "./Graph.tsx";
import { BrainConsole } from "../brain/BrainConsole.tsx";
import { loadAnalytics, track } from "../lib/track.ts";


export function ResearchHQ() {
  useEffect(() => {
    loadAnalytics();
    track("page_view", { page: "research" }, true);
  }, []);
  return (
    <div className="lab hq">
      <SiteNav current="city" />
      <main className="lab-main">
        <motion.section className="lab-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="kicker">Research HQ · research operations</div>
          <h1>
            The research <em>city</em>
          </h1>
          <p className="sub">
            Eight projects, one inventory. Each building is a project and each floor a milestone, drawn by the strength of its evidence: lit when it can be
            checked in the repository, hatched when it's claimed but not verified here, scaffolding when it's planned. The city is still unless something
            real happens: a GitHub Actions run, a commit, a check at build time, or data going stale. At the centre, the Brain re-runs its strategy search
            every six hours on a fixed data snapshot; a successful run means the job worked, not that its champion is validated.
          </p>
        </motion.section>

        <section id="city" className="hq-sec">
          <h2 className="vh">The research city</h2>
          <City />
        </section>

        <section id="work" className="hq-sec">
          <div className="kicker">All work · by discipline</div>
          <h2 className="sec">Case studies</h2>
          <p className="hq-lede">The same eight projects as plain pages: problem, data, method, results, validation, limitations and how to reproduce each one.</p>
          <WorkIndex />
        </section>

        <section id="brain" className="hq-sec">
          <div className="kicker">The Brain · self-evolving search</div>
          <h2 className="sec">Mutate → test → rate → remember</h2>
          <p className="hq-lede">
            Every six hours on GitHub Actions, against the same weekly snapshot (no automated data refresh). Each run picks a hypothesis by UCB1, mutates its best strategy, backtests the children on 2016–2021 data only, scores them out of 100, and plays
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
