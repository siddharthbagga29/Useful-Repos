// node --experimental-strip-types --no-warnings --test src/research/events.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyStore, ingest, MAX_EVENTS, reduce, safeUrl, staleData, stalePipeline, TRANSITIONS, unseen, validateEvent, type CityEvent } from "./events.ts";
import { assessChampion } from "./validation.ts";
import type { BrainState } from "../brain/engine.ts";

const ev = (over: Partial<CityEvent> & Pick<CityEvent, "eventId" | "eventType" | "occurredAt">): Record<string, unknown> => ({
  projectId: "strategy-lab",
  source: "github-actions",
  title: "t",
  schemaVersion: 1,
  ...over,
});
const brain = new Set(["strategy-lab" as const]);

test("valid events pass and get the status their type implies", () => {
  const v = validateEvent(ev({ eventId: "a", eventType: "research_run_failed", occurredAt: "2026-10-20T17:08:11Z", sourceRunId: "39463159325" }));
  assert.ok(v.ok);
  if (v.ok) assert.equal(v.event.status, "failed");
});

test("malformed and unknown records are rejected with a reason, not thrown", () => {
  const bad: unknown[] = [
    null,
    "x",
    ev({ eventId: "", eventType: "research_run_started", occurredAt: "2026-10-20T00:00:00Z" }),
    ev({ eventId: "b", eventType: "teleported" as never, occurredAt: "2026-10-20T00:00:00Z" }),
    ev({ eventId: "c", eventType: "research_run_started", occurredAt: "yesterday" }),
    { ...ev({ eventId: "d", eventType: "research_run_started", occurredAt: "2026-10-20T00:00:00Z" }), projectId: "moonbase" },
    { ...ev({ eventId: "e", eventType: "research_run_started", occurredAt: "2026-10-20T00:00:00Z" }), schemaVersion: 2 },
  ];
  const { store } = ingest(emptyStore(), bad);
  assert.equal(store.events.length, 0);
  assert.equal(store.rejected.length, bad.length);
  assert.ok(store.rejected.some((r) => /unknown event type/.test(r.reason)));
});

test("unsafe links are dropped; https on known hosts and site paths are kept", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("https://evil.example/x"), undefined);
  assert.equal(safeUrl("http://github.com/x"), undefined);
  assert.equal(safeUrl("//github.com/x"), undefined);
  assert.equal(safeUrl("https://github.com/siddharthbagga29/x"), "https://github.com/siddharthbagga29/x");
  assert.equal(safeUrl("/research/"), "/research/");
});

test("duplicates are ignored, so a repeated event can't update state twice", () => {
  const e = ev({ eventId: "gha:1:completed", eventType: "research_run_succeeded", occurredAt: "2026-10-21T04:45:31Z", sourceRunId: "1" });
  const a = ingest(emptyStore(), [e, e]);
  assert.equal(a.store.events.length, 1);
  const b = ingest(a.store, [e]);
  assert.equal(b.added.length, 0);
  assert.equal(reduce(b.store.events, brain)["strategy-lab"].events, 1);
});

test("history is bounded and keeps the newest events", () => {
  const many = Array.from({ length: MAX_EVENTS + 50 }, (_, i) =>
    ev({ eventId: `n${i}`, eventType: "change_committed", occurredAt: new Date(Date.UTC(2026, 0, 1) + i * 60e3).toISOString() }),
  );
  const { store } = ingest(emptyStore(), many);
  assert.equal(store.events.length, MAX_EVENTS);
  assert.equal(store.events[0]!.eventId, `n${MAX_EVENTS + 49}`);
});

test("a run moves idle → running → succeeded", () => {
  const start = ev({ eventId: "s", eventType: "research_run_started", occurredAt: "2026-10-21T04:45:18Z", sourceRunId: "9" });
  const s1 = reduce(ingest(emptyStore(), [start]).store.events, brain)["strategy-lab"];
  assert.equal(s1.execution, "running");
  const done = ev({ eventId: "d", eventType: "research_run_succeeded", occurredAt: "2026-10-21T04:45:31Z", sourceRunId: "9" });
  const s2 = reduce(ingest(emptyStore(), [start, done]).store.events, brain)["strategy-lab"];
  assert.equal(s2.execution, "succeeded");
  assert.equal(s2.running, undefined);
  assert.equal(s2.lastSuccess?.eventId, "d");
});

test("a failed run shows as failed and the last success survives it", () => {
  const ok = ev({ eventId: "ok", eventType: "research_run_succeeded", occurredAt: "2026-10-20T17:07:34Z", sourceRunId: "48" });
  const bad = ev({ eventId: "bad", eventType: "research_run_failed", occurredAt: "2026-10-20T17:08:14Z", sourceRunId: "49" });
  const s = reduce(ingest(emptyStore(), [bad, ok]).store.events, brain)["strategy-lab"];
  assert.equal(s.execution, "failed");
  assert.equal(s.lastSuccess?.eventId, "ok");
  assert.equal(s.lastFailure?.eventId, "bad");
});

