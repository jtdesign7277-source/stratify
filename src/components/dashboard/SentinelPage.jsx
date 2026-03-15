import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import AppErrorBoundary from '../shared/AppErrorBoundary';

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

function WinRateColor({ value }) {
  if (value >= 65) return <span className="text-emerald-400">{value?.toFixed(1) || 0}%</span>;
  if (value >= 50) return <span className="text-yellow-400">{value?.toFixed(1) || 0}%</span>;
  return <span className="text-red-400">{value?.toFixed(1) || 0}%</span>;
}

// === SENTINEL PAGE ===
function SentinelPageInner() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [expandedSession, setExpandedSession] = useState(null);
  const [showYoloConfirm, setShowYoloConfirm] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const lastFetchRef = useRef(null);

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
  const recentSessions = data?.recentSessions || [];
  const recentClosedTrades = data?.recentClosedTrades || [];
  const memory = data?.memory || {};
  const unlock = data?.unlockStatus || {};
  const isSubscribed = userSettings?.subscription_status === 'active' || userSettings?.subscription_status === 'trialing';
  const yoloActive = userSettings?.yolo_active || false;
  const unreadCount = notifications.filter((n) => !n.read).length;

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
      <div className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] flex-shrink-0">
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
        <span className="text-xs text-gray-600 font-mono">Last updated: {timeAgo(lastFetchRef.current)}</span>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>
        {/* ACCOUNT CARD */}
        <motion.div className={`${GLASS} ${GLASS_HOVER} p-6 transition-all duration-300`} whileHover={{ y: -2 }}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-gray-500 text-sm">Starting $2,000,000</span>
              <div className="mt-1">
                <span className="font-mono text-3xl font-bold text-white">
                  $<CountUp end={data?.liveBalance || account.current_balance || 500000} duration={1.2} decimals={2} separator="," preserveValue />
                </span>
              </div>
              <span className={`text-sm font-mono ${(data?.totalUnrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(data?.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}${(data?.totalUnrealizedPnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {' '}({data?.liveBalance ? (((data.liveBalance - 2000000) / 2000000) * 100).toFixed(2) : '0.00'}%)
              </span>
            </div>
            <div className="flex gap-8">
              <div className="text-right">
                <span className="text-xs tracking-widest text-gray-500 uppercase">Win Rate</span>
                <div className="mt-1"><WinRateColor value={account.win_rate || 0} /></div>
              </div>
              <div className="text-right">
                <span className="text-xs tracking-widest text-gray-500 uppercase">Avg R</span>
                <div className="mt-1 text-emerald-400 font-mono">{(account.avg_r || 0).toFixed(2)}R</div>
              </div>
              <div className="text-right">
                <span className="text-xs tracking-widest text-gray-500 uppercase">Total Trades</span>
                <div className="mt-1 text-white font-mono">{account.total_trades || 0}</div>
              </div>
              <div className="text-right">
                <span className="text-xs tracking-widest text-gray-500 uppercase">Expectancy</span>
                <div className="mt-1 text-emerald-400 font-mono">+{(account.expectancy || 0).toFixed(1)}R</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* UNLOCK PROGRESS */}
        {!unlock.unlocked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, ...SPRING }}
            className={`${GLASS} p-6 transition-all duration-300`}
          >
            <span className="text-xs tracking-widest text-gray-500 font-semibold uppercase">YOLO UNLOCKS WHEN:</span>
            <div className="flex gap-8 mt-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{unlock.closedTrades || 0} / 20 trades</span>
                  {(unlock.closedTrades || 0) >= 20 ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  )}
                </div>
                <div className="h-1 rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full rounded-full bg-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((unlock.closedTrades || 0) / 20) * 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{(unlock.winRate || 0).toFixed(1)}% / 65% win rate</span>
                  {(unlock.winRate || 0) >= 65 ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  )}
                </div>
                <div className="h-1 rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full rounded-full bg-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((unlock.winRate || 0) / 65) * 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

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
                  <div className="text-white font-mono">{openTrades.length + (todaySession.trades_closed || 0)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">Wins</span>
                  <div className="text-emerald-400 font-mono">{todaySession.wins || 0}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">Losses</span>
                  <div className="text-red-400 font-mono">{todaySession.losses || 0}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase">P&L</span>
                  <div className={`font-mono ${((data?.totalUnrealizedPnl || 0) + (todaySession.gross_pnl || 0)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {((data?.totalUnrealizedPnl || 0) + (todaySession.gross_pnl || 0)) >= 0 ? '+' : ''}${((data?.totalUnrealizedPnl || 0) + (todaySession.gross_pnl || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        {trade.current_price && <span className="text-gray-400">Now ${trade.current_price}</span>}
                        <span className="text-gray-500">{trade.size ? trade.size.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} units</span>
                        {trade.unrealized_pnl != null && (
                          <span className={trade.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {trade.unrealized_pnl >= 0 ? '+' : ''}${trade.unrealized_pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        <span className="text-gray-500">Size ${(trade.dollar_size || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
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
                {recentClosedTrades.length === 0 && openTrades.length === 0 && (
                  <p className="text-xs text-gray-600 font-mono py-4">Waiting for first signals...</p>
                )}
                {[...openTrades, ...recentClosedTrades].slice(0, 20).map((trade, i) => (
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
            {trade.unrealized_pnl != null && (
              <span className={trade.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {trade.unrealized_pnl >= 0 ? '+' : ''}${trade.unrealized_pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
            <span className="text-gray-500">Size ${(trade.dollar_size || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <span className={`w-2 h-2 rounded-full ${trade.status === 'open' ? 'bg-emerald-400' : trade.win ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* SESSION HISTORY */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SESSION HISTORY</span>
              <div className="mt-3 space-y-1">
                {recentSessions.length === 0 && (
                  <p className="text-xs text-gray-600 font-mono py-2">No sessions yet</p>
                )}
                {recentSessions.map((session, i) => (
                  <motion.div key={session.id}>
                    <motion.div
                      whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                      className="flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer text-xs font-mono transition-all duration-300"
                    >
                      <span className="text-gray-400 w-24">{session.session_date}</span>
                      <span className="text-white">{session.trades_fired || 0} trades</span>
                      <span className="text-emerald-400">{session.wins || 0}W</span>
                      <span className="text-red-400">{session.losses || 0}L</span>
                      <span className={`w-24 text-right ${(session.gross_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(session.gross_pnl || 0) >= 0 ? '+' : ''}${(session.gross_pnl || 0).toFixed(0)}
                      </span>
                    </motion.div>
                    <AnimatePresence>
                      {expandedSession === session.id && session.claude_analysis && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden px-3 pb-2"
                        >
                          <p className="text-xs text-gray-500 leading-relaxed mt-1 whitespace-pre-wrap">{session.claude_analysis}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 min-w-0">
            {/* BRAIN EVOLUTION */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SENTINEL BRAIN</span>
                <span className="text-xs text-gray-500 font-mono">Session {memory.sessions_processed || 0}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                {memory.brain_summary || 'Sentinel is building its first sessions. Check back after market close today.'}
              </p>
              {todaySession?.adjustments_made && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">Today's Update</span>
                  <div className="mt-2 space-y-1">
                    {Object.entries(todaySession.adjustments_made.setup_weights || {}).map(([key, val]) => (
                      <div key={key} className="text-xs font-mono text-gray-400">
                        {val > 0 ? '↑' : '↓'} {key} {val > 0 ? '+' : ''}{val} confidence
                      </div>
                    ))}
                    {(todaySession.adjustments_made.suspended_conditions || []).map((c, i) => (
                      <div key={i} className="text-xs font-mono text-red-400">✕ Suspended: {c}</div>
                    ))}
                  </div>
                </div>
              )}
              {todaySession?.weekly_summary && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">WEEKLY SUMMARY</span>
                  <p className="text-sm text-gray-300 leading-relaxed mt-2">{todaySession.weekly_summary}</p>
                </div>
              )}
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
}{trade.symbol}</span>
                    <span className="text-gray-400">{trade.size ? trade.size.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' units' : ''}</span>
                    <span className="text-gray-500">Entry ${trade.entry}</span>
            {trade.unrealized_pnl != null && (
              <span className={trade.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {trade.unrealized_pnl >= 0 ? '+' : ''}${trade.unrealized_pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
            <span className={`w-2 h-2 rounded-full ${trade.status === 'open' ? 'bg-emerald-400' : trade.win ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* SESSION HISTORY */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SESSION HISTORY</span>
              <div className="mt-3 space-y-1">
                {recentSessions.length === 0 && (
                  <p className="text-xs text-gray-600 font-mono py-2">No sessions yet</p>
                )}
                {recentSessions.map((session, i) => (
                  <motion.div key={session.id}>
                    <motion.div
                      whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                      className="flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer text-xs font-mono transition-all duration-300"
                    >
                      <span className="text-gray-400 w-24">{session.session_date}</span>
                      <span className="text-white">{session.trades_fired || 0} trades</span>
                      <span className="text-emerald-400">{session.wins || 0}W</span>
                      <span className="text-red-400">{session.losses || 0}L</span>
                      <span className={`w-24 text-right ${(session.gross_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(session.gross_pnl || 0) >= 0 ? '+' : ''}${(session.gross_pnl || 0).toFixed(0)}
                      </span>
                    </motion.div>
                    <AnimatePresence>
                      {expandedSession === session.id && session.claude_analysis && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden px-3 pb-2"
                        >
                          <p className="text-xs text-gray-500 leading-relaxed mt-1 whitespace-pre-wrap">{session.claude_analysis}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 min-w-0">
            {/* BRAIN EVOLUTION */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, ...SPRING }}
              className={`${GLASS} p-5 transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">SENTINEL BRAIN</span>
                <span className="text-xs text-gray-500 font-mono">Session {memory.sessions_processed || 0}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                {memory.brain_summary || 'Sentinel is building its first sessions. Check back after market close today.'}
              </p>
              {todaySession?.adjustments_made && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">Today's Update</span>
                  <div className="mt-2 space-y-1">
                    {Object.entries(todaySession.adjustments_made.setup_weights || {}).map(([key, val]) => (
                      <div key={key} className="text-xs font-mono text-gray-400">
                        {val > 0 ? '↑' : '↓'} {key} {val > 0 ? '+' : ''}{val} confidence
                      </div>
                    ))}
                    {(todaySession.adjustments_made.suspended_conditions || []).map((c, i) => (
                      <div key={i} className="text-xs font-mono text-red-400">✕ Suspended: {c}</div>
                    ))}
                  </div>
                </div>
              )}
              {todaySession?.weekly_summary && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">WEEKLY SUMMARY</span>
                  <p className="text-sm text-gray-300 leading-relaxed mt-2">{todaySession.weekly_summary}</p>
                </div>
              )}
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
