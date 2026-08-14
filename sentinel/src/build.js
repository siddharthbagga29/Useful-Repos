/* Build the six-page site.

   Every page is a real, separately addressable HTML file with its own <title>,
   description, canonical and structured data — because one scrolling page
   cannot rank for six different search intents, and a buyer who wants pricing
   should not have to scroll past a research dashboard to reach it.

   Every page is also completely self-contained: no CDN, no external stylesheet,
   no webfont, no runtime fetch, no 'unsafe-inline'. Open any one of them from a
   file:// URL with the network off and it works exactly as it does on a host.

   Payloads are selected per page rather than shipped everywhere. Chart.js is
   208 KB and only the research page draws charts, so only the research page
   carries it. evidence.json is 29 KB and only the evidence page reads it. That
   single decision is the difference between six 380 KB pages and a site whose
   heaviest page is the only one that needs to be. */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SITE, NAV, PAGES, href } = require('./pages.js');

const D = __dirname, MC = path.join(D, '..');
/* node_modules is not vendored into this folder. Look for it beside the site,
   at the repo root, and anywhere NODE_PATH points — so the build works whether
   it is run from a checkout with dependencies installed at the top level or
   from a scratch tree that only has the toolchain. */
const NM = (function () {
  const seen = [];
  const roots = [D, path.join(D, '..'), path.join(D, '..', '..'), path.join(D, '..', '..', '..')]
    .map(r => path.join(r, 'node_modules'))
    .concat((process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean));
  for (const r of roots) { seen.push(r); if (fs.existsSync(path.join(r, '.bin', 'tailwindcss'))) return r; }
  console.error('FATAL: could not find a node_modules with tailwindcss. Looked in:\n  ' + seen.join('\n  '));
  process.exit(1);
})();
/* Output goes beside the sources by default, or one level up when the sources
   live in a src/ folder — which is the shipped layout. Defaulting to __dirname
   there once scattered six built pages into src/ next to the code that makes
   them. OUT overrides both; guards.js uses it to build throwaway copies. */
const OUT = process.env.OUT ? path.resolve(process.env.OUT)
          : (path.basename(D) === 'src' ? path.join(D, '..') : D);

const sha256 = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
// A literal </script> inside any inlined payload would close the tag early.
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* Meta descriptions and JSON-LD take plain text, not markup. Page copy is
   authored with HTML entities for typography, so decode them here rather than
   maintaining two copies of every sentence. */
const plain = s => String(s)
  .replace(/<[^>]+>/g, '')
  .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
  .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/&times;/g, '×').replace(/&rarr;/g, '→')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

const fail = m => { console.error('FATAL: ' + m); process.exit(1); };

/* ── 1. shared assets ───────────────────────────────────────────────────── */

// Tailwind scans the markup AND app.js, since class names are emitted from both.
const pagesSrc = path.join(D, 'pages.js');
const cssOut = path.join(D, '.tw-out.css');
execFileSync(path.join(NM, '.bin', 'tailwindcss'),
  ['-c', path.join(D, 'tailwind.config.js'),
   '-i', path.join(D, 'tw.css'), '-o', cssOut, '--minify',
   '--content', `${pagesSrc},${path.join(D, 'app.js')},${__filename}`],
  { stdio: ['ignore', 'ignore', 'pipe'] });
const css = fs.readFileSync(cssOut, 'utf8');
fs.unlinkSync(cssOut);

const chartjs = safe(fs.readFileSync(path.join(NM, 'chart.js/dist/chart.umd.min.js'), 'utf8'));
const app     = safe(fs.readFileSync(path.join(D, 'app.js'), 'utf8'));
const bust    = fs.readFileSync(path.join(D, 'bust.datauri'), 'utf8').trim();
const reelSrc = fs.readFileSync(path.join(D, 'reel.datauri'), 'utf8').trim();
const reelMeta = JSON.parse(fs.readFileSync(path.join(D, 'reel.json'), 'utf8'));
const DATA = {
  'd-ev': safe(fs.readFileSync(path.join(MC, 'evidence.json'), 'utf8')),
  'd-pr': safe(fs.readFileSync(path.join(MC, 'pricing.json'), 'utf8')),
  // Geometry only. The pixels travel in reelCss; see the note there.
  'd-reel': safe(JSON.stringify(reelMeta)),
};
if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(bust)) fail('bust.datauri is not a JPEG data URI');

