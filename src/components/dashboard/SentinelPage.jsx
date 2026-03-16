import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import AppErrorBoundary from '../shared/AppErrorBoundary';
import { useTwelveDataWS } from '../xray/hooks/useTwelveDataWS';
import SentinelEngine from './SentinelEngine';

const SPRING = { type: 'spring', stiffness: 400, damping: 30 };
const GLASS = 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]';
const GLASS_HOVER = 'hover:from-white/[0.06] hover:to-white/[0.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3)] hover:border-white/[0.1]';
const EMERALD_GLOW = 'bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]';
const RED_GLOW = 'bg-gradient-to-br from-red-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-red-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(239,68,68,0.15)]';
const INSET = 'bg-black/40 rounded-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04] px-4 py-3 font-mono font-bold text-white focus:border-emerald-500/30 focus:outline-none transition-all duration-300';

function isMarketOpen() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 570 && mins < 960;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function WinRateColor({ value, netPnl = 0 }) {
  const color = netPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  return <span className={color}>{value?.toFixed(1) || 0}%</span>;
}

function MetricTooltip({ label, tip, children }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: Math.max(8, rect.right - 224) });
    }
    setShow(true);
  };

  return (
    <div className="text-right" ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      <span className="text-xs tracking-widest text-gray-500 uppercase cursor-help">{label}</span>
      {children}
      {show && createPortal(
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[9999] w-56 p-3 rounded-xl bg-black/95 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-left"
        >
          <p className="text-[11px] text-gray-300 leading-relaxed">{tip}</p>
        </motion.div>,
        document.body
      )}
    </div>
  );
}

