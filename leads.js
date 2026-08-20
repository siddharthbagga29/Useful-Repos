/**
 * POST /api/leads — capture an enquiry, store it, fire WhatsApp automation.
 * Always returns a wa.me fallback so the enquiry can still reach a human.
 */
import { json, fail, body, clientIp, normalisePhone, rateLimit, BUSINESS } from '../lib/config.js';
import { leadSave } from '../lib/db.js';
import { waReady, waNotifyOwner, waTemplate } from '../lib/whatsapp.js';
import { env } from '../lib/config.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  if (!rateLimit('lead_' + clientIp(req), 6, 10 * 60 * 1000)) {
    return fail(res, 'Too many submissions. Please call us instead.', 429);
  }

  const b = await body(req);
  if (b.company) return json(res, { ok: true, id: 'skipped' });   // honeypot

  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const msisdn = normalisePhone(b.phone);

  if (!name || name.length > 120) return fail(res, 'Please enter your name.');
  if (!msisdn) return fail(res, 'Please enter a valid Indian mobile number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 'Please enter a valid email.');
  if (!b.consent) return fail(res, 'Please accept the consent notice to proceed.');

  const lead = {
    name, phone: msisdn, email,
    role: String(b.role || '').trim(),
    propertyType: String(b.propertyType || '').trim(),
    budget: String(b.budget || '').trim(),
    location: String(b.location || '').trim(),
    message: String(b.message || '').slice(0, 2000).trim(),
    source: String(b.source || 'website').trim(),
    ip: clientIp(req),
  };

  const waText = encodeURIComponent(
    `New enquiry from the High Properties website\n\nName: ${name}\nPhone: +${msisdn}` +
    (email ? `\nEmail: ${email}` : '') +
    (lead.message ? `\nRequirement: ${lead.message}` : '')
  );
  const whatsapp = `https://wa.me/${BUSINESS.whatsapp}?text=${waText}`;

  let saved = null;
  try {
    saved = await leadSave(lead);
  } catch (e) {
    // Never lose the enquiry: tell the browser to hand it to WhatsApp instead.
    console.error('[highproperties] lead save failed:', e.message);
    return json(res, {
      ok: true, stored: false, whatsapp,
      message: 'Opening WhatsApp so your enquiry reaches us right away.',
    }, 200);
  }

  const automation = { owner: null, customer: null };
  if (waReady()) {
    automation.owner = await waNotifyOwner({ ...lead, id: saved.id });
    const tpl = env('WA_TEMPLATE_LEAD');
    if (tpl) automation.customer = await waTemplate(msisdn, tpl, [name, BUSINESS.name]);
  }

  return json(res, {
    ok: true, stored: true, id: saved.id, automation,
    whatsapp: `${whatsapp}${encodeURIComponent('\nRef: ' + saved.id)}`,
    message: 'Thanks — our team will call you shortly.',
  });
}
