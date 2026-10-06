import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import briefText from "../../../jarvis/knowledge/brief.md?raw";
import { Engine, digest, research, type Answer, type Citation, type DigestSection, type Skill, type TraceStep } from "./engine.ts";
import { Listener, Speaker, canListen, canSpeak } from "./speech.ts";
import { clearMemory, loadMemory, parseIntroduction, saveMemory, type Settings, type Stored } from "./memory.ts";
import { bus } from "./bus.ts";
import type { GPUInfo } from "./llm.ts";

export type AgentId = "chat" | "research" | "digest";
export type Status = "idle" | "armed" | "listening" | "thinking" | "speaking";

export interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
  agent?: AgentId;
  engine?: "instant" | "neural" | "guard-fallback";
  intent?: string;
  citations?: Citation[];
  skills?: Skill[];
  trace?: TraceStep[];
  ms?: number;
  digest?: DigestSection[];
  fresh?: boolean;
}

export interface Neural {
  state: "off" | "probing" | "unsupported" | "loading" | "ready" | "error";
  progress: number;
  text: string;
  gpu?: GPUInfo;
}

export interface Pulse {
  lastMs: number | null;
  tokPerSec: number | null;
  answered: number;
  cloudCalls: 0;
  costUsd: 0;
}

interface JarvisApi {
  engine: Engine;
  messages: Msg[];
  status: Status;
  interim: string;
  agent: AgentId;
  setAgent(a: AgentId): void;
  settings: Settings;
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void;
  neural: Neural;
  enableNeural(): Promise<void>;
  pulse: Pulse;
  voice: { in: boolean; out: boolean; error: string | null };
  speakingSection: { msg: number; index: number } | null;
  visitor: Stored["visitor"];
  ask(text: string, opts?: { agent?: AgentId; viaVoice?: boolean }): void;
  runDigest(): void;
  playDigest(id: number, sections: DigestSection[]): void;
  speak(text: string): void;
  stopSpeaking(): void;
  pushToTalk(): void;
  stopListening(): void;
  clear(): void;
  open: boolean;
  setOpen(o: boolean): void;
}

const Ctx = createContext<JarvisApi | null>(null);

export function useJarvis() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useJarvis outside JarvisProvider");
  return v;
}

const AUTO_SKILLS = new Set<Skill["name"]>(["navigate", "set_dcf"]);

let nextId = 1;

