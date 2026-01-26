import { useState, useEffect } from 'react';

const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';

export default function Watchlist({ stocks, onRemove, themeClasses }) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    stocks.forEach(stock => {
      if (!quotes[stock.symbol]) {
        fetchQuote(stock.symbol);
      }
    });
  }, [stocks]);

  const fetchQuote = async (symbol) => {
    setLoading(prev => ({ ...prev, [symbol]: true }));
    try {
      const res = await fetch(`${API_URL}/api/public/quote/${symbol}`);
      const data = await res.json();
      setQuotes(prev => ({ ...prev, [symbol]: data }));
    } catch (err) {
      console.error('Quote fetch error:', err);
    }
    setLoading(prev => ({ ...prev, [symbol]: false }));
  };

  const refreshAll = () => {
    stocks.forEach(stock => fetchQuote(stock.symbol));
  };

  const formatPrice = (price) => {
    if (!price) return '--';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  };

  const formatChange = (change, changePercent) => {
    if (change === undefined) return { text: '--', color: 'text-gray-400' };
    const isPositive = change >= 0;
    return {
      text: `${isPositive ? '+' : ''}${change?.toFixed(2)} (${isPositive ? '+' : ''}${changePercent?.toFixed(2)}%)`,
      color: isPositive ? 'text-emerald-400' : 'text-red-400'
    };
  };

  if (stocks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Search and click a stock to add to watchlist
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-2 px-2">
        <span className="text-xs text-gray-400 uppercase tracking-wider">Watchlist</span>
        <button onClick={refreshAll} className="text-xs text-emerald-400 hover:text-emerald-300">
          Refresh
        </button>
      </div>
      <div className="space-y-1">
        {stocks.map(stock => {
          const quote = quotes[stock.symbol] || {};
          const change = formatChange(quote.change, quote.changePercent);
          return (
            <div key={stock.symbol} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 group">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold text-sm">{stock.symbol}</span>
                  <span className="text-xs text-gray-500 truncate max-w-[100px]">{stock.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white text-sm font-medium">
                    {loading[stock.symbol] ? '...' : formatPrice(quote.price)}
                  </span>
                  <span className={`text-xs ${change.color}`}>{change.text}</span>
                </div>
              </div>
              <button
                onClick={() => onRemove(stock.symbol)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
