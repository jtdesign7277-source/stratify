import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import useWatchlistSync from '../../hooks/useWatchlistSync';
import useStrategySync from '../../hooks/useStrategySync';
import useDashboardStateSync from '../../hooks/useDashboardStateSync';
import useSubscription from '../../hooks/useSubscription';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import TopMetricsBar from './TopMetricsBar';
import LiveAlertsTicker from './LiveAlertsTicker';
import DataTable from './DataTable';
import RightPanel from './RightPanel';
import SophiaPanel from './SophiaPanel';
import StrategyOutput from './StrategyOutput';
import StatusBar from './StatusBar';
import TerminalPanel from './TerminalPanel';
import ArbitragePanel from './ArbitragePanel';
import StockDetailView from './StockDetailView';
import NewsletterModal from './NewsletterModal';
import BrokerConnectModal from './BrokerConnectModal';
import NewsletterPage from './NewsletterPage';
import MarketIntelPage from './MarketIntelPage';
import SophiaCopilot from './SophiaCopilot';
import WarRoom from './WarRoom';
import SettingsPage from './SettingsPage';
import TerminalStrategyWorkspace from './TerminalStrategyWorkspace';
import ProGate from '../ProGate';
import CollapsiblePanel, { PanelDivider } from './CollapsiblePanel';
import BacktestWizard from './BacktestWizard';
import AIChat from './AIChat';
import StratifyChat from './StratifyChat';
import WatchlistPage from './WatchlistPage';
import MarketsPage from './MarketsPage';
import LSEPage from './LSEPage';
import PortfolioPage from './PortfolioPage';
import HistoryPage from './HistoryPage';
import AnalyticsPage from './AnalyticsPage';
import AdvancedChartsPage from './AdvancedChartsPage';
import TradePage from './TradePage';
import MoreInfoPage from './MoreInfoPage';
import DemoPanel from './DemoPanel';
import StrategyTemplateFlow from './StrategyTemplateFlow';
import ActiveTrades from './ActiveTrades';
import ChallengeLeaderboard from './ChallengeLeaderboard';
import TrendScanner from './TrendScanner';
import FloatingGrokChat from './FloatingGrokChat';
import CryptoPage from './CryptoPage';
import OptionsPage from './OptionsPage';
// Sophia strategy state managed here
import TickerPill from './TickerPill';
import MiniGamePill from '../shared/MiniGamePill';
import FredPage from './FredPage';
import EarningsAlert from './EarningsAlert';
import { useTradeHistory as useTradeHistoryStore } from '../../store/StratifyProvider';
import UpgradePrompt from '../UpgradePrompt';
import { getMarketStatus, getNextMarketOpen, isMarketOpen } from '../../lib/marketHours';

