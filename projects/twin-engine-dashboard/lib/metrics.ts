// Every headline number on the dashboard is computed here from the records — nothing is typed in.
// Metrics that need data the records don't carry (IRR needs dated cash flows; days-to-stabilize
// needs lease-up dates) are reported as unavailable instead of invented.

import type { ComplianceCheck, Market, PropertyRecord } from '@/types/property';

export interface Metrics {
  totalEquity: number;
  equityByMarket: Record<Market, number>;
  active: number;
  exits: number;
  /** (ARV − basis) / basis across the whole book — gross of selling and financing costs */
  grossValueAdd: number;
  /** ARV / basis on sold assets only — a gross multiple, not a realized MOIC */
  realizedGrossMultiple: number | null;
  inRenovationShare: number;
  compliance: { score: number; clear: number; total: number; open: ComplianceCheck[] };
  irr: null;
  issues: string[];
}

export function computeMetrics(records: PropertyRecord[], checks: ComplianceCheck[]): Metrics {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const sold = records.filter((r) => r.status === 'sold');
  const basis = sum(records.map((r) => r.basis));
  const clear = checks.filter((c) => c.ok).length;
  const issues: string[] = [];
  for (const r of records) {
    if (r.equity > r.arv) issues.push(`${r.label}: equity exceeds ARV`);
    if (r.basis <= 0 || r.arv <= 0) issues.push(`${r.label}: missing basis or ARV`);
    if (r.equity < 0) issues.push(`${r.label}: negative equity`);
  }
  return {
    totalEquity: sum(records.map((r) => r.equity)),
    equityByMarket: {
      US: sum(records.filter((r) => r.market === 'US').map((r) => r.equity)),
      IN: sum(records.filter((r) => r.market === 'IN').map((r) => r.equity)),
    },
    active: records.length - sold.length,
    exits: sold.length,
    grossValueAdd: basis ? sum(records.map((r) => r.arv)) / basis - 1 : 0,
    realizedGrossMultiple: sold.length ? sum(sold.map((r) => r.arv)) / sum(sold.map((r) => r.basis)) : null,
    inRenovationShare: records.length ? records.filter((r) => r.status === 'renovating').length / records.length : 0,
    compliance: { score: Math.round((clear / checks.length) * 100), clear, total: checks.length, open: checks.filter((c) => !c.ok) },
    irr: null,
    issues,
  };
}
