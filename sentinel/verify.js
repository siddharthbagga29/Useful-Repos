/* PIECE-BY-PIECE VERIFICATION
   ────────────────────────────────────────────────────────────────────────────
   Starts at index2.html — the file that has been in local circulation — and
   walks outward through every layer that file depends on, reporting a measured
   fact for each one rather than a bare pass mark.

   This is deliberately not backtest.js. That harness asserts 332 properties and
   tells you whether any broke. This one is an inventory: it says what each piece
   of the artifact actually IS, with the number it was measured at, so a reader
   can check the claim rather than trust the tick.

   Every measurement is taken from the shipped bytes in a real browser over a
   file:// URL. Nothing is read from source.

     node verify.js
   ──────────────────────────────────────────────────────────────────────────── */
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs'), crypto = require('crypto');

const DIR = __dirname;
const CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const PAGES = ['index', 'coverage', 'evidence', 'research', 'method', 'contact'];

let piece = 0, ok = 0, bad = 0;
const P = t => console.log(`\n${String(++piece).padStart(2, '0')}  ${t}\n${'─'.repeat(74)}`);
const R = (label, value, pass) => {
  if (pass === undefined) { console.log(`    ${label.padEnd(34)} ${value}`); return; }
  pass ? ok++ : bad++;
  console.log(`  ${pass ? '✓' : '✗'} ${label.padEnd(34)} ${value}`);
};
const kb = n => (n / 1024).toFixed(0) + ' KB';
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

(async () => {
const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });

async function open(slug, opts) {
  const p = await browser.newPage(Object.assign({ viewport: { width: 1440, height: 900 } }, opts || {}));
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(DIR, slug + '.html'), { waitUntil: 'load' });
  await p.waitForTimeout(2400);
  return { p, errs };
}

/* Decode an inlined image and hand back its pixels. The shader defects on this
   project were all invisible in source and obvious in output, so the render is
   checked by looking at it. */
async function pixels(uri) {
  const p = await browser.newPage();
  await p.setContent('<body></body>');
  const out = await p.evaluate(async src => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return { w: c.width, h: c.height,
             data: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) };
  }, uri);
  await p.close();
  return out;
}

console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║  SENTINEL — PIECE-BY-PIECE VERIFICATION OF THE SHIPPED BUILD             ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝');

/* ═══ 01 ═══ */
P('THE FILE YOU HAVE — index2.html');
const i2 = fs.readFileSync(path.join(DIR, 'index2.html'));
const i1 = fs.readFileSync(path.join(DIR, 'index.html'));
R('size', kb(i2.length));
R('sha256', sha(i2));
R('identical to index.html', i1.equals(i2) ? 'yes' : 'NO — they have diverged', i1.equals(i2));
console.log('\n    Compare that hash against your saved copy:');
console.log('      shasum -a 256 ~/Downloads/index2.html');
console.log('    A different hash means your copy predates this build.');

