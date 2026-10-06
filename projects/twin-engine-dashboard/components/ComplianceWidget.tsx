import type { ComplianceCheck } from '@/types/property';

interface ComplianceWidgetProps {
  score: number;
  checks: ComplianceCheck[];
  className?: string;
}

// The exit-critical "Clean Books" widget. Given the raised shadow + engraved
// watermark so it reads as the command center's single most important surface.
export function ComplianceWidget({ score, checks, className = '' }: ComplianceWidgetProps) {
  const state = score >= 90 ? 'clean' : score >= 70 ? 'attention' : 'breach';
  const ring = state === 'clean' ? '#4ea87c' : state === 'attention' ? '#c79a54' : '#c76b6b';
  const label = state === 'clean' ? 'Audit-ready' : state === 'attention' ? 'Attention' : 'Breach';

  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - score / 100);

  return (
    <section className={`relative overflow-hidden rounded-squircle border border-line bg-surface-2 p-6 shadow-tile-raised ${className}`}>
      {/* faint engraved grid — premium, tactile, never loud */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <header className="relative flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-micro text-muted">Compliance · exit-critical</p>
          <h3 className="mt-1 text-base font-semibold text-ink">Clean Books Index</h3>
        </div>
        <span className="text-[10px] uppercase tracking-micro" style={{ color: ring }}>{label}</span>
      </header>

      <div className="relative mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={R} fill="none" stroke="#232936" strokeWidth="6" />
            <circle
              cx="64" cy="64" r={R} fill="none" stroke={ring} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 64 64)"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-mono text-[2rem] leading-none text-ink tabular-nums">{score}</div>
              <div className="mt-1 text-[9px] uppercase tracking-micro text-muted">/ 100</div>
            </div>
          </div>
        </div>

        <ul className="flex-1 space-y-2.5">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 text-[12px]">
              <span
                className="mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: c.ok ? '#4ea87c' : '#c79a54' }}
              />
              <span className={c.ok ? 'text-ink-2' : 'text-ink'}>
                {c.label}
                {c.note && <span className="text-muted"> · {c.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
        The metric a Tier-1 acquirer diligences first. Every figure traces to a source document —
        unpermitted work, related-party leakage, or entity commingling drop the index, and the exit
        multiple with it.
      </p>
    </section>
  );
}
