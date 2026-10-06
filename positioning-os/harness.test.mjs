// Runs Code.gs against an in-memory copy of the Positioning OS layout. node harness.test.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

class Range {
  constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
  cell(i, j) { const row = (this.sh.cells[this.r - 1 + i] ??= []); return row; }
  getValues() { return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sh.get(this.r + i, this.c + j))); }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.put(this.r + i, this.c + j, x))); return this; }
  getValue() { return this.sh.get(this.r, this.c); }
  setValue(v) { this.sh.put(this.r, this.c, v); return this; }
  getFormula() { const v = this.sh.get(this.r, this.c); return typeof v === "string" && v.startsWith("=") ? v : ""; }
  setFontWeight() { return this; }
}
class Sheet {
  constructor(name, rows = []) { this.name = name; this.cells = rows.map((r) => [...r]); }
  get(r, c) { return this.cells[r - 1]?.[c - 1] ?? ""; }
  put(r, c, v) { (this.cells[r - 1] ??= [])[c - 1] = v; }
  getLastRow() { for (let i = this.cells.length; i > 0; i--) if ((this.cells[i - 1] ?? []).some((x) => x !== "" && x != null)) return i; return 0; }
  getLastColumn() { return Math.max(1, ...this.cells.map((r) => r?.length ?? 0)); }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  appendRow(v) { this.getRange(this.getLastRow() + 1, 1, 1, v.length).setValues([v]); }
  setFrozenRows() {}
  getName() { return this.name; }
}
const H = (s) => s.split("|");
const people = H("Person ID|Full Name|Title|Organization|Org Type|City|Focus / Sector|Tier|Priority Score|Source Type|Shared Connection|UC Connection|Association|First Contact|Last Contact|Next Contact|Cadence Days|Days Since Contact|Follow-Up Due|Conversation Topic|Their Interests|Value I Can Give|Intros Received|Intros Given|Events Together|Relationship Strength|Opportunity|Verification Status|Source URL|Date Verified|Confidence|Notes");
const prow = (id, name, status, last, next, cadence) => { const r = Array(people.length).fill(""); r[0] = id; r[1] = name; r[people.indexOf("Last Contact")] = last; r[people.indexOf("Next Contact")] = next; r[people.indexOf("Cadence Days")] = cadence; r[people.indexOf("Verification Status")] = status; return r; };
const cos = H("Company ID|Name|City|Sector|NAICS|Ownership Type|Employee Band|Revenue Estimate|Revenue Basis|Estimate Method|Growth Signal|Acquisition Relevance|Strategic Relevance|Likely Decision Maker|Linked Person ID|Source|URL|Verification Status|Date Verified|Confidence|Next Action|Notes");
const crow = (id, name) => { const r = Array(cos.length).fill(""); r[0] = id; r[1] = name; return r; };
const opps = H("Opp ID|Type|Description|Source Person ID|Organization|Stage|Probability %|Why It Matters|Next Action|Next Action Date|Authorization Required|Counsel Review Needed|Status|Notes");
const sheets = {
  Dashboard: new Sheet("Dashboard", [["POSITIONING OS — DASHBOARD"], [""], ["TODAY", "Tue 6 Oct 2026"], ["🔴 NEEDS ACTION NOW", "Count", "Rule"], ["Follow-ups overdue", 3, "Do these first, always"], ["Unverified people rows", "=COUNTIF('People CRM'!AB:AB,\"UNVERIFIED\")", "Never use"], ["Outdated verifications", 0]]),
  "People CRM": new Sheet("People CRM", [people, Array(people.length).fill(""), prow("P-001", "Valerie", "VERIFIED", "2026-09-09", "", 60), prow("P-002", "Allyson", "VERIFIED", "2026-09-16", "2026-09-16", 60), prow("P-004", "Marla", "UNVERIFIED", "2026-09-16", "2026-09-16", 60)]),
  "Target Companies": new Sheet("Target Companies", [cos, cos, crow("FIRM-001", "Roebling Capital Partners"), crow("FIRM-018", "Cerity Partners")]),
  Opportunities: new Sheet("Opportunities", [opps]),
};
const ss = { getSheetByName: (n) => sheets[n] ?? null, insertSheet: (n) => (sheets[n] = new Sheet(n)) };
const pad = (n) => String(n).padStart(2, "0");
const ctx = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: (() => { const m = new Map(); const c = { get: (k) => m.get(k) ?? null, put: (k, v) => m.set(k, v) }; return { getScriptCache: () => c }; })(),
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ setMimeType() { return this; }, getContent: () => t }) },
  Utilities: { formatDate: (d, _tz, f) => { const y = d.getFullYear(), m = pad(d.getMonth() + 1), day = pad(d.getDate()); return f.startsWith("yyyy-MM-dd'T'") ? `${y}-${m}-${day}T00:00:00` : `${y}-${m}-${day}`; } },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: (fn) => ((ctx.triggerFn = fn), { timeBased() { return this; }, everyHours() { return this; }, create() {} }) },
  Logger: { log: console.log },
};
vm.createContext(ctx);
// Same project as the user's workbook builder, which declares its own SHEETS and helpers: loaded first, like Code.gs before Webhook.gs.
vm.runInContext("var SHEETS = { DASH: 'Dashboard', PEOPLE: 'People CRM' }; var CFG = 1; function ensureSheet_() { throw new Error('builder helper called'); } function table_() { throw new Error('builder helper called'); } function buildWorkbook() { return 'built'; }", ctx);
vm.runInContext(readFileSync(new URL("./Code.gs", import.meta.url), "utf8"), ctx);
assert.equal(ctx.buildWorkbook(), "built");
assert.equal(ctx.SHEETS.DASH, "Dashboard");
const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());

