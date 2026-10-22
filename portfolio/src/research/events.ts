// The city's event model. Every meaningful movement in the Research City is the reaction to one of
// these records, and every record comes from a verifiable source: a GitHub Actions run, the Brain's
// committed state, a git commit, a check run at build time, or a rule derived from those (data or a
// schedule going stale). Pure TypeScript, no DOM: tested under Node (events.test.ts).
//
// One event updates one canonical state (reduce), and every component reads that state. No component
// interprets an event on its own.

import { PROJECTS, type ProjectId } from "./manifest.ts";

export const SCHEMA_VERSION = 1;
export const MAX_EVENTS = 200;

export const EVENT_TYPES = [
  "research_run_started",
  "research_run_succeeded",
  "research_run_failed",
  "test_suite_succeeded",
  "test_suite_failed",
  "release_gate_passed",
  "release_gate_failed",
  "candidate_promoted",
  "dataset_stale",
  "pipeline_stale",
  "change_committed",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EventSource = "github-actions" | "brain-state" | "git" | "build" | "derived" | "demo";

export interface CityEvent {
  eventId: string;
  projectId: ProjectId;
  eventType: EventType;
  occurredAt: string; // ISO-8601
  source: EventSource;
  status: "started" | "succeeded" | "failed" | "info" | "warning";
  title: string;
  detail?: string;
  sourceRunId?: string;
  commitSha?: string;
  url?: string;
  metrics?: Record<string, number>;
  /** simulated for demonstration; never mixed into real state unless the page is in demo mode */
  demo?: boolean;
  schemaVersion: 1;
}

const STATUS_OF: Record<EventType, CityEvent["status"]> = {
  research_run_started: "started",
  research_run_succeeded: "succeeded",
  research_run_failed: "failed",
  test_suite_succeeded: "succeeded",
  test_suite_failed: "failed",
  release_gate_passed: "succeeded",
  release_gate_failed: "failed",
  candidate_promoted: "info",
  dataset_stale: "warning",
  pipeline_stale: "warning",
  change_committed: "info",
};

const PROJECT_IDS = new Set<string>(PROJECTS.map((p) => p.id));
const TYPES = new Set<string>(EVENT_TYPES);
const SOURCES = new Set<string>(["github-actions", "brain-state", "git", "build", "derived", "demo"]);
const LINK_HOSTS = new Set(["github.com", "raw.githubusercontent.com", "siddharthbagga29.github.io", "drive.google.com"]);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** A link is kept only if it is https on a known host, or a path on this site. */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== "string" || u.length > 500) return undefined;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && LINK_HOSTS.has(url.hostname) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const str = (v: unknown, max = 400) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined);

export type Rejection = { reason: string; eventId?: string };

/** Validate one untrusted record. Unknown or malformed events are rejected with a reason, never thrown. */
export function validateEvent(raw: unknown): { ok: true; event: CityEvent } | { ok: false; rejection: Rejection } {
  if (!raw || typeof raw !== "object") return { ok: false, rejection: { reason: "not an object" } };
  const r = raw as Record<string, unknown>;
  const eventId = str(r.eventId, 160);
  const no = (reason: string) => ({ ok: false as const, rejection: { reason, eventId } });
  if (!eventId) return no("missing eventId");
  if (r.schemaVersion !== SCHEMA_VERSION) return no(`unsupported schemaVersion ${String(r.schemaVersion)}`);
  if (typeof r.projectId !== "string" || !PROJECT_IDS.has(r.projectId)) return no(`unknown project ${String(r.projectId)}`);
  if (typeof r.eventType !== "string" || !TYPES.has(r.eventType)) return no(`unknown event type ${String(r.eventType)}`);
  if (typeof r.source !== "string" || !SOURCES.has(r.source)) return no(`unknown source ${String(r.source)}`);
  const occurredAt = str(r.occurredAt, 40);
  if (!occurredAt || !ISO.test(occurredAt) || Number.isNaN(Date.parse(occurredAt))) return no("invalid occurredAt");
  const title = str(r.title, 240);
  if (!title) return no("missing title");
  const eventType = r.eventType as EventType;
  const metrics: Record<string, number> = {};
  if (r.metrics && typeof r.metrics === "object")
    for (const [k, v] of Object.entries(r.metrics as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v) && k.length <= 40) metrics[k] = v;
  const event: CityEvent = {
    eventId,
    projectId: r.projectId as ProjectId,
    eventType,
    occurredAt: new Date(occurredAt).toISOString(),
    source: r.source as EventSource,
    status: STATUS_OF[eventType],
    title,
    schemaVersion: 1,
  };
  const detail = str(r.detail, 600);
  if (detail) event.detail = detail;
  const run = str(r.sourceRunId, 40);
  if (run) event.sourceRunId = run;
  const sha = str(r.commitSha, 40);
  if (sha && /^[0-9a-f]{7,40}$/.test(sha)) event.commitSha = sha;
  const url = safeUrl(r.url);
  if (url) event.url = url;
  if (Object.keys(metrics).length) event.metrics = metrics;
  if (r.demo === true || event.source === "demo") event.demo = true;
  return { ok: true, event };
}

