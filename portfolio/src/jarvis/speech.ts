// Voice in and out with the browser's built-in Web Speech API. Free, no keys, no server of ours.
// Push-to-talk: one utterance. Wake mode: listens continuously and acts on "Hey Jarvis …".

import { speakable } from "./sales/markup.ts";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

const RecognitionCtor = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null;
};

export const canListen = () => RecognitionCtor() !== null;
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

const WAKE = /\b(?:hey|hi|ok|okay|yo)?[\s,]*(?:jarvis|jervis|javis)\b[\s,.:!?]*/i;

export interface ListenHandlers {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onState(state: "idle" | "listening" | "armed"): void;
  onError(message: string): void;
}

export class Listener {
  private rec: Recognition | null = null;
  private mode: "off" | "ptt" | "wake" = "off";
  private armedUntil = 0;

  constructor(private h: ListenHandlers) {}

  get active() {
    return this.mode;
  }

  pushToTalk() {
    this.stop();
    this.mode = "ptt";
    this.begin(false);
  }

  wake(on: boolean) {
    this.stop();
    if (!on) return;
    this.mode = "wake";
    this.begin(true);
  }

  stop() {
    const r = this.rec;
    this.mode = "off";
    this.rec = null;
    if (r) {
      r.onend = null;
      try {
        r.abort();
      } catch {
        /* already stopped */
      }
    }
    this.h.onState("idle");
  }

  /** Pause while Jarvis speaks so it doesn't hear itself; resume afterwards in wake mode. */
  pause() {
    if (this.rec) {
      this.rec.onend = null;
      try {
        this.rec.abort();
      } catch {
        /* noop */
      }
      this.rec = null;
    }
  }

  resume() {
    if (this.mode === "wake" && !this.rec) this.begin(true);
  }

  private begin(continuous: boolean) {
    const Ctor = RecognitionCtor();
    if (!Ctor) {
      this.h.onError("Voice input isn't supported in this browser. Chrome, Edge and Safari support it.");
      this.mode = "off";
      return;
    }
    const rec = new Ctor();
    rec.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => this.h.onState(this.mode === "wake" ? "armed" : "listening");
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) this.final(text);
        else interim += text;
      }
      if (interim) this.interim(interim);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.h.onError("Microphone access was blocked. Allow it in the address bar to talk to Jarvis.");
        this.mode = "off";
      } else if (e.error === "network") {
        this.h.onError("Voice recognition needs a network connection in this browser. Typing still works.");
        this.mode = "off";
      } else {
        this.h.onError(`Voice error: ${e.error}.`);
      }
    };
    rec.onend = () => {
      this.rec = null;
      if (this.mode === "wake") {
        setTimeout(() => this.mode === "wake" && !this.rec && this.begin(true), 250);
      } else {
        this.mode = "off";
        this.h.onState("idle");
      }
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      this.h.onError("Couldn't start the microphone.");
    }
  }

  private interim(text: string) {
    if (this.mode === "ptt") return this.h.onInterim(text);
    const armed = Date.now() < this.armedUntil;
    if (armed || WAKE.test(text)) {
      this.h.onState("listening");
      this.h.onInterim(text.replace(WAKE, "").trim());
    }
  }

  private final(text: string) {
    const t = text.trim();
    if (!t) return;
    if (this.mode === "ptt") {
      this.h.onFinal(t);
      return;
    }
    const m = t.match(WAKE);
    if (m) {
      const rest = t.slice((m.index ?? 0) + m[0].length).trim();
      if (rest.length > 1) {
        this.armedUntil = 0;
        this.h.onFinal(rest);
      } else {
        this.armedUntil = Date.now() + 8000; // "Hey Jarvis" … pause … question
        this.h.onState("listening");
      }
    } else if (Date.now() < this.armedUntil) {
      this.armedUntil = 0;
      this.h.onFinal(t);
    } else {
      this.h.onState("armed");
    }
  }
}

// ---------------- speech out ----------------

const PREFERRED = [/jamie/i, /daniel/i, /google uk english male/i, /arthur/i, /oliver/i, /ryan/i, /george/i, /en-gb/i, /^en/i];
// Neural voices (Edge "… Online (Natural)", Apple "Premium"/"Enhanced") sound far more human than
// the classic system voices; take one whenever the browser offers it.
const NATURAL = /natural|neural|premium|enhanced/i;
// British first: Apple's Jamie (Premium), Edge's Ryan and Thomas, Apple's Daniel, Oliver, George
// and Arthur are en-GB.
const NATURAL_PREF = [/jamie|ryan|thomas|daniel|oliver|george|arthur/i, /en-gb/i, /guy|andrew|christopher|eric|brian/i, /en-us/i];

