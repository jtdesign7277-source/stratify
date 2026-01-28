import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';

// Mini sparkline chart component
const MiniChart = ({ positive, data = [] }) => {
  // Generate fake sparkline data if none provided
  const chartData = data.length > 0 ? data : Array.from({ length: 20 }, (_, i) => {
    const base = 50;
    const trend = positive ? i * 0.5 : -i * 0.3;
    const noise = (Math.random() - 0.5) * 15;
    return Math.max(10, Math.min(90, base + trend + noise));
  });

  const points = chartData.map((val, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - val;
    return `${x},${y}`;
  }).join(' ');

  const color = positive ? '#00C853' : '#F44336';
  const bgColor = positive ? 'rgba(0, 200, 83, 0.1)' : 'rgba(244, 67, 54, 0.1)';

  return (
    <svg viewBox="0 0 100 100" className="w-20 h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${positive ? 'up' : 'down'}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={bgColor} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#gradient-${positive ? 'up' : 'down'})`}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

// Up/down arrow
const ChangeArrow = ({ positive }) => (
  <svg 
    className={`w-3.5 h-3.5 ${positive ? 'text-[#00C853]' : 'text-[#F44336]'}`} 
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
    if (!price) return '--';
    if (price >= 1000) {
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
        
        return (
          <div 
            key={stock.symbol} 
            className="group flex items-center px-4 py-3 hover:bg-[#3c4043] cursor-pointer transition-colors border-b border-[#3c4043]/50 last:border-b-0"
            onClick={() => onViewChart && onViewChart(stock)}
          >
            {/* Left: Symbol and Company Name */}
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium text-[#E8EAED]">
                {stock.symbol}
              </div>
              <div className="text-[13px] text-[#9AA0A6] truncate">
                {companyName || stock.symbol}
              </div>
            </div>
            
            {/* Center: Mini Chart */}
            <div className="mx-3 flex-shrink-0">
              {loading[stock.symbol] ? (
                <div className="w-20 h-10 bg-[#3c4043] rounded animate-pulse" />
              ) : (
                <MiniChart positive={isPositive} />
              )}
            </div>
            
            {/* Right: Price and Change */}
            <div className="text-right flex-shrink-0 min-w-[80px]">
              {loading[stock.symbol] ? (
                <div className="text-[15px] text-[#9AA0A6]">...</div>
              ) : (
                <>
                  <div className="text-[15px] font-medium text-[#E8EAED]">
                    ${formatPrice(price)}
                  </div>
                  <div className="flex items-center justify-end gap-0.5">
                    <span className={`text-[13px] ${isPositive ? 'text-[#00C853]' : 'text-[#F44336]'}`}>
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                    <ChangeArrow positive={isPositive} />
                  </div>
                </>
              )}
            </div>

            {/* Remove button - shows on hover */}
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
        );
      })}
    </div>
  );
}
