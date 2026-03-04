import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';
import usePaperTrading from '../../hooks/usePaperTrading';
import { useTradeHistory as useTradeHistoryStore } from '../../store/StratifyProvider';
import { subscribeTwelveDataQuotes } from '../../services/twelveDataWebSocket';
import { getMarketStatus } from '../../lib/marketHours';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const STARTING_BALANCE = 100000;
const GOAL_TARGET = 150000;
const PORTFOLIO_SPLIT_VIEW_STORAGE_KEY = 'stratify-portfolio-split-view';
const PORTFOLIO_SCENARIOS_STORAGE_KEY = 'stratify-portfolio-scenarios-v1';
const PORTFOLIO_SCENARIOS_TABLE = 'portfolio_radar_watchlists';
const SCENARIO_SYNC_DEBOUNCE_MS = 900;
const AI_IDEA_FALLBACK_SYMBOLS = ['SPY', 'QQQ', 'SMH', 'XLF', 'XLE', 'IWM', 'TLT', 'GLD', 'COIN', 'MSTR', 'AMD', 'AVGO'];
const WHAT_IF_TIMEFRAME_OPTIONS = [3, 6, 9, 12];
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CANDLE_OUTPUT_SIZE = 5000;

const CRYPTO_BASE_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'ADA', 'AVAX', 'DOT']);

const normalizeSymbol = (value = '') => String(value || '').trim().toUpperCase().replace(/^\$/, '');
const toSymbolKey = (value = '') => normalizeSymbol(value).replace(/[^A-Z0-9]/g, '');
const isUuid = (value = '') => UUID_V4_PATTERN.test(String(value || '').trim());

const makeUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  let seed = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    seed = (seed + Math.random() * 16) % 16 | 0;
    const value = char === 'x' ? seed : (seed & 0x3) | 0x8;
    return value.toString(16);
  });
};

const normalizeScenarioRecord = (scenario) => {
  const name = String(scenario?.name || '').trim().slice(0, 40);
  const symbols = Array.isArray(scenario?.symbols)
    ? scenario.symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean).slice(0, 12)
    : [];
  if (!name || symbols.length === 0) return null;

  const createdAtRaw = String(scenario?.createdAt || '').trim();
  const createdAtTimestamp = Date.parse(createdAtRaw);
  const createdAt = Number.isFinite(createdAtTimestamp)
    ? new Date(createdAtTimestamp).toISOString()
    : new Date().toISOString();

  const capitalRaw = Number(scenario?.capital);
  const capital = Number.isFinite(capitalRaw) && capitalRaw > 0 ? capitalRaw : STARTING_BALANCE;

  return {
    id: isUuid(scenario?.id) ? String(scenario.id).trim().toLowerCase() : makeUuid(),
    name,
    symbols,
    createdAt,
    capital,
  };
};

const buildScenarioSignature = (rows = []) => JSON.stringify(
  (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row?.id || ''),
    name: String(row?.name || ''),
    capital: Number(row?.capital || 0),
    symbols: Array.isArray(row?.symbols) ? row.symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean) : [],
    createdAt: String(row?.createdAt || ''),
  }))
);

const toSupabaseScenarioPayload = (userId, scenario) => ({
  id: scenario.id,
  user_id: userId,
  name: scenario.name,
  capital: Number(scenario.capital),
  symbols: scenario.symbols,
  created_at: scenario.createdAt || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const loadInitialSplitViewPreference = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PORTFOLIO_SPLIT_VIEW_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const loadInitialPortfolioScenarios = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PORTFOLIO_SCENARIOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((scenario) => normalizeScenarioRecord(scenario))
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
};

const toLocalIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const subtractMonthsToTradingDay = (monthsBack) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() - Number(monthsBack || 0);
  const day = today.getDate();
  const monthStart = new Date(year, month, 1);
  const lastDayInTargetMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const anchor = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(day, lastDayInTargetMonth));
  anchor.setHours(0, 0, 0, 0);
  const weekday = anchor.getDay();
  if (weekday === 6) anchor.setDate(anchor.getDate() - 1);
  if (weekday === 0) anchor.setDate(anchor.getDate() - 2);
  return anchor;
};

const parseCandleDateToEpoch = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const timestamp = Date.parse(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const findEntryCloseOnOrBefore = (candles = [], targetDate) => {
  const targetEpoch = targetDate instanceof Date ? targetDate.getTime() : Number.NaN;
  if (!Number.isFinite(targetEpoch) || !Array.isArray(candles) || candles.length === 0) return null;
  let candidate = null;
  for (const row of candles) {
    const epoch = parseCandleDateToEpoch(row?.datetime);
    const close = Number(row?.close);
    if (!Number.isFinite(epoch) || !Number.isFinite(close)) continue;
    if (epoch <= targetEpoch) {
      candidate = {
        datetime: String(row.datetime),
        close,
      };
    } else {
      break;
    }
  }
  return candidate;
};

const parseApiCandles = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  const values = Array.isArray(payload?.values)
    ? payload.values
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  return values
    .map((row) => ({
      datetime: String(row?.datetime || ''),
      close: Number(row?.close),
    }))
    .filter((row) => row.datetime && Number.isFinite(row.close))
    .sort((a, b) => parseCandleDateToEpoch(a.datetime) - parseCandleDateToEpoch(b.datetime));
};

const parseMarketDataRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const parseCapitalInput = (value, fallback = STARTING_BALANCE) => {
  const normalized = String(value ?? '')
    .replace(/[^0-9.]/g, '')
    .trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const buildAiIdeaQuery = (heldSymbols = [], strategySymbols = []) => {
  const held = Array.isArray(heldSymbols) ? heldSymbols.filter(Boolean).slice(0, 8) : [];
  const strategy = Array.isArray(strategySymbols) ? strategySymbols.filter(Boolean).slice(0, 6) : [];

  if (held.length === 0 && strategy.length === 0) {
    return 'Suggest 8 liquid US stocks or ETFs to watch today using momentum, relative strength, and fresh financial headlines.';
  }

  const lines = [];
  if (held.length > 0) lines.push(`Current holdings: ${held.map((symbol) => `$${symbol}`).join(', ')}`);
  if (strategy.length > 0) lines.push(`AI strategy exposure: ${strategy.map((symbol) => `$${symbol}`).join(', ')}`);

  return `${lines.join('. ')}. Suggest 8 additional stocks or ETFs to watch now, prioritize liquid names not already held, and include concise rationale tied to current momentum and headlines.`;
};

const buildFallbackIdeas = (heldSymbols = []) => {
  const heldSet = new Set((Array.isArray(heldSymbols) ? heldSymbols : []).map((symbol) => normalizeSymbol(symbol)).filter(Boolean));
  const hasCryptoExposure = [...heldSet].some((symbol) => isCryptoSymbol(symbol));
  const hasMegaCapTechExposure = [...heldSet].some((symbol) => ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'TSLA', 'QQQ'].includes(symbol));

  const candidatePool = hasCryptoExposure
    ? ['COIN', 'MSTR', 'IBIT', 'HOOD', 'SMH', 'QQQ', 'SPY', 'AMD']
    : hasMegaCapTechExposure
      ? ['SMH', 'SOXX', 'AVGO', 'AMD', 'QQQ', 'IWM', 'XLF', 'SPY']
      : AI_IDEA_FALLBACK_SYMBOLS;

  const rationalePool = [
    'High-liquidity name with active momentum and options flow.',
    'Useful diversification candidate relative to current concentration.',
    'Sector leadership signal with strong volume participation.',
    'Macro-sensitive exposure to balance portfolio beta.',
    'Potential continuation setup if risk-on sentiment holds.',
  ];

  return candidatePool
    .map((symbol) => normalizeSymbol(symbol))
    .filter((symbol) => symbol && !heldSet.has(symbol))
    .slice(0, 8)
    .map((symbol, index) => ({
      symbol,
      price: null,
      percentChange: null,
      rationale: rationalePool[index % rationalePool.length],
    }));
};

