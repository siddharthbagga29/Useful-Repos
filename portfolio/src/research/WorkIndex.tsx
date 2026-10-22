import { CATEGORIES, DISTRICTS, NATURE_LABEL, PROJECTS, caseRoute, pending, shipped, type CategoryId } from "./manifest.ts";
import { COLORS } from "./layout.ts";
import { EXEC } from "./City.tsx";
import { useCityFeed } from "./feed.ts";

/** Every project as plain, ordered content: the portfolio still reads without the city or WebGL. */
export function WorkIndex() {
  const feed = useCityFeed();
  return (
    <div className="work-index">
      {(Object.keys(CATEGORIES) as CategoryId[]).map((c) => {
        const list = PROJECTS.filter((p) => p.category === c);
        if (!list.length) return null;
        return (
          <section key={c} id={`work-${c}`} className="wi-group" aria-labelledby={`wi-${c}`}>
            <h3 id={`wi-${c}`}>{CATEGORIES[c]}</h3>
            <ul>
              {list.map((p) => {
                const st = feed.states[p.id];
                const x = EXEC[st.execution];
                return (
                  <li key={p.id} style={{ ["--c" as string]: COLORS[p.id] }}>
                    <a href={caseRoute(p.id)} data-testid={`work-${p.id}`}>
                      <span className="wi-k">{DISTRICTS[p.district]}</span>
                      <b>{p.title}</b>
                      <span className="wi-nat" data-testid={`work-nature-${p.id}`}>
                        {p.nature.map((n) => NATURE_LABEL[n.kind]).join(" · ")}
                      </span>
                      <span className="wi-sum">{p.summary}</span>
                      <span className="wi-meta">
                        {shipped(p).length}/{p.milestones.length} milestones with evidence · {pending(p).length} planned
                        {p.pipeline !== "none" ? (
                          <span className={`t-${x.tone}`}>
                            {" "}
                            · {x.icon} {x.label}
                          </span>
                        ) : null}
                        {st.dataStale ? <span className="t-warn"> · ! data stale</span> : null}
                      </span>
                      <span className="wi-go">Case study →</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
