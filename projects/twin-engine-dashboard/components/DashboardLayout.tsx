import type { ComplianceCheck, PropertyRecord, Market } from '@/types/property';
import { pipeline } from '@/types/property';
import { fmt } from '@/lib/data';
import type { Metrics } from '@/lib/metrics';

// ═══════════════════════════════════════════════════════════════════════════
// Unseen Studio · atmospheric command center.
// Every surface styles through globals.css `u-*` classes — no borders, no fills,
// no shadows, no color. Structure is whitespace + alignment; hierarchy is weight
// + opacity. The data is the only ornament.
// ═══════════════════════════════════════════════════════════════════════════

interface DashboardLayoutProps {
  properties: PropertyRecord[];
  checks: ComplianceCheck[];
  metrics: Metrics;
  /** true while the records are illustrative; shows a banner so no one mistakes them for holdings */
  sample?: boolean;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="u-tile">
      <div className="u-label">{label}</div>
      <div className="u-metric u-num">{value}</div>
      {sub && <div className="u-sub">{sub}</div>}
    </div>
  );
}

function Engine({ market, records }: { market: Market; records: PropertyRecord[] }) {
  const isUS = market === 'US';
  const stages = pipeline(records, market);
  const equity = stages.reduce((s, x) => s + x.equity, 0);
  const active = records.filter((r) => r.market === market && r.status !== 'sold').length;

  return (
    <div className="u-tile">
      <div className="u-mast">
        <div>
          <div className="u-label">{isUS ? 'US · Rent Machine' : 'India · Flip Machine'}</div>
          <div className="u-sub">{isUS ? 'Buy / Fix / Rent / Refinance' : 'Acquisition / Paperwork / Resale'}</div>
        </div>
        <div className="u-right">
          <div className="u-metric-s u-num">{fmt(equity)}</div>
        </div>
      </div>

      <div className="u-pipe" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
        <span className="u-pipe-line" />
        {stages.map((s) => (
          <div key={s.stage} className="u-pipe-node" {...(s.count > 0 ? { 'data-on': '' } : {})}>
            <span className="u-count u-num">{String(s.count).padStart(2, '0')}</span>
            <span className="u-stage">{s.stage}</span>
          </div>
        ))}
      </div>

      <div className="u-sub" style={{ marginTop: '1.75rem' }}>
        {active} active · {isUS ? 'leveraged, held' : 'unleveraged, rotated'}
      </div>
    </div>
  );
}

function Compliance({ score, checks }: { score: number; checks: ComplianceCheck[] }) {
  // Attention items lead and render at full weight; resolved items recede.
  const ordered = [...checks].sort((a, b) => Number(a.ok) - Number(b.ok));
  return (
    <div className="u-tile">
      <div className="u-label">Compliance · exit-critical</div>
      <div className="u-feature-grid">
        <div>
          <div className="u-hero u-num">
            {score}<span className="u-hero-unit">/ 100</span>
          </div>
          <div className="u-meter"><span style={{ width: `${score}%` }} /></div>
          <div className="u-sub" style={{ marginTop: '1.25rem', maxWidth: '32ch' }}>
            Clean Books Index — the first thing a Tier-1 acquirer diligences. Weight marks what needs attention; nothing here is decorative.
          </div>
        </div>
        <ul className="u-checks">
          {ordered.map((c) => (
            <li key={c.id} className={c.ok ? 'is-clear' : 'is-attention'}>
              <span className="u-check-label">{c.label}</span>
              <span className="u-check-state">{c.ok ? 'clear' : c.note ?? 'attention'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DashboardLayout({ properties, checks, metrics, sample = false }: DashboardLayoutProps) {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  return (
    <div className="u-root">
      <div className="u-page">
        {sample && <div className="u-banner">Concept build · illustrative sample data, not real holdings</div>}
        {/* Masthead */}
        <header className="u-mast">
          <div>
            <div className="u-wordmark">TWIN—ENGINE</div>
            <div className="u-sub" style={{ marginTop: '0.4rem' }}>Family-Office Control Room</div>
          </div>
          <div className="u-right">
            <div className="u-label">Platform Equity</div>
            <div className="u-metric u-num" style={{ marginTop: '0.5rem' }}>{fmt(metrics.totalEquity)}</div>
          </div>
        </header>
        <div className="u-rule" />

        {/* Movement I — Position (all computed from the records) */}
        <section className="u-band u-band-4" aria-label="Position">
          <Metric label="Gross value-add" value={pct(metrics.grossValueAdd)} sub="ARV ÷ basis − 1, before costs" />
          <Metric
            label="Exits · gross multiple"
            value={metrics.realizedGrossMultiple === null ? '—' : `${metrics.realizedGrossMultiple.toFixed(2)}×`}
            sub={`${metrics.exits} sold · ARV ÷ basis`}
          />
          <Metric label="Active assets" value={String(metrics.active)} sub={`${pct(metrics.inRenovationShare)} in renovation`} />
          <Metric label="Net IRR" value="—" sub="needs dated cash flows" />
        </section>

        {/* Movement II — Engines */}
        <section className="u-band u-band-2" aria-label="Engines">
          <Engine market="US" records={properties} />
          <Engine market="IN" records={properties} />
        </section>

        {/* Movement III — Compliance */}
        <section className="u-band" aria-label="Compliance" style={{ display: 'block' }}>
          <Compliance score={metrics.compliance.score} checks={checks} />
        </section>

        <footer className="u-foot">
          <span>
            Clean books · {metrics.compliance.clear} of {metrics.compliance.total} checks clear
            {metrics.issues.length ? ` · ${metrics.issues.length} data issue(s)` : ''}
          </span>
          <span>USD normalized · every figure computed from the records</span>
        </footer>
      </div>
    </div>
  );
}
