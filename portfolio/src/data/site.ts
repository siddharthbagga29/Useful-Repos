// Every figure on the site comes from here. Market data verified 2 Oct 2026;
// career figures come from the resume and jarvis/knowledge/brief.md.

export const SITE_URL = "https://siddharthbagga29.github.io/";

export const CONTACT = {
  email: "siddharthbagga29@gmail.com",
  phone: "(860) 595-8333",
  phoneHref: "tel:+18605958333",
  linkedin: "https://www.linkedin.com/in/siddharth-bagga-sid29",
};

const drive = (id: string) => `https://drive.google.com/file/d/${id}/view`;

export type ExhibitId = "spgi" | "deck" | "risk" | "gc" | "bmc" | "msfin";

export const EXHIBITS: { id: ExhibitId; title: string; kind: string; url: string; aliases: string[] }[] = [
  { id: "spgi", title: "S&P Global — Multi-Scenario DCF", kind: "PDF", url: drive("16exTikgrGDXtMG6ZUGbIU22tXKgNhoKl"), aliases: ["spgi", "s&p", "dcf", "capstone report", "valuation report"] },
  { id: "deck", title: "Capstone Presentation", kind: "DECK", url: drive("1fx3hFvXdGHgK7XMSgFsUEMoOitSsR27y"), aliases: ["deck", "presentation", "slides", "capstone deck"] },
  { id: "risk", title: "Risk Tolerance Analysis", kind: "PDF", url: drive("1qB5As8EMQOw-WS0HCriqin_5XS1jaOq-"), aliases: ["risk", "risk tolerance"] },
  { id: "gc", title: "Quantitative Finance Certificate", kind: "PDF", url: drive("1jN9sdVKpPvv7wb9YeDctIdp1dyjLKhji"), aliases: ["certificate", "quant", "quantitative"] },
  { id: "bmc", title: "Bloomberg Market Concepts", kind: "PDF", url: drive("16QUWgafaycdPYgU6QwjtomN5RdOMq-BG"), aliases: ["bloomberg", "bmc"] },
  { id: "msfin", title: "M.S. Financial Mathematics", kind: "PDF", url: drive("179h1eO2Yu2-5sW_dhz0Q9igq3rhEmI-D"), aliases: ["degree", "masters", "diploma", "ms", "m.s."] },
];

export const exhibit = (id: ExhibitId) => EXHIBITS.find((e) => e.id === id)!;

export const TAPE: [string, string, "up" | "down" | "flat"][] = [
  ["SPGI", "385.45 −0.70%", "down"],
  ["MCO", "441.06 −1.41%", "down"],
  ["MSCI", "537.18 −1.51%", "down"],
  ["SPGI MKT CAP", "$113.6B", "flat"],
  ["SPGI P/E", "23.6x", "flat"],
  ["SPGI REV 25A", "$15.34B", "flat"],
  ["WACC (SITE MODEL)", "8.5%", "flat"],
  ["TERM g", "3.0%", "flat"],
  ["PIPELINE", "$6.0M+", "up"],
  ["OPEX", "−6.0%", "up"],
  ["AS OF", "2 OCT 2026", "flat"],
];

/** Stations of the film, in order. `act` drives the analyst's activity. */
export const STATIONS = [
  { id: "hero", label: "Spawn point", act: "type", doing: "building the model" },
  { id: "numbers", label: "The numbers", act: "model", doing: "running sensitivities" },
  { id: "terminal", label: "Terminal", act: "command", doing: "pulling the tape" },
  { id: "model", label: "The model", act: "model", doing: "solving the DCF" },
  { id: "dealroom", label: "Deal room", act: "docs", doing: "reading the dossier" },
  { id: "exhibits", label: "Exhibits", act: "docs", doing: "filing the exhibits" },
  { id: "jarvis", label: "Jarvis", act: "talk", doing: "briefing Jarvis" },
  { id: "contact", label: "Contact", act: "coffee", doing: "earned it" },
] as const;

export type StationId = (typeof STATIONS)[number]["id"];
export type Act = (typeof STATIONS)[number]["act"] | "listen" | "stamp";

// ---- S&P Global illustrative DCF ($M) ----
export const DCF = {
  revenue: [12497, 14208, 15336, 16410, 17558], // 23A 24A 25A reported; 26E 27E
  fcf: [5800, 6206, 6640, 7105, 7602],
  netDebt: 9300,
  marketCap: 113640, // SPGI market cap, 2 Oct 2026
  defaultWacc: 8.5,
  defaultG: 3.0,
};

export function valueDcf(waccPct: number, gPct: number) {
  const w = waccPct / 100;
  const g = gPct / 100;
  if (w - g <= 0.005) return null;
  const pv = DCF.fcf.reduce((s, f, i) => s + f / (1 + w) ** (i + 1), 0);
  const tv = (DCF.fcf[4]! * (1 + g)) / (w - g);
  const pvtv = tv / (1 + w) ** 5;
  const ev = pv + pvtv;
  const equity = ev - DCF.netDebt;
  const offPct = Math.abs(equity / DCF.marketCap - 1) * 100;
  return { pv, tv, pvtv, ev, equity, offPct };
}