/* ═══ 02 ═══ */
P('DOCUMENT SHELL — what a crawler reads first');
const { p: home, errs: homeErrs } = await open('index');
const shell = await home.evaluate(() => {
  const g = s => { const e = document.querySelector(s); return e && (e.content || e.href || e.textContent); };
  return { doctype: !!document.doctype, lang: document.documentElement.lang,
           title: document.title, desc: g('meta[name=description]'),
           canonical: g('link[rel=canonical]'), robots: g('meta[name=robots]'),
           og: !!g('meta[property="og:image"]'), tw: g('meta[name="twitter:card"]'),
           ld: g('script[type="application/ld+json"]'),
           h1s: document.querySelectorAll('h1').length,
           nodes: document.querySelectorAll('*').length };
});
R('doctype + lang', `${shell.doctype ? 'html5' : 'MISSING'} / ${shell.lang}`, shell.doctype && shell.lang === 'en');
R('title', `${shell.title.length} chars`, shell.title.length >= 25 && shell.title.length <= 75);
R('meta description', `${shell.desc.length} chars`, shell.desc.length >= 70 && shell.desc.length <= 320);
R('canonical', shell.canonical, /^https?:\/\//.test(shell.canonical));
R('robots', shell.robots, /index,follow/.test(shell.robots));
R('social card', `og:image + ${shell.tw}`, shell.og && shell.tw === 'summary_large_image');
const graph = JSON.parse(shell.ld)['@graph'].map(n => n['@type']);
R('structured data', graph.join(', '), graph.includes('Organization') && graph.includes('WebSite'));
R('exactly one h1', String(shell.h1s), shell.h1s === 1);
R('DOM nodes at boot', String(shell.nodes), shell.nodes < 400);

/* ═══ 03 ═══ */
P('CONTENT SECURITY POLICY');
const csp = await home.evaluate(() =>
  document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
const hashes = (csp.match(/sha256-/g) || []).length;
R("default-src", /default-src 'none'/.test(csp) ? "'none'" : 'NOT LOCKED', /default-src 'none'/.test(csp));
R('inline allowances', /unsafe-inline|unsafe-eval/.test(csp) ? 'PRESENT' : "none — hashes only",
  !/unsafe-inline|unsafe-eval/.test(csp));
R('SHA-256 hashes', String(hashes), hashes >= 4);
R('base-uri / object-src', /base-uri 'none'/.test(csp) && /object-src 'none'/.test(csp) ? "both 'none'" : 'open',
  /base-uri 'none'/.test(csp) && /object-src 'none'/.test(csp));
R('frame-ancestors in meta', /frame-ancestors/.test(csp) ? 'present (spec-ignored here)' : 'absent, as it must be',
  !/frame-ancestors/.test(csp));
const headers = read('_headers');
['frame-ancestors', 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff',
 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security'].forEach(h =>
  R('_headers ships ' + h.split(':')[0], 'yes', headers.includes(h)));

/* ═══ 04 ═══ */
P('PAYLOAD INVENTORY — everything inside this one file');
const src = read('index2.html');
const bustUri = (src.match(/--bust:url\("(data:image\/jpeg;base64,[^"]+)"\)/) || [])[1];
const reelUri = (src.match(/--reel:url\("(data:image\/jpeg;base64,[^"]+)"\)/) || [])[1];
const styleBytes = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].reduce((a, m) => a + m[1].length, 0);
const appBytes = (src.match(/<script>([\s\S]*?)<\/script>/g) || []).reduce((a, s) => a + s.length, 0);
R('stylesheet (incl. renders)', kb(styleBytes));
R('  hero still', bustUri ? kb(bustUri.length) : 'ABSENT', !!bustUri);
R('  turntable atlas', reelUri ? kb(reelUri.length) : 'ABSENT', !!reelUri);
R('application script', kb(appBytes));
R('Chart.js', /id="chartjs-src"/.test(src) ? 'PRESENT — should not be here' : 'absent (research only)',
  !/<script type="text\/plain" id="chartjs-src">/.test(src));
R('total document', kb(src.length));

/* ═══ 05 ═══ */
P('SELF-CONTAINMENT — nothing is fetched from anywhere');
/* Only things the browser actually FETCHES count. A rel=canonical is metadata
   and is never requested — counting it as a subresource is the same category
   error as counting a substring inside a payload, and it reported a false
   positive on the first run of this file. */
const remote = await home.evaluate(() => {
  const FETCHED = 'script[src], link[rel~="stylesheet"], link[rel~="preload"], ' +
                  'link[rel~="icon"], img[src], iframe[src], video[src], audio[src], ' +
                  'source[src], source[srcset], embed[src], object[data]';
  return [...document.querySelectorAll(FETCHED)]
    .map(e => [e.tagName, e.getAttribute('src') || e.getAttribute('href') ||
                          e.getAttribute('srcset') || e.getAttribute('data') || ''])
    .filter(([, v]) => /^(https?:)?\/\//.test(v))
    .map(([t, v]) => t + ' ' + v.slice(0, 40));
});
R('remote subresources', remote.length ? remote.join(' | ') : 'none', remote.length === 0);
R('webfonts', /@font-face/.test(src) ? 'PRESENT' : 'none — system stack only', !/@font-face/.test(src));
const net = await home.evaluate(() => performance.getEntriesByType('resource')
  .filter(r => !/^data:/.test(r.name)).length);
R('network requests after load', String(net), net === 0);
R('console / page errors', homeErrs.length ? homeErrs.slice(0, 2).join(' | ') : 'none', homeErrs.length === 0);

/* ═══ 06 ═══ */
P('THE HERO STILL — the raymarched bust');
{
  const px = await pixels(bustUri);
  R('resolution', `${px.w} × ${px.h}`);
  let subject = 0, teal = 0, edgeSum = 0, edgeN = 0;
  const ring = Math.max(2, Math.round(Math.min(px.w, px.h) * 0.01));
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const i = (y * px.w + x) * 4, r = px.data[i], g = px.data[i + 1], b = px.data[i + 2];
    const L = lum(r, g, b);
    if (x < ring || y < ring || x >= px.w - ring || y >= px.h - ring) { edgeSum += L; edgeN++; }
    if (L < 26) continue;
    subject++; if ((g + b) / 2 - r > 24) teal++;
  }
  const tealPct = teal / subject * 100, edge = edgeSum / edgeN, page = lum(5, 7, 10);
  R('rim light is an edge', `${tealPct.toFixed(1)}% of lit surface is teal (limit 12%)`, tealPct < 12);
  R('frame blends to page', `edge luma ${edge.toFixed(2)} vs page ${page.toFixed(2)}`, Math.abs(edge - page) < 3);
  R('subject coverage', `${(subject / (px.w * px.h) * 100).toFixed(1)}% of frame is lit`);
}

/* ═══ 07 ═══ */
P('THE TURNTABLE — eleven baked views');
{
  const meta = JSON.parse((src.match(/<script type="application\/json" id="d-reel">(.*?)<\/script>/s) || [])[1]);
  const px = await pixels(reelUri);
  const cellW = px.h, n = Math.round(px.w / cellW);
  R('atlas', `${px.w} × ${px.h} = ${n} cells of ${cellW}px`);
  R('declared geometry', `${meta.frames} frames, ±${(meta.arc * 180 / Math.PI).toFixed(0)}° arc`,
    meta.frames === n);
  let diff = 0, count = 0;
  for (let y = 0; y < px.h; y += 2) for (let x = 0; x < cellW; x += 2) {
    const a = (y * px.w + x) * 4, b = (y * px.w + (n - 1) * cellW + x) * 4;
    const la = lum(px.data[a], px.data[a + 1], px.data[a + 2]);
    const lb = lum(px.data[b], px.data[b + 1], px.data[b + 2]);
    if (la < 18 && lb < 18) continue;
    diff += Math.abs(la - lb); count++;
  }
  const mad = diff / count;
  R('extremes actually differ', `mean |Δluma| ${mad.toFixed(2)} (needs > 6)`, mad > 6);
}

/* ═══ 08 ═══ */
P('RUNTIME — what boots, and what stays quiet');
const diag = await home.evaluate(() => window.sentinelDiagnostics
  ? { ok: window.sentinelDiagnostics.ok, errors: window.sentinelDiagnostics.errors,
      layers: window.sentinelDiagnostics.layers } : null);
R('diagnostics surface', diag ? 'exposed and frozen' : 'MISSING', !!diag);
R('no guarded feature threw', diag && diag.ok ? 'clean' : (diag ? diag.errors.join(', ') : 'n/a'), !!diag && diag.ok);
R('scroll-formed figure', diag.layers.core ? 'alive' : 'DEAD', diag.layers.core);
R('turntable', diag.layers.heroReel ? 'live' : 'not started', diag.layers.heroReel);
R('backdrop is baked', diag.layers.bakedBackdrop ? 'yes — no runtime WebGL' : 'no', diag.layers.bakedBackdrop);
R('scrolling', diag.layers.nativeScroll ? 'native / compositor-driven' : 'JS LIBRARY', diag.layers.nativeScroll);
const leaked = await home.evaluate(() => Object.keys(window).filter(k => /^__|^(MC|EV|PR|CHARTS|DIAG)$/.test(k)));
R('internals on window', leaked.length ? leaked.join(', ') : 'none', leaked.length === 0);
const glCtx = await home.evaluate(() => [...document.querySelectorAll('canvas')].length);
R('canvases in the document', `${glCtx} (the scroll figure only)`, glCtx === 1);

/* ═══ 09 ═══ */
P('INTERACTIVITY — the bust turns to follow the pointer');
{
  const geom = await home.evaluate(() => {
    const s = document.getElementById('hero-reel'), strip = s.getElementsByTagName('i')[0];
    const box = s.getBoundingClientRect(), hero = s.closest('header').getBoundingClientRect();
    return { tag: s.tagName, live: s.classList.contains('live'),
             boxW: Math.round(box.width), boxH: Math.round(box.height),
             heroW: Math.round(hero.width), heroH: Math.round(hero.height),
             stripW: Math.round(parseFloat(strip.style.width)),
             cellH: Math.round(parseFloat(strip.style.height)) };
  });
  R('layer type', `<${geom.tag.toLowerCase()}> image strip, not a canvas`, geom.tag === 'DIV');
  R('covers the hero', `${geom.boxW}×${geom.boxH} in ${geom.heroW}×${geom.heroH}`,
    geom.boxW >= geom.heroW * 0.9 && geom.boxH >= geom.heroH * 0.9);
  R('strip spans every view', `${geom.stripW}px / ${geom.cellH}px cells`,
    Math.abs(geom.stripW - 11 * geom.cellH) <= 11);
  await home.mouse.move(120, 460); await home.waitForTimeout(1200);
  const left = await home.evaluate(() => document.querySelector('#hero-reel i').style.transform);
  await home.mouse.move(1320, 460); await home.waitForTimeout(1200);
  const right = await home.evaluate(() => document.querySelector('#hero-reel i').style.transform);
  /* Anchor on the paren and the unit. A bare /-?[\d.]+/ matches the "3" inside
     "translate3d" and reports every view as view 0 — the same substring error
     that is already twice on the failure ledger, committed a third time in a
     file written to check for it. */
  const cellPx = geom.cellH;
  const view = t => { const m = t.match(/\(\s*(-?[\d.]+)px/);
                      return m ? Math.round(Math.abs(parseFloat(m[1])) / cellPx) : -1; };
  const li = view(left), ri = view(right);
  R('pointer selects a view', `far-left → view ${li}, far-right → view ${ri}`, li !== ri);
  R('parallax', await home.evaluate(() => document.getElementById('hero-reel').style.transform) || 'none',
    /translate3d/.test(await home.evaluate(() => document.getElementById('hero-reel').style.transform || '')));
}

/* ═══ 10 ═══ */
P('THE SCROLL-FORMED FIGURE');
{
  const top = await home.evaluate(() =>
    document.getElementById('core').getBoundingClientRect().top + window.pageYOffset);
  const h = await home.evaluate(() => document.getElementById('core').offsetHeight);
  const seq = [];
  for (const f of [0.02, 0.35, 0.7, 0.99]) {
    await home.evaluate(y => window.scrollTo(0, y), top + h * f);
    await home.waitForTimeout(900);
    seq.push(await home.evaluate(() => ({
      pct: parseInt(document.getElementById('core-pct').textContent),
      lit: [...document.querySelectorAll('#wp-dots span')].filter(d => !d.className.includes('bg-white/12')).length })));
  }
  R('assembly tracks scroll', seq.map(s => s.pct + '%').join(' → '),
    seq.every((s, i) => i === 0 || s.pct >= seq[i - 1].pct) && seq[3].pct >= 85);
  R('failure modes activate', seq.map(s => s.lit).join(' → ') + ' of 5', seq[3].lit === 5);
  await home.evaluate(y => window.scrollTo(0, y), top + h - 900);
  await home.waitForTimeout(1700);
  const fig = await home.evaluate(() => {
    const cv = document.getElementById('core-canvas');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const W = cv.width, H = cv.height;
    const band = (x0, x1, y0, y1) => { let k = 0;
      for (let y = Math.floor(y0*H); y < Math.floor(y1*H); y++)
        for (let x = Math.floor(x0*W); x < Math.floor(x1*W); x++) if (d[(y*W+x)*4+3] > 90) k++;
      return k; };
    const runs = row => { let n = 0, on = false, gap = 0; const y = Math.floor(row*H);
      for (let x = 0; x < W; x++) { const ink = d[(y*W+x)*4+3] > 70;
        if (ink && !on) { n++; on = true; gap = 0; } else if (!ink && on) { if (++gap > W*0.02) on = false; } }
      return n; };
    const avg = rs => rs.reduce((a, r) => a + runs(r), 0) / rs.length;
    return { head: band(0.40,0.60,0.05,0.28), lArm: band(0.20,0.42,0.28,0.68),
             rArm: band(0.58,0.80,0.28,0.68), legs: band(0.38,0.62,0.70,0.98),
             top: avg([0.10,0.14,0.18]), bot: avg([0.84,0.88,0.92]) };
  });
  R('limbs render', `head ${fig.head} · arms ${fig.lArm}/${fig.rArm} · legs ${fig.legs} px`,
    Math.min(fig.head, fig.lArm, fig.rArm, fig.legs) > 40);
  R('right way up', `${fig.top.toFixed(1)} run at the crown vs ${fig.bot.toFixed(1)} at the feet`,
    fig.bot > fig.top);
}
await home.evaluate(() => window.scrollTo(0, 0));
await home.waitForTimeout(400);

/* ═══ 11 ═══ */
P('LEGIBILITY — text over the render, measured from pixels');
{
  await home.evaluate(() => {
    window.__L = c => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
      return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]); };
    document.querySelectorAll('header .glass > *').forEach(e => { e.style.visibility = 'hidden'; });
  });
  for (let i = 0; i < 40; i++) {
    if (await home.evaluate(() => [...document.querySelectorAll('header .glass > *')]
      .every(e => getComputedStyle(e).visibility === 'hidden'))) break;
    await home.waitForTimeout(50);
  }
  const box = await home.evaluate(() => { const r = document.querySelector('header .glass').getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
  const shot = (await home.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } })).toString('base64');
  const m = await home.evaluate(async ([b64, box]) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const x0 = Math.max(0, box.x), y0 = Math.max(0, box.y);
    const d = c.getContext('2d').getImageData(x0, y0,
      Math.min(box.w, img.width - x0), Math.min(box.h, img.height - y0)).data;
    const fg = getComputedStyle(document.querySelector('header .lede')).color.match(/\d+/g).map(Number);
    let best = 0, typeHits = 0;
    for (let i = 0; i < d.length; i += 4) {
      const L = window.__L([d[i], d[i+1], d[i+2]]);
      if (L > best) best = L;
      if (Math.abs(d[i]-fg[0]) < 6 && Math.abs(d[i+1]-fg[1]) < 6 && Math.abs(d[i+2]-fg[2]) < 6) typeHits++;
    }
    const Lf = window.__L(fg), hi = Math.max(Lf, best), lo = Math.min(Lf, best);
    return { ratio: (hi + 0.05) / (lo + 0.05), typeHits, best: Math.round(best * 255) };
  }, [shot, box]);
  R('probe is reading background', `${m.typeHits} body-colour pixels in frame (want ~0)`, m.typeHits <= 40);
  R('hero copy over the backdrop', `${m.ratio.toFixed(2)}:1 (WCAG AA needs 4.5)`, m.ratio >= 4.5);
  await home.evaluate(() => document.querySelectorAll('header .glass > *').forEach(e => { e.style.visibility = ''; }));
}
await home.close();

