/** Authenticated admin API: listings CRUD, leads, WhatsApp inbox, CSV export/import. */
import { json, fail, body } from '../lib/config.js';
import { requireRole } from '../lib/auth.js';
import { listingsAll, listingSave, listingDelete, leadsAll, waAll } from '../lib/db.js';

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default async function handler(req, res) {
  const action = new URL(req.url, 'http://x').searchParams.get('action') || '';

  try {
    if (action === 'listings') {
      if (!requireRole(req, res, 'admin', 'staff')) return;
      return json(res, { ok: true, listings: await listingsAll(false) });
    }

    if (action === 'save') {
      if (!requireRole(req, res, 'admin')) return;
      if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);
      const b = await body(req);
      if (!String(b.title || '').trim()) return fail(res, 'Title is required.');
      return json(res, { ok: true, listing: await listingSave(b) });
    }

    if (action === 'delete') {
      if (!requireRole(req, res, 'admin')) return;
      if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);
      const id = String((await body(req)).id || '').trim();
      if (!id) return fail(res, 'id is required.');
      return json(res, { ok: await listingDelete(id) });
    }

    if (action === 'leads') {
      if (!requireRole(req, res, 'admin', 'staff')) return;
      return json(res, { ok: true, leads: await leadsAll(1000) });
    }

    if (action === 'conversations') {
      if (!requireRole(req, res, 'admin', 'staff')) return;
      return json(res, { ok: true, conversations: await waAll(500) });
    }

    if (action === 'export') {
      if (!requireRole(req, res, 'admin')) return;
      const cols = ['id','name','phone','email','role','property_type','budget',
                    'location','message','source','stage','created_at'];
      const rows = await leadsAll(5000);
      const csv = [cols.join(','),
        ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition',
        `attachment; filename="highproperties-leads-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.end('﻿' + csv);   // BOM so Excel reads ₹ and names correctly
    }

    if (action === 'import') {
      if (!requireRole(req, res, 'admin')) return;
      if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);
      const b = await body(req);
      const text = String(b.csv || '');
      if (!text.trim()) return fail(res, 'Send the file contents as { "csv": "..." }.');

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return fail(res, 'The CSV appears to be empty.');
      const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());

      let imported = 0; const errors = [];
      for (const line of lines.slice(1)) {
        const cells = splitCsvLine(line);
        const d = {};
        head.forEach((k, i) => { d[k] = cells[i] ?? ''; });
        for (const k of ['purpose', 'specs', 'amenities']) {
          if (typeof d[k] === 'string' && d[k]) d[k] = d[k].split('|').map((s) => s.trim()).filter(Boolean);
        }
        if ('featured' in d) d.featured = ['1','yes','true','y'].includes(String(d.featured).toLowerCase());
        if ('active' in d)   d.active   = !['0','no','false','n'].includes(String(d.active).toLowerCase());
        if (d.areaunit && !d.areaUnit) d.areaUnit = d.areaunit;
        try { await listingSave(d); imported++; }
        catch (e) { errors.push(`${d.title || '?'}: ${e.message}`); }
      }
      return json(res, { ok: true, imported, errors });
    }

    return fail(res, 'Unknown action', 404);
  } catch (e) {
    console.error('[highproperties] admin:', e.message);
    return fail(res, e.message, 500);
  }
}

/** Minimal RFC-4180 line splitter (handles quotes and escaped quotes). */
function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
