import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Activity, ArrowUpDown, TrendingUp, TrendingDown, Filter, Zap } from 'lucide-react';
import { API_URL } from '../../config';

const WS_URL = (API_URL || 'https://stratify-backend-production-3ebd.up.railway.app')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws');

const API_BASE = API_URL || 'https://stratify-backend-production-3ebd.up.railway.app';

const formatPremium = (val) => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

const formatStrike = (strike, type) => `$${strike} ${type === 'call' ? 'C' : 'P'}`;

const formatTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatExp = (date) => {
  if (!date) return '—';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const BADGE_COLORS = {
  SWEEP: 'text-purple-400',
  BLOCK: 'text-blue-400',
  UNUSUAL: 'text-amber-400',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'calls', label: 'Calls' },
  { key: 'puts', label: 'Puts' },
  { key: 'sweeps', label: 'Sweeps' },
  { key: '100k', label: '>$100K' },
  { key: '500k', label: '>$500K' },
  { key: '1m', label: '>$1M' },
];

const SkeletonRow = () => (
  <tr className="border-b border-[#1f1f1f]">
    {Array.from({ length: 12 }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
      </td>
    ))}
  </tr>
);

const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;

const OptionsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickerFilter, setTickerFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortCol, setSortCol] = useState('estimatedPremium');
  const [sortDir, setSortDir] = useState('desc');
  const [wsConnected, setWsConnected] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [flashIds, setFlashIds] = useState(new Set());

  const wsRef = useRef(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Flash animation for new alerts
  const flashAlert = useCallback((alertKey) => {
    setFlashIds((prev) => new Set([...prev, alertKey]));
    setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        next.delete(alertKey);
        return next;
      });
    }, 1500);
  }, []);

  // Fetch initial state via REST
  const fetchInitial = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/options/flow`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setAlerts(json.alerts || []);
      setSummary(json.summary || null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket connection
  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;

    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsConnected(true);
      reconnectDelayRef.current = RECONNECT_BASE;
      // Subscribe to options flow channel
      socket.send(JSON.stringify({ action: 'subscribe', channels: ['options_flow'] }));
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === 'options_flow_alert' && data.alert) {
        const alert = data.alert;
        const alertKey = `${alert.symbol}-${alert.timestamp}-${alert.tradeSize}`;

        setAlerts((prev) => {
          const merged = [alert, ...prev];
          merged.sort((a, b) => b.estimatedPremium - a.estimatedPremium);
          return merged.slice(0, 200);
        });

        setLiveCount((c) => c + 1);
        flashAlert(alertKey);
      }

      if (data.type === 'options_flow_summary' && data.summary) {
        setSummary(data.summary);
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
      if (mountedRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, RECONNECT_MAX);
          connectWs();
        }, reconnectDelayRef.current);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [flashAlert]);

  useEffect(() => {
    mountedRef.current = true;
    fetchInitial();
    connectWs();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchInitial, connectWs]);

  // Filtering + sorting
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    if (tickerFilter) result = result.filter((a) => a.underlying === tickerFilter);

    if (typeFilter === 'calls') result = result.filter((a) => a.type === 'call');
    else if (typeFilter === 'puts') result = result.filter((a) => a.type === 'put');
    else if (typeFilter === 'sweeps') result = result.filter((a) => a.badge === 'SWEEP');
    else if (typeFilter === '100k') result = result.filter((a) => a.estimatedPremium > 100_000);
    else if (typeFilter === '500k') result = result.filter((a) => a.estimatedPremium > 500_000);
    else if (typeFilter === '1m') result = result.filter((a) => a.estimatedPremium > 1_000_000);

    result.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    return result;
  }, [alerts, tickerFilter, typeFilter, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const byTicker = summary?.byTicker || {};
  const tickerBadges = useMemo(() => {
    return Object.entries(byTicker)
      .map(([ticker, info]) => ({ ticker, ...info, total: info.calls + info.puts }))
      .sort((a, b) => b.total - a.total);
  }, [byTicker]);

  const SortHeader = ({ col, children, className = '' }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-medium text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/70 select-none ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col && <ArrowUpDown size={10} className={sortDir === 'asc' ? 'rotate-180' : ''} />}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-[#1f1f1f] px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* LIVE indicator */}
          <div className="flex-shrink-0 flex items-center gap-1.5 mr-2">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-[10px] font-medium uppercase tracking-wider ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
            {liveCount > 0 && (
              <span className="text-[10px] text-white/30 ml-1">
                <Zap size={8} className="inline text-amber-400" /> {liveCount}
              </span>
            )}
          </div>

          <button
            onClick={() => setTickerFilter(null)}
            className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded border transition-colors ${
              !tickerFilter ? 'border-emerald-500/50 text-emerald-400' : 'border-[#1f1f1f] text-white/40 hover:text-white/70'
            }`}
          >
            All
          </button>
          {tickerBadges.map(({ ticker, calls, puts, total }) => {
            const isBullish = calls >= puts;
            const isActive = tickerFilter === ticker;
            return (
              <button
                key={ticker}
                onClick={() => setTickerFilter(isActive ? null : ticker)}
                className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded border transition-colors ${
                  isActive
                    ? isBullish ? 'border-emerald-500/50 text-emerald-400' : 'border-red-500/50 text-red-400'
                    : `border-[#1f1f1f] hover:border-white/20 ${isBullish ? 'text-emerald-400/70' : 'text-red-400/70'}`
                }`}
              >
                {ticker} ({total})
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main: Flow Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Row */}
          <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-[#1f1f1f]">
            <Filter size={12} className="text-white/30 mr-1" />
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  typeFilter === key ? 'text-emerald-400 border border-emerald-500/30' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading && alerts.length === 0 ? (
              <div className="px-4 py-12 flex flex-col items-center justify-center gap-3">
                <Activity size={24} className="text-emerald-400 animate-pulse" />
                <span className="text-white/40 text-sm">Connecting to options flow<span className="animate-pulse">...</span></span>
                <table className="w-full mt-4">
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
                  </tbody>
                </table>
              </div>
            ) : error && alerts.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <button onClick={fetchInitial} className="mt-2 text-xs text-white/40 hover:text-white/60">Retry</button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0b0b0b] z-10">
                  <tr className="border-b border-[#1f1f1f]">
                    <SortHeader col="timestamp">Time</SortHeader>
                    <th className="px-3 py-2 w-6"></th>
                    <SortHeader col="underlying">Ticker</SortHeader>
                    <SortHeader col="strike">Strike</SortHeader>
                    <th className="px-3 py-2 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Type</th>
                    <SortHeader col="expiration">Exp</SortHeader>
                    <SortHeader col="lastPrice">Last</SortHeader>
                    <SortHeader col="volume">Vol</SortHeader>
                    <SortHeader col="tradeSize">Size</SortHeader>
                    <SortHeader col="estimatedPremium">Premium</SortHeader>
                    <th className="px-3 py-2 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Badge</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-white/30 text-sm">
                        {wsConnected ? 'Waiting for unusual activity...' : 'No unusual activity found'}
                      </td>
                    </tr>
                  ) : filteredAlerts.map((alert, i) => {
                    const isCall = alert.type === 'call';
                    const borderColor = isCall ? 'border-l-emerald-500' : 'border-l-red-500';
                    const textColor = isCall ? 'text-emerald-400' : 'text-red-400';
                    const alertKey = `${alert.symbol}-${alert.timestamp}-${alert.tradeSize}`;
                    const isFlashing = flashIds.has(alertKey);

                    return (
                      <tr
                        key={`${alert.symbol}-${i}`}
                        className={`border-b border-[#1f1f1f] border-l-2 ${borderColor} hover:bg-white/[0.02] transition-all duration-500 ${
                          isFlashing ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-white/40 text-xs">{formatTime(alert.timestamp)}</td>
                        <td className="px-1 py-2 text-center">{isCall ? '🟢' : '🔴'}</td>
                        <td className="px-3 py-2 text-white font-medium">{alert.underlying}</td>
                        <td className={`px-3 py-2 ${textColor} font-mono text-xs`}>{formatStrike(alert.strike, alert.type)}</td>
                        <td className={`px-3 py-2 text-xs ${textColor}`}>{isCall ? 'CALL' : 'PUT'}</td>
                        <td className="px-3 py-2 text-white/50 text-xs">{formatExp(alert.expiration)}</td>
                        <td className="px-3 py-2 text-white/70 font-mono text-xs">${alert.lastPrice?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-white/70 text-xs">{(alert.volume || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-white/50 text-xs font-mono">{(alert.tradeSize || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-white font-medium text-xs">{formatPremium(alert.estimatedPremium)}</td>
                        <td className={`px-3 py-2 text-xs font-medium ${BADGE_COLORS[alert.badge] || 'text-white/30'}`}>
                          {alert.badge || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar: Sentiment */}
        <div className="w-64 flex-shrink-0 border-l border-[#1f1f1f] p-4 overflow-y-auto hidden lg:block">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Sentiment</h3>

          {summary ? (
            <div className="space-y-5">
              {/* Call/Put Ratio Bar */}
              <div>
                <div className="flex justify-between text-[11px] text-white/50 mb-1.5">
                  <span className="text-emerald-400">Calls</span>
                  <span className="text-red-400">Puts</span>
                </div>
                <div className="flex h-2 rounded-sm overflow-hidden bg-white/5">
                  {(() => {
                    const total = summary.totalCallPremium + summary.totalPutPremium;
                    const callPct = total > 0 ? (summary.totalCallPremium / total) * 100 : 50;
                    return (
                      <>
                        <div className="bg-emerald-500/60 transition-all" style={{ width: `${callPct}%` }} />
                        <div className="bg-red-500/60 transition-all" style={{ width: `${100 - callPct}%` }} />
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Premium Totals */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">Call Premium</span>
                  <span className="text-xs text-emerald-400 font-medium">{formatPremium(summary.totalCallPremium)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">Put Premium</span>
                  <span className="text-xs text-red-400 font-medium">{formatPremium(summary.totalPutPremium)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">C/P Ratio</span>
                  <span className="text-xs text-white/70 font-mono">{summary.callPutRatio}x</span>
                </div>
              </div>

              <div className="border-t border-[#1f1f1f] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">Alerts</span>
                  <span className="text-xs text-white/70">{summary.totalAlerts}</span>
                </div>
                {summary.topBullish && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40 flex items-center gap-1"><TrendingUp size={10} className="text-emerald-400" /> Bullish</span>
                    <span className="text-xs text-emerald-400 font-medium">{summary.topBullish}</span>
                  </div>
                )}
                {summary.topBearish && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40 flex items-center gap-1"><TrendingDown size={10} className="text-red-400" /> Bearish</span>
                    <span className="text-xs text-red-400 font-medium">{summary.topBearish}</span>
                  </div>
                )}
              </div>

              {/* Per-Ticker Breakdown */}
              <div className="border-t border-[#1f1f1f] pt-3">
                <h4 className="text-[10px] text-white/30 uppercase tracking-wider mb-2">By Ticker</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {tickerBadges.slice(0, 10).map(({ ticker, calls, puts, premium }) => (
                    <div key={ticker} className="flex items-center justify-between text-[11px]">
                      <span className="text-white/60 font-medium">{ticker}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400/60">{calls}C</span>
                        <span className="text-red-400/60">{puts}P</span>
                        <span className="text-white/40">{formatPremium(premium)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptionsPage;
