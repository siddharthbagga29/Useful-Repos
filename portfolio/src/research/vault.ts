// Loads the Obsidian vault (portfolio/vault) at build time and turns it into a graph.

const RAW = import.meta.glob("../../vault/**/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export type Folder = "thesis" | "data" | "model" | "review" | "reference";

export const FOLDERS: Record<Folder, { label: string; dir: string; color: string }> = {
  thesis: { label: "Core theses", dir: "00_CORE_THESES", color: "#ff5a1f" },
  data: { label: "Data pipelines", dir: "01_DATA_PIPELINES", color: "#22d3ee" },
  model: { label: "Models & simulations", dir: "02_MODELS_AND_SIMULATIONS", color: "#a78bfa" },
  review: { label: "Peer-review logs", dir: "03_PEER_REVIEW_LOGS", color: "#fbbf24" },
  reference: { label: "References", dir: "04_REFERENCES", color: "#94a3b8" },
};

export interface Note {
  id: string; // file name without .md, the Obsidian link target
  folder: Folder;
  tags: string[];
  body: string;
  links: string[];
}

function parse(path: string, raw: string): Note | null {
  const parts = path.split("/");
  const dir = parts[parts.length - 2]!;
  const folder = (Object.keys(FOLDERS) as Folder[]).find((f) => FOLDERS[f].dir === dir);
  if (!folder) return null;
  const id = parts[parts.length - 1]!.replace(/\.md$/, "");
  let body = raw.replace(/\r\n/g, "\n");
  let tags: string[] = [];
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    const t = fm[1]!.match(/tags:\s*\[([^\]]*)\]/);
    if (t) tags = t[1]!.split(",").map((x) => x.trim()).filter(Boolean);
    body = body.slice(fm[0].length);
  }
  const links = [...new Set([...body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => m[1]!.trim()))];
  return { id, folder, tags, body: body.trim(), links };
}

export const NOTES: Note[] = Object.entries(RAW)
  .map(([p, r]) => parse(p, r))
  .filter((n): n is Note => !!n)
  .sort((a, b) => a.id.localeCompare(b.id));

const ids = new Set(NOTES.map((n) => n.id));
export const EDGES: [string, string][] = NOTES.flatMap((n) => n.links.filter((l) => ids.has(l) && l !== n.id).map((l) => [n.id, l] as [string, string]));
export const TAGS: string[] = [...new Set(NOTES.flatMap((n) => n.tags))].filter((t) => !["thesis", "reference", "review"].includes(t)).sort();
