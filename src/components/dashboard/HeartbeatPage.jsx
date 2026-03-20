import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, Brain, Zap, TrendingUp, CheckCircle, XCircle, RefreshCw, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

// âââ Helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function fmtPct(v) {
  if (v == null) return 'â';
  return (v * 100).toFixed(1) + '%';
}
function fmtNum(v, decimals = 4) {
  if (v == null) return 'â';
  return Number(v).toFixed(decimals);
}
function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function winRateColor(wr) {
  if (wr == null) return 'text-gray-400';
  if (wr >= 0.65) return 'text-emerald-400';
  if (wr >= 0.50) return 'text-yellow-400';
  return 'text-red-400';
}

function dangerColors(label) {
  switch (label) {
    case 'EXTREME': return { text: 'text-red-400', border: 'border-red-500/50', dot: 'bg-red-500', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]' };
    case 'HIGH':    return { text: 'text-orange-400', border: 'border-orange-500/40', dot: 'bg-orange-500', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.2)]' };
    case 'ELEVATED':return { text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-500', glow: '' };
    default:        return { text: 'text-gray-500', border: 'border-white/[0.06]', dot: 'bg-gray-600', glow: '' };
  }
}

const PARAM_LABELS = {
  bayes_threshold: 'Bayes Threshold',
  min_confidence_scalp: 'Min Confidence',
  stop_mult_scalp: 'Stop Multiplier',
  target_mult_scalp: 'Target Multiplier',
  ema_fast: 'EMA Fast',
  ema_slow: 'EMA Slow',
  rsi_oversold: 'RSI Oversold',
  rsi_overbought: 'RSI Overbought',
  momentum_burst_threshold: 'Momentum Burst',
  mean_reversion_threshold: 'Mean Reversion',
  spread_cost_pct: 'Spread Cost %',
  kelly_max_risk: 'Kelly Max Risk',
  mc_max_drawdown: 'Max Drawdown',
};

const GLASS = 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]';

// âââ BTC Price Hook âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function useBTCPrice() {
  const [price, setPrice] = useState(null);
  const [change, setChange] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrice() {
      try {
        const res = await fetch('/api/xray/quote?symbol=BTC%2FUSD');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const p = json.close ?? json.price ?? json.last_price;
        const c = json.percent_change ?? json.change_percent;
        if (p != null) setPrice(parseFloat(p));
        if (c != null) setChange(parseFloat(c));
      } catch {
        // silent
      }
    }
    fetchPrice();
    const timer = setInterval(fetchPrice, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return { price, change };
}

// âââ Brain Status Bar (with inline controls) ââââââââââââââââââââââââââââââââââ

