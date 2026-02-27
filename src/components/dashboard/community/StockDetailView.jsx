import React, { useEffect, useRef, memo } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { T } from './communityConstants';

// Map watchlist symbols to TradingView exchange-qualified format
function toTvSymbol(ticker) {
  if (!ticker) return ticker;
  const upper = ticker.toUpperCase();
  if (upper === 'BTC/USD') return 'COINBASE:BTCUSD';
  if (upper === 'ETH/USD') return 'COINBASE:ETHUSD';
  if (upper === 'SOL/USD') return 'COINBASE:SOLUSD';
  if (['SPY', 'QQQ', 'DIA', 'IWM', 'GLD', 'SLV'].includes(upper)) return `AMEX:${upper}`;
  // Major US stocks auto-resolve on TradingView without exchange prefix
  return upper;
}

// ── Advanced Chart widget ────────────────────────────────────────────
const TvAdvancedChart = memo(({ tvSymbol }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    el.appendChild(widgetDiv);

    // Hidden copyright — satisfies TradingView ToS without consuming vertical space
    const copyright = document.createElement('div');
    copyright.className = 'tradingview-widget-copyright';
    copyright.style.display = 'none';
    copyright.innerHTML =
      '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">' +
      'Track all markets on TradingView</a>';
    el.appendChild(copyright);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#0d1117',
      gridColor: 'rgba(242,242,242,0.06)',
      allow_symbol_change: false,
      calendar: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: true,
      withdateranges: true,
      hotlist: false,
      studies: [],
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(script);

    return () => { el.innerHTML = ''; };
  }, [tvSymbol]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: '100%', width: '100%', display: 'block' }}
    />
  );
});
TvAdvancedChart.displayName = 'TvAdvancedChart';

// ── Symbol Info widget ───────────────────────────────────────────────
const TvSymbolInfo = memo(({ tvSymbol }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    el.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      width: '100%',
      locale: 'en',
      colorTheme: 'dark',
      isTransparent: true,
    });
    el.appendChild(script);

    return () => { el.innerHTML = ''; };
  }, [tvSymbol]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: '100%' }}
    />
  );
});
TvSymbolInfo.displayName = 'TvSymbolInfo';

// ── Main StockDetailView ─────────────────────────────────────────────
export default function StockDetailView({ ticker, onBack }) {
  const tvSymbol = toTvSymbol(ticker);
  const tvUrl = `https://www.tradingview.com/symbols/${tvSymbol.replace(':', '-')}/`;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        {/* Left: Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 cursor-pointer"
          style={{ color: T.muted }}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back
        </button>

        {/* Center: ticker */}
        <span className="text-lg font-bold" style={{ color: T.text }}>
          ${ticker}
        </span>

        {/* Right: Open in TradingView */}
        <a
          href={tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm transition-colors hover:text-[#58a6ff]"
          style={{ color: T.muted }}
        >
          <ExternalLink size={14} strokeWidth={1.5} />
          Open in TradingView
        </a>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Unified card: one rounded-2xl wrapper clips all corners */}
        <div
          className="mx-3 mt-3 mb-6 rounded-2xl overflow-hidden border"
          style={{ borderColor: T.border, backgroundColor: T.bg }}
        >
          {/* Symbol info strip — no individual rounding */}
          <div className="border-b" style={{ borderColor: T.border }}>
            <TvSymbolInfo tvSymbol={tvSymbol} />
          </div>

          {/* Advanced chart — fills the unified card, rounded corners come from parent */}
          <div style={{ height: '620px', width: '100%' }}>
            <TvAdvancedChart tvSymbol={tvSymbol} />
          </div>
          {/* Bottom breathing room */}
          <div style={{ height: 8 }} />
        </div>
      </div>
    </div>
  );
}
