import type { PropertyRecord, ComplianceCheck } from '@/types/property';

// Compact INR/USD-agnostic currency formatter (values are USD-normalized here).
export const fmt = (n: number): string =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`;

// ── Illustrative portfolio (replace with your API / Supabase query) ─────────
export const properties: PropertyRecord[] = [
  { id: 'us-01', market: 'US', label: 'Maple Ct · 24u', status: 'refinancing', equity: 1_240_000, basis: 2_050_000, arv: 3_290_000, updatedAt: '2026-07-10' },
  { id: 'us-02', market: 'US', label: 'Norwood · 16u',  status: 'renovating',  equity: 640_000,   basis: 1_180_000, arv: 1_820_000, updatedAt: '2026-07-12' },
  { id: 'us-03', market: 'US', label: 'Price Hill · 32u', status: 'sold',       equity: 1_510_000, basis: 2_600_000, arv: 4_110_000, updatedAt: '2026-06-28' },
  { id: 'us-04', market: 'US', label: 'Hamilton · 12u',  status: 'acquired',   equity: 410_000,   basis: 720_000,   arv: 1_180_000, updatedAt: '2026-07-15' },
  { id: 'in-01', market: 'IN', label: 'Sec 99 · 3BHK',   status: 'renovating', equity: 180_000,   basis: 172_000,   arv: 232_000,   updatedAt: '2026-07-14' },
  { id: 'in-02', market: 'IN', label: 'Dwarka · 2BHK',   status: 'sold',       equity: 96_000,    basis: 210_000,   arv: 262_000,   updatedAt: '2026-07-02' },
  { id: 'in-03', market: 'IN', label: 'Sec 84 · Floor',  status: 'acquired',   equity: 88_000,    basis: 165_000,   arv: 224_000,   updatedAt: '2026-07-16' },
  { id: 'in-04', market: 'IN', label: 'e-Auction · 3BHK', status: 'renovating', equity: 74_000,   basis: 148_000,   arv: 205_000,   updatedAt: '2026-07-11' },
];

export const totalEquity = properties.reduce((s, p) => s + p.equity, 0);

// ── Clean Books index — the exit-critical KPI ───────────────────────────────
export const complianceChecks: ComplianceCheck[] = [
  { id: 'audit',   label: 'Audited financials current', ok: true },
  { id: 'permits', label: 'All renovation work permitted', ok: true },
  { id: 'related', label: 'Related-party fees at arm’s length', ok: true },
  { id: 'title',   label: 'Title & document files complete', ok: false, note: '2 IN files pending mutation' },
  { id: 'entity',  label: 'US / IN capital pools separated (FEMA)', ok: true },
  { id: 'fx',      label: 'Dual-currency ledger reconciled', ok: true },
];

export const cleanScore = Math.round(
  (complianceChecks.filter((c) => c.ok).length / complianceChecks.length) * 100,
);
