import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { API_URL } from '../../config';

const formatVolume = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '—';
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return `${Math.round(num)}`;
};

const formatVolumeLong = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(num));
};

const toPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
};

const inferCategory = (market) => {
  const base = `${market.category || ''} ${market.title || ''} ${market.ticker || ''}`.toUpperCase();
  if (base.includes('NBA') || base.includes('WNBA') || base.includes('BASKETBALL')) return 'Basketball';
  if (base.includes('NFL') || base.includes('FOOTBALL')) return 'Football';
  if (base.includes('MLB') || base.includes('BASEBALL')) return 'Baseball';
  if (base.includes('NHL') || base.includes('HOCKEY')) return 'Hockey';
  if (base.includes('SOCCER') || base.includes('MLS') || base.includes('FIFA')) return 'Soccer';
  if (base.includes('SPORT')) return 'Sports';
  if (base.includes('TRUMP') || base.includes('BIDEN') || base.includes('ELECTION') || base.includes('CONGRESS') || base.includes('SENATE') || base.includes('PRESIDENT')) return 'Politics';
  if (base.includes('FED') || base.includes('CPI') || base.includes('GDP') || base.includes('RATE') || base.includes('INFLATION')) return 'Economics';
  if (base.includes('BTC') || base.includes('ETH') || base.includes('CRYPTO')) return 'Crypto';
  if (base.includes('AI') || base.includes('TECH') || base.includes('SOFTWARE')) return 'Tech';
  if (base.includes('MOVIE') || base.includes('MUSIC') || base.includes('TV') || base.includes('CULTURE')) return 'Culture';
  if (base.includes('COMPANY') || base.includes('EARNINGS') || base.includes('CEO') || base.includes('AAPL') || base.includes('NVDA') || base.includes('TSLA')) return 'Companies';
  if (base.includes('BANK') || base.includes('FINANCE')) return 'Financials';
  return market.category || 'Other';
};

const isSportsCategory = (category) => {
  return ['Basketball', 'Football', 'Baseball', 'Hockey', 'Soccer', 'Sports'].includes(category);
};

const getYesPercent = (market) => {
  const raw = market?.yesPercent ?? market?.yes;
  const num = toPercent(raw);
  if (!Number.isFinite(num)) return 50;
  return Math.max(0, Math.min(100, num));
};

const getNoPercent = (market, yesPercent) => {
  const raw = market?.noPercent ?? market?.no;
  const num = toPercent(raw);
  if (Number.isFinite(num)) return Math.max(0, Math.min(100, num));
  return Math.max(0, Math.min(100, 100 - yesPercent));
};

