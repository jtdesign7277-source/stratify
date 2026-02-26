import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Unlink,
  Wallet,
} from 'lucide-react';
import * as Grid from '@highcharts/grid-lite';
import '@highcharts/grid-lite/css/grid-lite.css';
import BrokerConnectModal, { BrokerIcon } from './BrokerConnectModal';
import { supabase } from '../../lib/supabaseClient';
import useTradingMode from '../../hooks/useTradingMode';
import usePortfolio from '../../hooks/usePortfolio';
import { clearAlpacaCache } from '../../services/alpacaService';
import './PortfolioHighchartsGrid.css';

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

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(toNumber(value, 0));

const formatSignedCurrency = (value) => {
  const amount = toNumber(value, 0);
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatCurrency(Math.abs(amount))}`;
};

const formatSignedPercent = (value) => {
  const amount = toNumber(value, 0);
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toFixed(2)}%`;
};

const formatPercent = (value) => `${toNumber(value, 0).toFixed(2)}%`;

const formatQuantity = (value) => {
  const amount = toNumber(value, 0);
  return amount.toLocaleString('en-US', { maximumFractionDigits: 4 });
};

const toTimestamp = (value) => {
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value) => {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return '—';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (value) => {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return '—';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatLabelCase = (value, fallback = '—') => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
};

const formatTif = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  return raw || '—';
};

const normalizePercent = (value, fallback = 0) => {
  if (!Number.isFinite(Number(value))) return fallback;
  const parsed = Number(value);
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
};

const normalizePosition = (row) => {
  if (!row || typeof row !== 'object') return null;
  const symbol = String(row.symbol || row.ticker || '').trim().toUpperCase();
  if (!symbol) return null;

  const qty = toNumber(row.qty ?? row.shares ?? row.quantity, 0);
  if (qty <= 0) return null;

  const avgEntry = toNumber(row.avg_entry_price ?? row.avgEntryPrice ?? row.avgCost, 0);
  const current = toNumber(row.current_price ?? row.currentPrice ?? row.price, avgEntry);
  const marketValue = toNumber(row.market_value ?? row.marketValue, qty * current);
  const costBasis = toNumber(row.cost_basis ?? row.costBasis, qty * avgEntry);
  const pnl = toNumber(row.unrealized_pl ?? row.pnl, marketValue - costBasis);
  const pnlPercent = normalizePercent(
    row.unrealized_plpc ?? row.pnlPercent,
    costBasis > 0 ? (pnl / costBasis) * 100 : 0,
  );
  const dayPercent = normalizePercent(row.change_today ?? row.changeToday, 0);
  const dayPnl = toNumber(
    row.unrealized_intraday_pl ?? row.dayPnl ?? row.daily_pnl,
    marketValue * (dayPercent / 100),
  );

  return {
    symbol,
    name: String(row.name || row.companyName || row.company || row.asset_name || symbol),
    qty,
    avgEntry,
    current,
    marketValue,
    dayPnl,
    dayPercent,
    pnl,
    pnlPercent,
  };
};

