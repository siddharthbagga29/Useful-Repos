// Record Jarvis's playbook lines with ElevenLabs. Run on your own machine:
//
//   ELEVENLABS_API_KEY=… npm run voice:build                 record new or changed lines
//   npm run voice:build -- --dry-run                         show what would be recorded and the cost
//   ELEVENLABS_API_KEY=… npm run voice:build -- --list-voices   British male voices on your account
//   flags: --voice <name or id> (default Daniel), --model <id> (default eleven_multilingual_v2),
//          --budget <characters> (default 9000; the free plan has 10,000 credits a month)
//
// Writes public/voice/<key>.mp3 and public/voice/manifest.json. Only lines whose text changed since
// their last recording are sent, so a re-run after a small edit costs only that line. The key is
// read from the environment and never written anywhere.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clipsFor, hashText, type VoiceManifest } from "../src/jarvis/sales/clips.ts";
import type { Playbook } from "../src/jarvis/sales/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/voice");
const API = "https://api.elevenlabs.io/v1";
const args = process.argv.slice(2);
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const key = process.env.ELEVENLABS_API_KEY ?? "";
const dry = args.includes("--dry-run") || !key;
const model = flag("model") ?? "eleven_multilingual_v2";
const budget = Number(flag("budget") ?? 9000);
const wantVoice = flag("voice") ?? process.env.ELEVENLABS_VOICE ?? "Daniel";
// JARVIS-like delivery: steady and even, close to the original timbre, no theatrics.
const SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true };

type Voice = { voice_id: string; name: string; labels?: Record<string, string> };

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${API}${path}`, { ...init, headers: { "xi-api-key": key, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} on ${path}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

async function voices(): Promise<Voice[]> {
  const r = (await (await api("/voices")).json()) as { voices: Voice[] };
  return r.voices;
}

async function main() {
  if (args.includes("--list-voices")) {
    if (!key) throw new Error("set ELEVENLABS_API_KEY to list your voices");
    const vs = await voices();
    const brit = vs.filter((v) => /brit|english|uk/i.test(v.labels?.accent ?? "") && /male/i.test(v.labels?.gender ?? "") && !/female/i.test(v.labels?.gender ?? ""));
    for (const v of brit.length ? brit : vs) console.log(`${v.name.padEnd(28)} ${v.voice_id}  ${Object.values(v.labels ?? {}).join(" · ")}`);
    return;
  }

  const playbook = JSON.parse(readFileSync(join(ROOT, "src/jarvis/sales/playbook.json"), "utf8")) as Playbook;
  const manifestPath = join(OUT, "manifest.json");
  const old: VoiceManifest | null = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const all = clipsFor(Object.values(playbook.lines));

  let voice = old?.voice ?? { name: wantVoice, id: "" };
  if (!dry && (!old || (old.voice.name !== wantVoice && old.voice.id !== wantVoice))) {
    const vs = await voices();
    const v = vs.find((x) => x.voice_id === wantVoice) ?? vs.find((x) => x.name.toLowerCase().startsWith(wantVoice.toLowerCase()));
    if (!v) throw new Error(`no voice "${wantVoice}" on this account; try --list-voices`);
    voice = { name: v.name, id: v.voice_id };
  }
  const sameVoice = old && old.voice.id === voice.id && old.model === model;
  const todo = all.filter((c) => !(sameVoice && old?.clips[c.key]?.hash === hashText(c.text) && existsSync(join(OUT, old.clips[c.key]!.file))));
  const chars = todo.reduce((a, c) => a + c.text.length, 0);
  console.log(`${all.length} clips · ${todo.length} to record · ${chars} characters (≈${chars} credits on ${model}) · voice ${voice.name}`);
  if (chars > budget) throw new Error(`${chars} characters is over the --budget of ${budget}; raise it deliberately or record fewer lines`);
  if (dry) {
    for (const c of todo) console.log(`  ${c.key.padEnd(24)} ${c.text.slice(0, 90)}${c.text.length > 90 ? "…" : ""}`);
    if (!key) console.log("dry run: set ELEVENLABS_API_KEY to record");
    return;
  }

  mkdirSync(OUT, { recursive: true });
  const clips: VoiceManifest["clips"] = sameVoice ? { ...old!.clips } : {};
  for (const c of todo) {
    const r = await api(`/text-to-speech/${voice.id}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: c.text, model_id: model, voice_settings: SETTINGS }),
    });
    const file = `${c.key}.mp3`;
    writeFileSync(join(OUT, file), Buffer.from(await r.arrayBuffer()));
    clips[c.key] = { file, hash: hashText(c.text), chars: c.text.length };
    console.log(`  recorded ${c.key}`);
  }
  // drop clips for lines that no longer exist
  const live = new Set(all.map((c) => c.key));
  for (const k of Object.keys(clips)) if (!live.has(k)) delete clips[k];
  const manifest: VoiceManifest = { version: 1, voice, model, credit: "Voice by ElevenLabs", clips };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest written: ${Object.keys(clips).length} clips`);
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
