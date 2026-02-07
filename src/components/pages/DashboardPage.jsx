import { useMarketData, usePortfolio, useWatchlist } from '../../store/StratifyProvider';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(safeValue);
};

const formatSignedCurrency = (value) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue >= 0 ? '+' : '-';
  return `${sign}${currencyFormatter.format(Math.abs(safeValue))}`;
};

const formatChange = (value) => {
  const safeValue = Number(value);
  if (!Number.isFinite(safeValue)) return '—';
  const sign = safeValue >= 0 ? '+' : '';
  return `${sign}${safeValue.toFixed(2)}`;
};

const DashboardPage = () => {
  const { totalValue, todayPnL } = usePortfolio();
  const { getPrice, loading } = useMarketData();
  const { symbols } = useWatchlist();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0a1628] border border-white/10 rounded-xl p-6">
          <p className="text-sm text-gray-400">Portfolio Value</p>
          <div className="text-3xl font-semibold mt-2">{formatCurrency(totalValue)}</div>
        </div>
        <div className="bg-[#0a1628] border border-white/10 rounded-xl p-6">
          <p className="text-sm text-gray-400">Today P&amp;L</p>
          <div className={`text-3xl font-semibold mt-2 ${todayPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatSignedCurrency(todayPnL)}
          </div>
        </div>
      </div>

      <div className="bg-[#0a1628] border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <span className="text-xs text-gray-400">
            {loading ? 'Loading prices…' : `${symbols.length} symbols`}
          </span>
        </div>

        <div className="space-y-3">
          {symbols.map((symbol) => {
            const quote = getPrice(symbol);
            const price = Number(quote?.price);
            const change = Number(quote?.change);
            const changeClass = Number.isFinite(change)
              ? change >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
              : 'text-gray-400';

            return (
              <div key={symbol} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                <div className="text-sm font-medium">${symbol}</div>
                <div className="text-right">
                  <div className="text-sm text-white">
                    {Number.isFinite(price) ? formatCurrency(price) : '—'}
                  </div>
                  <div className={`text-xs ${changeClass}`}>{formatChange(change)}</div>
                </div>
              </div>
            );
          })}

          {symbols.length === 0 && (
            <div className="text-sm text-gray-400">No symbols in your watchlist.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