const getCloseTimestamp = (market) => {
  const value = market?.closeTime || market?.close_time || market?.expiration_time;
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const formatEventTime = (market) => {
  const value = market?.close_time || market?.closeTime || market?.expiration_time;
  if (!value) return 'TBD';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'TBD';
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} @ ${timeLabel}`;
};

const formatCloseLabel = (market) => {
  const ts = getCloseTimestamp(market);
  if (!ts) return 'Live';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isMarketLive = (market) => {
  if (!market) return false;
  if (market.is_live === true) return true;
  if (market.event_live === true) return true;
  if (market.live === true) return true;
  if (market.in_play === true) return true;
  if (market.inPlay === true) return true;
  const status = String(market.status || '').toLowerCase();
  return status === 'live' || status === 'in_play' || status === 'inplay';
};

const hashString = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash;
};

const getRangeFromHash = (hash, min, max, step = 0.5) => {
  const steps = Math.floor((max - min) / step) + 1;
  const idx = Math.abs(hash) % steps;
  return min + idx * step;
};

const toAmericanOdds = (percent) => {
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) return '—';
  const p = percent / 100;
  if (p >= 0.5) return `-${Math.round((p / (1 - p)) * 100)}`;
  return `+${Math.round(((1 - p) / p) * 100)}`;
};

const getTotalRange = (category) => {
  switch (category) {
    case 'Basketball':
      return [180, 250];
    case 'Football':
      return [35, 55];
    case 'Baseball':
      return [6, 12];
    case 'Hockey':
      return [4, 8];
    case 'Soccer':
      return [1, 4];
    default:
      return [10, 80];
  }
};

const getSpreadRange = (category) => {
  switch (category) {
    case 'Basketball':
      return [1, 15];
    case 'Football':
      return [1, 10];
    case 'Baseball':
      return [0.5, 3.5];
    case 'Hockey':
      return [0.5, 2.5];
    case 'Soccer':
      return [0.5, 1.5];
    default:
      return [1, 5];
  }
};

const parseTeams = (title = '') => {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (!cleaned) return ['Team A', 'Team B'];
  const stripYesNo = (value) => value.replace(/^(yes|no)\s+/i, '').trim();
  const matchupParts = cleaned.split(/\s+(?:at|vs\.?|v|@)\s+/i);
  if (matchupParts.length >= 2) return [stripYesNo(matchupParts[0]), stripYesNo(matchupParts[1])];
  if (cleaned.includes(',')) {
    const commaParts = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
    if (commaParts.length >= 2) return [stripYesNo(commaParts[0]), stripYesNo(commaParts[1])];
  }
  if (/\s+and\s+/i.test(cleaned)) {
    const andParts = cleaned.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
    if (andParts.length >= 2) return [stripYesNo(andParts[0]), stripYesNo(andParts[1])];
  }
  return [stripYesNo(cleaned), 'Opponent'];
};

const getInitials = (name = '') => {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(' ').filter(Boolean);
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const shoePalette = [
  { bg: '#15211b', fg: '#2ee8ad' },
  { bg: '#1b1f2d', fg: '#8fb4ff' },
  { bg: '#241a1f', fg: '#ff9bb8' },
  { bg: '#242018', fg: '#f2c36b' },
  { bg: '#1f1f1f', fg: '#9ef0ff' }
];

const ShoeIcon = ({ teamName = '' }) => {
  const palette = shoePalette[Math.abs(hashString(teamName)) % shoePalette.length];
  return (
    <div
      className="h-9 w-9 rounded-xl border border-[#2a2a2a] flex items-center justify-center"
      style={{ backgroundColor: palette.bg }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 15.6c2.4 0 4.7-.7 6.8-2.1l2.2-1.5c.6-.4 1.4-.5 2.1-.2l4.7 1.6c1.7.6 3.1 1.9 3.7 3.6l.2.5H4.1c-.6 0-1.1-.5-1.1-1.1v-.8z"
          fill={palette.fg}
        />
        <path d="M3 18.6h18" stroke={palette.fg} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
};

const getLiveMeta = (category, marketId) => {
  const hash = hashString(`${category}-${marketId}`);
  const clocks = {
    Basketball: 12,
    Football: 15,
    Baseball: 9,
    Hockey: 20,
    Soccer: 45,
    Sports: 12
  };
  const periods = {
    Basketball: ['1ST', '2ND', '3RD', '4TH', 'OT'],
    Football: ['1ST', '2ND', '3RD', '4TH', 'OT'],
    Baseball: ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH'],
    Hockey: ['1ST', '2ND', '3RD', 'OT'],
    Soccer: ['1H', '2H', 'ET'],
    Sports: ['1ST', '2ND', '3RD']
  };
  const maxMinutes = clocks[category] || 12;
  const periodOptions = periods[category] || ['1ST'];
  const minutes = (hash % maxMinutes) + 1;
  const seconds = (hash * 7) % 60;
  const period = periodOptions[hash % periodOptions.length];
  return {
    period,
    clock: `${minutes}:${seconds.toString().padStart(2, '0')}`
  };
};

const getScores = (category, marketId, isLive) => {
  if (!isLive) return ['—', '—'];
  const hash = hashString(`${category}-${marketId}`);
  const scoreA = Math.abs(hash) % 130;
  const scoreB = Math.abs(hash * 7) % 130;
  return [scoreA.toString(), scoreB.toString()];
};

const buildSportLines = (category, market, yesPercent) => {
  const hash = hashString(`${market?.id || ''}${market?.ticker || ''}${market?.title || ''}`);
  const [totalMin, totalMax] = getTotalRange(category);
  const [spreadMin, spreadMax] = getSpreadRange(category);
  const totalValue = getRangeFromHash(hash + 11, totalMin, totalMax, 0.5).toFixed(1);
  const spreadValue = getRangeFromHash(hash + 31, spreadMin, spreadMax, 0.5).toFixed(1);
  const favoriteFirst = yesPercent >= 50;
  const spreadA = favoriteFirst ? `-${spreadValue}` : `+${spreadValue}`;
  const spreadB = favoriteFirst ? `+${spreadValue}` : `-${spreadValue}`;
  const moneyA = toAmericanOdds(yesPercent);
  const moneyB = toAmericanOdds(100 - yesPercent);

  return {
    spreadA,
    spreadB,
    moneyA,
    moneyB,
    totalOver: `o${totalValue}`,
    totalUnder: `u${totalValue}`
  };
};

const PredictionCard = ({ market }) => {
  const yesPercent = getYesPercent(market);
  const noPercent = getNoPercent(market, yesPercent);
  const volume = Number(market?.volume || 0);
  const yesVolume = Number.isFinite(volume) ? volume * (yesPercent / 100) : 0;
  const noVolume = Number.isFinite(volume) ? volume - yesVolume : 0;
  const category = inferCategory(market);
  const isLive = isMarketLive(market);
  const closeLabel = formatCloseLabel(market);
  const marketId = market?.ticker || market?.id;

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#111111] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white leading-snug line-clamp-2">
            {market.title || market.ticker}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
            {isLive && (
              <span className="inline-flex items-center gap-2 text-red-400 uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Live
              </span>
            )}
            <span>{closeLabel}</span>
          </div>
        </div>
        <span className="rounded-full border border-[#2a2a2a] bg-[#151515] px-2 py-1 text-[10px] uppercase tracking-widest text-white/50">
          {category}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-white/50">Yes</div>
          <div className="text-xl font-semibold text-[#29e1a6]">{Math.round(yesPercent)}%</div>
          <div className="text-[10px] text-white/40">Vol {formatVolume(yesVolume)}</div>
        </div>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-white/50">No</div>
          <div className="text-xl font-semibold text-[#ff6b6b]">{Math.round(noPercent)}%</div>
          <div className="text-[10px] text-white/40">Vol {formatVolume(noVolume)}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-white/50">
        <span>${formatVolume(volume)} vol</span>
        <a
          href={marketId ? `https://kalshi.com/markets/${marketId}` : 'https://kalshi.com/markets'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#0f1b1a] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6cf2c5] transition-all hover:border-[#29e1a6]/70 hover:bg-[#123126] hover:shadow-[0_0_12px_rgba(41,225,166,0.2)]"
        >
          Trade on Kalshi →
        </a>
      </div>
    </div>
  );
};

