// Writes one static HTML entry per project, research/<id>/index.html, from the canonical manifest, so
// every case study is a real page with its own title, description and canonical URL (and works with
// JavaScript off, via the <noscript>-free fallback summary inside #root).
//   node --experimental-strip-types scripts/case-pages.ts

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATEGORIES, PROJECTS } from "../src/research/manifest.ts";

const ROOT = resolve(import.meta.dirname, "../research");
const SITE = "https://siddharthbagga29.github.io";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ids = new Set<string>(PROJECTS.map((p) => p.id));
for (const d of readdirSync(ROOT, { withFileTypes: true })) if (d.isDirectory() && !ids.has(d.name)) rmSync(resolve(ROOT, d.name), { recursive: true });

for (const p of PROJECTS) {
  const url = `${SITE}/research/${p.id}/`;
  const desc = p.summary.length > 300 ? `${p.summary.slice(0, 297)}…` : p.summary;
  const ld = { "@context": "https://schema.org", "@type": "CreativeWork", name: p.title, url, description: desc, genre: CATEGORIES[p.category], author: { "@type": "Person", name: "Siddharth Bagga", url: `${SITE}/` } };
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(p.title)} · case study | Siddharth Bagga</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="index, follow, noarchive" />
    <link rel="canonical" href="${url}" />
    <meta name="theme-color" content="#070a17" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(p.title)} — case study" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" />
    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
  </head>
  <body>
    <div id="root" data-project="${p.id}"><main style="max-width:760px;margin:0 auto;padding:120px 16px;font-family:monospace;color:#9aa3c7;background:#070a17"><h1 style="color:#eef1ff">${esc(p.title)}</h1><p>${esc(p.summary)}</p><p><a href="/research/" style="color:#22d3ee">Research City</a></p></main></div>
    <script type="module" src="/src/research/case.tsx"></script>
  </body>
</html>
`;
  mkdirSync(resolve(ROOT, p.id), { recursive: true });
  writeFileSync(resolve(ROOT, p.id, "index.html"), html);
}
console.log(`case pages: ${PROJECTS.length} written to research/<id>/index.html`);