export function pickVoice(): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null;
  const voices = speechSynthesis.getVoices();
  const natural = voices.filter((v) => NATURAL.test(v.name) && /^en/i.test(v.lang));
  for (const re of NATURAL_PREF) {
    const v = natural.find((x) => re.test(x.name) || re.test(x.lang));
    if (v) return v;
  }
  if (natural[0]) return natural[0];
  for (const re of PREFERRED) {
    const v = voices.find((x) => re.test(x.name) || re.test(x.lang));
    if (v) return v;
  }
  return voices[0] ?? null;
}


/** Make numbers and finance shorthand sound right when read aloud. */

export class Speaker {
  private queue = 0;
  private audio: HTMLAudioElement | null = null;
  constructor(private onState: (speaking: boolean) => void) {
    if (canSpeak()) speechSynthesis.getVoices(); // warm the voice list (async on Chrome)
  }

  cancel() {
    this.queue++;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (canSpeak()) speechSynthesis.cancel();
    this.onState(false);
  }

  /** Play a pre-recorded studio clip. Resolves true when it played to the end, false if it couldn't
   * play (missing file, blocked autoplay), so the caller can fall back to the browser voice. */
  playClip(url: string): Promise<boolean> {
    this.cancel();
    const ticket = ++this.queue;
    const a = new Audio(url);
    this.audio = a;
    return new Promise((resolve) => {
      const end = (ok: boolean) => {
        if (ticket === this.queue) {
          this.audio = null;
          this.onState(false);
        }
        resolve(ok);
      };
      a.onended = () => end(true);
      a.onerror = () => end(false);
      a.play().then(
        () => ticket === this.queue && this.onState(true),
        () => end(false),
      );
    });
  }

  /** Speak sentence by sentence (Chrome cuts long utterances). Resolves when finished or cancelled. */
  speak(text: string, onSentence?: (i: number) => void): Promise<void> {
    if (!canSpeak()) return Promise.resolve();
    this.cancel();
    const ticket = ++this.queue;
    const parts = speakable(text).match(/[^.!?\n]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
    const voice = pickVoice();
    this.onState(true);
    return new Promise((resolve) => {
      const next = (i: number) => {
        if (ticket !== this.queue || i >= parts.length) {
          if (ticket === this.queue) this.onState(false);
          resolve();
          return;
        }
        const u = new SpeechSynthesisUtterance(parts[i]);
        if (voice) u.voice = voice;
        u.rate = 1.04;
        u.pitch = 0.92;
        u.onstart = () => onSentence?.(i);
        u.onend = () => next(i + 1);
        u.onerror = () => next(i + 1);
        speechSynthesis.speak(u);
      };
      next(0);
    });
  }

  /**
   * Speak a scripted line (markup.ts) like a person: one clause at a time, real silence between
   * clauses, a slightly slower and lifted delivery on questions, and small pace variation so it
   * doesn't sound metronomic. Resolves when finished or cancelled.
   */
  speakScript(segments: { text: string; pauseAfterMs: number; question: boolean }[]): Promise<void> {
    if (!canSpeak() || !segments.length) return Promise.resolve();
    this.cancel();
    const ticket = ++this.queue;
    const voice = pickVoice();
    const natural = !!voice && NATURAL.test(voice.name);
    this.onState(true);
    return new Promise((resolve) => {
      const done = () => {
        if (ticket === this.queue) this.onState(false);
        resolve();
      };
      const next = (i: number) => {
        if (ticket !== this.queue || i >= segments.length) return done();
        const seg = segments[i]!;
        const u = new SpeechSynthesisUtterance(speakable(seg.text));
        if (voice) u.voice = voice;
        const jitter = (((i * 37) % 5) - 2) * 0.012; // deterministic, ±2.4%
        u.rate = (natural ? 1.0 : 1.03) + jitter - (seg.question ? 0.04 : 0) - (i === 0 ? 0.03 : 0);
        u.pitch = (natural ? 1.0 : 0.93) + (seg.question ? 0.05 : 0);
        const after = () => {
          if (ticket !== this.queue) return done();
          if (seg.pauseAfterMs > 0) setTimeout(() => next(i + 1), seg.pauseAfterMs);
          else next(i + 1);
        };
        u.onend = after;
        u.onerror = after;
        speechSynthesis.speak(u);
      };
      next(0);
    });
  }
}

export { speakable };
