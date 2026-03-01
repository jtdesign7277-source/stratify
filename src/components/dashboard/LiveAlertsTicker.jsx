import React, { useEffect, useMemo, useRef, useState } from 'react';

const REFRESH_MS = 5 * 60 * 1000;
const STORED_HEADLINES_KEY = 'stratify-live-headline-tape-v2';
const STORED_HEADLINES_MAX_AGE_MS = 1000 * 60 * 60 * 72;
const MIN_SCROLL_DURATION_SECONDS = 100;
const TARGET_SCROLL_PIXELS_PER_SECOND = 18;

const SOURCE_COLORS = [
  { match: /reuters/i, className: 'bg-amber-400' },
  { match: /bloomberg/i, className: 'bg-blue-400' },
  { match: /wall street journal|wsj/i, className: 'bg-orange-400' },
  { match: /cnbc/i, className: 'bg-sky-400' },
  { match: /finnhub/i, className: 'bg-cyan-400' },
  { match: /alpaca/i, className: 'bg-indigo-400' },
  { match: /xai|grok|twitter|x\b/i, className: 'bg-emerald-400' },
];

const getDotClass = (source) => {
  if (!source) return 'bg-emerald-400';
  const match = SOURCE_COLORS.find((entry) => entry.match.test(source));
  return match ? match.className : 'bg-emerald-400';
};

const toPlainText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => toPlainText(entry))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (value && typeof value === 'object') {
    const preferredKeys = ['text', 'title', 'headline', 'summary', 'description', 'name', 'en'];
    for (const key of preferredKeys) {
      const fromKey = toPlainText(value[key]);
      if (fromKey) return fromKey;
    }
    for (const nested of Object.values(value)) {
      const fromNested = toPlainText(nested);
      if (fromNested) return fromNested;
    }
  }
  return '';
};

const cleanHeadlineText = (value) => {
  const text = toPlainText(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/^\[object object\]$/i.test(text)) return '';
  return text;
};

const cleanSourceText = (value) => {
  const source = toPlainText(value).replace(/\s+/g, ' ').trim();
  if (!source || /^\[object object\]$/i.test(source)) return 'Marketaux';
  return source;
};

const normalizeTickerItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      text: cleanHeadlineText(item?.text || item?.headline || item?.title || item?.summary),
      source: cleanSourceText(item?.source || item?.provider || 'Marketaux'),
      symbols: Array.isArray(item?.symbols)
        ? item.symbols
            .map((symbol) => String(symbol || '').trim().toUpperCase())
            .filter(Boolean)
        : [],
      timestamp: item?.timestamp || null,
    }))
    .filter((item) => item.text);
};

const mapNewsArticlesToTickerItems = (articles) => {
  if (!Array.isArray(articles)) return [];

  return articles
    .map((article) => {
      const text = cleanHeadlineText(article?.title || article?.summary || article?.description);
      if (!text) return null;

      const source = cleanSourceText(article?.source || 'Marketaux');
      const tickerText = String(article?.ticker || '').trim().replace(/^\$/, '').toUpperCase();
      const symbols = tickerText ? [tickerText] : [];

      return {
        text,
        source,
        symbols,
        timestamp: article?.publishedAt || article?.published_at || null,
      };
    })
    .filter(Boolean);
};

const readStoredHeadlines = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORED_HEADLINES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const storedAt = Number(parsed?.storedAt);
    if (!Number.isFinite(storedAt)) return [];
    if (Date.now() - storedAt > STORED_HEADLINES_MAX_AGE_MS) return [];
    return normalizeTickerItems(parsed?.items);
  } catch {
    return [];
  }
};

const writeStoredHeadlines = (items) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeTickerItems(items);
  if (normalized.length === 0) return;
  try {
    localStorage.setItem(
      STORED_HEADLINES_KEY,
      JSON.stringify({
        storedAt: Date.now(),
        items: normalized,
      }),
    );
  } catch {}
};

const buildFallbackMovementItems = () => {
  return [
    {
      text: 'Waiting for fresh breaking headlines from Marketaux.',
      source: 'Status',
      symbols: [],
      timestamp: null,
    },
    {
      text: 'Showing the latest available market headlines when no breaking headlines are active.',
      source: 'Marketaux',
      symbols: [],
      timestamp: null,
    },
    {
      text: 'Headline tape refreshes every 5 minutes.',
      source: 'Status',
      symbols: [],
      timestamp: null,
    },
  ];
};

