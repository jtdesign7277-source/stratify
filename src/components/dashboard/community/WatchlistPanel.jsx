import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, ChevronDown, X, Search, Loader2, GripVertical, Trash2 } from 'lucide-react';

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

// ── Ticker row ────────────────────────────────────────────────────────────────

function TickerRow({
  symbol, name, price, pctText, isPositive, isLast,
  onNavigate, onRemove,
  dragIndex, dropIndex, index,
  onDragStart, onDragOver, onDragEnd, onDrop,
}) {
  const isDragTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;
  const isDragTargetAfter = dropIndex === index + 1 && dragIndex !== null;
  const isBeingDragged = dragIndex === index;

  return (
    <div className="relative">
      {/* Drop indicator line — above this row */}
      {isDragTarget && (
        <div className="absolute top-0 left-3 right-3 h-0.5 bg-[#58a6ff] rounded-full z-10 pointer-events-none" />
      )}

      <div
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDragEnd={onDragEnd}
        onDrop={(e) => onDrop(e, index)}
        className={[
          'group flex items-center gap-2 px-3 py-4 transition-colors select-none',
          isLast ? '' : 'border-b border-white/5',
          isBeingDragged
            ? 'bg-white/10 border border-[#58a6ff]/30 rounded-lg shadow-lg opacity-90'
            : 'hover:bg-white/5 cursor-pointer',
        ].join(' ')}
      >
        {/* Drag handle */}
        <GripVertical
          size={14}
          strokeWidth={1.5}
          className="text-[#7d8590] opacity-0 group-hover:opacity-50 flex-shrink-0 cursor-grab active:cursor-grabbing transition-opacity duration-200"
        />

        {/* Symbol + company name */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onNavigate(symbol)}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate(symbol)}
          role="button"
          tabIndex={0}
        >
          <div className="text-sm font-bold text-[#e6edf3] leading-tight">${symbol}</div>
          {name && (
            <div className="text-xs text-[#7d8590] truncate leading-tight mt-0.5">{name}</div>
          )}
        </div>

        {/* Price */}
        <div
          className="text-right flex-shrink-0 cursor-pointer"
          onClick={() => onNavigate(symbol)}
        >
          <span className="text-sm font-mono font-medium text-[#e6edf3]">
            {price !== null ? `$${formatPrice(price)}` : '—'}
          </span>
        </div>

        {/* % change */}
        <div
          className="text-right flex-shrink-0 min-w-[48px] cursor-pointer"
          onClick={() => onNavigate(symbol)}
        >
          {pctText ? (
            <span className={`text-xs font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {pctText}
            </span>
          ) : (
            <span className="text-xs font-mono text-[#7d8590]">—</span>
          )}
        </div>

        {/* Trash icon */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
          aria-label={`Remove ${symbol}`}
          className="flex-shrink-0 opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-opacity duration-200"
        >
          <Trash2
            size={14}
            strokeWidth={1.5}
            className="text-[#7d8590] hover:text-red-400 transition-colors duration-200"
          />
        </button>
      </div>

      {/* Drop indicator line — after last row */}
      {isLast && isDragTargetAfter && (
        <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#58a6ff] rounded-full z-10 pointer-events-none" />
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const WatchlistPanel = ({ onTickerClick }) => {
  const [open, setOpen] = useState(true);
  const [panelHeight, setPanelHeight] = useState(300);
  const [symbols, setSymbols] = useState(loadWatchlist);
  const [companyNames, setCompanyNames] = useState({ ...SEED_COMPANY_NAMES });
  const [quotes, setQuotes] = useState({});
  const [prevCloses, setPrevCloses] = useState({});
  const [connected, setConnected] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapRef = useRef(null);

  // Drag-to-reorder
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  const panelRef = useRef(null);
  const isPanelResizing = useRef(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);
  // Always-fresh ref so WS onopen can access current symbols without stale closure
  const symbolsRef = useRef(symbols);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);

  // ── Persist watchlist ─────────────────────────────────────────────────────
  useEffect(() => { saveWatchlist(symbols); }, [symbols]);

  // ── REST price + previous-close fallback (instant prices on mount / symbol change) ──
  useEffect(() => {
    const apiKey = resolveApiKey();
    if (!apiKey || symbols.length === 0) return;
    let cancelled = false;
    const restSymbols = symbols.filter(s => !s.includes('/'));
    if (restSymbols.length === 0) return;

    const fetchAll = async () => {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=${restSymbols.join(',')}&apikey=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const isMulti = restSymbols.length > 1;
        const updates = {};
        const closeUpdates = {};
        for (const sym of restSymbols) {
          const q = isMulti ? data[sym] : data;
          if (!q || q.status === 'error') continue;
          const price = q.close != null ? Number(q.close) : null;
          const prevClose = q.previous_close != null ? Number(q.previous_close) : null;
          if (Number.isFinite(price)) {
            updates[sym.toUpperCase()] = { price, wsPercent: null };
          }
          if (Number.isFinite(prevClose)) {
            closeUpdates[sym.toUpperCase()] = prevClose;
          }
        }
        if (!cancelled) {
          setQuotes(prev => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(updates)) {
              // Only set if WS hasn't already provided a live price
              if (!next[k]?.price) next[k] = { ...next[k], ...v };
            }
            return next;
          });
          setPrevCloses(prev => ({ ...prev, ...closeUpdates }));
        }
      } catch { /* ignore */ }
    };

    void fetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  // ── Close search dropdown on outside click ────────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── Panel resize (bottom drag handle) ────────────────────────────────────
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isPanelResizing.current = true;
    const onMouseMove = (me) => {
      if (!isPanelResizing.current || !panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      setPanelHeight(Math.min(600, Math.max(150, me.clientY - rect.top)));
    };
    const onMouseUp = () => {
      isPanelResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const wsSend = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
    const apiKey = resolveApiKey();
    if (!apiKey) { console.warn('[WatchlistPanel] No Twelve Data API key found'); return; }
    try {
      console.log('[WatchlistPanel] Connecting WebSocket…');
      const ws = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        console.log('[WatchlistPanel] WS open — subscribing to', symbolsRef.current);
        setConnected(true);
        // Use symbolsRef so we always subscribe the current live list, not a stale snapshot
        const allSymbols = symbolsRef.current;
        if (allSymbols.length > 0) {
          ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: allSymbols.join(',') } }));
        }
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
              : data.percent_change !== undefined ? Number(data.percent_change) : null;
            setQuotes((prev) => ({
              ...prev,
              [sym]: {
                price: Number.isFinite(price) ? price : prev[sym]?.price ?? null,
                wsPercent: Number.isFinite(wsPercent) ? wsPercent : prev[sym]?.wsPercent ?? null,
              },
            }));
          } else if (data?.status === 'error') {
            console.warn('[WatchlistPanel] WS error event:', data);
          }
        } catch { /* ignore malformed frames */ }
      };

      ws.onerror = (e) => {
        console.warn('[WatchlistPanel] WS error', e);
        setConnected(false);
      };

      ws.onclose = (e) => {
        if (!mountedRef.current) return;
        console.log('[WatchlistPanel] WS closed, code:', e.code, '— reconnecting in', RECONNECT_DELAY_MS, 'ms');
        setConnected(false);
        wsRef.current = null;
        reconnectTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      };
    } catch (err) {
      console.warn('[WatchlistPanel] WS connect threw:', err);
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
    setSymbols((prev) => prev.includes(sym) ? prev : [...prev, sym]);
    if (hit.instrument_name) {
      setCompanyNames((prev) => ({ ...prev, [sym]: hit.instrument_name }));
    }
    wsSend({ action: 'subscribe', params: { symbols: sym } });
    setSearchQuery('');
    setSearchFocused(false);
  }, [wsSend]);

  // ── Remove ticker ─────────────────────────────────────────────────────────
  const handleRemove = useCallback((sym) => {
    setSymbols((prev) => prev.filter(s => s !== sym));
    wsSend({ action: 'unsubscribe', params: { symbols: sym } });
  }, [wsSend]);

  // ── Drag-to-reorder handlers ──────────────────────────────────────────────
  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    // Transparent drag image so the row itself shows during drag
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback((e, index) => {
    e.preventDefault();
    const from = dragIndex;
    if (from === null || from === index) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    setSymbols((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      // Adjust target index after splice
      const to = from < index ? index - 1 : index;
      next.splice(to, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col rounded-xl border border-white/6 bg-white/2 overflow-hidden flex-shrink-0">

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
              searchFocused ? 'border-[#58a6ff]/50 ring-1 ring-[#58a6ff]/30' : 'border-white/10'
            }`}>
              <Search size={14} strokeWidth={1.5} className="text-[#7d8590] flex-shrink-0" />
              <input
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
            className="overflow-y-auto"
            style={{ height: panelHeight + 'px' }}
            // Cancel drop when over the scroll container itself (not a row)
            onDragOver={(e) => e.preventDefault()}
          >
            {symbols.map((symbol, index) => {
              const key = symbol.toUpperCase();
              const quote = quotes[key] || {};
              const price = quote.price ?? null;
              let pct = quote.wsPercent ?? null;
              if (pct === null && price !== null && prevCloses[key]) {
                pct = ((price - prevCloses[key]) / prevCloses[key]) * 100;
              }
              return (
                <TickerRow
                  key={symbol}
                  symbol={symbol}
                  name={companyNames[symbol] || companyNames[key] || ''}
                  price={price}
                  pctText={formatPercent(pct)}
                  isPositive={pct !== null && pct >= 0}
                  isLast={index === symbols.length - 1}
                  onNavigate={onTickerClick || navigateToTicker}
                  onRemove={handleRemove}
                  index={index}
                  dragIndex={dragIndex}
                  dropIndex={dropIndex}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                />
              );
            })}
          </div>

          {/* ── Resize drag handle ── */}
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
