import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Unlink,
  History,
  AlertTriangle,
} from 'lucide-react';
import BrokerConnectModal, { BrokerIcon } from './BrokerConnectModal';
import BrokerConnect from './BrokerConnect';
import { supabase } from '../../lib/supabaseClient';
import useTradingMode from '../../hooks/useTradingMode';
import usePortfolio from '../../hooks/usePortfolio';
import { clearAlpacaCache } from '../../services/alpacaService';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);

const formatNumber = (value, decimals = 2) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(Number.isFinite(value) ? value : 0);

const formatSigned = (value, suffix = '') => {
  if (!Number.isFinite(value)) return `0${suffix}`;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}${suffix}`;
};

const formatSignedCurrency = (value) => {
  if (!Number.isFinite(value)) return formatCurrency(0);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatCurrency(Math.abs(value))}`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '—';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getCompanyName = (position) => (
  position?.name
  || position?.companyName
  || position?.company
  || position?.asset_name
  || position?.assetName
  || position?.symbol
  || '—'
);

const normalizePercent = (value, fallback) => {
  if (Number.isFinite(value)) {
    const abs = Math.abs(value);
    return abs <= 1 ? value * 100 : value;
  }
  return Number.isFinite(fallback) ? fallback : 0;
};

const BROKER_MODAL_OPEN_KEY = 'broker-modal-open';
const BROKER_MODAL_STATE_KEY = 'portfolio-broker-modal-state';
const BROKER_MODAL_FIELDS_KEY = 'portfolio-broker-modal-fields';
const LEGACY_BROKER_CONNECT_FORM_KEY = 'broker-connect-form';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
};

const sectionMotion = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + (index * 0.05), duration: 0.3 },
});

const listItemMotion = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

const interactiveTransition = { type: 'spring', stiffness: 400, damping: 25 };

const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

const modalPanelMotion = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
  transition: { type: 'spring', stiffness: 300, damping: 25 },
};

const hasInProgressBrokerConnection = () => {
  try {
    const modalState = sessionStorage.getItem(BROKER_MODAL_STATE_KEY);
    if (!modalState) return false;
    const parsed = JSON.parse(modalState);
    return Boolean(parsed?.selectedBrokerId);
  } catch {
    return false;
  }
};

const clearBrokerModalPersistence = () => {
  try {
    sessionStorage.removeItem(BROKER_MODAL_OPEN_KEY);
    sessionStorage.removeItem(BROKER_MODAL_STATE_KEY);
    sessionStorage.removeItem(LEGACY_BROKER_CONNECT_FORM_KEY);
    localStorage.removeItem(BROKER_MODAL_FIELDS_KEY);
  } catch (err) {
    console.error('[PortfolioPage] Failed to clear broker modal persistence:', err);
  }
};