// === SENTINEL PAGE ===
function SentinelPageInner() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [expandedSession, setExpandedSession] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [todayOnly, setTodayOnly] = useState(false);
  const [tickerFilter, setTickerFilter] = useState(null);
  const [sortLargest, setSortLargest] = useState(false);
  const [brainModalSession, setBrainModalSession] = useState(null);
  const [brainExpanded, setBrainExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [activeSkillModal, setActiveSkillModal] = useState(null);
  const [showYoloConfirm, setShowYoloConfirm] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [subTab, setSubTab] = useState('overview');
  const lastFetchRef = useRef(null);

  // Live prices via Twelve Data WebSocket
  const { prices: livePrices, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe } = useTwelveDataWS();

  // Local settings state
  const [allocatedCapital, setAllocatedCapital] = useState(5000);
  const [riskPreset, setRiskPreset] = useState('Moderate');
  const [riskPerTrade, setRiskPerTrade] = useState(2);
  const [maxDailyDD, setMaxDailyDD] = useState(5);
  const [stopATR, setStopATR] = useState(1.5);
  const [takeProfitRR, setTakeProfitRR] = useState(2);
  const [maxPositions, setMaxPositions] = useState(3);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const marketOpen = isMarketOpen();

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/sentinel/status');
      const result = await resp.json();
      setData(result);
      lastFetchRef.current = new Date().toISOString();
    } catch (err) {
      console.error('[SentinelPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserSettings = useCallback(async () => {
    if (!user?.id) return;
    const { data: settings } = await supabase
      .from('sentinel_user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (settings) {
      setUserSettings(settings);
      setAllocatedCapital(settings.allocated_capital || 5000);
      setRiskPreset(settings.risk_preset || 'Moderate');
      setRiskPerTrade(settings.risk_per_trade_pct || 2);
      setMaxDailyDD(settings.max_daily_dd_pct || 5);
      setStopATR(settings.stop_loss_atr_mult || 1.5);
      setTakeProfitRR(settings.take_profit_rr || 2);
      setMaxPositions(settings.max_positions || 3);
      setDisclaimerAccepted(settings.legal_disclaimer_accepted || false);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data: notifs } = await supabase
      .from('sentinel_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(notifs || []);
  }, [user?.id]);

  useEffect(() => {
    fetchStatus();
    fetchUserSettings();
    fetchNotifications();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchUserSettings, fetchNotifications]);

  // Realtime notifications
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('sentinel-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sentinel_notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('sentinel_notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSaveSettings = async () => {
    if (!user?.id) return;
    setSavingSettings(true);
    await supabase.from('sentinel_user_settings').upsert({
      user_id: user.id,
      allocated_capital: allocatedCapital,
      risk_preset: riskPreset,
      risk_per_trade_pct: riskPerTrade,
      max_daily_dd_pct: maxDailyDD,
      stop_loss_atr_mult: stopATR,
      take_profit_rr: takeProfitRR,
      max_positions: maxPositions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setSavingSettings(false);
  };

  const handleAcceptDisclaimer = async () => {
    if (!user?.id) return;
    setDisclaimerAccepted(true);
    await supabase.from('sentinel_user_settings').upsert({
      user_id: user.id,
      legal_disclaimer_accepted: true,
      legal_disclaimer_accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setUserSettings((prev) => ({ ...prev, legal_disclaimer_accepted: true }));
  };

  const handleToggleYolo = async (activate) => {
    if (!user?.id) return;
    setShowYoloConfirm(false);
    const newState = activate;
    await supabase.from('sentinel_user_settings').upsert({
      user_id: user.id,
      yolo_active: newState,
      currently_copying: newState,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setUserSettings((prev) => ({ ...prev, yolo_active: newState, currently_copying: newState }));
  };

  const handleSubscribe = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/sentinel/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      });
      const result = await resp.json();
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      console.error('[SentinelPage] subscribe error:', err);
    }
  };

  const account = data?.account || {};
  const todaySession = data?.todaySession || {};
  const openTrades = data?.openTrades || [];
  const polymarket = data?.polymarket || {};
  const polyOpenTrades = polymarket.openTrades || [];
  const polyResolved = polymarket.recentResolved || [];

  // Subscribe to open trade symbols for live prices
  const openSymbols = useMemo(() => openTrades.map((t) => t.symbol), [openTrades]);
  const prevSymbolsRef = useRef([]);
  useEffect(() => {
    const prev = prevSymbolsRef.current;
    const toUnsub = prev.filter((s) => !openSymbols.includes(s));
    const toSub = openSymbols.filter((s) => !prev.includes(s));
    if (toUnsub.length > 0) wsUnsubscribe(toUnsub);
    if (toSub.length > 0) wsSubscribe(toSub);
    prevSymbolsRef.current = openSymbols;
  }, [openSymbols, wsSubscribe, wsUnsubscribe]);

  // Compute live unrealized P&L from WebSocket prices
  const liveUnrealizedPnl = useMemo(() => {
    let total = 0;
    let hasLive = false;
    for (const trade of openTrades) {
      const lp = livePrices[trade.symbol.toUpperCase()]?.price;
      if (lp && trade.entry && trade.size) {
        hasLive = true;
        total += (lp - trade.entry) * trade.size * (trade.direction === 'SHORT' ? -1 : 1);
      } else if (trade.unrealized_pnl != null) {
        total += trade.unrealized_pnl;
      }
    }
    return hasLive ? total : (data?.totalUnrealizedPnl || 0);
  }, [openTrades, livePrices, data?.totalUnrealizedPnl]);

  // Single source of truth: account-level total P&L (realized + live unrealized)
  const accountTotalPnl = useMemo(() => {
    const realizedBase = (data?.account?.current_balance || 2000000);
    return (realizedBase + liveUnrealizedPnl) - 2000000;
  }, [data?.account?.current_balance, liveUnrealizedPnl]);

  const recentSessions = data?.recentSessions || [];
  const recentClosedTrades = data?.recentClosedTrades || [];
  // Single source of truth: total trades = closed + open
  const openTradeCount = openTrades.length;
  const closedTradeCount = recentClosedTrades.length;
  const unifiedTotalTrades = closedTradeCount + openTradeCount;
  const memory = data?.memory || {};
  const unlock = data?.unlockStatus || {};
  const isSubscribed = userSettings?.subscription_status === 'active' || userSettings?.subscription_status === 'trialing';
  const yoloActive = userSettings?.yolo_active || false;
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Group closed trades by session_date for Session History expansion
  const tradesBySession = useMemo(() => {
    const map = {};
    for (const trade of recentClosedTrades) {
      const date = trade.session_date || (trade.closed_at ? trade.closed_at.slice(0, 10) : 'unknown');
      if (!map[date]) map[date] = [];
      map[date].push(trade);
    }
    return map;
  }, [recentClosedTrades]);

  // Derive today's closed trade stats from actual trade data
  const today = new Date().toISOString().split('T')[0];
  const todayClosedTrades = tradesBySession[today] || [];
  const todayRealizedPnl = todayClosedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const todayWins = todayClosedTrades.filter(t => t.win).length;
  const todayLosses = todayClosedTrades.filter(t => !t.win).length;

  // Today's P&L using local midnight (matches session history "Today" filter)
  const todayLocalPnl = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime();
    return recentClosedTrades
      .filter(t => { const ts = t.opened_at || t.closed_at; return ts && new Date(ts).getTime() >= ms; })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [recentClosedTrades]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-500 text-sm font-mono">
          Loading Sentinel...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="flex flex-col h-full min-h-0 bg-[#0a0a0f] overflow-hidden"
    >
      {/* HEADER */}
      <div className={`h-14 flex items-center justify-between px-6 border-b border-white/[0.06] flex-shrink-0 relative z-10 ${subTab === 'engine' ? 'bg-[#080808]' : ''}`}>
        <div className="flex items-center gap-3">
          <svg className={`w-5 h-5 ${marketOpen ? 'text-red-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <span className="font-mono tracking-widest text-sm font-bold text-white">SENTINEL</span>
          <span className={`text-xs font-mono ${(marketOpen || openTrades.length > 0) ? 'text-emerald-400' : 'text-gray-500'}`}>
            {marketOpen ? 'MARKET OPEN' : openTrades.length > 0 ? 'CRYPTO 24/7' : 'MARKET CLOSED'}
          </span>
          {(marketOpen || openTrades.length > 0) && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-400"
            />
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
            {[{ id: 'overview', label: 'Overview' }, { id: 'engine', label: 'Engine' }].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-mono tracking-wider transition-all duration-200 ${
                  subTab === tab.id
                    ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-600 font-mono">Last updated: {timeAgo(lastFetchRef.current)}</span>
        </div>
      </div>

      {subTab === 'engine' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <AppErrorBoundary>
            <SentinelEngine
              sentinelTotalPnl={accountTotalPnl}
              sentinelDailyPnl={liveUnrealizedPnl + todayRealizedPnl}
              sentinelAccount={account}
              sentinelTotalTrades={unifiedTotalTrades}
              sentinelOpenCount={openTradeCount}
            />
          </AppErrorBoundary>
        </div>
      ) : (<>
      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>
        {/* ACCOUNT CARD */}
        <motion.div className={`${GLASS} ${GLASS_HOVER} p-6 transition-all duration-300`} whileHover={{ y: -2 }}>
          <div className="flex items-start justify-between">
            <div>
              <div>
                <span className="font-mono text-3xl font-bold text-white">
                  $<CountUp end={data?.liveBalance || account.current_balance || 500000} duration={1.2} decimals={2} separator="," preserveValue />
                </span>
              </div>
              {(() => {
                const pctChange = (accountTotalPnl / 2000000) * 100;
                const todayPct = (todayLocalPnl / 2000000) * 100;
                return (
                  <>
                    <span className={`text-sm font-mono ${accountTotalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Total P&L: {accountTotalPnl >= 0 ? '+' : ''}${accountTotalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {' '}({pctChange.toFixed(2)}%)
                    </span>
                    <br />
                    <span className="text-[12px] font-mono">
                      <span className="text-white/50">Today: </span>
                      <span className={todayLocalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {todayLocalPnl >= 0 ? '+' : ''}${todayLocalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {' '}({todayPct.toFixed(2)}%)
                      </span>
                    </span>
                  </>
                );
              })()}
            </div>
            <div className="flex gap-8">
              <MetricTooltip label="Win Rate" tip="Percentage of trades that were profitable. Higher is better — 50%+ with good R means a strong edge.">
                <div className="mt-1"><WinRateColor value={account.win_rate || 0} netPnl={accountTotalPnl} /></div>
              </MetricTooltip>
              <MetricTooltip label="Avg R" tip="Average risk-reward per trade. 1R = the amount risked. If Sentinel risks $100 and averages $200 profit, that's 2.00R. Negative means average losses exceed the planned risk.">
                <div className={`mt-1 font-mono ${(account.avg_r || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(account.avg_r || 0).toFixed(2)}R</div>
              </MetricTooltip>
              <MetricTooltip label="Total Trades" tip="Total number of trades Sentinel has executed since launch. More trades = more data for the brain to learn from.">
                <div className="mt-1 text-white font-mono">{unifiedTotalTrades}{openTradeCount > 0 && <span className="text-white/40"> ({openTradeCount} open)</span>}</div>
              </MetricTooltip>
              <MetricTooltip label="Expectancy" tip="Expected profit per trade in R units. Combines win rate and average win/loss size: (win% × avg win) − (loss% × avg loss). Positive = profitable system over time.">
                <div className={`mt-1 font-mono ${(account.expectancy || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(account.expectancy || 0) >= 0 ? '+' : ''}{(account.expectancy || 0).toFixed(1)}R</div>
              </MetricTooltip>
            </div>
          </div>
        </motion.div>


        {unlock.unlocked && !isSubscribed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${EMERALD_GLOW} p-6 text-center`}
          >
            <span className="text-emerald-400 font-bold font-mono text-lg">YOLO UNLOCKED</span>
            <p className="text-gray-400 text-sm mt-2">Subscribe for $29.99/month to copy Sentinel</p>
            <motion.button
              onClick={handleSubscribe}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="mt-4 text-emerald-400 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] to-emerald-500/[0.04] rounded-xl px-6 py-2.5 font-mono font-semibold shadow-[0_4px_12px_rgba(16,185,129,0.15)]
                hover:from-emerald-500/[0.18] hover:border-emerald-500/50"
            >
              Subscribe — 7 day free trial
            </motion.button>
          </motion.div>
        )}

        {/* MAIN GRID */}
        <div className="grid grid-cols-[1fr_320px] gap-6 min-h-0">
          {/* LEFT COLUMN */}
          <div className="space-y-6 min-w-0">
            {/* TODAY'S SESSION */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  {(marketOpen || openTrades.length > 0) && (
                    <span className="flex items-center gap-1">
                      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-emerald-400 font-mono">LIVE</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-6 mb-4">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">Trades</span>
                  <div className="text-white font-mono">{openTrades.length + todayClosedTrades.length}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">Wins</span>
                  <div className="text-emerald-400 font-mono">{todayWins}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">Losses</span>
                  <div className="text-red-400 font-mono">{todayLosses}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">P&L</span>
                  <div className={`font-mono ${(liveUnrealizedPnl + todayRealizedPnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(liveUnrealizedPnl + todayRealizedPnl) >= 0 ? '+' : ''}${(liveUnrealizedPnl + todayRealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              {/* Open trades */}
              {openTrades.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">Open Positions</span>
                  {openTrades.map((trade, i) => (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, ...SPRING }}
                      whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      className="flex items-center justify-between py-2 px-3 rounded-xl transition-all duration-300"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono font-semibold ${trade.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {trade.direction === 'LONG' ? '↑' : '↓'} {trade.direction}
                        </span>
                        <span className="font-mono font-semibold text-white">{trade.symbol.includes('/') ? '' : '$'}{trade.symbol}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-gray-400">{trade.size ? trade.size.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} units</span>
                        <span className="text-gray-500">Entry ${trade.entry}</span>
                        {(() => {
                          const livePrice = livePrices[trade.symbol.toUpperCase()]?.price;
                          const currentPrice = livePrice || trade.current_price;
                          const pnl = currentPrice && trade.entry && trade.size
                            ? (currentPrice - trade.entry) * trade.size * (trade.direction === 'SHORT' ? -1 : 1)
                            : trade.unrealized_pnl;
                          const dollarSize = currentPrice && trade.size ? currentPrice * trade.size : trade.dollar_size || 0;
                          return (
                            <>
                              {currentPrice && (
                                <span className="text-white text-sm font-semibold">
                                  {trade.symbol.includes('/') ? '' : '$'}{trade.symbol} <span className="text-gray-300">${Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </span>
                              )}
                              <span className="text-gray-500">{trade.size ? trade.size.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} units</span>
                              {pnl != null && (
                                <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {pnl >= 0 ? '+' : ''}${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                              <span className="text-gray-500">Size ${dollarSize.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                            </>
                          );
                        })()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {openTrades.length === 0 && (
                <p className="text-xs text-gray-600 font-mono">No open positions</p>
              )}
            </motion.div>

            {/* LIVE SIGNAL FEED */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">LIVE FEED</span>
              <div className="mt-3 max-h-64 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'none' }}>
                {openTrades.length === 0 && (
                  <p className="text-xs text-gray-600 font-mono py-4">No open positions</p>
                )}
                {openTrades.map((trade, i) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, ...SPRING }}
                    className="flex items-center gap-3 py-1.5 text-xs font-mono"
                  >
                    <span className="text-gray-600 w-16">{new Date(trade.opened_at || trade.closed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={`w-12 font-semibold ${trade.direction === 'LONG' ? 'text-emerald-400' : trade.direction === 'SHORT' ? 'text-red-400' : 'text-gray-600'}`}>
                      {trade.direction === 'LONG' ? '↑' : trade.direction === 'SHORT' ? '↓' : '—'} {trade.direction}
                    </span>
                    <span className="text-white font-semibold w-20">{trade.symbol.includes('/') ? '' : '$'}{trade.symbol}</span>
                    <span className="text-gray-400">{trade.size ? trade.size.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' units' : ''}</span>
                    <span className="text-gray-500">Entry ${trade.entry}</span>
            {(() => {
              const lp = livePrices[trade.symbol.toUpperCase()]?.price;
              const currentPrice = (trade.status === 'open' && lp) ? lp : trade.current_price;
              const pnl = (currentPrice && trade.entry && trade.size && trade.status === 'open')
                ? (currentPrice - trade.entry) * trade.size * (trade.direction === 'SHORT' ? -1 : 1)
                : trade.unrealized_pnl;
              const ds = (currentPrice && trade.size && trade.status === 'open') ? currentPrice * trade.size : (trade.dollar_size || 0);
              return (
                <>
                  {currentPrice && trade.status === 'open' && (
                    <span className="text-white text-sm font-semibold">
                      {trade.symbol.includes('/') ? '' : '$'}{trade.symbol} <span className="text-gray-300">${Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </span>
                  )}
                  {pnl != null && (
                    <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {pnl >= 0 ? '+' : ''}${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                  <span className="text-gray-500">Size ${ds.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </>
              );
            })()}
            <span className={`w-2 h-2 rounded-full ${trade.status === 'open' ? 'bg-emerald-400' : trade.win ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* POLYMARKET BETS */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22, ...SPRING }}
              className={`${GLASS} p-4 transition-all duration-300`}
            >
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">POLYMARKET</span>
              {(() => {
                const allBets = [
                  ...polyOpenTrades.map(t => ({ ...t, _type: 'open' })),
                  ...polyResolved.map(t => ({ ...t, _type: 'resolved' })),
                ];
                const SLOTS = 9;
                // Verified Polymarket URLs — hardcoded slugs, never guessed
                const POLY_URLS = {
                  'Will Bitcoin hit $150k by December 31, 2026?': 'https://polymarket.com/event/what-price-will-bitcoin-hit-before-2027/will-bitcoin-reach-150000-by-december-31-2026-557',
                  'Will Bitcoin hit $150k by June 30, 2026?': 'https://polymarket.com/event/when-will-bitcoin-hit-150k/will-bitcoin-hit-150k-by-december-31-2026',
                  'Will El Salvador hold $1b+ of BTC by December 31, 2026?': 'https://polymarket.com/event/will-el-salvador-hold-1b-of-btc-by-by',
                };
                const polyUrl = (trade) => {
                  if (trade.polymarket_url) return trade.polymarket_url;
                  if (trade.question && POLY_URLS[trade.question]) return POLY_URLS[trade.question];
                  return 'https://polymarket.com/markets';
                };
                return (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {Array.from({ length: SLOTS }).map((_, i) => {
                      const bet = allBets[i];
                      if (!bet) {
                        return (
                          <div key={`empty-${i}`} className="bg-white/[0.02] rounded-xl border border-dashed border-white/[0.03] p-3 flex flex-col items-center justify-center text-center min-h-[72px]">
                            <span className="text-white/20 text-[12px]">Awaiting signal</span>
                            <span className="text-white/10 text-[11px] mt-0.5">Sentinel will surface high-conviction bets here</span>
                          </div>
                        );
                      }
                      const url = polyUrl(bet);
                      const isOpen = bet._type === 'open';
                      const potentialProfit = isOpen ? (bet.shares * 1.0) - bet.dollar_cost : null;
                      const Tag = url ? 'a' : 'div';
                      const linkProps = url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {};
                      return (
                        <Tag
                          key={bet.id}
                          {...linkProps}
                          className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-xl border border-white/[0.06] p-3 transition-colors duration-200 hover:from-white/[0.06] hover:border-white/[0.1] block"
                        >
                          <div className="flex items-start gap-1.5">
                            <span className={`text-[10px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${bet.side === 'YES' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {bet.side}
                            </span>
                            <p className="text-[13px] text-white font-medium leading-tight line-clamp-2">{bet.question}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-[11px] font-mono">
                            <div className="flex items-center gap-2 text-white/40">
                              {isOpen ? (
                                <>
                                  <span>${bet.entry_price?.toFixed(3)}</span>
                                  <span>{bet.shares?.toLocaleString()} sh</span>
                                  <span className="text-emerald-400">+${potentialProfit?.toFixed(2)}</span>
                                </>
                              ) : (
                                <>
                                  <span className={bet.win ? 'text-emerald-400' : 'text-red-400'}>{bet.win ? '✓ Won' : '✗ Lost'}</span>
                                  <span className={bet.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                    {bet.pnl >= 0 ? '+' : ''}${bet.pnl?.toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="text-white/30">{bet.confidence}%</span>
                          </div>
                        </Tag>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>

            {/* SESSION HISTORY */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SESSION HISTORY</span>

              {/* FILTERED TRADES — shared across stat cards, rows, and footer */}
              {(() => {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const todayStartMs = todayStart.getTime();
                let filteredTrades = [...recentClosedTrades];
                if (todayOnly) filteredTrades = filteredTrades.filter(t => {
                  const ts = t.opened_at || t.closed_at;
                  return ts && new Date(ts).getTime() >= todayStartMs;
                });
                if (statusFilter === 'Wins') filteredTrades = filteredTrades.filter(t => t.win);
                else if (statusFilter === 'Losses') filteredTrades = filteredTrades.filter(t => !t.win);
                if (tickerFilter) filteredTrades = filteredTrades.filter(t => t.symbol?.includes(tickerFilter));
                // Default: newest first (descending by opened_at). "Largest First" overrides with P&L sort.
                const sortedTrades = [...filteredTrades].sort((a, b) => {
                  if (sortLargest) return Math.abs(b.pnl || 0) - Math.abs(a.pnl || 0);
                  return new Date(b.opened_at || b.closed_at || 0).getTime() - new Date(a.opened_at || a.closed_at || 0).getTime();
                });

                const totalTrades = filteredTrades.length;
                const totalWins = filteredTrades.filter(t => t.win).length;
                const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
                const winTrades = filteredTrades.filter(t => t.win && t.pnl > 0);
                const avgWin = winTrades.length > 0 ? winTrades.reduce((s, t) => s + (t.pnl || 0), 0) / winTrades.length : 0;
                const netPnl = filteredTrades.reduce((s, t) => s + (t.pnl || 0), 0);

                return (<>
              {/* STAT CARDS */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'Trades', value: totalTrades, fmt: (v) => v.toString(), color: 'text-white' },
                  { label: 'Win Rate', value: winRate, fmt: (v) => `${v.toFixed(1)}%`, color: netPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                  { label: 'Avg Win', value: avgWin, fmt: (v) => `$${v.toFixed(2)}`, color: 'text-emerald-400' },
                  { label: 'Net P&L', value: netPnl, fmt: (v) => `${v >= 0 ? '+' : ''}$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: netPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-3">
                    <div className="text-[11px] uppercase tracking-[0.4px] text-white/30">{stat.label}</div>
                    <div className={`text-lg font-mono font-bold mt-1 ${stat.color}`}>{stat.fmt(stat.value)}</div>
                  </div>
                ))}
              </div>

              {/* FILTER PILLS */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {/* Group 1 — Date + Status */}
                <button
                  onClick={() => { setTodayOnly(true); setStatusFilter('All'); }}
                  className={`rounded-full px-3.5 py-1.5 text-xs transition-all duration-200 ${
                    todayOnly && statusFilter === 'All'
                      ? 'bg-white text-[#0a0a0f] font-medium'
                      : 'border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => { setTodayOnly(false); setStatusFilter('All'); }}
                  className={`rounded-full px-3.5 py-1.5 text-xs transition-all duration-200 ${
                    !todayOnly && statusFilter === 'All'
                      ? 'bg-white text-[#0a0a0f] font-medium'
                      : 'border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  All
                </button>
                {['Wins', 'Losses'].map((pill) => (
                  <button
                    key={pill}
                    onClick={() => setStatusFilter(prev => prev === pill ? 'All' : pill)}
                    className={`rounded-full px-3.5 py-1.5 text-xs transition-all duration-200 ${
                      statusFilter === pill
                        ? 'bg-white text-[#0a0a0f] font-medium'
                        : 'border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                    }`}
                  >
                    {pill}
                  </button>
                ))}
                {/* Gap between groups */}
                <div className="w-4" />
                {/* Group 2 — Ticker */}
                {['BTC', 'ETH', 'SOL'].map((pill) => (
                  <button
                    key={pill}
                    onClick={() => setTickerFilter(prev => prev === pill ? null : pill)}
                    className={`rounded-full px-3.5 py-1.5 text-xs transition-all duration-200 ${
                      tickerFilter === pill
                        ? 'bg-white text-[#0a0a0f] font-medium'
                        : 'border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                    }`}
                  >
                    {pill}
                  </button>
                ))}
                {/* Gap before sort */}
                <div className="w-4" />
                {/* Sort toggle */}
                <button
                  onClick={() => setSortLargest(prev => !prev)}
                  className={`rounded-full px-3.5 py-1.5 text-xs transition-all duration-200 ${
                    sortLargest
                      ? 'bg-white text-[#0a0a0f] font-medium'
                      : 'border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  Largest First
                </button>
              </div>

              {/* GRID HEADER */}
              <div className="grid mt-4 mb-1 px-1 text-[11px] uppercase tracking-[0.4px] text-white/30" style={{ gridTemplateColumns: '28px 90px 1fr 110px 110px 100px' }}>
                <span></span>
                <span>Pair</span>
                <span>Time</span>
                <span>Entry</span>
                <span>Exit</span>
                <span className="text-right">P&L</span>
              </div>

              {/* TRADE ROWS */}
              <div className="mt-1">
                {recentClosedTrades.length === 0 && (
                  <p className="text-xs text-gray-600 font-mono py-2">No trades yet</p>
                )}
                {sortedTrades.map((trade) => {
                  const isWin = trade.win || (trade.pnl || 0) >= 0;
                  const openTime = trade.opened_at ? new Date(trade.opened_at) : null;
                  const closeTime = trade.closed_at ? new Date(trade.closed_at) : null;
                  const timeFmt = (d) => d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
                  const durationMins = openTime && closeTime ? Math.round((closeTime - openTime) / 60000) : null;
                  const durationStr = durationMins != null ? (durationMins >= 60 ? `${Math.floor(durationMins / 60)}h${durationMins % 60}m` : `${durationMins}m`) : '';
                  return (
                    <div
                      key={trade.id}
                      className="grid items-center py-2.5 px-1 border-b border-white/[0.06] transition-colors duration-200 hover:bg-white/[0.03] text-xs font-mono"
                      style={{ gridTemplateColumns: '28px 90px 1fr 110px 110px 100px' }}
                    >
                      {/* Win/loss indicator bar */}
                      <div className="flex justify-center">
                        <div
                          className="w-[3px] h-6 rounded-full"
                          style={{ backgroundColor: isWin ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.5)' }}
                        />
                      </div>
                      {/* Pair */}
                      <span className="text-white font-medium">{trade.symbol}</span>
                      {/* Time range + duration */}
                      <span className="text-white/30 text-[12px]">
                        {timeFmt(openTime)} → {timeFmt(closeTime)}{durationStr && <span className="ml-1.5 text-white/20">{durationStr}</span>}
                      </span>
                      {/* Entry price */}
                      <span className="text-white/50 text-[12px]">${trade.entry != null ? Number(trade.entry).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
                      {/* Exit price */}
                      <span className="text-white/50 text-[12px]">${trade.exit_price != null ? Number(trade.exit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
                      {/* P&L */}
                      <span className={`text-right font-medium ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* TOTAL P&L FOOTER */}
              {filteredTrades.length > 0 && (
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/[0.06] px-1 text-xs font-mono">
                  <span className="text-white/30">Total P&L</span>
                  <span className={`font-medium ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {netPnl >= 0 ? '+' : ''}${netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              </>);
              })()}
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 min-w-0">
            {/* SENTINEL BRAIN — clickable date list */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <motion.div
                onClick={() => setBrainExpanded((v) => !v)}
                className="flex items-center justify-between cursor-pointer"
                whileHover={{ opacity: 0.8 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SENTINEL BRAIN</span>
                  <span className="text-[10px] text-gray-600 font-mono">{unifiedTotalTrades} trades{openTradeCount > 0 ? ` (${openTradeCount} open)` : ''} · {recentSessions.length} sessions</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono">Session {memory.sessions_processed || 0}</span>
                  <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${brainExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </motion.div>
              <AnimatePresence>
                {brainExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3">
                      {memory.brain_summary ? (
                        <p className="text-sm text-gray-400 leading-relaxed mb-4">{memory.brain_summary}</p>
                      ) : (
                        <p className="text-sm text-gray-500 leading-relaxed mb-4">Sentinel is in early learning mode. Analyzing first sessions.</p>
                      )}
                      <div className="space-y-1 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {recentSessions.length === 0 && (
                          <p className="text-[10px] text-gray-600 font-mono">No sessions yet</p>
                        )}
                        {recentSessions.map((session) => (
                          <motion.button
                            key={session.id}
                            onClick={(e) => { e.stopPropagation(); setBrainModalSession(session); }}
                            whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                            className="flex items-center justify-between w-full py-2 px-3 rounded-xl text-xs font-mono transition-all duration-300 text-left"
                          >
                            <span className="text-gray-300">
                              {new Date(session.session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`${(session.gross_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {(session.gross_pnl || 0) >= 0 ? '+' : ''}${(session.gross_pnl || 0).toFixed(0)}
                              </span>
                              {session.claude_analysis ? (
                                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
                              ) : (
                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* SKILLS — collapsible */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <motion.div
                onClick={() => setSkillsExpanded((v) => !v)}
                className="flex items-center justify-between cursor-pointer"
                whileHover={{ opacity: 0.8 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SKILLS</span>
                  <span className="text-[10px] text-gray-600 font-mono">1 active</span>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${skillsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </motion.div>
              <AnimatePresence>
                {skillsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-1.5">
                      {[
                        {
                          id: 'volatility-check',
                          name: 'Volatility Check',
                          status: 'active',
                          icon: '⚡',
                          description: 'Detects rapid price moves (1%+ drops or spikes in under 15 minutes) on open positions. When triggered, Sentinel analyzes the last 4-6 hours of 5-minute price action — volume spikes, support breaks, ATR context — then decides whether to de-risk (reduce position), close entirely, hold, or open a short. Every event is tracked with what actually happened afterward (bounce, continued dump, sideways), so Sentinel learns from each decision. Over time it recognizes patterns like "high-volume BTC dumps that break support tend to continue" vs "low-volume SOL dips that hold EMA21 usually bounce." The goal: always-improving risk management that protects capital in real time.',
                        },
                      ].map((skill) => (
                        <motion.button
                          key={skill.id}
                          onClick={(e) => { e.stopPropagation(); setActiveSkillModal(skill); }}
                          whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                          className="flex items-center justify-between w-full py-2.5 px-3 rounded-xl text-xs font-mono transition-all duration-300 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span>{skill.icon}</span>
                            <span className="text-gray-200 font-semibold">{skill.name}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            skill.status === 'active'
                              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-gray-500 border-white/[0.06]'
                          }`}>
                            {skill.status}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* NOTIFICATIONS PANEL */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">NOTIFICATIONS</span>
                {unreadCount > 0 && <span className="text-xs text-gray-500 font-mono">{unreadCount} unread</span>}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'none' }}>
                {notifications.length === 0 && (
                  <p className="text-xs text-gray-600 font-mono py-2">No notifications yet</p>
                )}
                {notifications.map((notif) => (
                  <div key={notif.id} className={`text-xs py-1.5 ${notif.read ? 'text-gray-600' : 'text-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <span>
                        {notif.type === 'trade_opened' && '⚡'}
                        {notif.type === 'trade_closed' && '✓'}
                        {notif.type === 'brain_update' && '🧠'}
                        {notif.type === 'yolo_unlocked' && '🔓'}
                        {notif.type === 'session_summary' && '📊'}
                      </span>
                      <span className="font-mono font-semibold">{notif.title}</span>
                      <span className="text-gray-600 ml-auto">{timeAgo(notif.created_at)}</span>
                    </div>
                    <p className="text-gray-500 mt-0.5 ml-6">{notif.body}</p>
                  </div>
                ))}
              </div>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-gray-500 hover:text-white text-xs mt-2 transition-colors duration-200">
                  Mark all read
                </button>
              )}
            </motion.div>

            {/* RISK/REWARD CARD — only when subscribed */}
            {isSubscribed && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, ...SPRING }}
                className={`${GLASS} p-5 transition-all duration-300`}
              >
                <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">COPY SETTINGS</span>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Capital to Allocate to Sentinel</label>
                    <input
                      type="number"
                      value={allocatedCapital}
                      onChange={(e) => setAllocatedCapital(+e.target.value)}
                      className={INSET + ' w-full'}
                    />
                    <span className="text-xs text-gray-500 mt-1 block">Sentinel's signals will be scaled to this amount</span>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Risk Preset</label>
                    <div className="flex gap-2">
                      {[
                        { label: 'Safe', color: 'emerald' },
                        { label: 'Moderate', color: 'yellow' },
                        { label: 'Aggressive', color: 'orange' },
                        { label: 'YOLO', color: 'red' },
                      ].map(({ label, color }) => (
                        <motion.button
                          key={label}
                          onClick={() => {
                            setRiskPreset(label);
                            if (label === 'Safe') { setRiskPerTrade(1); setMaxDailyDD(3); }
                            if (label === 'Moderate') { setRiskPerTrade(2); setMaxDailyDD(5); }
                            if (label === 'Aggressive') { setRiskPerTrade(3); setMaxDailyDD(8); }
                            if (label === 'YOLO') { setRiskPerTrade(5); setMaxDailyDD(15); }
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          className={`flex-1 py-2 rounded-xl text-xs font-mono border transition-all duration-300 ${
                            riskPreset === label
                              ? `text-${color}-400 border-${color}-500/30`
                              : 'text-gray-600 border-white/[0.06]'
                          }`}
                        >
                          {label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase">Risk/Trade %</label>
                      <input type="number" value={riskPerTrade} onChange={(e) => setRiskPerTrade(+e.target.value)} className={INSET + ' w-full text-sm'} step={0.5} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase">Max Daily DD %</label>
                      <input type="number" value={maxDailyDD} onChange={(e) => setMaxDailyDD(+e.target.value)} className={INSET + ' w-full text-sm'} step={0.5} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase">Stop ATR×</label>
                      <input type="number" value={stopATR} onChange={(e) => setStopATR(+e.target.value)} className={INSET + ' w-full text-sm'} step={0.1} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase">Take Profit R:R</label>
                      <input type="number" value={takeProfitRR} onChange={(e) => setTakeProfitRR(+e.target.value)} className={INSET + ' w-full text-sm'} step={0.5} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase">Max Positions</label>
                      <input type="number" value={maxPositions} onChange={(e) => setMaxPositions(+e.target.value)} className={INSET + ' w-full text-sm'} min={1} max={10} />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="text-emerald-400 text-sm font-mono hover:text-white transition-colors duration-200"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* YOLO ACTIVATION */}
            {isSubscribed && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, ...SPRING }}
                className={`${yoloActive ? RED_GLOW : GLASS} p-5 transition-all duration-300`}
              >
                {!disclaimerAccepted ? (
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={disclaimerAccepted}
                        onChange={() => handleAcceptDisclaimer()}
                        className="mt-1 accent-emerald-500"
                      />
                      <span className="text-xs text-gray-400 leading-relaxed">
                        I understand Sentinel is a paper trading simulation. Past performance does not guarantee future results.
                        This is not financial advice. I am responsible for all trading decisions.
                      </span>
                    </label>
                  </div>
                ) : (
                  <div>
                    <motion.button
                      onClick={() => {
                        if (yoloActive) {
                          handleToggleYolo(false);
                        } else {
                          setShowYoloConfirm(true);
                        }
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      className={`w-full py-4 rounded-xl font-mono font-semibold text-sm border transition-all duration-300 ${
                        yoloActive
                          ? 'border-red-500/40 text-red-400 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                          : 'border-white/[0.08] text-gray-400'
                      }`}
                    >
                      {yoloActive ? '⚡ YOLO ON — Sentinel copying to your portfolio' : 'YOLO OFF — Click to activate'}
                    </motion.button>
                    {yoloActive && (
                      <button
                        onClick={() => handleToggleYolo(false)}
                        className="text-gray-600 hover:text-red-400 text-xs mt-2 transition-colors duration-200 block mx-auto"
                      >
                        Kill switch
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="h-8 flex items-center justify-between px-6 border-t border-white/[0.06] flex-shrink-0 font-mono text-xs text-gray-600">
        <div className="flex gap-4">
          <span>Brain v{memory.sessions_processed || 0}</span>
          <span>Sessions: {recentSessions.length}</span>
          <span>Suspended: {(memory.suspended_conditions || []).length} conditions</span>
        </div>
        <div>
          {isSubscribed ? (
            yoloActive ? <span className="text-red-400">YOLO ACTIVE</span> : <span className="text-gray-600">YOLO OFF</span>
          ) : (
            <span className="text-gray-500">Subscribe to unlock YOLO →</span>
          )}
        </div>
      </div>
      </>)}

      {/* YOLO CONFIRMATION MODAL */}
      <AnimatePresence>
        {showYoloConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowYoloConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/[0.05] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)] p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-white font-mono font-bold text-lg mb-3">Activate YOLO?</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Sentinel will copy its next new signal into your paper portfolio. Open positions will only close when Sentinel closes them.
              </p>
              <div className="flex gap-3">
                <motion.button
                  onClick={() => setShowYoloConfirm(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-1 py-2.5 rounded-xl text-gray-400 border border-white/[0.08] bg-white/[0.03] font-mono hover:bg-white/[0.06] hover:text-white hover:border-white/[0.14] transition-all duration-300"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={() => handleToggleYolo(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-1 py-2.5 rounded-xl text-red-400 border border-red-500/30 bg-gradient-to-br from-red-500/[0.10] to-red-500/[0.03] font-mono font-semibold shadow-[0_4px_12px_rgba(239,68,68,0.15)] hover:from-red-500/[0.16] hover:border-red-500/50 transition-all duration-300"
                >
                  Activate
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BRAIN ANALYSIS MODAL */}
      <AnimatePresence>
        {brainModalSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setBrainModalSession(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)] p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
              style={{ scrollbarWidth: 'none' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-mono font-bold text-lg">
                    {new Date(brainModalSession.session_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                    <span className="text-white">{brainModalSession.trades_fired || 0} trades</span>
                    <span className="text-emerald-400">{brainModalSession.wins || 0}W</span>
                    <span className="text-red-400">{brainModalSession.losses || 0}L</span>
                    <span className={`font-semibold ${(brainModalSession.gross_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      P&L: {(brainModalSession.gross_pnl || 0) >= 0 ? '+' : ''}${(brainModalSession.gross_pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <button onClick={() => setBrainModalSession(null)} className="text-gray-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {brainModalSession.claude_analysis ? (
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                  {brainModalSession.claude_analysis}
                </div>
              ) : (
                <p className="text-sm text-gray-500 font-mono">Analysis pending — Sentinel reviews at market close.</p>
              )}

              {brainModalSession.adjustments_made && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Adjustments Made</span>
                  <div className="mt-2 space-y-1">
                    {Object.entries(brainModalSession.adjustments_made.setup_weights || {}).map(([key, val]) => (
                      <div key={key} className="text-xs font-mono text-gray-400">
                        {val > 0 ? '↑' : '↓'} {key} {val > 0 ? '+' : ''}{val} confidence
                      </div>
                    ))}
                    {(brainModalSession.adjustments_made.suspended_conditions || []).map((c, i) => (
                      <div key={i} className="text-xs font-mono text-red-400">✕ Suspended: {c}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trades from this session */}
              {(tradesBySession[brainModalSession.session_date] || []).length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Trades</span>
                  <div className="mt-2 space-y-1.5">
                    {(tradesBySession[brainModalSession.session_date] || []).map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between text-[11px] font-mono py-1">
                        <div className="flex items-center gap-2">
                          <span className={trade.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>
                            {trade.direction === 'LONG' ? '↑' : '↓'}
                          </span>
                          <span className="text-white font-semibold">{trade.symbol}</span>
                          <span className="text-gray-500">${trade.entry} → ${trade.exit_price}</span>
                        </div>
                        <span className={`font-semibold ${(trade.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SKILL DETAIL MODAL */}
      <AnimatePresence>
        {activeSkillModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setActiveSkillModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{activeSkillModal.icon}</span>
                  <h3 className="text-white font-mono font-bold text-lg">{activeSkillModal.name}</h3>
                </div>
                <button onClick={() => setActiveSkillModal(null)} className="text-gray-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                activeSkillModal.status === 'active' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-gray-500 border-white/[0.06]'
              }`}>{activeSkillModal.status}</span>
              <p className="text-sm text-gray-300 leading-relaxed mt-4">{activeSkillModal.description}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SentinelPage() {
  return (
    <AppErrorBoundary>
      <SentinelPageInner />
    </AppErrorBoundary>
  );
}
