// The Jarvis client SDK: one Jarvis, many clients. Any app (this portfolio, Perspective Engine once its
// source is connected, a future dashboard) talks to the same Jarvis on Siddharth's Mac through this,
// supplying only its name and a context adapter: what the user is looking at, as data. No assistant
// logic lives here; the Mac decides, remembers and acts. Visitors have no pairing token, so for them
// every call fails fast and the app falls back to whatever it does on its own.

export type JarvisContext = { url: string; title: string; section?: string; text?: string };

export type FeedItem = { icon: string; status: string; task_id: string; title: string; detail: string; at: string };
export type Activity = { summary: string; needs_you: FeedItem[]; running: FeedItem[]; done: FeedItem[]; failed: FeedItem[] };
export type NextStep = { id: string; title: string; due_in_days: number | null; blocked_on: string | null; link?: string | null };
export type Status = { recently_done: string[]; in_progress: string[]; next: NextStep[]; recent_changes?: string[] };
export type Notice = { at: string; kind: string; title: string; text: string; spoken: boolean; banner: boolean };

export type JarvisClientOptions = {
  /** Short client name, passed to Jarvis as context ("portfolio", "perspective-engine"). */
  application: string;
  /** What's on screen right now. Called per request; keep it cheap and free of secrets. */
  contextProvider: () => JarvisContext;
  /** Returns the pairing token, or null when this browser isn't paired. */
  token: () => string | null;
  /** The Mac gateway. Always loopback: the public web never gets a route to the Mac. */
  bridge?: string;
};

export type JarvisClient = {
  online(): Promise<boolean>;
  ask(text: string): Promise<string>;
  activity(): Promise<Activity>;
  status(): Promise<Status>;
  notifications(since?: string): Promise<Notice[]>;
};

export function createJarvis(opts: JarvisClientOptions): JarvisClient {
  const bridge = opts.bridge ?? "http://127.0.0.1:8765";
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(bridge)) throw new Error("Jarvis bridge must be a loopback address");

  async function call(path: string, init: RequestInit = {}, ms = 1500): Promise<Response> {
    const token = opts.token();
    if (!token) throw new Error("not paired");
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      return await fetch(`${bridge}${path}`, { ...init, signal: ctl.signal, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    } finally {
      clearTimeout(t);
    }
  }

  async function data<T>(path: string): Promise<T> {
    const r = await call(path, {}, 4000);
    if (!r.ok) throw new Error(`bridge ${r.status}`);
    return ((await r.json()) as { data: T }).data;
  }

  return {
    async online() {
      if (!opts.token()) return false;
      try {
        return (await call("/health")).ok;
      } catch {
        return false;
      }
    },
    async ask(text) {
      const page = { ...opts.contextProvider(), app: opts.application };
      // Agent turns can take a while (searching, reading), hence the long wait.
      const r = await call("/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, page }) }, 120_000);
      if (!r.ok) throw new Error(`bridge ${r.status}`);
      return ((await r.json()) as { reply?: string }).reply ?? "Done.";
    },
    activity: () => data<Activity>("/activity"),
    status: () => data<Status>("/status"),
    notifications: async (since = "") => (await data<Notice[]>("/notifications")).filter((n) => n.at > since),
  };
}
