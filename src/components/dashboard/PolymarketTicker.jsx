import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

const POLYMARKET_API = '/api/polymarket';
const POLL_MS = 5 * 60_000; // 5 minutes
const MIN_SCROLL_DURATION = 100;
const PX_PER_SECOND = 18;
const CACHE_KEY = 'stratify-polymarket-v2';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 4; // 4 hours

// ─── Parse Yes % from outcomePrices ─────────────────────────────────────────
function parseYesPercent(outcomePrices) {
  try {
    const prices = typeof outcomePrices === 'string'
      ? JSON.parse(outcomePrices)
      : outcomePrices;
    if (!Array.isArray(prices) || prices.length === 0) return null;
    const yes = parseFloat(prices[0]);
    if (!Number.isFinite(yes)) return null;
    return Math.round(yes * 100);
  } catch {
    return null;
  }
}

// ─── Icon from market image or question keyword ─────────────────────────────
function getIcon(market) {
  // Prefer the market's own image/icon if available
  if (market.image) return { type: 'img', src: market.image };

  const q = (market.question || '').toLowerCase();

  const KEYWORD_ICONS = [
    [['trump', 'maga', 'republican'], '🇺🇸'],
    [['biden', 'democrat', 'democratic'], '🏛️'],
    [['election', 'vote', 'ballot', 'nominee', 'primary', 'senate'], '🗳️'],
    [['vance'], '🇺🇸'],
    [['newsom'], '🏛️'],
    [['elon', 'musk', 'tesla'], '🚀'],
    [['openai', 'chatgpt', 'gpt-5', 'gpt5', 'sam altman'], '🤖'],
    [['ai', 'artificial intelligence', 'llm'], '🧠'],
    [['bitcoin', 'btc'], '₿'],
    [['ethereum', 'eth'], 'Ξ'],
    [['crypto', 'coin', 'solana', 'sol'], '🪙'],
    [['fed', 'rate cut', 'rate hike', 'inflation', 'cpi', 'recession'], '🏦'],
    [['iran', 'hormuz', 'iranian'], '🇮🇷'],
    [['ukraine', 'zelensky'], '🇺🇦'],
    [['russia', 'putin'], '🇷🇺'],
    [['china', 'xi jinping', 'chinese'], '🇨🇳'],
    [['israel', 'gaza', 'hamas', 'netanyahu'], '🇮🇱'],
    [['north korea', 'kim jong'], '🇰🇵'],
    [['war', 'military', 'troops', 'attack', 'forces'], '⚔️'],
    [['oil', 'crude', 'opec', 'energy'], '🛢️'],
    [['gold', 'xau'], '🥇'],
    [['stock', 'market', 'spy', 'qqq', 's&p', 'nasdaq', 'dow'], '📈'],
    [['apple', 'aapl', 'iphone'], '🍎'],
    [['nvidia', 'nvda'], '🎮'],
    [['meta', 'facebook', 'zuckerberg'], '👓'],
    [['google', 'alphabet', 'gemini'], '🔍'],
    [['amazon', 'amzn'], '📦'],
    [['microsoft', 'msft'], '🪟'],
    [['nfl', 'football', 'super bowl'], '🏈'],
    [['nba', 'basketball', 'knicks', 'lakers', 'celtics', 'suns', 'pacers', 'raptors'], '🏀'],
    [['mlb', 'baseball', 'world series'], '⚾'],
    [['nhl', 'hockey', 'oilers', 'blues'], '🏒'],
    [['soccer', 'fifa', 'champions league', 'premier league', 'arsenal', 'uefa'], '⚽'],
    [['wbc'], '⚾'],
    [['ufc', 'mma', 'fight'], '🥊'],
    [['oscar', 'best picture', 'academy award'], '🎬'],
    [['tiktok'], '📱'],
    [['twitter', 'x.com'], '𝕏'],
    [['spacex', 'nasa', 'mars', 'moon', 'rocket', 'launch'], '🚀'],
    [['covid', 'pandemic', 'virus'], '🦠'],
    [['climate', 'hurricane', 'weather', 'earthquake'], '🌪️'],
    [['stripe', 'ipo'], '💰'],
  ];

  for (const [keywords, icon] of KEYWORD_ICONS) {
    if (keywords.some(kw => q.includes(kw))) return { type: 'emoji', value: icon };
  }
  return { type: 'emoji', value: '📊' };
}

