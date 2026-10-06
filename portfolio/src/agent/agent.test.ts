// Unit tests for the Jarvis agent. The critic reads these results by name: "resilience: …" tests
// feed the Resilience & Security score.
//   node --experimental-strip-types --test src/agent/agent.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { displayText, fill, parseScript } from "../jarvis/sales/markup.ts";
import { Proactive } from "../jarvis/sales/proactive.ts";
import type { Line } from "../jarvis/sales/types.ts";
import { compose, composeBriefing, repairLine } from "./actor.ts";
import { DRAFTS } from "./drafts.ts";
import { critique, passes, scoreConversation } from "./evaluator.ts";
import { RateLimiter, withRetry } from "./ratelimit.ts";
import { buildState, triggers, validateTasks } from "./tasks.ts";
import type { Structural, TaskFile } from "./types.ts";
import { buildPayloads, sendTwilio, validatePayloads } from "./voice.ts";

const brief = readFileSync(new URL("../../../jarvis/knowledge/brief.md", import.meta.url), "utf8");
const NOW = new Date("2026-10-07T13:00:00Z"); // 09:00 in New York
const file = (): TaskFile => ({
  version: 1,
  owner: "Siddharth",
  timezone: "America/New_York",
  tasks: [
    { id: "a", title: "Verify the site in Search Console", why: "Search.", status: "blocked", blockedOn: "the tag", impact: 5, due: "2026-10-09" },
    { id: "b", title: "Add the link to LinkedIn", why: "Recruiters.", status: "todo", impact: 5, due: "2026-10-05" },
    { id: "c", title: "Pick a domain", why: "Easier to say.", status: "todo", impact: 2, due: "2026-10-20" },
    { id: "d", title: "Turn on Calendly", why: "Bookings.", status: "done", impact: 4, due: "2026-10-06", completedAt: "2026-10-06" },
  ],
});
const okStructural: Structural = {
  tsc: { ok: true, errors: 0, output: "" },
  lint: { ok: true, errors: 0, output: "" },
  tests: {
    ok: true,
    passed: 4,
    failed: 0,
    output: "",
    names: [
      { name: "resilience: retries with backoff", ok: true },
      { name: "resilience: rate limiter", ok: true },
      { name: "x", ok: true },
      { name: "y", ok: true },
    ],
  },
};

test("markup: parses pauses and questions", () => {
  const s = parseScript("Hi. || I'm Jarvis. | What brings you here?");
  assert.deepEqual(
    s.map((x) => [x.text, x.pauseAfterMs, x.question]),
    [
      ["Hi.", 620],
      ["I'm Jarvis.", 280],
      ["What brings you here?", 0],
    ].map(([t, p]) => [t, p, String(t).endsWith("?")]),
  );
});

test("markup: display text drops pause marks and fills variables", () => {
  assert.equal(displayText("Hi. || I'm Jarvis. | Okay?"), "Hi. I'm Jarvis. Okay?");
  assert.equal(fill("Welcome back, {name}.", { name: "Priya" }), "Welcome back, Priya.");
  assert.equal(fill("Welcome back {name}.", {}), "Welcome back.");
  assert.equal(fill("Welcome back, {name}.", {}), "Welcome back.");
});

test("state: completed + remaining = total, delta finds newly completed", () => {
  const f = file();
  const s1 = buildState(f, null, NOW);
  assert.equal(s1.completed.length + s1.remaining.length, s1.total);
  f.tasks[2] = { ...f.tasks[2]!, status: "done", completedAt: "2026-10-07" };
  const s2 = buildState(f, s1, NOW);
  assert.deepEqual(s2.delta.newlyCompleted, ["c"]);
  assert.deepEqual(s2.delta.newlyAdded, []);
});

test("state: overdue, due-soon and blocked come from the dates and statuses", () => {
  const s = buildState(file(), null, NOW);
  assert.deepEqual(s.overdue, ["b"]);
  assert.deepEqual(s.dueSoon, ["a"]);
  assert.deepEqual(s.blocked, ["a"]);
  assert.equal(s.top[0]?.id, "b", "the overdue, high-impact task ranks first");
});

