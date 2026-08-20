/** GET /api/listings — public catalogue. ?id= or ?slug= returns one. */
import { json, fail } from '../lib/config.js';
import { listingsAll } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  // Short, revalidating cache: a property added in admin must appear at once.
  res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const rows = await listingsAll(true);
    const url = new URL(req.url, 'http://x');
    const id = (url.searchParams.get('id') || '').trim();
    const slug = (url.searchParams.get('slug') || '').trim();

    if (id || slug) {
      const one = rows.find((r) => (id && r.id === id) || (slug && r.slug === slug));
      return one ? json(res, { ok: true, listing: one }) : fail(res, 'Listing not found', 404);
    }
    return json(res, { ok: true, updated: new Date().toISOString(), count: rows.length, listings: rows });
  } catch (e) {
    console.error('[highproperties] listings:', e.message);
    return fail(res, 'Could not load listings', 500);
  }
}