function probColor(pct) {
  if (pct == null) return 'text-white/50';
  if (pct >= 70) return 'text-emerald-400';
  if (pct <= 30) return 'text-red-400';
  return 'text-amber-400';
}

// ─── Cache helpers ──────────────────────────────────────────────────────────
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed?.storedAt || 0) > CACHE_MAX_AGE) return [];
    return parsed?.markets || [];
  } catch {
    return [];
  }
}

function writeCache(markets) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ storedAt: Date.now(), markets }));
  } catch {}
}

// ─── Component ──────────────────────────────────────────────────────────────
const PolymarketTicker = ({ minimized, onToggleMinimize, statusBar }) => {
  const [markets, setMarkets] = useState(() => readCache());
  const [scrollDuration, setScrollDuration] = useState(MIN_SCROLL_DURATION);
  const contentRef = useRef(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(POLYMARKET_API);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;

      const cleaned = data
        .map(m => {
          const yesPct = parseYesPercent(m.outcomePrices);
          if (yesPct == null || !m.question) return null;
          return {
            id: m.id,
            question: m.question,
            yesPct,
            icon: getIcon(m),
            volume: m.volume24hr || 0,
          };
        })
        .filter(Boolean);

      if (cleaned.length > 0) {
        setMarkets(cleaned);
        writeCache(cleaned);
      }
    } catch (err) {
      console.error('[PolymarketTicker] fetch error:', err);
    }
  }, []);

  // Poll every 5 minutes
  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // Duplicate items for seamless loop
  const allItems = useMemo(() => {
    if (markets.length === 0) return [];
    return [...markets, ...markets];
  }, [markets]);

  // Calculate scroll speed based on content width
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const update = () => {
      const total = el.scrollWidth;
      if (!total || total <= 0) return;
      const half = total / 2;
      const dur = Math.max(MIN_SCROLL_DURATION, Math.round(half / PX_PER_SECOND));
      setScrollDuration(prev => prev === dur ? prev : dur);
    };

    const raf = requestAnimationFrame(update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [allItems.length, minimized]);

  // ─── Minimized / no data: show StatusBar + toggle on right ──────────────
  if (minimized || markets.length === 0) {
    return (
      <div className="flex items-center">
        <div className="flex-1 min-w-0">{statusBar}</div>
        {markets.length > 0 && (
          <button
            onClick={onToggleMinimize}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer shrink-0"
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

  // ─── Expanded ticker ────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Toggle bar */}
      <div className="flex items-center px-4 py-1 bg-[#111111] border-t border-white/[0.06]">
        <div className="flex-1" />
        <button
          onClick={onToggleMinimize}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          title="Minimize Polymarket ticker"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l4 4 4-4" />
          </svg>
          POLYMARKET
        </button>
        <span className="text-[9px] text-white/15 ml-3 font-mono">LIVE</span>
      </div>

      {/* Scrolling ticker */}
      <div className="relative h-8 overflow-hidden bg-[#111111]">
        <style>{`
          @keyframes poly-scroll {
            from { transform: translateX(-50%); }
            to { transform: translateX(0); }
          }
          .poly-track {
            display: flex;
            align-items: center;
            height: 100%;
            overflow: hidden;
          }
          .poly-content {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            animation: poly-scroll ${scrollDuration}s linear infinite;
          }
          .poly-content:hover,
          .poly-track:hover .poly-content {
            animation-play-state: paused;
          }
        `}</style>

        <div className="poly-track">
          <div ref={contentRef} className="poly-content">
            {allItems.map((m, idx) => (
              <span key={`${m.id}-${idx}`} className="flex items-center">
                {m.icon.type === 'img' ? (
                  <img
                    src={m.icon.src}
                    alt=""
                    className="w-4 h-4 rounded-sm mr-1.5 shrink-0 object-cover"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-sm mr-1.5 shrink-0">{m.icon.value}</span>
                )}
                <span className="text-xs font-medium text-[#E8EAED] max-w-[280px] truncate">
                  {m.question}
                </span>
                <span className={`text-xs font-bold font-mono ml-1.5 ${probColor(m.yesPct)}`}>
                  {m.yesPct}%
                </span>
                <span className="mx-4 text-[#5f6368]">·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#111111] to-transparent" />
      </div>
    </div>
  );
};

export default PolymarketTicker;
