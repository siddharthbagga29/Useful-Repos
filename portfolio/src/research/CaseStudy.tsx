import { CASES, DEFAULT_ORDER, SECTION_TITLE, type Block, type SectionId } from "./cases.ts";
import { CATEGORIES, DISTRICTS, PROJECTS, caseRoute, currentMilestone, pending, unverified, type Project } from "./manifest.ts";
import { COLORS } from "./layout.ts";
import { EvidenceList, StatusBlock, Timeline } from "./City.tsx";
import { Module } from "./CaseModules.tsx";
import { useCityFeed, type Feed } from "./feed.ts";
import { SiteNav } from "./SiteNav.tsx";
import { REPO_URL } from "./sources.ts";

const BASE: string = import.meta.env.BASE_URL;

function Blocks({ blocks, feed }: { blocks: Block[]; feed: Feed }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "p":
            return (
              <p key={i} className="cs-p">
                {b.text}
              </p>
            );
          case "list":
            return (
              <ul key={i} className="cs-list">
                {b.items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="cs-steps">
                {b.items.map((x) => (
                  <li key={x}>
                    <code>{x}</code>
                  </li>
                ))}
              </ol>
            );
          case "formula":
            return (
              <div key={i} className="cs-formula">
                <code>{b.text}</code>
                {b.note && <small>{b.note}</small>}
              </div>
            );
          case "note":
            return (
              <p key={i} className={`cs-note ${b.tone}`} role="note">
                <b>{b.tone === "warn" ? "! Caveat" : "i Note"}</b> {b.text}
              </p>
            );
          case "table":
            return (
              <div key={i} className="cs-scroll" tabIndex={0} role="region" aria-label={`${b.caption ?? b.head.join(", ")} (scrolls sideways)`}>
                <table className="cs-table">
                  {b.caption && <caption>{b.caption}</caption>}
                  <thead>
                    <tr>
                      {b.head.map((h) => (
                        <th key={h} scope="col">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r) => (
                      <tr key={r.join("|")}>
                        <th scope="row">{r[0]}</th>
                        {r.slice(1).map((c, k) => (
                          <td key={k}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "flow":
            return (
              <figure key={i} className="cs-flow">
                <ol aria-label="Process, in order">
                  {b.nodes.map((n, k) => (
                    <li key={n}>
                      <span className="n">{k + 1}</span> {n}
                    </li>
                  ))}
                </ol>
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            );
          case "module":
            return <Module key={i} id={b.id} feed={feed} />;
        }
      })}
    </>
  );
}

function Missing() {
  return <p className="cs-missing">Not documented in this repository.</p>;
}

function Section({ id, n, p, feed }: { id: SectionId; n: number; p: Project; feed: Feed }) {
  const c = CASES[p.id];
  const blocks = c.sections[id];
  let body: React.ReactNode;
  if (id === "work") {
    const now = currentMilestone(p);
    body = (
      <>
        {now && (
          <p className="cs-p">
            Current milestone: <b>{now.label}</b>
          </p>
        )}
        <EvidenceList p={p} />
        <h3 className="cs-h3">Change and run history</h3>
        <Timeline feed={feed} project={p.id} limit={8} />
      </>
    );
  } else if (id === "limitations") {
    body = (
      <>
        <ul className="cs-list">
          {p.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {blocks && <Blocks blocks={blocks} feed={feed} />}
        {unverified(p).length > 0 && (
          <>
            <h3 className="cs-h3">Claims not verified here</h3>
            <ul className="cs-list">
              {unverified(p).map((m) => (
                <li key={m.label}>{m.label}</li>
              ))}
            </ul>
          </>
        )}
        {pending(p).length > 0 && (
          <>
            <h3 className="cs-h3">Planned, not built</h3>
            <ul className="cs-list">
              {pending(p).map((m) => (
                <li key={m.label}>{m.label}</li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  } else if (id === "links") {
    const src = p.sourcePublic === false ? [] : p.paths;
    body = (
      <>
        <div className="ds-links">
          {p.links.map((l) => (
            <a key={l.label} className="chip" href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}>
              {l.label} {l.href.startsWith("http") ? "↗" : "→"}
            </a>
          ))}
        </div>
        {src.length > 0 && (
          <>
            <h3 className="cs-h3">Source in the repository</h3>
            <ul className="cs-list mono">
              {src.map((path) => (
                <li key={path}>
                  <a href={`${REPO_URL}/tree/${feed.evidence.commit}/${path}`} target="_blank" rel="noopener noreferrer">
                    {path}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        {p.sourcePublic === false && <p className="cs-missing">Source not linked: the owner describes this code as private.</p>}
        {!p.links.length && !src.length && <Missing />}
      </>
    );
  } else body = blocks ? <Blocks blocks={blocks} feed={feed} /> : <Missing />;
  return (
    <section id={id} className="cs-sec" aria-labelledby={`h-${id}`}>
      <h2 id={`h-${id}`}>
        <span className="cs-n">{String(n).padStart(2, "0")}</span> {SECTION_TITLE[id]}
      </h2>
      {body}
    </section>
  );
}

export function CaseStudy({ id }: { id: string }) {
  const feed = useCityFeed();
  const p = PROJECTS.find((x) => x.id === id);
  if (!p)
    return (
      <div className="lab hq cs">
        <SiteNav />
        <main className="lab-main">
          <h1>Project not found</h1>
          <p>
            <a href={`${BASE}research/`}>Back to the Research City</a>
          </p>
        </main>
      </div>
    );
  const c = CASES[p.id];
  const order = c.order ?? DEFAULT_ORDER;
  const k = PROJECTS.indexOf(p);
  const prev = PROJECTS[(k + PROJECTS.length - 1) % PROJECTS.length]!;
  const next = PROJECTS[(k + 1) % PROJECTS.length]!;
  return (
    <div className="lab hq cs" style={{ ["--c" as string]: COLORS[p.id] }}>
      <SiteNav current={p.category} />
      <main className="lab-main cs-main">
        <nav className="cs-crumbs" aria-label="Breadcrumb">
          <a href={`${BASE}research/#city`}>Research City</a> / <a href={`${BASE}research/#work-${p.category}`}>{CATEGORIES[p.category]}</a> / <span aria-current="page">{p.title}</span>
        </nav>
        <header className="cs-head">
          <div className="kicker">
            {c.kind} · {DISTRICTS[p.district]}
          </div>
          <h1 data-testid="case-title">{p.title}</h1>
          <p className="sub">{p.summary}</p>
          <div className="cs-status">
            <StatusBlock p={p} feed={feed} />
          </div>
        </header>
        <div className="cs-body">
          <nav className="cs-toc" aria-label="Sections">
            <ol>
              {order.map((s, i) => (
                <li key={s}>
                  <a href={`#${s}`}>
                    <span className="cs-n">{String(i + 1).padStart(2, "0")}</span> {SECTION_TITLE[s]}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="cs-article">
            {order.map((s, i) => (
              <Section key={s} id={s} n={i + 1} p={p} feed={feed} />
            ))}
            <nav className="cs-next" aria-label="More case studies">
              <a href={caseRoute(prev.id)}>← {prev.title}</a>
              <a href={`${BASE}research/#city`}>All projects</a>
              <a href={caseRoute(next.id)}>{next.title} →</a>
            </nav>
          </article>
        </div>
      </main>
    </div>
  );
}
