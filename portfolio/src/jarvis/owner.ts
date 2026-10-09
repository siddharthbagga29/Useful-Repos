// The owner link. When Siddharth opens his own site on his Mac with `jarvis-owner --serve` running,
// the Jarvis console talks to that Jarvis (his tools, memory, research and status) instead of the
// public engine. Pairing is one click on the link the Mac prints (…/#pair-<token>); the token is kept
// in this browser only. Visitors have no token, so for them nothing changes and nothing reaches his Mac.

import { createJarvis, type JarvisClient } from "./sdk.ts";

const KEY = "jv-owner-token";

const store = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(v: string | null) {
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode: pairing lasts for this page only */
    }
  },
};

let memToken: string | null = null;

/** Take a token from #pair-<token> once, then scrub it from the address bar. Runs at load. */
export function pairFromHash(): boolean {
  if (typeof location === "undefined") return false;
  const m = /^#pair-([A-Za-z0-9_-]{16,64})$/.exec(location.hash);
  if (!m) return false;
  memToken = m[1]!;
  store.set(memToken);
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}
pairFromHash();

export const ownerToken = (): string | null => memToken ?? store.get();

export function unpair() {
  memToken = null;
  store.set(null);
}

/** What's on screen, so "open this", "what's this section", "follow up on that" mean something. */
export function pageContext(): { url: string; title: string; section: string; text: string } {
  const active = document.querySelector<HTMLElement>(".dots button[aria-current=true]")?.getAttribute("aria-label") ?? "";
  const panel = [...document.querySelectorAll<HTMLElement>("[data-station]")].find((el) => {
    const r = el.getBoundingClientRect();
    return r.left < innerWidth / 2 && r.right > innerWidth / 2 && r.top < innerHeight / 2 && r.bottom > innerHeight / 2;
  });
  const text = (panel?.innerText ?? document.body.innerText).replace(/\s+/g, " ").slice(0, 1500);
  return { url: location.href, title: document.title, section: active, text };
}

/** The portfolio is one client of the shared Jarvis (sdk.ts); this page supplies only its context. */
export const jarvis: JarvisClient = createJarvis({ application: "portfolio", contextProvider: pageContext, token: ownerToken });

/** Ask the Mac's Jarvis. */
export const askOwner = (text: string): Promise<string> => jarvis.ask(text);

/** Is Jarvis running on this Mac and paired with this browser? Quiet and quick when he isn't. */
export const ownerOnline = (): Promise<boolean> => jarvis.online();
