import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel, Kicker, rise } from "../ui/Panel.tsx";
import { DCF, valueDcf } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";

const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const pc = (v: number, d = 1) => `${v.toFixed(d)}%`;
const PROJ = ["2026E", "2027E", "2028E", "2029E", "2030E"];
const HIST = ["2023A", "2024A", "2025A"];
const MARGIN = [21.0, 27.1, 29.2];

type Cell = { v: string; cls?: string; f?: string };

export function Model() {
  const [wacc, setWacc] = useState(DCF.defaultWacc);
  const [g, setG] = useState(DCF.defaultG);
  const [sel, setSel] = useState<{ ref: string; f: string }>({ ref: "B17", f: "=B12-B16" });
  const [flash, setFlash] = useState(0);

  useEffect(
    () =>
      bus.on((e) => {
        if (e.type !== "set_dcf") return;
        if (e.wacc !== undefined) setWacc(Math.min(14, Math.max(6, e.wacc)));
        if (e.g !== undefined) setG(Math.min(5, Math.max(0, e.g)));
        setFlash((f) => f + 1);
      }),
    [],
  );

  const v = valueDcf(wacc, g);
  const w = wacc / 100;

  const rows: { label: string; cls?: string; cells: Cell[] }[] = useMemo(() => {
    const disc = DCF.fcf.map((_, i) => 1 / (1 + w) ** (i + 1));
    const out: { label: string; cls?: string; cells: Cell[] }[] = [
      { label: "S&P GLOBAL — DCF (ILLUSTRATIVE, $M)", cls: "hd", cells: [] },
      { label: "", cls: "yr", cells: HIST.map((y) => ({ v: y })) },
      { label: "Revenue (reported)", cells: DCF.revenue.slice(0, 3).map((r) => ({ v: n0(r), f: "10-K" })) },
      { label: "  growth %", cells: [{ v: "" }, ...[1, 2].map((i) => ({ v: pc((DCF.revenue[i]! / DCF.revenue[i - 1]! - 1) * 100), f: `=${"BCD"[i]}3/${"BCD"[i - 1]}3-1` }))] },
      { label: "Net margin (reported)", cells: MARGIN.map((m) => ({ v: pc(m), f: "=NI/Revenue" })) },
      { label: "", cls: "yr", cells: PROJ.map((y) => ({ v: y })) },
      { label: "Free cash flow (est.)", cells: DCF.fcf.map((f) => ({ v: n0(f), cls: "est", f: "estimate" })) },
      { label: "  discount factor", cells: disc.map((d, i) => ({ v: d.toFixed(3), f: `=1/(1+$B$13)^${i + 1}` })) },
      { label: "Discounted FCF", cells: DCF.fcf.map((f, i) => ({ v: n0(f * disc[i]!), f: `=${"BCDEF"[i]}7*${"BCDEF"[i]}8` })) },
    ];
    if (v) {
      out.push(
        { label: "Terminal value", cells: [{ v: n0(v.tv), cls: "out", f: "=F7*(1+$B$14)/($B$13-$B$14)" }] },
        { label: "PV of terminal value", cells: [{ v: n0(v.pvtv), cls: "out", f: "=B10/(1+$B$13)^5" }] },
        { label: "Enterprise value", cells: [{ v: n0(v.ev), cls: "out", f: "=SUM(B9:F9)+B11" }] },
        { label: "WACC", cells: [{ v: pc(wacc, 2), cls: "inp", f: "input — drag B13" }] },
        { label: "Terminal growth", cells: [{ v: pc(g, 2), cls: "inp", f: "input — drag B14" }] },
        { label: "  TV as % of EV", cells: [{ v: pc((v.pvtv / v.ev) * 100), f: "=B11/B12" }] },
        { label: "  less: net debt", cells: [{ v: n0(DCF.netDebt), f: "estimate" }] },
        { label: "Implied equity value", cells: [{ v: n0(v.equity), cls: "out", f: "=B12-B16" }] },
        { label: "Check: within 10% of mkt cap", cells: [{ v: v.offPct < 10 ? "TRUE" : "FALSE", cls: v.offPct < 10 ? "out" : "bad", f: "=ABS(B17/113640-1)<0.1" }] },
      );
    }
    return out;
  }, [w, wacc, g, v]);

  return (
    <Panel id="model" label="The model">
      <Kicker>Station 02 · the model</Kicker>
      <motion.h2 className="sec" variants={rise}>
        S&amp;P Global, live
      </motion.h2>
      <motion.p className="sub" variants={rise}>
        Illustrative model on SPGI's <b>reported</b> revenue. Forecast cash flows and net debt are estimates for this demo, not
        the capstone's figures — the capstone report is under Exhibits. Or tell Jarvis: <b>“set WACC to 10%”</b>.
      </motion.p>
      <motion.div className="model-grid" variants={rise}>
        <div className="xl">
          <div className="bar">
            <span>SBagga_Valuation_Master_v7_FINAL_v2.xlsx</span>
            <span className="f">Calculation: Automatic · iterative 100 / 0.001</span>
          </div>
          <div className="fb">
            <div className="nb">{sel.ref}</div>
            <div className="fx">fx</div>
            <div className="fc">{sel.f}</div>
          </div>
          <div className="gw">
            <table>
              <thead>
                <tr>
                  <th />
                  {"ABCDEF".split("").map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri}>
                    <td className="rn">{ri + 1}</td>
                    <td className={`lb ${r.cls ?? ""}`} colSpan={r.cls === "hd" ? 6 : 1}>
                      {r.label}
                    </td>
                    {r.cls !== "hd" &&
                      Array.from({ length: 5 }, (_, ci) => {
                        const c = r.cells[ci];
                        const ref = `${"BCDEF"[ci]}${ri + 1}`;
                        return (
                          <motion.td
                            key={`${ci}-${c?.cls === "inp" ? flash : 0}`}
                            className={`n ${c?.cls ?? ""} ${r.cls ?? ""} ${sel.ref === ref ? "sel" : ""}`}
                            onClick={() => c?.v && setSel({ ref, f: c.f ?? c.v })}
                            initial={c?.cls === "inp" && flash ? { backgroundColor: "#ffd166" } : false}
                            animate={c?.cls === "inp" && flash ? { backgroundColor: "#eaf1fd" } : undefined}
                            transition={{ duration: 1.2 }}
                          >
                            {c?.v ?? ""}
                          </motion.td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sb">
            <span>Ready</span>
            <span>
              <b>F2</b> edit
            </span>
            <span>
              <b>Alt E S V</b> paste values
            </span>
            <span>
              <b>Ctrl [</b> precedents
            </span>
          </div>
        </div>

        <div className="model-side">
          <div className="sliders">
            <Slider id="wacc" label="B13 · WACC" value={wacc} min={6} max={14} step={0.25} onChange={setWacc} />
            <Slider id="g" label="B14 · Terminal g" value={g} min={0} max={5} step={0.25} onChange={setG} />
          </div>
          <div className="eqbox">
            <div className="k">B17 · Implied equity</div>
            {v ? (
              <>
                <div className="v">
                  <Animated value={v.equity / 1000} />
                </div>
                <div className={`s ${v.offPct < 10 ? "pass" : "fail"}`}>
                  {v.offPct < 10 ? `within ${v.offPct.toFixed(1)}% of SPGI market cap — check passes` : `${v.offPct.toFixed(1)}% from SPGI market cap — check fails`}
                </div>
              </>
            ) : (
              <>
                <div className="v err">#DIV/0!</div>
                <div className="s fail">g must stay below WACC</div>
              </>
            )}
          </div>
          <Sensitivity wacc={wacc} g={g} onPick={(a, b) => (setWacc(a), setG(b))} />
        </div>
      </motion.div>
    </Panel>
  );
}

function Slider({ id, label, value, min, max, step, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <div className="sl">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{value.toFixed(2).replace(/0$/, "")}%</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Animated({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = `$${value.toFixed(1)}B`;
      return;
    }
    const c = animate(prev.current, value, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (x) => (el.textContent = `$${x.toFixed(1)}B`),
    });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]);
  return <span ref={ref}>${value.toFixed(1)}B</span>;
}

const WS = [7.5, 8.0, 8.5, 9.0, 9.5];
const GS = [2.0, 2.5, 3.0, 3.5, 4.0];

function Sensitivity({ wacc, g, onPick }: { wacc: number; g: number; onPick(w: number, g: number): void }) {
  return (
    <div className="sens" role="group" aria-label="Implied equity sensitivity, WACC by terminal growth, $B">
      <div className="sens-h">Sensitivity · implied equity $B · rows WACC, cols g</div>
      <div className="sens-grid">
        <span />
        {GS.map((x) => (
          <span key={x} className="ax">
            {x.toFixed(1)}%
          </span>
        ))}
        {WS.map((wv) => (
          <FragmentRow key={wv} wv={wv} wacc={wacc} g={g} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ wv, wacc, g, onPick }: { wv: number; wacc: number; g: number; onPick(w: number, g: number): void }) {
  return (
    <>
      <span className="ax">{wv.toFixed(1)}%</span>
      {GS.map((gv) => {
        const r = valueDcf(wv, gv);
        const on = Math.abs(wv - wacc) < 0.01 && Math.abs(gv - g) < 0.01;
        const off = r ? r.equity / DCF.marketCap - 1 : 0;
        const hue = off > 0 ? `rgba(21,194,107,${Math.min(0.75, off * 1.6)})` : `rgba(255,74,28,${Math.min(0.75, -off * 1.6)})`;
        return (
          <motion.button
            key={gv}
            className={`cell${on ? " on" : ""}`}
            style={{ background: hue }}
            whileHover={{ scale: 1.12, zIndex: 2 }}
            onClick={() => onPick(wv, gv)}
            title={`WACC ${wv}% · g ${gv}%`}
          >
            {r ? (r.equity / 1000).toFixed(0) : "—"}
          </motion.button>
        );
      })}
    </>
  );
}