const LiveAlertsTicker = () => {
  const [items, setItems] = useState(() => readStoredHeadlines());
  const [isLoading, setIsLoading] = useState(true);
  const [badgeLabel, setBadgeLabel] = useState(() => (readStoredHeadlines().length > 0 ? 'LATEST' : 'BREAKING'));
  const [scrollDurationSeconds, setScrollDurationSeconds] = useState(MIN_SCROLL_DURATION_SECONDS);
  const contentRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchLatestHeadlinesFallback = async () => {
      try {
        const response = await fetch('/api/news', { cache: 'no-store' });
        if (!response.ok) return [];
        const payload = await response.json().catch(() => ({}));
        return mapNewsArticlesToTickerItems(payload?.articles);
      } catch {
        return [];
      }
    };

    const fetchTrending = async (showLoading = false) => {
      if (showLoading && isMounted) setIsLoading(true);

      try {
        const params = new URLSearchParams();
        if (showLoading) {
          params.set('force', 'true');
        }
        const query = params.toString();
        const url = query ? `/api/trending?${query}` : '/api/trending';
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Trending fetch failed: ${response.status}`);
        const data = await response.json();
        const nextItems = normalizeTickerItems(data?.items);

        if (isMounted) {
          if (nextItems.length > 0) {
            setItems(nextItems);
            writeStoredHeadlines(nextItems);
            setBadgeLabel(String(data?.mode || '').includes('breaking') ? 'BREAKING' : 'LATEST');
          } else {
            const latestItems = await fetchLatestHeadlinesFallback();
            if (latestItems.length > 0) {
              setItems(latestItems);
              writeStoredHeadlines(latestItems);
              setBadgeLabel('LATEST');
            } else {
              const stored = readStoredHeadlines();
              if (stored.length > 0) {
                setItems(stored);
                setBadgeLabel('LATEST');
              }
            }
          }
        }
      } catch (error) {
        console.error('[LiveAlertsTicker] Trending fetch error:', error);
        if (isMounted) {
          const latestItems = await fetchLatestHeadlinesFallback();
          if (latestItems.length > 0) {
            setItems(latestItems);
            writeStoredHeadlines(latestItems);
            setBadgeLabel('LATEST');
          } else {
            const stored = readStoredHeadlines();
            if (stored.length > 0) {
              setItems(stored);
              setBadgeLabel('LATEST');
            }
          }
        }
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
      return [{ text: 'Loading breaking headlines...', source: 'Loading', symbols: [] }];
    }
    return buildFallbackMovementItems();
  }, [items, isLoading]);

  const allItems = baseItems.length > 0 ? [...baseItems, ...baseItems] : [];

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;

    const updateDuration = () => {
      const totalWidth = content.scrollWidth;
      if (!Number.isFinite(totalWidth) || totalWidth <= 0) return;
      const oneCycleWidth = totalWidth / 2;
      if (!Number.isFinite(oneCycleWidth) || oneCycleWidth <= 0) return;

      const nextDuration = Math.max(
        MIN_SCROLL_DURATION_SECONDS,
        Math.round(oneCycleWidth / TARGET_SCROLL_PIXELS_PER_SECOND),
      );
      setScrollDurationSeconds((previous) => (previous === nextDuration ? previous : nextDuration));
    };

    const raf = window.requestAnimationFrame(updateDuration);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateDuration)
      : null;
    resizeObserver?.observe(content);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
    };
  }, [allItems.length]);

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
          animation: ticker-scroll ${scrollDurationSeconds}s linear infinite;
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
          <span className="text-[10px] font-semibold text-[#E8EAED] uppercase tracking-wider">{badgeLabel}</span>
        </div>
      </div>

      {/* Scrolling Content */}
      <div className="live-ticker-track pl-20">
        <div ref={contentRef} className="live-ticker-content">
          {allItems.map((item, idx) => {
            const dotClass = getDotClass(item.source);

            return (
              <span key={`${item.text}-${idx}`} className="flex items-center">
                <span className={`inline-block mr-2 shrink-0 w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <span className="text-xs font-medium text-[#E8EAED]">
                  {item.text}
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
