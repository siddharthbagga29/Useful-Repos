/**
 * Shared configuration and helpers for the High Properties serverless API.
 *
 * Secrets come from Vercel environment variables — never from source.
 * Set them in: Vercel → Project → Settings → Environment Variables
 */

export const BUSINESS = {
  name: 'High Properties',
  tagline: 'Building Future',
  phone: '+919821553693',
  whatsapp: '919821553693',
  email: 'highproperties9@gmail.com',
  city: 'Gurugram',
  region: 'Haryana',
  country: 'IN',
};

export const env = (key, fallback = '') => process.env[key] ?? fallback;

/** JSON response with hardening headers. */
export function json(res, data, status = 200, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

export const fail = (res, message, status = 400, extra = {}) =>
  json(res, { ok: false, error: message, ...extra }, status);

/** Parse a JSON body regardless of whether the platform pre-parsed it. */
export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { 
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

export function clientIp(req) {
  const h = req.headers;
  return (h['x-forwarded-for']?.split(',')[0]
       || h['x-real-ip']
       || req.socket?.remoteAddress
       || '0.0.0.0').trim();
}

/** Indian mobile -> E.164 digits (91XXXXXXXXXX), or null. */
export function normalisePhone(raw) {
  const d = String(raw ?? '').replace(/\D+/g, '');
  if (d.length === 10 && d[0] >= '6') return '91' + d;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length === 13 && d.startsWith('091')) return d.slice(1);
  return null;
}

/** 14500000 -> "₹1.45 Cr" */
export function priceLabel(n) {
  const v = Number(n);
  if (!v || Number.isNaN(v) || v <= 0) return '';
  const trim = (x) => String(x).replace(/\.?0+$/, '');
  if (v >= 1e7) return '₹' + trim((v / 1e7).toFixed(2)) + ' Cr';
  if (v >= 1e5) return '₹' + trim((v / 1e5).toFixed(2)) + ' L';
  return '₹' + v.toLocaleString('en-IN');
}

export const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'listing';

/**
 * Rate limiter.
 * Serverless instances are ephemeral, so this is best-effort per-instance.
 * Supabase-backed limiting is used for the paths that matter (see leads.js).
 */
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) return false;
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