/* The renders live in their own small stylesheet so their payload rides only on
   the pages that actually paint them, while the Tailwind bundle stays identical
   (and identically hashed) across all six.

   The turntable atlas is a CSS custom property rather than a JSON island. It
   started as an island, read by JS and blitted into a canvas; once the canvas
   became image layers the CSS needs the URL itself, and shipping it in both
   places would have put 150 KB of base64 on the home page twice. app.js reads
   it back off the custom property when it needs to preload. */
const bustCss = `:root{--bust:url("${bust}")}`;
const reelCss = `:root{--reel:url("${reelSrc}")}`;

const bootstrap = "document.documentElement.classList.add('js-ready');";

/* ── 2. which payloads each page needs ──────────────────────────────────── */
/* Declared from what the markup actually contains, not from a hand-kept list —
   a page that grows a <canvas id="chart…"> starts shipping Chart.js on the
   next build without anyone remembering to update this file. */
function needs(page) {
  const b = page.body;
  return {
    charts:   /<canvas id="chart/.test(b),
    'd-pr':   /id="(tiers|matrixTable|compTable|vertTable|roiVert|quoteForm|fSector)"/.test(b),
    'd-ev':   /id="(dossier|ledger|srcList|cA)"/.test(b),
    'd-reel': /id="hero-reel"/.test(b),
    bust:     true,                       // hero on the home page, accent elsewhere
  };
}

/* ── 3. structured data ─────────────────────────────────────────────────── */
const ORG = {
  '@type': 'Organization',
  '@id': SITE.origin + '/#org',
  name: SITE.name,
  description: 'AI liability telemetry and coverage: continuous monitoring of production AI ' +
               'systems, certification against ISO/IEC 42001, and liability cover priced off that telemetry.',
  url: SITE.origin + '/',
  email: SITE.email,
  logo: SITE.origin + '/og.jpg',
};

function jsonld(page) {
  const url = SITE.origin + (page.slug === 'index' ? '/' : '/' + page.slug + '.html');
  const graph = [];

  if (page.slug === 'index') {
    /* The home page's own node is a WebPage. Emitting Organization for both the
       publisher and the page produced two Organization nodes in one graph —
       valid, and a parser has no way to tell which one is the entity. */
    page = Object.assign({}, page, { jsonld: 'WebPage' });
    graph.push(ORG, {
      '@type': 'WebSite', '@id': SITE.origin + '/#site',
      name: SITE.name, url: SITE.origin + '/', publisher: { '@id': SITE.origin + '/#org' },
      inLanguage: 'en-US',
    });
  } else {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.origin + '/' },
        { '@type': 'ListItem', position: 2, name: plain(page.eyebrow || page.h1), item: url },
      ],
    });
  }

  const base = {
    '@type': page.jsonld, '@id': url + '#page',
    name: plain(page.title), headline: plain(page.h1),
    description: plain(page.description), url,
    isPartOf: { '@id': SITE.origin + '/#site' },
    publisher: { '@id': SITE.origin + '/#org' },
    inLanguage: 'en-US',
  };
  if (page.jsonld === 'Article') {
    /* Schema.org requires author and a date on Article. Both are real: the
       dossier was compiled on a specific day and the publisher is the org. */
    base.author = { '@id': SITE.origin + '/#org' };
    base.datePublished = '2026-08-08';
    base.dateModified = new Date().toISOString().slice(0, 10);
  }
  if (page.jsonld === 'Product') {
    /* offers.price is deliberately absent. These are modeled technical
       premiums, not bound quotes; emitting them as a Product price would be a
       misrepresentation dressed as structured data. */
    base['@type'] = 'Service';
    base.serviceType = 'AI liability insurance and assurance';
    base.provider = { '@id': SITE.origin + '/#org' };
    base.areaServed = 'US';
  }
  graph.push(base);
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

