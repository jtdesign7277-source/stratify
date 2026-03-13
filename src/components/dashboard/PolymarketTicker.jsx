import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

const POLYMARKET_REST_URL = 'https://gamma-api.polymarket.com/markets';
const POLYMARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const REFRESH_MS = 60_000;
const MIN_SCROLL_DURATION_SECONDS = 100;
const TARGET_SCROLL_PIXELS_PER_SECOND = 18;
const STORED_KEY = 'stratify-polymarket-ticker-v1';
const STORED_MAX_AGE_MS = 1000 * 60 * 60 * 4;

// ─── Topic icons — emoji mapped by keyword ──────────────────────────────────
const TOPIC_ICONS = [
  { keywords: ['trump'], icon: '🇺🇸' },
  { keywords: ['biden'], icon: '🏛️' },
  { keywords: ['sam altman', 'openai', 'open ai'], icon: '🤖' },
  { keywords: ['gpt', 'chatgpt'], icon: '💬' },
  { keywords: ['elon', 'musk', 'tesla', 'spacex'], icon: '🚀' },
  { keywords: ['bitcoin', 'btc'], icon: '₿' },
  { keywords: ['ethereum', 'eth'], icon: 'Ξ' },
  { keywords: ['crypto', 'coin'], icon: '🪙' },
  { keywords: ['fed', 'rate', 'inflation', 'cpi'], icon: '🏦' },
  { keywords: ['war', 'military', 'troops', 'attack'], icon: '⚔️' },
  { keywords: ['ukraine', 'zelensky'], icon: '🇺🇦' },
  { keywords: ['russia', 'putin'], icon: '🇷🇺' },
  { keywords: ['china', 'xi'], icon: '🇨🇳' },
  { keywords: ['israel', 'gaza', 'hamas'], icon: '🇮🇱' },
  { keywords: ['iran'], icon: '🇮🇷' },
  { keywords: ['north korea', 'kim'], icon: '🇰🇵' },
  { keywords: ['election', 'vote', 'ballot'], icon: '🗳️' },
  { keywords: ['apple', 'aapl', 'iphone'], icon: '🍎' },
  { keywords: ['nvidia', 'nvda'], icon: '🎮' },
  { keywords: ['meta', 'facebook', 'zuckerberg'], icon: '👓' },
  { keywords: ['google', 'alphabet', 'gemini'], icon: '🔍' },
  { keywords: ['amazon', 'amzn'], icon: '📦' },
  { keywords: ['microsoft', 'msft'], icon: '🪟' },
  { keywords: ['ai', 'artificial intelligence'], icon: '🧠' },
  { keywords: ['nfl', 'football', 'super bowl'], icon: '🏈' },
  { keywords: ['nba', 'basketball'], icon: '🏀' },
  { keywords: ['mlb', 'baseball'], icon: '⚾' },
  { keywords: ['soccer', 'fifa', 'world cup'], icon: '⚽' },
  { keywords: ['ufc', 'mma', 'fight'], icon: '🥊' },
  { keywords: ['oil', 'opec', 'energy'], icon: '🛢️' },
  { keywords: ['gold'], icon: '🥇' },
  { keywords: ['stock', 'market', 'spy', 'qqq', 's&p'], icon: '📈' },
  { keywords: ['recession'], icon: '📉' },
  { keywords: ['climate', 'weather', 'hurricane'], icon: '🌪️' },
  { keywords: ['covid', 'pandemic', 'virus'], icon: '🦠' },
  { keywords: ['spacex', 'nasa', 'mars', 'moon', 'rocket'], icon: '🚀' },
  { keywords: ['tiktok'], icon: '📱' },
  { keywords: ['twitter', 'x.com'], icon: '𝕏' },
];

function getIconForQuestion(question) {
  const lower = (question || '').toLowerCase();
  for (const { keywords, icon } of TOPIC_ICONS) {
    if (keywords.some(kw => lower.includes(kw))) return icon;
  }
  return '📊';
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed?.storedAt || 0) > STORED_MAX_AGE_MS) return [];
    return parsed?.markets || [];
  } catch {
    return [];
  }
}

function writeStored(markets) {
  try {
    localStorage.setItem(STORED_KEY, JSON.stringify({ storedAt: Date.now(), markets }));
  } catch {}
}

function formatProb(price) {
  const p = parseFloat(price);
  if (!Number.isFinite(p)) return '—';
  return `${Math.round(p * 100)}%`;
}

function probColor(price) {
  const p = parseFloat(price);
  if (!Number.isFinite(p)) return 'text-white/50';
  if (p >= 0.7) return 'text-emerald-400';
  if (p <= 0.3) return 'text-red-400';
  return 'text-amber-400';
}

