/**
 * Generate a password hash for a staff account.
 *   npm run hash -- "your-strong-password"
 * Paste the output into BOOTSTRAP_HASH (Vercel env var).
 */
import { hashPassword } from '../lib/auth.js';
const pw = process.argv[2];
if (!pw) { console.error('Usage: npm run hash -- "your-password"'); process.exit(1); }
if (pw.length < 10) { console.error('Use at least 10 characters.'); process.exit(1); }
console.log(hashPassword(pw));