const OddsCell = ({ line, odds, variant = 'standard' }) => {
  const hasLine = line !== undefined && line !== null && String(line).trim() !== '' && line !== '—';
  const hasOdds = odds !== undefined && odds !== null && String(odds).trim() !== '' && odds !== '—';
  const displayLine = hasLine ? line : '—';
  const displayOdds = hasOdds ? odds : 'Bid';
  const displayMoney = hasLine ? line : 'Bid';
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-center py-2.5 px-2.5">
      {variant === 'money' ? (
        <div className="text-[15px] font-semibold text-[#29e1a6]">{displayMoney}</div>
      ) : (
        <>
          <div className="text-[15px] font-semibold text-white/90">{displayLine}</div>
          <div className="text-[10px] text-[#29e1a6]">{displayOdds}</div>
        </>
      )}
    </div>
  );
};

const SportsBetCard = ({ market }) => {
  const yesPercent = getYesPercent(market);
  const noPercent = getNoPercent(market, yesPercent);
  const category = inferCategory(market);
  const marketId = market?.ticker || market?.id || market?.title || '';
  const [teamA, teamB] = parseTeams(market.title || market.ticker || '');
  const isLive = isMarketLive(market);
  const [scoreA, scoreB] = getScores(category, marketId, isLive);
  const lines = buildSportLines(category, market, yesPercent);
  const liveMeta = getLiveMeta(category, marketId);
  const eventTime = formatEventTime(market);
  const volumeLabel = formatVolumeLong(market.volume || 0);

  return (
    <div className="rounded-2xl border-2 border-[#2c2c2c] bg-[#111111] p-7 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-white leading-snug line-clamp-2">
            {market.title || market.ticker}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
            {isLive ? (
              <>
                <span className="inline-flex items-center gap-2 text-red-400 uppercase tracking-widest">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  LIVE
                </span>
                <span className="text-white/30">·</span>
                <span className="uppercase tracking-wider text-white/60">{liveMeta.period}</span>
                <span className="text-white/30">-</span>
                <span className="text-white/60">{liveMeta.clock}</span>
              </>
            ) : (
              <span className="text-white/50">{eventTime}</span>
            )}
          </div>
        </div>
        <span className="rounded-full border border-[#2a2a2a] bg-[#151515] px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/50">
          {category}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_1.1fr] gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ShoeIcon teamName={teamA} />
            <div className="h-9 w-10 rounded-lg bg-[#171717] border border-[#2a2a2a] flex items-center justify-center text-[11px] font-semibold text-white/70">
              {getInitials(teamA)}
            </div>
            <div className="flex-1 text-sm text-white/90">{teamA}</div>
            <div className="h-9 w-11 rounded-md border border-[#2a2a2a] bg-[#151515] flex items-center justify-center text-sm text-white/80">
              {scoreA}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShoeIcon teamName={teamB} />
            <div className="h-9 w-10 rounded-lg bg-[#171717] border border-[#2a2a2a] flex items-center justify-center text-[11px] font-semibold text-white/70">
              {getInitials(teamB)}
            </div>
            <div className="flex-1 text-sm text-white/90">{teamB}</div>
            <div className="h-9 w-11 rounded-md border border-[#2a2a2a] bg-[#151515] flex items-center justify-center text-sm text-white/80">
              {scoreB}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-[11px] text-white/40 uppercase tracking-widest">
            <div className="text-center">Spread</div>
            <div className="text-center">Money</div>
            <div className="text-center">Total</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <OddsCell line={lines.spreadA} odds={toAmericanOdds(yesPercent)} />
            <OddsCell line={lines.moneyA} variant="money" />
            <OddsCell line={lines.totalOver} odds={toAmericanOdds(yesPercent)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <OddsCell line={lines.spreadB} odds={toAmericanOdds(noPercent)} />
            <OddsCell line={lines.moneyB} variant="money" />
            <OddsCell line={lines.totalUnder} odds={toAmericanOdds(noPercent)} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-white/40">
        <span>${volumeLabel} vol</span>
        <span>Spread and Total · 2 markets</span>
      </div>
    </div>
  );
};