/* ═══ 12 ═══ */
P('PERFORMANCE — heaviest and lightest page, at 2× DPR');
for (const slug of ['index', 'research']) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => { window.__lt = []; window.__cls = 0;
    new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration)))
      .observe({ type: 'longtask', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; }))
      .observe({ type: 'layout-shift', buffered: true }); });
  await p.goto('file://' + path.join(DIR, slug + '.html'), { waitUntil: 'load' });
  await p.waitForTimeout(2600);
  const perf = await p.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    return { fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||0),
             dcl: Math.round(n.domContentLoadedEventEnd||0), cls: window.__cls,
             tbt: window.__lt.reduce((a,x)=>a+Math.max(0,x-50),0) }; });
  const frame = await p.evaluate(async () => {
    const t = []; let last = performance.now();
    for (let i = 0; i < 40; i++) { window.scrollTo(0, i * 60);
      await new Promise(r => requestAnimationFrame(r));
      const n = performance.now(); t.push(n - last); last = n; }
    t.sort((a, b) => a - b); return t[20]; });
  console.log(`    ── ${slug}.html`);
  R('  FCP', perf.fcp + ' ms', perf.fcp < 1800);
  R('  DOMContentLoaded', perf.dcl + ' ms', perf.dcl < 1500);
  R('  cumulative layout shift', perf.cls.toFixed(4), perf.cls < 0.1);
  R('  total blocking time', perf.tbt + ' ms (headless software raster)', perf.tbt < 300);
  R('  median scroll frame', `${frame.toFixed(1)} ms — ${(1000/frame).toFixed(0)} fps`, frame < 34);
  await p.close();
}

