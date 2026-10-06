// The brief, parsed into citable chunks, plus a small BM25 index over them.
// Pure TypeScript with no browser or Vite imports, so scripts/eval.ts can run it in Node.

export interface Chunk {
  id: number;
  /** Heading path, e.g. "Experience › Strategic Finance Lead — Turnkey Services Pro…" */
  section: string;
  text: string;
  tokens: string[];
}

export interface Hit {
  chunk: Chunk;
  score: number;
}

const STOP = new Set(
  ("a an and are as at be been but by can could did do does for from had has have he her his how i in " +
    "into is it its me my of on or our she so than that the their them then there these they this to " +
    "was we were what when where which who whom why will with would you your about tell does did any " +
    "siddharth bagga him").split(" "),
);

// Recruiter vocabulary mapped onto the words the brief actually uses.
const SYNONYMS: Record<string, string[]> = {
  job: ["experience", "role"],
  jobs: ["experience", "role"],
  work: ["experience"],
  worked: ["experience"],
  career: ["experience"],
  school: ["education", "university"],
  college: ["education", "university"],
  degree: ["education", "m.s"],
  study: ["education"],
  certification: ["credential", "certificate"],
  certifications: ["credential", "certificate"],
  cert: ["credential", "certificate"],
  skill: ["tool"],
  skills: ["tool"],
  software: ["tool"],
  stack: ["tool"],
  hobby: ["outside", "travel", "fitness"],
  hobbies: ["outside", "travel", "fitness"],
  interests: ["outside", "travel", "learn"],
  weakness: ["gap"],
  weaknesses: ["gap"],
  deal: ["acquisition", "pipeline"],
  deals: ["acquisition", "pipeline"],
  m: ["acquisition"],
  valuation: ["dcf", "valu"],
  model: ["dcf", "model"],
  located: ["based", "cincinnati"],
  live: ["based", "cincinnati"],
  relocate: ["relocat", "new york"],
};

export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string, expand = false): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/s&p/g, "spgi")
    .match(/[a-z0-9$%.+&]+/g);
  if (!raw) return [];
  const out: string[] = [];
  for (const r of raw) {
    const t = r.replace(/^[.]+|[.]+$/g, "");
    if (!t || STOP.has(t)) continue;
    out.push(stem(t));
    if (expand) for (const s of SYNONYMS[t] ?? []) out.push(...s.split(" ").map(stem));
  }
  return out;
}

export function parseBrief(markdown: string): Chunk[] {
  const chunks: Chunk[] = [];
  let h2 = "";
  let h3 = "";
  let current: { section: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.lines.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      const id = chunks.length;
      chunks.push({ id, section: current.section, text, tokens: tokenize(`${current.section} ${text}`) });
    }
    current = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      flush();
      h2 = line.slice(3).replace(/\(.*?\)/g, "").trim();
      h3 = "";
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      h3 = line.slice(4).trim();
      continue;
    }
    if (!h2) continue; // preamble is for maintainers, not visitors
    if (/^\s*- /.test(line)) {
      flush();
      current = { section: h3 ? `${h2} › ${h3}` : h2, lines: [line.replace(/^\s*- /, "")] };
    } else if (current && line.trim()) {
      current.lines.push(line.trim());
    } else {
      flush();
    }
  }
  flush();
  return chunks;
}

export class Index {
  readonly chunks: Chunk[];
  private df = new Map<string, number>();
  private avgLen: number;

  constructor(chunks: Chunk[]) {
    this.chunks = chunks;
    for (const c of chunks) for (const t of new Set(c.tokens)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = chunks.reduce((s, c) => s + c.tokens.length, 0) / Math.max(1, chunks.length);
  }

  search(query: string, k = 4): Hit[] {
    const q = tokenize(query, true);
    if (!q.length) return [];
    const N = this.chunks.length;
    const k1 = 1.4;
    const b = 0.7;
    const hits: Hit[] = [];
    for (const c of this.chunks) {
      let score = 0;
      for (const term of new Set(q)) {
        const tf = c.tokens.filter((t) => t === term || (term.length >= 5 && t.startsWith(term))).length;
        if (!tf) continue;
        const df = this.df.get(term) ?? 1;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * c.tokens.length) / this.avgLen));
      }
      if (score > 0) hits.push({ chunk: c, score });
    }
    return hits.sort((a, z) => z.score - a.score).slice(0, k);
  }

  bySection(prefix: string): Chunk[] {
    return this.chunks.filter((c) => c.section.startsWith(prefix));
  }
}