const byTimeDesc = (a: CityEvent, b: CityEvent) => b.occurredAt.localeCompare(a.occurredAt) || a.eventId.localeCompare(b.eventId);

export interface EventStore {
  events: CityEvent[]; // newest first, unique by eventId, at most MAX_EVENTS
  rejected: Rejection[];
}

export const emptyStore = (): EventStore => ({ events: [], rejected: [] });

/** Add records to the store: validate, drop duplicates, keep the newest MAX_EVENTS. Returns what was new. */
export function ingest(store: EventStore, raw: unknown[], max = MAX_EVENTS): { store: EventStore; added: CityEvent[] } {
  const seen = new Set(store.events.map((e) => e.eventId));
  const added: CityEvent[] = [];
  const rejected = [...store.rejected];
  for (const r of raw) {
    const v = validateEvent(r);
    if (!v.ok) {
      rejected.push(v.rejection);
      continue;
    }
    if (seen.has(v.event.eventId)) continue;
    seen.add(v.event.eventId);
    added.push(v.event);
  }
  const events = [...store.events, ...added].sort(byTimeDesc).slice(0, max);
  const kept = new Set(events.map((e) => e.eventId));
  return { store: { events, rejected: rejected.slice(-50) }, added: added.filter((e) => kept.has(e.eventId)).sort(byTimeDesc) };
}

// ---------------------------------------------------------------- state machine

export type Execution = "idle" | "running" | "succeeded" | "failed" | "stale" | "unavailable";
type Signal = "start" | "success" | "failure" | "stale";

/** Explicit transitions. A stale signal never hides a failure, and never interrupts a running job. */
export const TRANSITIONS: Record<Execution, Record<Signal, Execution>> = {
  idle: { start: "running", success: "succeeded", failure: "failed", stale: "stale" },
  unavailable: { start: "running", success: "succeeded", failure: "failed", stale: "stale" },
  running: { start: "running", success: "succeeded", failure: "failed", stale: "running" },
  succeeded: { start: "running", success: "succeeded", failure: "failed", stale: "stale" },
  failed: { start: "running", success: "succeeded", failure: "failed", stale: "failed" },
  stale: { start: "running", success: "succeeded", failure: "failed", stale: "stale" },
};

const SIGNAL: Partial<Record<EventType, Signal>> = {
  research_run_started: "start",
  research_run_succeeded: "success",
  research_run_failed: "failure",
  test_suite_succeeded: "success",
  test_suite_failed: "failure",
  pipeline_stale: "stale",
};

export interface ProjectState {
  projectId: ProjectId;
  /** status of the automated job, not of the research result */
  execution: Execution;
  running?: CityEvent;
  lastAttempt?: CityEvent;
  lastSuccess?: CityEvent;
  lastFailure?: CityEvent;
  lastPromotion?: CityEvent;
  lastGate?: CityEvent;
  lastChange?: CityEvent;
  /** data freshness, independent of whether the job ran */
  dataStale?: CityEvent;
  events: number;
}

