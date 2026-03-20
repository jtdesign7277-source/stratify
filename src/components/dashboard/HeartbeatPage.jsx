import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, Brain, Zap, TrendingUp, CheckCircle, XCircle, RefreshCw, ChevronRight } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v) {
  if (v == null) return '—';
  return (v * 100).toFixed(1) + '%';
}
function fmtNum(v, decimals = 4) {
  if (v == null) return '—';
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

// Friendly param display names
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

// ─── Brain Status Bar ─────────────────────────────────────────────────────────

function BrainStatusBar({ bestParams, experiments }) {
  const latest = experiments[0];
  const kept = experiments.filter(e => e.status === 'keep').length;
  const discarded = experiments.filter(e => e.status === 'discard').length;
  const winRate = bestParams?.win_rate ?? latest?.win_rate;
  const bestScore = bestParams?.score ?? 0;
  const totalExps = experiments.length;

  return (
    <div
      className="w-full flex flex-wrap gap-4 p-4 rounded-xl border border-white/10 mb-5"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a' }}
    >
      {/* Win Rate */}
      <div className="flex flex-col min-w-[130px]">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Current Win Rate</span>
        <span className={`text-3xl font-bold font-mono ${winRateColor(winRate)}`}>
          {winRate != null ? fmtPct(winRate) : '—'}
        </span>
        <span className="text-[11px] text-gray-500 mt-0.5">Target: 70–80%</span>
      </div>

      <div className="w-px h-auto bg-white/10 self-stretch hidden sm:block" />

      {/* Total Experiments */}
      <div className="flex flex-col min-w-[110px]">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Experiments</span>
        <span className="text-2xl font-bold text-white font-mono">{totalExps}</span>
        <span className="text-[11px] text-gray-500 mt-0.5">Total run</span>
      </div>

      <div className="w-px h-auto bg-white/10 self-stretch hidden sm:block" />

      {/* Best Score */}
      <div className="flex flex-col min-w-[110px]">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Best Score</span>
        <span className="text-2xl font-bold text-blue-400 font-mono">{fmtNum(bestScore, 4)}</span>
        <span className="text-[11px] text-gray-500 mt-0.5">Composite</span>
      </div>

      <div className="w-px h-auto bg-white/10 self-stretch hidden sm:block" />

      {/* Keep / Discard */}
      <div className="flex flex-col min-w-[130px]">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Kept / Discarded</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xl font-bold text-emerald-400 font-mono">{kept}</span>
          <span className="text-gray-600">/</span>
          <span className="text-xl font-bold text-red-400 font-mono">{discarded}</span>
        </div>
        <span className="text-[11px] text-gray-500 mt-0.5">
          {totalExps > 0 ? `${fmtPct(kept / totalExps)} hit rate` : 'No data yet'}
        </span>
      </div>

      {/* Brain icon */}
      <div className="ml-auto flex items-center">
        <Brain className="w-8 h-8 text-blue-500/40" strokeWidth={1.5} />
      </div>
    </div>
  );
}

// ─── TradingView Chart (BTC/USD 5-min) ───────────────────────────────────────

function BTCChart() {
  return (
    <div
      className="rounded-xl border border-white/10 p-4 mb-5 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-gray-500 uppercase tracking-widest">BINANCE:BTCUSDT · 5-min · Training Universe</span>
      </div>
      <div style={{ height: 500, width: '100%' }}>
        <iframe
          src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview-heartbeat&symbol=BINANCE:BTCUSDT&interval=5&theme=dark&style=1&locale=en&toolbar_bg=%23060d18&enable_publishing=false&hide_side_toolbar=false&allow_symbol_change=false&container_id=tradingview-heartbeat"
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
          title="BTC/USD 5-min TradingView Chart"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// ─── Experiment Feed ──────────────────────────────────────────────────────────

function ExperimentFeed({ experiments, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 p-6 flex items-center justify-center h-48"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a' }}>
        <RefreshCw className="w-5 h-5 text-gray-600 animate-spin" />
      </div>
    );
  }

  if (!experiments.length) {
    return (
      <div className="rounded-xl border border-white/10 p-6 flex items-center justify-center h-48"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a' }}>
        <span className="text-gray-600 text-sm">No experiments yet — training will start shortly</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-white/10 mb-5 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[11px] text-gray-500 uppercase tracking-widest">Live Experiment Feed</span>
        <span className="text-[11px] text-gray-600">{experiments.length} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['#', 'Parameter', 'Old → New', 'Win Rate', 'PnL', 'Score', 'Status'].map(col => (
                <th key={col} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {experiments.map((exp, i) => {
              const isKeep = exp.status === 'keep';
              const rowBg = isKeep
                ? 'rgba(52,211,153,0.04)'
                : 'transparent';
              return (
                <tr
                  key={exp.id || i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  style={{ backgroundColor: rowBg }}
                >
                  <td className="px-3 py-2 text-gray-500 font-mono">{exp.iteration}</td>
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                    {PARAM_LABELS[exp.tweaked_key] || exp.tweaked_key}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap">
                    {exp.tweaked_val != null ? (
                      <span>
                        <span className="text-gray-600">?</span>
                        <ChevronRight className="inline w-3 h-3 mx-0.5 text-gray-600" />
                        <span className={isKeep ? 'text-emerald-400' : 'text-gray-300'}>{exp.tweaked_val}</span>
                      </span>
                    ) : '—'}
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

// ─── Parameter State Panel ────────────────────────────────────────────────────

function ParameterState({ bestParams }) {
  const params = bestParams?.params || {};
  const entries = Object.entries(PARAM_LABELS);

  return (
    <div
      className="rounded-xl border border-white/10 p-4 h-fit"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a' }}
    >
      <div className="flex items-center gap-2 mb-4 border-b border-white/[0.06] pb-3">
        <Zap className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
        <span className="text-[11px] text-gray-500 uppercase tracking-widest">Current Best Params</span>
      </div>
      <div className="space-y-2.5">
        {entries.map(([key, label]) => {
          const val = params[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-[12px] text-gray-400 whitespace-nowrap">{label}</span>
              <span className="text-[12px] font-mono text-white tabular-nums">
                {val != null ? val : <span className="text-gray-600">—</span>}
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

// ─── Inline SVG sparkline chart ───────────────────────────────────────────────

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

  // Grid lines
  const gridY = [0.25, 0.5, 0.75].map(f => ({
    y: pad.top + innerH * (1 - f),
    label: (lo + range * f).toFixed(range < 1 ? 4 : 1),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {gridY.map((g, i) => (
        <line key={i} x1={pad.left} y1={g.y} x2={W - pad.right} y2={g.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      {/* Area fill */}
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ─── Performance Charts ───────────────────────────────────────────────────────

function PerformanceCharts({ experiments }) {
  const sorted = [...experiments].reverse();
  const winRateData = sorted.map(e => e.win_rate != null ? parseFloat((e.win_rate * 100).toFixed(2)) : null).filter(v => v != null);
  const scoreData = sorted.map(e => e.score != null ? parseFloat(e.score.toFixed(4)) : null).filter(v => v != null);

  const chartStyle = {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
      <div className="rounded-xl border border-white/10 p-4" style={chartStyle}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
          <span className="text-[11px] text-gray-500 uppercase tracking-widest">Win Rate Trend</span>
        </div>
        <SparkLine data={winRateData} color="#34d399" minVal={0} maxVal={100} />
      </div>

      <div className="rounded-xl border border-white/10 p-4" style={chartStyle}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
          <span className="text-[11px] text-gray-500 uppercase tracking-widest">Composite Score Trend</span>
        </div>
        <SparkLine data={scoreData} color="#60a5fa" minVal={0} maxVal={1} />
      </div>
    </div>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function Controls({ onApplyToLive, isPaused, onTogglePause }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex items-center gap-3 mt-5 mb-6">
      {/* Apply to Live */}
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
      >
        <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
        Apply to Live
      </button>

      {/* Pause Training */}
      <button
        onClick={onTogglePause}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
          isPaused
            ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30'
            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        {isPaused ? (
          <><Activity className="w-4 h-4" strokeWidth={1.5} /> Resume Training</>
        ) : (
          <><Activity className="w-4 h-4" strokeWidth={1.5} /> Pause Training</>
        )}
      </button>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-2xl border border-white/10 p-6 max-w-sm w-full mx-4"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%), #0a0a0a' }}
          >
            <h3 className="text-white font-semibold mb-2">Apply Best Params to Live?</h3>
            <p className="text-gray-400 text-[13px] mb-5">
              This will push the current best-scoring parameters from autoresearch into Sentinel's live trading configuration. Confirm before proceeding.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); onApplyToLive?.(); }}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30s auto-refresh

export default function HeartbeatPage() {
  const [experiments, setExperiments] = useState([]);
  const [bestParams, setBestParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

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
    <div
      className="h-full w-full overflow-y-auto"
      style={{ background: '#060d18' }}
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold text-white">Heartbeat</h1>
              <p className="text-[11px] text-gray-500">Sentinel autoresearch training status · tag: auto</p>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-gray-400 border border-white/10 hover:bg-white/5 hover:text-gray-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              Refresh
            </button>
          </div>
        </div>

        {/* Brain Status Bar */}
        <BrainStatusBar bestParams={bestParams} experiments={experiments} />

        {/* BTC Chart */}
        <BTCChart />

        {/* Main grid: feed + params */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
          <div>
            <ExperimentFeed experiments={experiments} loading={loading} />
          </div>
          <div>
            <ParameterState bestParams={bestParams} />
          </div>
        </div>

        {/* Performance Charts */}
        <PerformanceCharts experiments={experiments} />

        {/* Controls */}
        <Controls
          isPaused={isPaused}
          onTogglePause={() => setIsPaused(p => !p)}
          onApplyToLive={() => {
            // Wired later
            console.log('[Heartbeat] Apply to live triggered');
          }}
        />
      </div>
    </div>
  );
}
