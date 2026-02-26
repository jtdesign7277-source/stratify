import { useEffect, useRef, useState } from 'react';

const HOVER_DELAY = 300; // ms before showing
const HIDE_DELAY = 200; // ms before hiding

export default function TickerHoverCard({ symbol, children, className = '' }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const widgetRef = useRef(null);

  const cleanSymbol = String(symbol || '').replace(/^\$/, '').toUpperCase();

  const show = () => {
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 6,
          left: Math.max(8, rect.left - 60),
        });
      }
      setVisible(true);
    }, HOVER_DELAY);
  };

  const hide = () => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY);
  };

  const cancelHide = () => {
    clearTimeout(hideTimer.current);
  };

  useEffect(() => {
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, []);

  // Load TradingView widget when visible
  useEffect(() => {
    if (!visible || !widgetRef.current || !cleanSymbol) return;

    // Clear previous widget
    widgetRef.current.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: cleanSymbol,
      width: '100%',
      height: '100%',
      locale: 'en',
      dateRange: '1M',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
      noTimeScale: false,
      chartOnly: false,
    });

    container.appendChild(script);
    widgetRef.current.appendChild(container);
  }, [visible, cleanSymbol]);

  if (!cleanSymbol) return children;

  return (
    <span
      ref={triggerRef}
      className={`inline-block ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {visible && (
        <div
          ref={cardRef}
          onMouseEnter={cancelHide}
          onMouseLeave={hide}
          className="fixed z-[9999] rounded-xl border border-blue-500/30 bg-[#0a1020] shadow-2xl shadow-blue-500/10 overflow-hidden"
          style={{
            top: position.top,
            left: position.left,
            width: 320,
            height: 220,
          }}
        >
          <div ref={widgetRef} className="w-full h-full" />
        </div>
      )}
    </span>
  );
}
