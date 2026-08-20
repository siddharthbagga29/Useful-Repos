/**
 * Staff auth: /api/auth?action=me|login|logout|staff_list|staff_add|staff_remove
 * Credentials never reach the browser — only an httpOnly session cookie does.
 */
import { json, fail, body, clientIp, rateLimit } from '../lib/config.js';
import {
  hashPassword, verifyPassword, setSession, clearSession,
  currentUser, requireRole, findAccount,
} from '../lib/auth.js';
import { staffAll, staffAdd, staffRemove, dbReady } from '../lib/db.js';
import { env } from '../lib/config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  const action = new URL(req.url, 'http://x').searchParams.get('action') || 'me';

  try {
    if (action === 'me') {
      const u = currentUser(req);
      return json(res, { ok: true, user: u ? { username: u.username, role: u.role } : null });
    }

    if (action === 'logout') {
      clearSession(res);
      return json(res, { ok: true });
    }

    if (action === 'login') {
      if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);
      if (!rateLimit('login_' + clientIp(req), 8, 15 * 60 * 1000)) {
        return fail(res, 'Too many attempts. Try again in 15 minutes.', 429);
      }
      const b = await body(req);
      const username = String(b.username || '').toLowerCase().trim();
      const password = String(b.password || b.passcode || '');

      if (!env('BOOTSTRAP_HASH') && !dbReady()) {
        return fail(res, 'No staff accounts configured. Set BOOTSTRAP_USER and BOOTSTRAP_HASH.', 503);
      }

      const acct = await findAccount(username);
      if (acct && verifyPassword(password, acct.hash)) {
        const user = { username: acct.username, role: acct.role || 'staff' };
        setSession(res, user);
        return json(res, { ok: true, user });
      }
      await sleep(150 + Math.floor(Math.random() * 250));  // blunt brute-force signal
      return fail(res, 'Invalid username or password', 401);
    }

    if (action === 'staff_list') {
      if (!requireRole(req, res, 'admin')) return;
      const rows = (await staffAll()).map((s) => ({
        username: s.username, role: s.role || 'staff', managed: true,
      }));
      const bu = env('BOOTSTRAP_USER').toLowerCase().trim();
      if (bu && !rows.some((r) => r.username === bu)) {
        rows.push({ username: bu, role: 'admin', managed: false });
      }
      return json(res, { ok: true, staff: rows });
    }

    if (action === 'staff_add') {
      if (!requireRole(req, res, 'admin')) return;
      if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);
      const b = await body(req);
      const username = String(b.username || '').toLowerCase().trim();
      const password = String(b.password || '');
      const role = b.role === 'admin' ? 'admin' : 'staff';

      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return fail(res, 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore.');
      }
      if (password.length < 10) return fail(res, 'Password must be at least 10 characters.');
      if (await findAccount(username)) return fail(res, 'That username already exists.');

      await staffAdd(username, hashPassword(password), role);
      return json(res, { ok: true, username, role });
    }

    if (action === 'staff_remove') {
      const me = requireRole(req, res, 'admin');
      if (!me) return;
      if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);
      const username = String((await body(req)).username || '').toLowerCase().trim();
      if (username === me.username) return fail(res, 'You cannot remove your own account.');
      await staffRemove(username);
      return json(res, { ok: true });
    }

    return fail(res, 'Unknown action', 404);
  } catch (e) {
    console.error('[highproperties] auth:', e.message);
    return fail(res, e.message.includes('SESSION_SECRET')
      ? 'Server not configured: SESSION_SECRET is missing.' : 'Authentication error', 500);
  }
}
