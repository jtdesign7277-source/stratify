import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../config';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
};

const formatLargeNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return formatCurrency(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// TradingView Advanced Chart Widget
const TradingViewChart = ({ symbol, theme = 'dark' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    // Create widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    widgetContainer.appendChild(widgetDiv);

    containerRef.current.appendChild(widgetContainer);

    // Load TradingView script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": `NASDAQ:${symbol}`,
      "interval": "D",
      "timezone": "America/New_York",
      "theme": theme,
      "style": "3",
      "locale": "en",
      "backgroundColor": theme === 'dark' ? "rgba(13, 13, 13, 1)" : "rgba(255, 255, 255, 1)",
      "gridColor": "rgba(0, 0, 0, 0)",
      "hide_top_toolbar": false,
      "hide_legend": false,
      "allow_symbol_change": true,
      "save_image": true,
      "calendar": false,
      "hide_volume": true,
      "support_host": "https://www.tradingview.com",
      "studies": []
    });

    widgetContainer.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, theme]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
  );
};

export default function StockDetailView({ symbol, stockName, onClose, themeClasses }) {
  const [quote, setQuote] = useState(null);
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const [activeTab, setActiveTab] = useState('overview');

  const timeframes = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'All'];

  useEffect(() => {
    fetchData();
  }, [symbol, activeTimeframe]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch quote
      const quoteRes = await fetch(`${API_URL}/api/public/quote/${symbol}`);
      const quoteData = await quoteRes.json();
      setQuote(quoteData);

      // Generate mock historical data (in production, fetch from Alpaca bars endpoint)
      const mockBars = generateMockBars(quoteData.price || 100, activeTimeframe);
      setBars(mockBars);
    } catch (err) {
      console.error('Error fetching stock data:', err);
    }
    setLoading(false);
  };

  // Generate mock price data based on timeframe
  const generateMockBars = (currentPrice, timeframe) => {
    const points = {
      '1D': 78,
      '1W': 7 * 78,
      '1M': 30,
      '3M': 90,
      'YTD': 180,
      '1Y': 252,
      'All': 1000
    }[timeframe] || 30;

    const volatility = 0.02;
    const data = [];
    let price = currentPrice * (0.7 + Math.random() * 0.3);
    
    for (let i = 0; i < points; i++) {
      price = price * (1 + (Math.random() - 0.48) * volatility);
      data.push({ close: price });
    }
    
    // Ensure last price matches current
    data[data.length - 1].close = currentPrice;
    return data;
  };

  const priceChange = quote ? (quote.price - (bars[0]?.close || quote.price)) : 0;
  const priceChangePercent = quote && bars[0]?.close ? ((quote.price - bars[0].close) / bars[0].close) * 100 : 0;
  const isPositive = priceChange >= 0;

  // Mock fundamental data (in production, fetch from API)
  const fundamentals = {
    marketCap: quote?.price ? quote.price * 1e9 * (Math.random() * 2 + 0.5) : null,
    peRatio: 20 + Math.random() * 100,
    eps: 2 + Math.random() * 5,
    volume: Math.floor(Math.random() * 100e6),
    avgVolume: Math.floor(Math.random() * 80e6),
    high52w: quote?.price ? quote.price * 1.3 : null,
    low52w: quote?.price ? quote.price * 0.6 : null,
    dividend: Math.random() > 0.5 ? (Math.random() * 3).toFixed(2) + '%' : 'N/A',
    beta: (0.8 + Math.random() * 1.5).toFixed(2),
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${themeClasses.bg}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${themeClasses.border} ${themeClasses.surfaceElevated}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-[#2A2A2A] ${themeClasses.textMuted}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold">
              {symbol?.charAt(0)}
            </div>
            <div>
              <h1 className={`text-xl font-semibold ${themeClasses.text}`}>{symbol}</h1>
              <p className={`text-sm ${themeClasses.textMuted}`}>{stockName || 'Loading...'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className={`px-4 py-2 rounded-lg border ${themeClasses.border} ${themeClasses.textMuted} hover:bg-[#2A2A2A]`}>
            + Add to Watchlist
          </button>
          <button className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
            Trade
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          {/* Price Section */}
          <div className="mb-8">
            <div className="flex items-baseline gap-4 mb-2">
              <span className={`text-4xl font-bold ${themeClasses.text}`}>
                {formatCurrency(quote?.price)}
              </span>
              <span className={`text-lg font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(priceChange)} ({formatPercent(priceChangePercent)})
              </span>
            </div>
            <p className={`text-sm ${themeClasses.textMuted}`}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* TradingView Chart */}
          <div className={`rounded-xl border ${themeClasses.border} ${themeClasses.surface} mb-8 overflow-hidden`}>
            <div className="h-[500px]">
              <TradingViewChart 
                symbol={symbol}
                theme="dark"
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Market Cap', value: formatLargeNumber(fundamentals.marketCap) },
              { label: 'P/E Ratio', value: fundamentals.peRatio?.toFixed(2) },
              { label: 'EPS (TTM)', value: `$${fundamentals.eps?.toFixed(2)}` },
              { label: 'Volume', value: `${(fundamentals.volume / 1e6).toFixed(1)}M` },
              { label: 'Avg Volume', value: `${(fundamentals.avgVolume / 1e6).toFixed(1)}M` },
              { label: '52W High', value: formatCurrency(fundamentals.high52w) },
              { label: '52W Low', value: formatCurrency(fundamentals.low52w) },
              { label: 'Dividend Yield', value: fundamentals.dividend },
              { label: 'Beta', value: fundamentals.beta },
              { label: 'Bid/Ask', value: quote ? `${formatCurrency(quote.bid)} / ${formatCurrency(quote.ask)}` : '--' },
            ].map((stat, i) => (
              <div 
                key={i}
                className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.surface}`}
              >
                <p className={`text-xs ${themeClasses.textMuted} mb-1`}>{stat.label}</p>
                <p className={`text-lg font-semibold ${themeClasses.text}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className={`border-b ${themeClasses.border} mb-6`}>
            <div className="flex gap-6">
              {['Overview', 'Fundamentals', 'News', 'Financials'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.toLowerCase()
                      ? `${themeClasses.text} border-emerald-500`
                      : `${themeClasses.textMuted} border-transparent hover:${themeClasses.text}`
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className={`rounded-xl border ${themeClasses.border} ${themeClasses.surface} p-6`}>
            {activeTab === 'overview' && (
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${themeClasses.text}`}>About {symbol}</h3>
                <p className={`${themeClasses.textMuted} leading-relaxed`}>
                  {stockName || symbol} is a publicly traded company. View fundamentals, financials, and news 
                  to learn more about this stock and make informed trading decisions.
                </p>
                
                <h3 className={`text-lg font-semibold mt-8 mb-4 ${themeClasses.text}`}>Key Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between py-2 border-b border-[#2A2A2A]">
                    <span className={themeClasses.textMuted}>Previous Close</span>
                    <span className={themeClasses.text}>{formatCurrency(quote?.price ? quote.price * 0.99 : null)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#2A2A2A]">
                    <span className={themeClasses.textMuted}>Open</span>
                    <span className={themeClasses.text}>{formatCurrency(quote?.price ? quote.price * 0.998 : null)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#2A2A2A]">
                    <span className={themeClasses.textMuted}>Day Range</span>
                    <span className={themeClasses.text}>
                      {formatCurrency(quote?.price ? quote.price * 0.97 : null)} - {formatCurrency(quote?.price ? quote.price * 1.02 : null)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#2A2A2A]">
                    <span className={themeClasses.textMuted}>52 Week Range</span>
                    <span className={themeClasses.text}>
                      {formatCurrency(fundamentals.low52w)} - {formatCurrency(fundamentals.high52w)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'fundamentals' && (
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${themeClasses.text}`}>Fundamentals</h3>
                <p className={`${themeClasses.textMuted}`}>
                  Detailed fundamental analysis coming soon...
                </p>
              </div>
            )}
            
            {activeTab === 'news' && (
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${themeClasses.text}`}>Latest News</h3>
                <p className={`${themeClasses.textMuted}`}>
                  News feed coming soon...
                </p>
              </div>
            )}
            
            {activeTab === 'financials' && (
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${themeClasses.text}`}>Financials</h3>
                <p className={`${themeClasses.textMuted}`}>
                  Financial statements coming soon...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
