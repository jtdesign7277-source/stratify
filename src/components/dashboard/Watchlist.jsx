import { useState, useEffect } from 'react';
import { API_URL } from '../../config';

export default function Watchlist({ stocks, onRemove, onViewChart, themeClasses }) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState({});
  const [hoveredStock, setHoveredStock] = useState(null);
  const [showPopup, setShowPopup] = useState(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showPopup && !e.target.closest('.watchlist-item')) {
        setShowPopup(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showPopup]);

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

  const handleStockClick = (stock) => {
    if (showPopup === stock.symbol) {
      setShowPopup(null);
    } else {
      setShowPopup(stock.symbol);
    }
  };

  const handleViewChart = (stock) => {
    setShowPopup(null);
    if (onViewChart) {
      onViewChart(stock);
    }
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
          return (
            <div 
              key={stock.symbol} 
              className="relative watchlist-item"
            >
              <div 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 group cursor-pointer"
                onClick={() => handleStockClick(stock)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold text-sm">{stock.symbol}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[100px]">{stock.name}</span>
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

              {/* View Chart Popup */}
              {showPopup === stock.symbol && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 px-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewChart(stock);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 rounded-lg border border-emerald-500/50 shadow-lg hover:bg-emerald-500/30 transition-colors"
                  >
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <span className="text-sm font-semibold text-emerald-400">View Chart</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
