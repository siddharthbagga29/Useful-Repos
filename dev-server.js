/**
 * Local harness that mimics Vercel's routing so the API can be exercised
 * without deploying. Serves static files and maps /api/<name> to api/<name>.js.
 *   node scripts/dev-server.js [port]
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 3000);
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.ico':'image/x-icon', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json',
  '.txt':'text/plain', '.xml':'application/xml', '.sql':'text/plain' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);

  if (p.startsWith('/api/')) {
    const name = p.slice(5).replace(/\.js$/, '').split('/')[0];
    // Guard: if a handler rejects without responding the socket would hang.
    const timer = setTimeout(() => {
      if (!res.writableEnded) {
        res.statusCode = 504;
        res.end(JSON.stringify({ ok: false, error: 'handler timeout' }));
      }
    }, 15000);
    try {
      const mod = await import(path.join(ROOT, 'api', `${name}.js`));
      await mod.default(req, res);
    } catch (e) {
      console.error(`[api/${name}]`, e);
      if (!res.writableEnded) {
        res.statusCode = e.code === 'ERR_MODULE_NOT_FOUND' ? 404 : 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    } finally {
      clearTimeout(timer);
      if (!res.writableEnded) res.end();
    }
    return;
  }

  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    // cleanUrls: /terms -> /terms.html
    try { await stat(file + '.html'); file += '.html'; } catch {}
  }
  try {
    const buf = await readFile(file);
    res.statusCode = 200;
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(buf);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile(path.join(ROOT, '404.html')).catch(() => 'Not found'));
  }
});
server.listen(PORT, () => console.log(`dev server on http://127.0.0.1:${PORT}`));
