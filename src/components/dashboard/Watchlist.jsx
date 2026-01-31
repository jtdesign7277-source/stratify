import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';

// Trend arrows - diagonal style like Grok
const TrendArrowUp = () => (
  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7V17" />
  </svg>
);

const TrendArrowDown = () => (
  <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 7L7 17M7 17H17M7 17V7" />
  </svg>
);

// Format large numbers with K/M/B suffixes
const formatVolume = (num) => {
  if (!num) return '--';
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
    const interval = setInterval(() => {
      stocks.forEach(stock => fetchQuote(stock.symbol));
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, fetchQuote]);

  const formatPrice = (price) => {
    if (!price && price !== 0) return '--';
    return price.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatChange = (change) => {
    if (!change && change !== 0) return '--';
    const prefix = change >= 0 ? '+' : '';
    return prefix + change.toFixed(2);
  };

  if (stocks.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-zinc-500 text-sm">
        No stocks in watchlist
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {stocks.map(stock => {
        const quote = quotes[stock.symbol] || {};
        const isLoading = loading[stock.symbol];
        const hasData = quote.price !== undefined;
        
        const price = quote.price || 0;
        const change = quote.change || 0;
        const changePercent = quote.changePercent || 0;
        const isPositive = changePercent >= 0;
        const companyName = quote.name || stock.name || '';
        const volume = quote.volume || 0;
        
        return (
          <div 
            key={stock.symbol} 
            className="group rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4 hover:border-zinc-600/70 hover:bg-zinc-800/70 cursor-pointer transition-all duration-200"
            onClick={() => onViewChart && onViewChart(stock)}
          >
            {/* Main content - two columns */}
            <div className="flex items-start justify-between gap-4">
              {/* Left column: Symbol, Company, Volume */}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-white">
                  {stock.symbol}
                </div>
                <div className="text-sm text-zinc-400 truncate mt-0.5">
                  {companyName || stock.symbol}
                </div>
                {hasData && (
                  <div className="text-sm text-zinc-500 mt-2">
                    Vol: {formatVolume(volume)}
                  </div>
                )}
              </div>
              
              {/* Right column: Price, Change, Action */}
              <div className="flex flex-col items-end flex-shrink-0">
                {isLoading && !hasData ? (
                  <div className="w-5 h-5 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
                ) : hasData ? (
                  <>
                    {/* Price */}
                    <div className="text-lg font-semibold text-white">
                      ${formatPrice(price)}
                    </div>
                    
                    {/* Change with arrow */}
                    <div className={`flex items-center gap-1 mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendArrowUp /> : <TrendArrowDown />}
                      <span className="text-sm font-medium">
                        {formatChange(change)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-zinc-500">—</span>
                )}
                
                {/* Remove from Watchlist link */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(stock.symbol);
                  }}
                  className="mt-3 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  − Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
