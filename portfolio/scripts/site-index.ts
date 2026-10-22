// Everything on the site, as one searchable index for Jarvis on Siddharth's Mac (and any page that
// wants it): every page, station, project, bot, milestone, exhibit, research note and the brief,
// each with the URL where a person can see it. Built from the same sources the site renders, so
// it can't drift. Runs in `npm run build`; writes public/jarvis/site-index.json (all public data).

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTACT, EXHIBITS, SITE_URL, STATIONS } from "../src/data/site.ts";
import { CATEGORIES, DISTRICTS, EVIDENCE_LABEL, KIND_LABEL, PROJECTS, caseRoute, pending, progress, shipped } from "../src/research/manifest.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
type Entry = { id: string; kind: string; title: string; url: string; text: string };
const out: Entry[] = [];
const abs = (href: string) => (href.startsWith("http") ? href : new URL(href.replace(/^\//, ""), SITE_URL).toString());

// pages and stations
const PAGES: [string, string, string][] = [
  ["page.home", "Portfolio home", "Siddharth Bagga's portfolio: hero, numbers, track record, terminal, live DCF model, deal room, exhibits, research city, Jarvis and contact."],
  ["page.lab", "Strategy Lab (/lab/)", "Research sandbox on weekly ETF data 2015–2026: allocation rules, online portfolio selection replication, cost sweep, Monte Carlo."],
  ["page.deal", "Deal Lab (/deal/)", "Wholesale real-estate deal analyzer v2 with live Monte Carlo; the example deal is a NO-GO."],
  ["page.research", "Research HQ (/research/)", "The research city, the Brain's live log, the knowledge graph and the research vault."],
  ["page.twin", "Twin-Engine concept (/projects/twin-engine/)", "Family-office control room for US BRRRR and India flips, on illustrative sample data."],
];
const PAGE_URL: Record<string, string> = { "page.home": "", "page.lab": "lab/", "page.deal": "deal/", "page.research": "research/", "page.twin": "projects/twin-engine/" };
for (const [id, title, text] of PAGES) out.push({ id, kind: "page", title, url: abs(PAGE_URL[id] ?? ""), text });
for (const s of STATIONS) out.push({ id: `station.${s.id}`, kind: "station", title: `Home · ${s.label}`, url: abs(`#${s.id}`), text: `The ${s.label} section of the home page (${s.doing}).` });

// projects, their bots and milestones
for (const p of PROJECTS) {
  const done = shipped(p).map((m) => `${m.label} (${EVIDENCE_LABEL[m.evidence].toLowerCase()})`);
  const left = pending(p).map((m) => m.label);
  const unchecked = p.milestones.filter((m) => m.evidence === "unverified").map((m) => m.label);
  const links = p.links.map((l) => `${l.label}: ${abs(l.href)}`).join("; ");
  out.push({
    id: `project.${p.id}`,
    kind: "project",
    title: `${p.title} (${DISTRICTS[p.district]} · ${CATEGORIES[p.category]})`,
    url: abs(caseRoute(p.id)),
    text: `${p.summary} Progress ${Math.round(progress(p) * 100)}%. Built: ${done.join("; ")}. Still to build: ${left.join("; ") || "nothing"}. Not verified here: ${unchecked.join("; ") || "nothing"}. Data: ${p.data.label}. Limitations: ${p.limitations.join(" ")} Links: ${links || "none public"}.`,
  });
  for (const a of p.agents)
    out.push({ id: `bot.${p.id}.${a.name.toLowerCase().replace(/\W+/g, "-")}`, kind: "bot", title: `${a.name} · ${p.title}`, url: abs(caseRoute(p.id)), text: `${a.duty} Runs: ${KIND_LABEL[a.kind]}. Latest result: ${a.output}. ${a.verification === "verified" ? "Defined in the repository." : "Not verified from the repository."}` });
}

// exhibits and contact
for (const e of EXHIBITS) out.push({ id: `exhibit.${e.id}`, kind: "exhibit", title: e.title, url: e.url, text: `${e.kind} exhibit: ${e.title}.` });
out.push({ id: "contact", kind: "contact", title: "Contact", url: abs("#contact"), text: `Email ${CONTACT.email}. LinkedIn ${CONTACT.linkedin}. Résumé ${abs(CONTACT.resume)}.` });

// the brief, one entry per section
const brief = readFileSync(join(ROOT, "../jarvis/knowledge/brief.md"), "utf8");
for (const sec of brief.split(/\n(?=## )/).slice(1)) {
  const [head, ...body] = sec.split("\n");
  const title = head!.replace(/^##\s*/, "");
  out.push({ id: `brief.${title.toLowerCase().replace(/\W+/g, "-").slice(0, 40)}`, kind: "brief", title: `Brief · ${title}`, url: abs(""), text: body.join(" ").replace(/\s+/g, " ").trim() });
}

// research vault notes
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : n.endsWith(".md") ? [join(d, n)] : []));
for (const f of walk(join(ROOT, "vault"))) {
  const rel = relative(join(ROOT, "vault"), f);
  const body = readFileSync(f, "utf8").replace(/^---[\s\S]*?---\n/, "");
  out.push({ id: `note.${rel}`, kind: "note", title: `Research note · ${rel.replace(/\.md$/, "")}`, url: abs("research/#graph"), text: body.replace(/\s+/g, " ").trim().slice(0, 2000) });
}

const file = join(ROOT, "public/jarvis/site-index.json");
writeFileSync(file, `${JSON.stringify({ version: 1, site: SITE_URL, builtAt: new Date().toISOString(), entries: out }, null, 1)}\n`);
console.log(`site index: ${out.length} entries → ${relative(ROOT, file)}`);
