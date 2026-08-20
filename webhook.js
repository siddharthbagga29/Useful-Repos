/**
 * WhatsApp Cloud API webhook.
 *   GET  — Meta's subscription handshake (hub.challenge)
 *   POST — inbound messages + delivery statuses, logged to Supabase
 *
 * Callback URL: https://www.highproperties.in/api/webhook
 */
import crypto from 'node:crypto';
import { env, rateLimit } from '../lib/config.js';
import { waLog } from '../lib/db.js';
import { waReady, waText, autoReplyFor } from '../lib/whatsapp.js';

export const config = { api: { bodyParser: false } };   // raw body needed for the signature

export default async function handler(req, res) {
  /* ── 1. subscription handshake ── */
  if (req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    const mode = q.get('hub.mode') || q.get('hub_mode');
    const token = q.get('hub.verify_token') || q.get('hub_verify_token');
    const challenge = q.get('hub.challenge') || q.get('hub_challenge');
    const expected = env('WA_VERIFY_TOKEN');

    if (mode === 'subscribe' && expected && token === expected) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      return res.end(String(challenge ?? ''));
    }
    res.statusCode = 403;
    return res.end('Verification failed');
  }

  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }

  /* ── 2. verify Meta's signature over the raw body ── */
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');

  // Fail CLOSED. Without a configured secret we cannot prove a POST came from
  // Meta, and this endpoint writes to the database — so refuse it outright
  // rather than accepting forged events.
  const appSecret = env('WA_APP_SECRET');
  if (!appSecret) {
    console.error('[highproperties] webhook POST refused: WA_APP_SECRET is not set');
    res.statusCode = 503;
    return res.end('Webhook not configured');
  }
  {
    const sig = String(req.headers['x-hub-signature-256'] || '');
    const mine = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(mine);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('[highproperties] webhook signature mismatch');
      res.statusCode = 403;
      return res.end();
    }
  }

  // Acknowledge immediately — Meta retries aggressively on anything but 200.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end('{"ok":true}');

  /* ── 3. process ── */
  try {
    const payload = JSON.parse(raw || '{}');
    const events = [];
    const replies = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const names = {};
        for (const c of v.contacts || []) names[c.wa_id] = c.profile?.name || '';

        for (const m of v.messages || []) {
          const from = String(m.from || '');
          const text = m.text?.body
            ?? m.button?.text
            ?? m.interactive?.list_reply?.title
            ?? m.interactive?.button_reply?.title
            ?? `[${m.type || 'message'}]`;

          events.push({
            id: 'WA-' + (m.id || crypto.randomBytes(4).toString('hex')),
            direction: 'in',
            wa_id: from,
            name: names[from] || '',
            text,
            type: m.type || 'text',
            created_at: new Date(Number(m.timestamp || Date.now() / 1000) * 1000).toISOString(),
          });

          const reply = autoReplyFor(text, names[from] || '');
          if (reply && waReady() && rateLimit('wa_reply_' + from, 4, 15 * 60 * 1000)) {
            replies.push(waText(from, reply));
          }
        }

        for (const s of v.statuses || []) {
          events.push({
            id: 'WS-' + (s.id || crypto.randomBytes(4).toString('hex')),
            direction: 'status',
            wa_id: String(s.recipient_id || ''),
            name: '',
            text: String(s.status || ''),
            type: 'status',
            created_at: new Date(Number(s.timestamp || Date.now() / 1000) * 1000).toISOString(),
          });
        }
      }
    }

    await Promise.allSettled([waLog(events), ...replies]);
  } catch (e) {
    console.error('[highproperties] webhook processing failed:', e.message);
  }
}
