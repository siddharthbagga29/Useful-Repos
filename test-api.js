/**
 * Smoke test against a running dev server.
 *   node scripts/dev-server.js &   then   npm test
 */
const B = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`);
  ok ? pass++ : fail++;
};
const get = (p, o) => fetch(B + p, o);

const r1 = await get('/api/listings');
const j1 = await r1.json();
check('GET /api/listings', r1.ok && j1.ok, `${j1.count} listings`);
check('GET /api/listings?id=NOPE → 404', (await get('/api/listings?id=NOPE')).status === 404);
check('admin without session → 401', (await get('/api/admin?action=listings')).status === 401);
check('lead without consent → 400',
  (await get('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'T', phone: '9821553693' }) })).status === 400);
check('lead with bad phone → 400',
  (await get('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'T', phone: '123', consent: true }) })).status === 400);
check('webhook POST without secret configured → 503/403',
  [403, 503].includes((await get('/api/webhook', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' })).status));
for (const p of ['/', '/admin.html', '/privacy-policy.html', '/terms', '/robots.txt', '/sitemap.xml'])
  check(`static ${p}`, (await get(p)).ok);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
