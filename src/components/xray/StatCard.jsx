export default function StatCard({ label, value, sublabel, positive = null }) {
  const valueColor =
    positive === true
      ? 'text-emerald-300'
      : positive === false
        ? 'text-rose-300'
        : 'text-gray-100';

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1628] px-4 py-3 min-w-[150px]">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueColor}`} style={{ fontFamily: "'SF Mono', monospace" }}>
        {value ?? '—'}
      </div>
      {sublabel ? <div className="mt-1 text-[11px] text-gray-500">{sublabel}</div> : null}
    </div>
  );
}
