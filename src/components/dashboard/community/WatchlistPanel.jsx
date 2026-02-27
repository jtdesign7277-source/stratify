import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, ChevronDown, X, Search, Loader2 } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'stratify_community_watchlist';

const DEFAULT_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
  'META', 'TSLA', 'SPY', 'QQQ', 'BTC/USD', 'ETH/USD',
];

const SEED_COMPANY_NAMES = {
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
const DEBOUNCE_MS = 300;

// ── Helpers ──────────────────────────────────────────────────────────────────

const resolveApiKey = () =>
  import.meta.env.VITE_TWELVEDATA_API_KEY
  || import.meta.env.VITE_TWELVE_DATA_API_KEY
  || import.meta.env.VITE_TWELVEDATA_APIKEY
  || '';

const loadWatchlist = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_SYMBOLS];
};

const saveWatchlist = (symbols) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(symbols)); } catch { /* ignore */ }
};

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
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const navigateToTicker = (symbol) => {
  const base = String(symbol || '').split('/')[0].toUpperCase();
  window.location.href = `/dashboard?symbol=${encodeURIComponent(base)}`;
};

const fetchPreviousCloses = async (symbols, apiKey) => {
  if (!apiKey) return {};
  const restSymbols = symbols.filter(s => !s.includes('/'));
  if (restSymbols.length === 0) return {};
  const results = {};
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${restSymbols.join(',')}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return results;
    const data = await res.json();
    const isMulti = restSymbols.length > 1;
    for (const sym of restSymbols) {
      const q = isMulti ? data[sym] : data;
      if (q?.previous_close) results[sym.toUpperCase()] = Number(q.previous_close);
    }
  } catch { /* ignore */ }
  return results;
};

// ── Search dropdown ──────────────────────────────────────────────────────────

