// The Research City's single source of runtime truth: one store shared by the city, the explorer,
// the timeline and the case-study pages. It starts from the build-time evidence snapshot, refreshes
// the public GitHub Actions run lists at most once per 10 minutes per browser session, reads the
// Brain's committed state, derives staleness, validates and deduplicates everything through
// events.ts, and reduces it to one state per project.
//
// Rate limits: two unauthenticated API calls per session (60/hour/IP allowed). On any failure the
// snapshot stays and the source is reported as such; nothing is guessed.

import { useEffect, useSyncExternalStore } from "react";
import type { BrainState } from "../brain/engine.ts";
import { useBrain } from "../brain/useBrain.ts";
import { emptyStore, ingest, latestTime, reduce, staleData, stalePipeline, unseen, type CityEvent, type EventStore, type ProjectState } from "./events.ts";
import { PROJECTS, type ProjectId } from "./manifest.ts";
import { brainEvents, buildEvents, commitEvents, demoScript, runEvents, WORKFLOWS, type Evidence, type WorkflowId, type WorkflowRun } from "./sources.ts";
import evidenceJson from "./evidence.json";

const EVIDENCE = evidenceJson as unknown as Evidence;
const TTL = 10 * 60e3;
const MARKER = "rc:seen";

export type SourceState = "live" | "cached" | "build" | "unavailable";

export interface Feed {
  store: EventStore;
  states: Record<ProjectId, ProjectState>;
  brain: BrainState | null;
  brainSource: "live" | "site" | "unavailable" | "loading";
  sources: Record<WorkflowId, { state: SourceState; at?: string; note?: string }>;
  evidence: Evidence;
  /** newest real events the visitor hasn't seen yet, oldest first: what the city animates */
  queue: CityEvent[];
  demo: boolean;
  now: number;
}

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const DEMO = params.get("demo") === "events";
const automated = typeof navigator !== "undefined" && navigator.webdriver && !params.has("live");

const pipelines = new Set<ProjectId>(PROJECTS.filter((p) => p.pipeline !== "none").map((p) => p.id));

function initialRuns(): Record<WorkflowId, WorkflowRun[]> {
  const out = {} as Record<WorkflowId, WorkflowRun[]>;
  for (const w of WORKFLOWS) {
    const v = EVIDENCE.workflows[w.id];
    out[w.id] = v && "runs" in v ? v.runs : [];
  }
  return out;
}

let runs = initialRuns();
let sources = Object.fromEntries(
  WORKFLOWS.map((w) => {
    const v = EVIDENCE.workflows[w.id];
    return [w.id, v && "runs" in v ? { state: "build", at: v.fetchedAt } : { state: "unavailable", note: v && "unavailable" in v ? v.unavailable : "not in snapshot" }];
  }),
) as Feed["sources"];
let brain: BrainState | null = null;
let brainSource: Feed["brainSource"] = "loading";
let demoEvents: unknown[] = [];
let snapshot: Feed | null = null;
let queue: CityEvent[] = [];
const subs = new Set<() => void>();

function readMarker(): string | null {
  try {
    return localStorage.getItem(MARKER);
  } catch {
    return null;
  }
}
function writeMarker(v: string) {
  try {
    localStorage.setItem(MARKER, v);
  } catch {
    /* private mode: animations simply won't be remembered */
  }
}
let marker: string | null = readMarker();

function compute(): Feed {
  const now = Date.now();
  const raw: unknown[] = [...buildEvents(EVIDENCE), ...commitEvents(EVIDENCE.commits), ...brainEvents(brain)];
  for (const w of WORKFLOWS) raw.push(...runEvents(w.id, runs[w.id], now));
  let { store } = ingest(emptyStore(), raw);
  // derived: schedule and data staleness, from the reduced real state
  const first = reduce(store.events, pipelines);
  const derived: unknown[] = [];
  for (const w of WORKFLOWS) if (w.everyHours) derived.push(stalePipeline(w.projectId, first[w.projectId].lastSuccess, w.everyHours, now));
  for (const p of PROJECTS) derived.push(staleData(p.id, p.data.asOf, p.data.staleAfterDays, now));
  store = ingest(store, derived.filter(Boolean)).store;
  if (DEMO && demoEvents.length) store = ingest(store, demoEvents).store;
  const states = reduce(store.events, pipelines);

  // animation queue: real events newer than the visitor's marker. A first visit marks "now", so
  // everything that happened before it (including records that load a moment later) counts as seen.
  const latest = latestTime(store.events.filter((e) => !e.demo));
  if (marker === null) {
    marker = new Date(now).toISOString();
    writeMarker(marker);
  } else {
    const fresh = unseen(store.events, marker).slice(0, 3).reverse();
    if (fresh.length) {
      queue = [...queue, ...fresh.filter((e) => !queue.some((q) => q.eventId === e.eventId))];
      if (latest > marker) marker = latest;
      writeMarker(marker);
    }
  }
  return { store, states, brain, brainSource, sources, evidence: EVIDENCE, queue, demo: DEMO, now };
}

