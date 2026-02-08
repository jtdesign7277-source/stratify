import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

const TickerPill = ({ symbol, onRemove }) => {
  const [price, setPrice] = useState(null);
  const [change, setChange] = useState(null);
  const [changePercent, setChangePercent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchPrice = async () => {
      try {
        const response = await fetch(`https://stratify-backend-production-3ebd.up.railway.app/api/public/quote/${symbol}`);
        const data = await response.json();
        if (isMounted && data) {
          setPrice(data.price || data.regularMarketPrice);
          setChange(data.change || data.regularMarketChange);
          setChangePercent(data.changePercent || data.regularMarketChangePercent);
          setLoading(false);
        }
      } catch (err) {
        console.error('Price fetch error:', err);
        setLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000); // Update every 10 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  const isPositive = change >= 0;
  const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
  const bgClass = isPositive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30';

  return (
    <div className={`h-8 px-3 rounded-full flex items-center gap-2 border ${bgClass} group cursor-default`}>
      <span className="text-xs font-semibold text-white">{symbol}</span>
      {loading ? (
        <span className="text-xs text-gray-400">...</span>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-white">${price?.toFixed(2)}</span>
          <span className={`text-[10px] font-mono ${colorClass} flex items-center`}>
            {isPositive ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
            {isPositive ? '+' : ''}{changePercent?.toFixed(2)}%
          </span>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded-full transition-opacity"
      >
        <X className="w-3 h-3 text-gray-400 hover:text-white" />
      </button>
    </div>
  );
};

export default TickerPill;
