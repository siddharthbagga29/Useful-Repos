import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CONTACT, composeLinks, type Draft } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";
import { useJarvis } from "../jarvis/JarvisProvider.tsx";

/**
 * The reach-out flow. A visitor picks why they're writing, types their name and email, and sends.
 * The message is pre-written from their answers; they can edit it or just press Send.
 *
 * Delivery: a keyless form relay emails Siddharth directly. If that fails (offline, blocked),
 * the same pre-written message opens in Gmail, Outlook or the default mail app, or copies.
 */

export type Intent = "hiring" | "network" | "deal" | "other";

const INTENTS: { id: Intent; label: string; hint: string }[] = [
  { id: "hiring", label: "I'm hiring", hint: "A role or interview" },
  { id: "network", label: "Let's connect", hint: "Coffee chat or networking" },
  { id: "deal", label: "Deal or project", hint: "Diligence, valuation, modelling" },
  { id: "other", label: "Something else", hint: "Anything at all" },
];

interface Fields {
  intent: Intent;
  name: string;
  email: string;
  company: string;
  role: string;
  note: string;
}

export function draftFor(f: Fields): Draft {
  const who = f.name.trim() || "[your name]";
  const at = f.company.trim() ? ` at ${f.company.trim()}` : "";
  const role = f.role.trim();
  const lines: Record<Intent, { subject: string; ask: string }> = {
    hiring: {
      subject: `Interview: ${role || "analyst role"}${at}`,
      ask: `I'm ${who}${at}. I came across your portfolio and would like to talk to you about ${role ? `our ${role} opening` : "an opening on our team"}. Are you free for a 20-minute call this week?`,
    },
    network: {
      subject: `Connecting${at ? ` — ${who}${at}` : ""}`,
      ask: `I'm ${who}${at}. I enjoyed your portfolio and Jarvis, and I'd be glad to connect and trade notes on finance and diligence work. Would a short coffee chat or call suit you?`,
    },
    deal: {
      subject: `Project inquiry${at}`,
      ask: `I'm ${who}${at}. We're working on ${role || "a diligence / valuation project"} and your background looks relevant. Could we set up a quick call to discuss scope?`,
    },
    other: {
      subject: `Hello from ${who}${at}`,
      ask: `I'm ${who}${at}. I came across your portfolio and wanted to reach out.`,
    },
  };
  const l = lines[f.intent];
  const extra = f.note.trim() ? `\n\n${f.note.trim()}` : "";
  const sign = `\n\nBest,\n${who}${f.company.trim() ? `\n${f.company.trim()}` : ""}${f.email.trim() ? `\n${f.email.trim()}` : ""}`;
  return { subject: l.subject, body: `Hi Siddharth,\n\n${l.ask}${extra}${sign}` };
}

const KEY = "connect.draft.v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Phase = "edit" | "sending" | "sent" | "fallback";

