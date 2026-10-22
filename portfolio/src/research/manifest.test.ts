// node --experimental-strip-types --no-warnings --test src/research/manifest.test.ts
// One inventory everywhere: ids are unique, every project has a case-study page, every page has a
// project, every repo reference exists, and no milestone claims more than its evidence allows.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { PROJECTS, SHIPPED } from "./manifest.ts";
import { PLOTS } from "./layout.ts";
import { CASES } from "./cases.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const PORTFOLIO = resolve(ROOT, "portfolio");

test("ids are unique and stable-looking", () => {
  const ids = PROJECTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z][a-z-]+$/);
  assert.equal(ids.length, 8);
});

test("every project has a case-study page and every page has a project", () => {
  const pages = readdirSync(resolve(PORTFOLIO, "research"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  assert.deepEqual(pages, PROJECTS.map((p) => p.id).sort());
  for (const p of PROJECTS) assert.ok(CASES[p.id], `case content for ${p.id}`);
});

test("every project has one plot on the city grid, and no two share one", () => {
  const taken = new Set<string>();
  for (const p of PROJECTS) {
    const plot = PLOTS[p.id];
    assert.ok(plot, p.id);
    const k = plot.join(",");
    assert.ok(!taken.has(k), `${p.id} shares plot ${k}`);
    taken.add(k);
  }
  assert.ok(!taken.has("0,0"), "the Data Foundry's plot is free");
});

test("every repo: reference points at a file or folder that exists", () => {
  const refs = PROJECTS.flatMap((p) => [...p.milestones.map((m) => m.ref), ...p.agents.map((a) => a.source)]).filter((r): r is string => !!r?.startsWith("repo:"));
  assert.ok(refs.length > 20);
  for (const r of refs) assert.ok(existsSync(resolve(ROOT, r.slice(5))), `missing ${r}`);
  for (const p of PROJECTS) for (const path of p.paths) assert.ok(existsSync(resolve(ROOT, path)), `missing path ${path}`);
});

test("a shipped milestone carries evidence in this repository or a deployed path", () => {
  for (const p of PROJECTS)
    for (const m of p.milestones) if (SHIPPED.includes(m.evidence)) assert.ok(m.ref?.startsWith("repo:"), `${p.id}: "${m.label}" is ${m.evidence} without a repo ref`);
});

test("an agent marked verified names its source", () => {
  for (const p of PROJECTS) for (const a of p.agents) if (a.verification === "verified") assert.ok(a.source?.startsWith("repo:"), `${p.id}/${a.name}`);
});

test("each project says what kind of thing it is, and a live claim is backed by a deployment", () => {
  for (const p of PROJECTS) {
    assert.ok(p.nature.length > 0, `${p.id} has no nature`);
    const kinds = p.nature.map((n) => n.kind);
    assert.equal(new Set(kinds).size, kinds.length, `${p.id} repeats a kind`);
    const deployed = p.milestones.some((m) => m.evidence === "deployed");
    if (kinds.includes("live")) assert.ok(deployed, `${p.id} is "live" without a deployed milestone`);
    if (kinds.includes("claimed-live")) assert.ok(!kinds.includes("live") && p.milestones.some((m) => m.evidence === "unverified"), `${p.id}: claimed-live needs an unverified milestone`);
    if (kinds.includes("interactive")) assert.ok(p.links.some((l) => l.kind === "demo"), `${p.id} is interactive without a demo link`);
    for (const n of p.nature) assert.ok(n.note.length > 10, `${p.id}/${n.kind} needs a reason`);
  }
});
