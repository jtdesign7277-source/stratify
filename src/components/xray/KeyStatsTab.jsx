import StatCard from './StatCard';

const formatCurrency = (value, options = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: options.decimals ?? 2,
    minimumFractionDigits: options.decimals ?? 2,
  }).format(parsed);
};

const formatCompactCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatMultiple = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${parsed.toFixed(2)}x`;
};

const formatPercent = (value, scale = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${(parsed * scale).toFixed(2)}%`;
};

const metricRows = (stats = {}) => [
  { label: 'Market Cap', value: formatCompactCurrency(stats.market_cap) },
  { label: 'Enterprise Value', value: formatCompactCurrency(stats.enterprise_value) },
  { label: 'P/E Ratio', value: formatMultiple(stats.pe_ratio) },
  { label: 'Forward P/E', value: formatMultiple(stats.forward_pe) },
  { label: 'PEG Ratio', value: formatMultiple(stats.peg_ratio) },
  { label: 'Price / Sales', value: formatMultiple(stats.price_to_sales) },
  { label: 'Price / Book', value: formatMultiple(stats.price_to_book) },
  { label: 'EV / EBITDA', value: formatMultiple(stats.ev_to_ebitda) },
  { label: 'EV / Revenue', value: formatMultiple(stats.ev_to_revenue) },
  { label: 'Profit Margin', value: formatPercent(stats.profit_margin, 100) },
  { label: 'Operating Margin', value: formatPercent(stats.operating_margin, 100) },
  { label: 'ROE', value: formatPercent(stats.return_on_equity, 100) },
  { label: 'ROA', value: formatPercent(stats.return_on_assets, 100) },
  { label: 'Revenue Growth', value: formatPercent(stats.revenue_growth, 100) },
  { label: 'Earnings Growth', value: formatPercent(stats.earnings_growth, 100) },
  { label: 'Current Ratio', value: Number.isFinite(Number(stats.current_ratio)) ? Number(stats.current_ratio).toFixed(2) : '—' },
  { label: 'Debt / Equity', value: Number.isFinite(Number(stats.debt_to_equity)) ? Number(stats.debt_to_equity).toFixed(2) : '—' },
  { label: 'Dividend Yield', value: formatPercent(stats.dividend_yield, 100) },
  { label: 'Payout Ratio', value: formatPercent(stats.payout_ratio, 100) },
  { label: 'Beta', value: Number.isFinite(Number(stats.beta)) ? Number(stats.beta).toFixed(2) : '—' },
  { label: '52W High', value: formatCurrency(stats.fifty_two_week_high) },
  { label: '52W Low', value: formatCurrency(stats.fifty_two_week_low) },
  { label: '50 Day MA', value: formatCurrency(stats.fifty_day_ma) },
  { label: '200 Day MA', value: formatCurrency(stats.two_hundred_day_ma) },
];

export default function KeyStatsTab({ stats }) {
  if (!stats) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-[#0a1628] p-10 text-center text-sm text-gray-400">
        No key statistics data available for this symbol.
      </div>
    );
  }

  const metrics = metricRows(stats);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Market Cap" value={formatCompactCurrency(stats.market_cap)} />
        <StatCard label="P/E Ratio" value={formatMultiple(stats.pe_ratio)} />
        <StatCard label="Revenue Growth" value={formatPercent(stats.revenue_growth, 100)} />
        <StatCard label="Debt / Equity" value={Number.isFinite(Number(stats.debt_to_equity)) ? Number(stats.debt_to_equity).toFixed(2) : '—'} />
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0a1628] p-4">
        <h3 className="text-sm font-semibold text-gray-100">Valuation & Financial Metrics</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between border-b border-white/5 py-1.5 text-sm">
              <span className="text-gray-400">{metric.label}</span>
              <span className="text-gray-100" style={{ fontFamily: "'SF Mono', monospace" }}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
