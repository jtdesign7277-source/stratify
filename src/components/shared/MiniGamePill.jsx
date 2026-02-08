import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const REFRESH_INTERVAL = 30000; // 30 seconds

const ESPN_ENDPOINTS = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
};

const parseEventToGame = (event, sport) => {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  const status = competition?.status;

  return {
    id: event?.id,
    sport,
    name: event?.name,
    homeTeam: home?.team?.abbreviation || 'HOME',
    homeScore: home?.score || '0',
    homeLogo: home?.team?.logo,
    awayTeam: away?.team?.abbreviation || 'AWAY',
    awayScore: away?.score || '0',
    awayLogo: away?.team?.logo,
    period: status?.period || 0,
    clock: status?.displayClock || '',
    state: status?.type?.state || 'pre',
    detail: status?.type?.shortDetail || '',
    isLive: status?.type?.state === 'in',
  };
};

const MiniGamePill = ({ game, onRemove }) => {
  const [currentGame, setCurrentGame] = useState(game);

  useEffect(() => {
    setCurrentGame(game);
  }, [game]);

  useEffect(() => {
    let isMounted = true;

    const refreshGame = async () => {
      if (!game?.id || !game?.sport) return;
      try {
        const res = await fetch(ESPN_ENDPOINTS[game.sport]);
        const data = await res.json();
        const event = data?.events?.find(e => e.id === game.id);
        if (event && isMounted) {
          setCurrentGame(parseEventToGame(event, game.sport));
        }
      } catch (err) {
        console.error('[MiniGamePill] Refresh error:', err);
      }
    };

    refreshGame();
    const interval = setInterval(refreshGame, REFRESH_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [game?.id, game?.sport]);

  if (!currentGame) return null;

  const statusLabel = currentGame.isLive
    ? `Q${currentGame.period} - ${currentGame.clock || 'Live'}`
    : currentGame.state === 'post'
      ? 'Final'
      : currentGame.detail || 'Upcoming';

  return (
    <div className="group h-8 px-2.5 rounded-full bg-[#1a1a1f] border border-white/10 flex items-center gap-2 text-white text-[11px] leading-none whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        {currentGame.awayLogo && <img src={currentGame.awayLogo} alt="" className="w-4 h-4" />}
        <span className="font-mono">{currentGame.awayScore}</span>
        <span className="text-white/40">|</span>
        <span className="font-mono">{currentGame.homeScore}</span>
        {currentGame.homeLogo && <img src={currentGame.homeLogo} alt="" className="w-4 h-4" />}
      </div>
      <span className="text-[10px] text-white/70">{statusLabel}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded-full transition-opacity"
        aria-label="Remove game"
      >
        <X className="w-3 h-3 text-white/70 hover:text-white" />
      </button>
    </div>
  );
};

export default MiniGamePill;
