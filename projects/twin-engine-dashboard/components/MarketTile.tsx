import { pipeline, type Market, type PropertyRecord } from '@/types/property';
import { fmt } from '@/lib/data';

interface MarketTileProps {
  market: Market;
  records: PropertyRecord[];
  className?: string;
}

export function MarketTile({ market, records, className = '' }: MarketTileProps) {
  const isUS = market === 'US';
  const stages = pipeline(records, market);
  const equity = stages.reduce((s, x) => s + x.equity, 0);
  const active = records.filter((r) => r.market === market && r.status !== 'sold').length;
  const accentBg = isUS ? 'bg-us' : 'bg-in';
  const accentText = isUS ? 'text-us' : 'text-in';

  return (
    <section className={`flex flex-col rounded-squircle border border-line/60 bg-surface p-6 shadow-tile ${className}`}>
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${accentBg}`} />
            <h3 className="text-sm font-semibold text-ink">
              {isUS ? 'US · Rent Machine' : 'India · Flip Machine'}
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {isUS ? 'Buy → Fix → Rent → Refinance' : 'Acquisition → Paperwork → Resale'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-micro text-muted">Equity</p>
          <p className="font-mono text-lg text-ink tabular-nums">{fmt(equity)}</p>
        </div>
      </header>

      {/* Stage rail — a segmented status bar, not a chart. */}
      <div
        className="mt-8 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0,1fr))` }}
      >
        {stages.map((s) => (
          <div key={s.stage} className="flex flex-col gap-2">
            <div
              className={`h-1 rounded-full ${s.count ? accentBg : 'bg-line'}`}
              style={{ opacity: s.count ? Math.min(1, 0.45 + s.count * 0.18) : 1 }}
            />
            <span className="text-[10px] text-ink-2">{s.stage}</span>
            <span className="font-mono text-sm text-ink tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>

      <footer className="mt-auto flex items-center justify-between pt-6 text-[11px]">
        <span className="text-muted">{active} active {active === 1 ? 'asset' : 'assets'}</span>
        <span className={accentText}>{isUS ? 'Leveraged · held' : 'Unleveraged · rotated'}</span>
      </footer>
    </section>
  );
}