test("state: an invalid task file is rejected with every problem listed", () => {
  const bad = { version: 1, owner: "x", timezone: "UTC", tasks: [{ id: "a", title: "", status: "done", impact: 9, due: "next week" }, { id: "a" }] };
  assert.throws(() => validateTasks(bad), (e: Error) => /title missing/.test(e.message) && /impact/.test(e.message) && /due must be/.test(e.message) && /duplicated/.test(e.message) && /completedAt/.test(e.message));
});

test("state: the morning briefing fires only in the morning, in the owner's timezone", () => {
  const s = buildState(file(), null, NOW);
  assert.ok(triggers(s, NOW, "America/New_York").some((t) => t.kind === "morning_briefing"));
  assert.ok(!triggers(s, new Date("2026-10-07T20:00:00Z"), "America/New_York").some((t) => t.kind === "morning_briefing"));
});

test("briefing: names what needs the owner, without meta-fluff, and ends on a question", () => {
  const f = file();
  const b = composeBriefing(f, buildState(f, null, NOW), NOW);
  assert.match(b.text, /^Morning, Siddharth\./);
  assert.match(b.text, /verify the site in search console/i, "the item waiting on him comes first");
  assert.match(b.text, /I need the tag from you/);
  assert.match(b.text, /add the link to linkedin/i, "the overdue item is named too");
  assert.doesNotMatch(b.text.toLowerCase(), /here is your update|here's your update/);
  assert.ok(b.text.trim().endsWith("?"));
});

test("resilience: retries with backoff, then succeeds", async () => {
  const waits: number[] = [];
  let calls = 0;
  const v = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("flaky");
      return "ok";
    },
    { retries: 4, baseMs: 100, maxMs: 1000, sleep: async (ms) => void waits.push(ms) },
  );
  assert.equal(v, "ok");
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);
  assert.ok(waits.every((w, i) => w >= 0 && w < 100 * 2 ** i), "full-jitter backoff stays under the cap");
});

test("resilience: retry gives up at once on non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new Error("400");
      },
      { retries: 5, baseMs: 1, maxMs: 1, sleep: async () => {}, retryable: () => false },
    ),
  );
  assert.equal(calls, 1);
});

test("resilience: rate limiter enforces the gap and the window", () => {
  let t = 0;
  const rl = new RateLimiter(2, 1000, 300, () => t);
  assert.ok(rl.take());
  assert.ok(!rl.take(), "too soon after the last one");
  t = 400;
  assert.ok(rl.take());
  t = 800;
  assert.ok(!rl.take(), "window full");
  t = 1100;
  assert.ok(rl.take(), "first one has aged out");
});

test("resilience: call payloads validate and carry no phone numbers or keys", () => {
  const p = buildPayloads("Morning. || One thing. | It's due today. ||| Anything to move?", "Morning. One thing. It's due today. Anything to move?");
  assert.deepEqual(validatePayloads(p), []);
  assert.match(p.twiml, /<break time="280ms"\/>/);
  const leaked = { ...p, bland: { ...p.bland, phone_number: "+1 860 595 8333" } };
  assert.ok(validatePayloads(leaked).some((x) => /phone number/.test(x)));
});

test("resilience: the call sender is a dry run unless explicitly enabled", async () => {
  let fetched = false;
  const fake = (async () => {
    fetched = true;
    return new Response("{}");
  }) as typeof fetch;
  const p = buildPayloads("Hi. | Okay?", "Hi. Okay?");
  const r = await sendTwilio(p, {}, fake);
  assert.equal(r.sent, false);
  assert.equal(fetched, false);
});

test("critic: flags meta-fluff, long sentences, missing questions and unverified numbers", () => {
  const bad: Line = { id: "x", stage: "pitch", chips: [], text: "Here is your update. He closed 47 deals last quarter and he also personally managed a very large number of extremely complicated processes for everyone in every single office. Great question." };
  const r = scoreConversation([bad], "Morning. | Okay?", brief);
  const codes = new Set(r.issues.map((i) => i.code));
  for (const c of ["META_FLUFF", "LONG_SENTENCE", "NO_ASK", "UNVERIFIED_NUMBER"]) assert.ok(codes.has(c), c);
  assert.equal(r.honest, false);
});