const loadDashboardState = () => {
  try {
    const saved = localStorage.getItem('stratify-dashboard-state');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveDashboardState = (state) => {
  localStorage.setItem('stratify-dashboard-state', JSON.stringify(state));
};

const SIDEBAR_SEEN_KEY = 'stratify-sidebar-seen';
const SIDEBAR_EXPANDED_KEY = 'stratify-sidebar-expanded';

const getInitialSidebarExpanded = (savedState) => {
  try {
    const hasSeenSidebar = localStorage.getItem(SIDEBAR_SEEN_KEY);
    if (!hasSeenSidebar) return true;

    const savedExpanded = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (savedExpanded === 'true') return true;
    if (savedExpanded === 'false') return false;
  } catch {
    return true;
  }

  if (typeof savedState?.sidebarExpanded === 'boolean') {
    return savedState.sidebarExpanded;
  }

  return false;
};

const FREE_STRATEGY_LIMIT = 3;
const PRO_PRICE_ID = 'price_1T0jBTRdPxQfs9UeRln3Uj68';
const PAPER_TRADING_BALANCE = 100000;
const MIN_STRATEGY_ALLOCATION = 100;
const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';
const HIDDEN_TABS = new Set(['predictions']);
const REAL_TRADE_ANALYSIS_REGEX = /real\s+trade\s+analysis/i;
const KEY_SETUPS_IDENTIFIED_REGEX = /key[\w\s\[\]-]*setups\s+identified/i;
const REAL_TRADE_ANALYSIS_TEMPLATE = [
  '## ⚡ Real Trade Analysis (1M Lookbook)',
  '',
  '**Key Setups Identified:**',
  '',
  '**🏆 Winner - [Date] [Setup]:**',
  '- **Entry:** $[price] at [time] ([reason])',
  '- **Exit:** $[price] ([result])',
  '- **Shares:** [count] shares',
  '- **Profit:** +$[amount] ✅',
].join('\n');

const ensureRealTradeAnalysisSection = (content) => {
  const normalized = String(content || '').trim();
  if (!normalized) return REAL_TRADE_ANALYSIS_TEMPLATE;
  if (REAL_TRADE_ANALYSIS_REGEX.test(normalized) || KEY_SETUPS_IDENTIFIED_REGEX.test(normalized)) {
    return normalized;
  }
  return `${normalized}\n\n${REAL_TRADE_ANALYSIS_TEMPLATE}`;
};

const sanitizeActiveTab = (tab, fallback = 'war-room') => {
  const normalized = String(tab || '').trim();
  if (normalized === 'builder') return 'terminal';
  if (normalized === 'strategies') return 'terminal';
  if (normalized === 'home') return 'war-room';
  if (!normalized || HIDDEN_TABS.has(normalized)) return fallback;
  return normalized;
};

const normalizeStrategyIdentity = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return null;

  if (strategy.id !== null && strategy.id !== undefined && String(strategy.id).trim()) {
    return `id:${String(strategy.id).trim()}`;
  }

  const name = String(strategy.name || '').trim().toLowerCase();
  if (!name) return null;

  const tickerSource = strategy.ticker || strategy.symbol || strategy.asset || strategy.tickers;
  const ticker = Array.isArray(tickerSource)
    ? tickerSource.join(',').trim().toLowerCase()
    : String(tickerSource || '').trim().toLowerCase();

  return `name:${name}|ticker:${ticker}`;
};

const buildStrategyIdentitySet = (...strategyLists) => {
  const identities = new Set();

  strategyLists.forEach((list) => {
    if (!Array.isArray(list)) return;

    list.forEach((strategy) => {
      const identity = normalizeStrategyIdentity(strategy);
      if (identity) identities.add(identity);
    });
  });

  return identities;
};

const formatDuration = (startedAt, now = Date.now()) => {
  const safeStart = Number(startedAt);
  if (!Number.isFinite(safeStart) || safeStart <= 0) return '0m';

  const elapsedMs = Math.max(0, now - safeStart);
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const resolveStrategySymbol = (strategy) => {
  const symbolCandidate = strategy?.symbol
    || strategy?.ticker
    || strategy?.asset
    || strategy?.tickers?.[0]
    || strategy?.symbols?.[0];

  if (!symbolCandidate) return 'SPY';
  return String(symbolCandidate).replace(/\$/g, '').split(',')[0].trim().toUpperCase();
};

const resolveStrategyType = (strategy) => {
  return String(
    strategy?.type
    || strategy?.strategyType
    || strategy?.templateId
    || strategy?.category
    || 'Custom',
  );
};

const isLikelyCryptoSymbol = (symbol = '') => {
  const normalized = String(symbol).trim().toUpperCase();
  if (!normalized) return false;
  if (normalized.includes('-USD') || normalized.includes('/USD')) return true;
  return ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK'].includes(normalized);
};

const isEquityStrategy = (strategy) => {
  const explicitAssetClass = String(strategy?.assetClass || strategy?.market || '').toLowerCase();
  if (explicitAssetClass.includes('crypto')) return false;
  if (explicitAssetClass.includes('equity') || explicitAssetClass.includes('stock')) return true;

  const type = String(strategy?.type || strategy?.strategyType || '').toLowerCase();
  if (type.includes('crypto')) return false;

  const symbol = resolveStrategySymbol(strategy);
  return !isLikelyCryptoSymbol(symbol);
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const fallback = Number(cleaned);
    if (Number.isFinite(fallback)) return fallback;
  }

  return null;
};

const formatCurrency = (value = 0) => {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const resolveBacktestAmount = (strategy) => {
  const candidates = [
    strategy?.backtestAmount,
    strategy?.capital,
    strategy?.initialCapital,
    strategy?.backtest?.capital,
    strategy?.backtestResults?.capital,
  ];

  for (const candidate of candidates) {
    const parsed = toNumberOrNull(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return null;
};

const getStrategyUnrealizedPnL = (strategy) => {
  const explicit = toNumberOrNull(strategy?.paper?.unrealizedPnl)
    ?? toNumberOrNull(strategy?.paper?.unrealizedPL)
    ?? toNumberOrNull(strategy?.unrealizedPnl)
    ?? toNumberOrNull(strategy?.unrealizedPL);
  if (explicit !== null) return explicit;
  return toNumberOrNull(strategy?.paper?.pnl)
    ?? toNumberOrNull(strategy?.pnl)
    ?? 0;
};

const getStrategyDailyPnL = (strategy) => {
  const explicit = toNumberOrNull(strategy?.paper?.dailyPnl)
    ?? toNumberOrNull(strategy?.paper?.dailyPL)
    ?? toNumberOrNull(strategy?.dailyPnl)
    ?? toNumberOrNull(strategy?.dailyPnL);
  if (explicit !== null) return explicit;
  return getStrategyUnrealizedPnL(strategy);
};

const calculateTotalUnrealizedPnL = (strategies = []) => strategies.reduce(
  (sum, strategy) => sum + getStrategyUnrealizedPnL(strategy),
  0,
);

const calculateTotalDailyPnL = (strategies = []) => strategies.reduce(
  (sum, strategy) => sum + getStrategyDailyPnL(strategy),
  0,
);

const calculateTotalAllocated = (strategies = [], accountBalance = PAPER_TRADING_BALANCE) => strategies.reduce(
  (sum, strategy) => sum + getStrategyAllocation(strategy, accountBalance),
  0,
);

const calculateRemainingBuyingPower = (maxAllocation = 0, allocationInput = '') => {
  const parsed = Number(sanitizeCurrencyInput(allocationInput));
  if (!Number.isFinite(parsed)) return Math.max(0, Number(maxAllocation) || 0);
  return Math.max(0, (Number(maxAllocation) || 0) - parsed);
};

const sanitizeCurrencyInput = (value) => String(value || '').replace(/[^0-9.]/g, '');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseAllocationCandidate = (raw, accountBalance = PAPER_TRADING_BALANCE) => {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    if (raw <= 1) return accountBalance * raw;
    if (raw <= 100) return accountBalance * (raw / 100);
    return Math.min(raw, accountBalance);
  }

  const text = String(raw).trim();
  if (!text || text === '—' || text === '-' || text === '–') return null;

  if (text.endsWith('%')) {
    const pct = Number(text.replace('%', '').trim());
    if (Number.isFinite(pct) && pct > 0) {
      return accountBalance * (pct / 100);
    }
  }

  const numeric = Number(text.replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric <= 1) return accountBalance * numeric;
    if (numeric <= 100) return accountBalance * (numeric / 100);
    return Math.min(numeric, accountBalance);
  }

  return null;
};

const resolveStrategyAllocationPreference = (strategy, accountBalance = PAPER_TRADING_BALANCE) => {
  const candidates = [
    strategy?.allocation,
    strategy?.keyTradeSetups?.allocation,
    strategy?.summary?.allocation,
    strategy?.summary?.keyTradeSetups?.allocation,
    strategy?.key_trade_setups?.allocation,
    strategy?.rules?.key_trade_setups?.allocation,
    strategy?.positionSize,
    strategy?.size,
  ];

  for (const candidate of candidates) {
    const parsed = parseAllocationCandidate(candidate, accountBalance);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return null;
};

const parsePositionAllocation = (strategy, accountBalance = PAPER_TRADING_BALANCE) => {
  const raw = strategy?.allocation
    ?? strategy?.positionSize
    ?? strategy?.size
    ?? strategy?.backtestAmount
    ?? strategy?.capital
    ?? null;
  const parsed = parseAllocationCandidate(raw, accountBalance);
  if (parsed !== null && parsed > 0) return parsed;
  return Math.min(accountBalance * 0.1, accountBalance);
};

const extractQuotePrice = (quote) => {
  if (!quote || typeof quote !== 'object') return null;
  const candidates = [
    quote.latestPrice,
    quote.price,
    quote.last,
    quote.lastPrice,
    quote.regularMarketPrice,
    quote.ask,
    quote.bid,
  ];
  for (const candidate of candidates) {
    const parsed = toNumberOrNull(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
};

const buildRuntimeStatus = ({ isEquity, marketOpen, pausedReason }) => {
  if (!isEquity) {
    if (pausedReason === 'user') {
      return { status: 'paused', runStatus: 'paused', statusLabel: 'Paused' };
    }
    return { status: 'active', runStatus: 'running', statusLabel: 'Active' };
  }

  if (!marketOpen && pausedReason !== 'user') {
    return {
      status: 'paused',
      runStatus: 'paused',
      pausedReason: 'market_closed',
      statusLabel: 'Paused - Market Closed',
    };
  }

  if (pausedReason === 'user') {
    return { status: 'paused', runStatus: 'paused', pausedReason: 'user', statusLabel: 'Paused' };
  }

  return { status: 'active', runStatus: 'running', pausedReason: null, statusLabel: 'Active' };
};

const getStrategyAllocation = (strategy, accountBalance = PAPER_TRADING_BALANCE) => {
  const explicit = toNumberOrNull(strategy?.paper?.allocation)
    ?? toNumberOrNull(strategy?.allocation);
  if (explicit !== null && explicit > 0) return explicit;
  return parsePositionAllocation(strategy, accountBalance);
};

const isActiveOrPausedStrategy = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return false;
  const status = String(strategy.status || '').toLowerCase();
  const runStatus = String(strategy.runStatus || '').toLowerCase();
  if (!status && !runStatus) return true;
  return status === 'active'
    || status === 'paused'
    || status === 'deployed'
    || status === 'running'
    || runStatus === 'running'
    || runStatus === 'paused';
};

const hasBrokerAccountData = (data) => {
  const account = data?.account;
  if (!account || typeof account !== 'object') return false;

  const identityCandidates = [
    account.account_number,
    account.accountNumber,
    account.id,
    account.uuid,
    account.broker_id,
    account.brokerId,
  ];

  if (identityCandidates.some((value) => String(value || '').trim())) {
    return true;
  }

  const status = String(account.status || '').toLowerCase();
  return ['active', 'connected', 'approved', 'open'].includes(status);
};

export default function Dashboard({
  setCurrentPage,
  alpacaData,
  isLiveScoresOpen = false,
  onToggleLiveScores = () => {},
  liveScoresUnread = false,
}) {
  const savedState = loadDashboardState();
  
  const [sidebarExpanded, setSidebarExpanded] = useState(() => getInitialSidebarExpanded(savedState));
  const [rightPanelWidth, setRightPanelWidth] = useState(savedState?.rightPanelWidth ?? 320);
  const [activeTab, setActiveTab] = useState(() => sanitizeActiveTab(savedState?.activeTab));
  const [activeSection, setActiveSection] = useState(savedState?.activeSection ?? 'watchlist');
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState(savedState?.theme ?? 'dark');
  const [paperTradingBalance, setPaperTradingBalance] = useState(savedState?.paperTradingBalance ?? PAPER_TRADING_BALANCE);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    if (activeTab === 'builder' || activeTab === 'strategies') {
      setActiveTab('terminal');
    }
  }, [activeTab]);
  
  // Terminal backtest state
  const [terminalBacktestResults, setTerminalBacktestResults] = useState(null);
  const [terminalStrategy, setTerminalStrategy] = useState({});
  const [terminalTicker, setTerminalTicker] = useState('TSLA');
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);

  // Panel expanded states - single source of truth
  const [panelStates, setPanelStates] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-panel-states');
      return saved ? JSON.parse(saved) : {
        strategyBuilder: true,
        arbitrageScanner: true,
        deployedStrategies: true,
      };
    } catch {
      return { strategyBuilder: true, arbitrageScanner: true, deployedStrategies: true };
    }
  });

  // Persist panel states
  useEffect(() => {
    localStorage.setItem('stratify-panel-states', JSON.stringify(panelStates));
  }, [panelStates]);

  // Toggle panel expanded state
  const togglePanel = useCallback((panelId) => {
    setPanelStates(prev => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  }, []);
  
  const { user } = useAuth();
  const { subscriptionStatus, loading: subscriptionLoading } = useSubscription();
  const { trades, addTrade } = useTradeHistoryStore();
  const { watchlist, addToWatchlist, removeFromWatchlist, reorderWatchlist, pinToTop } = useWatchlistSync(user);
  const {
    strategies,
    setStrategies,
    savedStrategies,
    setSavedStrategies,
    deployedStrategies,
    setDeployedStrategies,
  } = useStrategySync(user);
  
  // Mini pills (slots 1-5)
  const [miniTickers, setMiniTickers] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-mini-tickers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [pinnedGames, setPinnedGames] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-pinned-games');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  // Save mini tickers to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-mini-tickers', JSON.stringify(miniTickers));
  }, [miniTickers]);

  useEffect(() => {
    localStorage.setItem('stratify-pinned-games', JSON.stringify(pinnedGames));
  }, [pinnedGames]);
  
  // Handle dropping a ticker onto a pill slot
  const handleTickerDrop = (symbol, slotIndex) => {
    if (slotIndex < 1) return;
    const tickerIndex = slotIndex - 1; // Map to miniTickers array (slots 1-5 → indices 0-4)
    setPinnedGames(prev => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    setMiniTickers(prev => {
      const newTickers = [...prev];
      // Remove if already exists elsewhere
      const existingIndex = newTickers.indexOf(symbol);
      if (existingIndex !== -1) newTickers.splice(existingIndex, 1);
      // Add to new slot (max 5 tickers now)
      while (newTickers.length < tickerIndex) newTickers.push(null);
      newTickers[tickerIndex] = symbol;
      return newTickers.slice(0, 5);
    });
  };

  const handleGameDrop = (game, slotIndex) => {
    if (slotIndex < 1) return;
    setPinnedGames(prev => {
      const next = [...prev];
      const existingIndex = next.findIndex(g => g?.id === game?.id);
      if (existingIndex !== -1) next[existingIndex] = null;
      next[slotIndex] = game;
      return next;
    });
    setMiniTickers(prev => {
      const next = [...prev];
      const tickerIndex = slotIndex - 2;
      if (tickerIndex >= 0) next[tickerIndex] = null;
      return next;
    });
  };

  const handleRemovePinnedGame = (slotIndex) => {
    setPinnedGames(prev => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };
  
  // Remove ticker from pill
  const handleRemoveMiniTicker = (symbol) => {
    setMiniTickers(prev => prev.filter(t => t !== symbol));
  };
  
  const [selectedStock, setSelectedStock] = useState(null);
  const [showStrategyLimitModal, setShowStrategyLimitModal] = useState(false);
  const [demoState, setDemoState] = useState('idle');
  const [autoBacktestStrategy, setAutoBacktestStrategy] = useState(null);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [showMarketIntel, setShowMarketIntel] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [connectedBrokers, setConnectedBrokers] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-connected-brokers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isGrokPanelCollapsed, setIsGrokPanelCollapsed] = useState(false);
  const [isFloatingGrokOpen, setIsFloatingGrokOpen] = useState(false);
  const [sophiaStrategy, setSophiaStrategy] = useState(null);
  const [sophiaWizardPrompt, setSophiaWizardPrompt] = useState(null);
  const [isSophiaThinking, setIsSophiaThinking] = useState(false);
  const [currentMarketStatus, setCurrentMarketStatus] = useState(() => getMarketStatus());
  const [nextMarketOpenAt, setNextMarketOpenAt] = useState(() => getNextMarketOpen());
  const [allocationPrompt, setAllocationPrompt] = useState(null);
  const deployedStrategiesRef = useRef(deployedStrategies);
  const allocationResolverRef = useRef(null);

  const isPaidTier = subscriptionStatus === 'pro' || subscriptionStatus === 'elite';
  const hasConnectedBroker = useMemo(
    () => connectedBrokers.length > 0 || hasBrokerAccountData(alpacaData),
    [connectedBrokers, alpacaData],
  );
  const isPaperTradingMode = useMemo(() => {
    if (hasConnectedBroker) return false;
    if (subscriptionLoading) return false;
    return !isPaidTier;
  }, [hasConnectedBroker, isPaidTier, subscriptionLoading]);
  const strategyIdentitySet = useMemo(
    () => buildStrategyIdentitySet(strategies, savedStrategies, deployedStrategies),
    [strategies, savedStrategies, deployedStrategies],
  );
  const activeStrategyIdentitySet = useMemo(
    () => buildStrategyIdentitySet(deployedStrategies),
    [deployedStrategies],
  );
  const topBarStrategies = useMemo(
    () => deployedStrategies.filter(isActiveOrPausedStrategy),
    [deployedStrategies],
  );
  const normalizedPaperTradingBalance = useMemo(
    () => Math.max(0, toNumberOrNull(paperTradingBalance) ?? PAPER_TRADING_BALANCE),
    [paperTradingBalance],
  );
  const activeStrategiesCount = deployedStrategies.length;
  const totalAllocatedBalance = useMemo(
    () => calculateTotalAllocated(topBarStrategies, normalizedPaperTradingBalance),
    [topBarStrategies, normalizedPaperTradingBalance],
  );
  const availablePaperBalance = useMemo(
    () => Math.max(0, normalizedPaperTradingBalance - totalAllocatedBalance),
    [normalizedPaperTradingBalance, totalAllocatedBalance],
  );
  const totalTopBarUnrealizedPnL = useMemo(
    () => calculateTotalUnrealizedPnL(topBarStrategies),
    [topBarStrategies],
  );
  const totalTopBarDailyPnL = useMemo(
    () => calculateTotalDailyPnL(topBarStrategies),
    [topBarStrategies],
  );

  const hydrateDashboardState = useCallback((state) => {
    if (!state || typeof state !== 'object') return;
    if (typeof state.sidebarExpanded === 'boolean') setSidebarExpanded(state.sidebarExpanded);
    if (Number.isFinite(Number(state.rightPanelWidth))) setRightPanelWidth(Number(state.rightPanelWidth));
    if (state.activeTab) setActiveTab(sanitizeActiveTab(state.activeTab));
    if (state.activeSection) setActiveSection(String(state.activeSection));
    if (state.theme === 'dark' || state.theme === 'light') setTheme(state.theme);
    if (Array.isArray(state.connectedBrokers)) {
      setConnectedBrokers(state.connectedBrokers.filter((broker) => broker && typeof broker === 'object'));
    }
    const nextPaperBalance = toNumberOrNull(state.paperTradingBalance);
    if (nextPaperBalance !== null && nextPaperBalance >= 0) {
      setPaperTradingBalance(nextPaperBalance);
    }
  }, []);

  const dashboardSyncState = useMemo(() => ({
    sidebarExpanded,
    rightPanelWidth,
    activeTab,
    activeSection,
    theme,
    paperTradingBalance,
    connectedBrokers,
  }), [sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme, paperTradingBalance, connectedBrokers]);

  useDashboardStateSync(user, dashboardSyncState, hydrateDashboardState);

  const canCreateStrategy = useCallback(
    (candidateStrategy) => {
      const candidateIdentity = normalizeStrategyIdentity(candidateStrategy);
      if (candidateIdentity && strategyIdentitySet.has(candidateIdentity)) {
        return true;
      }
      return true;
    },
    [strategyIdentitySet],
  );

  const canActivateStrategy = useCallback(
    (candidateStrategy) => {
      const candidateIdentity = normalizeStrategyIdentity(candidateStrategy);
      if (candidateIdentity && activeStrategyIdentitySet.has(candidateIdentity)) {
        return true;
      }

      if (isPaidTier) return true;

      if (activeStrategiesCount >= FREE_STRATEGY_LIMIT) {
        setShowStrategyLimitModal(true);
        return false;
      }

      return true;
    },
    [isPaidTier, activeStrategiesCount, activeStrategyIdentitySet],
  );
  
  // Collapse Grok panel when on templates page
  useEffect(() => {
    if (activeTab === 'templates') {
      setIsGrokPanelCollapsed(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'predictions') {
      setActiveTab('trade');
    }
  }, [activeTab]);
  const [grokMessageCount, setGrokMessageCount] = useState(0);


  const handleStrategyGenerated = (strategy) => {
    if (!canCreateStrategy(strategy)) return;

    setStrategies(prev => {
      if (prev.some(s => s.name === strategy.name)) return prev;
      return [...prev, { ...strategy, status: 'draft' }];
    });
  };

  const handleStrategyAdded = (strategy) => {
    setActiveTab('terminal');
    setTimeout(() => {
      setAutoBacktestStrategy(strategy);
    }, 800);
  };

  const handleDeleteStrategy = useCallback((strategyId) => {
    const targetId = String(strategyId);
    setStrategies(prev => prev.filter(s => String(s.id) !== targetId));
    setSavedStrategies(prev => prev.filter(s => String(s.id) !== targetId));
    setDeployedStrategies(prev => prev.filter(s => String(s.id) !== targetId));
  }, [setDeployedStrategies, setSavedStrategies, setStrategies]);

  const handleClearAllStrategies = useCallback(() => {
    setStrategies([]);
    setSavedStrategies([]);
    setDeployedStrategies([]);
  }, [setDeployedStrategies, setSavedStrategies, setStrategies]);

  const handleEditStrategy = (strategy) => {
    setEditingStrategy(strategy);
  };

  const handleUpdateStrategy = (strategyId, updates) => {
    setStrategies(prev => prev.map(s => 
      s.id === strategyId 
        ? { ...s, ...updates, metrics: updates.metrics || s.metrics }
        : s
    ));
  };

  const handleSaveToSidebar = (strategy) => {
    if (!canCreateStrategy(strategy)) return;

    setSavedStrategies(prev => {
      if (prev.some(s => s.id === strategy.id)) return prev;
      const maxDrawdown = parseFloat(strategy.metrics?.maxDrawdown) || 15;
      let riskLevel = 'medium';
      if (maxDrawdown <= 10) riskLevel = 'low';
      else if (maxDrawdown >= 18) riskLevel = 'high';
      return [...prev, { ...strategy, savedAt: Date.now(), riskLevel }];
    });
  };

  const handleRemoveSavedStrategy = (strategyId) => {
    setSavedStrategies(prev => prev.filter(s => s.id !== strategyId));
  };

  const handleSelectTemplate = (template) => {
    if (!template) return;
    const winRate = parseFloat(template.metrics?.winRate) || 0;
    const templateStrategy = {
      id: template.id,
      name: template.name,
      type: template.category || 'Template',
      status: 'draft',
      winRate,
      trades: 0,
      pnl: 0,
      description: template.description,
      folderId: 'stratify-templates',
      templateId: template.id,
      source: 'template',
      savedAt: Date.now(),
    };

    if (!canCreateStrategy(templateStrategy)) return;

    setSavedStrategies(prev => {
      const existing = prev.find(s => s.id === templateStrategy.id);
      if (existing) {
        return prev.map(s =>
          s.id === templateStrategy.id
            ? { ...templateStrategy, ...s, folderId: 'stratify-templates' }
            : s
        );
      }
      return [...prev, templateStrategy];
    });

    setActiveTab('terminal');
  };

  const fetchQuoteForSymbol = useCallback(async (symbol) => {
    if (!symbol) return null;
    const normalized = String(symbol).trim().toUpperCase();
    if (!normalized) return null;

    const endpoints = [
      `${API_URL}/api/public/quote/${encodeURIComponent(normalized)}`,
      `/api/quote?symbol=${encodeURIComponent(normalized)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) continue;
        const data = await response.json();
        const price = extractQuotePrice(data);
        if (price !== null) return { ...data, price };
      } catch {
        // Ignore endpoint failure and keep trying.
      }
    }

    return null;
  }, []);

  const fetchQuoteMap = useCallback(async (symbols = []) => {
    const uniqueSymbols = [...new Set(symbols.filter(Boolean).map((symbol) => String(symbol).toUpperCase()))];
    if (uniqueSymbols.length === 0) return {};

    try {
      const query = encodeURIComponent(uniqueSymbols.join(','));
      const response = await fetch(`${API_URL}/api/public/quotes?symbols=${query}`);
      if (response.ok) {
        const snapshots = await response.json();
        if (Array.isArray(snapshots)) {
          return snapshots.reduce((acc, snapshot) => {
            const symbol = String(snapshot?.symbol || '').toUpperCase();
            if (symbol) acc[symbol] = snapshot;
            return acc;
          }, {});
        }
      }
    } catch {
      // Fall back to one-by-one requests.
    }

    const entries = await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        const quote = await fetchQuoteForSymbol(symbol);
        return [symbol, quote];
      }),
    );

    return entries.reduce((acc, [symbol, quote]) => {
      if (quote) acc[symbol] = quote;
      return acc;
    }, {});
  }, [fetchQuoteForSymbol]);

  const getRemainingAllocationCapacity = useCallback((excludeStrategy = null) => {
    const excludeId = excludeStrategy?.id !== undefined && excludeStrategy?.id !== null
      ? String(excludeStrategy.id)
      : null;
    const excludeIdentity = normalizeStrategyIdentity(excludeStrategy);

    const allocatedElsewhere = deployedStrategiesRef.current.reduce((sum, strategy) => {
      const sameId = excludeId && strategy?.id !== undefined && strategy?.id !== null
        ? String(strategy.id) === excludeId
        : false;
      const sameIdentity = excludeIdentity && normalizeStrategyIdentity(strategy) === excludeIdentity;
      if (sameId || sameIdentity) return sum;
      return sum + getStrategyAllocation(strategy, normalizedPaperTradingBalance);
    }, 0);

    return Math.max(0, normalizedPaperTradingBalance - allocatedElsewhere);
  }, [normalizedPaperTradingBalance]);

  const resolveAllocationPrompt = useCallback((value = null) => {
    const resolver = allocationResolverRef.current;
    allocationResolverRef.current = null;
    setAllocationPrompt(null);
    if (resolver) resolver(value);
  }, []);

  const requestStrategyAllocation = useCallback(async ({
    strategy,
    maxAllocation,
    suggestedAllocation = null,
    backtestAmount = null,
  }) => {
    const cap = Math.max(0, Number(maxAllocation) || 0);
    if (cap < MIN_STRATEGY_ALLOCATION) {
      window.alert(
        `Insufficient available paper balance. Minimum allocation is ${formatCurrency(MIN_STRATEGY_ALLOCATION)}.`,
      );
      return null;
    }

    const resolvedBacktestAmount = toNumberOrNull(backtestAmount)
      ?? resolveBacktestAmount(strategy);
    const initial = clamp(
      toNumberOrNull(suggestedAllocation) ?? resolvedBacktestAmount ?? Math.min(10000, cap),
      MIN_STRATEGY_ALLOCATION,
      cap,
    );

    return new Promise((resolve) => {
      allocationResolverRef.current = resolve;
      setAllocationPrompt({
        strategyName: strategy?.name || `${resolveStrategySymbol(strategy)} Strategy`,
        symbol: resolveStrategySymbol(strategy),
        minAllocation: MIN_STRATEGY_ALLOCATION,
        maxAllocation: cap,
        backtestAmount: resolvedBacktestAmount !== null ? Math.max(0, Math.round(resolvedBacktestAmount)) : null,
        value: String(Math.round(initial)),
        error: '',
      });
    });
  }, []);

  const handleAllocationPromptConfirm = useCallback(() => {
    if (!allocationPrompt) return;

    const parsed = Number(sanitizeCurrencyInput(allocationPrompt.value));
    if (!Number.isFinite(parsed)) {
      setAllocationPrompt((prev) => (
        prev ? { ...prev, error: 'Enter a valid dollar amount.' } : prev
      ));
      return;
    }

    const rounded = Math.round(parsed);
    if (rounded < MIN_STRATEGY_ALLOCATION) {
      setAllocationPrompt((prev) => (
        prev ? { ...prev, error: `Minimum allocation is ${formatCurrency(MIN_STRATEGY_ALLOCATION)}.` } : prev
      ));
      return;
    }

    if (rounded > allocationPrompt.maxAllocation) {
      setAllocationPrompt((prev) => (
        prev ? { ...prev, error: `Maximum available is ${formatCurrency(allocationPrompt.maxAllocation)}.` } : prev
      ));
      return;
    }

    resolveAllocationPrompt(rounded);
  }, [allocationPrompt, resolveAllocationPrompt]);

  useEffect(() => () => {
    if (allocationResolverRef.current) {
      allocationResolverRef.current(null);
      allocationResolverRef.current = null;
    }
  }, []);

  const buildActivatedStrategy = useCallback(async (strategy, existingStrategy = null, allocationOverride = null) => {
    const now = Date.now();
    const symbol = resolveStrategySymbol(strategy);
    const equity = isEquityStrategy(strategy);
    const marketOpenNow = equity ? isMarketOpen() : true;
    const marketStatus = equity ? getMarketStatus() : 'Open';
    const quote = await fetchQuoteForSymbol(symbol);
    const quotePrice = extractQuotePrice(quote);

    const allocation = clamp(
      toNumberOrNull(allocationOverride)
        ?? toNumberOrNull(existingStrategy?.paper?.allocation)
        ?? resolveStrategyAllocationPreference(strategy, normalizedPaperTradingBalance)
        ?? resolveBacktestAmount(strategy)
        ?? parsePositionAllocation(strategy, normalizedPaperTradingBalance),
      MIN_STRATEGY_ALLOCATION,
      normalizedPaperTradingBalance,
    );
    const entryPrice = toNumberOrNull(existingStrategy?.paper?.entryPrice)
      ?? quotePrice
      ?? 0;
    const quantity = toNumberOrNull(existingStrategy?.paper?.quantity)
      ?? (entryPrice > 0 ? Math.max(1, Math.floor(allocation / entryPrice)) : 1);
    const runtimeStatus = buildRuntimeStatus({
      isEquity: equity,
      marketOpen: marketOpenNow,
      pausedReason: existingStrategy?.pausedReason === 'user' ? 'user' : null,
    });

    const paper = {
      balanceStart: toNumberOrNull(existingStrategy?.paper?.balanceStart) ?? normalizedPaperTradingBalance,
      provider: 'alpaca-paper',
      allocation,
      quantity,
      entryPrice,
      lastPrice: quotePrice ?? toNumberOrNull(existingStrategy?.paper?.lastPrice) ?? entryPrice,
      pnl: 0,
      pnlPercent: 0,
      unrealizedPnl: 0,
      dailyPnl: 0,
      updatedAt: now,
    };

    const lastPrice = toNumberOrNull(paper.lastPrice) ?? entryPrice;
    const pnl = quantity > 0 ? (lastPrice - entryPrice) * quantity : 0;
    const notional = entryPrice * quantity;
    paper.pnl = Number(pnl.toFixed(2));
    paper.pnlPercent = Number((notional > 0 ? (pnl / notional) * 100 : 0).toFixed(2));
    paper.unrealizedPnl = paper.pnl;
    paper.dailyPnl = paper.pnl;

    return {
      ...strategy,
      id: existingStrategy?.id || strategy.id || `strat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: strategy.name || `${symbol} Strategy`,
      type: resolveStrategyType(strategy),
      strategyType: strategy.strategyType || resolveStrategyType(strategy),
      symbol,
      ticker: symbol,
      symbols: strategy.symbols || strategy.tickers || [symbol],
      deployed: true,
      marketType: equity ? 'equity' : 'other',
      marketEnforced: equity,
      marketStatus,
      activatedAt: existingStrategy?.activatedAt || strategy.activatedAt || now,
      deployedAt: existingStrategy?.deployedAt || strategy.deployedAt || now,
      endedAt: null,
      stoppedAt: null,
      source: strategy.source || existingStrategy?.source || 'saved',
      status: runtimeStatus.status,
      runStatus: runtimeStatus.runStatus,
      pausedReason: runtimeStatus.pausedReason ?? null,
      statusLabel: runtimeStatus.statusLabel,
      allocation,
      paper,
      pnl: paper.pnl,
      pnlPct: paper.pnlPercent,
      unrealizedPnl: paper.unrealizedPnl,
      dailyPnl: paper.dailyPnl,
      timeActive: formatDuration(existingStrategy?.activatedAt || now, now),
    };
  }, [fetchQuoteForSymbol, normalizedPaperTradingBalance]);

  const handleDeployStrategy = useCallback(async (strategy, navigateToActive = false) => {
    if (!strategy || !canCreateStrategy(strategy)) return false;

    const candidateIdentity = normalizeStrategyIdentity(strategy);
    const existingActive = deployedStrategiesRef.current.find((item) => {
      const existingIdentity = normalizeStrategyIdentity(item);
      if (candidateIdentity && existingIdentity === candidateIdentity) return true;
      if (strategy.id && item.id && String(strategy.id) === String(item.id)) return true;
      return false;
    });

    if (!existingActive && !canActivateStrategy(strategy)) {
      return false;
    }

    const maxAllocation = getRemainingAllocationCapacity(existingActive || null);
    const setupAllocation = resolveStrategyAllocationPreference(strategy, normalizedPaperTradingBalance);
    const backtestAmount = resolveBacktestAmount(strategy) ?? setupAllocation;
    const suggestedAllocation = existingActive
      ? getStrategyAllocation(existingActive, normalizedPaperTradingBalance)
      : setupAllocation ?? backtestAmount;
    const selectedAllocation = await requestStrategyAllocation({
      strategy,
      maxAllocation,
      suggestedAllocation,
      backtestAmount,
    });

    if (!Number.isFinite(selectedAllocation)) {
      return false;
    }

    const activatedStrategy = await buildActivatedStrategy(
      strategy,
      existingActive || null,
      selectedAllocation,
    );

    setDeployedStrategies((prev) => {
      const existingIndex = prev.findIndex((item) => {
        if (item.id && activatedStrategy.id && String(item.id) === String(activatedStrategy.id)) return true;
        const itemIdentity = normalizeStrategyIdentity(item);
        const activeIdentity = normalizeStrategyIdentity(activatedStrategy);
        return activeIdentity && itemIdentity === activeIdentity;
      });

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...activatedStrategy };
        return next;
      }

      return [...prev, activatedStrategy];
    });

    setSavedStrategies((prev) => {
      const existingIndex = prev.findIndex((item) => {
        if (item.id && activatedStrategy.id && String(item.id) === String(activatedStrategy.id)) return true;
        const itemIdentity = normalizeStrategyIdentity(item);
        const activeIdentity = normalizeStrategyIdentity(activatedStrategy);
        return activeIdentity && itemIdentity === activeIdentity;
      });

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...strategy,
          id: activatedStrategy.id,
          symbol: activatedStrategy.symbol,
          ticker: activatedStrategy.ticker,
          type: activatedStrategy.type,
          status: activatedStrategy.status,
          runStatus: activatedStrategy.runStatus,
          statusLabel: activatedStrategy.statusLabel,
          pausedReason: activatedStrategy.pausedReason,
          deployed: true,
          activatedAt: activatedStrategy.activatedAt,
          deployedAt: activatedStrategy.deployedAt,
          endedAt: null,
          stoppedAt: null,
          pnl: activatedStrategy.pnl,
          pnlPct: activatedStrategy.pnlPct,
          allocation: activatedStrategy.paper?.allocation ?? activatedStrategy.allocation,
          paper: activatedStrategy.paper,
          folderId: next[existingIndex].folderId || 'active',
        };
        return next;
      }

      return [
        ...prev,
        {
          ...strategy,
          id: activatedStrategy.id,
          name: activatedStrategy.name,
          type: activatedStrategy.type,
          status: activatedStrategy.status,
          runStatus: activatedStrategy.runStatus,
          statusLabel: activatedStrategy.statusLabel,
          pausedReason: activatedStrategy.pausedReason,
          deployed: true,
          activatedAt: activatedStrategy.activatedAt,
          deployedAt: activatedStrategy.deployedAt,
          endedAt: null,
          stoppedAt: null,
          symbol: activatedStrategy.symbol,
          ticker: activatedStrategy.ticker,
          pnl: activatedStrategy.pnl,
          pnlPct: activatedStrategy.pnlPct,
          allocation: activatedStrategy.paper?.allocation ?? activatedStrategy.allocation,
          paper: activatedStrategy.paper,
          folderId: strategy.folderId || 'active',
          savedAt: Date.now(),
        },
      ];
    });

    if (navigateToActive) {
      setActiveTab('active');
    }

    setAutoBacktestStrategy(null);
    return true;
  }, [
    buildActivatedStrategy,
    canActivateStrategy,
    canCreateStrategy,
    getRemainingAllocationCapacity,
    normalizedPaperTradingBalance,
    requestStrategyAllocation,
    setDeployedStrategies,
    setSavedStrategies,
  ]);

  const handleToggleActivatedStrategyPause = useCallback((strategyId) => {
    setDeployedStrategies((prev) => prev.map((strategy) => {
      if (String(strategy.id) !== String(strategyId)) return strategy;

      if (strategy.pausedReason === 'market_closed') return strategy;

      const currentlyPaused = String(strategy.runStatus || strategy.status || '').toLowerCase() === 'paused';
      if (currentlyPaused) {
        const runtime = buildRuntimeStatus({
          isEquity: isEquityStrategy(strategy),
          marketOpen: isMarketOpen(),
          pausedReason: null,
        });
        return {
          ...strategy,
          status: runtime.status,
          runStatus: runtime.runStatus,
          pausedReason: runtime.pausedReason ?? null,
          statusLabel: runtime.statusLabel,
        };
      }

      return {
        ...strategy,
        status: 'paused',
        runStatus: 'paused',
        pausedReason: 'user',
        statusLabel: 'Paused',
      };
    }));
  }, [setDeployedStrategies]);

  const handleStopActivatedStrategy = useCallback((strategyId) => {
    const stoppedAt = Date.now();
    setDeployedStrategies((prev) => prev.filter((strategy) => String(strategy.id) !== String(strategyId)));
    setSavedStrategies((prev) => prev.map((strategy) => (
      String(strategy.id) === String(strategyId)
        ? {
            ...strategy,
            deployed: false,
            status: 'draft',
            runStatus: 'stopped',
            statusLabel: 'Draft',
            pausedReason: null,
            stoppedAt,
            endedAt: stoppedAt,
          }
        : strategy
    )));
  }, [setDeployedStrategies, setSavedStrategies]);

  const handleUpdateStrategyAllocation = useCallback((strategyId, nextAllocation) => {
    const target = deployedStrategiesRef.current.find((strategy) => String(strategy.id) === String(strategyId));
    if (!target) return { success: false, message: 'Strategy not found.' };

    const parsed = toNumberOrNull(nextAllocation);
    if (parsed === null) {
      return { success: false, message: 'Enter a valid dollar amount.' };
    }

    const requested = Math.round(parsed);
    if (requested < MIN_STRATEGY_ALLOCATION) {
      return {
        success: false,
        message: `Minimum allocation is ${formatCurrency(MIN_STRATEGY_ALLOCATION)}.`,
      };
    }

    const maxAllocation = getRemainingAllocationCapacity(target);
    if (requested > maxAllocation) {
      return {
        success: false,
        message: `Maximum available is ${formatCurrency(maxAllocation)}.`,
      };
    }

    let updated = null;
    const now = Date.now();
    setDeployedStrategies((prev) => prev.map((strategy) => {
      if (String(strategy.id) !== String(strategyId)) return strategy;

      const entryPrice = toNumberOrNull(strategy?.paper?.entryPrice)
        ?? toNumberOrNull(strategy?.paper?.lastPrice)
        ?? 0;
      const lastPrice = toNumberOrNull(strategy?.paper?.lastPrice)
        ?? entryPrice;
      const quantity = entryPrice > 0 ? Math.max(1, Math.floor(requested / entryPrice)) : 1;
      const pnl = quantity > 0 ? (lastPrice - entryPrice) * quantity : 0;
      const notional = entryPrice * quantity;
      const pnlPct = notional > 0 ? (pnl / notional) * 100 : 0;

      updated = {
        ...strategy,
        allocation: requested,
        pnl: Number(pnl.toFixed(2)),
        pnlPct: Number(pnlPct.toFixed(2)),
        paper: {
          ...strategy.paper,
          balanceStart: toNumberOrNull(strategy?.paper?.balanceStart) ?? normalizedPaperTradingBalance,
          provider: strategy?.paper?.provider || 'alpaca-paper',
          allocation: requested,
          quantity,
          entryPrice,
          lastPrice,
          pnl: Number(pnl.toFixed(2)),
          pnlPercent: Number(pnlPct.toFixed(2)),
          unrealizedPnl: Number(pnl.toFixed(2)),
          dailyPnl: Number(pnl.toFixed(2)),
          updatedAt: now,
        },
        unrealizedPnl: Number(pnl.toFixed(2)),
        dailyPnl: Number(pnl.toFixed(2)),
      };

      return updated;
    }));

    if (updated) {
      setSavedStrategies((prev) => prev.map((strategy) => (
        String(strategy.id) === String(strategyId)
          ? {
              ...strategy,
              allocation: updated.paper?.allocation ?? updated.allocation,
              pnl: updated.pnl,
              pnlPct: updated.pnlPct,
              paper: updated.paper,
            }
          : strategy
      )));
      return { success: true, allocation: requested };
    }

    return { success: false, message: 'Unable to update allocation.' };
  }, [getRemainingAllocationCapacity, normalizedPaperTradingBalance, setDeployedStrategies, setSavedStrategies]);

  const handleDemoStateChange = (state) => {
    setDemoState(state);
    if (state === 'thinking') {
      setActiveTab('terminal');
    }
  };

  const handleConnectBroker = (broker) => {
    setConnectedBrokers(prev => {
      if (prev.some(b => b.id === broker.id)) return prev;
      return [...prev, broker];
    });
  };

  // Terminal backtest handler
  const handleTerminalBacktest = async (strategy) => {
    const ticker = (strategy.ticker || terminalTicker || 'TSLA').replace(/\$/g, '').split(',')[0].trim();
    setTerminalStrategy(strategy);
    setTerminalTicker(ticker);
    setIsTerminalLoading(true);
    
    try {
      const response = await fetch('https://stratify-backend-production-3ebd.up.railway.app/api/backtest/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          strategy: {
            entry: strategy.entry || 'Buy when RSI drops below 30',
            exit: strategy.exit || 'Sell when RSI rises above 70',
            stopLoss: strategy.stopLoss || '5%',
            positionSize: strategy.positionSize || '100 shares',
          },
          period: '6mo',
          timeframe: '1Day',
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTerminalBacktestResults(data);
    } catch (err) {
      console.error('Terminal backtest error:', err);
      setTerminalBacktestResults({ error: err.message });
    } finally {
      setIsTerminalLoading(false);
    }
  };

  useEffect(() => {
    deployedStrategiesRef.current = deployedStrategies;
  }, [deployedStrategies]);

  useEffect(() => {
    setSavedStrategies((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      const deployedByIdentity = new Map();
      deployedStrategies.forEach((strategy) => {
        const identity = normalizeStrategyIdentity(strategy);
        if (identity) deployedByIdentity.set(identity, strategy);
      });

      let changed = false;
      const next = prev.map((saved) => {
        const identity = normalizeStrategyIdentity(saved);
        const deployed = (identity && deployedByIdentity.get(identity))
          || deployedStrategies.find((item) => String(item.id) === String(saved.id));

        if (!deployed) return saved;

        const savedStatus = String(saved.status || '').toLowerCase();
        const deployedStatus = String(deployed.status || '').toLowerCase();
        const savedRunStatus = String(saved.runStatus || '').toLowerCase();
        const deployedRunStatus = String(deployed.runStatus || '').toLowerCase();
        const savedAllocation = toNumberOrNull(saved?.paper?.allocation) ?? toNumberOrNull(saved?.allocation) ?? 0;
        const deployedAllocation = toNumberOrNull(deployed?.paper?.allocation) ?? toNumberOrNull(deployed?.allocation) ?? 0;

        if (
          savedStatus === deployedStatus
          && savedRunStatus === deployedRunStatus
          && Boolean(saved.deployed) === true
          && Number(saved.pnl || 0) === Number(deployed.pnl || 0)
          && Number(saved.pnlPct || 0) === Number(deployed.pnlPct || 0)
          && Number(savedAllocation) === Number(deployedAllocation)
        ) {
          return saved;
        }

        changed = true;
        return {
          ...saved,
          deployed: true,
          status: deployed.status,
          runStatus: deployed.runStatus,
          statusLabel: deployed.statusLabel,
          pausedReason: deployed.pausedReason,
          activatedAt: deployed.activatedAt,
          deployedAt: deployed.deployedAt,
          endedAt: null,
          stoppedAt: null,
          pnl: deployed.pnl,
          pnlPct: deployed.pnlPct,
          allocation: deployed.paper?.allocation ?? deployed.allocation,
          paper: deployed.paper,
        };
      });

      return changed ? next : prev;
    });
  }, [deployedStrategies, setSavedStrategies]);

  const runStrategyRuntimeTick = useCallback(async () => {
    const now = Date.now();
    const marketStatus = getMarketStatus();
    const nextOpen = getNextMarketOpen();
    const current = deployedStrategiesRef.current;

    setCurrentMarketStatus(marketStatus);
    setNextMarketOpenAt(nextOpen);

    if (!Array.isArray(current) || current.length === 0) return;

    const symbols = current.map((strategy) => resolveStrategySymbol(strategy));
    const quotesBySymbol = await fetchQuoteMap(symbols);
    const marketOpenNow = isMarketOpen();

    setDeployedStrategies((prev) => prev.map((strategy) => {
      const equity = isEquityStrategy(strategy);
      const runtime = buildRuntimeStatus({
        isEquity: equity,
        marketOpen: equity ? marketOpenNow : true,
        pausedReason: strategy.pausedReason,
      });

      const symbol = resolveStrategySymbol(strategy);
      const quote = quotesBySymbol[symbol];
      const quotePrice = extractQuotePrice(quote);
      const allocation = getStrategyAllocation(strategy, normalizedPaperTradingBalance);
      const entryPrice = toNumberOrNull(strategy?.paper?.entryPrice)
        ?? quotePrice
        ?? 0;
      const quantity = toNumberOrNull(strategy?.paper?.quantity)
        ?? (entryPrice > 0 ? Math.max(1, Math.floor(allocation / entryPrice)) : 1);
      const lastPrice = quotePrice
        ?? toNumberOrNull(strategy?.paper?.lastPrice)
        ?? entryPrice;

      const pnl = quantity > 0 ? (lastPrice - entryPrice) * quantity : 0;
      const notional = entryPrice * quantity;
      const pnlPct = notional > 0 ? (pnl / notional) * 100 : 0;

      return {
        ...strategy,
        symbol,
        ticker: symbol,
        marketType: equity ? 'equity' : 'other',
        marketEnforced: equity,
        marketStatus: equity ? marketStatus : 'Open',
        status: runtime.status,
        runStatus: runtime.runStatus,
        pausedReason: runtime.pausedReason ?? null,
        statusLabel: runtime.statusLabel,
        timeActive: formatDuration(strategy.activatedAt || strategy.deployedAt || now, now),
        allocation,
        pnl: Number(pnl.toFixed(2)),
        pnlPct: Number(pnlPct.toFixed(2)),
        paper: {
          balanceStart: toNumberOrNull(strategy?.paper?.balanceStart) ?? normalizedPaperTradingBalance,
          provider: 'alpaca-paper',
          allocation,
          quantity,
          entryPrice,
          lastPrice,
          pnl: Number(pnl.toFixed(2)),
          pnlPercent: Number(pnlPct.toFixed(2)),
          unrealizedPnl: Number(pnl.toFixed(2)),
          dailyPnl: Number(pnl.toFixed(2)),
          updatedAt: now,
        },
        unrealizedPnl: Number(pnl.toFixed(2)),
        dailyPnl: Number(pnl.toFixed(2)),
      };
    }));
  }, [fetchQuoteMap, normalizedPaperTradingBalance, setDeployedStrategies]);

  useEffect(() => {
    runStrategyRuntimeTick();
    const interval = setInterval(runStrategyRuntimeTick, 30000);

    let nextOpenTimeout = null;
    const scheduleNextOpenTick = () => {
      const nextOpen = getNextMarketOpen();
      const nextOpenMs = nextOpen ? new Date(nextOpen).getTime() : NaN;
      if (!Number.isFinite(nextOpenMs)) return;

      const delay = Math.max(1000, nextOpenMs - Date.now());
      nextOpenTimeout = setTimeout(() => {
        runStrategyRuntimeTick();
        scheduleNextOpenTick();
      }, delay);
    };

    scheduleNextOpenTick();

    return () => {
      clearInterval(interval);
      if (nextOpenTimeout) clearTimeout(nextOpenTimeout);
    };
  }, [runStrategyRuntimeTick]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SIDEBAR_SEEN_KEY)) {
        localStorage.setItem(SIDEBAR_SEEN_KEY, 'true');
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(sidebarExpanded));
    } catch {}
  }, [sidebarExpanded]);

  useEffect(() => {
    saveDashboardState({
      sidebarExpanded,
      rightPanelWidth,
      activeTab,
      activeSection,
      theme,
      paperTradingBalance,
      connectedBrokers,
    });
  }, [sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme, paperTradingBalance, connectedBrokers]);

  useEffect(() => {
    localStorage.setItem('stratify-connected-brokers', JSON.stringify(connectedBrokers));
  }, [connectedBrokers]);

  useEffect(() => {
    localStorage.setItem('stratify-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus(alpacaData?.account ? 'connected' : 'disconnected');
    }, 1500);
    return () => clearTimeout(timer);
  }, [alpacaData]);

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newWidth = window.innerWidth - e.clientX;
    setRightPanelWidth(Math.min(500, Math.max(280, newWidth)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const themeClasses = theme === 'dark' ? {
    bg: 'bg-transparent',
    surface: 'bg-transparent',
    surfaceElevated: 'bg-[#111111]',
    border: 'border-[#1f1f1f]',
    text: 'text-white',
    textMuted: 'text-white/50',
    green: 'text-[#29e1a6]',
    red: 'text-red-400',
    greenBg: 'bg-[#29e1a6]/10',
    redBg: 'bg-red-500/10',
  } : {
    bg: 'bg-transparent',
    surface: 'bg-transparent',
    surfaceElevated: 'bg-[#F8F9FA]',
    border: 'border-[#DADCE0]',
    text: 'text-[#202124]',
    textMuted: 'text-[#5f6368]',
    green: 'text-[#137333]',
    red: 'text-[#A50E0E]',
    greenBg: 'bg-[#137333]/10',
    redBg: 'bg-[#A50E0E]/10',
  };

  const allocationPromptSliderMax = allocationPrompt
    ? Math.max(MIN_STRATEGY_ALLOCATION, Math.floor(allocationPrompt.maxAllocation))
    : MIN_STRATEGY_ALLOCATION;
  const allocationPromptValue = allocationPrompt
    ? clamp(
        Number(sanitizeCurrencyInput(allocationPrompt.value)) || MIN_STRATEGY_ALLOCATION,
        MIN_STRATEGY_ALLOCATION,
        allocationPromptSliderMax,
      )
    : MIN_STRATEGY_ALLOCATION;
  const allocationPromptBacktestAmount = allocationPrompt
    ? Math.max(0, Number(allocationPrompt.backtestAmount) || allocationPromptValue)
    : 0;
  const allocationPromptRemainingBuyingPower = allocationPrompt
    ? calculateRemainingBuyingPower(allocationPrompt.maxAllocation, allocationPrompt.value)
    : 0;

  const draftStrategiesCount = strategies.filter(s => s.status !== 'deployed').length;

  const miniPillSlots = Array(6).fill(null);

  const liveScoresPill = (
    <div
      key="scores-pill"
      onClick={onToggleLiveScores}
      className={`relative h-8 flex items-center gap-2 pl-2.5 pr-3 rounded-full cursor-pointer transition-all ${
        isLiveScoresOpen
          ? 'border border-white/40 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.1)]'
          : 'border border-white/20 bg-black/90 hover:border-white/40'
      }`}
    >
      <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
        <span className="text-xs">🏀</span>
      </div>
      <span className="text-white font-medium text-xs">Live</span>
    </div>
  );

  [1, 2, 3, 4, 5].forEach((slot) => {
    if (pinnedGames[slot]) {
      miniPillSlots[slot] = (
        <MiniGamePill
          key={`pinned-game-${slot}-${pinnedGames[slot].id}`}
          game={pinnedGames[slot]}
          onRemove={() => handleRemovePinnedGame(slot)}
        />
      );
      return;
    }

    const tickerIndex = slot - 1; // Slots 1-5 map to ticker indices 0-4
    const tickerSymbol = miniTickers[tickerIndex];
    if (tickerSymbol) {
      miniPillSlots[slot] = (
        <TickerPill
          key={`ticker-pill-${slot}`}
          symbol={tickerSymbol}
          onRemove={handleRemoveMiniTicker}
        />
      );
      return;
    }

    if (slot === 1) {
      miniPillSlots[slot] = liveScoresPill;
    }
  });

  return (
    <div className={`h-screen w-screen flex flex-col ${themeClasses.bg} ${themeClasses.text} overflow-hidden`}>
      <EarningsAlert watchlist={watchlist} onAddToWatchlist={addToWatchlist} />
      <TopMetricsBar 
        alpacaData={alpacaData} 
        onAddToWatchlist={addToWatchlist} 
        theme={theme} 
        themeClasses={themeClasses} 
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
        onLegendClick={() => setActiveTab('legend')}
        connectedBrokers={connectedBrokers}
        miniPills={miniPillSlots}
        onTickerDrop={handleTickerDrop}
        onGameDrop={handleGameDrop}
        deployedStrategies={deployedStrategies}
        hasConnectedBroker={hasConnectedBroker}
        isPaperTradingMode={isPaperTradingMode}
        paperTradingBalance={isPaperTradingMode ? normalizedPaperTradingBalance : null}
        paperMetrics={isPaperTradingMode ? {
          dailyPnl: totalTopBarDailyPnL,
          buyingPower: availablePaperBalance,
          unrealizedPnl: totalTopBarUnrealizedPnL,
        } : null}
      />
      <LiveAlertsTicker watchlist={watchlist} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          expanded={sidebarExpanded}
          onToggle={(val) => setSidebarExpanded(val)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          savedStrategies={savedStrategies}
          deployedStrategies={deployedStrategies}
          activeStrategyCount={activeStrategiesCount}
          onRemoveSavedStrategy={handleRemoveSavedStrategy}
          grokPanelCollapsed={isGrokPanelCollapsed}
          onOpenFloatingGrok={() => setIsFloatingGrokOpen(prev => !prev)}
          onLogout={() => setCurrentPage('landing')}
        />
        
        {/* Main Content Area - Three Collapsible Panels */}
        <div 
          id="main-content-area" 
          className={`flex-1 flex flex-col ${themeClasses.surface} border-x ${themeClasses.border} overflow-hidden relative`}
        >
          {/* Tab-based Views */}
          {activeTab === 'watchlist' && <WatchlistPage themeClasses={themeClasses} watchlist={watchlist} onAddToWatchlist={addToWatchlist} onRemoveFromWatchlist={removeFromWatchlist} />}
          {activeTab === 'trade' && (
            <ProGate
              featureName="Paper Trading"
              description="Practice trading with virtual capital and real market data."
            >
              <TradePage
                watchlist={watchlist}
                onAddToWatchlist={addToWatchlist}
                onRemoveFromWatchlist={removeFromWatchlist}
                onReorderWatchlist={reorderWatchlist}
                onPinToTop={pinToTop}
                addTrade={addTrade}
              />
            </ProGate>
          )}
          {activeTab === 'markets' && <MarketsPage themeClasses={themeClasses} />}
          {activeTab === 'global-markets' && <LSEPage />}
          {activeTab === 'ai-chat' && (
            <ProGate
              featureName="AI Chat"
              description="Get real-time AI-powered market analysis and trading insights."
            >
              <StratifyChat />
            </ProGate>
          )}
          {activeTab === 'analytics' && (
            <ProGate
              featureName="Analytics"
              description="Deep portfolio analytics, performance metrics, and risk analysis."
            >
              <AnalyticsPage
                themeClasses={themeClasses}
                tradeHistory={trades}
                savedStrategies={savedStrategies}
                deployedStrategies={deployedStrategies}
                alpacaData={alpacaData}
              />
            </ProGate>
          )}
          {activeTab === 'advanced' && <AdvancedChartsPage />}
          {activeTab === 'war-room' && <WarRoom />}
          {activeTab === 'grok' && <DemoPanel />}
          {activeTab === 'backtest-wizard' && (
            <BacktestWizard
              onSubmit={(prompt) => {
                // Send the wizard prompt to Sophia via the SophiaPanel's chat
                setSophiaWizardPrompt(prompt);
                setActiveTab('sophia-output');
              }}
              onClose={() => setActiveTab('terminal')}
            />
          )}
          {activeTab === 'sophia-output' && (
            <StrategyOutput
              strategy={sophiaStrategy}
              onSave={(strategy) => {
                const normalizedContent = ensureRealTradeAnalysisSection(strategy?.raw || '');
                const toSave = {
                  id: strategy.id || ('sophia-' + Date.now()),
                  name: strategy.name,
                  code: strategy.code || '',
                  content: normalizedContent,
                  summary: { ...strategy, raw: normalizedContent },
                  ticker: strategy.ticker || '',
                  type: 'sophia',
                  source: 'sophia',
                  folder: 'sophia',
                  folderId: 'sophia-strategies',
                  deployed: false,
                  savedAt: Date.now(),
                };
                setSavedStrategies(prev => {
                  const nextId = String(toSave.id || '');
                  const existingIndex = prev.findIndex((item) => String(item?.id || '') === nextId);
                  if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...updated[existingIndex], ...toSave };
                    return updated;
                  }
                  return [toSave, ...prev];
                });
              }}
              onSaveToSophia={(strategy) => {
                const normalizedContent = ensureRealTradeAnalysisSection(strategy?.raw || '');
                const savedStrategy = {
                  id: strategy.id || ('sophia-' + Date.now()),
                  name: strategy.name || 'Sophia Strategy',
                  code: strategy.code || '',
                  content: normalizedContent,
                  summary: { ...strategy, raw: normalizedContent },
                  ticker: strategy.ticker || '',
                  entry: strategy.entry || '',
                  volume: strategy.volume || '',
                  trend: strategy.trend || '',
                  riskReward: strategy.riskReward || '',
                  stopLoss: strategy.stopLoss || '',
                  allocation: strategy.allocation || '',
                  keyTradeSetups: strategy.keyTradeSetups || {},
                  value: strategy.value || '',
                  profit_return_data: strategy.profit_return_data || null,
                  date: strategy.date || new Date().toISOString(),
                  type: 'sophia',
                  source: 'sophia',
                  folder: 'sophia',
                  folderId: 'sophia-strategies',
                  status: 'saved',
                  deployed: false,
                  savedAt: strategy.savedAt || Date.now(),
                  savedToSophia: true,
                };

                setSavedStrategies((prev) => {
                  const nextId = String(savedStrategy.id || '');
                  const existingIndex = prev.findIndex((item) => String(item?.id || '') === nextId);
                  if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...updated[existingIndex], ...savedStrategy };
                    return updated;
                  }
                  return [savedStrategy, ...prev];
                });

                setSophiaStrategy((prev) => (prev ? { ...prev, savedToSophia: true } : prev));
                setActiveTab('terminal');
              }}
              onDeploy={(strategy) => {
                const toDeploy = {
                  id: 'sophia-' + Date.now(),
                  name: strategy.name,
                  code: strategy.code || '',
                  content: strategy.raw || '',
                  summary: strategy,
                  deployed: true,
                  runStatus: 'running',
                  savedAt: Date.now(),
                  deployedAt: Date.now(),
                };
                handleDeployStrategy(toDeploy, true);
              }}
              onBack={() => setActiveTab('terminal')}
              onRetest={(prompt) => {
                setSophiaWizardPrompt(prompt);
              }}
              showSaveToSophiaButton
            />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioPage
              themeClasses={themeClasses}
              alpacaData={alpacaData}
              connectedBrokers={connectedBrokers}
              onBrokerConnect={(broker) => setConnectedBrokers(prev => [...prev, broker])}
              onBrokerDisconnect={(brokerId) => setConnectedBrokers(prev => prev.filter(b => b.id !== brokerId))}
              tradeHistory={trades}
            />
          )}
          {activeTab === 'history' && (
            <HistoryPage
              themeClasses={themeClasses}
              tradeHistory={trades}
              savedStrategies={savedStrategies}
              deployedStrategies={deployedStrategies}
              alpacaData={alpacaData}
            />
          )}
          {/* strategy workspace lives in Terminal */}
          {activeTab === 'active' && (
            <ActiveTrades
              setActiveTab={setActiveTab}
              strategies={deployedStrategies}
              setStrategies={setDeployedStrategies}
              onTogglePause={handleToggleActivatedStrategyPause}
              onStopStrategy={handleStopActivatedStrategy}
              onAllocationChange={handleUpdateStrategyAllocation}
              availableBalance={availablePaperBalance}
              totalPaperBalance={normalizedPaperTradingBalance}
              minimumAllocation={MIN_STRATEGY_ALLOCATION}
              marketStatus={currentMarketStatus}
              nextMarketOpen={nextMarketOpenAt}
            />
          )}
          {activeTab === 'legend' && <ChallengeLeaderboard isPaid={true} />}
          {activeTab === 'trends' && <TrendScanner />}
          {activeTab === 'fred' && <FredPage />}
          {activeTab === 'crypto' && <CryptoPage />}
          {activeTab === 'options' && <OptionsPage />}
          {activeTab === 'terminal' && (
            <TerminalStrategyWorkspace
              savedStrategies={savedStrategies}
              deployedStrategies={deployedStrategies}
              onOpenBuilder={() => setActiveTab('backtest-wizard')}
              onRetestStrategy={(prompt) => setSophiaWizardPrompt(prompt)}
              onDeployStrategy={(strategy) => handleDeployStrategy(strategy, true)}
              onSaveStrategy={setSavedStrategies}
              onDeleteStrategy={handleDeleteStrategy}
              onClearStrategies={handleClearAllStrategies}
              isSophiaThinking={isSophiaThinking}
            />
          )}
          {activeTab === 'more' && <MoreInfoPage />}
        </div>
        
        <SophiaPanel 
          onCollapsedChange={setIsGrokPanelCollapsed}
          onLoadingChange={setIsSophiaThinking}
          onStrategyGenerated={(strategy) => {
            const generatedAt = strategy?.generatedAt || Date.now();
            setSophiaStrategy({
              ...(strategy || {}),
              id: strategy?.id || `sophia-response-${generatedAt}`,
              type: 'sophia',
              source: 'sophia',
              savedToSophia: false,
            });
            setActiveTab('sophia-output');
          }}
          onOpenWizard={() => setActiveTab('backtest-wizard')}
          wizardPrompt={sophiaWizardPrompt}
          onWizardPromptConsumed={() => setSophiaWizardPrompt(null)}
        />
      </div>
      <StatusBar
        connectionStatus={connectionStatus}
        theme={theme}
        themeClasses={themeClasses}
        onOpenNewsletter={() => setShowNewsletter(true)}
        onOpenMarketIntel={() => {
          setActiveSection('market-intel');
          setShowMarketIntel(true);
        }}
      />

      {showStrategyLimitModal && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowStrategyLimitModal(false)}
        >
          <div className="relative w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowStrategyLimitModal(false)}
              className="absolute right-4 top-4 z-10 p-1.5 rounded-md bg-black/30 hover:bg-black/50 text-white/60 hover:text-white transition-colors"
              aria-label="Close upgrade modal"
            >
              <X className="w-4 h-4" strokeWidth={1.8} />
            </button>
            <UpgradePrompt
              featureName="Active Strategy Limit Reached"
              description="Free accounts can run up to 3 active strategies at once. Upgrade to Pro for unlimited active strategy slots."
              priceId={PRO_PRICE_ID}
              className="mx-auto"
            />
          </div>
        </div>
      )}

      {allocationPrompt && (
        <div
          className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => resolveAllocationPrompt(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">Paper Allocation</div>
            <h2 className="text-lg font-semibold mt-2">Confirm Allocation</h2>
            <p className="text-sm text-white/60 mt-1">
              {allocationPrompt.strategyName} ({allocationPrompt.symbol})
            </p>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/30 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Backtest Amount:</span>
                <span className="font-semibold text-white">{formatCurrency(allocationPromptBacktestAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Remaining Buying Power:</span>
                <span className="font-semibold text-emerald-300">
                  {formatCurrency(allocationPromptRemainingBuyingPower)}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-white/55">Allocation Amount:</label>
              <input
                type="text"
                value={allocationPrompt.value}
                onChange={(event) => {
                  const cleaned = sanitizeCurrencyInput(event.target.value);
                  setAllocationPrompt((prev) => (
                    prev ? { ...prev, value: cleaned, error: '' } : prev
                  ));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAllocationPromptConfirm();
                  if (event.key === 'Escape') resolveAllocationPrompt(null);
                }}
                placeholder={String(Math.round(allocationPromptBacktestAmount || MIN_STRATEGY_ALLOCATION))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b0b0b] px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40"
              />
              <input
                type="range"
                min={MIN_STRATEGY_ALLOCATION}
                max={allocationPromptSliderMax}
                step={100}
                value={allocationPromptValue}
                onChange={(event) => {
                  setAllocationPrompt((prev) => (
                    prev ? { ...prev, value: event.target.value, error: '' } : prev
                  ));
                }}
                className="mt-3 w-full accent-emerald-400"
              />
              <div className="mt-1 flex justify-between text-[11px] text-white/45">
                <span>Min {formatCurrency(MIN_STRATEGY_ALLOCATION)}</span>
                <span>Max {formatCurrency(allocationPrompt.maxAllocation)}</span>
              </div>
              {allocationPrompt.error && (
                <div className="mt-2 text-xs text-red-300">{allocationPrompt.error}</div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => resolveAllocationPrompt(null)}
                className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white/75 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAllocationPromptConfirm}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/20 text-xs text-emerald-200 hover:bg-emerald-500/30"
              >
                Activate Strategy
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStock && (
        <StockDetailView 
          symbol={selectedStock.symbol}
          stockName={selectedStock.name}
          onClose={() => setSelectedStock(null)}
          themeClasses={themeClasses}
        />
      )}

      {showNewsletter && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]">
          <NewsletterPage onClose={() => setShowNewsletter(false)} />
        </div>
      )}

      {showMarketIntel && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]">
          <MarketIntelPage onClose={() => {
            setShowMarketIntel(false);
            setActiveSection('watchlist');
          }} />
        </div>
      )}

      {/* Copilot is rendered inside StatusBar as a positioned dropdown */}

      <BrokerConnectModal 
        isOpen={showBrokerModal} 
        onClose={() => setShowBrokerModal(false)}
        onConnect={handleConnectBroker}
        connectedBrokers={connectedBrokers}
      />

      <FloatingGrokChat
        isOpen={isFloatingGrokOpen}
        onClose={() => setIsFloatingGrokOpen(false)}
        onMessageCountChange={setGrokMessageCount}
      />

    </div>
  );
}
