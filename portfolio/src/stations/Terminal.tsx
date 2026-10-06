import { motion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { exhibit } from "../data/site.ts";
import { useJarvis } from "../jarvis/JarvisProvider.tsx";
import { bus } from "../jarvis/bus.ts";

type Line = { k: "sys" | "hd" | "ok" | "txt" | "kv" | "a" | "jv"; a?: string; b?: string; href?: string };

const L = (k: Line["k"], a = "", b?: string): Line => ({ k, a, b });
const A = (label: string, href: string): Line => ({ k: "a", a: label, href });

const SCREENS: Record<string, Line[]> = {
  DES: [
    L("hd", "SIDDHARTH BAGGA — DESCRIPTION"),
    L("kv", "SECTOR", "Valuation · Commercial due diligence"),
    L("kv", "BASE", "Cincinnati OH · relocating, NYC preferred"),
    L("kv", "EDUCATION", "M.S. Financial Mathematics, Univ. of Cincinnati"),
    L("kv", "STACK", "Excel/VBA · Bloomberg · Capital IQ · Python · SQL"),
    L("txt"),
    L("txt", "Built an operating company's finance function from raw bank statements."),
    L("txt", "Promoted to lead it in five months."),
  ],
  EXP: [
    L("hd", "TRACK RECORD"),
    L("kv", "JAN26-JUN26", "Strategic Finance Lead — Turnkey Services Pro"),
    L("txt", "  $6M+ pipeline underwritten. Normalized EBITDA, IRR/MOIC, sensitivity."),
    L("ok", "  Opex down 6%."),
    L("kv", "AUG25-JAN26", "Financial Associate — Turnkey Services Pro"),
    L("txt", "  No finance function existed. Built DCF, FCF, AR/AP, job costing."),
    L("ok", "  Decisions +75% in month one."),
    L("kv", "JAN25-MAR25", "Wealth Management Intern — Cerity Partners"),
    L("ok", "  Reporting turnaround −30%."),
  ],
  VAL: [
    L("hd", "VALUATION WORK"),
    L("txt", "S&P GLOBAL — multi-scenario DCF, M.S. capstone"),
    L("txt", "  Benchmarked vs MCO and MSCI. WACC sensitivity, terminal value."),
    L("ok", "  Within 10% of analyst consensus."),
    A("  OPEN REPORT", exhibit("spgi").url),
    A("  OPEN DECK", exhibit("deck").url),
    L("txt"),
    L("txt", "RISK TOLERANCE ANALYSIS — investor profiling, scoring model"),
    A("  OPEN REPORT", exhibit("risk").url),
    L("txt"),
    L("txt", "TURNKEY PIPELINE — buy-side, property services, multi-state"),
    L("txt", "  Equity range $3.5M base to $21M upside."),
  ],
  CERT: [
    L("hd", "CREDENTIALS"),
    A("BLOOMBERG MARKET CONCEPTS", exhibit("bmc").url),
    L("txt", "  Fixed Income · Capital Market Analysis · Interest Rate Risk"),
    A("GRAD CERT, QUANTITATIVE FINANCE", exhibit("gc").url),
    A("M.S. FINANCIAL MATHEMATICS", exhibit("msfin").url),
    L("txt", "CFA LEVEL I — merit exam-fee scholarship, 2025; exam not yet attempted"),
    L("txt", "SCHOLAR, STRATEGIC MANAGEMENT — IISc Bangalore"),
  ],
  HELP: [
    L("hd", "COMMANDS"),
    L("kv", "DES", "Description"),
    L("kv", "EXP", "Track record"),
    L("kv", "VAL", "Valuation work"),
    L("kv", "CERT", "Credentials"),
    L("kv", "DCF <w> <g>", "Drive the model, e.g. DCF 9.5 2.5"),
    L("kv", "JARVIS", "Open the full Jarvis console"),
    L("kv", "CLR", "Clear"),
    L("kv", "anything else", "Answered by Jarvis, instantly, on your device"),
  ],
};

const FKEYS = ["DES", "EXP", "VAL", "CERT", "HELP", "CLR"];

export function Terminal() {
  const j = useJarvis();
  const [lines, setLines] = useState<Line[]>([L("sys", "SB TERMINAL v5.0 · AUTH OK · FIGURES CANDIDATE-SUPPLIED"), L("sys", "TYPE HELP <GO> FOR COMMANDS, OR JUST ASK A QUESTION"), L("txt")]);
  const queue = useRef<Line[]>([]);
  const pumping = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const [cmd, setCmd] = useState("");

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines]);

  const push = (rows: Line[]) => {
    queue.current.push(...rows);
    if (pumping.current) return;
    pumping.current = true;
    const next = () => {
      const row = queue.current.shift();
      if (!row) {
        pumping.current = false;
        return;
      }
      setLines((ls) => [...ls, row]);
      setTimeout(next, 22);
    };
    next();
  };

  const run = (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    const up = c.toUpperCase();
    setLines((ls) => [...ls, L("sys", `> ${up} <GO>`)]);
    if (up === "CLR") return setLines([]);
    if (up === "JARVIS") return bus.emit({ type: "open_jarvis" });
    const dcf = up.match(/^DCF\s+(\d+(?:\.\d+)?)\s*(\d+(?:\.\d+)?)?$/);
    if (dcf) {
      bus.emit({ type: "set_dcf", wacc: parseFloat(dcf[1]!), g: dcf[2] ? parseFloat(dcf[2]) : undefined });
      push([L("ok", `MODEL UPDATED · WACC ${dcf[1]}%${dcf[2] ? ` · g ${dcf[2]}%` : ""}`), L("sys", "See station 02.")]);
      return;
    }
    const screen = SCREENS[up];
    if (screen) return push(screen);
    const ans = j.engine.answer(c);
    push([{ k: "jv", a: "JARVIS ▸ ", b: ans.text }]);
    for (const s of ans.skills) {
      if (s.name === "navigate") bus.emit({ type: "navigate", station: s.station });
      if (s.name === "set_dcf") bus.emit({ type: "set_dcf", wacc: s.wacc, g: s.g });
      if (s.name === "open_exhibit") push([A(`  OPEN ${exhibit(s.id).title.toUpperCase()}`, exhibit(s.id).url)]);
      if (s.name === "run_digest") bus.emit({ type: "open_jarvis", agent: "digest" });
    }
  };

  useEffect(() => {
    const id = setTimeout(() => run("DES"), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(cmd);
    setCmd("");
  };

  return (
    <Panel id="terminal" label="Terminal">
      <Kicker>Station 01 · the terminal</Kicker>
      <motion.h2 className="sec" variants={rise}>
        Ask it anything
      </motion.h2>
      <motion.div className="term" variants={rise}>
        <div className="th">
          <span>SB TERMINAL · CONSOLE</span>
          <span>COMMAND OR QUESTION, PRESS &lt;GO&gt;</span>
        </div>
        <div className="tb" ref={log} data-testid="term-log">
          {lines.map((l, i) => (
            <TermLine key={i} l={l} />
          ))}
        </div>
        <form className="cl" onSubmit={submit}>
          <span>&gt;</span>
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              // Bloomberg-style function keys, only while the terminal has focus (F5 still reloads elsewhere)
              const f = /^F([1-6])$/.exec(e.key);
              if (f) {
                e.preventDefault();
                run(FKEYS[+f[1]! - 1]!);
              }
            }}
            autoComplete="off"
            spellCheck={false}
            aria-label="Terminal command (F1–F6 run the shortcuts)"
            placeholder="DES, or a question · F1–F6"
          />
          <button type="submit">&lt;GO&gt;</button>
        </form>
      </motion.div>
      <motion.div className="fkrow" variants={rise}>
        {FKEYS.map((c, i) => (
          <motion.button key={c} className="fk" whileTap={{ scale: 0.92, backgroundColor: "#ffb020", color: "#000" }} onClick={() => run(c)}>
            F{i + 1} {c}
          </motion.button>
        ))}
      </motion.div>
    </Panel>
  );
}

function TermLine({ l }: { l: Line }) {
  if (l.k === "kv")
    return (
      <div className="ln kv">
        <b>{l.a}</b>
        <span>{l.b}</span>
      </div>
    );
  if (l.k === "a")
    return (
      <div className="ln">
        <a href={l.href} target="_blank" rel="noopener noreferrer">
          ▸ {l.a?.trim()}
        </a>
      </div>
    );
  if (l.k === "jv")
    return (
      <div className="ln ok">
        {l.a}
        <span className="jvt">{l.b}</span>
      </div>
    );
  return <div className={`ln ${l.k}`}>{l.a || " "}</div>;
}
