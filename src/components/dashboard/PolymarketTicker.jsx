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

  const repeatCount = 4;
  const allItems = useMemo(() => {
    if (markets.length === 0) return [];
    return Array.from({ length: repeatCount }, () => markets).flat();
  }, [markets]);

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

  // Chevron toggle icon (inline, same height as ticker)
  const chevronButton = (rotated) => (
    <button
      onClick={onToggleMinimize}
      className="flex items-center gap-1 px-2 py-1 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer shrink-0"
      title={minimized ? 'Show Polymarket ticker' : 'Minimize Polymarket ticker'}
    >
      <svg
        className={`w-3 h-3 transition-transform ${rotated ? 'rotate-180' : ''}`}
        viewBox="0 0 10 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </button>
  );

  // ─── Minimized / no data: StatusBar + chevron on right ────────────────
  if (minimized || markets.length === 0) {
    return (
      <div className="flex items-center">
        <div className="flex-1 min-w-0">{statusBar}</div>
        {markets.length > 0 && chevronButton(true)}
      </div>
    );
  }

  // ─── Expanded: single-line ticker with chevron at right end ───────────
  return (
    <div className="relative flex items-center h-[34px] bg-[#1a1a1a] border-t border-white/[0.06]">
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

      {/* Scrolling ticker — takes remaining space */}
      <div className="relative flex-1 h-full overflow-hidden">
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
                <span className="text-[14px] font-medium text-white/85 leading-none max-w-[300px] truncate">
                  {m.question}
                </span>
                <span className={`text-[16px] font-mono font-semibold leading-none ${probColor(m.yesPct)}`}>
                  {m.yesPct}%
                </span>
                <span className="text-white/30 text-[16px]">·</span>
              </a>
            ))}
          </div>
        </div>

        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#1a1a1a] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#1a1a1a] to-transparent" />
      </div>

      {/* Chevron toggle — inline, right end, same line */}
      {chevronButton(false)}
    </div>
  );
};

export default PolymarketTicker;
