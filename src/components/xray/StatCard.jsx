import { formatCompactNumber } from '../../lib/twelvedata';

export default function StatCard({
  label,
  value,
  subvalue,
  tone = 'default',
  compact = false,
}) {
  const valueColor =
    tone === 'positive'
      ? 'text-emerald-300'
      : tone === 'negative'
        ? 'text-red-300'
        : tone === 'accent'
          ? 'text-blue-300'
          : 'text-[#e5e7eb]';

  const formattedValue =
    value === null || value === undefined
      ? '--'
      : compact
        ? formatCompactNumber(value)
        : value;

  return (
    <div className={`rounded-xl border border-white/10 bg-[#0a1628] ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.12em] text-[#6b7280]`}>{label}</p>
      <p className={`font-mono font-semibold ${compact ? 'mt-1 text-base' : 'mt-2 text-lg'} ${valueColor}`}>{formattedValue}</p>
      {subvalue ? <p className={`${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-[11px]'} text-[#9ca3af]`}>{subvalue}</p> : null}
    </div>
  );
}