/** Fold events, oldest first, into one state per project. `pipelines` names projects whose execution is expected to be fed. */
export function reduce(events: CityEvent[], pipelines: Set<ProjectId>): Record<ProjectId, ProjectState> {
  const out = Object.fromEntries(
    PROJECTS.map((p) => [p.id, { projectId: p.id, execution: pipelines.has(p.id) ? "unavailable" : "idle", events: 0 } satisfies ProjectState]),
  ) as Record<ProjectId, ProjectState>;
  const runs = new Map<string, CityEvent>(); // run id -> start event still open
  for (const e of [...events].sort((a, b) => -byTimeDesc(a, b))) {
    const s = out[e.projectId];
    s.events += 1;
    const sig = SIGNAL[e.eventType];
    if (sig) {
      s.execution = TRANSITIONS[s.execution][sig];
      if (sig === "start") {
        s.lastAttempt = e;
        if (e.sourceRunId) runs.set(e.sourceRunId, e);
        s.running = e;
      }
      if (sig === "success" || sig === "failure") {
        if (!s.lastAttempt || s.lastAttempt.sourceRunId !== e.sourceRunId) s.lastAttempt = e;
        if (sig === "success") s.lastSuccess = e;
        else s.lastFailure = e;
        if (e.sourceRunId) runs.delete(e.sourceRunId);
        s.running = [...runs.values()].filter((r) => r.projectId === e.projectId).at(-1);
        if (s.running) s.execution = "running"; // another run is still open
      }
    }
    if (e.eventType === "candidate_promoted") s.lastPromotion = e;
    if (e.eventType === "release_gate_passed" || e.eventType === "release_gate_failed") s.lastGate = e;
    if (e.eventType === "change_committed") s.lastChange = e;
    if (e.eventType === "dataset_stale") s.dataStale = e;
  }
  return out;
}

// ---------------------------------------------------------------- derived events

const HOUR = 3600e3;

/** A scheduled pipeline whose last success is older than two intervals plus slack has gone stale. */
export function stalePipeline(projectId: ProjectId, lastSuccess: CityEvent | undefined, everyHours: number, now: number): CityEvent | null {
  if (!lastSuccess) return null;
  const due = Date.parse(lastSuccess.occurredAt) + (2 * everyHours + 1) * HOUR;
  if (now < due) return null;
  return {
    eventId: `derived:pipeline-stale:${projectId}:${lastSuccess.eventId}`,
    projectId,
    eventType: "pipeline_stale",
    occurredAt: new Date(due).toISOString(),
    source: "derived",
    status: "warning",
    title: `No successful run for ${Math.round((now - Date.parse(lastSuccess.occurredAt)) / HOUR)} h (expected every ${everyHours} h)`,
    schemaVersion: 1,
  };
}

/** A dataset older than its tolerance is stale, whatever the jobs that read it are doing. */
export function staleData(projectId: ProjectId, asOf: string | undefined, staleAfterDays: number | undefined, now: number): CityEvent | null {
  if (!asOf || !staleAfterDays) return null;
  const t = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const due = t + staleAfterDays * 24 * HOUR;
  if (now < due) return null;
  return {
    eventId: `derived:data-stale:${projectId}:${asOf}`,
    projectId,
    eventType: "dataset_stale",
    occurredAt: new Date(due).toISOString(),
    source: "derived",
    status: "warning",
    title: `Data as of ${asOf}: ${Math.floor((now - t) / (24 * HOUR))} days old (tolerance ${staleAfterDays})`,
    detail: "No automated refresh exists. Runs keep searching the same history until the snapshot is updated.",
    schemaVersion: 1,
  };
}

/** Events newer than the visitor's last processed marker; the first visit animates nothing. */
export function unseen(events: CityEvent[], marker: string | null): CityEvent[] {
  if (!marker) return [];
  return events.filter((e) => e.occurredAt > marker && !e.demo);
}

export const latestTime = (events: CityEvent[]) => events.reduce((m, e) => (e.occurredAt > m ? e.occurredAt : m), "");