function TickerSearchDropdown({ query, currentSymbols, onSelect }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const apiKey = resolveApiKey();
      if (!apiKey) return;
      setLoading(true);
      try {
        const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query.trim())}&outputsize=8&apikey=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        const hits = Array.isArray(data?.data) ? data.data : [];
        // Filter out already-watched symbols
        const watchSet = new Set(currentSymbols.map(s => s.toUpperCase()));
        setResults(hits.filter(h => !watchSet.has(String(h.symbol || '').toUpperCase())));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query, currentSymbols]);

  if (!query.trim()) return null;

  return (
    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#161b22] border border-white/10 rounded-lg shadow-xl max-h-[240px] overflow-y-auto">
      {loading && (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={14} strokeWidth={1.5} className="text-[#7d8590] animate-spin" />
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="text-[#7d8590] text-xs text-center py-3">No results</div>
      )}
      {!loading && results.map((hit) => (
        <button
          key={`${hit.symbol}-${hit.exchange}`}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(hit); }}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer text-left transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-[#e6edf3] flex-shrink-0">{hit.symbol}</span>
            <span className="text-xs text-[#7d8590] truncate">{hit.instrument_name}</span>
          </div>
          <span className="text-xs text-[#7d8590] flex-shrink-0 ml-2">{hit.exchange}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const WatchlistPanel = () => {
  const [open, setOpen] = useState(true);
  const [panelHeight, setPanelHeight] = useState(300);
  const [symbols, setSymbols] = useState(loadWatchlist);
  const [companyNames, setCompanyNames] = useState({ ...SEED_COMPANY_NAMES });
  const [quotes, setQuotes] = useState({});
  const [prevCloses, setPrevCloses] = useState({});
  const [connected, setConnected] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);

  const panelRef = useRef(null);
  const isDragging = useRef(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // ── Persist watchlist ─────────────────────────────────────────────────────
  useEffect(() => { saveWatchlist(symbols); }, [symbols]);

  // ── Fetch previous closes when symbols change ─────────────────────────────
  useEffect(() => {
    const apiKey = resolveApiKey();
    if (!apiKey) return;
    fetchPreviousCloses(symbols, apiKey).then((closes) => {
      if (mountedRef.current) setPrevCloses((prev) => ({ ...prev, ...closes }));
    });
  }, [symbols]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── Panel resize ──────────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    const onMouseMove = (me) => {
      if (!isDragging.current || !panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      setPanelHeight(Math.min(600, Math.max(150, me.clientY - rect.top)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // ── WebSocket helpers ─────────────────────────────────────────────────────
  const wsSend = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

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
        // Subscribe to current watchlist on (re)connect
        ws.send(JSON.stringify({
          action: 'subscribe',
          params: { symbols: loadWatchlist().join(',') },
        }));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data?.event === 'price' && data?.symbol) {
            const sym = String(data.symbol).toUpperCase();
            const price = data.price !== undefined ? Number(data.price) : null;
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
        } catch { /* ignore */ }
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

  // ── Add ticker ────────────────────────────────────────────────────────────
  const handleSelectResult = useCallback((hit) => {
    const sym = String(hit.symbol || '').toUpperCase();
    if (!sym) return;
    setSymbols((prev) => {
      if (prev.includes(sym)) return prev;
      return [...prev, sym];
    });
    // Store company name for the new ticker
    if (hit.instrument_name) {
      setCompanyNames((prev) => ({ ...prev, [sym]: hit.instrument_name }));
    }
    // Subscribe on WS
    wsSend({ action: 'subscribe', params: { symbols: sym } });
    // Clear search
    setSearchQuery('');
    setSearchFocused(false);
  }, [wsSend]);

  // ── Remove ticker ─────────────────────────────────────────────────────────
  const handleRemove = useCallback((sym, e) => {
    e.stopPropagation();
    setSymbols((prev) => prev.filter(s => s !== sym));
    wsSend({ action: 'unsubscribe', params: { symbols: sym } });
  }, [wsSend]);

  // ── Render ────────────────────────────────────────────────────────────────
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
              ) : 'Connecting...'}
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
          {/* ── Search bar ── */}
          <div ref={searchWrapRef} className="relative px-2 pb-1.5 pt-1 flex-shrink-0">
            <div className={`flex items-center gap-2 bg-white/5 border rounded-lg px-3 py-2 transition-all ${
              searchFocused
                ? 'border-[#58a6ff]/50 ring-1 ring-[#58a6ff]/30'
                : 'border-white/10'
            }`}>
              <Search size={14} strokeWidth={1.5} className="text-[#7d8590] flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchFocused(false); setSearchQuery(''); } }}
                placeholder="Add ticker..."
                className="w-full bg-transparent text-sm text-[#e6edf3] placeholder-[#7d8590] outline-none min-w-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setSearchQuery(''); }}
                  className="flex-shrink-0 text-[#7d8590] hover:text-[#e6edf3] transition-colors"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {searchFocused && searchQuery.trim() && (
              <TickerSearchDropdown
                query={searchQuery}
                currentSymbols={symbols}
                onSelect={handleSelectResult}
              />
            )}
          </div>

          {/* ── Ticker list ── */}
          <div
            ref={panelRef}
            className="overflow-y-auto flex-1"
            style={{ height: panelHeight + 'px' }}
          >
            {symbols.map((symbol) => {
              const key = symbol.toUpperCase();
              const quote = quotes[key] || {};
              const price = quote.price ?? null;

              let pct = quote.wsPercent ?? null;
              if (pct === null && price !== null && prevCloses[key]) {
                pct = ((price - prevCloses[key]) / prevCloses[key]) * 100;
              }

              const pctText = formatPercent(pct);
              const isPositive = pct !== null && pct >= 0;
              const name = companyNames[symbol] || companyNames[key] || '';

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
                    <div className="text-sm font-bold text-[#e6edf3] leading-tight">${symbol}</div>
                    {name && (
                      <div className="text-xs text-[#7d8590] truncate leading-tight mt-0.5">{name}</div>
                    )}
                  </div>

                  {/* CENTER: price */}
                  <div className="text-right">
                    <span className="text-sm font-mono font-medium text-[#e6edf3]">
                      {price !== null ? `$${formatPrice(price)}` : '—'}
                    </span>
                  </div>

                  {/* RIGHT: % change + remove button */}
                  <div className="flex flex-col items-end min-w-[52px] relative">
                    {pctText ? (
                      <span className={`text-xs font-mono group-hover:opacity-0 transition-opacity ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {pctText}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-[#7d8590] group-hover:opacity-0 transition-opacity">—</span>
                    )}
                    {/* Remove (X) — overlays the % change on row hover */}
                    <button
                      type="button"
                      onClick={(e) => handleRemove(symbol, e)}
                      className="absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                      tabIndex={-1}
                      aria-label={`Remove ${symbol}`}
                    >
                      <X size={13} strokeWidth={2} className="text-[#7d8590] hover:text-red-400 transition-colors" />
                    </button>
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