/* ── 4. shell fragments ─────────────────────────────────────────────────── */
const mark = `<span class="w-[15px] h-[15px] border-[1.5px] border-teal relative shrink-0" aria-hidden="true">
        <span class="absolute inset-[3.5px] bg-amber block"></span></span>`;

function nav(cur) {
  const link = (n, cls) =>
    `<a href="${href(n.slug)}" class="${cls}"${n.slug === cur ? ' aria-current="page"' : ''}>${n.label}</a>`;
  // Home is reachable from the wordmark, so it is not repeated in the link row.
  const items = NAV.filter(n => n.slug !== 'index' && n.slug !== 'contact');
  return `<nav class="fixed top-0 inset-x-0 z-[60] glass border-x-0 border-t-0 rounded-none" aria-label="Primary">
  <div class="max-w-content mx-auto px-5 sm:px-7 py-3 flex items-center gap-4 sm:gap-6">
    <a href="${href('index')}" class="flex items-center gap-2.5 font-semibold tracking-[0.16em] text-[12px] uppercase whitespace-nowrap no-underline text-ink"${cur === 'index' ? ' aria-current="page"' : ''}>
      ${mark}${SITE.name}
    </a>
    <div class="flex gap-4 lg:gap-5 ml-auto items-center">
      ${items.map(n => link(n, 'hidden md:inline nav-link')).join('\n      ')}
      <button id="navBtn" type="button" class="md:hidden flex items-center justify-center w-9 h-9 border border-white/15 rounded-sm text-dim hover:text-ink hover:border-teal transition-colors"
              aria-expanded="false" aria-controls="navMenu" aria-label="Open navigation menu">
        <span class="block w-4 h-px bg-current relative before:absolute before:inset-x-0 before:-top-1.5 before:h-px before:bg-current after:absolute after:inset-x-0 after:top-1.5 after:h-px after:bg-current" aria-hidden="true"></span>
      </button>
      <button id="peBtn" type="button" aria-pressed="false"
        class="flex items-center gap-2 border border-white/15 text-dim hover:text-ink hover:border-teal font-sans text-[10.5px] tracking-[0.11em] uppercase px-2.5 py-1.5 rounded-full transition-colors whitespace-nowrap">
        <span id="peDot" class="w-1.5 h-1.5 rounded-full bg-faint transition-all shrink-0" aria-hidden="true"></span>
        <span class="hidden sm:inline">Plain English</span><span class="sm:hidden">Plain</span>
      </button>
      <a href="${href('contact')}" class="btn btn-primary no-underline hidden sm:inline-block"${cur === 'contact' ? ' aria-current="page"' : ''}>Get a quote</a>
    </div>
  </div>
  <div id="navMenu" hidden class="md:hidden glass-strong border-t border-white/10 px-5 pb-4 pt-1">
    ${NAV.map(n => link(n, 'nav-link-m')).join('\n    ')}
    <a href="${href('contact')}" class="block py-2.5 text-teal no-underline text-[13px] tracking-[0.08em] uppercase">Get a quote</a>
  </div>
</nav>`;
}

/* Interior pages carry the h1 in the shell, above their sections. That keeps
   exactly one h1 per document and puts the page's specific subject directly
   under its title, where both a reader and a crawler expect it. */
