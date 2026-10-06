// Per-visitor memory in localStorage. Lives only in this browser; never sent anywhere.

export interface Settings {
  autoSpeak: boolean;
  wake: boolean;
  neural: boolean;
}

export interface Stored {
  visitor?: { name: string; org?: string };
  turns: { role: "user" | "assistant"; content: string }[];
  settings: Settings;
}

const KEY = "jarvis.memory.v1";
const DEFAULTS: Stored = { turns: [], settings: { autoSpeak: true, wake: false, neural: false } };

export function loadMemory(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      visitor: parsed.visitor,
      turns: Array.isArray(parsed.turns) ? parsed.turns.slice(-40) : [],
      settings: { ...DEFAULTS.settings, ...parsed.settings, wake: false },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveMemory(m: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...m, turns: m.turns.slice(-40) }));
  } catch {
    /* private mode or storage full: memory is a convenience */
  }
}

export function clearMemory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** "I'm Priya from Evercore" → { name: "Priya", org: "Evercore" } */
export function parseIntroduction(text: string): { name: string; org?: string } | null {
  const m = text.replace(/\u2019/g, "'").match(/\b(?:[Ii]'?m|[Ii] am|[Mm]y name is|[Tt]his is)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?(?:[\s,]+(?:from|at|with)\s+([A-Z][\w&.\- ]{1,40}?))?[\s.!,]*$/);
  if (!m || /^(not|just|looking|here|a|an|the)$/i.test(m[1]!)) return null;
  return { name: m[1]!, org: m[2]?.trim() };
}
