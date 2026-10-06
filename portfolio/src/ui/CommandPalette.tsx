import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { bus } from "../jarvis/bus.ts";
import { useJarvis } from "../jarvis/JarvisProvider.tsx";
import { CONTACT, EXHIBITS, STATIONS } from "../data/site.ts";

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run(): void;
}

/** ⌘K / Ctrl+K. Every action on the site, plus "ask Jarvis" for anything typed. */
export function CommandPalette() {
  const j = useJarvis();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const close = (f: () => void) => () => {
      setOpen(false);
      f();
    };
    return [
      { id: "jarvis", group: "Jarvis", label: "Open Jarvis", hint: "J", run: close(() => j.setOpen(true)) },
      { id: "digest", group: "Jarvis", label: "Brief me — 60-second spoken brief", run: close(() => { j.setOpen(true); j.runDigest(); }) },
      { id: "voice", group: "Jarvis", label: "Talk to Jarvis (push to talk)", run: close(() => { j.setOpen(true); j.pushToTalk(); }) },
      { id: "wake", group: "Jarvis", label: `${j.settings.wake ? "Turn off" : "Turn on"} “Hey Jarvis”`, run: close(() => j.setSetting("wake", !j.settings.wake)) },
      { id: "speak", group: "Jarvis", label: `${j.settings.autoSpeak ? "Mute" : "Unmute"} spoken answers`, run: close(() => j.setSetting("autoSpeak", !j.settings.autoSpeak)) },
      { id: "llm", group: "Jarvis", label: "Load the on-device LLM (WebGPU)", run: close(() => { j.setOpen(true); void j.enableNeural(); }) },
      ...STATIONS.map((s, i) => ({ id: `go-${s.id}`, group: "Go to", label: s.label, hint: String(i + 1), run: close(() => bus.emit({ type: "navigate", station: s.id })) })),
      ...EXHIBITS.map((e) => ({ id: `ex-${e.id}`, group: "Exhibits", label: e.title, hint: e.kind, run: close(() => window.open(e.url, "_blank", "noopener")) })),
      { id: "email", group: "Contact", label: `Email ${CONTACT.email}`, run: close(() => (location.href = `mailto:${CONTACT.email}`)) },
      { id: "li", group: "Contact", label: "LinkedIn", run: close(() => window.open(CONTACT.linkedin, "_blank", "noopener")) },
    ];
  }, [j]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? cmds.filter((c) => `${c.group} ${c.label}`.toLowerCase().includes(t)) : cmds;
    if (t) {
      list.push({ id: "ask", group: "Ask", label: `Ask Jarvis: “${q.trim()}”`, run: () => { setOpen(false); j.setOpen(true); j.ask(q.trim()); } });
    }
    return list;
  }, [q, cmds, j]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(filtered.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[sel]?.run();
    }
  };

  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="pal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <motion.div
            className="pal"
            role="dialog"
            aria-label="Command palette"
            initial={{ y: -16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a command, or ask Jarvis anything…"
              aria-label="Command"
            />
            <ul role="listbox">
              {filtered.map((c, i) => {
                const head = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                return (
                  <li key={c.id}>
                    {head && <div className="pal-g">{head}</div>}
                    <button role="option" aria-selected={i === sel} className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)} onClick={c.run}>
                      <span>{c.label}</span>
                      {c.hint && <kbd>{c.hint}</kbd>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="pal-f">
              <span>↑↓ navigate</span>
              <span>↵ run</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