export function JarvisProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => new Engine({ brief: briefText }), []);
  const memory = useRef<Stored>(loadMemory());

  const [messages, setMessages] = useState<Msg[]>(() => {
    const m = memory.current;
    const restored: Msg[] = m.turns.slice(-12).map((t) => ({ id: nextId++, role: t.role, text: t.content }));
    const hello = m.visitor
      ? `Welcome back, ${m.visitor.name}. Ask me anything about Siddharth's work — or say "brief me".`
      : "Jarvis online. I'm Siddharth's personal AI assistant, running entirely in your browser. Ask about his deals, models and credentials — type, or hold the mic and talk.";
    return [...restored, { id: nextId++, role: "assistant", text: hello, intent: "greeting", engine: "instant" }];
  });
  const [status, setStatus] = useState<Status>("idle");
  const [interim, setInterim] = useState("");
  const [agent, setAgent] = useState<AgentId>("chat");
  const [settings, setSettings] = useState<Settings>(memory.current.settings);
  const [neural, setNeural] = useState<Neural>({ state: "off", progress: 0, text: "" });
  const [pulse, setPulse] = useState<Pulse>({ lastMs: null, tokPerSec: null, answered: 0, cloudCalls: 0, costUsd: 0 });
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingSection, setSpeakingSection] = useState<{ msg: number; index: number } | null>(null);
  const [visitor, setVisitor] = useState(memory.current.visitor);
  const [open, setOpenState] = useState(() => typeof location !== "undefined" && location.hash === "#jarvis");

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const neuralRef = useRef(neural);
  neuralRef.current = neural;
  const busy = useRef(false);

  const speaker = useMemo(() => new Speaker((on) => setStatus((s) => (on ? "speaking" : s === "speaking" ? "idle" : s))), []);
  const askRef = useRef<JarvisApi["ask"]>(() => {});

  const listener = useMemo(
    () =>
      new Listener({
        onInterim: (t) => setInterim(t),
        onFinal: (t) => {
          setInterim("");
          askRef.current(t, { viaVoice: true });
        },
        onState: (s) => setStatus((cur) => (cur === "thinking" || cur === "speaking" ? cur : s)),
        onError: (m) => {
          setVoiceError(m);
          setStatus("idle");
          setSettings((s) => ({ ...s, wake: false }));
        },
      }),
    [],
  );

  // persist
  useEffect(() => {
    memory.current.settings = settings;
    memory.current.visitor = visitor;
    memory.current.turns = messages
      .filter((m) => m.intent !== "greeting" && !m.digest)
      .map((m) => ({ role: m.role, content: m.text }));
    saveMemory(memory.current);
  }, [settings, visitor, messages]);

  useEffect(() => {
    listener.wake(settings.wake);
    return () => listener.stop();
  }, [settings.wake, listener]);

  const setOpen = useCallback((o: boolean) => {
    setOpenState(o);
    const want = o ? "#jarvis" : "";
    if ((location.hash || "") !== want) history.replaceState(null, "", want || location.pathname + location.search);
  }, []);

  useEffect(() => {
    const onHash = () => setOpenState(location.hash === "#jarvis");
    addEventListener("hashchange", onHash);
    const off = bus.on((e) => {
      if (e.type === "open_jarvis") {
        if (e.agent) setAgent(e.agent);
        setOpen(true);
      }
      if (e.type === "close_jarvis") setOpen(false);
    });
    return () => {
      removeEventListener("hashchange", onHash);
      off();
    };
  }, [setOpen]);

  const say = useCallback(
    async (text: string, onSentence?: (i: number) => void) => {
      if (!canSpeak()) return;
      listener.pause();
      await speaker.speak(text, onSentence);
      listener.resume();
    },
    [listener, speaker],
  );

  const add = (m: Omit<Msg, "id">) => {
    const id = nextId++;
    setMessages((xs) => [...xs.map((x) => (x.fresh ? { ...x, fresh: false } : x)), { ...m, id, fresh: true }]);
    return id;
  };
  const patch = (id: number, p: Partial<Msg>) => setMessages((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const digestTicket = useRef(0);

  const playDigest = useCallback(
    (id: number, sections: DigestSection[]) => {
      if (!canSpeak()) return;
      const ticket = ++digestTicket.current;
      void (async () => {
        listener.pause();
        for (let i = 0; i < sections.length && ticket === digestTicket.current; i++) {
          setSpeakingSection({ msg: id, index: i });
          await speaker.speak(sections[i]!.text);
        }
        if (ticket === digestTicket.current) setSpeakingSection(null);
        listener.resume();
      })();
    },
    [listener, speaker],
  );

  const runDigest = useCallback(() => {
    const sections = digest();
    const id = add({ role: "assistant", text: sections.map((s) => s.text).join(" "), digest: sections, agent: "digest", engine: "instant", intent: "agent.digest", trace: [{ kind: "route", label: "agent → digest" }, { kind: "synthesize", label: "digest.compose", detail: `${sections.length} sections` }] });
    setPulse((p) => ({ ...p, answered: p.answered + 1 }));
    if (settingsRef.current.autoSpeak) playDigest(id, sections);
  }, [playDigest]);

  const stopRef = useRef(0);

  const ask = useCallback(
    (raw: string, opts: { agent?: AgentId; viaVoice?: boolean } = {}) => {
      const text = raw.trim().slice(0, 600);
      if (!text || busy.current) return;
      const mode = opts.agent ?? agent;
      digestTicket.current++;
      setSpeakingSection(null);
      speaker.cancel();
      add({ role: "user", text });

      const intro = parseIntroduction(text);
      if (intro) {
        setVisitor(intro);
        const reply = `Noted, ${intro.name}${intro.org ? ` from ${intro.org}` : ""} — I'll remember that on this device. What would you like to know about Siddharth?`;
        add({ role: "assistant", text: reply, engine: "instant", intent: "memory.remember", trace: [{ kind: "tool", label: "memory.remember", detail: "localStorage" }] });
        if (settingsRef.current.autoSpeak || opts.viaVoice) void say(reply);
        return;
      }

      if (mode === "digest") {
        runDigest();
        return;
      }

      busy.current = true;
      setStatus("thinking");
      const t0 = performance.now();
      let ans: Answer;
      let agentUsed: AgentId = mode;
      if (mode === "research") {
        const r = research(engine, text);
        ans = { text: r.text, intent: "agent.research", citations: r.citations, skills: r.subQuestions.flatMap((s) => s.answer.skills).slice(0, 4), trace: r.trace, pinned: true };
      } else {
        ans = engine.answer(text);
        agentUsed = "chat";
      }
      const ms = performance.now() - t0;

      const finish = (finalText: string) => {
        busy.current = false;
        setStatus("idle");
        for (const s of ans.skills) {
          if (s.name === "navigate") bus.emit({ type: "navigate", station: s.station });
          if (s.name === "set_dcf") bus.emit({ type: "set_dcf", wacc: s.wacc, g: s.g });
        }
        if (ans.skills.some((s) => s.name === "run_digest") && ans.intent === "digest") {
          runDigest();
          return;
        }
        if (settingsRef.current.autoSpeak || opts.viaVoice) void say(finalText);
      };

      const useNeural = settingsRef.current.neural && neuralRef.current.state === "ready" && !ans.pinned && mode === "chat";
      if (!useNeural) {
        add({ role: "assistant", text: ans.text, agent: agentUsed, engine: "instant", intent: ans.intent, citations: ans.citations, skills: ans.skills.filter((s) => !AUTO_SKILLS.has(s.name) && !(s.name === "run_digest" && ans.intent === "digest")), trace: ans.trace, ms });
        setPulse((p) => ({ ...p, lastMs: ms, answered: p.answered + 1 }));
        finish(ans.text);
        return;
      }

      const id = add({ role: "assistant", text: "…", agent: "chat", engine: "neural", intent: ans.intent, citations: ans.citations, trace: [...ans.trace, { kind: "synthesize", label: "webllm.generate", detail: "on-device" }] });
      const ticket = ++stopRef.current;
      void (async () => {
        try {
          const llm = await import("./llm.ts");
          const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.text }));
          const g = await llm.generate(text, engine.context(text), history, (partial) => ticket === stopRef.current && patch(id, { text: partial }));
          const secs = g.ms / 1000;
          setPulse((p) => ({ ...p, lastMs: g.ms, tokPerSec: secs > 0 ? g.tokens / secs : null, answered: p.answered + 1 }));
          if (g.rejected) {
            patch(id, { text: ans.text, engine: "guard-fallback", trace: [...ans.trace, { kind: "guard", label: "output.guard", detail: "LLM draft rejected → extractive answer" }] });
            finish(ans.text);
          } else {
            patch(id, { text: g.text, ms: g.ms });
            finish(g.text);
          }
        } catch {
          patch(id, { text: ans.text, engine: "instant" });
          finish(ans.text);
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent, engine, messages, runDigest, say, speaker],
  );
  askRef.current = ask;

  const enableNeural = useCallback(async () => {
    if (neuralRef.current.state === "ready" || neuralRef.current.state === "loading") {
      setSettings((s) => ({ ...s, neural: true }));
      return;
    }
    setNeural({ state: "probing", progress: 0, text: "Checking WebGPU…" });
    const llm = await import("./llm.ts");
    const gpu = await llm.probeGPU();
    if (!gpu.ok) {
      setNeural({ state: "unsupported", progress: 0, text: gpu.reason ?? "WebGPU unavailable.", gpu });
      setSettings((s) => ({ ...s, neural: false }));
      return;
    }
    setNeural({ state: "loading", progress: 0, text: "Downloading model…", gpu });
    try {
      await llm.load((p, t) => setNeural({ state: "loading", progress: p, text: t, gpu }), gpu.f16);
      setNeural({ state: "ready", progress: 1, text: `${llm.MODEL_LABEL} ready on your GPU.`, gpu });
      setSettings((s) => ({ ...s, neural: true }));
    } catch (e) {
      setNeural({ state: "error", progress: 0, text: e instanceof Error ? e.message.slice(0, 160) : "Model failed to load.", gpu });
      setSettings((s) => ({ ...s, neural: false }));
    }
  }, []);

  const api: JarvisApi = {
    engine,
    messages,
    status,
    interim,
    agent,
    setAgent,
    settings,
    setSetting: (k, v) => {
      if (k === "neural" && v === true) {
        void enableNeural();
        return;
      }
      if (k === "wake") setVoiceError(null);
      setSettings((s) => ({ ...s, [k]: v }));
    },
    neural,
    enableNeural,
    pulse,
    voice: { in: canListen(), out: canSpeak(), error: voiceError },
    speakingSection,
    visitor,
    ask,
    runDigest,
    playDigest,
    speak: (t) => void say(t),
    stopSpeaking: () => {
      digestTicket.current++;
      speaker.cancel();
      setSpeakingSection(null);
      listener.resume();
    },
    pushToTalk: () => {
      setVoiceError(null);
      speaker.cancel();
      listener.pushToTalk();
    },
    stopListening: () => {
      setSettings((s) => ({ ...s, wake: false }));
      listener.stop();
    },
    clear: () => {
      clearMemory();
      memory.current = loadMemory();
      setVisitor(undefined);
      setMessages([{ id: nextId++, role: "assistant", text: "Memory cleared. Fresh start — what would you like to know?", intent: "greeting", engine: "instant" }]);
    },
    open,
    setOpen,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
