import { useEffect, useRef, useState } from 'react';
import { GripVertical, RotateCw, X, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 500;
const STORAGE_KEY = 'stratify-kalshi-feed-v1';

const formatRelativeTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const diffMs = parsed.getTime() - Date.now();
  if (diffMs <= 0) return 'Closed';
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d left`;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const inferCategory = (market) => {
  const base = `${market.category || ''} ${market.title || ''} ${market.ticker || ''}`.toUpperCase();
  if (base.includes('NBA') || base.includes('BASKETBALL')) return '🏀';
  if (base.includes('NFL') || base.includes('FOOTBALL') || base.includes('SUPER BOWL')) return '🏈';
  if (base.includes('MLB') || base.includes('BASEBALL')) return '⚾';
  if (base.includes('TRUMP') || base.includes('BIDEN') || base.includes('ELECTION') || base.includes('CONGRESS')) return '🏛️';
  if (base.includes('FED') || base.includes('CPI') || base.includes('GDP') || base.includes('RATE')) return '📊';
  if (base.includes('BTC') || base.includes('ETH') || base.includes('CRYPTO')) return '₿';
  if (base.includes('AI') || base.includes('TECH')) return '🤖';
  if (base.includes('COMPANY') || base.includes('EARNINGS') || base.includes('NVDA') || base.includes('TSLA')) return '🏢';
  return '📈';
};

const KalshiPill = ({
  isOpen: controlledIsOpen,
  onOpenChange,
  showTrigger = true,
  onUnreadChange,
}) => {
  const cacheRef = useRef({ timestamp: 0, data: [] });
  const abortRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [markets, setMarkets] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [size, setSize] = useState({ width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return { x: 650, y: 200 };
  });
  const currentPos = useRef(position);
  const isControlled = typeof controlledIsOpen === 'boolean';
  const isOpen = isControlled ? controlledIsOpen : internalOpen;
  const sizeRef = useRef(size);

  const setOpen = (nextOpen) => {
    if (onOpenChange) onOpenChange(nextOpen);
    if (!isControlled) setInternalOpen(nextOpen);
  };

  useEffect(() => { sizeRef.current = size; }, [size]);

  const clampPosition = (pos, sizeValue = sizeRef.current) => {
    if (typeof window === 'undefined') return pos;
    const maxX = Math.max(0, window.innerWidth - sizeValue.width);
    const maxY = Math.max(0, window.innerHeight - sizeValue.height);
    return { x: Math.min(Math.max(0, pos.x), maxX), y: Math.min(Math.max(0, pos.y), maxY) };
  };

  const saveState = (nextPos = positionRef.current, nextSize = sizeRef.current) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ pos: nextPos, sz: nextSize })); } catch {}
  };

  const fetchMarkets = async ({ force = false } = {}) => {
    if (!force && cacheRef.current.data.length > 0) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < CACHE_TTL_MS) {
        setMarkets(cacheRef.current.data);
        setError('');
        return;
      }
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/kalshi/markets?limit=50`, {
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Markets request failed');

      const payload = await response.json();
      const items = payload?.markets || [];
      
      cacheRef.current = { timestamp: Date.now(), data: items };
      setMarkets(items);
      setError('');
      if (!isOpen && items.length > 0) setHasUnread(true);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('[KalshiPill] Fetch error:', err);
      setError('Markets unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setHasUnread(false);
    fetchMarkets();
  }, [isOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { positionRef.current = position; }, [position]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const nextSize = parsed?.sz && typeof parsed.sz.width === 'number' ? { width: parsed.sz.width, height: parsed.sz.height } : sizeRef.current;
        if (parsed?.pos && typeof parsed.pos.x === 'number') {
          setSize(nextSize);
          setPosition(clampPosition(parsed.pos, nextSize));
          return;
        }
      }
    } catch {}
    setPosition((current) => clampPosition(current, sizeRef.current));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      const clamped = clampPosition(positionRef.current);
      if (clamped.x !== positionRef.current.x || clamped.y !== positionRef.current.y) {
        positionRef.current = clamped;
        setPosition(clamped);
        saveState(clamped);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-refresh every 30 seconds when open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => fetchMarkets({ force: true }), 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => { onUnreadChange?.(hasUnread); }, [hasUnread, onUnreadChange]);

  // Drag handlers
  const handleDragStart = (e) => {
    if (isMobile || isResizing) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - positionRef.current.x, y: clientY - positionRef.current.y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newX = clientX - dragOffset.current.x;
      const newY = clientY - dragOffset.current.y;
      const clamped = clampPosition({ x: newX, y: newY });
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        positionRef.current = clamped;
        currentPos.current = clamped;
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
        }
      });
    };
    const handleEnd = () => {
      setIsDragging(false);
      setPosition(positionRef.current);
      saveState(positionRef.current);
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Resize handlers
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    resizeStart.current = { x: clientX, y: clientY, width: sizeRef.current.width, height: sizeRef.current.height };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - resizeStart.current.x;
      const deltaY = clientY - resizeStart.current.y;
      const newWidth = Math.max(300, Math.min(600, resizeStart.current.width + deltaX));
      const newHeight = Math.max(300, Math.min(800, resizeStart.current.height + deltaY));
      sizeRef.current = { width: newWidth, height: newHeight };
      if (containerRef.current) {
        containerRef.current.style.width = `${newWidth}px`;
        containerRef.current.style.height = `${newHeight}px`;
      }
    };
    const handleEnd = () => {
      setIsResizing(false);
      setSize(sizeRef.current);
      saveState(positionRef.current, sizeRef.current);
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing]);

  if (!isOpen) return null;

  const panelStyle = isMobile
    ? { position: 'fixed', inset: 0, zIndex: 9999 }
    : {
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: size.width,
        height: size.height,
        zIndex: 9999,
        willChange: 'transform',
      };

  return (
    <div
      ref={containerRef}
      style={panelStyle}
      className={`flex flex-col bg-gradient-to-b from-[#1a1a1f] to-[#0d0d12] border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 ${
        isMobile ? '' : 'rounded-xl'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-white/10 ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={!isMobile ? handleDragStart : undefined}
        onTouchStart={!isMobile ? handleDragStart : undefined}
      >
        <div className="flex items-center gap-2">
          {!isMobile && <GripVertical className="w-4 h-4 text-gray-500" />}
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-white font-semibold text-sm">Kalshi Live</span>
          <span className="text-[10px] text-gray-500 font-mono">{markets.length} markets</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchMarkets({ force: true })}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
            <p>{error}</p>
            <button onClick={() => fetchMarkets({ force: true })} className="mt-2 text-emerald-400 hover:underline text-xs">
              Retry
            </button>
          </div>
        ) : markets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {isLoading ? 'Loading markets...' : 'No markets available'}
          </div>
        ) : (
          <div className="space-y-2">
            {markets.map((market, i) => {
              const yesPercent = market.yesPercent ?? 50;
              const isYesFavored = yesPercent >= 50;
              const displayPercent = isYesFavored ? yesPercent : (100 - yesPercent);
              const emoji = inferCategory(market);
              const timeLeft = formatRelativeTime(market.closeTime);
              
              return (
                <a
                  key={market.id || market.ticker || i}
                  href={`https://kalshi.com/markets/${market.ticker || market.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-emerald-500/20 transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium leading-tight line-clamp-2 group-hover:text-emerald-300 transition-colors">
                        {market.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className={`text-xs font-mono font-bold ${isYesFavored ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isYesFavored ? 'YES' : 'NO'} {displayPercent.toFixed(0)}%
                        </div>
                        {timeLeft && (
                          <span className="text-[10px] text-gray-500">{timeLeft}</span>
                        )}
                        {market.volume > 0 && (
                          <span className="text-[10px] text-gray-600">
                            ${(market.volume / 1000).toFixed(0)}K vol
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isYesFavored ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${displayPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Resize handle */}
      {!isMobile && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <svg viewBox="0 0 24 24" className="w-full h-full text-gray-500">
            <path fill="currentColor" d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default KalshiPill;
