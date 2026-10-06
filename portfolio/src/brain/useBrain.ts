import { useEffect, useState } from "react";
import type { BrainState } from "./engine.ts";

// The scheduled workflow commits brain/state.json to the Pages repository every 6 hours. Reading it
// from raw.githubusercontent.com shows the newest generation even before Pages republishes; the copy
// served with the site is the fallback.
const LIVE = "https://raw.githubusercontent.com/siddharthbagga29/siddharthbagga29.github.io/main/brain/state.json";
const LOCAL = `${import.meta.env.BASE_URL}brain/state.json`;

let cache: Promise<{ state: BrainState; source: "live" | "site" } | null> | null = null;

async function load(): Promise<{ state: BrainState; source: "live" | "site" } | null> {
  const get = async (url: string) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const s = (await r.json()) as BrainState;
    if (s.version !== 1 || !s.champion) throw new Error("bad state");
    return s;
  };
  const isLocalHost = /^(localhost|127\.)/.test(location.hostname);
  const [live, site] = await Promise.allSettled([isLocalHost ? Promise.reject(new Error("dev")) : get(LIVE), get(LOCAL)]);
  const a = live.status === "fulfilled" ? live.value : null;
  const b = site.status === "fulfilled" ? site.value : null;
  if (a && (!b || a.generation >= b.generation)) return { state: a, source: "live" };
  return b ? { state: b, source: "site" } : null;
}

export function useBrain(pollMs = 0) {
  const [data, setData] = useState<{ state: BrainState; source: "live" | "site" } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const run = (fresh: boolean) => {
      if (fresh || !cache) cache = load();
      cache.then((d) => alive && (d ? setData(d) : setFailed(true))).catch(() => alive && setFailed(true));
    };
    run(false);
    const id = pollMs ? setInterval(() => run(true), pollMs) : 0;
    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
  }, [pollMs]);
  return { data, failed };
}

export const NEXT_RUN_HOURS = 6;
export function nextRun(lastRun: string): string {
  const due = new Date(lastRun).getTime() + NEXT_RUN_HOURS * 3600e3;
  const mins = Math.round((due - Date.now()) / 60e3);
  if (mins <= 0) return "due now";
  return mins >= 60 ? `in ~${Math.round(mins / 60)} h` : `in ~${mins} min`;
}