let r = post({ sid: "s1", page: "/", events: [{ event: "page_view" }, { event: "section_view", section: "hero" }, { event: "jarvis_ask" }, { event: "lab_run" }, { event: "connect_open" }] });
assert.equal(r.ok, true); assert.equal(r.stored, 5);
r = post({ sid: "s1", page: "/", events: [{ event: "lead", lead: { name: "Priya Shah", email: "Priya@Evercore.com", company: "Evercore", role: "Family Office Analyst", reason: "I'm hiring", message: "=HYPERLINK(\"x\")" } }] });
assert.equal(r.ok, true);
const P = sheets["People CRM"], C = sheets["Target Companies"], O = sheets.Opportunities, D = sheets.Dashboard, A = sheets["Web Activity"];
const col = (h) => people.indexOf(h) + 1;
assert.equal(P.get(6, 1), "P-005", "next person id");
assert.equal(P.get(6, col("Full Name")), "Priya Shah");
assert.equal(P.get(6, col("Verification Status")), "UNVERIFIED");
assert.equal(P.get(6, col("Follow-Up Due")), "DUE");
assert.ok(String(P.get(6, col("Notes"))).includes("email: priya@evercore.com"));
assert.equal(C.get(5, 1), "FIRM-019"); assert.equal(C.get(5, 2), "Evercore"); assert.equal(C.get(5, cos.indexOf("Linked Person ID") + 1), "P-005");
assert.equal(O.get(2, 1), "OPP-001"); assert.equal(O.get(2, 2), "Job"); assert.equal(O.get(2, opps.indexOf("Authorization Required") + 1), "Yes");
assert.ok(!JSON.stringify(A.cells).includes("Priya"), "no PII in raw activity log");
// formula injection neutralised (message is inside Notes, prefixed text, never a leading '=')
assert.ok(!String(P.get(6, col("Notes"))).startsWith("="));
// dedupe on repeat inbound
post({ sid: "s2", page: "/", events: [{ event: "lead", lead: { name: "Priya Shah", email: "priya@evercore.com", company: "Evercore", reason: "Let's connect" } }] });
assert.equal(P.get(7, 1), "", "repeat sender not duplicated");
assert.ok(String(P.get(6, col("Notes"))).includes("inbound again"));
assert.equal(C.get(6, 1), "", "existing firm not duplicated");
// booking
post({ sid: "s3", page: "/", events: [{ event: "calendly_booked", event_uri: "https://api.calendly.com/scheduled_events/X" }] });
assert.equal(O.get(4, 2), "Introduction"); assert.equal(O.get(4, opps.indexOf("Stage") + 1), "Active conversation");
// dashboard: plain-value metric updated, formula metric untouched, web block written
assert.equal(D.get(5, 2), 3, "follow-ups overdue = P-002, P-004 (Next Contact passed) + new inbound P-005");
assert.ok(String(D.get(6, 2)).startsWith("=COUNTIF"), "formula cell left alone");
const flat = D.cells.map((r) => r?.[0]);
const cpiRow = flat.indexOf("CPI — conversations per 1,000 sessions") + 1;
assert.ok(cpiRow > 0, "CPI row written");
assert.equal(D.get(cpiRow, 2), Math.round((1000 * (2 + 1)) / 3 * 10) / 10, "CPI = 1000*(leads+bookings)/sessions");
assert.ok(sheets["Web Metrics"].getLastRow() === 2, "one metrics row per day");
// rate limit and bad input
assert.equal(post({ sid: "s9", events: Array(81).fill({ event: "section_view" }).slice(0, 50) }).ok, true);
assert.equal(post({ sid: "s9", events: Array(50).fill({ event: "section_view" }) }).ok, false, "rate limited");
assert.equal(JSON.parse(ctx.doPost({ postData: { contents: "x".repeat(20001) } }).getContent()).ok, false);
// A renamed CRM tab must not lose the visit: the event still lands in Web Activity, flagged.
const saved = sheets.Opportunities;
delete sheets.Opportunities;
const before = sheets["Web Activity"].getLastRow();
r = post({ sid: "s9", page: "/", events: [{ event: "calendly_booked", event_uri: "x" }] });
assert.equal(r.ok, true);
assert.equal(sheets["Web Activity"].getLastRow(), before + 1);
assert.match(String(sheets["Web Activity"].get(before + 1, 5)), /CRM write failed: Missing sheet: Opportunities/);
sheets.Opportunities = saved;

// Trigger points at the prefixed global.
ctx.webhookInstallTriggers();
assert.equal(ctx.triggerFn, "webhookRefreshDashboard");
assert.equal(typeof ctx.webhookRefreshDashboard, "function");

console.log("Code.gs harness: all assertions passed");
console.log("Dashboard:", D.cells.filter(Boolean).map((r) => r.slice(0, 2).join(" = ")).join(" | "));
