// Turns verified source records into city events. Pure: no fetching here (feed.ts does that).
//   GitHub Actions runs   → research_run_* (the Brain) and test_suite_* (Jarvis CI)
//   Brain state log       → candidate_promoted
//   git commits           → change_committed
//   build-time checks     → release_gate_*
// Every event id is derived from its source record, so the same record always maps to the same id
// and can never be counted twice.

import type { BrainState } from "../brain/engine.ts";
import type { ProjectId } from "./manifest.ts";

export const WORKFLOWS = [
  { id: "brain", repo: "siddharthbagga29/siddharthbagga29.github.io", file: "brain.yml", projectId: "strategy-lab", kind: "research", everyHours: 6, label: "Brain search" },
  { id: "jarvis-ci", repo: "siddharthbagga29/Useful-Repos", file: "jarvis.yml", projectId: "jarvis", kind: "test", everyHours: 0, label: "Jarvis CI" },
] as const satisfies readonly { id: string; repo: string; file: string; projectId: ProjectId; kind: "research" | "test"; everyHours: number; label: string }[];
export type WorkflowId = (typeof WORKFLOWS)[number]["id"];

export const REPO_URL = "https://github.com/siddharthbagga29/Useful-Repos";

export interface WorkflowRun {
  id: number;
  number: number;
  attempt: number;
  event: string;
  status: string; // queued | in_progress | completed | ...
  conclusion: string | null; // success | failure | cancelled | timed_out | skipped | ...
  startedAt: string;
  updatedAt: string;
  sha: string;
  branch: string;
  url: string;
}

export interface Evidence {
  schemaVersion: 1;
  generatedAt: string;
  commit: string;
  commits: Record<string, { sha: string; at: string; subject: string; note?: string }[]>;
  workflows: Record<string, { runs: WorkflowRun[]; fetchedAt: string } | { unavailable: string }>;
  labCheck: { ranAt: string; passed: boolean; checks: number; failures: number; seconds: number };
  releaseGate: { at: string; passed: boolean; score: number } | { unavailable: string };
  dataset: { asOf: string; source: string; weeks: number; from: string };
}

type Raw = Record<string, unknown>;

/**
 * A completed research run yields a start and a completion; an open one only its start (and only
 * while it is younger than an hour, so a stuck record can't show as running forever). CI runs are
 * reported on completion only.
 */
export function runEvents(wid: WorkflowId, runs: WorkflowRun[], now = Date.now()): Raw[] {
  const w = WORKFLOWS.find((x) => x.id === wid)!;
  const out: Raw[] = [];
  for (const r of runs) {
    if (!Number.isFinite(r.id) || r.conclusion === "skipped") continue;
    const base = { projectId: w.projectId, source: "github-actions", sourceRunId: String(r.id), commitSha: r.sha, url: r.url, schemaVersion: 1 };
    const what = `${w.label} #${r.number}${r.attempt > 1 ? ` (attempt ${r.attempt})` : ""}`;
    const open = r.status !== "completed";
    if (w.kind === "research" && (!open || now - Date.parse(r.startedAt) < 3600e3))
      out.push({ ...base, eventId: `gha:${r.id}:${r.attempt}:started`, eventType: "research_run_started", occurredAt: r.startedAt, title: `${what} started (${r.event} on ${r.branch})` });
    if (open) continue;
    const ok = r.conclusion === "success";
    out.push({
      ...base,
      eventId: `gha:${r.id}:${r.attempt}:completed`,
      eventType: w.kind === "research" ? (ok ? "research_run_succeeded" : "research_run_failed") : ok ? "test_suite_succeeded" : "test_suite_failed",
      occurredAt: r.updatedAt,
      title: `${what} ${ok ? "succeeded" : r.conclusion ?? "ended"}`,
      detail:
        w.kind === "research"
          ? ok
            ? "The search ran and its state was committed. This says the job worked, not that the champion is validated."
            : "The run did not commit its state; the last committed state is still the one shown."
          : undefined,
    });
  }
  return out;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

/** Champion promotions recorded in the Brain's committed state. */
export function brainEvents(state: BrainState | null): Raw[] {
  if (!state?.log) return [];
  return state.log
    .filter((l) => l.kind === "promote" && typeof l.t === "string")
    .map((l) => ({
      eventId: `brain:promote:${l.gen}:${hash(l.text)}`,
      projectId: "strategy-lab",
      eventType: "candidate_promoted",
      occurredAt: l.t,
      source: "brain-state",
      title: `Generation ${l.gen}: new champion`,
      detail: l.text,
      schemaVersion: 1,
    }));
}

export function commitEvents(commits: Evidence["commits"]): Raw[] {
  return Object.entries(commits).flatMap(([projectId, cs]) =>
    cs.map((c) => ({
      eventId: `git:${projectId}:${c.sha}`,
      projectId,
      eventType: "change_committed",
      occurredAt: c.at,
      source: "git",
      commitSha: c.sha,
      url: `${REPO_URL}/commit/${c.sha}`,
      title: c.subject,
      ...(c.note ? { detail: c.note } : {}),
      schemaVersion: 1,
    })),
  );
}

/** The checks the build actually ran: lab-check (Strategy Lab, Deal Lab) and the Jarvis release gate. */
export function buildEvents(ev: Evidence): Raw[] {
  const out: Raw[] = [];
  const l = ev.labCheck;
  for (const projectId of ["strategy-lab", "deal-lab"])
    out.push({
      eventId: `build:lab-check:${projectId}:${l.ranAt}`,
      projectId,
      eventType: l.passed ? "release_gate_passed" : "release_gate_failed",
      occurredAt: l.ranAt,
      source: "build",
      commitSha: ev.commit,
      title: `lab-check ${l.passed ? "passed" : "failed"}: ${l.checks} checks${l.failures ? `, ${l.failures} failed` : ""}`,
      metrics: { checks: l.checks, failures: l.failures },
      schemaVersion: 1,
    });
  if ("at" in ev.releaseGate) {
    const g = ev.releaseGate;
    out.push({
      eventId: `build:release-gate:jarvis:${g.at}`,
      projectId: "jarvis",
      eventType: g.passed ? "release_gate_passed" : "release_gate_failed",
      occurredAt: g.at,
      source: "build",
      title: `Release gate ${g.passed ? "passed" : "failed"} (score ${g.score}/10)`,
      metrics: { score: g.score },
      schemaVersion: 1,
    });
  }
  return out;
}

/** Scripted, clearly labelled events for demonstrating the city's reactions (?demo=events only). */
export function demoScript(now: number): { at: number; event: Raw }[] {
  const t = (ms: number) => new Date(now + ms).toISOString();
  const e = (k: string, projectId: string, eventType: string, ms: number, title: string) => ({
    at: ms,
    event: { eventId: `demo:${k}`, projectId, eventType, occurredAt: t(ms), source: "demo", sourceRunId: `demo-${projectId}`, title: `DEMO · ${title}`, schemaVersion: 1, demo: true },
  });
  return [
    e("1", "strategy-lab", "research_run_started", 1500, "Brain run started"),
    e("2", "strategy-lab", "research_run_succeeded", 7000, "Brain run succeeded"),
    e("3", "jarvis", "test_suite_failed", 10500, "Jarvis CI failed"),
    e("4", "jarvis", "test_suite_succeeded", 15000, "Jarvis CI passed again"),
  ];
}
