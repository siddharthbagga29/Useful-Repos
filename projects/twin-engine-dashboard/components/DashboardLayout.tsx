import type { ComplianceCheck, PropertyRecord, Market } from '@/types/property';
import { pipeline } from '@/types/property';
import { fmt } from '@/lib/data';

// ═══════════════════════════════════════════════════════════════════════════
// Unseen Studio · atmospheric command center.
// Every surface styles through globals.css `u-*` classes — no borders, no fills,
// no shadows, no color. Structure is whitespace + alignment; hierarchy is weight
// + opacity. The data is the only ornament.
// ═══════════════════════════════════════════════════════════════════════════

interface DashboardLayoutProps {
  properties: PropertyRecord[];
  compliance: { score: number; checks: ComplianceCheck[] };
  metrics: { totalEquity: number; blendedIrr: string };
}

// Hairline, non-scaling 1px sparkline. Data rendered as a line — no fill, no dot.
function Spark({ data }: { data: number[] }) {
  const w = 140, h = 24;
  const min = Math.min(...data), max = Math.max(...data);
  const x = (i: number) => (i * w) / (data.length - 1);
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="u-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Metric({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number[] }) {
  return (
    <div className="u-tile">
      <div className="u-label">{label}</div>
      <div className="u-metric u-num">{value}</div>
      {sub && <div className="u-sub">{sub}</div>}
      {trend && <div className="u-sparkwrap"><Spark data={trend} /></div>}
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

export function DashboardLayout({ properties, compliance, metrics }: DashboardLayoutProps) {
  return (
    <div className="u-root">
      <div className="u-page">
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

        {/* Movement I — Position */}
        <section className="u-band u-band-4" aria-label="Position">
          <Metric label="Blended Net IRR" value={metrics.blendedIrr} sub="+1.8 over 15.0 target" trend={[12, 13, 14, 15, 16, 16.8]} />
          <Metric label="MOIC · realized" value="1.9×" sub="trailing eight exits" trend={[1.4, 1.5, 1.6, 1.7, 1.8, 1.9]} />
          <Metric label="Capital Velocity · IN" value="1.6×" sub="rotations / 24 months" trend={[1.1, 1.2, 1.35, 1.4, 1.5, 1.6]} />
          <Metric label="Days to Stabilize · US" value="41" sub="−21 against entry" trend={[62, 55, 50, 47, 44, 41]} />
        </section>

        {/* Movement II — Engines */}
        <section className="u-band u-band-2" aria-label="Engines">
          <Engine market="US" records={properties} />
          <Engine market="IN" records={properties} />
        </section>

        {/* Movement III — Compliance */}
        <section className="u-band" aria-label="Compliance" style={{ display: 'block' }}>
          <Compliance score={compliance.score} checks={compliance.checks} />
        </section>

        <footer className="u-foot">
          <span>Exit readiness · 71% · 42 of 59 items</span>
          <span>USD normalized · every figure traces to source</span>
        </footer>
      </div>
    </div>
  );
}
