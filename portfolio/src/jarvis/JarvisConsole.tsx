import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useJarvis, type AgentId, type Msg } from "./JarvisProvider.tsx";
import { Orb } from "./Orb.tsx";
import { bus } from "./bus.ts";
import { CONTACT, STATIONS, exhibit } from "../data/site.ts";
import type { Skill } from "./engine.ts";
import { MODEL_LABEL_STATIC } from "./labels.ts";

const SUGGESTIONS = [
  "Brief me",
  "How did he price the acquisition pipeline?",
  "Is he a CFA charterholder?",
  "Set WACC to 10%",
  "What are his gaps?",
  "Why should we interview him?",
];

const AGENTS: { id: AgentId; name: string; desc: string }[] = [
  { id: "chat", name: "Chat", desc: "Instant answers with sources" },
  { id: "research", name: "Research", desc: "Splits compound questions, cites each part" },
  { id: "digest", name: "Briefing", desc: "The 60-second spoken brief" },
];

const SKILLS = [
  ["navigate", "Moves the page to any station"],
  ["set_dcf", "Drives the S&P Global model"],
  ["open_exhibit", "Opens the original documents"],
  ["draft_email", "Writes the message for you to send"],
  ["remember", "Remembers your name on this device"],
] as const;

const STATUS_TEXT = {
  idle: "Ready",
  armed: "Say “Hey Jarvis”…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
} as const;