const isCryptoSymbol = (value = '') => {
  const normalized = normalizeSymbol(value);
  if (!normalized) return false;

  if (normalized.includes('/')) {
    const [base = ''] = normalized.split('/');
    return CRYPTO_BASE_SYMBOLS.has(base.replace(/[^A-Z0-9]/g, ''));
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  if (CRYPTO_BASE_SYMBOLS.has(compact)) return true;
  if (compact.endsWith('USD') && compact.length > 3) {
    return CRYPTO_BASE_SYMBOLS.has(compact.slice(0, -3));
  }
  return false;
};

const toStreamSymbol = (value = '') => {
  const normalized = normalizeSymbol(value);
  if (!normalized) return '';

  if (normalized.includes('/')) {
    const [baseRaw = '', quoteRaw = 'USD'] = normalized.split('/');
    const base = baseRaw.replace(/[^A-Z0-9]/g, '');
    const quote = (quoteRaw || 'USD').replace(/[^A-Z0-9]/g, '') || 'USD';
    if (!base) return '';
    return `${base}/${quote}`;
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  if (!compact) return '';

  if (CRYPTO_BASE_SYMBOLS.has(compact)) return `${compact}/USD`;
  if (compact.endsWith('USD') && compact.length > 3 && CRYPTO_BASE_SYMBOLS.has(compact.slice(0, -3))) {
    return `${compact.slice(0, -3)}/USD`;
  }

  return compact;
};

const fmtMoney = (value, decimals = 2) => {
  const parsed = Number(value || 0);
  return '$' + parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtQty = (value) => {
  const parsed = Number(value || 0);
  return parsed >= 1 ? parsed.toFixed(2) : parsed.toFixed(6);
};

const fmtPct = (value) => {
  const parsed = Number(value || 0);
  return `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%`;
};

const AnimatedMoney = ({ value, signed = false, className = '', duration = 1.1, countKey }) => {
  const numeric = Number(value || 0);
  const absolute = Math.abs(numeric);
  const prefix = signed ? (numeric >= 0 ? '+$' : '-$') : '$';
  return (
    <span className={className}>
      <CountUp
        key={countKey || `${prefix}-${numeric}`}
        start={0}
        end={absolute}
        duration={duration}
        decimals={2}
        separator=","
        prefix={prefix}
        useEasing
      />
    </span>
  );
};

const AnimatedPercent = ({ value, className = '', duration = 0.8, countKey }) => {
  const numeric = Number(value || 0);
  return (
    <span className={className}>
      <CountUp
        key={countKey || `pct-${numeric}`}
        start={0}
        end={Math.abs(numeric)}
        duration={duration}
        decimals={2}
        prefix={numeric >= 0 ? '+' : '-'}
        suffix="%"
        useEasing
      />
    </span>
  );
};

const summarizePositions = (rows = []) => {
  const value = rows.reduce((sum, row) => sum + Number(row?.market_value || 0), 0);
  const pnl = rows.reduce((sum, row) => sum + Number(row?.pnl || 0), 0);
  const costBasis = rows.reduce((sum, row) => {
    const marketValue = Number(row?.market_value || 0);
    const rowPnl = Number(row?.pnl || 0);
    const derivedCost = marketValue - rowPnl;
    return sum + Math.max(0, Number.isFinite(derivedCost) ? derivedCost : 0);
  }, 0);
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return { value, pnl, pnlPct };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const asTradeValue = (trade) => {
  const explicit = Number(trade?.total_cost);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const qty = Number(trade?.quantity || 0);
  const price = Number(trade?.price || 0);
  return qty > 0 && price > 0 ? qty * price : 0;
};

const toTimestamp = (value) => {
  if (Number.isFinite(value)) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const startOfLocalDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfLocalDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const normalizePerformanceTrade = (trade) => {
  if (!trade || typeof trade !== 'object') return null;

  const symbol = normalizeSymbol(trade?.symbol ?? trade?.ticker ?? trade?.Symbol);
  if (!symbol) return null;

  const rawQuantity = Number(trade?.quantity ?? trade?.shares ?? trade?.qty ?? trade?.size ?? trade?.amount ?? 0);
  const quantity = Math.abs(rawQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const sideRaw = String(trade?.side ?? trade?.type ?? trade?.action ?? '').trim().toLowerCase();
  let side = 'buy';
  if (['sell', 'short', 'close'].includes(sideRaw) || rawQuantity < 0) side = 'sell';
  if (['buy', 'long', 'open'].includes(sideRaw)) side = 'buy';

  const explicitPrice = Number(trade?.price ?? trade?.fillPrice ?? trade?.avgPrice ?? trade?.executionPrice ?? 0);
  const totalCost = Number(trade?.total_cost ?? trade?.total ?? trade?.cost ?? 0);
  const derivedPrice = Number.isFinite(explicitPrice) && explicitPrice > 0
    ? explicitPrice
    : (Number.isFinite(totalCost) && totalCost > 0 ? totalCost / quantity : 0);
  if (!Number.isFinite(derivedPrice) || derivedPrice <= 0) return null;

  const timestamp = toTimestamp(trade?.created_at ?? trade?.timestamp ?? trade?.time ?? trade?.date);
  if (!timestamp) return null;

  return {
    symbol,
    side,
    quantity,
    price: derivedPrice,
    timestamp,
  };
};

const dedupeAndNormalizePerformanceTrades = (rows = []) => {
  const seen = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const normalized = normalizePerformanceTrade(row);
    if (!normalized) return;

    const rowId = String(row?.id ?? row?.tradeId ?? '').trim();
    const fallbackId = [
      normalized.symbol,
      normalized.side,
      normalized.quantity.toFixed(8),
      normalized.price.toFixed(8),
      normalized.timestamp,
      index,
    ].join(':');
    seen.set(rowId || fallbackId, normalized);
  });

  return [...seen.values()].sort((a, b) => a.timestamp - b.timestamp);
};

const buildDailyPerformanceSeries = (trades = [], candlesBySymbol = new Map()) => {
  const normalizedTrades = Array.isArray(trades) ? trades : [];
  const buyTrades = normalizedTrades.filter((trade) => trade.side === 'buy');
  if (buyTrades.length === 0) {
    return { hasTradeHistory: false, holding: [], invested: [] };
  }

  const earliestBuyTimestamp = Math.min(...buyTrades.map((trade) => trade.timestamp));
  const startDate = startOfLocalDay(earliestBuyTimestamp);
  const endDate = startOfLocalDay(Date.now());
  if (!startDate || !endDate) {
    return { hasTradeHistory: false, holding: [], invested: [] };
  }

  const positions = new Map();
  const trackedSymbols = new Set(normalizedTrades.map((trade) => trade.symbol).filter(Boolean));
  const candleState = new Map();

  trackedSymbols.forEach((symbol) => {
    candleState.set(symbol, {
      pointer: 0,
      lastClose: null,
      rows: Array.isArray(candlesBySymbol.get(symbol)) ? candlesBySymbol.get(symbol) : [],
    });
  });

  const holding = [];
  const invested = [];
  let tradeIndex = 0;

  for (let cursor = new Date(startDate); cursor.getTime() <= endDate.getTime(); cursor = new Date(cursor.getTime() + DAY_MS)) {
    const dayEnd = endOfLocalDay(cursor);
    if (!dayEnd) continue;
    const dayEndEpoch = dayEnd.getTime();

    while (tradeIndex < normalizedTrades.length && normalizedTrades[tradeIndex].timestamp <= dayEndEpoch) {
      const trade = normalizedTrades[tradeIndex];
      const current = positions.get(trade.symbol) || { quantity: 0, avgCost: 0 };

      if (trade.side === 'buy') {
        const nextQuantity = current.quantity + trade.quantity;
        const weightedCost = (current.quantity * current.avgCost) + (trade.quantity * trade.price);
        positions.set(trade.symbol, {
          quantity: nextQuantity,
          avgCost: nextQuantity > 0 ? weightedCost / nextQuantity : 0,
        });
      } else {
        const soldQuantity = Math.min(current.quantity, trade.quantity);
        const remainingQuantity = current.quantity - soldQuantity;
        if (remainingQuantity <= 0) {
          positions.delete(trade.symbol);
        } else {
          positions.set(trade.symbol, {
            quantity: remainingQuantity,
            avgCost: current.avgCost,
          });
        }
      }

      tradeIndex += 1;
    }

    positions.forEach((_position, symbol) => {
      const state = candleState.get(symbol);
      if (!state || !Array.isArray(state.rows) || state.rows.length === 0) return;

      while (state.pointer < state.rows.length) {
        const row = state.rows[state.pointer];
        const candleEpoch = parseCandleDateToEpoch(row?.datetime);
        const close = Number(row?.close);
        if (!Number.isFinite(candleEpoch)) {
          state.pointer += 1;
          continue;
        }
        if (candleEpoch <= dayEndEpoch) {
          if (Number.isFinite(close) && close > 0) state.lastClose = close;
          state.pointer += 1;
          continue;
        }
        break;
      }
    });

    let investedValue = 0;
    let holdingValue = 0;

    positions.forEach((position, symbol) => {
      if (!position || !Number.isFinite(position.quantity) || position.quantity <= 0) return;
      const avgCost = Number(position.avgCost || 0);
      if (!Number.isFinite(avgCost) || avgCost <= 0) return;

      const state = candleState.get(symbol);
      const close = Number(state?.lastClose);
      const marketPrice = Number.isFinite(close) && close > 0 ? close : avgCost;

      investedValue += position.quantity * avgCost;
      holdingValue += position.quantity * marketPrice;
    });

    const pointTime = cursor.getTime();
    invested.push([pointTime, Number(investedValue.toFixed(2))]);
    holding.push([pointTime, Number(holdingValue.toFixed(2))]);
  }

  return { hasTradeHistory: true, holding, invested };
};

const formatTradeTime = (value) => {
  const timestamp = toTimestamp(value);
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const panelClass = 'rounded-xl border border-[#1f1f1f] bg-[#0b0b0b]';
const starfieldBaseStyle = {
  backgroundImage:
    'radial-gradient(circle at 50% 50%, rgba(6,13,24,0.96) 0%, rgba(4,9,18,0.98) 55%, rgba(2,6,14,1) 100%), radial-gradient(circle at 14% 18%, rgba(16,185,129,0.08), transparent 34%), radial-gradient(circle at 82% 72%, rgba(148,163,184,0.08), transparent 36%)',
};
const starfieldDotsStyle = {
  backgroundImage:
    'radial-gradient(rgba(255,255,255,0.28) 0.7px, transparent 1px), radial-gradient(rgba(167,243,208,0.22) 0.65px, transparent 0.95px), radial-gradient(rgba(148,163,184,0.18) 0.7px, transparent 1px)',
  backgroundSize: '150px 150px, 210px 210px, 260px 260px',
  backgroundPosition: '0 0, 42px 86px, 118px 30px',
};

export default function PortfolioDashboard() {
  const { user } = useAuth();
  const { portfolio, trades, loading, error, fetchPortfolio, updatePositionPrice } = usePaperTrading();
  const { trades: syncedTrades = [] } = useTradeHistoryStore();
  const [marketStatus, setMarketStatus] = useState(() => getMarketStatus());
  const [splitViewEnabled, setSplitViewEnabled] = useState(() => loadInitialSplitViewPreference());
  const [ideaRefreshNonce, setIdeaRefreshNonce] = useState(0);
  const [aiIdeas, setAiIdeas] = useState(() => ({
    loading: false,
    error: '',
    rows: [],
    summary: '',
    generatedAt: '',
  }));
  const [selectedIdeaSymbols, setSelectedIdeaSymbols] = useState([]);
  const [portfolioScenarios, setPortfolioScenarios] = useState(() => loadInitialPortfolioScenarios());
  const [activeScenarioId, setActiveScenarioId] = useState('');
  const [scenarioNameInput, setScenarioNameInput] = useState('AI Radar Basket');
  const [scenarioCapitalInput, setScenarioCapitalInput] = useState('100000');
  const [selectedWhatIfMonths, setSelectedWhatIfMonths] = useState(3);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfError, setWhatIfError] = useState('');
  const [whatIfResults, setWhatIfResults] = useState([]);
  const [whatIfGeneratedAt, setWhatIfGeneratedAt] = useState('');
  const [radarLiveQuotes, setRadarLiveQuotes] = useState({});
  const [scenarioSyncReady, setScenarioSyncReady] = useState(false);
  const [performanceState, setPerformanceState] = useState(() => ({
    loading: true,
    hasTradeHistory: false,
    holding: [],
    invested: [],
    error: '',
  }));
  const scenarioSyncTimerRef = useRef(null);
  const syncedScenarioIdsRef = useRef(new Set());
  const lastSyncedScenarioSignatureRef = useRef('');
  const pricesRef = useRef({ totalValue: STARTING_BALANCE, cashBalance: 0, totalPnl: 0, totalPnlPct: 0 });

  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const cashBalance = Number(portfolio?.cash_balance || 0);
  const totalValue = Number(portfolio?.total_account_value || STARTING_BALANCE);
  const totalPnl = Number(portfolio?.total_pnl || 0);
  const totalPnlPct = Number(portfolio?.total_pnl_percent || 0);

  // Buffer latest values into ref (no re-render)
  pricesRef.current = { totalValue, cashBalance, totalPnl, totalPnlPct };

  // Throttled summary state — updates every 2s instead of every tick
  const [displaySummary, setDisplaySummary] = useState({ totalValue, cashBalance, totalPnl, totalPnlPct });
  useEffect(() => {
    const id = setInterval(() => {
      setDisplaySummary(prev => {
        const next = pricesRef.current;
        if (prev.totalValue === next.totalValue && prev.cashBalance === next.cashBalance
          && prev.totalPnl === next.totalPnl && prev.totalPnlPct === next.totalPnlPct) return prev;
        return { ...next };
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const investedNow = Math.max(0, totalValue - cashBalance);

  const strategyTrades = useMemo(() => {
    const rows = Array.isArray(syncedTrades) ? syncedTrades : [];

    return rows
      .filter((trade) => {
        const strategyId = String(
          trade?.strategyId
          ?? trade?.strategy
          ?? trade?.strategy_id
          ?? '',
        ).trim();

        const source = String(trade?.source ?? trade?.origin ?? '').toLowerCase();
        const note = String(trade?.note ?? trade?.reason ?? '').toLowerCase();

        return Boolean(strategyId)
          || source.includes('strategy')
          || source.includes('ai')
          || note.includes('strategy')
          || note.includes('ai');
      })
      .sort((a, b) => toTimestamp(b?.timestamp) - toTimestamp(a?.timestamp))
      .slice(0, 30);
  }, [syncedTrades]);

  const strategySymbols = useMemo(() => new Set(
    strategyTrades
      .map((trade) => normalizeSymbol(trade?.symbol))
      .filter(Boolean)
  ), [strategyTrades]);

  const strategyPositions = useMemo(
    () => positions.filter((position) => strategySymbols.has(normalizeSymbol(position?.symbol))),
    [positions, strategySymbols]
  );

  const nonStrategyPositions = useMemo(
    () => positions.filter((position) => !strategySymbols.has(normalizeSymbol(position?.symbol))),
    [positions, strategySymbols]
  );

  const equityPositions = useMemo(
    () => nonStrategyPositions.filter((position) => !isCryptoSymbol(position?.symbol)),
    [nonStrategyPositions]
  );

  const cryptoPositions = useMemo(
    () => nonStrategyPositions.filter((position) => isCryptoSymbol(position?.symbol)),
    [nonStrategyPositions]
  );

  const equitySummary = useMemo(() => summarizePositions(equityPositions), [equityPositions]);
  const cryptoSummary = useMemo(() => summarizePositions(cryptoPositions), [cryptoPositions]);
  const strategySummary = useMemo(() => summarizePositions(strategyPositions), [strategyPositions]);

  const holdingsSections = useMemo(() => ([
    { id: 'equity', label: 'Equity Holdings', rows: equityPositions, summary: equitySummary },
    { id: 'crypto', label: 'Crypto Holdings', rows: cryptoPositions, summary: cryptoSummary },
    { id: 'strategy', label: 'Strategy Holdings', rows: strategyPositions, summary: strategySummary },
  ]), [
    cryptoPositions,
    cryptoSummary,
    equityPositions,
    equitySummary,
    strategyPositions,
    strategySummary,
  ]);

  const performanceTradeRefreshKey = useMemo(
    () => (Array.isArray(trades)
      ? trades
        .slice(0, 200)
        .map((trade) => `${trade?.id || ''}:${trade?.created_at || trade?.timestamp || ''}`)
        .join('|')
      : ''),
    [trades]
  );

  const riskScore = useMemo(() => {
    if (!positions.length) return 8;

    const maxWeight = positions.reduce((max, position) => {
      const weight = totalValue > 0 ? (Number(position?.market_value || 0) / totalValue) * 100 : 0;
      return Math.max(max, weight);
    }, 0);

    const cryptoWeight = positions.reduce((sum, position) => {
      if (!isCryptoSymbol(position?.symbol)) return sum;
      const weight = totalValue > 0 ? (Number(position?.market_value || 0) / totalValue) * 100 : 0;
      return sum + weight;
    }, 0);

    const pnlVolProxy = Math.min(25, Math.abs(totalPnlPct) * 0.8);
    return clamp(15 + maxWeight * 0.45 + cryptoWeight * 0.25 + pnlVolProxy, 1, 99);
  }, [positions, totalValue, totalPnlPct]);

  const goalProbability = useMemo(() => {
    const progress = clamp((totalValue / GOAL_TARGET) * 100, 0, 100);
    const momentum = clamp(totalPnlPct, -40, 40);
    return Math.round(clamp(progress * 0.75 + (momentum + 40) * 0.3, 0, 100));
  }, [totalValue, totalPnlPct]);

  const allocationSlices = useMemo(() => {
    const palette = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#6366f1', '#0ea5e9'];
    const rows = [];

    positions
      .slice()
      .sort((a, b) => Number(b?.market_value || 0) - Number(a?.market_value || 0))
      .forEach((position, index) => {
        const value = Number(position?.market_value || 0);
        if (value <= 0) return;
        rows.push({
          name: `$${normalizeSymbol(position?.symbol || '--')}`,
          y: value,
          color: palette[index % palette.length],
        });
      });

    if (cashBalance > 0) {
      rows.push({
        name: 'Cash',
        y: cashBalance,
        color: '#1e293b',
      });
    }

    if (!rows.length) {
      rows.push({ name: 'Cash', y: STARTING_BALANCE, color: '#1e293b' });
    }

    return rows;
  }, [positions, cashBalance]);

  const heldSymbolsKey = useMemo(() => {
    const unique = new Set();
    positions.forEach((position) => {
      const symbol = normalizeSymbol(position?.symbol);
      if (symbol) unique.add(symbol);
    });
    return [...unique].sort().join(',');
  }, [positions]);

  const strategySymbolsKey = useMemo(
    () => [...strategySymbols].sort().join(','),
    [strategySymbols]
  );

  const heldSymbols = useMemo(
    () => (heldSymbolsKey ? heldSymbolsKey.split(',').map((symbol) => normalizeSymbol(symbol)).filter(Boolean) : []),
    [heldSymbolsKey]
  );

  const strategyExposureSymbols = useMemo(
    () => (strategySymbolsKey ? strategySymbolsKey.split(',').map((symbol) => normalizeSymbol(symbol)).filter(Boolean) : []),
    [strategySymbolsKey]
  );

  const aiIdeasQuery = useMemo(
    () => buildAiIdeaQuery(heldSymbols, strategyExposureSymbols),
    [heldSymbols, strategyExposureSymbols]
  );

  const fallbackAiIdeas = useMemo(
    () => buildFallbackIdeas(heldSymbols),
    [heldSymbols]
  );

  const aiIdeaRows = useMemo(
    () => (Array.isArray(aiIdeas.rows) && aiIdeas.rows.length > 0 ? aiIdeas.rows : fallbackAiIdeas),
    [aiIdeas.rows, fallbackAiIdeas]
  );

  const activeScenario = useMemo(
    () => portfolioScenarios.find((scenario) => scenario.id === activeScenarioId) || null,
    [activeScenarioId, portfolioScenarios]
  );

  const activeScenarioSymbols = useMemo(() => {
    const scenarioSymbols = Array.isArray(activeScenario?.symbols) ? activeScenario.symbols : [];
    if (scenarioSymbols.length > 0) return scenarioSymbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean);
    return selectedIdeaSymbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean);
  }, [activeScenario?.symbols, selectedIdeaSymbols]);

  const radarStreamSymbols = useMemo(() => {
    const symbolSet = new Set();
    aiIdeaRows.forEach((idea) => {
      const symbol = normalizeSymbol(idea?.symbol);
      if (symbol) symbolSet.add(symbol);
    });
    activeScenarioSymbols.forEach((symbol) => {
      const normalized = normalizeSymbol(symbol);
      if (normalized) symbolSet.add(normalized);
    });
    return [...symbolSet].slice(0, 32);
  }, [activeScenarioSymbols, aiIdeaRows]);

  const selectedIdeaSet = useMemo(
    () => new Set(selectedIdeaSymbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean)),
    [selectedIdeaSymbols]
  );

  const aiIdeaRowsLive = useMemo(
    () => aiIdeaRows.map((idea) => {
      const symbol = normalizeSymbol(idea?.symbol);
      const key = toSymbolKey(symbol);
      const live = key ? radarLiveQuotes[key] : null;
      const livePrice = Number(live?.price);
      const livePercent = Number(live?.percentChange);
      return {
        ...idea,
        price: Number.isFinite(livePrice) && livePrice > 0 ? livePrice : idea?.price,
        percentChange: Number.isFinite(livePercent) ? livePercent : idea?.percentChange,
      };
    }),
    [aiIdeaRows, radarLiveQuotes]
  );

  const whatIfResultsLive = useMemo(
    () => whatIfResults.map((result) => {
      const rows = (Array.isArray(result?.rows) ? result.rows : []).map((row) => {
        const key = toSymbolKey(row?.symbol);
        const live = key ? radarLiveQuotes[key] : null;
        const livePrice = Number(live?.price);
        const invested = Number(row?.invested || 0);
        const shares = Number(row?.shares || 0);
        if (!Number.isFinite(livePrice) || livePrice <= 0 || !Number.isFinite(shares) || shares <= 0) return row;
        const valueNow = shares * livePrice;
        const pnl = valueNow - invested;
        const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
        return {
          ...row,
          currentPrice: livePrice,
          valueNow,
          pnl,
          pnlPct,
        };
      });

      const invested = rows.reduce((sum, row) => sum + Number(row?.invested || 0), 0);
      const valueNow = rows.reduce((sum, row) => sum + Number(row?.valueNow || 0), 0);
      const pnl = valueNow - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

      return {
        ...result,
        rows,
        invested,
        valueNow,
        pnl,
        pnlPct,
      };
    }),
    [radarLiveQuotes, whatIfResults]
  );

  const whatIfSelectedResult = useMemo(
    () => whatIfResultsLive.find((result) => Number(result?.months) === Number(selectedWhatIfMonths)) || null,
    [selectedWhatIfMonths, whatIfResultsLive]
  );

  const whatIfGeneratedLabel = useMemo(() => {
    const timestamp = Date.parse(String(whatIfGeneratedAt || ''));
    if (!Number.isFinite(timestamp)) return '';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [whatIfGeneratedAt]);

  const scenarioSyncSignature = useMemo(
    () => buildScenarioSignature(portfolioScenarios),
    [portfolioScenarios]
  );

  const aiIdeasUpdatedLabel = useMemo(() => {
    const generatedAt = String(aiIdeas.generatedAt || '').trim();
    if (!generatedAt) return '';
    const timestamp = Date.parse(generatedAt);
    if (!Number.isFinite(timestamp)) return '';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [aiIdeas.generatedAt]);

  const handleToggleIdeaSymbol = (rawSymbol) => {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) return;

    setActiveScenarioId('');
    setWhatIfResults([]);
    setWhatIfError('');

    setSelectedIdeaSymbols((previous) => {
      const exists = previous.some((item) => normalizeSymbol(item) === symbol);
      if (exists) return previous.filter((item) => normalizeSymbol(item) !== symbol);
      return [...previous, symbol].slice(0, 12);
    });
  };

  const handleSelectScenario = (scenarioId) => {
    const scenario = portfolioScenarios.find((row) => row.id === scenarioId);
    if (!scenario) return;

    setActiveScenarioId(scenario.id);
    setSelectedIdeaSymbols(scenario.symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean));
    setScenarioNameInput(scenario.name);
    setScenarioCapitalInput(String(Math.round(Number(scenario.capital || STARTING_BALANCE))));
    setWhatIfResults([]);
    setWhatIfError('');
  };

  const handleCreateScenario = () => {
    const name = String(scenarioNameInput || '').trim().slice(0, 40);
    const symbols = [...new Set(selectedIdeaSymbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean))].slice(0, 12);
    const capital = parseCapitalInput(scenarioCapitalInput, STARTING_BALANCE);

    if (!name) {
      setWhatIfError('Name this watchlist before saving.');
      return;
    }
    if (symbols.length === 0) {
      setWhatIfError('Pick at least one AI radar ticker before saving a watchlist.');
      return;
    }

    const nextScenario = normalizeScenarioRecord({
      id: makeUuid(),
      name,
      symbols,
      createdAt: new Date().toISOString(),
      capital,
    });
    if (!nextScenario) return;

    setPortfolioScenarios((previous) => [nextScenario, ...previous].slice(0, 20));
    setActiveScenarioId(nextScenario.id);
    setScenarioCapitalInput(String(Math.round(capital)));
    setWhatIfError('');
  };

  const handleDeleteScenario = (scenarioId) => {
    setPortfolioScenarios((previous) => previous.filter((scenario) => scenario.id !== scenarioId));
    if (activeScenarioId === scenarioId) {
      setActiveScenarioId('');
      setWhatIfResults([]);
    }
  };

  const runWhatIfSimulation = async () => {
    const symbols = [...new Set(activeScenarioSymbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean))].slice(0, 12);
    if (symbols.length === 0) {
      setWhatIfError('Select AI radar symbols or load a saved watchlist first.');
      setWhatIfResults([]);
      return;
    }

    const capital = parseCapitalInput(scenarioCapitalInput, STARTING_BALANCE);
    setWhatIfLoading(true);
    setWhatIfError('');

    try {
      const quoteParams = new URLSearchParams({ symbols: symbols.join(',') });
      const quoteResponse = await fetch(`/api/community/market-data?${quoteParams.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const quotePayload = await quoteResponse.json().catch(() => ({}));
      const quoteRows = parseMarketDataRows(quotePayload);
      const quoteBySymbol = new Map();
      quoteRows.forEach((row) => {
        const symbol = normalizeSymbol(row?.symbol);
        const price = Number(row?.price ?? row?.close ?? row?.last);
        if (symbol && Number.isFinite(price) && price > 0) {
          quoteBySymbol.set(symbol, price);
        }
      });

      const candlesBySymbol = new Map();
      await Promise.all(symbols.map(async (symbol) => {
        const params = new URLSearchParams({
          symbol,
          interval: '1day',
          outputsize: '420',
        });
        const response = await fetch(`/api/chart/candles?${params.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const rows = parseApiCandles(payload);
        if (rows.length === 0) return;
        candlesBySymbol.set(symbol, rows);

        if (!quoteBySymbol.has(symbol)) {
          const latestClose = Number(rows[rows.length - 1]?.close);
          if (Number.isFinite(latestClose) && latestClose > 0) {
            quoteBySymbol.set(symbol, latestClose);
          }
        }
      }));

      const results = WHAT_IF_TIMEFRAME_OPTIONS.map((months) => {
        const targetDate = subtractMonthsToTradingDay(months);
        const candidateRows = symbols.map((symbol) => {
          const candles = candlesBySymbol.get(symbol) || [];
          const entry = findEntryCloseOnOrBefore(candles, targetDate);
          const currentPrice = Number(quoteBySymbol.get(symbol));
          if (!entry || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;
          return {
            symbol,
            entryDate: String(entry.datetime || ''),
            entryClose: Number(entry.close),
            currentPrice,
          };
        }).filter(Boolean);

        if (candidateRows.length === 0) {
          return {
            months,
            targetDate: toLocalIsoDate(targetDate),
            rows: [],
            symbols: [],
            invested: 0,
            valueNow: 0,
            pnl: 0,
            pnlPct: 0,
          };
        }

        const allocationPerSymbol = capital / candidateRows.length;
        const rows = candidateRows.map((row) => {
          const shares = allocationPerSymbol / row.entryClose;
          const valueNow = shares * row.currentPrice;
          const pnl = valueNow - allocationPerSymbol;
          const pnlPct = allocationPerSymbol > 0 ? (pnl / allocationPerSymbol) * 100 : 0;
          return {
            ...row,
            invested: allocationPerSymbol,
            shares,
            valueNow,
            pnl,
            pnlPct,
          };
        });

        const invested = rows.reduce((sum, row) => sum + Number(row.invested || 0), 0);
        const valueNow = rows.reduce((sum, row) => sum + Number(row.valueNow || 0), 0);
        const pnl = valueNow - invested;
        const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

        return {
          months,
          targetDate: toLocalIsoDate(targetDate),
          rows,
          symbols: rows.map((row) => row.symbol),
          invested,
          valueNow,
          pnl,
          pnlPct,
        };
      });

      const hasAnyRows = results.some((row) => Array.isArray(row.rows) && row.rows.length > 0);
      if (!hasAnyRows) {
        setWhatIfError('No historical candle data was found for this basket. Try different symbols.');
      }

      setWhatIfResults(results);
      setWhatIfGeneratedAt(new Date().toISOString());
      setSelectedWhatIfMonths((previous) => (
        WHAT_IF_TIMEFRAME_OPTIONS.includes(previous) ? previous : 3
      ));

      if (activeScenarioId) {
        setPortfolioScenarios((previous) => previous.map((scenario) => (
          scenario.id === activeScenarioId
            ? { ...scenario, capital }
            : scenario
        )));
      }
    } catch (error) {
      setWhatIfError(String(error?.message || 'Failed to run the AI radar simulation.'));
      setWhatIfResults([]);
    } finally {
      setWhatIfLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PORTFOLIO_SPLIT_VIEW_STORAGE_KEY, splitViewEnabled ? 'true' : 'false');
    } catch {
      // no-op
    }
  }, [splitViewEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PORTFOLIO_SCENARIOS_STORAGE_KEY, JSON.stringify(portfolioScenarios));
    } catch {
      // no-op
    }
  }, [portfolioScenarios]);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteScenarios = async () => {
      if (!user?.id) {
        syncedScenarioIdsRef.current = new Set(portfolioScenarios.map((scenario) => String(scenario?.id || '')).filter(Boolean));
        lastSyncedScenarioSignatureRef.current = scenarioSyncSignature;
        setScenarioSyncReady(true);
        return;
      }

      setScenarioSyncReady(false);
      try {
        const { data, error } = await supabase
          .from(PORTFOLIO_SCENARIOS_TABLE)
          .select('id, name, capital, symbols, created_at, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(20);

        if (cancelled) return;
        if (error) {
          console.warn('[PortfolioDashboard] failed to load radar watchlists:', error.message);
          syncedScenarioIdsRef.current = new Set(portfolioScenarios.map((scenario) => String(scenario?.id || '')).filter(Boolean));
          lastSyncedScenarioSignatureRef.current = scenarioSyncSignature;
          setScenarioSyncReady(true);
          return;
        }

        const remoteScenarios = (Array.isArray(data) ? data : [])
          .map((row) => normalizeScenarioRecord({
            id: row?.id,
            name: row?.name,
            capital: row?.capital,
            symbols: row?.symbols,
            createdAt: row?.created_at,
          }))
          .filter(Boolean)
          .slice(0, 20);

        if (remoteScenarios.length > 0) {
          setPortfolioScenarios(remoteScenarios);
          syncedScenarioIdsRef.current = new Set(remoteScenarios.map((scenario) => scenario.id));
          lastSyncedScenarioSignatureRef.current = buildScenarioSignature(remoteScenarios);
          setScenarioSyncReady(true);
          return;
        }

        // First login/device bootstrap: push locally cached watchlists into Supabase.
        const localScenarios = portfolioScenarios
          .map((scenario) => normalizeScenarioRecord(scenario))
          .filter(Boolean)
          .slice(0, 20);
        if (localScenarios.length > 0) {
          const payload = localScenarios.map((scenario) => toSupabaseScenarioPayload(user.id, scenario));
          const { error: upsertError } = await supabase
            .from(PORTFOLIO_SCENARIOS_TABLE)
            .upsert(payload, { onConflict: 'id' });
          if (upsertError) {
            console.warn('[PortfolioDashboard] failed to bootstrap radar watchlists:', upsertError.message);
          } else {
            setPortfolioScenarios(localScenarios);
            syncedScenarioIdsRef.current = new Set(localScenarios.map((scenario) => scenario.id));
            lastSyncedScenarioSignatureRef.current = buildScenarioSignature(localScenarios);
          }
        } else {
          syncedScenarioIdsRef.current = new Set();
          lastSyncedScenarioSignatureRef.current = '[]';
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[PortfolioDashboard] unexpected radar watchlist load error:', error);
        }
      } finally {
        if (!cancelled) setScenarioSyncReady(true);
      }
    };

    void loadRemoteScenarios();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !scenarioSyncReady) return;
    if (scenarioSyncSignature === lastSyncedScenarioSignatureRef.current) return;

    if (scenarioSyncTimerRef.current) {
      clearTimeout(scenarioSyncTimerRef.current);
    }

    scenarioSyncTimerRef.current = setTimeout(async () => {
      const normalizedScenarios = portfolioScenarios
        .map((scenario) => normalizeScenarioRecord(scenario))
        .filter(Boolean)
        .slice(0, 20);

      const nextSignature = buildScenarioSignature(normalizedScenarios);
      const nextIds = new Set(normalizedScenarios.map((scenario) => scenario.id));
      const removedIds = [...syncedScenarioIdsRef.current].filter((id) => !nextIds.has(id));

      if (normalizedScenarios.length > 0) {
        const payload = normalizedScenarios.map((scenario) => toSupabaseScenarioPayload(user.id, scenario));
        const { error: upsertError } = await supabase
          .from(PORTFOLIO_SCENARIOS_TABLE)
          .upsert(payload, { onConflict: 'id' });
        if (upsertError) {
          console.warn('[PortfolioDashboard] failed to sync radar watchlists:', upsertError.message);
          return;
        }
      }

      if (removedIds.length > 0) {
        await Promise.all(removedIds.map(async (scenarioId) => {
          const { error: deleteError } = await supabase
            .from(PORTFOLIO_SCENARIOS_TABLE)
            .delete()
            .eq('user_id', user.id)
            .eq('id', scenarioId);
          if (deleteError) {
            console.warn('[PortfolioDashboard] failed to delete radar watchlist:', deleteError.message);
          }
        }));
      }

      syncedScenarioIdsRef.current = nextIds;
      lastSyncedScenarioSignatureRef.current = nextSignature;
    }, SCENARIO_SYNC_DEBOUNCE_MS);

    return () => {
      if (scenarioSyncTimerRef.current) {
        clearTimeout(scenarioSyncTimerRef.current);
        scenarioSyncTimerRef.current = null;
      }
    };
  }, [portfolioScenarios, scenarioSyncReady, scenarioSyncSignature, user?.id]);

  useEffect(() => {
    const available = new Set(aiIdeaRows.map((row) => normalizeSymbol(row?.symbol)).filter(Boolean));
    setSelectedIdeaSymbols((previous) => {
      const next = previous.filter((symbol) => available.has(normalizeSymbol(symbol)));
      if (next.length === previous.length) return previous;
      return next;
    });
  }, [aiIdeaRows]);

  useEffect(() => {
    if (!splitViewEnabled) return;
    if (activeScenarioId) return;
    if (selectedIdeaSymbols.length > 0) return;
    const defaults = aiIdeaRows
      .slice(0, 4)
      .map((row) => normalizeSymbol(row?.symbol))
      .filter(Boolean);
    if (defaults.length > 0) {
      setSelectedIdeaSymbols(defaults);
    }
  }, [activeScenarioId, aiIdeaRows, selectedIdeaSymbols.length, splitViewEnabled]);

  const streamConfig = useMemo(() => {
    const equitiesEnabled = marketStatus !== 'Weekend' && marketStatus !== 'Holiday';
    const streamSymbols = [];
    const streamToPositionSymbols = new Map();

    if (!heldSymbolsKey) {
      return { streamSymbols, streamToPositionSymbols };
    }

    heldSymbolsKey.split(',').forEach((positionSymbol) => {
      if (!positionSymbol) return;
      const crypto = isCryptoSymbol(positionSymbol);
      if (!crypto && !equitiesEnabled) return;

      const streamSymbol = toStreamSymbol(positionSymbol);
      const streamKey = toSymbolKey(streamSymbol);
      if (!streamSymbol || !streamKey) return;

      if (!streamToPositionSymbols.has(streamKey)) {
        streamToPositionSymbols.set(streamKey, new Set());
        streamSymbols.push(streamSymbol);
      }
      streamToPositionSymbols.get(streamKey).add(positionSymbol);
    });

    return { streamSymbols, streamToPositionSymbols };
  }, [heldSymbolsKey, marketStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!streamConfig.streamSymbols.length) return undefined;

    const unsubscribe = subscribeTwelveDataQuotes(streamConfig.streamSymbols, (update) => {
      const price = Number(update?.price);
      if (!Number.isFinite(price) || price <= 0) return;

      const incomingKey = toSymbolKey(update?.symbol);
      if (!incomingKey) return;

      const linkedSymbols = streamConfig.streamToPositionSymbols.get(incomingKey);
      if (linkedSymbols && linkedSymbols.size > 0) {
        linkedSymbols.forEach((positionSymbol) => {
          updatePositionPrice(positionSymbol, price);
        });
        return;
      }

      updatePositionPrice(update?.symbol, price);
    });

    return () => unsubscribe?.();
  }, [streamConfig, updatePositionPrice]);

  useEffect(() => {
    if (!splitViewEnabled || radarStreamSymbols.length === 0) return undefined;

    const unsubscribe = subscribeTwelveDataQuotes(radarStreamSymbols, (update) => {
      const price = Number(update?.price);
      if (!Number.isFinite(price) || price <= 0) return;

      const key = toSymbolKey(update?.symbol);
      if (!key) return;

      const percentRaw = Number(update?.dayChangePercent ?? update?.percentChange ?? update?.percent_change);
      const percentChange = Number.isFinite(percentRaw) ? percentRaw : null;

      setRadarLiveQuotes((previous) => {
        const existing = previous[key];
        if (existing && existing.price === price && existing.percentChange === percentChange) {
          return previous;
        }
        return {
          ...previous,
          [key]: {
            price,
            percentChange,
            updatedAt: Date.now(),
          },
        };
      });
    });

    return () => unsubscribe?.();
  }, [radarStreamSymbols, splitViewEnabled]);

  useEffect(() => {
    const allowedKeys = new Set(radarStreamSymbols.map((symbol) => toSymbolKey(symbol)).filter(Boolean));
    setRadarLiveQuotes((previous) => {
      const entries = Object.entries(previous).filter(([key]) => allowedKeys.has(key));
      if (entries.length === Object.keys(previous).length) return previous;
      return Object.fromEntries(entries);
    });
  }, [radarStreamSymbols]);

  useEffect(() => {
    const onTradeExecuted = () => {
      fetchPortfolio({ silent: true });
    };

    window.addEventListener('paper-trade-executed', onTradeExecuted);
    return () => window.removeEventListener('paper-trade-executed', onTradeExecuted);
  }, [fetchPortfolio]);

  useEffect(() => {
    if (!splitViewEnabled) return undefined;

    let cancelled = false;
    const abortController = new AbortController();

    const runAiIdeas = async () => {
      setAiIdeas((previous) => ({
        ...previous,
        loading: true,
        error: '',
      }));

      try {
        const response = await fetch('/api/community/ai-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: aiIdeasQuery,
            interests: {
              trackedSymbols: heldSymbols,
              filter: 'portfolio',
              signedIn: true,
            },
          }),
          signal: abortController.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(payload?.error || `Ideas request failed (${response.status})`));
        }

        const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
        const relatedTickers = Array.isArray(data?.relatedTickers) ? data.relatedTickers : [];
        const tickerSnapshots = data?.tickerSnapshots && typeof data.tickerSnapshots === 'object'
          ? data.tickerSnapshots
          : {};
        const keyPoints = Array.isArray(data?.keyPoints) ? data.keyPoints : [];
        const heldSet = new Set(heldSymbols);

        const mappedRows = relatedTickers
          .map((rawSymbol, index) => {
            const symbol = normalizeSymbol(rawSymbol);
            if (!symbol || heldSet.has(symbol)) return null;

            const snapshot = tickerSnapshots[symbol] || {};
            const priceValue = Number(snapshot?.price);
            const percentValue = Number(snapshot?.percentChange);

            return {
              symbol,
              price: Number.isFinite(priceValue) ? priceValue : null,
              percentChange: Number.isFinite(percentValue) ? percentValue : null,
              rationale: String(keyPoints[index] || '').trim(),
            };
          })
          .filter(Boolean)
          .slice(0, 8);

        const nextRows = mappedRows.length > 0 ? mappedRows : fallbackAiIdeas;

        if (cancelled) return;
        setAiIdeas({
          loading: false,
          error: '',
          rows: nextRows,
          summary: String(data?.summary || '').trim(),
          generatedAt: String(data?.generatedAt || new Date().toISOString()),
        });
      } catch {
        if (abortController.signal.aborted || cancelled) return;
        setAiIdeas({
          loading: false,
          error: 'Live AI ideas are reconnecting. Showing fallback watchlist ideas.',
          rows: fallbackAiIdeas,
          summary: '',
          generatedAt: new Date().toISOString(),
        });
      }
    };

    void runAiIdeas();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [aiIdeasQuery, fallbackAiIdeas, heldSymbols, ideaRefreshNonce, splitViewEnabled]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const loadPerformanceSeries = async () => {
      if (!user?.id) {
        setPerformanceState({
          loading: false,
          hasTradeHistory: false,
          holding: [],
          invested: [],
          error: '',
        });
        return;
      }

      setPerformanceState((previous) => ({
        ...previous,
        loading: true,
        error: '',
      }));

      try {
        const { data: paperTrades, error: paperTradesError } = await supabase
          .from('paper_trades')
          .select('id, symbol, side, quantity, price, total_cost, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(5000);

        let supabaseTradeRows = Array.isArray(paperTrades) ? paperTrades : [];
        if ((paperTradesError || supabaseTradeRows.length === 0) && !abortController.signal.aborted) {
          const { data: profileRow, error: profileError } = await supabase
            .from('profiles')
            .select('trade_history, user_state')
            .eq('id', user.id)
            .maybeSingle();

          if (paperTradesError && profileError) {
            throw new Error(paperTradesError.message || profileError.message || 'Failed to load trade history.');
          }

          const profileTrades = Array.isArray(profileRow?.trade_history) ? profileRow.trade_history : [];
          const userStateTrades = Array.isArray(profileRow?.user_state?.trade_history)
            ? profileRow.user_state.trade_history
            : [];
          supabaseTradeRows = [...supabaseTradeRows, ...profileTrades, ...userStateTrades];
        }

        const normalizedTrades = dedupeAndNormalizePerformanceTrades(supabaseTradeRows);
        const buyTrades = normalizedTrades.filter((trade) => trade.side === 'buy');

        if (buyTrades.length === 0) {
          if (cancelled) return;
          setPerformanceState({
            loading: false,
            hasTradeHistory: false,
            holding: [],
            invested: [],
            error: '',
          });
          return;
        }

        const earliestBuyTimestamp = Math.min(...buyTrades.map((trade) => trade.timestamp));
        const lookbackDays = Math.ceil((Date.now() - earliestBuyTimestamp) / DAY_MS) + 30;
        const outputsize = clamp(lookbackDays, 60, MAX_CANDLE_OUTPUT_SIZE);
        const symbols = [...new Set(normalizedTrades.map((trade) => trade.symbol).filter(Boolean))];
        const candlesBySymbol = new Map();

        await Promise.all(symbols.map(async (symbol) => {
          const params = new URLSearchParams({
            symbol,
            interval: '1day',
            outputsize: String(outputsize),
          });

          try {
            const response = await fetch(`/api/chart/candles?${params.toString()}`, {
              method: 'GET',
              headers: { Accept: 'application/json' },
              cache: 'no-store',
              signal: abortController.signal,
            });
            if (!response.ok) return;
            const payload = await response.json().catch(() => ({}));
            const parsed = parseApiCandles(payload);
            if (parsed.length > 0) {
              candlesBySymbol.set(symbol, parsed);
            }
          } catch {
            // best-effort per symbol
          }
        }));

        if (cancelled || abortController.signal.aborted) return;
        const series = buildDailyPerformanceSeries(normalizedTrades, candlesBySymbol);

        setPerformanceState({
          loading: false,
          hasTradeHistory: series.hasTradeHistory,
          holding: series.holding,
          invested: series.invested,
          error: '',
        });
      } catch (error) {
        if (cancelled || abortController.signal.aborted) return;
        setPerformanceState({
          loading: false,
          hasTradeHistory: false,
          holding: [],
          invested: [],
          error: String(error?.message || 'Failed to load portfolio performance.'),
        });
      }
    };

    void loadPerformanceSeries();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [performanceTradeRefreshKey, user?.id]);

  const walletChartOptions = useMemo(() => ({
    chart: {
      type: 'areaspline',
      backgroundColor: 'transparent',
      height: 280,
      spacing: [12, 12, 12, 12],
    },
    title: { text: null },
    credits: { enabled: false },
    legend: {
      itemStyle: { color: '#94a3b8' },
      itemHoverStyle: { color: '#e5e7eb' },
    },
    xAxis: {
      type: 'datetime',
      lineColor: '#1f1f1f',
      tickColor: '#1f1f1f',
      labels: { style: { color: '#6b7280', fontSize: '10px' } },
    },
    yAxis: {
      title: { text: null },
      gridLineColor: '#1f1f1f',
      labels: {
        style: { color: '#6b7280', fontSize: '10px' },
        formatter() { return fmtMoney(this.value, 0); },
      },
    },
    tooltip: {
      backgroundColor: '#0b0b0b',
      borderColor: '#1f1f1f',
      style: { color: '#e5e7eb' },
      xDateFormat: '%b %e, %Y',
      pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>${point.y:,.2f}</b><br/>',
      shared: true,
    },
    plotOptions: {
      series: {
        marker: { enabled: false },
        animation: false,
      },
      areaspline: {
        fillOpacity: 0.2,
      },
    },
    series: [
      {
        type: 'areaspline',
        name: 'Holding',
        data: performanceState.holding,
        color: '#10b981',
        lineWidth: 2,
      },
      {
        type: 'line',
        name: 'Invested',
        data: performanceState.invested,
        color: '#737373',
        dashStyle: 'ShortDot',
        lineWidth: 2,
      },
    ],
  }), [performanceState.holding, performanceState.invested]);

  const riskColor = riskScore >= 75 ? '#ef4444' : '#3b82f6';
  const goalColor = goalProbability >= 60 ? '#10b981' : '#ef4444';

  const allocationPieOptions = useMemo(() => ({
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      height: 280,
      spacing: [6, 6, 6, 6],
      animation: true,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: {
      enabled: true,
      itemStyle: { color: '#94a3b8', fontSize: '10px' },
      itemHoverStyle: { color: '#e5e7eb' },
    },
    tooltip: {
      backgroundColor: '#0b0b0b',
      borderColor: '#1f1f1f',
      style: { color: '#e5e7eb' },
      pointFormat: '<b>{point.name}</b><br/>Value: <b>{point.y:$,.2f}</b><br/>Weight: <b>{point.percentage:.2f}%</b>',
    },
    plotOptions: {
      series: {
        animation: { duration: 900 },
      },
      pie: {
        innerSize: '56%',
        borderWidth: 2,
        borderColor: '#0b0b0b',
        shadow: {
          color: 'rgba(0, 0, 0, 0.45)',
          offsetX: 0,
          offsetY: 4,
          opacity: 0.35,
          width: 6,
        },
        dataLabels: {
          enabled: true,
          distance: 12,
          style: { color: '#cbd5e1', textOutline: 'none', fontSize: '10px' },
          formatter() {
            return this.percentage >= 4 ? `${this.point.name} ${this.percentage.toFixed(1)}%` : '';
          },
        },
      },
    },
    series: [{
      type: 'pie',
      data: allocationSlices,
    }],
  }), [allocationSlices]);

  const metricsBarOptions = useMemo(() => ({
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      height: 280,
      spacing: [6, 6, 6, 6],
      animation: true,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: {
      enabled: true,
      itemStyle: { color: '#94a3b8', fontSize: '10px' },
      itemHoverStyle: { color: '#e5e7eb' },
    },
    xAxis: {
      categories: ['Goal', 'Risk', 'Cash', 'Invested'],
      lineColor: '#1f1f1f',
      tickColor: '#1f1f1f',
      labels: { style: { color: '#94a3b8', fontSize: '10px' } },
    },
    yAxis: {
      min: 0,
      max: 100,
      title: { text: 'Score / Allocation %', style: { color: '#6b7280', fontSize: '10px' } },
      gridLineColor: '#1f1f1f',
      labels: {
        style: { color: '#6b7280', fontSize: '10px' },
        formatter() { return `${this.value}%`; },
      },
    },
    tooltip: {
      backgroundColor: '#0b0b0b',
      borderColor: '#1f1f1f',
      style: { color: '#e5e7eb' },
      pointFormat: '<b>{series.name}: {point.y:.1f}%</b>',
    },
    plotOptions: {
      series: {
        animation: { duration: 900 },
      },
      column: {
        borderWidth: 0,
        borderRadius: 6,
        dataLabels: {
          enabled: true,
          style: { color: '#e5e7eb', textOutline: 'none', fontSize: '10px' },
          formatter() { return `${this.y.toFixed(1)}%`; },
        },
      },
    },
    series: [
      {
        type: 'column',
        name: 'Current',
        data: [
          { y: goalProbability, color: goalColor },
          { y: riskScore, color: riskColor },
          { y: totalValue > 0 ? (cashBalance / totalValue) * 100 : 0, color: '#06b6d4' },
          { y: totalValue > 0 ? (investedNow / totalValue) * 100 : 0, color: '#6366f1' },
        ],
      },
      {
        type: 'line',
        name: 'Target',
        color: '#3b82f6',
        lineWidth: 1.5,
        marker: { enabled: true, radius: 3 },
        data: [70, 40, 30, 70],
      },
    ],
  }), [cashBalance, goalColor, goalProbability, investedNow, riskColor, riskScore, totalValue]);

  if (loading && !portfolio) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#060d18] text-gray-400" style={starfieldBaseStyle}>
        <div className="pointer-events-none absolute inset-0 opacity-70" style={starfieldDotsStyle} />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <RefreshCw size={16} className="mr-2 animate-spin" /> Loading portfolio...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-y-auto bg-[#060d18] text-[#f8fbff]" style={starfieldBaseStyle}>
      <div className="pointer-events-none absolute inset-0 opacity-70" style={starfieldDotsStyle} />
      <div className="relative z-10 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#f8fbff]">Portfolio</h2>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
            Paper Mode
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSplitViewEnabled((previous) => !previous)}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              splitViewEnabled
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                : 'border-[#1f1f1f] bg-[#0b0b0b] text-[#f8fbff] hover:text-[#ffffff]'
            }`}
            title={splitViewEnabled ? 'Switch back to full-width layout' : 'Split layout and show AI stock ideas'}
          >
            {splitViewEnabled ? 'Full Width' : 'Split View'}
          </button>
          <button
            onClick={() => setIdeaRefreshNonce((value) => value + 1)}
            disabled={!splitViewEnabled || aiIdeas.loading}
            className="inline-flex items-center gap-1 rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] px-3 py-1.5 text-xs text-[#f8fbff] hover:text-[#ffffff] disabled:cursor-not-allowed disabled:opacity-50"
            title="Refresh AI ideas"
          >
            <RefreshCw size={12} className={aiIdeas.loading ? 'animate-spin' : ''} /> Ideas
          </button>
          <button
            onClick={fetchPortfolio}
            className="inline-flex items-center gap-1 rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] px-3 py-1.5 text-xs text-[#f8fbff] hover:text-[#ffffff]"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div className={splitViewEnabled ? 'mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,56%)_minmax(340px,44%)]' : 'mt-3'}>
      <div className={splitViewEnabled ? 'min-w-0' : ''}>
      <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`${panelClass} p-3`}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Holdings</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f] text-[10px] uppercase tracking-[0.14em] text-gray-500">
                <th className="px-2 py-2 text-left">Symbol</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Avg</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">Value</th>
                <th className="px-2 py-2 text-right">P&L</th>
                <th className="px-2 py-2 text-right">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {holdingsSections.map((section, sectionIndex) => (
                <React.Fragment key={section.id}>
                  {sectionIndex > 0 ? (
                    <tr>
                      <td colSpan={7} className="border-t-2 border-[#334155] px-0 py-0" />
                    </tr>
                  ) : null}

                  <tr className="border-b border-[#1f1f1f] bg-[#0a0a0a]/35">
                    <td colSpan={7} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                      {section.label}
                    </td>
                  </tr>

                  {section.rows.length > 0 ? (
                    section.rows.map((position) => {
                      const pnl = Number(position?.pnl || 0);
                      const isProfit = pnl >= 0;
                      return (
                        <tr key={`${section.id}-${position.symbol}`} className="border-b border-[#1f1f1f]/60">
                          <td className="px-2 py-2 font-mono">${position.symbol}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtQty(position.quantity)}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtMoney(position.avg_cost_basis)}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtMoney(position.current_price)}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtMoney(position.market_value)}</td>
                          <td className={`px-2 py-2 text-right font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{fmtMoney(pnl)}
                          </td>
                          <td className={`px-2 py-2 text-right font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtPct(position.pnl_percent)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-b border-[#1f1f1f]/60">
                      <td colSpan={7} className="px-2 py-2 text-xs text-gray-500">
                        No {section.label.toLowerCase()}.
                      </td>
                    </tr>
                  )}

                  <tr className="border-b border-[#1f1f1f]/80 bg-[#0a0a0a]/30">
                    <td className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400" colSpan={4}>
                      {section.label} Totals
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[#f8fbff]">{fmtMoney(section.summary.value)}</td>
                    <td className={`px-2 py-2 text-right font-mono ${section.summary.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {section.summary.pnl >= 0 ? '+' : ''}{fmtMoney(section.summary.pnl)}
                    </td>
                    <td className={`px-2 py-2 text-right font-mono ${section.summary.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtPct(section.summary.pnlPct)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 border-t-2 border-[#334155] pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Strategy Trade Log</div>
          {strategyTrades.length > 0 ? (
            <div className="divide-y divide-[#1f1f1f]/60">
              {strategyTrades.slice(0, 12).map((trade, index) => {
                const side = String(trade?.side || '').toLowerCase();
                const qty = Number(trade?.shares ?? trade?.quantity ?? trade?.qty ?? 0);
                const price = Number(trade?.price || 0);
                const strategyId = String(trade?.strategyId || trade?.strategy || '').trim();
                return (
                  <div
                    key={trade?.id || `strategy-trade-${index}`}
                    className="flex items-center justify-between px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold uppercase tracking-[0.12em] ${side === 'buy' ? 'text-emerald-300' : 'text-red-300'}`}>
                        {side || 'trade'}
                      </span>
                      <span className="font-mono">${normalizeSymbol(trade?.symbol)}</span>
                      <span className="text-gray-500">x{fmtQty(qty)}</span>
                      {strategyId ? <span className="font-mono text-[10px] text-gray-400">{strategyId}</span> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[#f8fbff]">@ {fmtMoney(price)}</span>
                      <span className="text-gray-500">{formatTradeTime(trade?.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-2 py-1.5 text-xs text-gray-500">
              No AI strategy trades logged yet.
            </div>
          )}
        </div>

        <div className="mt-3 border-t-2 border-[#334155] pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Portfolio Value</span>
            <AnimatedMoney
              value={displaySummary.totalValue}
              className="font-mono text-sm text-[#f8fbff]"
              countKey={`portfolio-value-${displaySummary.totalValue}`}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Buying Power</span>
            <AnimatedMoney
              value={displaySummary.cashBalance}
              className="font-mono text-sm text-[#f8fbff]"
              countKey={`buying-power-${displaySummary.cashBalance}`}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Total P&L</span>
            <AnimatedMoney
              value={displaySummary.totalPnl}
              signed
              className={`font-mono text-sm ${displaySummary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
              countKey={`total-pnl-${displaySummary.totalPnl}`}
              duration={0.7}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Total P&L %</span>
            <AnimatedPercent
              value={displaySummary.totalPnlPct}
              className={`font-mono text-sm ${displaySummary.totalPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
              countKey={`total-pnl-pct-${displaySummary.totalPnlPct}`}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`${panelClass} p-3`}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Portfolio Performance</div>
        {performanceState.loading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
            Loading performance...
          </div>
        ) : performanceState.hasTradeHistory ? (
          <HighchartsReact highcharts={Highcharts} options={walletChartOptions} />
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
            Make your first trade to see performance
          </div>
        )}
        {performanceState.error ? (
          <div className="mt-2 text-xs text-red-300">{performanceState.error}</div>
        ) : null}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="grid grid-cols-1 gap-3 lg:grid-cols-2"
      >
        <div className={`${panelClass} p-3`}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Allocation View</div>
          <HighchartsReact highcharts={Highcharts} options={allocationPieOptions} />
        </div>
        <div className={`${panelClass} p-3`}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Portfolio Metrics</div>
          <HighchartsReact highcharts={Highcharts} options={metricsBarOptions} />
        </div>
      </motion.div>

      {Array.isArray(trades) && trades.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`${panelClass} p-3`}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Recent Trades</div>
          <div className="space-y-1">
            {trades.slice(0, 8).map((trade, index) => {
              const side = String(trade?.side || '').toLowerCase();
              const value = asTradeValue(trade);
              return (
                <div key={trade?.id || `${trade?.symbol || 'trade'}-${index}`} className="flex items-center justify-between rounded border border-[#1f1f1f] bg-[#0a0a0a] px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold uppercase tracking-[0.12em] ${side === 'buy' ? 'text-emerald-300' : 'text-red-300'}`}>
                      {side || 'trade'}
                    </span>
                    <span className="font-mono">${normalizeSymbol(trade?.symbol)}</span>
                    <span className="text-gray-500">x{fmtQty(trade?.quantity)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#f8fbff]">@ {fmtMoney(trade?.price)}</span>
                    <span className="font-mono text-[#f8fbff]">{fmtMoney(value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle size={14} /> {error}
        </div>
      ) : null}
      </div>
      </div>

      {splitViewEnabled ? (
        <motion.aside
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`${panelClass} min-w-0 p-3`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-500">AI Opportunity Radar</div>
              <div className="mt-1 text-[11px] text-gray-400">
                {aiIdeas.summary || 'Personalized ideas based on your current holdings and strategy exposure.'}
              </div>
              {aiIdeasUpdatedLabel ? (
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">Updated {aiIdeasUpdatedLabel}</div>
              ) : null}
            </div>
          </div>

          {aiIdeas.error ? (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
              {aiIdeas.error}
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            {aiIdeas.loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`ai-idea-loading-${index}`}
                  className="animate-pulse rounded-lg border border-[#1f1f1f] bg-[#0a0a0a]/60 px-2.5 py-2"
                >
                  <div className="h-3 w-20 rounded bg-white/10" />
                  <div className="mt-2 h-2.5 w-full rounded bg-white/5" />
                  <div className="mt-1 h-2.5 w-[70%] rounded bg-white/5" />
                </div>
              ))
            ) : aiIdeaRowsLive.map((idea, index) => {
              const change = Number(idea?.percentChange);
              const hasChange = Number.isFinite(change);
              const isGain = change >= 0;
              const price = Number(idea?.price);
              const hasPrice = Number.isFinite(price) && price > 0;
              const symbol = normalizeSymbol(idea?.symbol || '--');
              const isSelected = symbol ? selectedIdeaSet.has(symbol) : false;
              const selectable = symbol && symbol !== '--';

              return (
                <button
                  key={`portfolio-ai-idea-${idea?.symbol || index}`}
                  type="button"
                  disabled={!selectable}
                  onClick={() => handleToggleIdeaSymbol(symbol)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500/45 bg-blue-500/10'
                      : 'border-[#1f1f1f] bg-[#0a0a0a]/60 hover:border-[#334155]'
                  } ${!selectable ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm text-[#f8fbff]">${symbol || '--'}</div>
                        {isSelected ? <span className="text-[10px] uppercase tracking-[0.12em] text-blue-400/80">Selected</span> : null}
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-gray-400">
                        {String(idea?.rationale || 'Monitor this setup for momentum continuation and portfolio diversification.')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs text-[#f8fbff]">{hasPrice ? fmtMoney(price) : '—'}</div>
                      <div className={`font-mono text-xs ${hasChange ? (isGain ? 'text-emerald-400' : 'text-red-400') : 'text-gray-500'}`}>
                        {hasChange ? fmtPct(change) : 'n/a'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-[#1f1f1f] bg-[#0a0a0a]/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-500">Radar Watchlist Simulator</div>
                <div className="mt-1 text-[11px] text-gray-400">
                  Pick symbols, set fake capital, and run 3/6/9/12-month close-price what-if returns.
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-blue-300">
                {activeScenarioSymbols.length} tickers
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                Watchlist Name
                <input
                  value={scenarioNameInput}
                  onChange={(event) => setScenarioNameInput(event.target.value)}
                  placeholder="AI Radar Basket"
                  className="mt-1 w-full rounded-md border border-[#1f1f1f] bg-[#080808] px-2 py-1.5 text-sm text-[#f8fbff] outline-none transition focus:border-blue-500/50"
                  maxLength={40}
                />
              </label>
              <label className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                Total Capital (Paper)
                <input
                  value={scenarioCapitalInput}
                  onChange={(event) => setScenarioCapitalInput(event.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="100000"
                  className="mt-1 w-full rounded-md border border-[#1f1f1f] bg-[#080808] px-2 py-1.5 font-mono text-sm text-[#f8fbff] outline-none transition focus:border-blue-500/50"
                  inputMode="decimal"
                />
              </label>
            </div>

            <div className="mt-2 text-[11px] text-gray-400">
              Buy date auto-fills from each timeframe anchor (3/6/9/12 months back); weekend dates roll to the previous Friday close.
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCreateScenario}
                className="rounded-md border border-[#1f1f1f] bg-[#0b0b0b] px-2.5 py-1.5 text-xs text-[#f8fbff] transition hover:border-blue-500/40 hover:text-blue-300"
              >
                Save Watchlist
              </button>
              <button
                type="button"
                onClick={runWhatIfSimulation}
                disabled={whatIfLoading || activeScenarioSymbols.length === 0}
                className="rounded-md border border-blue-500/40 bg-blue-500/12 px-2.5 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {whatIfLoading ? 'Running...' : 'Run Simulation'}
              </button>
              {activeScenario ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveScenarioId('');
                    setWhatIfResults([]);
                  }}
                  className="rounded-md border border-[#1f1f1f] bg-[#0b0b0b] px-2.5 py-1.5 text-xs text-gray-300 transition hover:text-[#f8fbff]"
                >
                  Clear Loaded Watchlist
                </button>
              ) : null}
            </div>

            {portfolioScenarios.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Saved Watchlists</div>
                {portfolioScenarios.map((scenario) => {
                  const active = scenario.id === activeScenarioId;
                  return (
                    <div
                      key={scenario.id}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${
                        active ? 'border-blue-500/40 bg-blue-500/10' : 'border-[#1f1f1f] bg-[#080808]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectScenario(scenario.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-xs text-[#f8fbff]">{scenario.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {scenario.symbols.length} symbols · {fmtMoney(scenario.capital || STARTING_BALANCE, 0)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScenario(scenario.id)}
                        className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300 transition hover:bg-red-500/20"
                        title="Delete watchlist"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {WHAT_IF_TIMEFRAME_OPTIONS.map((months) => (
                <button
                  key={`what-if-months-${months}`}
                  type="button"
                  onClick={() => setSelectedWhatIfMonths(months)}
                  className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] transition ${
                    selectedWhatIfMonths === months
                      ? 'border-blue-500/40 bg-blue-500/14 text-blue-300'
                      : 'border-[#1f1f1f] bg-[#090909] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {months}M
                </button>
              ))}
            </div>

            {whatIfError ? (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
                {whatIfError}
              </div>
            ) : null}

            {whatIfLoading ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`what-if-loading-${index}`} className="animate-pulse rounded-md border border-[#1f1f1f] bg-[#080808] px-2.5 py-2">
                    <div className="h-3 w-24 rounded bg-white/10" />
                    <div className="mt-2 h-2.5 w-full rounded bg-white/5" />
                  </div>
                ))}
              </div>
            ) : null}

            {!whatIfLoading && whatIfResults.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {whatIfResultsLive.map((result) => {
                    const selected = Number(result.months) === Number(selectedWhatIfMonths);
                    const pnl = Number(result?.pnl || 0);
                    return (
                      <button
                        key={`what-if-card-${result.months}`}
                        type="button"
                        onClick={() => setSelectedWhatIfMonths(Number(result.months))}
                        className={`rounded-md border px-2 py-2 text-left ${
                          selected ? 'border-blue-500/40 bg-blue-500/10' : 'border-[#1f1f1f] bg-[#080808]'
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{result.months}M</div>
                        <div className={`mt-1 font-mono text-sm ${pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {fmtMoney(result.valueNow || 0)}
                        </div>
                        <div className="text-[10px] text-gray-500">Buy {result.targetDate || '—'}</div>
                      </button>
                    );
                  })}
                </div>

                {whatIfSelectedResult ? (
                  <div className="rounded-md border border-[#1f1f1f] bg-[#080808] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                          {whatIfSelectedResult.months}M Result · Buy {whatIfSelectedResult.targetDate || '—'}
                        </div>
                        <div className="mt-1 font-mono text-sm text-[#f8fbff]">
                          {fmtMoney(whatIfSelectedResult.valueNow || 0)}
                        </div>
                      </div>
                      <div className={`font-mono text-xs ${Number(whatIfSelectedResult?.pnl || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {fmtPct(whatIfSelectedResult?.pnlPct || 0)}
                      </div>
                    </div>

                    <div className="mt-2 overflow-x-auto rounded-md border border-[#1f1f1f]">
                      <table className="min-w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-[#1f1f1f] text-[10px] uppercase tracking-[0.14em] text-gray-500">
                            <th className="px-2 py-1.5 text-left">Symbol</th>
                            <th className="px-2 py-1.5 text-right" title="Closing price on the simulated buy date">Buy Price</th>
                            <th className="px-2 py-1.5 text-right">Now</th>
                            <th className="px-2 py-1.5 text-right">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {whatIfSelectedResult.rows.map((row) => (
                            <tr key={`what-if-row-${row.symbol}`} className="border-b border-[#121212] last:border-b-0">
                              <td className="px-2 py-1.5 font-mono text-[#f8fbff]">${normalizeSymbol(row.symbol)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-gray-300">{fmtMoney(row.entryClose)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-gray-300">{fmtMoney(row.currentPrice)}</td>
                              <td className={`px-2 py-1.5 text-right font-mono ${Number(row.pct || row.pnlPct || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                {fmtPct(row.pct || row.pnlPct || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {whatIfGeneratedLabel ? (
                      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">Updated {whatIfGeneratedLabel}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
      </div>
      </div>
    </div>
  );
}
