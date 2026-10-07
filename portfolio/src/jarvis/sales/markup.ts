// Spoken-script markup for Jarvis. Plain text with pause marks, so a line reads naturally on screen
// and sounds like a person aloud: short clauses, a breath between them, a longer beat before a
// question. Shared by the browser (speech) and the critic (scoring).
//
//   |    a breath   (~280 ms)
//   ||   a beat     (~620 ms)
//   |||  a long beat (~1050 ms)
//   {name}  a variable filled at runtime (fill)

export const PAUSE_MS: Record<string, number> = { "|": 280, "||": 620, "|||": 1050 };
const SENTENCE_GAP = 160; // between sentences inside one clause group

export interface Spoken {
  text: string;
  pauseAfterMs: number;
  question: boolean;
}

/** Split a scripted line into speakable segments with the pause that follows each. */
export function parseScript(markup: string): Spoken[] {
  const out: Spoken[] = [];
  const parts = markup.split(/(\|{1,3})/);
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = (parts[i] ?? "").trim();
    const mark = parts[i + 1];
    if (!chunk) continue;
    const sentences = chunk.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [chunk];
    sentences.forEach((s, k) => {
      const last = k === sentences.length - 1;
      out.push({ text: s, pauseAfterMs: last ? (mark ? (PAUSE_MS[mark] ?? 0) : 0) : SENTENCE_GAP, question: s.endsWith("?") });
    });
  }
  return out;
}

/** The line as it reads on screen: pause marks removed, spacing tidied. */
export function displayText(markup: string): string {
  return markup
    .replace(/\s*\|{1,3}\s*/g, " ")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fill {variables}; an unset variable is dropped with the comma or space before it. */
export function fill(markup: string, vars: Record<string, string | undefined>): string {
  return markup.replace(/(,?\s?)\{(\w+)\}/g, (_, sep: string, k: string) => (vars[k] ? `${sep}${vars[k]}` : ""));
}

/** Sentences of a line, for scoring. */
export function sentences(markup: string): string[] {
  return parseScript(markup).map((s) => s.text);
}

const MONTHS: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April", Jun: "June", Jul: "July",
  Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

/** Numbers and finance shorthand the way a person says them aloud (browser voice and studio clips). */
export function speakable(text: string): string {
  return text
    .replace(/\ba \$(\d+(?:\.\d+)?)M\+/g, "a $1-million-dollar-plus")
    .replace(/\$(\d+(?:\.\d+)?)M\+/g, "over $1 million dollars")
    .replace(/\$(\d+(?:\.\d+)?)M\b/g, "$1 million dollars")
    .replace(/\$(\d+(?:\.\d+)?)B\b/g, "$1 billion dollars")
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/\bIRR\/MOIC\b/g, "IRR and MOIC")
    .replace(/\bS&P\b/g, "S and P")
    .replace(/\bSPGI\b/g, "S and P Global")
    .replace(/\bDCF\b/g, "D C F")
    .replace(/\bM\.S\./g, "Master of Science")
    .replace(/\bB\.Com\b/g, "Bachelor of Commerce")
    .replace(/\bReg D\b/g, "Reg D")
    .replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m) => MONTHS[m] ?? m)
    .replace(/(\w)–(\w)/g, "$1 to $2")
    .replace(/[—–]/g, ", ")
    .replace(/[•▸→]/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/siddharthbagga29@gmail\.com/g, "siddharth bagga 29 at gmail dot com")
    .replace(/linkedin\.com\/in\/[\w-]+/g, "LinkedIn");
}