export function JarvisConsole({ variant }: { variant: "station" | "full" }) {
  const j = useJarvis();
  const [text, setText] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [j.messages, j.interim]);

  useEffect(() => {
    if (variant === "full") input.current?.focus({ preventScroll: true });
  }, [variant]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    j.ask(text);
    setText("");
  };

  const micLive = j.status === "listening";

  return (
    <section className={`jx jx-${variant}`} aria-label="Jarvis, Siddharth's AI assistant">
      <header className="jx-head">
        <Orb status={j.status} size={variant === "full" ? 46 : 38} />
        <div className="jx-title">
          <strong>JARVIS</strong>
          <span>{j.owner === "online" ? "Linked to your Mac · full access" : "Siddharth's personal AI · runs on your device"}</span>
        </div>
        <motion.span key={j.status} className={`jx-status s-${j.status}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="status">
          {STATUS_TEXT[j.status]}
        </motion.span>
        {variant === "station" ? (
          <button className="jx-icon" onClick={() => j.setOpen(true)} aria-label="Open the full Jarvis console" title="Full console">
            ⤢
          </button>
        ) : (
          <button className="jx-icon" onClick={() => j.setOpen(false)} aria-label="Close Jarvis" title="Close (Esc)">
            ✕
          </button>
        )}
      </header>

      <Pulse />

      <div className="jx-body">
        {variant === "full" && <Rail />}
        <div className="jx-main">
          <div className="jx-log" ref={log} role="log" aria-live="polite">
            {j.messages.map((m) => (
              <Message key={m.id} m={m} />
            ))}
            {j.interim && (
              <div className="jx-msg u interim" aria-hidden>
                {j.interim}…
              </div>
            )}
          </div>

          {j.voice.error && <p className="jx-warn">{j.voice.error}</p>}

          {variant === "station" && (
            <div className="jx-seg" role="tablist" aria-label="Agent">
              {AGENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={j.agent === a.id}
                  onClick={() => (a.id === "digest" ? j.runDigest() : j.setAgent(a.id))}
                  title={a.desc}
                >
                  {j.agent === a.id && <motion.span layoutId="seg-pill" className="seg-pill" />}
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          )}
          <form className="jx-compose" onSubmit={submit}>
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={micLive ? "Listening…" : j.agent === "research" ? "Ask a compound question…" : "Ask about his work, or say “take me to the model”"}
              aria-label="Message Jarvis"
              autoComplete="off"
              maxLength={600}
            />
            <motion.button
              type="button"
              className={`jx-mic${micLive ? " live" : ""}`}
              onClick={() => (micLive ? j.stopListening() : j.pushToTalk())}
              aria-label={micLive ? "Stop listening" : "Talk to Jarvis"}
              aria-pressed={micLive}
              title={j.voice.in ? "Talk" : "Voice input needs Chrome, Edge or Safari"}
              whileTap={{ scale: 0.9 }}
              disabled={!j.voice.in}
            >
              <MicIcon />
            </motion.button>
            <motion.button type="submit" className="jx-send" whileTap={{ scale: 0.94 }} disabled={!text.trim()}>
              Ask
            </motion.button>
          </form>

          <div className="jx-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => j.ask(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="jx-toggles">
            <Toggle on={j.settings.wake} disabled={!j.voice.in} onChange={(v) => j.setSetting("wake", v)} label="“Hey Jarvis”" hint="hands-free" />
            <Toggle on={j.settings.autoSpeak} disabled={!j.voice.out} onChange={(v) => j.setSetting("autoSpeak", v)} label="Speak answers" />
            {j.status === "speaking" && (
              <button className="chip" type="button" onClick={j.stopSpeaking}>
                ■ Stop
              </button>
            )}
            {variant === "station" && (
              <Toggle on={j.settings.neural && j.neural.state === "ready"} onChange={(v) => j.setSetting("neural", v)} label="On-device LLM" hint={j.neural.state === "loading" ? `${Math.round(j.neural.progress * 100)}%` : "opt-in"} />
            )}
          </div>
          {variant === "station" && j.neural.state !== "off" && j.neural.state !== "ready" && <p className="jx-note">{j.neural.text}</p>}
        </div>
      </div>
    </section>
  );
}

function Rail() {
  const j = useJarvis();
  return (
    <aside className="jx-rail">
      <div className="rail-h">Agents</div>
      {AGENTS.map((a) => (
        <button
          key={a.id}
          className="rail-item"
          aria-pressed={j.agent === a.id}
          onClick={() => (a.id === "digest" ? j.runDigest() : j.setAgent(a.id))}
        >
          <b>{a.name}</b>
          <span>{a.desc}</span>
        </button>
      ))}

      <div className="rail-h">Engine</div>
      <div className="rail-card">
        <div className="rail-row">
          <span className="led on" /> Instant engine <em>retrieval over his brief</em>
        </div>
        <div className="rail-row">
          <span className={`led ${j.neural.state === "ready" && j.settings.neural ? "on" : j.neural.state === "loading" ? "warn" : ""}`} />
          {MODEL_LABEL_STATIC}
          <em>
            {j.neural.state === "off"
              ? "on-device, opt-in (~0.9 GB, cached)"
              : j.neural.state === "loading"
                ? `${Math.round(j.neural.progress * 100)}% · ${j.neural.text.slice(0, 60)}`
                : j.neural.text}
          </em>
        </div>
        {j.neural.state === "loading" && (
          <div className="dl-bar">
            <motion.i animate={{ scaleX: j.neural.progress }} style={{ originX: 0 }} />
          </div>
        )}
        <Toggle
          on={j.settings.neural && j.neural.state === "ready"}
          onChange={(v) => j.setSetting("neural", v)}
          label="Use on-device LLM"
          disabled={j.neural.state === "unsupported" || j.neural.state === "loading" || j.neural.state === "probing"}
        />
      </div>

      <div className="rail-h">Skills</div>
      <ul className="rail-skills">
        {SKILLS.map(([n, d]) => (
          <li key={n}>
            <code>{n}</code> {d}
          </li>
        ))}
      </ul>

      <div className="rail-h">Memory</div>
      <div className="rail-card">
        <div className="rail-row">{j.visitor ? `Visitor: ${j.visitor.name}${j.visitor.org ? ` · ${j.visitor.org}` : ""}` : "Say “I'm Alex from Evercore” and I'll remember."}</div>
        <button className="chip" onClick={j.clear}>
          Clear memory
        </button>
      </div>
    </aside>
  );
}

function Pulse() {
  const j = useJarvis();
  const p = j.pulse;
  const engine = j.settings.neural && j.neural.state === "ready" ? "ON-DEVICE LLM" : "INSTANT";
  const cells: [string, string][] = [
    ["ENGINE", engine],
    ["LATENCY", p.lastMs === null ? "—" : p.lastMs < 1 ? `${(p.lastMs * 1000).toFixed(0)} µs` : `${p.lastMs.toFixed(p.lastMs < 10 ? 1 : 0)} ms`],
    ["TOK/S", p.tokPerSec === null ? "—" : p.tokPerSec.toFixed(1)],
    ["CLOUD CALLS", "0"],
    ["COST", "$0.00"],
    ["VOICE", `${j.voice.in ? "IN" : "—"}/${j.voice.out ? "OUT" : "—"}`],
    ["ANSWERED", String(p.answered)],
  ];
  return (
    <div className="jx-pulse" aria-label="System pulse">
      {cells.map(([k, v]) => (
        <span key={k}>
          <i>{k}</i>
          <motion.b key={v} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }}>
            {v}
          </motion.b>
        </span>
      ))}
    </div>
  );
}

function Typewriter({ text, live }: { text: string; live: boolean }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(live && !reduce ? 0 : text.length);
  useEffect(() => {
    if (!live || reduce) {
      setN(text.length);
      return;
    }
    let raf = 0;
    const tick = () => {
      setN((k) => {
        const next = Math.min(text.length, k + Math.max(3, Math.ceil(text.length / 36)));
        if (next < text.length) raf = requestAnimationFrame(tick);
        return next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, live, reduce]);
  return <>{text.slice(0, n)}</>;
}

function Message({ m }: { m: Msg }) {
  const j = useJarvis();
  const [showTrace, setShowTrace] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const speakingIdx = j.speakingSection?.msg === m.id ? j.speakingSection.index : -1;

  return (
    <motion.div
      className={`jx-msg ${m.role === "user" ? "u" : "a"}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      {m.digest ? (
        <div className="digest">
          <div className="digest-h">
            <span>RECRUITER BRIEF · 60 SEC</span>
            {j.voice.out && (
              <button type="button" className="chip" onClick={() => (speakingIdx >= 0 ? j.stopSpeaking() : j.playDigest(m.id, m.digest!))}>
                {speakingIdx >= 0 ? "■ Stop" : "▶ Play"}
              </button>
            )}
          </div>
          {m.digest.map((s, i) => (
            <motion.p key={s.title} className={i === speakingIdx ? "now" : ""} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
              <b>{s.title}.</b> {s.text}
            </motion.p>
          ))}
        </div>
      ) : (
        <div className="jx-text">{m.role === "assistant" ? <Typewriter text={m.text} live={!!m.fresh && m.engine !== "neural"} /> : m.text}</div>
      )}

      {!!m.skills?.length && (
        <div className="jx-skills">
          {m.skills.map((s, i) => (
            <SkillButton key={i} s={s} />
          ))}
        </div>
      )}

      {m.role === "assistant" && (m.citations?.length || m.trace?.length) ? (
        <div className="jx-meta">
          {m.engine && <span className={`tag e-${m.engine}`}>{m.engine === "guard-fallback" ? "guarded" : m.engine}</span>}
          {m.ms !== undefined && <span>{m.ms < 1 ? "<1" : m.ms.toFixed(0)} ms</span>}
          {!!m.citations?.length && (
            <button type="button" onClick={() => setShowSrc((v) => !v)} aria-expanded={showSrc}>
              sources ({m.citations.length})
            </button>
          )}
          {!!m.trace?.length && (
            <button type="button" onClick={() => setShowTrace((v) => !v)} aria-expanded={showTrace}>
              trace
            </button>
          )}
          {j.voice.out && !m.digest && (
            <button type="button" onClick={() => j.speak(m.text)} aria-label="Read aloud">
              🔊
            </button>
          )}
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {showSrc && m.citations && (
          <motion.ol className="jx-src" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {m.citations.map((c, i) => (
              <li key={i}>
                <b>{c.section}</b> — {c.text}
              </li>
            ))}
          </motion.ol>
        )}
        {showTrace && m.trace && (
          <motion.ol className="jx-trace" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {m.trace.map((t, i) => (
              <li key={i} className={`k-${t.kind}`}>
                <code>{t.label}</code>
                {t.detail && <span> {t.detail}</span>}
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


function SkillButton({ s }: { s: Skill }) {
  const j = useJarvis();
  switch (s.name) {
    case "open_exhibit": {
      const e = exhibit(s.id);
      return (
        <a className="skill" href={e.url} target="_blank" rel="noopener noreferrer">
          {e.title} ↗
        </a>
      );
    }
    case "draft_email":
      return (
        <button className="skill" type="button" onClick={() => bus.emit({ type: "open_connect" })}>
          ✉ Write to him
        </button>
      );
    case "call":
      return (
        <a className="skill" href={CONTACT.phoneHref}>
          ☎ {CONTACT.phone}
        </a>
      );
    case "open_linkedin":
      return (
        <a className="skill" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn ↗
        </a>
      );
    case "open_lab":
      return (
        <a className="skill" href={`${import.meta.env.BASE_URL}lab/`}>
          Open the Strategy Lab →
        </a>
      );
    case "open_research":
      return (
        <a className="skill" href={`${import.meta.env.BASE_URL}research/`}>
          Open Research HQ →
        </a>
      );
    case "run_digest":
      return (
        <button className="skill" type="button" onClick={j.runDigest}>
          ▶ 60-second brief
        </button>
      );
    case "navigate":
      return (
        <button className="skill" type="button" onClick={() => bus.emit({ type: "navigate", station: s.station })}>
          Go to {STATIONS.find((x) => x.id === s.station)?.label} →
        </button>
      );
    default:
      return null;
  }
}

function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange(v: boolean): void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="toggle" onClick={() => onChange(!on)} disabled={disabled}>
      <span className="track">
        <motion.span className="knob" layout transition={{ type: "spring", stiffness: 600, damping: 32 }} style={{ marginLeft: on ? 14 : 0 }} />
      </span>
      {label}
      {hint && <em>{hint}</em>}
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}