function pageHead(page) {
  return `<header class="relative overflow-hidden px-5 sm:px-7 pt-32 pb-14 border-b border-white/[0.06]">
  <div class="page-bust" aria-hidden="true"></div>
  <div class="max-w-content mx-auto relative">
    <nav aria-label="Breadcrumb" class="mb-6">
      <ol class="crumbs flex flex-wrap items-center list-none p-0 m-0">
        <li><a href="${href('index')}">${SITE.name}</a></li>
        <li aria-current="page">${page.eyebrow}</li>
      </ol>
    </nav>
    <h1 class="font-semibold leading-[1.02] tracking-[-0.032em] text-[clamp(2rem,4.6vw,3.4rem)] max-w-4xl">${page.h1}</h1>
    <p class="lede mt-5">${page.intro}</p>
    <p class="plain">${page.introPlain}</p>
  </div>
</header>`;
}

/* One contextual next step, in the reader's order rather than the nav's. A
   footer link list tells a crawler the pages exist; this tells it which one
   follows, and it saves a reader from having to choose. */
function nextStep(page) {
  const to = PAGES.find(p => p.slug === page.next);
  if (!to) return '';
  return `<section class="px-5 sm:px-7 pb-24" aria-label="Continue">
  <div class="max-w-content mx-auto">
    <a href="${href(to.slug)}" class="glass block p-6 sm:p-8 no-underline border-l-2 border-l-teal hover:border-white/25 transition-colors reveal">
      <p class="kicker mb-2">Next &mdash; ${to.eyebrow || 'Home'}</p>
      <p class="font-semibold text-ink text-[clamp(1.15rem,2.2vw,1.6rem)] leading-tight tracking-tight mb-2">${to.h1}</p>
      <p class="text-dim text-[14.5px] max-w-2xl">${to.intro || to.description}</p>
      <p class="text-teal font-mono text-[11px] tracking-[0.14em] uppercase mt-4">Read it &rarr;</p>
    </a>
  </div>
</section>`;
}

function footer(cur) {
  const col = (title, links) =>
    `<div><p class="kicker mb-3">${title}</p><ul class="leading-loose list-none p-0 m-0">${links}</ul></div>`;
  const internal = NAV.map(n =>
    `<li><a class="${n.slug === cur ? 'text-teal' : 'text-dim hover:text-teal'} no-underline hover:underline" href="${href(n.slug)}">${n.title}</a></li>`).join('');
  const anchors = [
    ['US Census BTOS', 'https://www.census.gov/programs-surveys/btos.html'],
    ['Stanford HAI AI Index 2026', 'https://hai.stanford.edu/ai-index/2026-ai-index-report'],
    ['ISO/IEC 42001:2023', 'https://www.iso.org/standard/42001'],
    ['NAIC AI Model Bulletin', 'https://content.naic.org/sites/default/files/cmte-h-big-data-artificial-intelligence-wg-map-ai-model-bulletin.pdf'],
    ['Munich Re cyber market', 'https://www.munichre.com/en/insights/cyber/cyber-protection-gap.html'],
  ].map(([t, u]) =>
    `<li><a class="text-dim hover:text-teal no-underline hover:underline" href="${u}" target="_blank" rel="noopener noreferrer">${t}</a></li>`).join('');

  return `<footer class="border-t border-white/[0.06] py-14 px-5 sm:px-7 text-faint text-[12.5px]">
  <div class="max-w-content mx-auto grid md:grid-cols-[1.6fr_1fr_1fr] gap-8">
    <div>
      <div class="flex items-center gap-2.5 font-semibold tracking-[0.16em] text-[12px] uppercase mb-3.5 text-ink">
        ${mark}${SITE.name}
      </div>
      <p>Evidence dossier compiled August 8, 2026. Twenty-nine claims tested, four discarded and
        shown. Viability model: 60,000 trials, five-year horizon, seed 20260808. Pricing model:
        400,000 simulations, seed 4711. Source in <code>montecarlo_v2.py</code> and
        <code>pricing.py</code>; graded claims in <code>evidence.json</code>.</p>
      <p class="mt-3.5">This is a strategy and research artifact. It is not an offer of insurance,
        a solicitation, financial advice, or a securities offering. Premiums shown are modeled
        technical premiums, not quotes, and are not backed by bound capacity. Case summaries
        describe public court records and are provided for analysis only.</p>
    </div>
    ${col('Pages', internal)}
    ${col('Primary anchors', anchors)}
  </div>
</footer>`;
}

