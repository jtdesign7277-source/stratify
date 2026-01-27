import { useEffect, useRef } from 'react';

// TradingView Advanced Chart Widget - Full Featured
const TradingViewAdvancedChart = ({ symbol, theme = 'dark' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol,
      "interval": "D",
      "timezone": "America/New_York",
      "theme": theme,
      "style": "1",
      "locale": "en",
      "backgroundColor": "rgba(10, 10, 15, 1)",
      "gridColor": "rgba(255, 255, 255, 0.03)",
      "hide_top_toolbar": false,
      "hide_legend": false,
      "allow_symbol_change": true,
      "save_image": true,
      "calendar": true,
      "hide_volume": false,
      "support_host": "https://www.tradingview.com",
      "studies": [
        "STD;SMA"
      ],
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
      "withdateranges": true,
      "details": true,
      "hotlist": true
    });

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '100%';
    container.style.width = '100%';
    
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    
    container.appendChild(widgetDiv);
    container.appendChild(script);
    containerRef.current.appendChild(container);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol, theme]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
};

export default function StockDetailView({ symbol, stockName, onClose, themeClasses }) {
  const tvSymbol = `NASDAQ:${symbol}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0f]">
      {/* Minimal Header */}
      <div className="flex items-center px-4 py-2 border-b border-white/10">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm text-white">Back</span>
        </button>
      </div>

      {/* Full Screen Chart */}
      <div className="flex-1">
        <TradingViewAdvancedChart symbol={tvSymbol} theme="dark" />
      </div>
    </div>
  );
}