// ─── Component ──────────────────────────────────────────────────────────────
// Props: minimized, onToggleMinimize
const PolymarketTicker = ({ minimized, onToggleMinimize }) => {
  const [markets, setMarkets] = useState(() => readStored());
  const [scrollDurationSeconds, setScrollDurationSeconds] = useState(MIN_SCROLL_DURATION_SECONDS);
  const contentRef = useRef(null);
  const wsRef = useRef(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(
        `${POLYMARKET_REST_URL}?limit=20&active=true&closed=false&order=volume24hr&ascending=false`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;

      const cleaned = data
        .filter(m => m.question && m.outcomePrices)
        .map(m => {
          let prices;
          try {
            prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
          } catch {
            prices = [];
          }
          return {
            id: m.id,
            conditionId: m.conditionId,
            question: m.question,
            yesPrice: prices[0] || 0,
            image: m.image || null,
            volume24hr: m.volume24hr || 0,
            icon: getIconForQuestion(m.question),
          };
        });

      setMarkets(cleaned);
      writeStored(cleaned);
    } catch (err) {
      console.error('[PolymarketTicker] fetch error:', err);
    }
  }, []);

  // WebSocket for live price updates
  useEffect(() => {
    if (markets.length === 0) return;

    const connectWs = () => {
      try {
        const ws = new WebSocket(POLYMARKET_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          const assets = markets
            .filter(m => m.conditionId)
            .map(m => ({ asset_id: m.conditionId, type: 'market' }));
          if (assets.length > 0) {
            ws.send(JSON.stringify({ type: 'subscribe', assets }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'price_change' && msg.asset_id && msg.price != null) {
              setMarkets(prev => prev.map(m =>
                m.conditionId === msg.asset_id ? { ...m, yesPrice: msg.price } : m
              ));
            }
          } catch {}
        };

        ws.onerror = () => {};
        ws.onclose = () => {
          setTimeout(connectWs, 5000);
        };
      } catch {}
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [markets.length > 0]);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  const allItems = useMemo(() => {
    if (markets.length === 0) return [];
    return [...markets, ...markets];
  }, [markets]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const updateDuration = () => {
      const totalWidth = content.scrollWidth;
      if (!Number.isFinite(totalWidth) || totalWidth <= 0) return;
      const oneCycleWidth = totalWidth / 2;
      if (!Number.isFinite(oneCycleWidth) || oneCycleWidth <= 0) return;
      const nextDuration = Math.max(
        MIN_SCROLL_DURATION_SECONDS,
        Math.round(oneCycleWidth / TARGET_SCROLL_PIXELS_PER_SECOND),
      );
      setScrollDurationSeconds(prev => (prev === nextDuration ? prev : nextDuration));
    };

    const raf = window.requestAnimationFrame(updateDuration);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateDuration) : null;
    resizeObserver?.observe(content);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
    };
  }, [allItems.length, minimized]);

  // When minimized, just render the toggle tab (sits inside StatusBar area)
  if (minimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-white/30 hover:text-white/50 transition-colors cursor-pointer"
        title="Show Polymarket ticker"
      >
        <svg className="w-2.5 h-2.5 rotate-180" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
        POLYMARKET
      </button>
    );
  }

  if (markets.length === 0) return null;

  return (
    <div className="relative">
      {/* Toggle bar */}
      <div className="flex items-center px-4 py-1 bg-[#111111] border-t border-white/[0.06]">
        <button
          onClick={onToggleMinimize}
          className="flex items-center gap-1.5 text-[10px] font-medium text-white/30 hover:text-white/50 transition-colors cursor-pointer"
          title="Minimize Polymarket ticker"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l4 4 4-4" />
          </svg>
          POLYMARKET
        </button>
        <span className="text-[9px] text-white/15 ml-auto font-mono">LIVE</span>
      </div>

      {/* Scrolling ticker */}
      <div className="relative h-8 overflow-hidden bg-[#111111]">
        <style>{`
          @keyframes poly-ticker-scroll {
            from { transform: translateX(-50%); }
            to { transform: translateX(0); }
          }
          .poly-ticker-track {
            display: flex;
            align-items: center;
            height: 100%;
            overflow: hidden;
          }
          .poly-ticker-content {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            animation: poly-ticker-scroll ${scrollDurationSeconds}s linear infinite;
          }
          .poly-ticker-content:hover,
          .poly-ticker-track:hover .poly-ticker-content {
            animation-play-state: paused;
          }
        `}</style>

        <div className="poly-ticker-track">
          <div ref={contentRef} className="poly-ticker-content">
            {allItems.map((market, idx) => (
              <span key={`${market.id}-${idx}`} className="flex items-center">
                <span className="text-sm mr-1.5 shrink-0">{market.icon}</span>
                <span className="text-xs font-medium text-[#E8EAED] max-w-[280px] truncate">
                  {market.question}
                </span>
                <span className={`text-xs font-bold font-mono ml-1.5 ${probColor(market.yesPrice)}`}>
                  {formatProb(market.yesPrice)}
                </span>
                <span className="mx-4 text-[#5f6368]">•</span>
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
