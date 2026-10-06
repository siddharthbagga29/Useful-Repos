// Runs Jarvis's actor–critic loop. Exit 0 = approved (S ≥ 9.5, gates pass), 1 = not approved.
//   npm run jarvis:loop                    deterministic actor + critic (free)
//   npm run jarvis:loop -- --claude        also use Claude as critic and rewriter (needs credentials)
//   npm run jarvis:loop -- --call          place the briefing call if JARVIS_VOICE_SEND=1 and Twilio is configured
//   npm run jarvis:loop -- --now 2026-10-07T13:00:00Z

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop } from "../src/agent/jarvis_loop.ts";
import { sendTwilio } from "../src/agent/voice.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k: string) => process.argv.includes(`--${k}`);
const nowArg = process.argv[process.argv.indexOf("--now") + 1];
const now = process.argv.includes("--now") && nowArg ? new Date(nowArg) : new Date();

console.log(`Jarvis loop · ${now.toISOString()}${arg("claude") ? " · Claude critic on" : ""}`);
const r = await runLoop({ root, now, claude: arg("claude") || undefined });
console.log(r.ok ? `APPROVED in ${r.iterations} round(s): S = ${r.final.score.toFixed(1)}/10` : `NOT APPROVED after ${r.iterations} rounds: S = ${r.final.score.toFixed(1)}/10`);
console.log(`\nBriefing:\n${r.candidate.briefing.text}\n`);
if (r.ok && arg("call")) {
  const urgent = r.candidate.briefing.triggers.some((t) => t.kind === "overdue" || t.kind === "morning_briefing");
  const res = urgent ? await sendTwilio(r.candidate.voice) : { sent: false, reason: "no overdue items and outside the morning window" };
  console.log(`Call: ${res.sent ? "placed" : "not placed"} (${res.reason})`);
}
process.exit(r.ok ? 0 : 1);
