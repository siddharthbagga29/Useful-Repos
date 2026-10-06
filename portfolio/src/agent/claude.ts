// Optional Claude layer for the loop (opt-in: JARVIS_CLAUDE=1 or --claude; it costs money).
//  - critic: scores conversational flow 0–25 against the same rubric and explains what to fix;
//  - actor:  rewrites only the lines the critic flagged, keeping facts and pause markup.
// The deterministic critic still re-checks every number and gate afterwards, so a model can't talk
// its way past the honesty rules. Server-side refusal fallbacks are enabled ("default").

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Line } from "../jarvis/sales/types.ts";
import type { Issue } from "./types.ts";

const MODEL = "claude-opus-5-5";

const PERSONA = `You are reviewing scripts for Jarvis, the assistant on Siddharth Bagga's portfolio site.
Jarvis speaks like a calm private-equity closer with fifteen years of experience: short clauses,
plain words, one specific proof at a time, a question at the end of every turn, the smallest
possible next step. Natural and human, never salesy or robotic. Pause marks: "|" a breath, "||" a
beat, "|||" a long beat. Honesty is non-negotiable: no invented numbers, urgency, scarcity, social
proof or credentials. Siddharth has NOT sat the CFA exam (he won a merit scholarship for the Level I
exam fee). He does not manage money or give investment advice.`;

const Flow = z.object({
  flow: z.number().describe("0–25: conciseness, directness, zero meta-fluff, natural spoken phrasing"),
  notes: z.string().describe("the three most important fixes, one line each"),
});

const Rewrites = z.object({
  lines: z.array(z.object({ id: z.string(), text: z.string() })),
});

export const claudeEnabled = (env: NodeJS.ProcessEnv = process.env) => env.JARVIS_CLAUDE === "1";

function client() {
  return new Anthropic(); // ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile
}

async function ask<T extends z.ZodType>(schema: T, system: string, user: string): Promise<z.infer<T> | null> {
  try {
    const res = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") return null;
    return (res.parsed_output as z.infer<T> | null) ?? null;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.warn("claude: no valid credentials; continuing with the deterministic critic");
    else if (err instanceof Anthropic.RateLimitError) console.warn("claude: rate limited; continuing with the deterministic critic");
    else if (err instanceof Anthropic.APIError) console.warn(`claude: API error ${err.status}; continuing deterministically`);
    else console.warn(`claude: ${(err as Error).message}; continuing deterministically`);
    return null;
  }
}

export async function claudeCritique(lines: Line[], briefing: string): Promise<{ flow: number; notes: string } | null> {
  const body = [...lines.map((l) => `[${l.id}] ${l.text}`), `[briefing] ${briefing}`].join("\n");
  return ask(Flow, PERSONA, `Score the conversational flow of these scripts (0–25) and name the top fixes.\n\n${body}`);
}

export async function claudeRewrite(lines: Line[], issues: Issue[]): Promise<Line[]> {
  const flagged = lines.filter((l) => issues.some((i) => i.where === `line:${l.id}`));
  if (!flagged.length) return lines;
  const brief = flagged
    .map((l) => `[${l.id}] ${l.text}\n  problems: ${issues.filter((i) => i.where === `line:${l.id}`).map((i) => `${i.code} (${i.detail})`).join("; ")}`)
    .join("\n");
  const out = await ask(Rewrites, PERSONA, `Rewrite only these lines to fix the listed problems. Keep every fact, keep the pause marks style, end each with a question.\n\n${brief}`);
  if (!out) return lines;
  const byId = new Map(out.lines.map((r) => [r.id, r.text]));
  return lines.map((l) => (byId.has(l.id) ? { ...l, text: byId.get(l.id)! } : l));
}
