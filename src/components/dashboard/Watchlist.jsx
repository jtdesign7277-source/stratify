import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';

// Google Finance style up/down arrow
const ChangeArrow = ({ positive, small = false }) => (
  <svg 
    className={`${small ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${positive ? 'text-[#00C853]' : 'text-[#F44336]'}`} 
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

// Moon icon for after hours
const MoonIcon = () => (
  <svg className="w-2.5 h-2.5 text-[#9AA0A6]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
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
    const interval = setInterval(() => {
      stocks.forEach(stock => fetchQuote(stock.symbol));
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, fetchQuote]);

  if (stocks.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-[#9AA0A6] text-xs">
        No stocks in watchlist
      </div>
    );
  }

  return (
    <div className="py-1">
      {stocks.map(stock => {
        const quote = quotes[stock.symbol] || {};
        const marketState = quote.marketState || 'REGULAR';
        const regularChange = quote.changePercent || 0;
        const isRegularPositive = regularChange >= 0;
        
        // Extended hours data
        const hasAfterHours = marketState === 'POST' && quote.postMarketChangePercent != null;
        const hasPreMarket = marketState === 'PRE' && quote.preMarketChangePercent != null;
        const extendedChange = hasAfterHours ? quote.postMarketChangePercent : 
                               hasPreMarket ? quote.preMarketChangePercent : null;
        const isExtendedPositive = extendedChange >= 0;
        
        return (
          <div 
            key={stock.symbol} 
            className="group px-3 py-2 hover:bg-[#3c4043] cursor-pointer transition-colors"
            onClick={() => onViewChart && onViewChart(stock)}
          >
            {/* Row 1: Symbol and regular change */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#E8EAED]">
                {stock.symbol}
              </span>
              
              <div className="flex items-center gap-2">
                {loading[stock.symbol] ? (
                  <span className="text-[11px] text-[#9AA0A6]">...</span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <span className={`text-[11px] font-medium ${isRegularPositive ? 'text-[#00C853]' : 'text-[#F44336]'}`}>
                      {isRegularPositive ? '+' : ''}{regularChange.toFixed(2)}%
                    </span>
                    <ChangeArrow positive={isRegularPositive} small />
                  </div>
                )}
                
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(stock.symbol);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[#9AA0A6] hover:text-[#F44336] transition-all p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Row 2: Extended hours (if applicable) */}
            {(hasAfterHours || hasPreMarket) && !loading[stock.symbol] && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <MoonIcon />
                <span className={`text-[10px] font-medium ${isExtendedPositive ? 'text-[#00C853]' : 'text-[#F44336]'}`}>
                  {isExtendedPositive ? '+' : ''}{extendedChange.toFixed(2)}%
                </span>
                <ChangeArrow positive={isExtendedPositive} small />
                <span className="text-[9px] text-[#9AA0A6] ml-0.5">
                  {hasAfterHours ? 'AH' : 'PM'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