test("critic: the honesty gate blocks invented urgency and a wrong CFA claim", () => {
  const lines: Line[] = [
    { id: "u", stage: "close", chips: [], text: "Only 2 slots left this week. | Book now?" },
    { id: "c", stage: "pitch", chips: [], text: "He's a CFA Level I holder. | Want to talk?" },
  ];
  const r = scoreConversation(lines, "Okay?", brief);
  assert.equal(r.honest, false);
  assert.ok(r.issues.some((i) => i.code === "PRESSURE"));
  assert.ok(r.issues.some((i) => i.code === "MISREPRESENTS_CFA"));
});

test("actor: repairs exactly what the critic flagged, until the line passes", () => {
  const bad: Line = { id: "x", stage: "proof", chips: [], text: "Here is your update. He underwrote a $6M+ acquisition pipeline across several states while also building the models that the whole company relied on. Great question." };
  const first = scoreConversation([bad], "Okay?", brief);
  const fixed = repairLine(bad, first.issues.filter((i) => i.where === "line:x"));
  const second = scoreConversation([fixed], "Okay?", brief);
  const left = second.issues.filter((i) => i.where === "line:x" && i.code !== "STIFF");
  assert.deepEqual(left, [], JSON.stringify(left));
  assert.match(fixed.text, /\$6M\+/, "the verified fact survives the repair");
});

test("playbook: every chip leads to a line that exists, and every claim is in the brief", () => {
  const ids = new Set(DRAFTS.map((d) => d.id));
  for (const d of DRAFTS) for (const ch of d.chips) if (ch.next) assert.ok(ids.has(ch.next), `${d.id} → ${ch.next}`);
  const r = scoreConversation(DRAFTS, "Okay?", brief);
  assert.equal(r.honest, true, JSON.stringify(r.issues.filter((i) => i.cost >= 5)));
});

test("loop: a clean candidate passes the critic, a broken build does not", () => {
  const f = file();
  const c = compose({ iteration: 1, file: f, prevState: null, now: NOW, critique: null });
  const good = critique(c, okStructural, f, brief);
  assert.ok(passes(good), `S=${good.score} ${JSON.stringify(good.issues.slice(0, 5))}`);
  const broken = critique(c, { ...okStructural, tsc: { ok: false, errors: 3, output: "" } }, f, brief);
  assert.equal(passes(broken), false);
  assert.equal(broken.gates.structural, false);
});

test("concierge: greets once, nudges with restraint, and stays quiet when told", () => {
  let t = 0;
  const p = new Proactive(() => t, 4, 40_000);
  assert.equal(p.decide({ type: "landing", returning: false }, false), "open.first");
  t = 10_000;
  assert.equal(p.decide({ type: "dwell", station: "dealroom" }, false), null, "too soon after the greeting");
  t = 50_000;
  assert.equal(p.decide({ type: "dwell", station: "dealroom" }, true), null, "never while the visitor is busy");
  assert.equal(p.decide({ type: "dwell", station: "dealroom" }, false), "nudge.dealroom");
  t = 100_000;
  assert.equal(p.decide({ type: "dwell", station: "dealroom" }, false), null, "each nudge once");
  assert.equal(p.decide({ type: "exit" }, false), "nudge.exit");
  t = 150_000;
  p.snooze();
  assert.equal(p.decide({ type: "dwell", station: "model" }, false), null, "Not now means not now");
});

test("concierge: a visitor mid-conversation is not interrupted, and the cap holds", () => {
  let t = 0;
  const p = new Proactive(() => t, 2, 1);
  assert.equal(p.decide({ type: "landing", returning: true }, false), "open.return");
  p.setEngaged(true);
  t = 10;
  assert.equal(p.decide({ type: "dwell", station: "model" }, false), null);
  p.setEngaged(false);
  assert.equal(p.decide({ type: "dwell", station: "model" }, false), "nudge.model");
  t = 20;
  assert.equal(p.decide({ type: "dwell", station: "research" }, false), null, "two per visit in this setup");
});
