/**
 * Supabase (Postgres) data layer.
 *
 * Uses the SERVICE ROLE key, which bypasses Row Level Security — it must only
 * ever run server-side. It is never sent to the browser.
 *
 * Reads fall back to the bundled data/listings.json so the site still renders
 * if Supabase is unreachable. Writes cannot fall back: Vercel's filesystem is
 * read-only, so an unconfigured project fails loudly rather than silently
 * dropping a customer enquiry.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env, priceLabel, slugify } from './config.js';

let client = null;
export function supa() {
  if (client) return client;
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const dbReady = () => supa() !== null;

/** Bundled seed — read-only fallback for the public catalogue. */
async function seedListings() {
  try {
    const p = path.join(process.cwd(), 'data', 'listings.json');
    const j = JSON.parse(await readFile(p, 'utf8'));
    return j.listings || [];
  } catch {
    return [];
  }
}

const asArray = (v) =>
  Array.isArray(v) ? v
  : typeof v === 'string' && v.trim()
    ? (() => { try { const d = JSON.parse(v); return Array.isArray(d) ? d : [v]; }
               catch { return v.split(',').map((s) => s.trim()).filter(Boolean); } })()
    : [];

export function hydrate(r) {
  // Postgres folds unquoted identifiers to lower case, so the DB columns are
  // pricelabel / areaunit / postedon. The front-end expects camelCase.
  return {
    ...r,
    priceLabel: r.priceLabel ?? r.pricelabel ?? '',
    areaUnit: r.areaUnit ?? r.areaunit ?? 'sq.ft',
    postedOn: r.postedOn ?? r.postedon ?? '',
    purpose: asArray(r.purpose),
    specs: asArray(r.specs),
    amenities: asArray(r.amenities),
    price: r.price == null ? null : Number(r.price),
    area: r.area == null ? null : Number(r.area),
    beds: r.beds == null ? null : Number(r.beds),
    baths: r.baths == null ? null : Number(r.baths),
    featured: !!r.featured,
    active: r.active !== false,
  };
}

/* ── listings ─────────────────────────────────────────────────────────── */

export async function listingsAll(activeOnly = true) {
  const db = supa();
  if (db) {
    let q = db.from('listings').select('*');
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q
      .order('featured', { ascending: false })
      .order('price', { ascending: false });
    if (!error && data) return data.map(hydrate);
    console.error('[highproperties] listings query failed:', error?.message);
  }
  const seed = await seedListings();
  return (activeOnly ? seed.filter((r) => r.active !== false) : seed).map(hydrate);
}

export async function listingSave(d) {
  const db = supa();
  if (!db) throw new Error('Database not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

  const id = String(d.id || '').trim()
    || 'HP-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const price = d.price === '' || d.price == null ? null : Number(d.price);

  const row = {
    id,
    slug: d.slug || slugify(d.title || id),
    title: String(d.title || ''),
    type: String(d.type || ''),
    category: String(d.category || 'residential'),
    purpose: asArray(d.purpose).length ? asArray(d.purpose) : ['buy'],
    price,
    pricelabel: String(d.priceLabel || '').trim() || priceLabel(price),
    city: String(d.city || 'Gurugram'),
    sector: String(d.sector || ''),
    locality: String(d.locality || ''),
    location: String(d.location || ''),
    beds: d.beds === '' || d.beds == null ? null : Number(d.beds),
    baths: d.baths === '' || d.baths == null ? null : Number(d.baths),
    area: d.area === '' || d.area == null ? null : Number(d.area),
    areaunit: String(d.areaUnit || 'sq.ft'),
    status: String(d.status || ''),
    badge: String(d.badge || ''),
    featured: !!d.featured,
    icon: String(d.icon || ''),
    gradient: String(d.gradient || ''),
    specs: asArray(d.specs),
    amenities: asArray(d.amenities),
    description: String(d.description || ''),
    image: String(d.image || ''),
    rera: String(d.rera || ''),
    postedon: d.postedOn || new Date().toISOString().slice(0, 10),
    active: d.active !== false,
  };

  const { data, error } = await db.from('listings').upsert(row).select().single();
  if (error) throw new Error(error.message);
  return hydrate(data);
}

export async function listingDelete(id) {
  const db = supa();
  if (!db) throw new Error('Database not configured.');
  const { error } = await db.from('listings').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

/* ── leads ────────────────────────────────────────────────────────────── */

export async function leadSave(lead) {
  const db = supa();
  if (!db) throw new Error('Database not configured — the enquiry could not be saved.');
  const row = {
    id: lead.id || 'LD-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    role: lead.role || '',
    property_type: lead.propertyType || '',
    budget: lead.budget || '',
    location: lead.location || '',
    message: lead.message || '',
    source: lead.source || 'website',
    stage: lead.stage || 'new',
    ip: lead.ip || '',
    created_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('leads').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function leadsAll(limit = 1000) {
  const db = supa();
  if (!db) return [];
  const { data, error } = await db.from('leads')
    .select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('[highproperties] leads query failed:', error.message); return []; }
  return data || [];
}

/* ── whatsapp conversation log ────────────────────────────────────────── */

export async function waLog(rows) {
  const db = supa();
  if (!db || !rows.length) return;
  const { error } = await db.from('wa_conversations').upsert(rows);
  if (error) console.error('[highproperties] wa log failed:', error.message);
}

export async function waAll(limit = 500) {
  const db = supa();
  if (!db) return [];
  const { data } = await db.from('wa_conversations')
    .select('*').order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

/* ── staff ────────────────────────────────────────────────────────────── */

export async function staffAll() {
  const db = supa();
  if (!db) return [];
  const { data } = await db.from('staff').select('username, role, created_at');
  return data || [];
}

export async function staffFind(username) {
  const db = supa();
  if (!db) return null;
  const { data } = await db.from('staff')
    .select('*').eq('username', String(username).toLowerCase()).maybeSingle();
  return data || null;
}

export async function staffAdd(username, hash, role = 'staff') {
  const db = supa();
  if (!db) throw new Error('Database not configured.');
  const { error } = await db.from('staff')
    .insert({ username: String(username).toLowerCase(), hash, role });
  if (error) throw new Error(error.message);
  return true;
}

export async function staffRemove(username) {
  const db = supa();
  if (!db) throw new Error('Database not configured.');
  const { error } = await db.from('staff')
    .delete().eq('username', String(username).toLowerCase());
  if (error) throw new Error(error.message);
  return true;
}
