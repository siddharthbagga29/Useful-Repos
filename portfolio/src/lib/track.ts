// First-party interaction signals for the Positioning OS sheet (Google Apps Script web app).
// Anonymous by default: a random per-tab session id, the page, the event name and a few
// non-personal properties. Personal details are sent only when a visitor submits the
// "Get in touch" form, which says so next to the Send button. Nothing is sent when the
// webhook isn't configured, and failures are silent — tracking never breaks the page.

import { INTEGRATIONS } from "../data/site.ts";

export type EventName =
  | "page_view"
  | "section_view"
  | "jarvis_ask"
  | "connect_open"
  | "lead"
  | "calendly_view"
  | "calendly_booked"
  | "lab_run"
  | "resume_open"
  | "visitor_signal";

export interface Lead {
  name: string;
  email: string;
  company?: string;
  role?: string;
  reason?: string;
  message?: string;
}

const SID_KEY = "sb.sid";

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 18);
      sessionStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return "nostorage";
  }
}

const seen = new Set<string>();
let queue: Record<string, unknown>[] = [];
let timer: number | undefined;

function flush() {
  timer = undefined;
  if (!queue.length || !INTEGRATIONS.sheetsWebhook) return;
  const body = JSON.stringify({ v: 1, sid: sessionId(), page: location.pathname, ref: document.referrer.slice(0, 200), events: queue });
  queue = [];
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" }); // text/plain avoids a CORS preflight
  try {
    if (navigator.sendBeacon?.(INTEGRATIONS.sheetsWebhook, blob)) return;
  } catch {
    /* fall through */
  }
  void fetch(INTEGRATIONS.sheetsWebhook, { method: "POST", mode: "no-cors", keepalive: true, body }).catch(() => {});
}

/** Record an event. `once` de-duplicates per page load (e.g. one section_view per section). */
export function track(event: EventName, props: Record<string, string | number | boolean> = {}, once = false) {
  if (!INTEGRATIONS.sheetsWebhook) return;
  const key = `${event}:${JSON.stringify(props)}`;
  if (once) {
    if (seen.has(key)) return;
    seen.add(key);
  }
  queue.push({ event, at: new Date().toISOString(), ...props });
  if (event === "lead" || event === "calendly_booked") flush();
  else if (!timer) timer = window.setTimeout(flush, 4000);
}

/** A visitor who chose to send their details. Goes to People CRM / Target Companies / Opportunities. */
export function trackLead(lead: Lead) {
  if (!INTEGRATIONS.sheetsWebhook) return;
  queue.push({ event: "lead", at: new Date().toISOString(), lead });
  flush();
}

if (typeof window !== "undefined") {
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

/** Cloudflare Web Analytics beacon — cookieless, free. Injected only when a token is configured. */
export function loadAnalytics() {
  if (!INTEGRATIONS.cfBeacon || document.querySelector("script[data-cf-beacon]")) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: INTEGRATIONS.cfBeacon }));
  document.head.appendChild(s);
}