function BrainStatusBar({ bestParams, experiments, isPaused, onTogglePause, onApplyToLive }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { price: btcPrice, change: btcChange } = useBTCPrice();
  const latest = experiments[0];
  const kept = experiments.filter(e => e.status === 'keep').length;
  const discarded = experiments.filter(e => e.status === 'discard').length;
  const winRate = bestParams?.win_rate ?? latest?.win_rate;
  const bestScore = bestParams?.score ?? 0;
  const totalExps = experiments.length;

  return (
    <>
      <div className={`${GLASS} w-full flex flex-wrap items-center gap-4 px-5 py-4 mb-5`}>
        {/* BTC Live Price */}
        <div className="flex flex-col min-w-[140px]">
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">BTC / USD</span>
          <span className="text-2xl font-bold font-mono text-white">
            {btcPrice != null ? `$${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'â'}
          </span>
          {btcChange != null && (
            <span className={`text-[11px] font-mono mt-0.5 ${btcChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}% 24h
            </span>
          )}
        </div>

        <div className="w-px h-10 bg-white/[0.06] hidden sm:block" />

        {/* Win Rate */}
        <div className="flex flex-col min-w-[120px]">
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">Win Rate</span>
          <span className={`text-2xl font-bold font-mono ${winRateColor(winRate)}`}>
            {winRate != null ? fmtPct(winRate) : 'â'}
          </span>
          <span className="text-[11px] text-gray-600 mt-0.5">Target: 70â80%</span>
        </div>

        <div className="w-px h-10 bg-white/[0.06] hidden sm:block" />

        {/* Total Experiments */}
        <div className="flex flex-col min-w-[90px]">
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">Experiments</span>
          <span className="text-2xl font-bold text-white font-mono">{totalExps}</span>
          <span className="text-[11px] text-gray-600 mt-0.5">Total run</span>
        </div>

        <div className="w-px h-10 bg-white/[0.06] hidden sm:block" />

        {/* Best Score */}
        <div className="flex flex-col min-w-[100px]">
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">Best Score</span>
          <span className="text-2xl font-bold text-blue-400 font-mono">{fmtNum(bestScore, 4)}</span>
          <span className="text-[11px] text-gray-600 mt-0.5">Composite</span>
        </div>

        <div className="w-px h-10 bg-white/[0.06] hidden sm:block" />

        {/* Keep / Discard */}
        <div className="flex flex-col min-w-[110px]">
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">Kept / Discarded</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xl font-bold text-emerald-400 font-mono">{kept}</span>
            <span className="text-gray-600">/</span>
            <span className="text-xl font-bold text-red-400 font-mono">{discarded}</span>
          </div>
          <span className="text-[11px] text-gray-600 mt-0.5">
            {totalExps > 0 ? `${fmtPct(kept / totalExps)} hit rate` : 'No data yet'}
          </span>
        </div>

        <div className="w-px h-10 bg-white/[0.06] hidden sm:block" />

        {/* Inline Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
            Apply to Live
          </button>
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
              isPaused
                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20'
                : 'bg-white/[0.04] border-white/[0.06] text-gray-400 hover:bg-white/[0.08]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" strokeWidth={1.5} />
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <Brain className="w-6 h-6 text-blue-500/30 ml-1" strokeWidth={1.5} />
        </div>
      </div>

      {/* Apply to Live confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className={`${GLASS} p-6 max-w-sm w-full mx-4`}>
            <h3 className="text-white font-semibold mb-2">Apply Best Params to Live?</h3>
            <p className="text-gray-400 text-[13px] mb-5">
              This will push the current best-scoring parameters from autoresearch into Sentinel's live trading configuration. Confirm before proceeding.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); onApplyToLive?.(); }}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// âââ TradingView Chart (BTC/USD 5-min) âââââââââââââââââââââââââââââââââââââââ

function BTCChart({ bestParams, experiments, dangerLevel }) {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { price: btcPrice, change: btcChange } = useBTCPrice();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container';
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'BINANCE:BTCUSDT',
      interval: '5',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#0a0a0f',
      gridColor: 'rgba(255,255,255,0.03)',
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      hide_volume: false,
      enable_publishing: false,
    });

    wrapper.appendChild(widgetDiv);
    wrapper.appendChild(script);
    container.appendChild(wrapper);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, []);

  const dl = dangerLevel;
  const dlColors = dangerColors(dl?.danger_label);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col">
        {/* Compact metrics bar â always visible in fullscreen */}
        <div className="flex-shrink-0 flex items-center gap-5 px-5 border-b border-white/[0.06] bg-[#0c0c14]/90 backdrop-blur-md" style={{ height: 42 }}>
          {/* BTC price */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">BTC</span>
            <span className="text-[12px] font-mono font-medium text-white">
              {btcPrice != null ? `$${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'â'}
            </span>
            {btcChange != null && (
              <span className={`text-[10px] font-mono ${btcChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%
              </span>
            )}
          </div>

          <div className="w-px h-4 bg-white/[0.06]" />

          {/* Win rate */}
          {(bestParams?.win_rate ?? experiments[0]?.win_rate) != null && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-600">Win Rate</span>
                <span className={`text-[11px] font-mono font-medium ${winRateColor(bestParams?.win_rate ?? experiments[0]?.win_rate)}`}>
                  {fmtPct(bestParams?.win_rate ?? experiments[0]?.win_rate)}
                </span>
              </div>
              <div className="w-px h-4 bg-white/[0.06]" />
            </>
          )}

          {/* Danger level */}
          {dl && (
            <>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${dlColors.dot} ${dl.danger_label === 'EXTREME' ? 'animate-pulse' : ''}`} />
                <span className={`text-[11px] font-mono font-medium ${dlColors.text}`}>{dl.danger_label ?? 'NORMAL'}</span>
                <span className="text-[10px] text-gray-600 font-mono">{dl.danger_score}/100</span>
              </div>
              <div className="w-px h-4 bg-white/[0.06]" />
            </>
          )}

          {/* Composite score */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-600">Score</span>
            <span className="text-[11px] font-mono font-medium text-blue-400">{fmtNum(bestParams?.score ?? 0, 4)}</span>
          </div>

          <div className="w-px h-4 bg-white/[0.06]" />

          {/* Experiments */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-600">Experiments</span>
            <span className="text-[11px] font-mono font-medium text-white">{experiments.length}</span>
          </div>

          {/* Exit button */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
          >
            <Minimize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Exit Fullscreen
          </button>
        </div>

        {/* Chart fills remaining space */}
        <div ref={containerRef} className="flex-1 min-h-0" />
      </div>
    );
  }

  return (
    <div className={`${GLASS} mb-5 overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">BINANCE:BTCUSDT Â· 5-min Â· Training Universe</span>
        <button
          onClick={() => setIsFullscreen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:text-gray-300 border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
        >
          <Maximize2 className="w-3 h-3" strokeWidth={1.5} />
          Fullscreen
        </button>
      </div>
      <div ref={containerRef} style={{ height: 480, width: '100%' }} />
    </div>
  );
}

// âââ Danger Level Indicator âââââââââââââââââââââââââââââââââââââââââââââââââââ

function DangerIndicator({ dangerLevel }) {
  if (!dangerLevel) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
        <span className="text-sm font-semibold font-mono tracking-widest text-gray-500">NORMAL</span>
        <span className="text-[11px] text-gray-600 font-mono ml-1">0/100</span>
      </div>
    );
  }

  const { danger_score, danger_label, contributing_factors, pattern_match } = dangerLevel;
  const dc = dangerColors(danger_label);
  const isExtreme = danger_label === 'EXTREME';

  return (
    <div className={`flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl border ${dc.border} ${dc.glow} bg-white/[0.02]`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-2.5 h-2.5 rounded-full ${dc.dot} ${isExtreme ? 'animate-pulse' : ''}`} />
        <span className={`text-sm font-semibold font-mono tracking-widest ${dc.text}`}>{danger_label ?? 'NORMAL'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-gray-600">Score</span>
        <span className={`text-[12px] font-mono font-medium ${dc.text}`}>{danger_score ?? 0}/100</span>
      </div>
      {pattern_match && (
        <>
          <div className="w-px h-4 bg-white/[0.06]" />
          <span className="text-[11px] text-gray-400">
            <span className="font-mono">{pattern_match.similarity}%</span> similar to {pattern_match.date}{' '}
            <span className={pattern_match.type === 'CRASH' ? 'text-red-400' : 'text-emerald-400'}>{pattern_match.type}</span>
          </span>
        </>
      )}
      {contributing_factors?.length > 0 && (
        <>
          <div className="w-px h-4 bg-white/[0.06] hidden sm:block" />
          <span className="text-[11px] text-gray-600 truncate hidden sm:block">
            {contributing_factors.slice(0, 3).join(' Â· ')}
          </span>
        </>
      )}
    </div>
  );
}

// âââ Extreme Move Row âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function ExtremeMoveRow({ move, index }) {
  const [expanded, setExpanded] = useState(false);

  const isRip = move.direction === 'RIP' || move.direction === 'UP';
  const dateStr = move.timestamp
    ? new Date(move.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : 'â';

  const topConditions = move.top_conditions || (move.pre_conditions || []).slice(0, 4);
  const allConditions = move.pre_conditions || move.features || [];

  let sentinelImpact = null;
  if (move.sentinel_pnl != null) {
    const pnl = move.sentinel_pnl;
    sentinelImpact = { label: `Had position: ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toLocaleString()}`, positive: pnl >= 0 };
  } else if (move.had_position === false) {
    sentinelImpact = { label: 'No position', positive: null };
  }

  return (
    <div
      className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="text-[11px] text-gray-700 font-mono w-5 shrink-0 text-right">{index + 1}</span>
        <span className="text-[11px] text-gray-500 font-mono whitespace-nowrap w-[115px] shrink-0">{dateStr}</span>
        <span className={`text-[12px] font-mono font-semibold w-12 shrink-0 ${isRip ? 'text-emerald-400' : 'text-red-400'}`}>
          {isRip ? 'RIP' : 'CRASH'}
        </span>
        <span className={`text-[12px] font-mono font-medium w-[120px] shrink-0 ${isRip ? 'text-emerald-400' : 'text-red-400'}`}>
          {move.magnitude != null
            ? `${isRip ? '+' : ''}${typeof move.magnitude === 'number' ? move.magnitude.toFixed(1) : move.magnitude}% / ${move.duration_min ?? '?'}min`
            : 'â'}
        </span>
        <span className="text-[11px] text-gray-500 flex-1 min-w-0 truncate leading-relaxed">
          {topConditions.join(' Â· ') || 'â'}
        </span>
        {sentinelImpact && (
          <span className={`text-[11px] font-mono whitespace-nowrap shrink-0 ${
            sentinelImpact.positive === true ? 'text-emerald-400/70' :
            sentinelImpact.positive === false ? 'text-red-400/70' :
            'text-gray-600'
          }`}>
            {sentinelImpact.label}
          </span>
        )}
        <ChevronRight
          className={`w-3.5 h-3.5 text-gray-700 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          strokeWidth={1.5}
        />
      </div>

      {expanded && allConditions.length > 0 && (
        <div className="px-4 pb-3 bg-white/[0.01] border-t border-white/[0.03]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 pl-[calc(1.25rem+3px+115px+3px+3rem+3px)]">
            {allConditions.map((cond, i) => (
              <span key={i} className="text-[11px] text-gray-500 font-mono">{cond}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// âââ Market Memory Section ââââââââââââââââââââââââââââââââââââââââââââââââââââ

function MarketMemory({ onDangerLevel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMoves = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel/extreme-moves?limit=20');
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
      if (json.dangerLevel && onDangerLevel) onDangerLevel(json.dangerLevel);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [onDangerLevel]);

  useEffect(() => {
    fetchMoves();
    const timer = setInterval(fetchMoves, 30_000);
    return () => clearInterval(timer);
  }, [fetchMoves]);

  const moves = data?.moves || [];
  const dangerLevel = data?.dangerLevel;
  const stats = data?.stats;

  return (
    <div className={`${GLASS} mb-5 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Market Memory</span>
        {stats && (
          <div className="flex items-center gap-4 text-[11px] text-gray-600">
            <span><span className="font-mono text-gray-400">{stats.totalMoves}</span> events</span>
            <span>
              <span className="font-mono text-red-400">{stats.crashes}</span> crashes
              {' Â· '}
              <span className="font-mono text-emerald-400">{stats.rips}</span> rips
            </span>
            {stats.avgMagnitude != null && (
              <span>avg <span className="font-mono text-gray-400">{Number(stats.avgMagnitude).toFixed(1)}%</span></span>
            )}
          </div>
        )}
      </div>

      {/* Danger indicator */}
      <div className="px-4 pt-3 pb-2">
        {loading ? (
          <div className="flex items-center gap-2 h-10">
            <RefreshCw className="w-3.5 h-3.5 text-gray-600 animate-spin" />
            <span className="text-[11px] text-gray-600">Loading extreme movesâ¦</span>
          </div>
        ) : (
          <DangerIndicator dangerLevel={dangerLevel} />
        )}
      </div>

      {/* Timeline */}
      {!loading && moves.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-gray-600 text-[13px]">
          No extreme moves recorded yet
        </div>
      ) : moves.length > 0 ? (
        <>
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-1.5 border-t border-white/[0.04]">
            <span className="text-[10px] text-gray-700 font-medium w-5 shrink-0">#</span>
            <span className="text-[10px] text-gray-700 font-medium w-[115px] shrink-0">Date / Time</span>
            <span className="text-[10px] text-gray-700 font-medium w-12 shrink-0">Dir</span>
            <span className="text-[10px] text-gray-700 font-medium w-[120px] shrink-0">Magnitude</span>
            <span className="text-[10px] text-gray-700 font-medium flex-1">Pre-move Conditions</span>
            <span className="text-[10px] text-gray-700 font-medium pr-6">Sentinel Impact</span>
          </div>
          <div className="overflow-y-auto max-h-[400px]">
            {moves.map((move, i) => (
              <ExtremeMoveRow key={move.id ?? i} move={move} index={i} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// âââ Experiment Feed ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function ExperimentFeed({ experiments, loading }) {
  if (loading) {
    return (
      <div className={`${GLASS} p-6 flex items-center justify-center h-48`}>
        <RefreshCw className="w-5 h-5 text-gray-600 animate-spin" />
      </div>
    );
  }

  if (!experiments.length) {
    return (
      <div className={`${GLASS} p-6 flex items-center justify-center h-48`}>
        <span className="text-gray-600 text-sm">No experiments yet â training will start shortly</span>
      </div>
    );
  }

  return (
    <div className={`${GLASS} mb-5 overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Live Experiment Feed</span>
        <span className="text-[11px] text-gray-600">{experiments.length} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['#', 'Parameter', 'Old â New', 'Win Rate', 'PnL', 'Score', 'Status'].map(col => (
                <th key={col} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {experiments.map((exp, i) => {
              const isKeep = exp.status === 'keep';
              return (
                <tr
                  key={exp.id || i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  style={{ backgroundColor: isKeep ? 'rgba(52,211,153,0.04)' : 'transparent' }}
                >
                  <td className="px-3 py-2 text-gray-500 font-mono">{exp.iteration}</td>
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                    {PARAM_LABELS[exp.tweaked_key] || exp.tweaked_key}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap">
                    {exp.tweaked_val != null ? (
                      <span>
                        <span className="text-gray-500">{exp.tweaked_from ?? '?'}</span>
                        <ChevronRight className="inline w-3 h-3 mx-0.5 text-gray-600" />
                        <span className={isKeep ? 'text-emerald-400' : 'text-gray-300'}>{exp.tweaked_val}</span>
                      </span>
                    ) : 'â'}
                  </td>
                  <td className={`px-3 py-2 font-mono ${winRateColor(exp.win_rate)}`}>
                    {fmtPct(exp.win_rate)}
                  </td>
                  <td className={`px-3 py-2 font-mono ${exp.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtNum(exp.total_pnl, 4)}
                  </td>
                  <td className="px-3 py-2 font-mono text-blue-400">{fmtNum(exp.score, 4)}</td>
                  <td className="px-3 py-2">
                    {isKeep ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> keep
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400/70">
                        <XCircle className="w-3.5 h-3.5" /> discard
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// âââ Parameter State Panel ââââââââââââââââââââââââââââââââââââââââââââââââââââ

function ParameterState({ bestParams }) {
  const params = bestParams?.params || {};

  return (
    <div className={`${GLASS} p-4 h-fit`}>
      <div className="flex items-center gap-2 mb-4 border-b border-white/[0.06] pb-3">
        <Zap className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
        <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Current Best Params</span>
      </div>
      <div className="space-y-2.5">
        {Object.entries(PARAM_LABELS).map(([key, label]) => {
          const val = params[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-[12px] text-gray-400 whitespace-nowrap">{label}</span>
              <span className="text-[12px] font-mono font-medium text-white tabular-nums">
                {val != null ? val : <span className="text-gray-600">â</span>}
              </span>
            </div>
          );
        })}
      </div>
      {bestParams?.updated_at && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <span className="text-[10px] text-gray-600">Updated {fmtShort(bestParams.updated_at)}</span>
        </div>
      )}
    </div>
  );
}

// âââ Inline SVG sparkline chart âââââââââââââââââââââââââââââââââââââââââââââââ

function SparkLine({ data, color, height = 140, minVal, maxVal }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-600 text-sm">
        Not enough data
      </div>
    );
  }

  const W = 500, H = height;
  const pad = { top: 8, right: 8, bottom: 8, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const lo = minVal ?? Math.min(...data);
  const hi = maxVal ?? Math.max(...data);
  const range = hi - lo || 1;

  const toX = (i) => pad.left + (i / (data.length - 1)) * innerW;
  const toY = (v) => pad.top + innerH - ((v - lo) / range) * innerH;

  const points = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPoints = [
    `${toX(0)},${H - pad.bottom}`,
    ...data.map((v, i) => `${toX(i)},${toY(v)}`),
    `${toX(data.length - 1)},${H - pad.bottom}`,
  ].join(' ');

  const gridY = [0.25, 0.5, 0.75].map(f => ({
    y: pad.top + innerH * (1 - f),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridY.map((g, i) => (
        <line key={i} x1={pad.left} y1={g.y} x2={W - pad.right} y2={g.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// âââ Performance Charts âââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function PerformanceCharts({ experiments }) {
  const sorted = [...experiments].reverse();
  const winRateData = sorted.map(e => e.win_rate != null ? parseFloat((e.win_rate * 100).toFixed(2)) : null).filter(v => v != null);
  const scoreData = sorted.map(e => e.score != null ? parseFloat(e.score.toFixed(4)) : null).filter(v => v != null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
      <div className={`${GLASS} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Win Rate Trend</span>
        </div>
        <SparkLine data={winRateData} color="#34d399" minVal={0} maxVal={100} />
      </div>

      <div className={`${GLASS} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Composite Score Trend</span>
        </div>
        <SparkLine data={scoreData} color="#60a5fa" minVal={0} maxVal={1} />
      </div>
    </div>
  );
}

// âââ Main Page ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const POLL_INTERVAL_MS = 30_000;

export default function HeartbeatPage() {
  const [experiments, setExperiments] = useState([]);
  const [bestParams, setBestParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [dangerLevel, setDangerLevel] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel/experiments?tag=auto&limit=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.ok) {
        setExperiments(json.experiments || []);
        setBestParams(json.best_params || null);
        setLastFetch(new Date());
      }
    } catch (err) {
      console.error('[HeartbeatPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            <div>
              <h1 className="text-[15px] font-semibold text-white">Heartbeat</h1>
              <p className="text-[11px] text-gray-500">Sentinel autoresearch training status Â· tag: auto</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastFetch && (
              <span className="text-[11px] text-gray-600">
                Updated {fmtShort(lastFetch.toISOString())}
              </span>
            )}
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              Refresh
            </button>
          </div>
        </div>

        {/* Brain Status Bar with inline Controls */}
        <BrainStatusBar
          bestParams={bestParams}
          experiments={experiments}
          isPaused={isPaused}
          onTogglePause={() => setIsPaused(p => !p)}
          onApplyToLive={() => {
            console.log('[Heartbeat] Apply to live triggered');
          }}
        />

        {/* BTC Chart */}
        <BTCChart bestParams={bestParams} experiments={experiments} dangerLevel={dangerLevel} />

        {/* Market Memory â between chart and experiment feed */}
        <MarketMemory onDangerLevel={setDangerLevel} />

        {/* Main grid: feed + params */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
          <ExperimentFeed experiments={experiments} loading={loading} />
          <ParameterState bestParams={bestParams} />
        </div>

        {/* Performance Charts */}
        <PerformanceCharts experiments={experiments} />
      </div>
    </div>
  );
}
