import React, { useEffect, useMemo, useState } from 'react';

const REFRESH_MS = 5 * 60 * 1000;

const SOURCE_COLORS = [
  { match: /reuters/i, className: 'bg-amber-400' },
  { match: /bloomberg/i, className: 'bg-blue-400' },
  { match: /wall street journal|wsj/i, className: 'bg-orange-400' },
  { match: /cnbc/i, className: 'bg-sky-400' },
  { match: /finnhub/i, className: 'bg-cyan-400' },
  { match: /alpaca/i, className: 'bg-indigo-400' },
  { match: /xai|grok|twitter|x\b/i, className: 'bg-emerald-400' },
];

const SYMBOL_COLORS = ['text-emerald-300', 'text-sky-300'];

const getDotClass = (source) => {
  if (!source) return 'bg-emerald-400';
  const match = SOURCE_COLORS.find((entry) => entry.match.test(source));
  return match ? match.className : 'bg-emerald-400';
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightSymbols = (text, symbols) => {
  if (!text) return '';
  if (!Array.isArray(symbols) || symbols.length === 0) return text;

  const cleanSymbols = Array.from(
    new Set(
      symbols
        .map((symbol) => String(symbol || '').trim())
        .filter(Boolean)
        .map((symbol) => symbol.toUpperCase())
    )
  );

  if (cleanSymbols.length === 0) return text;

  const symbolSet = new Set(cleanSymbols);
  const pattern = new RegExp(`(\\$?(?:${cleanSymbols.map(escapeRegExp).join('|')}))\\b`, 'gi');
  const parts = String(text).split(pattern);

  return parts.map((part, idx) => {
    const normalized = part.replace('$', '').toUpperCase();
    if (!symbolSet.has(normalized)) return part;
    const colorClass = SYMBOL_COLORS[normalized.charCodeAt(0) % SYMBOL_COLORS.length];
    return (
      <span key={`${normalized}-${idx}`} className={`font-semibold ${colorClass}`}>
        {part}
      </span>
    );
  });
};

const LiveAlertsTicker = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTrending = async (showLoading = false) => {
      if (showLoading && isMounted) setIsLoading(true);

      try {
        const response = await fetch('/api/trending');
        if (!response.ok) throw new Error(`Trending fetch failed: ${response.status}`);
        const data = await response.json();
        const nextItems = Array.isArray(data?.items) ? data.items : [];

        if (isMounted) {
          setItems(nextItems);
        }
      } catch (error) {
        console.error('[LiveAlertsTicker] Trending fetch error:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTrending(true);
    const interval = setInterval(() => fetchTrending(false), REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const baseItems = useMemo(() => {
    if (items.length > 0) return items;
    if (isLoading) {
      return [{ text: 'Loading latest news...', source: 'Loading', symbols: [] }];
    }
    return [{ text: 'No headlines available right now.', source: 'Status', symbols: [] }];
  }, [items, isLoading]);

  const allItems = baseItems.length > 0 ? [...baseItems, ...baseItems] : [];

  return (
    <div className="relative h-8 overflow-hidden bg-[#151518] border-b border-[#1f1f1f]">
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .live-ticker-track {
          display: flex;
          align-items: center;
          height: 100%;
          overflow: hidden;
        }
        .live-ticker-content {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: ticker-scroll 180s linear infinite;
        }
        .live-ticker-content:hover {
          animation-play-state: paused;
        }
        .live-ticker-track:hover .live-ticker-content {
          animation-play-state: paused;
        }
      `}</style>

      {/* LIVE Badge */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-[#151518] via-[#151518] to-transparent">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1e1e2d] border border-[#2a2a3d] rounded">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse shadow-[0_0_6px_rgba(0,200,83,0.6)]" />
          <span className="text-[10px] font-semibold text-[#E8EAED] uppercase tracking-wider">LIVE</span>
        </div>
      </div>

      {/* Scrolling Content */}
      <div className="live-ticker-track pl-20">
        <div className="live-ticker-content">
          {allItems.map((item, idx) => {
            const dotClass = getDotClass(item.source);

            return (
              <span key={`${item.text}-${idx}`} className="flex items-center">
                <span className={`inline-block mr-2 shrink-0 w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <span className="text-xs font-medium text-[#E8EAED]">
                  {highlightSymbols(item.text, item.symbols)}
                </span>
                <span className="mx-4 text-[#5f6368]">•</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Right fade */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#151518] to-transparent" />
    </div>
  );
};

export default LiveAlertsTicker;
