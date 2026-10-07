// Jarvis's studio voice. The playbook's fixed lines are pre-recorded with ElevenLabs by
// scripts/voice-build.ts (on the owner's machine, with his key) and shipped as static MP3s, so no
// key ever reaches the browser. Each clip is pinned to a hash of the exact text it says: change a
// line and its old clip is ignored until it is re-recorded, and the browser voice covers the gap.
// Shared by the browser and the build script, so: no DOM, no Node imports.

import { fill, speakable } from "./markup.ts";
import type { Line } from "./types.ts";

export const GREETS = ["Good morning", "Good afternoon", "Good evening"] as const;

export interface Clip {
  file: string;
  hash: string;
  chars: number;
}

export interface VoiceManifest {
  version: 1;
  voice: { name: string; id: string };
  model: string;
  credit: string;
  clips: Record<string, Clip>;
}

/** Pause marks become ElevenLabs break tags. A single "|" is left to punctuation: too many break
 * tags in one generation make the voice unstable. */
export function ttsText(markup: string): string {
  return speakable(markup)
    .replace(/\s*\|\|\|\s*/g, ' <break time="1.0s" /> ')
    .replace(/\s*\|\|\s*/g, ' <break time="0.6s" /> ')
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** What a clip says: the line with its greeting filled and any visitor name dropped. */
export function clipText(line: Line, greet?: string): string {
  return ttsText(fill(line.text, { greet }));
}

export function clipKey(id: string, greet?: string): string {
  return greet ? `${id}.${greet.split(" ")[1]!.toLowerCase()}` : id;
}

/** Every clip the playbook needs: one per line, three for lines that open with a greeting. */
export function clipsFor(lines: Line[]): { key: string; text: string }[] {
  return lines.flatMap((l) =>
    l.text.includes("{greet}") ? GREETS.map((g) => ({ key: clipKey(l.id, g), text: clipText(l, g) })) : [{ key: clipKey(l.id), text: clipText(l) }],
  );
}

/** FNV-1a, 32-bit: stable in Node and the browser, no crypto needed. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The recorded clip for this line right now, or null if there isn't a current one. */
export function pickClip(m: VoiceManifest | null, line: Line, greet: string): Clip | null {
  if (!m) return null;
  const g = line.text.includes("{greet}") ? greet : undefined;
  const c = m.clips[clipKey(line.id, g)];
  return c && c.hash === hashText(clipText(line, g)) ? c : null;
}
