// Minimal ROI stat tile. No chart library — a single hairline sparkline and one
// number carry the signal. Negative space is the design.

interface ROIIndicatorProps {
  label: string;
  value: string;
  delta?: string;
  trend?: number[];
  accent?: 'us' | 'in' | 'ink';
  className?: string;
}

function Sparkline({ data, className = '' }: { data: number[]; className?: string }) {
  const w = 120, h = 30, p = 3;
  const min = Math.min(...data), max = Math.max(...data);
  const x = (i: number) => p + (i * (w - 2 * p)) / (data.length - 1);
  const y = (v: number) => h - p - ((v - min) / (max - min || 1)) * (h - 2 * p);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = data.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(data[last])} r={2.2} fill="currentColor" />
    </svg>
  );
}

export function ROIIndicator({
  label, value, delta, trend, accent = 'ink', className = '',
}: ROIIndicatorProps) {
  const accentClass = accent === 'us' ? 'text-us' : accent === 'in' ? 'text-in' : 'text-ink-2';
  return (
    <section
      className={`flex flex-col justify-between rounded-squircle border border-line/60 bg-surface p-5 shadow-tile transition-colors hover:border-line ${className}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-micro text-muted">{label}</p>
      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-medium tracking-tight text-ink tabular-nums">{value}</span>
          {delta && <span className="text-xs text-clean">{delta}</span>}
        </div>
        {trend && <Sparkline data={trend} className={`mt-3 h-7 w-full ${accentClass}`} />}
      </div>
    </section>
  );
}