/* ═══ 13 ═══ */
P('THE OTHER FIVE PAGES — reached from this one');
{
  const links = await (async () => {
    const { p } = await open('index');
    const l = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="./"]')]
      .map(a => a.getAttribute('href').split('#')[0]))]);
    await p.close(); return l;
  })();
  R('distinct internal destinations', String(links.length), links.length >= 6);
  const seen = { title: new Set(), desc: new Set(), canonical: new Set(), h1: new Set() };
  for (const slug of PAGES) {
    const { p, errs } = await open(slug);
    const m = await p.evaluate(() => ({
      title: document.title,
      desc: (document.querySelector('meta[name=description]') || {}).content,
      canonical: (document.querySelector('link[rel=canonical]') || {}).href,
      h1: (document.querySelector('h1') || {}).textContent,
      h1n: document.querySelectorAll('h1').length,
      crumbs: !!document.querySelector('nav[aria-label=Breadcrumb]'),
      current: document.querySelectorAll('nav [aria-current="page"]').length,
      dead: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'))
              .filter(h => h.length > 1 && !document.querySelector(h)).length }));
    Object.keys(seen).forEach(k => seen[k].add(m[k]));
    const good = errs.length === 0 && m.h1n === 1 && m.dead === 0 && m.current >= 1 &&
                 (slug === 'index' ? !m.crumbs : m.crumbs);
    R(slug + '.html', `"${m.h1.trim().slice(0, 40)}" · 1 h1 · ${m.dead} dead anchors · ` +
      `${errs.length} errors${slug === 'index' ? '' : ' · breadcrumb'}`, good);
    await p.close();
  }
  Object.keys(seen).forEach(k =>
    R(`every page has a distinct ${k}`, `${seen[k].size}/${PAGES.length}`, seen[k].size === PAGES.length));
}

