import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, RotateCw, X } from 'lucide-react';
import { useWatchlist as useWatchlistHook } from '../../store/StratifyProvider';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';
const DEFAULT_SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'AMD', 'MSFT', 'META', 'GOOGL', 'AMZN'];
const CACHE_TTL_MS = 2 * 60 * 1000;
const DEFAULT_PANEL_WIDTH = 380;
const DEFAULT_PANEL_HEIGHT = 500;
const MIN_PANEL_WIDTH = 300;
const MIN_PANEL_HEIGHT = 300;
const MAX_PANEL_WIDTH = 520;
const MAX_PANEL_HEIGHT = 800;
const PANEL_MARGIN = 24;
const PANEL_CHROME_HEIGHT = 120;
const POSITION_STORAGE_KEY = 'stratify-social-feed-position';
const SIZE_STORAGE_KEY = 'stratify-social-feed-size';

const formatRelativeTime = (value) => {
  if (!value) return 'Just now';
  const parsed = new Date(value);
  const timestamp = Number.isNaN(parsed.getTime())
    ? new Date(typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.now())
    : parsed;
  const diffMs = Date.now() - timestamp.getTime();
  if (diffMs <= 0) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
};

const getInitials = (name, handle) => {
  const base = name || handle || 'X';
  const parts = String(base).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'X';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const highlightCashtags = (content) => {
  if (!content) return null;
  const parts = String(content).split(/(\$[A-Za-z]{1,10}\b)/g);
  return parts.map((part, index) => {
    if (/^\$[A-Za-z]{1,10}\b/.test(part)) {
      return (
        <span key={`${part}-${index}`} className="text-blue-400 font-medium">
          {part.toUpperCase()}
        </span>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
};

const normalizeFeedItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload?.feed && Array.isArray(payload.feed)) return payload.feed;
  if (payload?.items && Array.isArray(payload.items)) return payload.items;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  return [];
};

const XPill = ({
  isOpen: controlledIsOpen,
  onOpenChange,
  showTrigger = true,
  onUnreadChange,
}) => {
  const cacheRef = useRef({ timestamp: 0, data: [] });
  const abortRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT });
  const resizeOrigin = useRef({
    x: 0,
    y: 0,
    width: DEFAULT_PANEL_WIDTH,
    height: DEFAULT_PANEL_HEIGHT,
    posX: 0,
    posY: 0,
  });
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedItems, setFeedItems] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [size, setSize] = useState(() => ({
    width: DEFAULT_PANEL_WIDTH,
    height: DEFAULT_PANEL_HEIGHT,
  }));
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: Math.max(0, window.innerWidth - DEFAULT_PANEL_WIDTH - PANEL_MARGIN),
      y: Math.max(0, window.innerHeight - DEFAULT_PANEL_HEIGHT - PANEL_MARGIN),
    };
  });
  const isControlled = typeof controlledIsOpen === 'boolean';
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const setOpen = (nextOpen) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    }
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
  };

  let watchlist = null;
  try {
    watchlist = useWatchlistHook();
  } catch {
    watchlist = null;
  }

  const clampSize = (nextSize) => {
    const width = Math.min(Math.max(MIN_PANEL_WIDTH, nextSize.width), MAX_PANEL_WIDTH);
    const height = Math.min(Math.max(MIN_PANEL_HEIGHT, nextSize.height), MAX_PANEL_HEIGHT);
    return { width, height };
  };

  const clampPosition = (pos, nextSize = sizeRef.current) => {
    if (typeof window === 'undefined') return pos;
    const maxX = Math.max(0, window.innerWidth - nextSize.width);
    const maxY = Math.max(0, window.innerHeight - nextSize.height);
    return {
      x: Math.min(Math.max(0, pos.x), maxX),
      y: Math.min(Math.max(0, pos.y), maxY),
    };
  };

  const savePosition = (nextPos) => {
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPos));
    } catch {}
  };

  const saveSize = (nextSize) => {
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(nextSize));
    } catch {}
  };

  const symbols = useMemo(() => {
    const list = watchlist?.symbols && Array.isArray(watchlist.symbols) && watchlist.symbols.length > 0
      ? watchlist.symbols
      : DEFAULT_SYMBOLS;
    return list.filter(Boolean);
  }, [watchlist]);

  const symbolsKey = useMemo(() => symbols.join(','), [symbols]);

  const fetchFeed = async ({ force = false } = {}) => {
    if (!force && cacheRef.current.data.length > 0) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < CACHE_TTL_MS) {
        setFeedItems(cacheRef.current.data);
        setError('');
        return;
      }
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/social/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Feed request failed');
      }

      const payload = await response.json();
      const items = normalizeFeedItems(payload);

      cacheRef.current = {
        timestamp: Date.now(),
        data: items,
      };
      setFeedItems(items);
      setError('');
      if (!isOpen && items.length > 0) {
        setHasUnread(true);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError('Feed unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setHasUnread(false);
    fetchFeed();
  }, [isOpen, symbolsKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let nextSize = sizeRef.current;
    try {
      const savedSize = localStorage.getItem(SIZE_STORAGE_KEY);
      if (savedSize) {
        const parsedSize = JSON.parse(savedSize);
        if (
          parsedSize
          && typeof parsedSize.width === 'number'
          && typeof parsedSize.height === 'number'
        ) {
          nextSize = clampSize(parsedSize);
        }
      }
    } catch {}
    if (
      nextSize.width !== sizeRef.current.width
      || nextSize.height !== sizeRef.current.height
    ) {
      sizeRef.current = nextSize;
      setSize(nextSize);
    }

    let nextPosition = positionRef.current;
    try {
      const savedPosition = localStorage.getItem(POSITION_STORAGE_KEY);
      if (savedPosition) {
        const parsedPosition = JSON.parse(savedPosition);
        if (
          parsedPosition
          && typeof parsedPosition.x === 'number'
          && typeof parsedPosition.y === 'number'
        ) {
          nextPosition = parsedPosition;
        }
      }
    } catch {}

    nextPosition = clampPosition(nextPosition, nextSize);
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      const nextIsMobile = window.innerWidth < 768;
      setIsMobile(nextIsMobile);
      const clamped = clampPosition(positionRef.current);
      if (clamped.x !== positionRef.current.x || clamped.y !== positionRef.current.y) {
        positionRef.current = clamped;
        setPosition(clamped);
        if (!nextIsMobile) {
          savePosition(clamped);
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (onUnreadChange) {
      onUnreadChange(hasUnread);
    }
  }, [hasUnread, onUnreadChange]);

  const handleDragStart = (event) => {
    if (isMobile) return;
    if (event.target.closest('[data-no-drag]')) return;
    event.preventDefault();
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    setIsDragging(true);
  };

  const handleResizeStart = (event) => {
    if (isMobile) return;
    event.preventDefault();
    event.stopPropagation();
    resizeOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      posX: positionRef.current.x,
      posY: positionRef.current.y,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isDragging) return undefined;
    const handleMove = (event) => {
      const nextPos = clampPosition({
        x: event.clientX - dragOffset.current.x,
        y: event.clientY - dragOffset.current.y,
      });
      positionRef.current = nextPos;
      setPosition(nextPos);
    };
    const handleUp = () => {
      setIsDragging(false);
      savePosition(positionRef.current);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isResizing) return undefined;
    const handleMove = (event) => {
      const deltaX = event.clientX - resizeOrigin.current.x;
      const deltaY = event.clientY - resizeOrigin.current.y;
      const nextSize = clampSize({
        width: resizeOrigin.current.width + deltaX,
        height: resizeOrigin.current.height + deltaY,
      });
      const nextPosition = clampPosition(
        { x: resizeOrigin.current.posX, y: resizeOrigin.current.posY },
        nextSize,
      );
      sizeRef.current = nextSize;
      setSize(nextSize);
      positionRef.current = nextPosition;
      setPosition(nextPosition);
    };
    const handleUp = () => {
      setIsResizing(false);
      saveSize(sizeRef.current);
      savePosition(positionRef.current);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

  const handleRefresh = () => {
    fetchFeed({ force: true });
  };

  const renderFeedContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3 p-4">
          {[0, 1, 2].map((item) => (
            <div
              key={`skeleton-${item}`}
              className="x-feed-shimmer rounded-lg border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded-full bg-white/10" />
                  <div className="h-2 w-20 rounded-full bg-white/10" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-2 w-full rounded-full bg-white/10" />
                <div className="h-2 w-5/6 rounded-full bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="text-sm text-white/70">{error}</div>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!feedItems.length) {
      return (
        <div className="flex items-center justify-center px-6 py-12 text-sm text-white/60">
          No updates yet.
        </div>
      );
    }

    return (
      <div className="divide-y divide-white/10">
        {feedItems.map((item, index) => {
          const displayName = item.displayName || item.name || item.user?.name || 'Market Watcher';
          const handle = item.handle || item.username || item.user?.handle || item.user?.username || 'stratify';
          const timestamp =
            item.timestamp || item.createdAt || item.created_at || item.time || item.date || Date.now();
          const content = item.content || item.text || item.body || '';
          const sentiment = String(item.sentiment || item.tone || 'neutral').toLowerCase();
          const sentimentLabel = ['bullish', 'bearish', 'neutral'].includes(sentiment)
            ? sentiment
            : 'neutral';
          const sentimentClass =
            sentimentLabel === 'bullish'
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
              : sentimentLabel === 'bearish'
                ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                : 'border-white/15 bg-white/10 text-white/70';

          return (
            <div
              key={item.id || item._id || `${handle}-${index}`}
              className="space-y-3 px-4 py-3 transition hover:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80">
                    {getInitials(displayName, handle)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/90">{displayName}</div>
                    <div className="text-xs text-white/50">@{handle}</div>
                  </div>
                </div>
                <div className="text-[11px] text-white/40">
                  {formatRelativeTime(timestamp)}
                </div>
              </div>
              <div className="text-sm text-white/80 leading-relaxed">
                {highlightCashtags(content)}
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sentimentClass}`}
                >
                  {sentimentLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const feedMaxHeight = isMobile
    ? 370
    : Math.max(0, size.height - PANEL_CHROME_HEIGHT);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <style>{`
        .x-feed-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }
        .x-feed-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .x-feed-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .x-feed-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.6);
        }
        .x-feed-shimmer {
          background: linear-gradient(110deg, rgba(255,255,255,0.06) 8%, rgba(255,255,255,0.16) 18%, rgba(255,255,255,0.06) 33%);
          background-size: 200% 100%;
          animation: x-feed-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes x-feed-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        className={`fixed z-50 w-full max-w-none overflow-hidden border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl shadow-black/60 transition-all duration-300 ease-out relative ${
          isMobile ? 'inset-x-0 bottom-0 rounded-t-2xl' : 'rounded-xl'
        } ${isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'pointer-events-none translate-y-4 opacity-0'}`}
        style={
          isMobile
            ? { maxHeight: DEFAULT_PANEL_HEIGHT }
            : {
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
              }
        }
      >
        <div
          className={`flex items-center justify-between border-b border-white/10 px-4 py-3 ${isMobile ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2 text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
              <X className="h-4 w-4 text-white" strokeWidth={1.5} fill="none" />
            </div>
            <div className="text-sm font-semibold">Social Feed</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-no-drag
              onClick={handleRefresh}
              disabled={isLoading}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh feed"
            >
              <RotateCw
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                strokeWidth={1.5}
                fill="none"
              />
            </button>
            <button
              type="button"
              data-no-drag
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:border-white/30 hover:text-white"
              aria-label="Close feed"
            >
              <X className="h-4 w-4" strokeWidth={1.5} fill="none" />
            </button>
          </div>
        </div>

        <div className="x-feed-scroll flex-1 overflow-y-auto" style={{ maxHeight: feedMaxHeight }}>
          {renderFeedContent()}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[11px] text-white/60">
          <span>AI-generated from real market news</span>
          <a
            href="https://marketaux.com"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 transition hover:text-blue-300"
          >
            marketaux.com
          </a>
        </div>

        {!isMobile && (
          <div
            data-no-drag
            onMouseDown={handleResizeStart}
            className={`absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center cursor-se-resize opacity-40 transition-opacity hover:opacity-100 ${isResizing ? 'opacity-100' : ''}`}
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(59, 130, 246, 0.35) 50%)',
              borderRadius: '0 0 12px 0',
            }}
          >
            <GripVertical className="h-3 w-3 text-blue-300 rotate-[-45deg]" strokeWidth={1.5} fill="none" />
          </div>
        )}
      </div>

      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpen(!isOpen)}
          aria-label="Toggle social feed"
          aria-expanded={isOpen}
          className="group relative flex h-12 items-center gap-2 rounded-full border border-white/10 bg-black px-4 text-sm font-semibold text-white/90 shadow-lg shadow-black/60 transition-all duration-200 ease-out hover:scale-105 hover:border-white/25 pointer-events-auto"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10 opacity-60 shadow-[0_0_18px_rgba(59,130,246,0.45)] animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
            <X className="h-4 w-4 text-white" strokeWidth={1.5} fill="none" />
          </div>
          <span className="relative">Feed</span>
          {hasUnread && !isOpen && (
            <span className="pointer-events-none absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
          )}
        </button>
      )}
    </div>
  );
};

export default XPill;
