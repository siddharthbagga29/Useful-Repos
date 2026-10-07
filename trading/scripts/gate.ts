// The execution loop's deterministic side. Claude Code calls the Robinhood MCP tools; this CLI does
// the arithmetic and says yes or no. Nothing here talks to a broker.
//
//   node --experimental-strip-types scripts/gate.ts <command> [flags]
//     sync                         fetch the Brain's live champion into state/brain.json
//     status                       AHS scorecard and health state
//     plan   --quotes q.json --positions p.json [--force]   target orders, each already gate-checked
//     check  --order o.json --quotes q.json --positions p.json   exit 0 = allowed, 1 = rejected
//     fill   --fill f.json         record a fill (paper fills are simulated by the agent, see CLAUDE.md)
//     eod    --equity N --realized N [--trades t.json]          close the day, write daily_summary.md
//
// Exit codes: 0 ok, 1 rejected/halted, 2 usage or data error.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Dataset } from "../../portfolio/src/lab/backtest.ts";
import { loadJournal, saveJournal, summary } from "../src/journal.ts";
import { championWeights, daysOld, fitToCaps, needsFreshData, planOrders, rebalanceDue, type Genome } from "../src/plan.ts";
import { checkOrder, scorecard } from "../src/risk.ts";
import type { Config, Fill, PlannedOrder, Position, Quote } from "../src/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  config: join(ROOT, "config.json"),
  ack: join(ROOT, "LIVE_ACK"),
  journal: join(ROOT, "trading_journal.json"),
  summary: join(ROOT, "daily_summary.md"),
  brain: join(ROOT, "state/brain.json"),
  paper: join(ROOT, "paper_positions.json"),
  data: join(ROOT, "../portfolio/src/lab/weekly.json"),
};
const LIVE_STATE = "https://raw.githubusercontent.com/siddharthbagga29/siddharthbagga29.github.io/main/brain/state.json";
export const ACK_TEXT = "I accept the risk of live trading with this sleeve";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (k: string) => {
  const i = rest.indexOf(`--${k}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const has = (k: string) => rest.includes(`--${k}`);
const readJson = <T>(p: string | undefined, what: string): T => {
  if (!p) die(`missing --${what}`);
  return JSON.parse(readFileSync(p!, "utf8")) as T;
};
function die(msg: string, code = 2): never {
  console.error(msg);
  process.exit(code);
}

function config(): Config {
  const c = JSON.parse(readFileSync(P.config, "utf8")) as Config;
  if (c.mode === "live") {
    const ack = existsSync(P.ack) ? readFileSync(P.ack, "utf8").trim() : "";
    if (ack !== ACK_TEXT) {
      console.error(`config says live, but LIVE_ACK is missing or wrong: running as PAPER.`);
      c.mode = "paper";
    }
  }
  return c;
}

const cfg = config();
const journal = loadJournal(P.journal, cfg);
const card = scorecard(journal, cfg);
const now = new Date();
const out = (v: unknown) => console.log(JSON.stringify(v, null, 2));

switch (cmd) {
  case "sync": {
    const r = await fetch(LIVE_STATE).catch((e: Error) => die(`fetch failed: ${e.message}`));
    if (!r.ok) die(`fetch failed: HTTP ${r.status}`);
    const s = (await r.json()) as { champion: { label: string; genome: Genome }; lastRun: string; generation: number };
    mkdirSync(dirname(P.brain), { recursive: true });
    writeFileSync(P.brain, `${JSON.stringify({ champion: s.champion, lastRun: s.lastRun, generation: s.generation }, null, 2)}\n`);
    out({ mode: cfg.mode, generation: s.generation, champion: s.champion.label, lastRun: s.lastRun });
    break;
  }
  case "status": {
    out({ mode: cfg.mode, halted: journal.halted ?? null, ...card });
    process.exit(card.health === "terminate" || journal.halted ? 1 : 0);
    break;
  }
  case "plan": {
    if (journal.halted) die(`HALTED since ${journal.halted.at}: ${journal.halted.reason}`, 1);
    if (!existsSync(P.brain)) die("no state/brain.json: run sync first");
    const brain = JSON.parse(readFileSync(P.brain, "utf8")) as { champion: { label: string; genome: Genome } };
    const data = JSON.parse(readFileSync(P.data, "utf8")) as Dataset;
    const g = brain.champion.genome;
    const age = daysOld(data.asOf, now);
    if (needsFreshData(g) && age > cfg.maxDataAgeDays) die(`${g.strategy} needs fresh prices; weekly data is ${age} days old`, 1);
    const due = rebalanceDue(journal.lastRebalance, g.rebalanceWeeks, now);
    if (!due && !has("force")) {
      out({ mode: cfg.mode, due: false, nextRebalanceAfter: journal.lastRebalance, champion: brain.champion.label, orders: [] });
      break;
    }
    const quotes = readJson<Quote[]>(flag("quotes"), "quotes");
    const positions = readJson<Position[]>(flag("positions"), "positions");
    const raw = championWeights(g, data);
    const { weights, scale } = fitToCaps(raw, cfg);
    const orders = planOrders(weights, positions, quotes, card.equity, card.sizeMultiplier, cfg);
    const checked = orders.map((o) => ({ ...o, check: checkOrder(o, { cfg, quote: quotes.find((q) => q.symbol === o.symbol), positions, card, now, dataAgeDays: needsFreshData(g) ? age : undefined }) }));
    out({ mode: cfg.mode, due: true, champion: brain.champion.label, health: card.health, sizeMultiplier: card.sizeMultiplier, rawWeights: raw, capScale: scale, targetWeights: weights, orders: checked });
    break;
  }
  case "check": {
    const o = readJson<PlannedOrder>(flag("order"), "order");
    const quotes = readJson<Quote[]>(flag("quotes"), "quotes");
    const positions = readJson<Position[]>(flag("positions"), "positions");
    const c = checkOrder(o, { cfg, quote: quotes.find((q) => q.symbol === o.symbol), positions, card, now });
    if (journal.halted) c.reasons.push(`HALTED: ${journal.halted.reason}`), (c.ok = false);
    out({ mode: cfg.mode, ...c });
    process.exit(c.ok ? 0 : 1);
    break;
  }
  case "fill": {
    const f = readJson<Fill>(flag("fill"), "fill");
    const today = now.toISOString().slice(0, 10);
    let day = journal.days.find((d) => d.date === today);
    if (!day) {
      day = { date: today, equity: card.equity, realizedPnl: 0, trades: [], fills: [] };
      journal.days.push(day);
    }
    day.fills.push(f);
    const slip = Math.abs(f.fillPrice / f.limitPrice - 1) * 100;
    journal.lastRebalance = today;
    saveJournal(P.journal, journal);
    if (cfg.mode === "paper") {
      // the simulated book: average cost on buys, reduce on sells
      const book: Position[] = existsSync(P.paper) ? JSON.parse(readFileSync(P.paper, "utf8")) : [];
      const pos = book.find((p) => p.symbol === f.symbol);
      if (f.side === "buy") {
        if (pos) {
          pos.avgPrice = (pos.avgPrice * pos.qty + f.fillPrice * f.qty) / (pos.qty + f.qty);
          pos.qty += f.qty;
        } else book.push({ symbol: f.symbol, qty: f.qty, avgPrice: f.fillPrice });
      } else if (pos) pos.qty -= f.qty;
      writeFileSync(P.paper, `${JSON.stringify(book.filter((p) => p.qty > 0), null, 2)}\n`);
    }
    out({ recorded: f, slippagePct: slip, flag: slip > cfg.maxSlippagePct ? "slippage above limit: pause and reassess" : null });
    break;
  }
  case "eod": {
    const equity = Number(flag("equity"));
    const realized = Number(flag("realized") ?? 0);
    if (!Number.isFinite(equity) || equity <= 0) die("--equity must be the sleeve's value at the close");
    const trades = flag("trades") ? readJson<{ pnl: number }[]>(flag("trades"), "trades") : [];
    const today = now.toISOString().slice(0, 10);
    const existing = journal.days.find((d) => d.date === today);
    if (existing) Object.assign(existing, { equity, realizedPnl: realized, trades: [...existing.trades, ...trades] });
    else journal.days.push({ date: today, equity, realizedPnl: realized, trades, fills: [] });
    const c = scorecard(journal, cfg);
    if (c.health === "terminate" && !journal.halted) journal.halted = { at: now.toISOString(), reason: c.reasons.join("; ") };
    saveJournal(P.journal, journal);
    writeFileSync(P.summary, summary(today, c, cfg));
    out({ mode: cfg.mode, halted: journal.halted ?? null, ...c });
    process.exit(journal.halted ? 1 : 0);
    break;
  }
  default:
    die("usage: gate.ts sync | status | plan | check | fill | eod (see the header of scripts/gate.ts)");
}