/* ═══ 14 ═══ */
P('DEGRADATION — the page without its enhancements');
{
  const nj = await browser.newContext({ javaScriptEnabled: false });
  const np = await nj.newPage();
  await np.goto('file://' + path.join(DIR, 'index2.html'), { waitUntil: 'load' });
  const hidden = await np.$$eval('.reveal', es => es.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.9).length);
  const text = (await np.textContent('body')).length;
  const nav = await np.$$eval('nav a', as => as.length);
  R('no JavaScript', `${text.toLocaleString()} chars readable, ${nav} nav links, ${hidden} hidden`,
    hidden === 0 && text > 1500 && nav >= 5);
  await nj.close();

  const { p: rm } = await open('index', { reducedMotion: 'reduce' });
  R('prefers-reduced-motion', await rm.evaluate(() =>
    getComputedStyle(document.getElementById('hero-reel')).display) === 'none'
    ? 'turntable not rendered' : 'STILL ANIMATING',
    await rm.evaluate(() => getComputedStyle(document.getElementById('hero-reel')).display === 'none'));
  await rm.close();

  const { p: mob, errs: mErrs } = await open('index', { viewport: { width: 390, height: 844 }, isMobile: true });
  const ov = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await mob.click('#navBtn'); await mob.waitForTimeout(300);
  const reach = await mob.evaluate(() => new Set([...document.querySelectorAll('#navMenu a')]
    .filter(a => a.offsetParent !== null).map(a => a.getAttribute('href'))).size);
  R('390px viewport', `${ov}px overflow, ${reach} destinations reachable, ${mErrs.length} errors`,
    ov <= 1 && reach >= 6 && mErrs.length === 0);
  await mob.close();
}

/* ═══ 15 ═══ */
P('CRAWL SURFACE');
{
  const sm = read('sitemap.xml'), rb = read('robots.txt');
  R('sitemap entries', String((sm.match(/<url>/g) || []).length), (sm.match(/<url>/g) || []).length === 6);
  R('duplicate excluded', !/index2/.test(sm) && /Disallow: \/index2\.html/.test(rb) ? 'sitemap + robots' : 'NOT EXCLUDED',
    !/index2/.test(sm) && /Disallow: \/index2\.html/.test(rb));
  const og = fs.statSync(path.join(DIR, 'og.jpg'));
  R('social card on disk', `og.jpg, ${kb(og.size)}`, og.size > 10000);
}

await browser.close();
console.log('\n' + '═'.repeat(76));
console.log(bad === 0
  ? `  ✅ ${piece} PIECES VERIFIED · ${ok} measurements, none failing`
  : `  ❌ ${bad} MEASUREMENT(S) FAILING out of ${ok + bad} across ${piece} pieces`);
console.log('═'.repeat(76) + '\n');
process.exit(bad === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
