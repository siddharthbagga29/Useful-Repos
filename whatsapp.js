/**
 * WhatsApp Business Cloud API (Meta Graph).
 *
 * Every function no-ops safely when unconfigured, so the site keeps working
 * and the front-end falls back to click-to-chat links.
 */
import { env, BUSINESS, normalisePhone } from './config.js';

export const waReady = () =>
  Boolean(env('WA_PHONE_NUMBER_ID') && env('WA_ACCESS_TOKEN'));

async function post(payload) {
  if (!waReady()) return { ok: false, skipped: 'whatsapp not configured' };
  const url = `https://graph.facebook.com/${env('WA_API_VERSION', 'v21.0')}/${env('WA_PHONE_NUMBER_ID')}/messages`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('WA_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) console.error('[highproperties] WA API', r.status, JSON.stringify(data));
    return { ok: r.ok, status: r.status, response: data };
  } catch (e) {
    console.error('[highproperties] WA request failed:', e.message);
    return { ok: false, error: e.message };
  }
}

/** Free-form text — only delivered inside an open 24-hour service window. */
export function waText(to, text) {
  const n = normalisePhone(to);
  if (!n) return Promise.resolve({ ok: false, error: 'invalid number' });
  return post({
    messaging_product: 'whatsapp',
    to: n,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

/** Approved template — the only way to open a conversation with a new lead. */
export function waTemplate(to, template, params = [], lang = 'en') {
  const n = normalisePhone(to);
  if (!n) return Promise.resolve({ ok: false, error: 'invalid number' });
  const payload = {
    messaging_product: 'whatsapp',
    to: n,
    type: 'template',
    template: { name: template, language: { code: lang } },
  };
  if (params.length) {
    payload.template.components = [{
      type: 'body',
      parameters: params.map((p) => ({ type: 'text', text: String(p) })),
    }];
  }
  return post(payload);
}

export function waNotifyOwner(lead) {
  const to = env('WA_OWNER_MSISDN', BUSINESS.whatsapp);
  const lines = [
    '🔔 New website enquiry',
    `Name: ${lead.name || '—'}`,
    `Phone: ${lead.phone || '—'}`,
    `Email: ${lead.email || '—'}`,
    `Looking for: ${[lead.propertyType, lead.budget].filter(Boolean).join(' ') || '—'}`,
    `Area: ${lead.location || '—'}`,
    `Note: ${lead.message || '—'}`,
    `Ref: ${lead.id || '—'}`,
  ];
  return waText(to, lines.join('\n'));
}

/** Keyword menu used by the inbound webhook. */
export function autoReplyFor(text, name = '') {
  const t = String(text || '').toLowerCase().trim();
  const first = name ? ' ' + String(name).trim().split(' ')[0] : '';
  if (/\b(hi|hello|hey|namaste)\b/.test(t))
    return `Hello${first}! 👋 This is ${BUSINESS.name} — ${BUSINESS.tagline}.\n\n`
         + 'Reply with a number:\n1️⃣ Buy a property\n2️⃣ Sell / list my property\n'
         + '3️⃣ Rent or lease\n4️⃣ Construction & collaboration\n\n'
         + 'Or just tell us the location and budget you have in mind.';
  if (/^1\b|\bbuy\b|\bpurchase\b/.test(t))
    return "Great — what's your budget range and preferred sector? We cover Dwarka Expressway, "
         + 'Golf Course Extension, New Gurugram and the wider NCR.';
  if (/^2\b|\bsell\b|\blist\b/.test(t))
    return 'We can help you sell. Share the property type, sector and approximate size — '
         + "we'll send a free valuation and a pricing plan.";
  if (/^3\b|\brent\b|\blease\b/.test(t))
    return 'Noted — rental. Please share your budget, preferred locality and move-in date.';
  if (/^4\b|\bconstruct|\bcollab/.test(t))
    return 'We do turnkey construction and land collaboration. Share the plot size and location '
         + 'and our team will call you.';
  if (/\b(price|rate|cost|kitna|value)\b/.test(t))
    return 'Happy to help with pricing. Which sector and property type are you asking about?';
  return null;
}
