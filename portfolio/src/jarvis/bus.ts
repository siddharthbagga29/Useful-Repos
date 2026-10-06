// Skills reach the rest of the page through this tiny typed bus (no global state library).
import type { StationId } from "../data/site.ts";

export type BusEvent =
  | { type: "navigate"; station: StationId }
  | { type: "set_dcf"; wacc?: number; g?: number }
  | { type: "open_jarvis"; agent?: "chat" | "digest" | "research" }
  | { type: "close_jarvis" }
  | { type: "open_connect"; intent?: "hiring" | "network" | "deal" | "other" }
  | { type: "open_schedule" }
  | { type: "tap" };

type Fn = (e: BusEvent) => void;
const subs = new Set<Fn>();

export const bus = {
  emit(e: BusEvent) {
    for (const f of subs) f(e);
  },
  on(f: Fn) {
    subs.add(f);
    return () => void subs.delete(f);
  },
};
