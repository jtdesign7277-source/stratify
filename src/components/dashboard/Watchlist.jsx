import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';

// Google Finance style up/down arrow
const ChangeArrow = ({ positive }) => (
  <svg 
    className={`w-3 h-3 ${positive ? 'text-[#00C853]' : 'text-[#F44336]'}`} 
    viewBox="0 0 24 24" 
    fill="currentColor"
  >
    {positive ? (
      <path d="M7 14l5-5 5 5H7z" />
    ) : (
      <path d="M7 10l5 5 5-5H7z" />
    )}
  </svg>
);

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

  if (stocks.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-[#9AA0A6] text-xs">
        No stocks in watchlist
      </div>
    );
  }

  // Google Finance style - always compact in sidebar
  return (
    <div className="py-1">
      {stocks.map(stock => {
        const quote = quotes[stock.symbol] || {};
        const changePercent = quote.changePercent || 0;
        const isPositive = changePercent >= 0;
        
        return (
          <div 
            key={stock.symbol} 
            className="group flex items-center justify-between px-3 py-2 hover:bg-[#3c4043] cursor-pointer transition-colors"
            onClick={() => onViewChart && onViewChart(stock)}
          >
            {/* Left: Symbol */}
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium text-[#E8EAED]">
                {stock.symbol}
              </span>
            </div>
            
            {/* Right: Change percent with arrow */}
            <div className="flex items-center gap-0.5">
              {loading[stock.symbol] ? (
                <span className="text-[12px] text-[#9AA0A6]">...</span>
              ) : (
                <>
                  <span className={`text-[12px] font-medium ${isPositive ? 'text-[#00C853]' : 'text-[#F44336]'}`}>
                    {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                  </span>
                  <ChangeArrow positive={isPositive} />
                </>
              )}
            </div>

            {/* Remove button - shows on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(stock.symbol);
              }}
              className="opacity-0 group-hover:opacity-100 ml-2 text-[#9AA0A6] hover:text-[#F44336] transition-all p-0.5"
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