/* ── 5. assemble ────────────────────────────────────────────────────────── */
const built = [];

for (const page of PAGES) {
  const n = needs(page);
  const url = SITE.origin + (page.slug === 'index' ? '/' : '/' + page.slug + '.html');
  const file = page.slug + '.html';

  const styles = [css].concat(n.bust ? [bustCss] : []).concat(n['d-reel'] ? [reelCss] : []);
  const scripts = [bootstrap, app].concat(n.charts ? [chartjs] : []);

  const dataIslands = Object.keys(DATA).filter(k => n[k])
    .map(k => `<script type="application/json" id="${k}">${DATA[k]}</script>`).join('\n');

  /* CSP.
     One SHA-256 per inline script and per inline stylesheet — no 'unsafe-inline'
     and no 'unsafe-eval' anywhere. The Chart.js hash covers the text app.js
     re-injects at runtime: the injected script is byte-identical to the inert
     source, so the same hash validates it.
     frame-ancestors is ignored inside <meta> per spec, so it is dropped from the
     meta form and shipped as a real header in _headers. */
  const csp = [
    "default-src 'none'",
    `script-src ${scripts.map(sha256).join(' ')}`,
    `style-src ${styles.map(sha256).join(' ')}`,
    "img-src 'self' data:",
    "font-src 'none'",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');
  const metaCsp = csp.split('; ').filter(d => !d.startsWith('frame-ancestors')).join('; ');

  const desc = esc(plain(page.description));
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${page.title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="${page.slug === 'index' ? 'website' : 'article'}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(plain(page.title))}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE.origin}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A dark studio render of the Sentinel robot bust, its visor and chest core lit in teal.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(plain(page.title))}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${SITE.origin}/og.jpg">
<meta name="theme-color" content="#05070a">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="color-scheme" content="dark">
<meta http-equiv="Content-Security-Policy" content="${metaCsp}">
<script type="application/ld+json">${safe(jsonld(page))}</script>
${styles.map(s => `<style>${s}</style>`).join('\n')}
</head>
<body>
<script>${bootstrap}</script>

<a class="skip sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-teal focus:text-[#04120f] focus:px-4 focus:py-2.5 focus:rounded-sm focus:font-semibold focus:text-sm" href="#main">Skip to content</a>

<div class="page-bg fixed inset-0 -z-10" aria-hidden="true"></div>

${nav(page.slug)}

<div class="relative z-10">
<main id="main">
${page.hero ? '' : pageHead(page) + '\n'}${page.body}

${nextStep(page)}
</main>

${footer(page.slug)}
</div>

${dataIslands}
<script>${app}</script>
${n.charts ? `<script type="text/plain" id="chartjs-src">${chartjs}</script>` : ''}
</body>
</html>
`;

  /* ── per-page assertions. A build that cannot prove these should not run. ── */
  const body = html.slice(html.indexOf('<body'));
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) fail(`${file}: ${h1s} <h1> elements, expected exactly 1`);
  if (!html.includes(`<script>${bootstrap}</script>`)) fail(`${file}: bootstrap text drifted from its hash`);
  const closers = (html.match(/<\/script>/gi) || []).length;
  const expected = scripts.length + 1 /* ld+json */ + Object.keys(DATA).filter(k => n[k]).length;
  if (closers !== expected) fail(`${file}: ${closers} </script> closers, expected ${expected} — a payload smuggled one in`);
  const inline = body.match(/\sstyle="/g) || [];
  if (inline.length) fail(`${file}: ${inline.length} inline style attribute(s) — the CSP forbids them`);
  if (/\/\*__[A-Z]+__\*\//.test(html)) fail(`${file}: a placeholder survived substitution`);
  try { JSON.parse(jsonld(page)); } catch (e) { fail(`${file}: JSON-LD is not valid JSON — ${e.message}`); }

  fs.writeFileSync(path.join(OUT, file), html);
  built.push({ file, page, bytes: html.length, charts: n.charts, url });
}

/* index.html is the canonical home; index2.html is the name already in local
   circulation. Both are written from the same bytes here, so they cannot drift. */
const home = built.find(b => b.page.slug === 'index');
fs.copyFileSync(path.join(OUT, 'index.html'), path.join(OUT, 'index2.html'));
fs.copyFileSync(path.join(D, 'og.jpg'), path.join(OUT, 'og.jpg'));

/* ── 6. crawl surface ───────────────────────────────────────────────────── */
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${built.map(b => `  <url>
    <loc>${b.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${b.page.slug === 'index' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`);

/* index2.html is a duplicate of index.html and must not be crawled as a second
   copy of the home page — that is a canonicalisation problem, so it is excluded
   here as well as pointed at the canonical URL by its own <link>. */
fs.writeFileSync(path.join(OUT, 'robots.txt'),
`User-agent: *
Allow: /
Disallow: /index2.html

Sitemap: ${SITE.origin}/sitemap.xml
`);

/* Real HTTP headers. Netlify and Cloudflare Pages both read _headers.
   frame-ancestors only works as a header, which is why it is repeated here.
   The CSP here is the union across pages: a header applies to every path, so it
   must admit every page's hashes. Each page additionally carries its own
   tighter <meta> CSP, and the browser enforces the intersection of the two. */
const allScript = new Set([sha256(bootstrap), sha256(app), sha256(chartjs)]);
const allStyle = new Set([sha256(css), sha256(bustCss), sha256(reelCss)]);
const headerCsp = [
  "default-src 'none'",
  `script-src ${[...allScript].join(' ')}`,
  `style-src ${[...allStyle].join(' ')}`,
  "img-src 'self' data:", "font-src 'none'", "connect-src 'none'",
  "form-action 'none'", "base-uri 'none'", "frame-ancestors 'none'",
  "object-src 'none'", "upgrade-insecure-requests",
].join('; ');

fs.writeFileSync(path.join(OUT, '_headers'), `/*
  Content-Security-Policy: ${headerCsp}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cache-Control: public, max-age=0, must-revalidate

/og.jpg
  Cache-Control: public, max-age=31536000, immutable
`);

/* ── 7. cross-page link integrity ───────────────────────────────────────── */
/* Every internal href must resolve to a file this build actually wrote. A
   dead internal link is the one SEO defect that is both trivial to introduce
   and invisible until a crawler finds it. */
const known = new Set(built.map(b => b.file).concat(['index2.html', 'og.jpg', 'sitemap.xml']));
let checked = 0;
for (const b of built) {
  const html = fs.readFileSync(path.join(OUT, b.file), 'utf8');
  for (const m of html.matchAll(/href="\.\/([^"#]*)(#[^"]*)?"/g)) {
    const target = m[1] === '' ? 'index.html' : m[1];
    checked++;
    if (!known.has(target)) fail(`${b.file}: internal link to ./${m[1]} — no such page`);
  }
}

/* ── 8. report ──────────────────────────────────────────────────────────── */
const kb = n => (n / 1024).toFixed(0).padStart(4) + ' KB';
console.log(`built ${built.length} pages → ${OUT}`);
for (const b of built) {
  console.log(`  ${b.file.padEnd(16)} ${kb(b.bytes)}  ${b.charts ? 'chart.js' : '        '}  ${b.page.title.slice(0, 46)}`);
}
console.log(`  shared: css ${(css.length / 1024).toFixed(0)}KB · app ${(app.length / 1024).toFixed(0)}KB · bust ${(bust.length / 1024).toFixed(0)}KB`);
console.log(`  total site ${kb(built.reduce((a, b) => a + b.bytes, 0))} across ${built.length} documents`);
console.log(`  ${checked} internal links verified · sitemap.xml · robots.txt · _headers · og.jpg`);
