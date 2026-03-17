import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import AppErrorBoundary from '../shared/AppErrorBoundary';
import { useTwelveDataWS } from '../xray/hooks/useTwelveDataWS';
import SentinelEngine from './SentinelEngine';
import BrokerConnectModal from './BrokerConnectModal';

const STARTING_BALANCE = 2000000;
const SPRING = { type: 'spring', stiffness: 400, damping: 30 };
const GLASS = 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]';
const GLASS_HOVER = 'hover:from-white/[0.06] hover:to-white/[0.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3)] hover:border-white/[0.1]';
const EMERALD_GLOW = 'bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]';
const RED_GLOW = 'bg-gradient-to-br from-red-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-red-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(239,68,68,0.15)]';
const INSET = 'bg-black/40 rounded-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04] px-4 py-3 font-mono font-bold text-white focus:border-emerald-500/30 focus:outline-none transition-all duration-300';
const RISK_PRESET_CLASSES = {
  emerald: { active: 'text-emerald-400 border-emerald-500/30', inactive: 'text-gray-600 border-white/[0.06]' },
  yellow:  { active: 'text-yellow-400 border-yellow-500/30', inactive: 'text-gray-600 border-white/[0.06]' },
  orange:  { active: 'text-orange-400 border-orange-500/30', inactive: 'text-gray-600 border-white/[0.06]' },
  red:     { active: 'text-red-400 border-red-500/30', inactive: 'text-gray-600 border-white/[0.06]' },
};

const fmtDollar = (v) => `${v >= 0 ? '+' : ''}$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPrice = (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

function computePnl(trade, livePrices) {
  const lp = livePrices[trade.symbol.toUpperCase()]?.price;
  const cp = lp || trade.current_price;
  const pnl = cp && trade.entry && trade.size
    ? (cp - trade.entry) * trade.size * (trade.direction === 'SHORT' ? -1 : 1)
    : trade.unrealized_pnl;
  return { livePrice: cp, pnl: pnl ?? 0 };
}

function PositionRow({ trade, i, showDollar = false, livePrices }) {
  const { livePrice, pnl } = computePnl(trade, livePrices);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04, ...SPRING }}
      whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
      className="py-2 px-2 rounded-xl transition-all duration-300 text-xs font-mono"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={trade.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>
            {trade.direction === 'LONG' ? '↑' : '↓'}
          </span>
          <span className="text-white font-semibold">{showDollar ? '$' : ''}{trade.symbol}</span>
        </div>
        <span className={`font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {fmtDollar(pnl)}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
        <span>Entry {fmtPrice(trade.entry)}</span>
        <span className={pnl >= 0 ? 'text-emerald-400/50' : 'text-red-400/50'}>
          Live {fmtPrice(livePrice)}
        </span>
      </div>
    </motion.div>
  );
}

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

function MarketClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const etStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(now);
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', weekday: 'short',
  }).formatToParts(now);
  const etHour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0', 10);
  const etMinute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0', 10);
  const etDayPeriod = etParts.find(p => p.type === 'dayPeriod')?.value || '';
  const etDay = etParts.find(p => p.type === 'weekday')?.value || '';
  const isWeekend = etDay === 'Sat' || etDay === 'Sun';
  const etMins = (etDayPeriod.toLowerCase().includes('p') && etHour !== 12 ? etHour + 12 : etDayPeriod.toLowerCase().includes('a') && etHour === 12 ? 0 : etHour) * 60 + etMinute;
  const openMin = 9 * 60 + 30;  // 9:30 AM
  const closeMin = 16 * 60;     // 4:00 PM
  const preMarketMin = 8 * 60 + 30; // 8:30 AM
  const closingWarnMin = 15 * 60;   // 3:00 PM

  const timeOnly = etStr.replace(/:\d{2}\s/, ' ').replace(/:\d{2}$/, '');

  if (isWeekend) {
    return (
      <div className="text-center mb-3">
        <div className="text-lg font-mono text-white/30">{timeOnly}</div>
        <div className="text-[10px] text-white/20 mt-0.5">Markets reopen Monday 9:30 AM ET</div>
      </div>
    );
  }

  // Pre-market countdown (8:30–9:30 AM ET)
  if (etMins >= preMarketMin && etMins < openMin) {
    const secsLeft = (openMin - etMins) * 60 - new Date(now).getSeconds();
    const m = Math.floor(Math.max(0, secsLeft) / 60);
    const s = Math.max(0, secsLeft) % 60;
    return (
      <div className="text-center mb-3">
        <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} className="text-lg font-mono text-emerald-400">
          Opens in {m}:{s.toString().padStart(2, '0')}
        </motion.div>
      </div>
    );
  }

  // Market open, closing soon (3:00–4:00 PM ET)
  if (etMins >= closingWarnMin && etMins < closeMin) {
    const secsLeft = (closeMin - etMins) * 60 - new Date(now).getSeconds();
    const m = Math.floor(Math.max(0, secsLeft) / 60);
    const s = Math.max(0, secsLeft) % 60;
    return (
      <div className="text-center mb-3">
        <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} className="text-lg font-mono text-red-400">
          Closes in {m}:{s.toString().padStart(2, '0')}
        </motion.div>
      </div>
    );
  }

  // Market open (9:30 AM – 3:00 PM ET)
  if (etMins >= openMin && etMins < closeMin) {
    return (
      <div className="text-center mb-3">
        <div className="text-lg font-mono text-emerald-400">{timeOnly}</div>
      </div>
    );
  }

  // Market closed (normal hours)
  return (
    <div className="text-center mb-3">
      <div className="text-lg font-mono text-white/30">{timeOnly}</div>
    </div>
  );
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
  const [statusFilter, setStatusFilter] = useState('All');
  const [todayOnly, setTodayOnly] = useState(false);
  const [tickerFilter, setTickerFilter] = useState(null);
  const [sortLargest, setSortLargest] = useState(false);
  const [showCryptoPnl, setShowCryptoPnl] = useState(false);
  const [showEquityPnl, setShowEquityPnl] = useState(false);
  const [yoloTrades, setYoloTrades] = useState([]);
  const [yoloActive, setYoloActive] = useState(false);
  const [yoloFilterStatus, setYoloFilterStatus] = useState('All');
  const [yoloTodayOnly, setYoloTodayOnly] = useState(false);
  const [alpacaExpanded, setAlpacaExpanded] = useState(false);
  const [ibkrExpanded, setIbkrExpanded] = useState(false);
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [connectedBrokers, setConnectedBrokers] = useState([]);
  const [brainModalSession, setBrainModalSession] = useState(null);
  const [brainExpanded, setBrainExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [activeSkillModal, setActiveSkillModal] = useState(null);
  const [showYoloConfirm, setShowYoloConfirm] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [subTab, setSubTab] = useState('overview');
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const prevBalanceRef = useRef(0);

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
      setLastFetchTime(new Date().toISOString());
    } catch (err) {
      console.error('[SentinelPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserSettings = useCallback(async () => {
    if (!user?.id) return;
    try {
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
        setYoloActive(settings.yolo_active || false);
      }
      // Load user's YOLO copied trades
      const { data: copiedTrades } = await supabase
        .from('sentinel_copied_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(200);
      if (copiedTrades) setYoloTrades(copiedTrades);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.warn('[SentinelPage] fetchUserSettings error:', err?.message || err);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: notifs } = await supabase
        .from('sentinel_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(notifs || []);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.warn('[SentinelPage] fetchNotifications error:', err?.message || err);
    }
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
    const realizedBase = (data?.account?.current_balance || STARTING_BALANCE);
    return (realizedBase + liveUnrealizedPnl) - STARTING_BALANCE;
  }, [data?.account?.current_balance, liveUnrealizedPnl]);

  const recentSessions = data?.recentSessions || [];
  const recentClosedTrades = data?.recentClosedTrades || [];
  // Single source of truth: total trades = closed + open
  const openTradeCount = openTrades.length;
  const closedTradeCount = recentClosedTrades.length;
  const unifiedTotalTrades = closedTradeCount + openTradeCount;
  const rawMemory = data?.memory || {};
  // brain_summary may be JSON string containing {text, report, date} or plain text
  const memory = (() => {
    const m = { ...rawMemory };
    if (m.brain_summary && typeof m.brain_summary === 'string' && m.brain_summary.startsWith('{')) {
      try {
        const parsed = JSON.parse(m.brain_summary);
        m.brain_summary = parsed.text || m.brain_summary;
        m.latest_report = parsed.report || null;
        m.latest_report_date = parsed.date || null;
      } catch {}
    }
    return m;
  })();
  const unlock = data?.unlockStatus || {};
  const isSubscribed = userSettings?.subscription_status === 'active' || userSettings?.subscription_status === 'trialing';
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

  // Derive today's realized P&L using local midnight (consistent with todayLocalPnl)
  const todayRealizedPnl = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime();
    return recentClosedTrades
      .filter(t => { const ts = t.opened_at || t.closed_at; return ts && new Date(ts).getTime() >= ms; })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [recentClosedTrades]);

  // Classify trade as crypto or equity
  const isCryptoTrade = useCallback((trade) => {
    const s = (trade.symbol || '').toUpperCase();
    return s.includes('BTC') || s.includes('ETH') || s.includes('SOL') || s.includes('DOGE') || s.includes('AVAX') || s.includes('XRP') || s.includes('/USD') || s.includes('CRYPTO');
  }, []);

  // Split open trades
  const cryptoOpenTrades = useMemo(() => openTrades.filter(t => isCryptoTrade(t)), [openTrades, isCryptoTrade]);
  const equityOpenTrades = useMemo(() => openTrades.filter(t => !isCryptoTrade(t)), [openTrades, isCryptoTrade]);

  // Open position P&L summaries
  const cryptoOpenPnl = useMemo(() => cryptoOpenTrades.reduce((s, t) => s + computePnl(t, livePrices).pnl, 0), [cryptoOpenTrades, livePrices]);
  const equityOpenPnl = useMemo(() => equityOpenTrades.reduce((s, t) => s + computePnl(t, livePrices).pnl, 0), [equityOpenTrades, livePrices]);

  // Today's P&L using local midnight (matches session history "Today" filter)
  const todayLocalPnl = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime();
    return recentClosedTrades
      .filter(t => { const ts = t.opened_at || t.closed_at; return ts && new Date(ts).getTime() >= ms; })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [recentClosedTrades]);

  // Today's P&L split by crypto vs equity
  const todayCryptoPnl = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime();
    return recentClosedTrades
      .filter(t => { const ts = t.opened_at || t.closed_at; return ts && new Date(ts).getTime() >= ms && isCryptoTrade(t); })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [recentClosedTrades, isCryptoTrade]);
  const todayEquityPnl = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime();
    return recentClosedTrades
      .filter(t => { const ts = t.opened_at || t.closed_at; return ts && new Date(ts).getTime() >= ms && !isCryptoTrade(t); })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [recentClosedTrades, isCryptoTrade]);

  // All-time P&L split
  const allTimeCryptoPnl = useMemo(() => recentClosedTrades.filter(t => isCryptoTrade(t)).reduce((s, t) => s + (t.pnl || 0), 0), [recentClosedTrades, isCryptoTrade]);
  const allTimeEquityPnl = useMemo(() => recentClosedTrades.filter(t => !isCryptoTrade(t)).reduce((s, t) => s + (t.pnl || 0), 0), [recentClosedTrades, isCryptoTrade]);

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
          <span className="text-xs text-gray-600 font-mono">Last updated: {timeAgo(lastFetchTime)}</span>
        </div>
      </div>

      {subTab === 'engine' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <AppErrorBoundary>
            <SentinelEngine
              sentinelTotalPnl={accountTotalPnl}
              sentinelDailyPnl={todayCryptoPnl + todayEquityPnl + cryptoOpenPnl + equityOpenPnl}
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
                  $<CountUp start={prevBalanceRef.current} end={data?.liveBalance || account.current_balance || STARTING_BALANCE} duration={1.2} decimals={2} separator="," preserveValue onEnd={() => { prevBalanceRef.current = data?.liveBalance || account.current_balance || STARTING_BALANCE; }} />
                </span>
              </div>
              {(() => {
                const pctChange = (accountTotalPnl / STARTING_BALANCE) * 100;
                const todayTotal = todayCryptoPnl + todayEquityPnl + cryptoOpenPnl + equityOpenPnl;
                const todayPct = (todayTotal / STARTING_BALANCE) * 100;
                return (
                  <>
                    <span className={`text-sm font-mono ${accountTotalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Total P&L: {accountTotalPnl >= 0 ? '+' : ''}${accountTotalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {' '}({pctChange.toFixed(2)}%)
                    </span>
                    <br />
                    <span className="text-[12px] font-mono">
                      <span className="text-white/50">Today: </span>
                      <span className={todayTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {todayTotal >= 0 ? '+' : ''}${todayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {' '}({todayPct.toFixed(2)}%)
                      </span>
                    </span>
                  </>
                );
              })()}
            </div>
            <div className="flex gap-8">
              <MetricTooltip label="Win Rate" tip="Percentage of trades that were profitable. Higher is better — 50%+ with good R means a strong edge.">
                <div className={`mt-1 ${accountTotalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(account.win_rate || 0).toFixed(1)}%</div>
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
            {/* CRYPTO / EQUITIES TWO-COLUMN SPLIT */}
            <div className="grid grid-cols-2 gap-4">
              {/* LEFT — CRYPTO (24/7) */}
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, ...SPRING }}
                className={`${GLASS} p-5 transition-all duration-300`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">CRYPTO</span>
                  <span className="text-[10px] text-emerald-400 font-mono">LIVE 24/7</span>
                </div>
                {cryptoOpenTrades.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Open Positions</span>
                    {cryptoOpenTrades.map((trade, i) => (
                      <PositionRow key={trade.id} trade={trade} i={i} livePrices={livePrices} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 font-mono">No open crypto positions</p>
                )}
                {(() => {
                  const todayCryptoTotal = cryptoOpenPnl + todayCryptoPnl;
                  return (
                    <div className="mt-4 pt-3 border-t border-white/[0.06] font-mono space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30">Open P&L</span>
                        <span className={cryptoOpenPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtDollar(cryptoOpenPnl)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30">Realized P&L</span>
                        <span className={todayCryptoPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtDollar(todayCryptoPnl)}</span>
                      </div>
                      <div className="border-t border-white/[0.06]" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50 font-medium">Today Total</span>
                        <span className={`font-medium ${todayCryptoTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtDollar(todayCryptoTotal)}</span>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>

              {/* RIGHT — EQUITIES (Market Hours) */}
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, ...SPRING }}
                className={`${GLASS} p-5 transition-all duration-300`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">EQUITIES</span>
                  {marketOpen ? (
                    <span className="text-[10px] text-emerald-400 font-mono">MARKET OPEN</span>
                  ) : (
                    <span className="text-[10px] text-white/20 font-mono">MARKET CLOSED · Opens 9:30 AM ET</span>
                  )}
                </div>
                <MarketClock />
                {marketOpen ? (
                  equityOpenTrades.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">Open Positions</span>
                      {equityOpenTrades.map((trade, i) => (
                        <PositionRow key={trade.id} trade={trade} i={i} showDollar livePrices={livePrices} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 font-mono">No open equity positions</p>
                  )
                ) : (
                  <p className="text-xs text-white/20 font-mono py-4">Equity trades will appear here during market hours</p>
                )}
                {(() => {
                  const todayEquityTotal = equityOpenPnl + todayEquityPnl;
                  return (
                    <div className="mt-4 pt-3 border-t border-white/[0.06] font-mono space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30">Open P&L</span>
                        <span className={equityOpenPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtDollar(equityOpenPnl)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/30">Realized P&L</span>
                        <span className={todayEquityPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtDollar(todayEquityPnl)}</span>
                      </div>
                      <div className="border-t border-white/[0.06]" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50 font-medium">Today Total</span>
                        <span className={`font-medium ${todayEquityTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtDollar(todayEquityTotal)}</span>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            </div>

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

            {/* SESSION HISTORY — SPLIT VIEW */}
            <div className={`grid gap-4 ${yoloActive || yoloTrades.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>

            {/* LEFT — SENTINEL BRAIN TRADES */}
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
                {['BTC', 'ETH', 'SOL', 'SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT'].map((pill) => (
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
                {sortedTrades.length === 0 && (
                  <p className="text-xs text-gray-600 font-mono py-2">{recentClosedTrades.length === 0 ? 'No trades yet' : 'No trades match filters'}</p>
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
                      <span className="text-white font-medium">{trade.symbol?.includes('/') ? '' : '$'}{trade.symbol}</span>
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
              {filteredTrades.length > 0 && (() => {
                const isFiltered = todayOnly || statusFilter !== 'All' || !!tickerFilter;
                const footerValue = isFiltered ? netPnl : accountTotalPnl;
                const footerLabel = isFiltered ? 'Filtered P&L' : 'Total P&L';
                return (
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/[0.06] px-1 text-xs font-mono">
                    <span className="text-white/30">{footerLabel}</span>
                    <span className={`font-medium ${footerValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {footerValue >= 0 ? '+' : ''}${footerValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}

              {/* ALL-TIME CRYPTO / EQUITY P&L TOGGLES */}
              <div className="flex gap-6 mt-3 px-1 text-xs font-mono">
                <button onClick={() => setShowCryptoPnl(v => !v)} className="text-white/30 hover:text-white/50 transition-colors text-left">
                  All-Time Crypto P&L
                  {showCryptoPnl && (
                    <span className={`ml-2 ${allTimeCryptoPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {allTimeCryptoPnl >= 0 ? '+' : ''}${allTimeCryptoPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </button>
                <button onClick={() => setShowEquityPnl(v => !v)} className="text-white/30 hover:text-white/50 transition-colors text-left">
                  All-Time Equity P&L
                  {showEquityPnl && (
                    <span className={`ml-2 ${allTimeEquityPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {allTimeEquityPnl >= 0 ? '+' : ''}${allTimeEquityPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </button>
              </div>
              </>);
              })()}
            </motion.div>

            {/* RIGHT — YOLO MY TRADES (shows when YOLO active or has history) */}
            {(yoloActive || yoloTrades.length > 0) && (() => {
              const todayStart = new Date(); todayStart.setHours(0,0,0,0);
              let filtered = [...yoloTrades];
              if (yoloTodayOnly) filtered = filtered.filter(t => { const ts = t.opened_at || t.closed_at; return ts && new Date(ts) >= todayStart; });
              if (yoloFilterStatus === 'Wins') filtered = filtered.filter(t => t.win);
              else if (yoloFilterStatus === 'Losses') filtered = filtered.filter(t => !t.win);
              const wins = filtered.filter(t => t.win).length;
              const winRate = filtered.length > 0 ? (wins / filtered.length) * 100 : 0;
              const winTrades = filtered.filter(t => t.win && t.pnl > 0);
              const avgWin = winTrades.length > 0 ? winTrades.reduce((s,t) => s+(t.pnl||0),0)/winTrades.length : 0;
              const netPnl = filtered.reduce((s,t) => s+(t.pnl||0),0);
              return (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, ...SPRING }}
                  className={`${GLASS} p-5 transition-all duration-300`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: yoloActive ? '#ef4444' : '#6b7280' }}>
                      {yoloActive ? '⚡ YOLO — LIVE' : '⚡ YOLO HISTORY'}
                    </span>
                    {yoloActive && <span className="text-[10px] font-mono text-red-400 animate-pulse">● Copying trades</span>}
                  </div>
                  {yoloTrades.length === 0 && yoloActive && (
                    <p className="text-xs text-gray-600 font-mono py-3">Waiting for Sentinel's next trade...</p>
                  )}
                  {(yoloTrades.length > 0 || !yoloActive) && (<>
                  {/* STAT CARDS */}
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[
                      { label: 'Trades', value: filtered.length, fmt: v => v.toString(), color: 'text-white' },
                      { label: 'Win Rate', value: winRate, fmt: v => `${v.toFixed(1)}%`, color: netPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                      { label: 'Avg Win', value: avgWin, fmt: v => `$${v.toFixed(2)}`, color: 'text-emerald-400' },
                      { label: 'Net P&L', value: netPnl, fmt: v => `${v>=0?'+':''}$${v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`, color: netPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                    ].map(stat => (
                      <div key={stat.label} className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-2.5">
                        <div className="text-[10px] uppercase tracking-[0.4px] text-white/30">{stat.label}</div>
                        <div className={`text-sm font-mono font-bold mt-0.5 ${stat.color}`}>{stat.fmt(stat.value)}</div>
                      </div>
                    ))}
                  </div>
                  {/* FILTERS */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {['Today', 'All', 'Wins', 'Losses'].map(pill => {
                      const active = pill === 'Today' ? yoloTodayOnly : pill === 'All' ? (!yoloTodayOnly && yoloFilterStatus === 'All') : yoloFilterStatus === pill;
                      return (
                        <button key={pill} onClick={() => {
                          if (pill === 'Today') { setYoloTodayOnly(true); setYoloFilterStatus('All'); }
                          else if (pill === 'All') { setYoloTodayOnly(false); setYoloFilterStatus('All'); }
                          else { setYoloTodayOnly(false); setYoloFilterStatus(prev => prev === pill ? 'All' : pill); }
                        }} className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${active ? 'bg-white text-[#0a0a0f] font-medium' : 'border border-white/10 text-white/50 hover:text-white/70'}`}>
                          {pill}
                        </button>
                      );
                    })}
                  </div>
                  {/* GRID HEADER */}
                  <div className="grid mt-3 mb-1 px-1 text-[10px] uppercase tracking-[0.4px] text-white/30" style={{ gridTemplateColumns: '16px 80px 1fr 80px 80px 80px' }}>
                    <span></span><span>Pair</span><span>Time</span><span>Entry</span><span>Exit</span><span className="text-right">P&L</span>
                  </div>
                  {/* TRADE ROWS */}
                  <div className="mt-1 max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {filtered.length === 0 ? (
                      <p className="text-xs text-gray-600 font-mono py-2">No trades match filters</p>
                    ) : filtered.map(trade => {
                      const isWin = trade.win || (trade.pnl||0) >= 0;
                      const openTime = trade.opened_at ? new Date(trade.opened_at) : null;
                      const closeTime = trade.closed_at ? new Date(trade.closed_at) : null;
                      const timeFmt = d => d ? d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) : '—';
                      return (
                        <div key={trade.id} className="grid items-center py-2 px-1 border-b border-white/[0.06] text-xs font-mono" style={{ gridTemplateColumns: '16px 80px 1fr 80px 80px 80px' }}>
                          <div className="flex justify-center"><div className="w-[3px] h-5 rounded-full" style={{ backgroundColor: isWin ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.5)' }} /></div>
                          <span className="text-white font-medium text-[11px]">{trade.symbol?.replace('/USD','')}</span>
                          <span className="text-white/30 text-[10px]">{timeFmt(openTime)}</span>
                          <span className="text-white/50 text-[10px]">${trade.entry != null ? Number(trade.entry).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</span>
                          <span className="text-white/50 text-[10px]">${trade.exit_price != null ? Number(trade.exit_price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</span>
                          <span className={`text-right font-medium text-[11px] ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>{(trade.pnl||0)>=0?'+':''}${(trade.pnl||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* FOOTER */}
                  {filtered.length > 0 && (
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/[0.06] px-1 text-xs font-mono">
                      <span className="text-white/30">Net P&L</span>
                      <span className={`font-medium ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netPnl>=0?'+':''}${netPnl.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                    </div>
                  )}
                  </>)}
                </motion.div>
              );
            })()}

            </div> {/* end split grid */}
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
                {/* Always show latest daily report from brain even if no per-user notification */}
                {notifications.length === 0 && memory.latest_report && memory.latest_report_date && (
                  <motion.div
                    whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    onClick={() => {
                      const sess = recentSessions.find(s => s.session_date === memory.latest_report_date);
                      setBrainModalSession(sess || { session_date: memory.latest_report_date, gross_pnl: 0, adjustments_made: { daily_report: memory.latest_report } });
                    }}
                    className="text-xs py-1.5 rounded-xl px-2 cursor-pointer transition-all duration-200 text-gray-300"
                  >
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <span className="font-mono font-semibold flex-1 truncate">{memory.latest_report_date} — Daily Report</span>
                    </div>
                    <p className="text-gray-400 mt-1 ml-6 leading-relaxed text-[11px]">{memory.brain_summary}</p>
                    <span className="text-emerald-500/60 text-[10px] ml-6">tap to read full report →</span>
                  </motion.div>
                )}
                {notifications.length === 0 && !memory.latest_report && (
                  <p className="text-xs text-gray-600 font-mono py-2">First report fires at 8pm ET</p>
                )}
                {notifications.map((notif) => {
                  const isReport = notif.type === 'daily_report' && notif.metadata?.report;
                  const reportDate = notif.metadata?.session_date;
                  const sessionForReport = isReport ? recentSessions.find(s => s.session_date === reportDate) : null;
                  return (
                    <motion.div
                      key={notif.id}
                      whileHover={isReport ? { x: 2, backgroundColor: 'rgba(255,255,255,0.04)' } : {}}
                      onClick={isReport ? (e) => { e.stopPropagation(); setBrainModalSession(sessionForReport || { session_date: reportDate, claude_analysis: JSON.stringify(notif.metadata?.report, null, 2), gross_pnl: notif.metadata?.pnl, adjustments_made: notif.metadata }); } : undefined}
                      className={`text-xs py-1.5 rounded-xl px-2 transition-all duration-200 ${notif.read ? 'text-gray-600' : 'text-gray-300'} ${isReport ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>
                          {notif.type === 'trade_opened' && '⚡'}
                          {notif.type === 'trade_closed' && '✓'}
                          {notif.type === 'brain_update' && '🧠'}
                          {notif.type === 'daily_report' && '📊'}
                          {notif.type === 'yolo_unlocked' && '🔓'}
                          {notif.type === 'session_summary' && '📊'}
                        </span>
                        <span className="font-mono font-semibold flex-1 min-w-0 truncate">{notif.title}</span>
                        <span className="text-gray-600 flex-shrink-0">{timeAgo(notif.created_at)}</span>
                      </div>
                      {isReport && notif.metadata ? (
                        <div className="mt-1 ml-6 space-y-0.5">
                          <span className={`font-mono font-semibold ${(notif.metadata.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(notif.metadata.pnl || 0) >= 0 ? '+' : ''}${(notif.metadata.pnl || 0).toFixed(2)} · {notif.metadata.win_rate}% WR · {notif.metadata.trades} trades
                          </span>
                          <p className="text-gray-500 leading-relaxed line-clamp-2">{notif.metadata.report?.headline}</p>
                          <span className="text-emerald-500/60 text-[10px]">tap to read full report →</span>
                        </div>
                      ) : (
                        <p className="text-gray-500 mt-0.5 ml-6">{notif.body}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-gray-500 hover:text-white text-xs mt-2 transition-colors duration-200">
                  Mark all read
                </button>
              )}
            </motion.div>

            {/* BROKER CONNECT — Alpaca */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22, ...SPRING }}
              className={`${GLASS} overflow-hidden transition-all duration-300`}
            >
              <motion.div
                onClick={() => setAlpacaExpanded(v => !v)}
                className="flex items-center justify-between px-5 py-3.5 cursor-pointer"
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center gap-3">
                  {/* Alpaca logo — black circle + alpaca silhouette */}
                  <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                      <path d="M12 3c-1.2 0-2.1.6-2.6 1.4-.3-.1-.6-.2-1-.2-1.4 0-2.4 1-2.4 2.3 0 .4.1.8.3 1.1C5.5 8 5 8.8 5 9.8c0 1.5 1.1 2.7 2.5 2.9V14H6v2h1v4h2v-4h6v4h2v-4h1v-2h-1.5v-1.3c1.4-.2 2.5-1.4 2.5-2.9 0-1-.5-1.8-1.3-2.2.2-.3.3-.7.3-1.1 0-1.3-1-2.3-2.4-2.3-.4 0-.7.1-1 .2C14.1 3.6 13.2 3 12 3zm0 1.5c.6 0 1 .4 1 .9l.1.8.7-.4c.2-.1.4-.2.6-.2.5 0 .9.4.9.8 0 .2-.1.4-.2.6l-.5.6.7.3c.5.2.8.7.8 1.2 0 .8-.6 1.4-1.4 1.4H9.3c-.8 0-1.4-.6-1.4-1.4 0-.5.3-1 .8-1.2l.7-.3-.5-.6c-.1-.2-.2-.4-.2-.6 0-.4.4-.8.9-.8.2 0 .4.1.6.2l.7.4.1-.8c0-.5.4-.9 1-.9z"/>
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white tracking-tight">Alpaca</span>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {connectedBrokers.some(b => b.id === 'alpaca') ? '● Connected' : '○ Not connected'}
                    </div>
                  </div>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${alpacaExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </motion.div>
              <AnimatePresence>
                {alpacaExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/[0.06]"
                  >
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-xs text-gray-400 leading-relaxed">Connect your Alpaca account to copy Sentinel's trades directly to your paper or live brokerage account.</p>
                      <a
                        href="https://app.alpaca.markets/brokerage/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
                      >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Get your API keys from Alpaca →
                      </a>
                      <button
                        onClick={() => { setBrokerModalOpen(true); }}
                        className="w-full py-2 rounded-xl text-xs font-mono font-semibold tracking-wider transition-all duration-200 border"
                        style={{ background: 'rgba(255,220,0,0.08)', borderColor: 'rgba(255,220,0,0.2)', color: '#ffd700' }}
                      >
                        {connectedBrokers.some(b => b.id === 'alpaca') ? '✓ Manage Connection' : 'Connect Alpaca'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* BROKER CONNECT — Interactive Brokers */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.24, ...SPRING }}
              className={`${GLASS} overflow-hidden transition-all duration-300`}
            >
              <motion.div
                onClick={() => setIbkrExpanded(v => !v)}
                className="flex items-center justify-between px-5 py-3.5 cursor-pointer"
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center gap-3">
                  {/* IBKR logo — red mark */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none">
                      <circle cx="8" cy="14" r="7" fill="#c0392b"/>
                      <circle cx="8" cy="14" r="4" fill="white"/>
                      <circle cx="8" cy="14" r="2" fill="#c0392b"/>
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white tracking-tight">Interactive Brokers</span>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {connectedBrokers.some(b => b.id === 'ibkr') ? '● Connected' : '○ Not connected'}
                    </div>
                  </div>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${ibkrExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </motion.div>
              <AnimatePresence>
                {ibkrExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/[0.06]"
                  >
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-xs text-gray-400 leading-relaxed">Connect your IBKR account to execute Sentinel's signals through Interactive Brokers' professional infrastructure.</p>
                      <a
                        href="https://www.interactivebrokers.com/en/trading/ib-api.php"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 font-mono transition-colors"
                      >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Get your API credentials from IBKR →
                      </a>
                      <button
                        onClick={() => { setBrokerModalOpen(true); }}
                        className="w-full py-2 rounded-xl text-xs font-mono font-semibold tracking-wider transition-all duration-200 border"
                        style={{ background: 'rgba(192,57,43,0.08)', borderColor: 'rgba(192,57,43,0.3)', color: '#e74c3c' }}
                      >
                        {connectedBrokers.some(b => b.id === 'ibkr') ? '✓ Manage Connection' : 'Connect IBKR'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Broker connect modal */}
            {brokerModalOpen && (
              <BrokerConnectModal
                isOpen={brokerModalOpen}
                onClose={() => setBrokerModalOpen(false)}
                onConnect={(broker) => {
                  setConnectedBrokers(prev => [...prev.filter(b => b.id !== broker.id), broker]);
                  setBrokerModalOpen(false);
                }}
                connectedBrokers={connectedBrokers}
              />
            )}

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
                              ? RISK_PRESET_CLASSES[color].active
                              : RISK_PRESET_CLASSES[color].inactive
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

              {(() => {
                // Try to parse daily_report from adjustments_made or claude_analysis
                let report = brainModalSession.adjustments_made?.daily_report || brainModalSession.adjustments_made?.report || null;
                if (!report && brainModalSession.claude_analysis) {
                  try {
                    const parsed = JSON.parse(brainModalSession.claude_analysis.match(/\{[\s\S]*\}/)?.[0] || '{}');
                    report = parsed.daily_report || null;
                  } catch {}
                }

                if (report) {
                  return (
                    <div className="space-y-4">
                      {report.headline && (
                        <p className="text-base font-mono font-bold text-white leading-snug">{report.headline}</p>
                      )}
                      {report.what_worked?.length > 0 && (
                        <div>
                          <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">What Worked</span>
                          <ul className="mt-1.5 space-y-1">
                            {report.what_worked.map((item, i) => (
                              <li key={i} className="text-sm text-gray-300 font-mono flex gap-2"><span className="text-emerald-400 flex-shrink-0">+</span>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.what_failed?.length > 0 && (
                        <div>
                          <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold">What Failed</span>
                          <ul className="mt-1.5 space-y-1">
                            {report.what_failed.map((item, i) => (
                              <li key={i} className="text-sm text-gray-300 font-mono flex gap-2"><span className="text-red-400 flex-shrink-0">−</span>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.biggest_mistake && (
                        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3">
                          <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold">Biggest Mistake</span>
                          <p className="mt-1.5 text-sm text-gray-300 font-mono leading-relaxed">{report.biggest_mistake}</p>
                        </div>
                      )}
                      {report.adjustment && (
                        <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-3">
                          <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">Rule Change for Tomorrow</span>
                          <p className="mt-1.5 text-sm text-gray-300 font-mono leading-relaxed">{report.adjustment}</p>
                        </div>
                      )}
                      {report.tomorrow_focus && (
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Tomorrow's Focus</span>
                          <p className="mt-1.5 text-sm text-gray-300 font-mono leading-relaxed">{report.tomorrow_focus}</p>
                        </div>
                      )}
                      {report.signal_health && (
                        <div className="border-t border-white/[0.06] pt-3">
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Signal Health — 5 Models</span>
                          <div className="mt-2 space-y-2">
                            {[
                              { key: 'bayesian', label: 'Bayesian', color: 'text-cyan-400' },
                              { key: 'edge_filter', label: 'Edge Filter', color: 'text-emerald-400' },
                              { key: 'spread', label: 'Spread/LMSR', color: 'text-amber-400' },
                              { key: 'stoikov', label: 'Stoikov', color: 'text-purple-400' },
                              { key: 'monte_carlo', label: 'Monte Carlo', color: 'text-red-400' },
                            ].filter(m => report.signal_health[m.key]).map(m => (
                              <div key={m.key} className="flex gap-2">
                                <span className={`text-[10px] font-mono font-bold flex-shrink-0 w-24 ${m.color}`}>{m.label}</span>
                                <span className="text-[11px] text-gray-300 font-mono leading-relaxed">{report.signal_health[m.key]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {report.path_to_greatness && (
                        <div className="border-t border-white/[0.06] pt-3">
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Path to Greatness</span>
                          <p className="mt-1.5 text-sm text-gray-400 font-mono leading-relaxed italic">{report.path_to_greatness}</p>
                        </div>
                      )}
                    </div>
                  );
                }

                if (brainModalSession.claude_analysis) {
                  return (
                    <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                      {brainModalSession.claude_analysis}
                    </div>
                  );
                }

                return <p className="text-sm text-gray-500 font-mono">Analysis pending — Sentinel reviews daily at 11pm ET.</p>;
              })()}

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
                          <span className="text-white font-semibold">{trade.symbol?.includes('/') ? '' : '$'}{trade.symbol}</span>
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
