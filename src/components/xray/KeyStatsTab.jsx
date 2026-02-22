import StatCard from './StatCard';
import { useProfile, useStatistics } from './hooks/useTwelveData';
import { formatCompactNumber, formatPercent } from '../../lib/twelvedata';

const metric = (value, formatter = null) => {
  if (value === null || value === undefined || value === '') return '--';
  if (formatter) return formatter(value);
  return String(value);
};

export default function KeyStatsTab({ symbol }) {
  const { data: stats, loading: statsLoading, error: statsError } = useStatistics(symbol);
  const { data: profile } = useProfile(symbol);

  if (statsLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0a1628] p-4 text-sm text-[#9ca3af]">
        Loading statistics...
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-[#0a1628] p-4 text-sm text-red-300">
        {statsError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Market Cap" value={metric(stats?.market_cap, formatCompactNumber)} tone="accent" />
        <StatCard label="Enterprise Value" value={metric(stats?.enterprise_value, formatCompactNumber)} />
        <StatCard label="P/E" value={metric(stats?.pe_ratio, (v) => Number(v).toFixed(2))} />
        <StatCard label="Forward P/E" value={metric(stats?.forward_pe, (v) => Number(v).toFixed(2))} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="EV / EBITDA" value={metric(stats?.ev_to_ebitda, (v) => Number(v).toFixed(2))} />
        <StatCard label="EV / Revenue" value={metric(stats?.ev_to_revenue, (v) => Number(v).toFixed(2))} />
        <StatCard label="Profit Margin" value={metric(stats?.profit_margin, (v) => formatPercent(Number(v) * 100))} tone="positive" />
        <StatCard label="Operating Margin" value={metric(stats?.operating_margin, (v) => formatPercent(Number(v) * 100))} tone="positive" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="ROE" value={metric(stats?.return_on_equity, (v) => formatPercent(Number(v) * 100))} tone="positive" />
        <StatCard label="ROA" value={metric(stats?.return_on_assets, (v) => formatPercent(Number(v) * 100))} tone="positive" />
        <StatCard label="Revenue Growth" value={metric(stats?.revenue_growth, (v) => formatPercent(Number(v) * 100))} tone={(Number(stats?.revenue_growth) || 0) >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Earnings Growth" value={metric(stats?.earnings_growth, (v) => formatPercent(Number(v) * 100))} tone={(Number(stats?.earnings_growth) || 0) >= 0 ? 'positive' : 'negative'} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0a1628] p-4">
        <h3 className="text-sm font-semibold text-[#e5e7eb]">Company Profile</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#9ca3af] md:grid-cols-2">
          <div>
            <span className="text-[#6b7280]">Name:</span> {profile?.name || profile?.company_name || '--'}
          </div>
          <div>
            <span className="text-[#6b7280]">Exchange:</span> {profile?.exchange || '--'}
          </div>
          <div>
            <span className="text-[#6b7280]">Sector:</span> {profile?.sector || '--'}
          </div>
          <div>
            <span className="text-[#6b7280]">Industry:</span> {profile?.industry || '--'}
          </div>
          <div>
            <span className="text-[#6b7280]">Country:</span> {profile?.country || '--'}
          </div>
          <div>
            <span className="text-[#6b7280]">Employees:</span> {metric(profile?.full_time_employees, formatCompactNumber)}
          </div>
        </div>
      </div>
    </div>
  );
}
