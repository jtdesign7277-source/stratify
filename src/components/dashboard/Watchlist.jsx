import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';

export default function Watchlist({ stocks, onRemove, onViewChart, themeClasses, compact = false }) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState({});

  const fetchQuote = useCallback(async (symbol) => {
    setLoading(prev => ({ ...prev, [symbol]: true }));
    try {
      const res = await fetch(`${API_URL}/api/public/quote/${symbol}`);
      const data = await res.json();
      setQuotes(prev => ({ ...prev, [symbol]: data }));
    } catch (err) {
      console.error('Quote fetch error:', err);
    }
    setLoading(prev => ({ ...prev, [symbol]: false }));
  }, []);

  useEffect(() => {
    stocks.forEach(stock => {
      fetchQuote(stock.symbol);
    });
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      stocks.forEach(stock => fetchQuote(stock.symbol));
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, fetchQuote]);

  const refreshAll = () => {
    stocks.forEach(stock => fetchQuote(stock.symbol));
  };

  const formatPrice = (price) => {
    if (!price) return '--';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  };

  if (stocks.length === 0) {
    return (
      <div className={`${compact ? 'px-3 py-3' : 'p-4'} text-center text-gray-500 text-xs`}>
        {compact ? 'No stocks in watchlist' : 'Search and click a stock to add to watchlist'}
      </div>
    );
  }

  // Compact mode for sidebar
  if (compact) {
    return (
      <div className="py-1">
        {stocks.map(stock => {
          const quote = quotes[stock.symbol] || {};
          const change = quote.changePercent || 0;
          const isPositive = change >= 0;
          
          return (
            <div 
              key={stock.symbol} 
              className="group flex items-center justify-between pl-3 pr-2 py-1 hover:bg-[#1A1A1A] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewChart) onViewChart(stock);
                  }}
                  className="text-gray-400 hover:text-blue-400 transition-colors"
                >
                  <span className="text-[11px] font-medium">{stock.symbol}</span>
                </button>
                <span className={`text-[10px] ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {loading[stock.symbol] ? '...' : `${isPositive ? '+' : ''}${change.toFixed(1)}%`}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(stock.symbol);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // Full mode
  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-2 px-2">
        <span className="text-xs text-gray-400 uppercase tracking-wider">Watchlist</span>
        <button onClick={refreshAll} className="text-xs text-blue-400 hover:text-blue-300">
          Refresh
        </button>
      </div>
      <div className="space-y-1">
        {stocks.map(stock => {
          const quote = quotes[stock.symbol] || {};
          return (
            <div 
              key={stock.symbol} 
              className="watchlist-item"
            >
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 group">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-400 font-semibold text-sm">{stock.symbol}</span>
                    {/* Chart Icon - click to view TradingView chart */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewChart) onViewChart(stock);
                      }}
                      className="text-gray-500 hover:text-blue-400 transition-colors p-0.5"
                      title="View TradingView chart"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2l3-8 4 16 3-8h6" />
                      </svg>
                    </button>
                    <span className="text-xs text-gray-500 truncate max-w-[80px]">{stock.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white text-sm font-medium">
                      {loading[stock.symbol] ? '...' : formatPrice(quote.price)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(stock.symbol);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
