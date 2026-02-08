import { useEffect, useRef, useState } from 'react';
import { GripVertical, RotateCw, X } from 'lucide-react';

const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 480;
const STORAGE_KEY = 'stratify-live-scores-v1';
const REFRESH_INTERVAL = 30000; // 30 seconds

// ESPN Hidden API endpoints
const ESPN_ENDPOINTS = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
};

const SPORT_ICONS = {
  nba: '🏀',
  nfl: '🏈',
  mlb: '⚾',
  nhl: '🏒',
};

const LiveScoresPill = ({
  isOpen: controlledIsOpen,
  onOpenChange,
  onUnreadChange,
}) => {
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSport, setActiveSport] = useState('nba');
  const [games, setGames] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [size, setSize] = useState({ width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const [position, setPosition] = useState({ x: 320, y: 200 });

  const isControlled = typeof controlledIsOpen === 'boolean';
  const isOpen = isControlled ? controlledIsOpen : internalOpen;
  const setOpen = (v) => { onOpenChange?.(v); if (!isControlled) setInternalOpen(v); };

  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { positionRef.current = position; }, [position]);

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { pos, sz } = JSON.parse(saved);
        if (pos) setPosition(pos);
        if (sz) setSize(sz);
      }
    } catch {}
  }, []);

  const saveState = (pos = positionRef.current, sz = sizeRef.current) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ pos, sz })); } catch {}
  };

  const clampPosition = (pos, sz = sizeRef.current) => {
    if (typeof window === 'undefined') return pos;
    return {
      x: Math.min(Math.max(0, pos.x), window.innerWidth - sz.width),
      y: Math.min(Math.max(0, pos.y), window.innerHeight - sz.height),
    };
  };

  // Fetch scores
  const fetchScores = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(ESPN_ENDPOINTS[activeSport]);
      const data = await res.json();
      const events = data?.events || [];
      
      const parsed = events.map(event => {
        const competition = event.competitions?.[0];
        const competitors = competition?.competitors || [];
        const home = competitors.find(c => c.homeAway === 'home');
        const away = competitors.find(c => c.homeAway === 'away');
        const status = competition?.status;
        
        return {
          id: event.id,
          sport: activeSport,
          name: event.name,
          homeTeam: home?.team?.abbreviation || 'HOME',
          homeScore: home?.score || '0',
          homeLogo: home?.team?.logo,
          awayTeam: away?.team?.abbreviation || 'AWAY',
          awayScore: away?.score || '0',
          awayLogo: away?.team?.logo,
          period: status?.period || 0,
          clock: status?.displayClock || '',
          state: status?.type?.state || 'pre', // pre, in, post
          detail: status?.type?.shortDetail || '',
          isLive: status?.type?.state === 'in',
        };
      });
      
      setGames(parsed);
      setLastUpdate(new Date());
      if (parsed.some(g => g.isLive)) onUnreadChange?.(true);
    } catch (err) {
      console.error('[LiveScores] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchScores();
    const interval = setInterval(fetchScores, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [isOpen, activeSport]);

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
      const clamped = clampPosition({
        x: clientX - dragOffset.current.x,
        y: clientY - dragOffset.current.y,
      });
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        positionRef.current = clamped;
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
      const newWidth = Math.max(280, Math.min(500, resizeStart.current.width + (clientX - resizeStart.current.x)));
      const newHeight = Math.max(300, Math.min(700, resizeStart.current.height + (clientY - resizeStart.current.y)));
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

  const liveGames = games.filter(g => g.isLive);
  const otherGames = games.filter(g => !g.isLive);

  return (
    <div
      ref={containerRef}
      style={panelStyle}
      className={`flex flex-col bg-gradient-to-b from-[#1a1a1f] to-[#0d0d12] border border-orange-500/30 shadow-2xl shadow-orange-500/10 ${isMobile ? '' : 'rounded-xl'}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-white/10 ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={!isMobile ? handleDragStart : undefined}
        onTouchStart={!isMobile ? handleDragStart : undefined}
      >
        <div className="flex items-center gap-2">
          {!isMobile && <GripVertical className="w-4 h-4 text-gray-500" />}
          <span className="text-lg">{SPORT_ICONS[activeSport]}</span>
          <span className="text-white font-semibold text-sm">Live Scores</span>
          {liveGames.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {liveGames.length} LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchScores()}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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

      {/* Sport Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/5">
        {Object.entries(SPORT_ICONS).map(([sport, icon]) => (
          <button
            key={sport}
            onClick={() => setActiveSport(sport)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSport === sport
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{icon}</span>
            <span className="uppercase">{sport}</span>
          </button>
        ))}
      </div>

      {/* Games List */}
      <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
        {games.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {isLoading ? 'Loading scores...' : 'No games scheduled'}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Live Games First */}
            {liveGames.length > 0 && (
              <>
                <div className="text-[10px] text-red-400 uppercase tracking-wider font-semibold flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Live Now
                </div>
                {liveGames.map(game => (
                  <GameCard key={game.id} game={game} />
                ))}
              </>
            )}
            
            {/* Other Games */}
            {otherGames.length > 0 && (
              <>
                {liveGames.length > 0 && (
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-4 mb-2">
                    {otherGames.some(g => g.state === 'post') ? 'Final / Upcoming' : 'Upcoming'}
                  </div>
                )}
                {otherGames.map(game => (
                  <GameCard key={game.id} game={game} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/5 text-[10px] text-gray-600 flex items-center justify-between">
        <span>Data from ESPN</span>
        {lastUpdate && <span>Updated {lastUpdate.toLocaleTimeString()}</span>}
      </div>

      {/* Resize Handle */}
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

// Individual Game Card
const GameCard = ({ game }) => {
  const isLive = game.isLive;
  const isFinal = game.state === 'post';

  const handleGameDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'copy';
    const payload = JSON.stringify({ type: 'game', data: game });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', payload);
  };
  
  return (
    <div
      draggable
      onDragStart={handleGameDragStart}
      className={`p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
      isLive 
        ? 'bg-red-500/5 border-red-500/20' 
        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
    }`}
    >
      <div className="flex items-center justify-between">
        {/* Teams */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            {game.awayLogo && <img src={game.awayLogo} alt="" className="w-5 h-5" />}
            <span className={`text-sm font-semibold ${
              isFinal && parseInt(game.awayScore) > parseInt(game.homeScore) ? 'text-white' : 'text-gray-400'
            }`}>{game.awayTeam}</span>
            <span className={`text-sm font-mono font-bold ml-auto ${
              isLive ? 'text-white' : isFinal ? 'text-gray-300' : 'text-gray-500'
            }`}>{game.awayScore}</span>
          </div>
          <div className="flex items-center gap-2">
            {game.homeLogo && <img src={game.homeLogo} alt="" className="w-5 h-5" />}
            <span className={`text-sm font-semibold ${
              isFinal && parseInt(game.homeScore) > parseInt(game.awayScore) ? 'text-white' : 'text-gray-400'
            }`}>{game.homeTeam}</span>
            <span className={`text-sm font-mono font-bold ml-auto ${
              isLive ? 'text-white' : isFinal ? 'text-gray-300' : 'text-gray-500'
            }`}>{game.homeScore}</span>
          </div>
        </div>
        
        {/* Status */}
        <div className="ml-4 text-right">
          {isLive ? (
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono text-red-400">{game.clock}</span>
              <span className="text-[10px] text-gray-500">Q{game.period}</span>
            </div>
          ) : isFinal ? (
            <span className="text-[10px] text-gray-500 uppercase">Final</span>
          ) : (
            <span className="text-[10px] text-gray-500">{game.detail}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveScoresPill;