export function Connect() {
  const j = useJarvis();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("edit");
  const [copied, setCopied] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Fields>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Fields> | null;
      if (saved) return { intent: "hiring", name: "", email: "", company: "", role: "", note: "", ...saved };
    } catch {
      /* storage unavailable */
    }
    return { intent: "hiring", name: "", email: "", company: "", role: "", note: "" };
  });

  // Prefill from Jarvis memory ("I'm Priya from Evercore").
  useEffect(() => {
    if (j.visitor && !f.name) setF((x) => ({ ...x, name: j.visitor!.name, company: x.company || j.visitor!.org || "" }));
  }, [j.visitor, f.name]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...f }));
    } catch {
      /* noop */
    }
  }, [f]);

  useEffect(() => {
    const openIt = (intent?: Intent) => {
      if (intent) setF((x) => ({ ...x, intent }));
      setPhase("edit");
      setOpen(true);
      if (location.hash !== "#connect") history.replaceState(null, "", "#connect");
    };
    if (location.hash === "#connect") openIt();
    const onHash = () => location.hash === "#connect" && openIt();
    addEventListener("hashchange", onHash);
    const off = bus.on((e) => e.type === "open_connect" && openIt(e.intent));
    return () => {
      removeEventListener("hashchange", onHash);
      off();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", onKey);
    requestAnimationFrame(() => first.current?.focus({ preventScroll: true }));
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    if (location.hash === "#connect") history.replaceState(null, "", location.pathname + location.search);
  };

  const draft = useMemo(() => draftFor(f), [f]);
  const links = composeLinks(draft);
  const valid = f.name.trim().length > 1 && EMAIL_RE.test(f.email.trim());
  const set = <K extends keyof Fields>(k: K) => (v: Fields[K]) => setF((x) => ({ ...x, [k]: v }));

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(`select-${what}`);
    }
    setTimeout(() => setCopied(null), 2200);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setPhase("sending");
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(CONTACT.relay, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          _subject: `[Portfolio] ${draft.subject}`,
          _replyto: f.email.trim(),
          _template: "table",
          _captcha: "false",
          _honey: "",
          name: f.name.trim(),
          email: f.email.trim(),
          company: f.company.trim() || "—",
          role_or_project: f.role.trim() || "—",
          reason: INTENTS.find((i) => i.id === f.intent)?.label,
          message: draft.body,
          source: location.href,
        }),
      });
      clearTimeout(timer);
      const data = (await res.json().catch(() => ({}))) as { success?: string | boolean };
      if (!res.ok || String(data.success) === "false") throw new Error(`relay ${res.status}`);
      setPhase("sent");
    } catch {
      setPhase("fallback");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="cx-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && close()}>
          <motion.div
            className="cx"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cx-title"
            initial={{ y: 30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <header className="cx-head">
              <div>
                <div className="kicker">Reach out</div>
                <h2 id="cx-title">Write to Siddharth</h2>
                <p>Pick a reason and add your name. The message is written for you — edit it or just send.</p>
              </div>
              <button className="jx-icon" onClick={close} aria-label="Close">
                ✕
              </button>
            </header>

            {phase === "sent" ? (
              <motion.div className="cx-done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="cx-sent">
                <div className="cx-check">✓</div>
                <h3>Sent to Siddharth's inbox</h3>
                <p>
                  He'll reply to <b>{f.email.trim()}</b>. Want to stay in touch in the meantime?
                </p>
                <div className="row">
                  <a className="cta hot" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">
                    Connect on LinkedIn ↗
                  </a>
                  <a className="cta" href={CONTACT.vcard} download="Siddharth-Bagga.vcf">
                    Save contact
                  </a>
                  <button className="cta" onClick={close}>
                    Back to the site
                  </button>
                </div>
              </motion.div>
            ) : (
              <form className="cx-form" onSubmit={send} noValidate>
                <fieldset className="cx-intents">
                  <legend>Why are you writing?</legend>
                  {INTENTS.map((i) => (
                    <label key={i.id} className={f.intent === i.id ? "on" : ""}>
                      <input type="radio" name="intent" value={i.id} checked={f.intent === i.id} onChange={() => set("intent")(i.id)} />
                      <b>{i.label}</b>
                      <span>{i.hint}</span>
                    </label>
                  ))}
                </fieldset>

                <div className="cx-grid">
                  <Field id="cx-name" label="Your name" required value={f.name} onChange={set("name")} inputRef={first} autoComplete="name" error={touched && f.name.trim().length < 2 ? "Add your name" : undefined} />
                  <Field id="cx-email" label="Your email" type="email" required value={f.email} onChange={set("email")} autoComplete="email" error={touched && !EMAIL_RE.test(f.email.trim()) ? "Add an email he can reply to" : undefined} />
                  <Field id="cx-company" label="Company" value={f.company} onChange={set("company")} autoComplete="organization" />
                  <Field id="cx-role" label={f.intent === "deal" ? "Project" : "Role"} value={f.role} onChange={set("role")} placeholder={f.intent === "deal" ? "e.g. buy-side diligence" : "e.g. CDD Associate"} />
                </div>

                <div className="cx-preview" aria-live="polite">
                  <div className="cx-preview-h">
                    <span>Preview · to {CONTACT.email}</span>
                    <button type="button" className="chip" onClick={() => copy(`${draft.subject}\n\n${draft.body}`, "message")}>
                      {copied === "message" ? "Copied ✓" : "Copy message"}
                    </button>
                  </div>
                  <div className="cx-subj">
                    <b>Subject:</b> {draft.subject}
                  </div>
                  <pre className={copied === "select-message" ? "sel" : ""}>{draft.body}</pre>
                  <label className="cx-note" htmlFor="cx-note">
                    Add a line (optional)
                  </label>
                  <textarea id="cx-note" rows={2} maxLength={1200} value={f.note} onChange={(e) => set("note")(e.target.value)} placeholder="Anything specific — timing, the role link, a question…" />
                </div>

                <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="hp" aria-hidden />

                <AnimatePresence>
                  {phase === "fallback" && (
                    <motion.p className="cx-warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} role="alert">
                      Couldn't deliver it directly from this page. Your message is ready below — open it in your email and press send.
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="cx-actions">
                  <motion.button type="submit" className="cta hot" whileTap={{ scale: 0.96 }} disabled={phase === "sending"} data-testid="cx-send">
                    {phase === "sending" ? "Sending…" : "Send to Siddharth"}
                  </motion.button>
                  <span className="cx-or">or open it in</span>
                  <a className="cta" href={links.gmail} target="_blank" rel="noopener noreferrer" data-testid="cx-gmail">
                    Gmail ↗
                  </a>
                  <a className="cta" href={links.outlook} target="_blank" rel="noopener noreferrer" data-testid="cx-outlook">
                    Outlook ↗
                  </a>
                  <a className="cta" href={links.mailto} data-testid="cx-mailto">
                    Mail app
                  </a>
                </div>
                <p className="cx-fine">
                  Sending shares only what you typed above with Siddharth, by email. Prefer to write yourself?{" "}
                  <button type="button" className="linkish" onClick={() => copy(CONTACT.email, "email")}>
                    {copied === "email" ? "Copied ✓" : CONTACT.email}
                  </button>{" "}
                  · {CONTACT.phone}
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field(p: {
  id: string;
  label: string;
  value: string;
  onChange(v: string): void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className={`cx-field${p.error ? " bad" : ""}`}>
      <label htmlFor={p.id}>
        {p.label}
        {p.required && <i aria-hidden> *</i>}
      </label>
      <input
        id={p.id}
        ref={p.inputRef}
        type={p.type ?? "text"}
        value={p.value}
        required={p.required}
        placeholder={p.placeholder}
        autoComplete={p.autoComplete}
        maxLength={160}
        aria-invalid={!!p.error}
        aria-describedby={p.error ? `${p.id}-err` : undefined}
        onChange={(e) => p.onChange(e.target.value)}
      />
      {p.error && (
        <span id={`${p.id}-err`} className="cx-err">
          {p.error}
        </span>
      )}
    </div>
  );
}

/** Shared "copy email" button with inline confirmation. */
export function CopyEmail({ className = "cta" }: { className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(CONTACT.email);
        } catch {
          /* the address is shown as text next to it */
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied ✓" : "Copy email"}
    </button>
  );
}