const CategorySection = ({ title, markets }) => {
  const sportsLayout = isSportsCategory(title);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold text-white">{title}</div>
        <span className="text-[#29e1a6] text-2xl leading-none">›</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {markets.map((market) =>
          sportsLayout ? (
            <SportsBetCard key={market.id || market.ticker} market={market} />
          ) : (
            <PredictionCard key={market.id || market.ticker} market={market} />
          )
        )}
      </div>
    </section>
  );
};

const PredictionsPage = () => {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState('');

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/kalshi/markets`);
      url.searchParams.set('limit', '200');

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load markets');
      setMarkets(data.markets || []);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err?.message || 'Unable to load Kalshi markets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(interval);
  }, []);

  const groupedMarkets = useMemo(() => {
    const grouped = {};
    markets.forEach((market) => {
      const category = inferCategory(market);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(market);
    });
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    });
    return grouped;
  }, [markets]);

  const categoryOrder = useMemo(() => {
    const base = [
      'Basketball',
      'Football',
      'Baseball',
      'Hockey',
      'Soccer',
      'Sports',
      'Politics',
      'Economics',
      'Crypto',
      'Tech',
      'Culture',
      'Companies',
      'Financials',
      'Other'
    ];
    const present = new Set(Object.keys(groupedMarkets));
    const ordered = base.filter((cat) => present.has(cat));
    const extras = Array.from(present).filter((cat) => !ordered.includes(cat));
    return [...ordered, ...extras];
  }, [groupedMarkets]);

  const hasMarkets = categoryOrder.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0b] text-white p-4 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#29e1a6]" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-white">Kalshi Predictions</h1>
          </div>
          <p className="text-sm text-white/50 mt-1">
            {loading
              ? 'Updating live markets...'
              : lastUpdate
                ? `Updated ${lastUpdate.toLocaleTimeString()}`
                : 'Live prediction markets'}
          </p>
        </div>
        <button
          onClick={fetchMarkets}
          disabled={loading}
          className="p-2 rounded-lg border border-[#1f1f1f] text-white/60 hover:text-white hover:border-[#29e1a6]/50 hover:bg-white/5 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading && markets.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#1f1f1f] bg-[#111111] p-5 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-2/3 mb-2" />
              <div className="h-4 bg-white/10 rounded w-4/5" />
              <div className="mt-4 h-24 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : !hasMarkets ? (
        <div className="text-white/40 text-sm">No markets found.</div>
      ) : (
        <div className="space-y-10">
          {categoryOrder.map((category) => (
            <CategorySection key={category} title={category} markets={groupedMarkets[category]} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PredictionsPage;
