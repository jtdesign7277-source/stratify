import React, { useEffect, useRef, useState } from 'react';

const SYMBOLS = [
  { label: 'AAPL',  tv: 'NASDAQ:AAPL' },
  { label: 'MSFT',  tv: 'NASDAQ:MSFT' },
  { label: 'GOOGL', tv: 'NASDAQ:GOOGL' },
  { label: 'AMZN',  tv: 'NASDAQ:AMZN' },
  { label: 'NVDA',  tv: 'NASDAQ:NVDA' },
  { label: 'META',  tv: 'NASDAQ:META' },
  { label: 'TSLA',  tv: 'NASDAQ:TSLA' },
  { label: 'SPY',   tv: 'AMEX:SPY' },
  { label: 'QQQ',   tv: 'NASDAQ:QQQ' },
  { label: 'BTC',   tv: 'COINBASE:BTCUSD' },
  { label: 'ETH',   tv: 'COINBASE:ETHUSD' },
  { label: 'SOL',   tv: 'COINBASE:SOLUSD' },
];

export default function AlpacaChart({ symbol = 'AAPL' }) {
  const containerRef = useRef(null);
  const [activeSymbol, setActiveSymbol] = useState(
    SYMBOLS.find(s => s.label === symbol)?.tv || 'NASDAQ:AAPL'
  );
  const [activeLabel, setActiveLabel] = useState(symbol);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: activeSymbol,
      interval: 'D',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(0, 0, 0, 1)',
      gridColor: 'rgba(30, 30, 30, 0.3)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: true,
      details: true,
      hotlist: false,
      show_popup_button: false,
      studies: ['STD;MACD'],
    });

    containerRef.current.appendChild(script);
  }, [activeSymbol]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#000', overflow: 'hidden',
    }}>
      {/* Symbol pills */}
      <div style={{
        display: 'flex', gap: '6px', padding: '10px 14px',
        borderBottom: '1px solid #111', flexShrink: 0,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {SYMBOLS.map((s) => (
          <button
            key={s.label}
            onClick={() => { setActiveSymbol(s.tv); setActiveLabel(s.label); }}
            style={{
              padding: '5px 12px', fontSize: '11px', fontWeight: 600,
              fontFamily: "'SF Mono', monospace", border: 'none',
              borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s ease', flexShrink: 0,
              background: activeLabel === s.label ? '#2962FF' : '#0a0a0a',
              color: activeLabel === s.label ? '#fff' : '#555',
            }}
          >
            ${s.label}
          </button>
        ))}
      </div>

      {/* TradingView Advanced Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </div>
  );
}
