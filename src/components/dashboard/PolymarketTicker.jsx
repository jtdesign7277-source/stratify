import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

const POLYMARKET_API = '/api/polymarket';
const POLL_MS = 5 * 60_000;
const MIN_SCROLL_SECONDS = 100;
const PX_PER_SECOND = 18;
const CACHE_KEY = 'stratify-polymarket-v3';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 4;

function probColor(pct) {
  if (pct == null) return 'text-white/45';
  if (pct >= 70) return 'text-emerald-400';
  if (pct <= 30) return 'text-red-400';
  return 'text-amber-400';
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed?.storedAt || 0) > CACHE_MAX_AGE) return [];
    return parsed?.markets || [];
  } catch { return []; }
}

function writeCache(markets) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ storedAt: Date.now(), markets }));
  } catch {}
}

// ─── Component ──────────────────────────────────────────────────────────────
const PolymarketTicker = ({ minimized, onToggleMinimize, statusBar }) => {
  const [markets, setMarkets] = useState(() => readCache());
  const [scrollDuration, setScrollDuration] = useState(MIN_SCROLL_SECONDS);
  const contentRef = useRef(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(POLYMARKET_API);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      // Proxy already returns cleaned { id, question, yesPct, image }
      setMarkets(data);
      writeCache(data);
    } catch (err) {
      console.error('[PolymarketTicker] fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // Duplicate for seamless loop
  const repeatCount = 4;
  const allItems = useMemo(() => {
    if (markets.length === 0) return [];
    return Array.from({ length: repeatCount }, () => markets).flat();
  }, [markets]);

  // Scroll speed based on content width
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      const total = el.scrollWidth;
      if (!total || total <= 0) return;
      const cycle = total / repeatCount;
      const dur = Math.max(MIN_SCROLL_SECONDS, Math.round(cycle / PX_PER_SECOND));
      setScrollDuration(prev => prev === dur ? prev : dur);
    };
    const raf = requestAnimationFrame(update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [allItems.length, minimized]);

  // ─── Minimized / no data: StatusBar + toggle on right ─────────────────
  if (minimized || markets.length === 0) {
    return (
      <div className="flex items-center">
        <div className="flex-1 min-w-0">{statusBar}</div>
        {markets.length > 0 && (
          <button
            onClick={onToggleMinimize}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer shrink-0"
            title="Show Polymarket ticker"
          >
            <svg className="w-2.5 h-2.5 rotate-180" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l4 4 4-4" />
            </svg>
            POLYMARKET
          </button>
        )}
      </div>
    );
  }

  // ─── Expanded ticker — matches top bar style ──────────────────────────
  return (
    <div className="relative">
      {/* Scrolling ticker */}
      <div className="relative h-[34px] overflow-hidden bg-[#1a1a1a] border-t border-white/[0.06]">
        <style>{`
          @keyframes poly-scroll {
            from { transform: translateX(-${100 / repeatCount}%); }
            to { transform: translateX(0); }
          }
          .poly-track {
            display: flex;
            align-items: center;
            height: 100%;
            overflow: hidden;
            width: max-content;
            min-width: 100%;
          }
          .poly-content {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            animation: poly-scroll ${scrollDuration}s linear infinite;
          }
          .poly-track:hover .poly-content {
            animation-play-state: paused;
          }
        `}</style>

        <div className="poly-track pl-2 pr-2 py-0.5">
          <div ref={contentRef} className="poly-content">
            {allItems.map((m, idx) => (
              <a
                key={`${m.id}-${idx}`}
                href={m.slug ? `https://polymarket.com/event/${m.slug}` : 'https://polymarket.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 hover:bg-white/5 rounded transition-colors cursor-pointer no-underline"
              >
                {m.image ? (
                  <img
                    src={m.image}
                    alt=""
                    className="h-[18px] w-[18px] flex-shrink-0 rounded-sm object-cover"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm bg-blue-500/20 text-[9px] font-semibold text-blue-400">
                    P
                  </span>
                )}
                <span
                  className="text-[14px] font-medium text-white/85 leading-none max-w-[300px] truncate"
                >
                  {m.question}
                </span>
                <span className={`text-[16px] font-mono font-semibold leading-none ${probColor(m.yesPct)}`}>
                  {m.yesPct}%
                </span>
                <span className="text-white/30 text-[16px]">•</span>
              </a>
            ))}
          </div>
        </div>

        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#1a1a1a] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#1a1a1a] to-transparent" />
      </div>

      {/* POLYMARKET label — right side */}
      <button
        onClick={onToggleMinimize}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer bg-[#1a1a1a]/90 backdrop-blur-sm rounded"
        title="Minimize Polymarket ticker"
      >
        <svg className="w-2.5 h-2.5" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
        POLYMARKET
      </button>
    </div>
  );
};

export default PolymarketTicker;
