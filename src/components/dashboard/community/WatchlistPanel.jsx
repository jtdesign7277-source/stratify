import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, ChevronDown, X } from 'lucide-react';

const DEFAULT_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
  'META', 'TSLA', 'SPY', 'QQQ', 'BTC/USD', 'ETH/USD',
];

const COMPANY_NAMES = {
  'AAPL':    'Apple Inc.',
  'MSFT':    'Microsoft Corporation',
  'GOOGL':   'Alphabet Inc.',
  'AMZN':    'Amazon.com Inc.',
  'NVDA':    'NVIDIA Corporation',
  'META':    'Meta Platforms',
  'TSLA':    'Tesla, Inc.',
  'SPY':     'SPDR S&P 500',
  'QQQ':     'Invesco QQQ Trust',
  'BTC/USD': 'Bitcoin',
  'ETH/USD': 'Ethereum',
};

const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const RECONNECT_DELAY_MS = 5000;

const resolveApiKey = () =>
  import.meta.env.VITE_TWELVEDATA_API_KEY
  || import.meta.env.VITE_TWELVE_DATA_API_KEY
  || import.meta.env.VITE_TWELVEDATA_APIKEY
  || '';

const formatPrice = (price) => {
  if (price === null || price === undefined) return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
};

const formatPercent = (pct) => {
  if (pct === null || pct === undefined) return null;
  const n = Number(pct);
  if (!Number.isFinite(n)) return null;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const navigateToTicker = (symbol) => {
  const base = String(symbol || '').split('/')[0].toUpperCase();
  window.location.href = `/dashboard?symbol=${encodeURIComponent(base)}`;
};

// Fetch previous close prices for all symbols from Twelve Data REST API
const fetchPreviousCloses = async (symbols, apiKey) => {
  if (!apiKey) return {};
  const results = {};
  // Batch REST symbols — crypto uses different format, skip for previous close
  const restSymbols = symbols.filter(s => !s.includes('/'));
  if (restSymbols.length === 0) return results;

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${restSymbols.join(',')}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return results;
    const data = await res.json();

    // When multiple symbols: data is an object keyed by symbol
    // When single symbol: data is the quote object directly
    const isMulti = restSymbols.length > 1;
    for (const sym of restSymbols) {
      const q = isMulti ? data[sym] : data;
      if (q && q.previous_close) {
        results[sym.toUpperCase()] = Number(q.previous_close);
      }
    }
  } catch {
    // silently ignore — % change just won't show until WS provides it
  }
  return results;
};

const WatchlistPanel = () => {
  const [open, setOpen] = useState(true);
  const [panelHeight, setPanelHeight] = useState(300);
  const [quotes, setQuotes] = useState({});
  const [prevCloses, setPrevCloses] = useState({});
  const [connected, setConnected] = useState(false);

  const panelRef = useRef(null);
  const isDragging = useRef(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // ── Fetch previous close on mount ──────────────────────────────────
  useEffect(() => {
    const apiKey = resolveApiKey();
    if (!apiKey) return;
    fetchPreviousCloses(DEFAULT_SYMBOLS, apiKey).then((closes) => {
      if (mountedRef.current) setPrevCloses(closes);
    });
  }, []);

  // ── Panel resize ───────────────────────────────────────────────────
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (moveEvent) => {
      if (!isDragging.current || !panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const newH = moveEvent.clientY - rect.top;
      setPanelHeight(Math.min(600, Math.max(150, newH)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // ── WebSocket connection ───────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    const apiKey = resolveApiKey();
    if (!apiKey) return;

    try {
      const ws = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        ws.send(JSON.stringify({
          action: 'subscribe',
          params: { symbols: DEFAULT_SYMBOLS.join(',') },
        }));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data?.event === 'price' && data?.symbol) {
            const sym = String(data.symbol).toUpperCase();
            const price = data.price !== undefined ? Number(data.price) : null;
            // Prefer WS-provided day change percent; fall back to calculating from prevClose
            const wsPercent = data.day_change_percent !== undefined
              ? Number(data.day_change_percent)
              : data.percent_change !== undefined
                ? Number(data.percent_change)
                : null;

            setQuotes((prev) => ({
              ...prev,
              [sym]: {
                price: Number.isFinite(price) ? price : prev[sym]?.price ?? null,
                wsPercent: Number.isFinite(wsPercent) ? wsPercent : prev[sym]?.wsPercent ?? null,
              },
            }));
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => { setConnected(false); };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      };
    } catch {
      reconnectTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) connect();
      }, RECONNECT_DELAY_MS);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close(1000, 'unmount');
        wsRef.current = null;
      }
    };
  }, [connect]);

  return (
    <div className="flex flex-col min-h-0 rounded-xl border border-white/6 bg-white/2 overflow-hidden">

      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-white/4 transition-colors flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-[#7d8590]" strokeWidth={1.5} />
          <div className="text-left">
            <div className="text-xs font-semibold text-[#e6edf3] leading-tight">WATCHLIST</div>
            <div className="text-[10px] text-[#7d8590] leading-tight flex items-center gap-1">
              {connected ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  Live prices
                </>
              ) : (
                'Connecting...'
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#7d8590] transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          strokeWidth={1.5}
        />
      </button>

      {/* ── Body ── */}
      {open && (
        <>
          <div
            ref={panelRef}
            className="overflow-y-auto"
            style={{ height: panelHeight + 'px' }}
          >
            {DEFAULT_SYMBOLS.map((symbol) => {
              const key = symbol.toUpperCase();
              const quote = quotes[key] || {};
              const price = quote.price ?? null;

              // % change: prefer WS-provided, otherwise calculate from prevClose
              let pct = quote.wsPercent ?? null;
              if (pct === null && price !== null && prevCloses[key]) {
                const prev = prevCloses[key];
                pct = ((price - prev) / prev) * 100;
              }

              const pctText = formatPercent(pct);
              const isPositive = pct !== null && pct >= 0;

              const companyName = COMPANY_NAMES[symbol] || '';

              return (
                <div
                  key={symbol}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToTicker(symbol)}
                  onKeyDown={(e) => e.key === 'Enter' && navigateToTicker(symbol)}
                  className="group w-full grid grid-cols-[1fr_auto_auto] items-center gap-2 py-3 px-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  {/* LEFT: symbol + company name */}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#e6edf3] leading-tight">
                      ${symbol}
                    </div>
                    {companyName && (
                      <div className="text-xs text-[#7d8590] truncate leading-tight mt-0.5">
                        {companyName}
                      </div>
                    )}
                  </div>

                  {/* CENTER: price */}
                  <div className="text-right">
                    <span className="text-sm font-mono font-medium text-[#e6edf3]">
                      {price !== null ? `$${formatPrice(price)}` : '—'}
                    </span>
                  </div>

                  {/* RIGHT: % change */}
                  <div className="text-right min-w-[52px]">
                    {pctText ? (
                      <span className={`text-xs font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {pctText}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-[#7d8590]">—</span>
                    )}
                    {/* Subtle remove button — only on hover */}
                    <X
                      size={10}
                      strokeWidth={2}
                      className="hidden"
                      aria-hidden
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Drag handle ── */}
          <div
            onMouseDown={handleResizeStart}
            className="h-1.5 w-full cursor-row-resize group flex-shrink-0"
          >
            <div className="w-10 h-1 rounded-full bg-white/10 group-hover:bg-[#58a6ff]/50 mx-auto transition-colors mt-px" />
          </div>
        </>
      )}
    </div>
  );
};

export default WatchlistPanel;