function emit() {
  snapshot = compute();
  for (const f of subs) f();
}

const cacheKey = (id: WorkflowId) => `rc:runs:${id}`;

async function refresh(w: (typeof WORKFLOWS)[number]) {
  try {
    const c = JSON.parse(sessionStorage.getItem(cacheKey(w.id)) ?? "null") as { at: number; runs: WorkflowRun[] } | null;
    if (c && Date.now() - c.at < TTL && Array.isArray(c.runs)) {
      runs = { ...runs, [w.id]: mergeRuns(runs[w.id], c.runs) };
      sources = { ...sources, [w.id]: { state: "cached", at: new Date(c.at).toISOString() } };
      return;
    }
  } catch {
    /* no session storage: fetch */
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://api.github.com/repos/${w.repo}/actions/workflows/${w.file}/runs?per_page=30`, { signal: ctl.signal, headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? "GitHub API rate limit reached" : `GitHub API ${r.status}`);
    const j = (await r.json()) as { workflow_runs?: Record<string, unknown>[] };
    const fresh = (j.workflow_runs ?? []).map(toRun).filter((x): x is WorkflowRun => !!x);
    runs = { ...runs, [w.id]: mergeRuns(runs[w.id], fresh) };
    sources = { ...sources, [w.id]: { state: "live", at: new Date().toISOString() } };
    try {
      sessionStorage.setItem(cacheKey(w.id), JSON.stringify({ at: Date.now(), runs: fresh }));
    } catch {
      /* ignore */
    }
  } catch (e) {
    const prev = sources[w.id];
    sources = { ...sources, [w.id]: { ...prev, note: `Live refresh failed: ${(e as Error).name === "AbortError" ? "timed out" : (e as Error).message}. Showing the build snapshot.` } };
  } finally {
    clearTimeout(timer);
  }
}

function toRun(r: Record<string, unknown>): WorkflowRun | null {
  const id = Number(r.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    number: Number(r.run_number),
    attempt: Number(r.run_attempt ?? 1),
    event: String(r.event),
    status: String(r.status),
    conclusion: r.conclusion == null ? null : String(r.conclusion),
    startedAt: String(r.run_started_at ?? r.created_at),
    updatedAt: String(r.updated_at),
    sha: String(r.head_sha),
    branch: String(r.head_branch),
    url: String(r.html_url),
  };
}

/** Newer records of the same run replace older ones; history from the snapshot is kept. */
function mergeRuns(a: WorkflowRun[], b: WorkflowRun[]): WorkflowRun[] {
  const m = new Map<string, WorkflowRun>();
  for (const r of [...a, ...b]) {
    const k = `${r.id}:${r.attempt}`;
    const prev = m.get(k);
    if (!prev || r.updatedAt >= prev.updatedAt) m.set(k, r);
  }
  return [...m.values()].sort((x, y) => y.startedAt.localeCompare(x.startedAt)).slice(0, 60);
}

let started = false;
function start() {
  if (started) return;
  started = true;
  if (!automated) void Promise.all(WORKFLOWS.map(refresh)).then(emit);
  if (DEMO) {
    const t0 = Date.now();
    for (const d of demoScript(t0))
      setTimeout(() => {
        demoEvents = [...demoEvents, d.event];
        const e = ingest(emptyStore(), [d.event]).store.events[0];
        if (e) queue = [...queue, e];
        emit();
      }, d.at);
  }
  // re-derive staleness every minute without refetching
  setInterval(emit, 60e3);
}

/** Mark an animation as played so it leaves the queue. */
export function consume(eventId: string) {
  queue = queue.filter((e) => e.eventId !== eventId);
  emit();
}

/** Explicit user request: replay the newest real event (it is labelled as a replay). */
export function replayLatest(projectId?: ProjectId) {
  const e = snapshot?.store.events.find((x) => !x.demo && x.source !== "derived" && x.source !== "git" && (!projectId || x.projectId === projectId));
  if (!e) return null;
  queue = [...queue.filter((q) => q.eventId !== e.eventId), e];
  emit();
  return e;
}

export function useCityFeed(): Feed {
  const b = useBrain(0);
  useEffect(() => {
    start();
  }, []);
  useEffect(() => {
    const next = b.data?.state ?? null;
    const src: Feed["brainSource"] = b.data ? b.data.source : b.failed ? "unavailable" : "loading";
    if (next !== brain || src !== brainSource) {
      brain = next;
      brainSource = src;
      emit();
    }
  }, [b.data, b.failed]);
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => (snapshot ??= compute()),
    () => (snapshot ??= compute()),
  );
}

export const ago = (iso: string | undefined, now = Date.now()) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 90) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

export const when = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "—";