test("events are applied in time order, whatever order they arrive in", () => {
  const bad = ev({ eventId: "bad", eventType: "research_run_failed", occurredAt: "2026-10-20T17:08:14Z" });
  const later = ev({ eventId: "later", eventType: "research_run_succeeded", occurredAt: "2026-10-20T21:36:57Z" });
  assert.equal(reduce(ingest(emptyStore(), [later, bad]).store.events, brain)["strategy-lab"].execution, "succeeded");
});

test("stale never hides a failure and never interrupts a running job", () => {
  assert.equal(TRANSITIONS.failed.stale, "failed");
  assert.equal(TRANSITIONS.running.stale, "running");
  assert.equal(TRANSITIONS.succeeded.stale, "stale");
});

test("a pipeline project with no events is unavailable; others are idle", () => {
  const s = reduce([], brain);
  assert.equal(s["strategy-lab"].execution, "unavailable");
  assert.equal(s.dcf.execution, "idle");
});

test("schedule staleness is derived from the last success, deterministically", () => {
  const last = validateEvent(ev({ eventId: "last", eventType: "research_run_succeeded", occurredAt: "2026-10-21T00:00:00Z" }));
  assert.ok(last.ok);
  if (!last.ok) return;
  assert.equal(stalePipeline("strategy-lab", last.event, 6, Date.parse("2026-10-21T12:00:00Z")), null);
  const st = stalePipeline("strategy-lab", last.event, 6, Date.parse("2026-10-21T14:00:00Z"));
  assert.ok(st);
  assert.equal(st!.occurredAt, "2026-10-21T13:00:00.000Z");
  assert.equal(stalePipeline("strategy-lab", last.event, 6, Date.parse("2026-10-22T14:00:00Z"))!.eventId, st!.eventId);
});

test("stale data is flagged separately from execution", () => {
  const d = staleData("strategy-lab", "2026-09-21", 14, Date.parse("2026-10-22T00:00:00Z"));
  assert.ok(d);
  const ok = ev({ eventId: "ok", eventType: "research_run_succeeded", occurredAt: "2026-10-22T04:43:50Z" });
  const s = reduce(ingest(emptyStore(), [d, ok]).store.events, brain)["strategy-lab"];
  assert.equal(s.execution, "succeeded");
  assert.ok(s.dataStale);
  assert.equal(staleData("strategy-lab", "2026-09-21", 14, Date.parse("2026-09-30T00:00:00Z")), null);
});

test("a refresh replays nothing; only events newer than the visitor's marker animate", () => {
  const e = validateEvent(ev({ eventId: "x", eventType: "research_run_succeeded", occurredAt: "2026-10-22T04:43:50Z" }));
  assert.ok(e.ok);
  if (!e.ok) return;
  assert.deepEqual(unseen([e.event], null), []);
  assert.deepEqual(unseen([e.event], "2026-10-22T04:43:50.000Z"), []);
  assert.equal(unseen([e.event], "2026-10-21T00:00:00.000Z").length, 1);
});

test("demo events are marked and never animate as real ones", () => {
  const d = validateEvent(ev({ eventId: "demo:1", eventType: "research_run_failed", occurredAt: "2026-10-22T05:00:00Z", source: "demo" }));
  assert.ok(d.ok && d.event.demo);
  if (d.ok) assert.equal(unseen([d.event], "2026-10-01T00:00:00Z").length, 0);
});

// ---------------------------------------------------------------- research validation

const champ = (dsr: number, h: { sharpe: number; spySharpe: number; maxDD: number; spyMaxDD: number }) =>
  ({ trials: 7344, champion: { is: { dsr }, holdout: { cagr: 0, spyCagr: 0, ...h } } }) as unknown as BrainState;

test("a successful job does not make a validated result", () => {
  assert.equal(assessChampion(champ(0.5, { sharpe: 1.09, spySharpe: 0.8, maxDD: -0.28, spyMaxDD: -0.25 })).status, "not-validated");
});

test("passing every check is still only provisional", () => {
  const a = assessChampion(champ(0.99, { sharpe: 1.09, spySharpe: 0.8, maxDD: -0.26, spyMaxDD: -0.25 }));
  assert.equal(a.status, "provisional");
  assert.ok(a.checks.every((c) => c.pass));
});

test("a deeper holdout drawdown than tolerated fails validation", () => {
  const a = assessChampion(champ(0.99, { sharpe: 1.2, spySharpe: 0.8, maxDD: -0.35, spyMaxDD: -0.25 }));
  assert.equal(a.status, "not-validated");
});

test("no state means unavailable, not a guess", () => {
  assert.equal(assessChampion(null).status, "unavailable");
});