const normalizeActivityTrade = (trade) => {
  if (!trade || typeof trade !== 'object') return null;
  const symbol = String(trade.symbol || trade.ticker || '').trim().toUpperCase();
  if (!symbol) return null;

  const rawSide = String(
    trade.side
    || trade.action
    || trade.order_side
    || trade.orderSide
    || '',
  ).toLowerCase();
  const fallbackSide = String(trade.type || '').toLowerCase().includes('sell') ? 'sell' : 'buy';
  const side = rawSide.includes('sell') || rawSide.includes('short')
    ? 'sell'
    : rawSide.includes('buy') || rawSide.includes('long')
      ? 'buy'
      : fallbackSide;

  const rawOrderType = String(
    trade.order_type
    || trade.orderType
    || trade.type
    || '',
  ).toLowerCase();
  const orderType = ['buy', 'sell', 'long', 'short'].includes(rawOrderType) ? 'market' : rawOrderType || 'market';

  const qty = toNumber(trade.shares ?? trade.qty ?? trade.quantity ?? trade.filled_qty, 0);
  const price = toNumber(trade.price ?? trade.filled_avg_price ?? trade.avg_price ?? trade.avgPrice, 0);
  if (qty <= 0 || price <= 0) return null;

  const timestamp = trade.timestamp ?? trade.filled_at ?? trade.submitted_at ?? trade.created_at ?? Date.now();
  const strategyName = String(
    trade.strategyName
    || trade.strategy_name
    || trade.strategy
    || trade.strategyId
    || trade.strategy_id
    || '',
  ).trim();

  return {
    id: String(trade.id || `${symbol}-${side}-${timestamp}`),
    symbol,
    side,
    qty,
    price,
    total: toNumber(trade.total ?? trade.notional, qty * price),
    fees: Math.abs(toNumber(
      trade.fees
      ?? trade.fee
      ?? trade.commission
      ?? trade.commissions
      ?? trade.filled_fees,
      0,
    )),
    timestamp,
    orderType,
    timeInForce: String(trade.time_in_force || trade.timeInForce || '').trim().toUpperCase(),
    strategyName,
    strategyId: String(trade.strategyId || trade.strategy_id || '').trim(),
    clientOrderId: String(trade.client_order_id || trade.clientOrderId || '').trim(),
  };
};

const normalizeStrategySymbol = (strategy) => {
  const candidate = String(
    strategy?.ticker
    || strategy?.symbol
    || strategy?.asset
    || strategy?.instrument
    || '',
  )
    .trim()
    .toUpperCase()
    .replace(/^\$/, '');

  if (!candidate) return '';
  const firstToken = candidate.split(/[,\s]/)[0];
  return firstToken.replace(/[^A-Z0-9./-]/g, '');
};

const normalizeDbConnection = (row) => {
  const brokerId = String(row?.broker || '').trim().toLowerCase();
  if (!brokerId) return null;
  return {
    id: brokerId,
    name: brokerId.charAt(0).toUpperCase() + brokerId.slice(1),
    paperConnected: Boolean(
      row.paper_api_key
      || row.paper_api_keys?.api_key
      || (row.is_paper !== false && row.api_key),
    ),
    liveConnected: Boolean(
      row.live_api_key
      || row.live_api_keys?.api_key
      || (row.is_paper === false && row.api_key),
    ),
  };
};

