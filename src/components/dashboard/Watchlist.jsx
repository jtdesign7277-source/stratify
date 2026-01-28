import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';

// Up/down arrow
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
    const interval = setInterval(() => {
      stocks.forEach(stock => fetchQuote(stock.symbol));
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, fetchQuote]);

  const formatPrice = (price) => {
    if (!price && price !== 0) return '--';
    if (price >= 10000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  };

  if (stocks.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[#9AA0A6] text-sm">
        No stocks in watchlist
      </div>
    );
  }

  return (
    <div className="py-2">
      {stocks.map(stock => {
        const quote = quotes[stock.symbol] || {};
        const price = quote.price || 0;
        const changePercent = quote.changePercent || 0;
        const isPositive = changePercent >= 0;
        const companyName = quote.name || stock.name || '';
        const marketState = quote.marketState || 'REGULAR';
        
        // Extended hours data
        const hasAfterHours = (marketState === 'POST' || marketState === 'CLOSED') && quote.postMarketPrice;
        const hasPreMarket = marketState === 'PRE' && quote.preMarketPrice;
        
        const extendedPrice = hasAfterHours ? quote.postMarketPrice : hasPreMarket ? quote.preMarketPrice : null;
        const extendedChange = hasAfterHours ? quote.postMarketChangePercent : hasPreMarket ? quote.preMarketChangePercent : null;
        const isExtendedPositive = extendedChange >= 0;
        
        return (
          <div 
            key={stock.symbol} 
            className="group px-4 py-3 hover:bg-[#3c4043] cursor-pointer transition-colors border-b border-[#3c4043]/50 last:border-b-0"
            onClick={() => onViewChart && onViewChart(stock)}
          >
            {/* Row 1: Symbol, Company Name, Price, Change */}
            <div className="flex items-center justify-between">
              {/* Left: Symbol and Company Name */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium text-[#E8EAED]">
                  {stock.symbol}
                </div>
                <div className="text-[12px] text-[#9AA0A6] truncate">
                  {companyName}
                </div>
              </div>
              
              {/* Right: Price and Change - side by side like after hours */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {loading[stock.symbol] ? (
                  <div className="text-[14px] text-[#9AA0A6]">...</div>
                ) : (
                  <>
                    <span className="text-[15px] font-medium text-[#E8EAED]">
                      ${formatPrice(price)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <span className={`text-[13px] ${isPositive ? 'text-[#00C853]' : 'text-[#F44336]'}`}>
                        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                      </span>
                      <ChangeArrow positive={isPositive} />
                    </div>
                  </>
                )}
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(stock.symbol);
                }}
                className="opacity-0 group-hover:opacity-100 ml-3 text-[#9AA0A6] hover:text-[#F44336] transition-all p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Row 2: After Hours / Pre-Market (if applicable) */}
            {(hasAfterHours || hasPreMarket) && !loading[stock.symbol] && (
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#3c4043]/30">
                <div className="text-[11px] text-[#9AA0A6]">
                  {hasAfterHours ? 'After hours' : 'Pre-market'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[#E8EAED]">
                    ${formatPrice(extendedPrice)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <span className={`text-[12px] ${isExtendedPositive ? 'text-[#00C853]' : 'text-[#F44336]'}`}>
                      {isExtendedPositive ? '+' : ''}{extendedChange?.toFixed(2)}%
                    </span>
                    <ChangeArrow positive={isExtendedPositive} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
