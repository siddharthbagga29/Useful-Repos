// Voice-call payloads for the owner's briefing, and a sender that is off unless explicitly enabled.
//
// Payload files carry placeholders ({{OWNER_PHONE}}, {{VAPI_PHONE_NUMBER_ID}}) instead of numbers or
// keys; they are filled from the environment only at send time, so nothing private is committed.
// Twilio's Calls API + TwiML (<Say> with SSML <break>, <Pause>) is the reference format. The Bland and
// Vapi shapes follow their public docs; verify them against the current docs before enabling.

import { parseScript } from "../jarvis/sales/markup.ts";
import { RateLimiter, withRetry } from "./ratelimit.ts";
import type { VoicePayloads } from "./types.ts";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildPayloads(script: string, plain: string): VoicePayloads {
  const segs = parseScript(script);
  let say = "";
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  for (const s of segs) {
    say += xml(s.text);
    if (s.pauseAfterMs >= 1000) {
      twiml += `<Say voice="Polly.Matthew-Neural">${say}</Say><Pause length="1"/>`;
      say = "";
    } else if (s.pauseAfterMs > 0) say += ` <break time="${s.pauseAfterMs}ms"/> `;
    else say += " ";
  }
  if (say.trim()) twiml += `<Say voice="Polly.Matthew-Neural">${say.trim()}</Say>`;
  twiml += "</Response>";

  const first = segs.slice(0, 2).map((s) => s.text).join(" ");
  const bland = {
    phone_number: "{{OWNER_PHONE}}",
    first_sentence: first,
    task: `You are Jarvis, Siddharth's executive assistant, calling with his briefing. Read this briefing in a calm, natural voice with short pauses, then ask if he wants anything moved: ${plain}`,
    wait_for_greeting: true,
    max_duration: 3,
    record: false,
  };
  const vapi = {
    phoneNumberId: "{{VAPI_PHONE_NUMBER_ID}}",
    customer: { number: "{{OWNER_PHONE}}" },
    assistant: {
      firstMessage: plain,
      endCallMessage: "That's everything. Talk soon.",
      maxDurationSeconds: 180,
    },
  };
  return { twiml, bland, vapi };
}

const PHONE = /\+?\d[\d\s().-]{8,}\d/;
const SECRET = /(sk-|AC[0-9a-f]{32}|Bearer\s|api[_-]?key)/i;

/** Structural checks the critic relies on. Returns a list of problems (empty = valid). */
export function validatePayloads(p: VoicePayloads): string[] {
  const out: string[] = [];
  if (!p.twiml.startsWith("<?xml") || !p.twiml.includes("<Response>") || !p.twiml.endsWith("</Response>")) out.push("twiml: not a <Response> document");
  const opens = (p.twiml.match(/<Say\b/g) ?? []).length;
  const closes = (p.twiml.match(/<\/Say>/g) ?? []).length;
  if (opens === 0 || opens !== closes) out.push("twiml: unbalanced <Say>");
  if (p.twiml.length > 4000) out.push("twiml: over Twilio's 4,000-character limit");
  const bland = p.bland as Record<string, unknown>;
  for (const k of ["phone_number", "task", "first_sentence"]) if (typeof bland[k] !== "string" || !bland[k]) out.push(`bland: ${k} missing`);
  const vapi = p.vapi as { customer?: { number?: unknown }; assistant?: { firstMessage?: unknown }; phoneNumberId?: unknown };
  if (typeof vapi.phoneNumberId !== "string" || typeof vapi.customer?.number !== "string" || typeof vapi.assistant?.firstMessage !== "string") out.push("vapi: phoneNumberId, customer.number and assistant.firstMessage required");
  const all = JSON.stringify(p);
  if (PHONE.test(all.replace(/\{\{\w+\}\}/g, ""))) out.push("payloads contain a literal phone number; use {{OWNER_PHONE}}");
  if (SECRET.test(all)) out.push("payloads contain something that looks like a credential");
  return out;
}

export interface SendResult {
  sent: boolean;
  reason: string;
}

const callLimiter = new RateLimiter(1, 6 * 3_600_000); // at most one call per 6 hours per process

function fill(s: string, env: NodeJS.ProcessEnv): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => env[k] ?? "");
}

class HttpError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
  }
}
const retryable = (e: unknown) => !(e instanceof HttpError) || e.status === 429 || e.status >= 500;

/**
 * Places the briefing call through Twilio. Off unless JARVIS_VOICE_SEND=1 and the Twilio
 * credentials, OWNER_PHONE and TWILIO_FROM are set; retries 429/5xx/network errors with backoff.
 */
export async function sendTwilio(p: VoicePayloads, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  if (env.JARVIS_VOICE_SEND !== "1") return { sent: false, reason: "dry run (set JARVIS_VOICE_SEND=1 to call)" };
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !env.OWNER_PHONE || !env.TWILIO_FROM) return { sent: false, reason: "missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM or OWNER_PHONE" };
  if (!callLimiter.take()) return { sent: false, reason: "rate limited: one call per 6 hours" };
  const body = new URLSearchParams({ To: env.OWNER_PHONE, From: env.TWILIO_FROM, Twiml: fill(p.twiml, env) });
  await withRetry(
    async () => {
      const r = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new HttpError(r.status, await r.text());
      return r;
    },
    { retries: 3, baseMs: 500, maxMs: 8_000, retryable },
  );
  return { sent: true, reason: "call placed" };
}