const PortfolioPageRebuilt = ({
  themeClasses: _themeClasses,
  alpacaData = {},
  connectedBrokers: propConnectedBrokers = [],
  onBrokerConnect = () => {},
  onBrokerDisconnect = () => {},
  tradeHistory: propTradeHistory = [],
  savedStrategies = [],
  deployedStrategies = [],
}) => {
  const {
    tradingMode,
    isPaper,
    isLive,
    canUseLiveTrading,
    switchTradingMode,
    switching,
  } = useTradingMode();
  const portfolio = usePortfolio({ tradingMode });

  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [modeError, setModeError] = useState('');
  const [dbConnections, setDbConnections] = useState([]);
  const [dbConnectionsLoaded, setDbConnectionsLoaded] = useState(false);
  const [expandedSymbol, setExpandedSymbol] = useState('');
  const holdingsGridContainerRef = useRef(null);
  const holdingsGridRef = useRef(null);

  const loadConnections = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setDbConnections([]);
        setDbConnectionsLoaded(true);
        return;
      }

      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) {
        console.error('[PortfolioPageRebuilt] Failed to fetch broker connections:', error);
        setDbConnections([]);
        setDbConnectionsLoaded(true);
        return;
      }

      const normalized = (Array.isArray(data) ? data : [])
        .map(normalizeDbConnection)
        .filter(Boolean);
      setDbConnections(normalized);
      setDbConnectionsLoaded(true);
    } catch (error) {
      console.error('[PortfolioPageRebuilt] Failed to load broker connections:', error);
      setDbConnections([]);
      setDbConnectionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const brokers = dbConnectionsLoaded ? dbConnections : propConnectedBrokers;

  const refreshAll = useCallback(async ({ forceFresh = true } = {}) => {
    if (forceFresh) {
      clearAlpacaCache();
    }
    await Promise.all([
      portfolio.refresh({ forceFresh }),
      loadConnections(),
    ]);
  }, [portfolio, loadConnections]);

  const account = portfolio.account || {};
  const equity = toNumber(account.equity ?? account.portfolio_value, 0);
  const cash = toNumber(account.cash, 0);
  const buyingPower = toNumber(account.buying_power ?? account.buyingPower, 0);
  const lastEquity = toNumber(account.last_equity, 0);
  const dailyPnl = Number.isFinite(Number(account.daily_pnl))
    ? toNumber(account.daily_pnl, 0)
    : (equity - lastEquity);
  const dailyPnlPct = lastEquity > 0 ? (dailyPnl / lastEquity) * 100 : 0;

  const fallbackAlpacaPositions = Array.isArray(alpacaData?.positions) ? alpacaData.positions : [];
  const sourcePositions = Array.isArray(portfolio.positions) && portfolio.positions.length > 0
    ? portfolio.positions
    : fallbackAlpacaPositions;

  const positions = useMemo(
    () => sourcePositions.map(normalizePosition).filter(Boolean),
    [sourcePositions],
  );

  const portfolioTrades = Array.isArray(portfolio.tradeHistory) ? portfolio.tradeHistory : [];
  const alpacaTrades = Array.isArray(alpacaData?.trades) ? alpacaData.trades : [];
  const externalTrades = Array.isArray(propTradeHistory) ? propTradeHistory : [];

  const strategyNameBySymbol = useMemo(() => {
    const map = {};
    [...savedStrategies, ...deployedStrategies].forEach((strategy) => {
      if (!strategy || typeof strategy !== 'object') return;
      const symbol = normalizeStrategySymbol(strategy);
      const name = String(strategy.name || '').trim();
      if (!symbol || !name) return;
      if (!map[symbol]) map[symbol] = name;
    });
    return map;
  }, [savedStrategies, deployedStrategies]);

  const allTrades = useMemo(() => {
    const byKey = new Map();
    [...portfolioTrades, ...alpacaTrades, ...externalTrades]
      .map(normalizeActivityTrade)
      .filter(Boolean)
      .forEach((trade) => {
        const key = `${trade.id}-${trade.symbol}-${trade.side}-${trade.qty}-${trade.price}-${trade.timestamp}`;
        if (!byKey.has(key)) byKey.set(key, trade);
      });

    return [...byKey.values()]
      .sort((a, b) => {
        const aTs = toTimestamp(a.timestamp);
        const bTs = toTimestamp(b.timestamp);
        return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
      })
      .map((trade) => ({
        ...trade,
        strategyName: trade.strategyName || strategyNameBySymbol[trade.symbol] || 'Manual',
      }));
  }, [portfolioTrades, alpacaTrades, externalTrades, strategyNameBySymbol]);

  const hasLiveConnection = brokers.some((broker) => Boolean(broker.liveConnected || broker.is_paper === false));
  const hasAnyConnection = brokers.length > 0;
  const accountEquity = hasAnyConnection ? equity : 0;
  const accountCash = hasAnyConnection ? cash : 0;
  const accountBuyingPower = hasAnyConnection ? buyingPower : 0;
  const accountDailyPnl = hasAnyConnection ? dailyPnl : 0;
  const accountDailyPnlPct = hasAnyConnection ? dailyPnlPct : 0;
  const displayedPositions = hasAnyConnection ? positions : [];
  const displayedTrades = hasAnyConnection ? allTrades : [];

  const totals = useMemo(() => {
    const marketValue = displayedPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
    const dayPnlTotal = displayedPositions.reduce((sum, pos) => sum + pos.dayPnl, 0);
    const pnlTotal = displayedPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    const costBasis = displayedPositions.reduce((sum, pos) => sum + (pos.avgEntry * pos.qty), 0);
    return {
      marketValue,
      dayPnl: dayPnlTotal,
      pnl: pnlTotal,
      pnlPercent: costBasis > 0 ? (pnlTotal / costBasis) * 100 : 0,
    };
  }, [displayedPositions]);
  const totalPortfolioValue = hasAnyConnection
    ? (totals.marketValue + accountCash)
    : accountEquity;

  const tradesBySymbol = useMemo(() => {
    const map = new Map();
    displayedTrades.forEach((trade) => {
      if (!map.has(trade.symbol)) map.set(trade.symbol, []);
      map.get(trade.symbol).push(trade);
    });
    return map;
  }, [displayedTrades]);

  const holdingsGridColumns = useMemo(() => ([
    { id: 'symbol', width: '6%', header: { format: 'Symbol' }, cells: { className: 'portfolio-col-symbol' } },
    { id: 'companyName', width: '14%', header: { format: 'Company' }, cells: { className: 'portfolio-col-company' } },
    { id: 'shares', width: '6%', header: { format: 'Shares' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'avgCostBasis', width: '8%', header: { format: 'Avg Cost' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'currentPrice', width: '8%', header: { format: 'Current' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'marketValue', width: '9%', header: { format: 'Market Value' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'totalCost', width: '9%', header: { format: 'Total Cost' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'unrealizedPnlDollars', width: '10%', header: { format: 'Unrealized $' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'unrealizedPnlPercent', width: '8%', header: { format: 'Unrealized %' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'dayChangeDollars', width: '8%', header: { format: 'Day $' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'dayChangePercent', width: '8%', header: { format: 'Day %' }, cells: { className: 'portfolio-col-numeric' } },
    { id: 'weight', width: '6%', header: { format: 'Weight' }, cells: { className: 'portfolio-col-numeric' } },
  ]), []);

  const holdingsGridDataTable = useMemo(() => {
    const columns = {
      symbol: [],
      companyName: [],
      shares: [],
      avgCostBasis: [],
      currentPrice: [],
      marketValue: [],
      totalCost: [],
      unrealizedPnlDollars: [],
      unrealizedPnlPercent: [],
      dayChangeDollars: [],
      dayChangePercent: [],
      weight: [],
    };

    displayedPositions.forEach((position) => {
      const totalCost = position.avgEntry * position.qty;
      const weightPct = totals.marketValue > 0 ? (position.marketValue / totals.marketValue) * 100 : 0;

      columns.symbol.push(position.symbol);
      columns.companyName.push(position.name || position.symbol);
      columns.shares.push(formatQuantity(position.qty));
      columns.avgCostBasis.push(formatCurrency(position.avgEntry));
      columns.currentPrice.push(formatCurrency(position.current));
      columns.marketValue.push(formatCurrency(position.marketValue));
      columns.totalCost.push(formatCurrency(totalCost));
      columns.unrealizedPnlDollars.push(formatSignedCurrency(position.pnl));
      columns.unrealizedPnlPercent.push(formatSignedPercent(position.pnlPercent));
      columns.dayChangeDollars.push(formatSignedCurrency(position.dayPnl));
      columns.dayChangePercent.push(formatSignedPercent(position.dayPercent));
      columns.weight.push(formatPercent(weightPct));
    });

    return { columns };
  }, [displayedPositions, totals.marketValue]);

  useEffect(() => {
    const container = holdingsGridContainerRef.current;
    if (!container) return undefined;

    if (holdingsGridRef.current) {
      holdingsGridRef.current.destroy();
      holdingsGridRef.current = null;
    }

    const grid = Grid.grid(container, {
      dataTable: holdingsGridDataTable,
      columns: holdingsGridColumns,
      rendering: {
        rows: {
          strictHeights: false,
        },
      },
    });

    holdingsGridRef.current = grid;

    const handleGridRowClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const row = target.closest('tr[data-row-index]');
      if (!row) return;

      const rowIndex = Number.parseInt(row.getAttribute('data-row-index') || '', 10);
      if (!Number.isFinite(rowIndex)) return;

      const symbol = String(grid.presentationTable?.getCell('symbol', rowIndex) || '')
        .trim()
        .toUpperCase();
      if (!symbol) return;

      setExpandedSymbol((previous) => (previous === symbol ? '' : symbol));
    };

    container.addEventListener('click', handleGridRowClick);

    return () => {
      container.removeEventListener('click', handleGridRowClick);
      if (holdingsGridRef.current) {
        holdingsGridRef.current.destroy();
        holdingsGridRef.current = null;
      }
    };
  }, [holdingsGridColumns, holdingsGridDataTable]);

  useEffect(() => {
    if (!expandedSymbol) return;
    const exists = displayedPositions.some((position) => position.symbol === expandedSymbol);
    if (!exists) {
      setExpandedSymbol('');
    }
  }, [displayedPositions, expandedSymbol]);

  const expandedSymbolTrades = expandedSymbol ? (tradesBySymbol.get(expandedSymbol) || []) : [];

  const requestModeSwitch = async (targetMode) => {
    const mode = String(targetMode || '').toLowerCase() === 'live' ? 'live' : 'paper';
    if ((mode === 'live' && isLive) || (mode === 'paper' && isPaper)) return;
    setModeError('');

    if (mode === 'live') {
      if (!canUseLiveTrading) {
        setModeError('Live mode is available for Pro users only.');
        return;
      }
      setShowLiveConfirm(true);
      return;
    }

    const result = await switchTradingMode('paper');
    if (!result?.ok) {
      setModeError('Unable to switch to paper mode right now.');
      return;
    }
    await refreshAll({ forceFresh: true });
  };

  const confirmLiveModeSwitch = async () => {
    setShowLiveConfirm(false);
    const result = await switchTradingMode('live');
    if (!result?.ok) {
      setModeError(result?.reason === 'upgrade_required'
        ? 'Live mode is available for Pro users only.'
        : 'Unable to switch to live mode right now.');
      return;
    }
    await refreshAll({ forceFresh: true });
  };

  const handleConnect = async (broker) => {
    onBrokerConnect(broker);
    setShowBrokerModal(false);
    await refreshAll({ forceFresh: true });
  };

  const handleDisconnect = async (brokerId) => {
    const normalizedBroker = String(brokerId || '').trim();
    if (!normalizedBroker) return;
    const approved = window.confirm(`Disconnect ${normalizedBroker}?`);
    if (!approved) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch('/api/broker-disconnect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ broker: normalizedBroker }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `Failed to disconnect ${normalizedBroker}`);
      }

      onBrokerDisconnect(normalizedBroker);
      await refreshAll({ forceFresh: true });
    } catch (error) {
      console.error('[PortfolioPageRebuilt] Disconnect failed:', error);
      alert(error?.message || 'Failed to disconnect broker.');
    }
  };

  const modeTagClasses = isLive
    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
    : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200';

  const renderMetricCard = (label, value, subValue = null, positive = null) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={interactiveTransition}
      className="rounded-2xl border border-white/8 shadow-lg shadow-black/30 bg-[#0c111a] px-4 py-3"
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="mt-1 text-xl font-semibold font-mono text-white">{value}</div>
      {subValue !== null && (
        <div className={`text-xs font-mono mt-1 ${
          positive === null ? 'text-white/55' : positive ? 'text-emerald-300/80' : 'text-red-300/80'
        }`}>
          {subValue}
        </div>
      )}
    </motion.div>
  );

  return (
    <motion.div {...PAGE_TRANSITION} className="flex-1 h-full overflow-auto bg-transparent text-white">
      <div className="px-6 pt-5 pb-8 space-y-5">
        <motion.section {...sectionMotion(0)} className="rounded-2xl border border-white/8 shadow-lg shadow-black/30 bg-[#0e141f] p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Portfolio Control</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Portfolio</h1>
              <p className="mt-1 text-xs text-white/60">
                Layered portfolio view with summary, holdings, and per-symbol transaction drilldown.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${modeTagClasses}`}>
                <Wallet className="w-3.5 h-3.5" strokeWidth={1.8} />
                {isLive ? 'LIVE MODE' : 'PAPER MODE'}
              </span>
              <motion.button
                type="button"
                onClick={() => refreshAll({ forceFresh: true })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white/80 hover:border-cyan-400/40 hover:text-cyan-200 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${portfolio.loading || switching ? 'animate-spin' : ''}`} strokeWidth={1.6} />
                Refresh
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setShowBrokerModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
                Connect Broker
              </motion.button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <motion.button
              type="button"
              onClick={() => requestModeSwitch('paper')}
              disabled={switching || isPaper}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                isPaper
                  ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/15 bg-black/20 text-white/70 hover:border-cyan-400/40 hover:text-cyan-200'
              } disabled:opacity-70`}
            >
              Paper
            </motion.button>
            <motion.button
              type="button"
              onClick={() => requestModeSwitch('live')}
              disabled={switching || isLive}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                isLive
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/15 bg-black/20 text-white/70 hover:border-emerald-400/40 hover:text-emerald-200'
              } disabled:opacity-70`}
            >
              Live
            </motion.button>
            <div className="text-xs text-white/50">
              {switching ? 'Switching trading mode...' : portfolio.loading ? 'Loading account...' : 'Ready'}
            </div>
          </div>

          {modeError && (
            <div className="mt-3 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {modeError}
            </div>
          )}
        </motion.section>

        {brokers.length > 0 ? (
          <motion.section {...sectionMotion(1)} className="rounded-2xl border border-white/8 shadow-lg shadow-black/30 bg-[#0e141f] p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 mb-3">Connected Brokers</div>
            <div className="flex flex-wrap gap-2">
              {brokers.map((broker, index) => {
                const paperConnected = broker.paperConnected ?? (broker.is_paper !== false);
                const liveConnected = broker.liveConnected ?? (broker.is_paper === false);
                const stateText = liveConnected && paperConnected ? 'Paper + Live' : liveConnected ? 'Live' : 'Paper';
                const activeForMode = isLive ? liveConnected : paperConnected;
                return (
                  <motion.div key={broker.id} {...listItemMotion(index)} className="inline-flex items-center gap-2 rounded-xl border border-white/8 shadow-lg shadow-black/20 bg-[#0b1018] px-3 py-2">
                    <div className="w-5 h-5 overflow-hidden rounded">
                      <BrokerIcon broker={broker.id} className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-white">{broker.name || broker.id}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${activeForMode ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-[10px] text-white/50">{stateText}</span>
                    <motion.button
                      type="button"
                      onClick={() => handleDisconnect(broker.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className="ml-1 text-white/35 hover:text-red-300 transition-colors"
                      title="Disconnect broker"
                    >
                      <Unlink className="w-3.5 h-3.5" strokeWidth={1.6} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        ) : (
          <motion.section {...sectionMotion(1)} className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" strokeWidth={1.6} />
              <div>
                <div className="text-sm font-semibold text-amber-100">No broker connected</div>
                <p className="text-xs text-amber-100/80 mt-1">
                  Connect at least one broker to view positions and account activity.
                </p>
              </div>
            </div>
          </motion.section>
        )}

        {isLive && hasAnyConnection && !hasLiveConnection && (
          <motion.section {...sectionMotion(2)} className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" strokeWidth={1.6} />
              <div>
                <div className="text-sm font-semibold text-amber-100">Live mode selected, but no live keys connected</div>
                <p className="text-xs text-amber-100/80 mt-1">
                  Add live credentials for a supported broker to load real-money data.
                </p>
              </div>
            </div>
          </motion.section>
        )}

        <motion.section {...sectionMotion(3)} className="rounded-2xl border border-white/8 shadow-lg shadow-black/30 bg-[#0e141f] p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 mb-3">Layer 1 · Portfolio Summary</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            {renderMetricCard('Total Portfolio Value', formatCurrency(totalPortfolioValue))}
            {renderMetricCard('Cash Available', formatCurrency(accountCash))}
            {renderMetricCard(
              'Total P&L ($)',
              formatSignedCurrency(totals.pnl),
              null,
              totals.pnl >= 0,
            )}
            {renderMetricCard('Total P&L (%)', formatSignedPercent(totals.pnlPercent))}
            {renderMetricCard(
              "Today's P&L",
              formatSignedCurrency(accountDailyPnl),
              formatSignedPercent(accountDailyPnlPct),
              accountDailyPnl >= 0,
            )}
            {renderMetricCard('Buying Power', formatCurrency(accountBuyingPower))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion(4)} className="rounded-2xl border border-white/8 shadow-lg shadow-black/30 bg-[#0e141f] p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Layer 2 · Holdings</div>
              <h2 className="text-lg font-semibold text-white">Positions</h2>
            </div>
            <div className="text-xs text-white/50">{displayedPositions.length} symbols</div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#243247] bg-[#0b111b] p-2">
              <div ref={holdingsGridContainerRef} className="portfolio-highcharts-grid" />
            </div>

            {displayedPositions.length === 0 ? (
              <div className="rounded-lg border border-[#1f2632] bg-[#0c111a] px-4 py-3 text-sm text-white/55">
                No open positions in this account mode yet.
              </div>
            ) : (
              <div className="text-xs text-white/55">
                Click a symbol row to view Layer 3 transaction drilldown.
              </div>
            )}

            {expandedSymbol && (
              <div className="rounded-xl border border-[#253244] bg-[#0a1019] p-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                      Layer 3 · Transactions for {expandedSymbol}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      Every buy/sell tied to order details and strategy attribution.
                    </div>
                  </div>
                  <div className="text-xs text-white/55">{expandedSymbolTrades.length} rows</div>
                </div>

                {expandedSymbolTrades.length === 0 ? (
                  <div className="rounded-lg border border-[#1f2632] bg-[#0c111a] px-3 py-5 text-center text-xs text-white/55">
                    No transactions found yet for {expandedSymbol}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-white/45 border-b border-[#1f2632]">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Time</th>
                          <th className="py-2 pr-3">Buy/Sell</th>
                          <th className="py-2 pr-3 text-right">Quantity</th>
                          <th className="py-2 pr-3 text-right">Price at Execution</th>
                          <th className="py-2 pr-3 text-right">Value</th>
                          <th className="py-2 pr-3 text-right">Fees/Commission</th>
                          <th className="py-2 pr-3">Order Type</th>
                          <th className="py-2 pr-3">TIF</th>
                          <th className="py-2 pr-0">Strategy Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedSymbolTrades.map((trade, index) => {
                          const isBuy = trade.side === 'buy';
                          return (
                            <motion.tr key={`${trade.id}-${trade.timestamp}`} {...listItemMotion(index)} className="border-b border-[#1a2230]/70">
                              <td className="py-2 pr-3 text-white/70">{formatDate(trade.timestamp)}</td>
                              <td className="py-2 pr-3 text-white/60">{formatTime(trade.timestamp)}</td>
                              <td className="py-2 pr-3">
                                <span className={`font-semibold uppercase tracking-[0.14em] ${isBuy ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {isBuy ? 'Buy' : 'Sell'}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">{formatQuantity(trade.qty)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatCurrency(trade.price)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatCurrency(trade.total)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatCurrency(trade.fees)}</td>
                              <td className="py-2 pr-3 text-white/70">{formatLabelCase(trade.orderType, 'Market')}</td>
                              <td className="py-2 pr-3 text-white/70">{formatTif(trade.timeInForce)}</td>
                              <td className="py-2 pr-0 text-white">{trade.strategyName || 'Manual'}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {showLiveConfirm && (
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
                  You are switching to live trading with real-money data.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <motion.button
                type="button"
                onClick={() => setShowLiveConfirm(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:bg-white/5 transition"
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                onClick={confirmLiveModeSwitch}
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
        onClose={() => setShowBrokerModal(false)}
        onConnect={handleConnect}
        connectedBrokers={brokers}
      />
    </motion.div>
  );
};

export default PortfolioPageRebuilt;