const PortfolioPage = ({
  themeClasses: _themeClasses,
  connectedBrokers: _connectedBrokers = [],
  onBrokerConnect = () => {},
  onBrokerDisconnect = () => {},
}) => {
  const {
    tradingMode,
    isPaper,
    isLive,
    canUseLiveTrading,
    switchTradingMode,
    switching: switchingMode,
  } = useTradingMode();
  const portfolio = usePortfolio({ tradingMode });

  const [showBrokerModal, setShowBrokerModal] = useState(() => {
    try {
      return sessionStorage.getItem(BROKER_MODAL_OPEN_KEY) === 'true' || hasInProgressBrokerConnection();
    } catch {
      return false;
    }
  });
  const [dbConnections, setDbConnections] = useState([]);
  const [hasBrokerConnection, setHasBrokerConnection] = useState(null);
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);
  const [modeError, setModeError] = useState('');

  // Persist modal state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(BROKER_MODAL_OPEN_KEY, showBrokerModal.toString());
    } catch (err) {
      console.error('[PortfolioPage] Failed to persist modal state:', err);
    }
  }, [showBrokerModal]);

  const checkBrokerConnection = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setDbConnections([]);
        setHasBrokerConnection(false);
        return;
      }

      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) {
        console.error('[PortfolioPage] Failed to fetch connections:', error);
        setDbConnections([]);
        setHasBrokerConnection(false);
        return;
      }

      const mappedConnections = (data || []).map((conn) => ({
        id: conn.broker,
        name: conn.broker.charAt(0).toUpperCase() + conn.broker.slice(1),
        is_paper: conn.is_paper,
        paperConnected: Boolean(
          conn.paper_api_key
          || conn.paper_api_keys?.api_key
          || (conn.is_paper !== false && conn.api_key)
        ),
        liveConnected: Boolean(
          conn.live_api_key
          || conn.live_api_keys?.api_key
          || (conn.is_paper === false && conn.api_key)
        ),
      }));

      setDbConnections(mappedConnections);
      setHasBrokerConnection(mappedConnections.length > 0);
    } catch (err) {
      console.error('[PortfolioPage] Failed to fetch connections:', err);
      setDbConnections([]);
      setHasBrokerConnection(false);
    }
  }, []);

  // Fetch actual broker connections from database on mount
  useEffect(() => {
    checkBrokerConnection();
  }, [checkBrokerConnection]);

  // Keep prop fallback while broker connection check is still loading.
  const connectedBrokers = hasBrokerConnection === null ? _connectedBrokers : dbConnections;
  const account = portfolio?.account || {};
  const rawPositions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const tradeHistory = Array.isArray(portfolio?.tradeHistory) ? portfolio.tradeHistory : [];
  const isBrokerDisconnected = hasBrokerConnection === false;

  const hasLiveAlpacaConnection = connectedBrokers.some((broker) => (
    String(broker.id || '').toLowerCase() === 'alpaca'
      ? Boolean(broker.liveConnected || broker.is_paper === false)
      : true
  ));
  const modeIcon = isLive ? '💰' : '📄';
  const modeLabel = isLive ? 'LIVE' : 'PAPER';
  const modeTitle = isLive ? 'Live Trading' : 'Paper Trading';
  const modeBadgeClasses = isLive
    ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 to-amber-400/20 text-emerald-200'
    : 'border-cyan-400/40 bg-gradient-to-r from-blue-500/20 to-cyan-400/20 text-cyan-200';
  const modeCardClasses = isLive
    ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-amber-400/10'
    : 'border-cyan-500/30 bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-cyan-400/10';

  const equity = toNumber(account.equity ?? account.portfolio_value);
  const cash = toNumber(account.cash);
  const buyingPower = toNumber(account.buying_power);
  const dailyPnL = Number.isFinite(Number(account.daily_pnl))
    ? toNumber(account.daily_pnl)
    : toNumber(account.equity) - toNumber(account.last_equity);
  const dailyPnLPercent = toNumber(account.last_equity) > 0
    ? (dailyPnL / toNumber(account.last_equity)) * 100
    : 0;
  const displayedEquity = isBrokerDisconnected ? 0 : equity;
  const displayedCash = isBrokerDisconnected ? 0 : cash;
  const displayedBuyingPower = isBrokerDisconnected ? 0 : buyingPower;
  const displayedDailyPnL = isBrokerDisconnected ? 0 : dailyPnL;
  const displayedDailyPnLPercent = isBrokerDisconnected ? 0 : dailyPnLPercent;

  const positions = useMemo(() => rawPositions
    .map((pos) => {
      const shares = toNumber(pos.qty ?? pos.shares ?? pos.quantity);
      const avgEntry = toNumber(pos.avg_entry_price ?? pos.avgCost ?? pos.avgEntryPrice);
      const currentPrice = toNumber(pos.current_price ?? pos.currentPrice ?? pos.price);
      const marketValue = toNumber(pos.market_value ?? (shares * currentPrice));
      const unrealizedPL = toNumber(pos.unrealized_pl ?? pos.pnl ?? (marketValue - (shares * avgEntry)));
      const rawPercent = Number(pos.unrealized_plpc ?? pos.pnlPercent);
      const fallbackPercent = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;

      const changeTodayPct = toNumber(pos.change_today ?? pos.changeToday) * 100;
      const prevPrice = changeTodayPct !== 0 ? currentPrice / (1 + toNumber(pos.change_today ?? pos.changeToday)) : currentPrice;
      const dailyChange = (currentPrice - prevPrice) * shares;

      return {
        symbol: String(pos.symbol ?? pos.ticker ?? '').toUpperCase(),
        companyName: getCompanyName(pos),
        shares,
        avgEntry,
        currentPrice,
        marketValue,
        unrealizedPL,
        unrealizedPLPercent: normalizePercent(rawPercent, fallbackPercent),
        dailyChange,
        dailyChangePct: changeTodayPct,
      };
    })
    .filter((pos) => pos.symbol && pos.shares > 0), [rawPositions]);

  const recentTrades = useMemo(() => {
    if (!Array.isArray(tradeHistory)) return [];
    return [...tradeHistory]
      .filter(Boolean)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .slice(0, 12);
  }, [tradeHistory]);

  const handleModeSwitch = async (targetMode) => {
    setModeError('');
    const result = await switchTradingMode(targetMode);
    if (!result?.ok) {
      if (result.reason === 'upgrade_required') {
        setModeError('Live trading is available for Pro users. Upgrade to unlock LIVE mode.');
      } else {
        setModeError('Unable to switch trading mode right now. Please try again.');
      }
      return;
    }
    await portfolio.refresh({ forceFresh: true });
  };

  const handleClearCache = async () => {
    clearAlpacaCache();
    await portfolio.refresh({ forceFresh: true });
    await checkBrokerConnection();
  };

  const requestModeSwitch = async (targetMode) => {
    const normalizedTarget = String(targetMode || '').toLowerCase() === 'live' ? 'live' : 'paper';
    if ((normalizedTarget === 'live' && isLive) || (normalizedTarget === 'paper' && isPaper)) return;

    if (normalizedTarget === 'live') {
      if (!canUseLiveTrading) {
        setModeError('Live trading is available for Pro users. Upgrade to unlock LIVE mode.');
        return;
      }
      setShowLiveConfirmModal(true);
      return;
    }

    await handleModeSwitch('paper');
  };

  const handleBrokerConnect = async (broker) => {
    onBrokerConnect(broker);
    await checkBrokerConnection();
    await portfolio.refresh({ forceFresh: true });
    clearBrokerModalPersistence();
    setShowBrokerModal(false);
  };

  const handleBrokerModalClose = () => {
    clearBrokerModalPersistence();
    setShowBrokerModal(false);
  };

  const handleDisconnectBroker = async (brokerId) => {
    if (!confirm(`Disconnect ${brokerId}? You'll need to reconnect to place trades.`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/broker-disconnect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ broker: brokerId }),
      });

      if (response.ok) {
        onBrokerDisconnect(brokerId);
        await checkBrokerConnection();
        await portfolio.refresh({ forceFresh: true });
        console.log('[PortfolioPage] Broker disconnected:', brokerId);
      } else {
        const error = await response.json();
        console.error('[PortfolioPage] Failed to disconnect:', error);
        alert(`Failed to disconnect: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[PortfolioPage] Disconnect error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const noLiveBrokerConnected = hasBrokerConnection === true && isLive && !hasLiveAlpacaConnection && rawPositions.length === 0 && equity <= 0;

  const totalMarketValue = useMemo(() => positions.reduce((sum, p) => sum + p.marketValue, 0), [positions]);
  const totalUnrealizedPL = useMemo(() => positions.reduce((sum, p) => sum + p.unrealizedPL, 0), [positions]);
  const totalCostBasis = useMemo(() => positions.reduce((sum, p) => sum + (p.avgEntry * p.shares), 0), [positions]);
  const totalUnrealizedPLPercent = totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0;
  const totalDailyChange = useMemo(() => positions.reduce((sum, p) => sum + p.dailyChange, 0), [positions]);
  const totalDailyChangePct = totalMarketValue > 0 ? (totalDailyChange / (totalMarketValue - totalDailyChange)) * 100 : 0;
  const totalPLIsPositive = totalUnrealizedPL >= 0;

  const dailyIsPositive = displayedDailyPnL >= 0;

  return (
    <motion.div {...PAGE_TRANSITION} className="flex-1 flex flex-col h-full bg-transparent text-white overflow-auto">
      <div className="px-6 pt-6 pb-8 space-y-6">
        <motion.div {...sectionMotion(0)} className={`rounded-2xl border shadow-lg shadow-black/30 p-4 ${modeCardClasses}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Trading Mode</div>
              <h2 className="mt-1 text-xl font-semibold">{modeIcon} {modeTitle}</h2>
              <div className="mt-1 text-xs text-white/70">
                Portfolio is showing {modeLabel} account data.
              </div>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.18em] ${modeBadgeClasses}`}>
              <span>{modeIcon}</span>
              <span>{modeLabel}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <motion.button
              onClick={() => requestModeSwitch('paper')}
              disabled={switchingMode || isPaper}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                isPaper
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/15 bg-black/20 text-white/70 hover:border-cyan-400/40 hover:text-cyan-200'
              } disabled:opacity-70`}
            >
              Paper 📄
            </motion.button>
            <motion.button
              onClick={() => requestModeSwitch('live')}
              disabled={switchingMode || isLive}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                isLive
                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/15 bg-black/20 text-white/70 hover:border-emerald-400/40 hover:text-emerald-200'
              } disabled:opacity-70`}
            >
              Live 💰
            </motion.button>
            <motion.button
              onClick={handleClearCache}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
            >
              Clear Cache &amp; Refresh
            </motion.button>
            <div className="text-xs text-white/60">
              {switchingMode ? 'Switching mode and reloading data...' : (portfolio.loading ? 'Loading account...' : 'Mode is synced to Supabase')}
            </div>
          </div>

          {modeError ? (
            <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {modeError}
            </div>
          ) : null}
        </motion.div>

        {isBrokerDisconnected ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" strokeWidth={1.6} />
                <div>
                  <div className="text-sm font-semibold text-amber-100">No broker connected</div>
                  <p className="text-xs text-amber-100/80 mt-1">
                    Connect a broker to view your portfolio and trade
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Net Liquidation</div>
                  <div className="text-2xl font-semibold font-mono">{formatCurrency(displayedEquity)}</div>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Buying Power</div>
                  <div className="text-lg font-semibold font-mono text-white/80">{formatCurrency(displayedBuyingPower)}</div>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Cash</div>
                  <div className="text-lg font-semibold font-mono text-white/80">{formatCurrency(displayedCash)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Daily P&amp;L</div>
                <div className={`text-2xl font-semibold font-mono ${dailyIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatSignedCurrency(displayedDailyPnL)}
                </div>
                <div className={`text-xs font-mono ${dailyIsPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {formatSigned(displayedDailyPnLPercent, '%')}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1f1f1f] bg-[#111111] p-6 text-center">
              <p className="text-sm text-white/60 mb-4">Connect a broker to view your portfolio and trade</p>
              <button
                type="button"
                onClick={() => setShowBrokerModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={1.6} />
                Connect Broker
              </button>
            </div>
          </div>
        ) : noLiveBrokerConnected ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" strokeWidth={1.6} />
                <div>
                  <div className="text-sm font-semibold text-amber-100">Live mode requires live Alpaca keys</div>
                  <p className="text-xs text-amber-100/80 mt-1">
                    Connect your live broker credentials to access real-money positions and order routing.
                  </p>
                </div>
              </div>
            </div>
            <BrokerConnect onConnected={() => window.location.reload()} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              {connectedBrokers.map((broker, index) => {
                const paperConnected = broker.paperConnected ?? (broker.is_paper !== false);
                const liveConnected = broker.liveConnected ?? (broker.is_paper === false);
                const modeStatus = liveConnected && paperConnected
                  ? 'Paper + Live'
                  : liveConnected
                    ? 'Live'
                    : 'Paper';
                const isActiveForCurrentMode = isLive ? liveConnected : paperConnected;
                return (
                  <motion.div key={broker.id} {...listItemMotion(index)} className="flex items-center gap-2 bg-[#111111] border border-white/8 shadow-lg shadow-black/20 rounded-xl px-3 py-1.5 group">
                    <div className="w-5 h-5 rounded flex items-center justify-center overflow-hidden">
                      <BrokerIcon broker={broker.id} className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-white">{broker.name}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActiveForCurrentMode ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    <span className="text-[10px] text-white/50">{modeStatus}</span>
                    <motion.button
                      onClick={() => handleDisconnectBroker(broker.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className="text-white/40 hover:text-red-400 transition-colors ml-1"
                      title="Disconnect broker"
                    >
                      <Unlink className="w-4 h-4" strokeWidth={1.5} />
                    </motion.button>
                  </motion.div>
                );
              })}
              <motion.button
                onClick={() => setShowBrokerModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="flex items-center gap-1.5 border border-dashed border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:border-emerald-500/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                <span className="text-xs text-white/50">Add Broker</span>
              </motion.button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Net Liquidation</div>
                  <div className="text-2xl font-semibold font-mono">{formatCurrency(displayedEquity)}</div>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Buying Power</div>
                  <div className="text-lg font-semibold font-mono text-white/80">{formatCurrency(displayedBuyingPower)}</div>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Cash</div>
                  <div className="text-lg font-semibold font-mono text-white/80">{formatCurrency(displayedCash)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Daily P&L</div>
                <div className={`text-2xl font-semibold font-mono ${dailyIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatSignedCurrency(displayedDailyPnL)}
                </div>
                <div className={`text-xs font-mono ${dailyIsPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {formatSigned(displayedDailyPnLPercent, '%')}
                </div>
              </div>
            </div>

            <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/40">Positions</div>
                  <h3 className="text-lg font-semibold">{modeLabel} Holdings</h3>
                </div>
                <div className="text-xs text-white/40">{positions.length} positions</div>
              </div>

              {positions.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Total Market Value</div>
                    <div className="text-lg font-semibold font-mono text-white">{formatCurrency(totalMarketValue)}</div>
                  </div>
                  <div className="rounded-xl border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Unrealized P&L</div>
                    <div className={`text-lg font-semibold font-mono ${totalPLIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatSignedCurrency(totalUnrealizedPL)}
                    </div>
                    <div className={`text-[10px] font-mono ${totalPLIsPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                      {formatSigned(totalUnrealizedPLPercent, '%')}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Cost Basis</div>
                    <div className="text-lg font-semibold font-mono text-white">{formatCurrency(totalCostBasis)}</div>
                  </div>
                </div>
              )}

              {positions.length === 0 ? (
                <div className="text-sm text-white/50 py-6 text-center">
                  {isPaper ? 'No paper positions yet. Submit a paper trade to get started.' : 'No live positions available yet.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/40">
                        <th className="py-3 pr-4">Ticker</th>
                        <th className="py-3 pr-4">Company</th>
                        <th className="py-3 pr-4">Shares</th>
                        <th className="py-3 pr-4">Avg Entry</th>
                        <th className="py-3 pr-4">Current</th>
                        <th className="py-3 pr-4">Market Value</th>
                        <th className="py-3 pr-4">Daily P&L</th>
                        <th className="py-3 pr-4">Total P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos, index) => {
                        const isPositive = pos.unrealizedPL >= 0;
                        return (
                          <motion.tr key={pos.symbol} {...listItemMotion(index)} className="border-t border-[#1f1f1f]">
                            <td className="py-4 pr-4">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <span className="font-semibold">{pos.symbol}</span>
                              </div>
                            </td>
                            <td className="py-4 pr-4 text-white/70">{pos.companyName}</td>
                            <td className="py-4 pr-4 font-mono">{formatNumber(pos.shares, 2)}</td>
                            <td className="py-4 pr-4 font-mono">{formatCurrency(pos.avgEntry)}</td>
                            <td className="py-4 pr-4 font-mono">{formatCurrency(pos.currentPrice)}</td>
                            <td className="py-4 pr-4 font-mono">{formatCurrency(pos.marketValue)}</td>
                            <td className="py-4 pr-4">
                              <span className={`font-mono ${pos.dailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatSignedCurrency(pos.dailyChange)}
                              </span>
                              <span className={`text-xs font-mono ${pos.dailyChange >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                ({formatSigned(pos.dailyChangePct, '%')})
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatSignedCurrency(pos.unrealizedPL)}
                              </span>
                              <span className={`text-xs font-mono ${isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                ({formatSigned(pos.unrealizedPLPercent, '%')})
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                      <tr className="border-t-2 border-[#2a2a2a] bg-[#0d0d0d]">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${totalPLIsPositive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className="font-semibold text-white/80">TOTAL</span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-white/50 text-xs">{positions.length} positions</td>
                        <td className="py-4 pr-4"></td>
                        <td className="py-4 pr-4"></td>
                        <td className="py-4 pr-4 font-mono text-white/30">—</td>
                        <td className="py-4 pr-4 font-mono font-semibold">{formatCurrency(totalMarketValue)}</td>
                        <td className="py-4 pr-4">
                          <span className={`font-mono font-semibold ${totalDailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatSignedCurrency(totalDailyChange)}
                          </span>
                          <span className={`text-xs font-mono ${totalDailyChange >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                            {' '}({formatSigned(totalDailyChangePct, '%')})
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`font-mono font-semibold ${totalPLIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatSignedCurrency(totalUnrealizedPL)}
                          </span>
                          <span className={`text-xs font-mono ${totalPLIsPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                            {' '}({formatSigned(totalUnrealizedPLPercent, '%')})
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-white/60" strokeWidth={1.5} />
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">Trade History</div>
                    <h3 className="text-lg font-semibold">{modeLabel} Activity</h3>
                  </div>
                </div>
                <div className="text-xs text-white/40">{recentTrades.length} trades</div>
              </div>

              {recentTrades.length === 0 ? (
                <div className="text-sm text-white/50 py-6 text-center">No {isPaper ? 'paper' : 'live'} trades yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/40">
                        <th className="py-3 pr-4">Date</th>
                        <th className="py-3 pr-4">Ticker</th>
                        <th className="py-3 pr-4">Side</th>
                        <th className="py-3 pr-4">Shares</th>
                        <th className="py-3 pr-4">Price</th>
                        <th className="py-3 pr-4">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.map((trade, index) => {
                        const side = String(trade.side || '').toLowerCase();
                        const isBuy = side === 'buy';
                        const total = toNumber(trade.total ?? (trade.shares * trade.price));
                        return (
                          <motion.tr key={trade.id || `${trade.symbol}-${trade.timestamp}`} {...listItemMotion(index)} className="border-t border-[#1f1f1f]">
                            <td className="py-4 pr-4 text-white/70">{formatTimestamp(trade.timestamp)}</td>
                            <td className="py-4 pr-4 font-semibold">{trade.symbol}</td>
                            <td className="py-4 pr-4">
                              <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                                isBuy ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {isBuy ? 'Buy' : 'Sell'}
                              </span>
                            </td>
                            <td className="py-4 pr-4 font-mono">{formatNumber(trade.shares, 2)}</td>
                            <td className="py-4 pr-4 font-mono">{formatCurrency(trade.price)}</td>
                            <td className="py-4 pr-4 font-mono">{formatCurrency(total)}</td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showLiveConfirmModal && (
          <motion.div
            {...modalBackdropMotion}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              {...modalPanelMotion}
              className="w-full max-w-md rounded-2xl border border-white/8 shadow-2xl shadow-black/30 bg-[#101216] p-5 space-y-4"
            >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" strokeWidth={1.7} />
              <div>
                <div className="text-sm font-semibold text-amber-100">Confirm Live Mode</div>
                <p className="text-xs text-white/75 mt-1">
                  ⚠️ You&apos;re about to switch to LIVE trading with real money. Are you sure?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <motion.button
                type="button"
                onClick={() => setShowLiveConfirmModal(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:bg-white/5 transition"
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                onClick={async () => {
                  setShowLiveConfirmModal(false);
                  await handleModeSwitch('live');
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="rounded-lg border border-emerald-400/35 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 transition"
              >
                Switch to Live
              </motion.button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BrokerConnectModal
        isOpen={showBrokerModal}
        onClose={handleBrokerModalClose}
        onConnect={handleBrokerConnect}
        connectedBrokers={connectedBrokers}
      />
    </motion.div>
  );
};

export default PortfolioPage;
