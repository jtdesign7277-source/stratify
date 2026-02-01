import { useState, useEffect, useCallback } from 'react';

const TrendUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);

const TrendDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
  </svg>
);

const formatNumber = (num) => {
  if (!num) return null;
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
};

export default function Watchlist({ stocks, onRemove, onViewChart, themeClasses, compact = false }) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState({});

  const fetchQuote = useCallback(async (symbol) => {
    setLoading(prev => ({ ...prev, [symbol]: true }));
    try {
      const res = await fetch(`/api/stock/${symbol}`);
      const data = await res.json();
      if (data.stock) {
        setQuotes(prev => ({ ...prev, [symbol]: data.stock }));
      }
    } catch (err) {
      console.error('Quote fetch error:', err);
    }
    setLoading(prev => ({ ...prev, [symbol]: false }));
  }, []);

  useEffect(() => {
    stocks.forEach(stock => {
      fetchQuote(stock.symbol);
    });
    const interval = setInterval(() => {
      stocks.forEach(stock => fetchQuote(stock.symbol));
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, fetchQuote]);

  const getChangeColor = (change) => {
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-red-400';
    return 'text-zinc-400';
  };

  if (stocks.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-zinc-500 text-sm">
        No stocks in watchlist
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-2">
      {stocks.map(stock => {
        const quote = quotes[stock.symbol] || {};
        const isLoading = loading[stock.symbol];
        const hasData = quote.price !== undefined;
        
        const price = quote.price || stock.price || 0;
        const change = quote.change || stock.change || 0;
        const changePercent = quote.changePercent || stock.changePercent || 0;
        const volume = quote.volume || stock.volume;
        const companyName = quote.name || stock.name || '';
        
        return (
          <div 
            key={stock.symbol} 
            className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 hover:border-zinc-600/50 transition-colors cursor-pointer"
            onClick={() => onViewChart && onViewChart(stock)}
          >
            {/* Top row: Symbol/Name and Price/Change */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-bold text-white">{stock.symbol}</span>
                <p className="text-xs text-zinc-500 truncate max-w-[140px]">{companyName}</p>
              </div>
              <div className="text-right">
                {isLoading && !hasData ? (
                  <div className="w-4 h-4 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
                ) : (
                  <>
                    <p className="font-semibold text-white">${price.toFixed(2)}</p>
                    <div className={`flex items-center justify-end gap-1 text-xs ${getChangeColor(change)}`}>
                      {change >= 0 ? (
                        <TrendUpIcon className="w-3 h-3" />
                      ) : (
                        <TrendDownIcon className="w-3 h-3" />
                      )}
                      <span>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Bottom row: Volume and Remove button */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-700/30">
              <div className="flex gap-3 text-xs text-zinc-500">
                {volume && <span>Vol: {formatNumber(volume)}</span>}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(stock.symbol);
                }}
                className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
