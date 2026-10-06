// ═══════════════════════════════════════════════════════════════════════════
// Twin-Engine · business-logic types
// ═══════════════════════════════════════════════════════════════════════════

// ── Core interface (exactly as specified) ──────────────────────────────────
export type PropertyStatus = 'acquired' | 'renovating' | 'rented' | 'refinancing' | 'sold';
export type Market = 'US' | 'IN';

export interface PropertyData {
  status: PropertyStatus;
  market: Market;
  equity: number;
}

// ── Practical extension the UI actually renders ────────────────────────────
export interface PropertyRecord extends PropertyData {
  id: string;
  label: string; // e.g. "Maple Ct · 24u"  |  "Sec 99 · 3BHK"
  basis: number; // all-in cost
  arv: number;   // after-repair value (US) / resale price (IN)
  updatedAt: string; // ISO date
}

// ── Market-specific pipeline vocabularies ──────────────────────────────────
// US runs a leveraged BRRRR cycle; IN rotates capital and never refinances.
export const US_STAGES = ['Buy', 'Fix', 'Rent', 'Refinance', 'Exit'] as const;
export const IN_STAGES = ['Acquisition', 'Paperwork', 'Resale'] as const;
export type USStage = (typeof US_STAGES)[number];
export type INStage = (typeof IN_STAGES)[number];

// Map the shared status onto the market's own stage label.
export function stageFor(p: PropertyData): USStage | INStage {
  if (p.market === 'US') {
    return (
      // A sold building has left the BRRRR cycle; it is an exit, not a rental (v1 counted it as Rent).
      { acquired: 'Buy', renovating: 'Fix', rented: 'Rent', refinancing: 'Refinance', sold: 'Exit' } as const
    )[p.status];
  }
  // IN has no refinance leg — 'refinancing' is treated as paperwork/cure.
  return (
    { acquired: 'Acquisition', renovating: 'Paperwork', rented: 'Paperwork', refinancing: 'Paperwork', sold: 'Resale' } as const
  )[p.status];
}

export interface StageBucket {
  stage: string;
  count: number;
  equity: number;
}

// Bucket a portfolio into its market pipeline for the stage rail.
export function pipeline(records: PropertyRecord[], market: Market): StageBucket[] {
  const stages = market === 'US' ? US_STAGES : IN_STAGES;
  const bucket = new Map<string, StageBucket>(
    stages.map((s) => [s, { stage: s, count: 0, equity: 0 }]),
  );
  for (const r of records) {
    if (r.market !== market) continue;
    const b = bucket.get(stageFor(r));
    if (b) {
      b.count += 1;
      b.equity += r.equity;
    }
  }
  return stages.map((s) => bucket.get(s)!);
}

// ── Compliance ("Clean Books") model ───────────────────────────────────────
export interface ComplianceCheck {
  id: string;
  label: string;
  ok: boolean;
  note?: string;
}
