import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import AlpacaOrderTicket from './AlpacaOrderTicket';
import {
  subscribeTwelveDataQuotes,
  subscribeTwelveDataStatus,
} from '../../services/twelveDataWebSocket';

const MAX_SYMBOLS = 120;

const WATCHLIST_PANEL_KEY = 'stratify-watchlist-panel-state';
const ORDER_PANEL_KEY = 'stratify-watchlist-order-panel-state';
const PANEL_STATES = ['open', 'small', 'closed'];

const WATCHLIST_PANEL_WIDTHS = {
  open: 340,
  small: 296,
  closed: 82,
};

const ORDER_PANEL_WIDTHS = {
  open: 344,
  small: 286,
  closed: 0,
};

const ORDER_TYPE_OPTIONS = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
  { value: 'trailing_stop', label: 'Trailing Stop' },
];

const TIME_IN_FORCE_OPTIONS = [
  { value: 'day', label: 'DAY' },
  { value: 'gtc', label: 'GTC' },
  { value: 'ioc', label: 'IOC' },
  { value: 'fok', label: 'FOK' },
];

const ORDER_TYPE_LABELS = {
  market: 'Market',
  limit: 'Limit',
  stop: 'Stop',
  stop_limit: 'Stop Limit',
  trailing_stop: 'Trailing Stop',
};

const DEFAULT_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
];

const SEARCH_FALLBACK = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'BAC', name: 'Bank of America Corp.' },
  { symbol: 'WFC', name: 'Wells Fargo & Company' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.' },
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'CRM', name: 'Salesforce, Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies, Inc.' },
  { symbol: 'ABNB', name: 'Airbnb, Inc.' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.' },
  { symbol: 'SHOP', name: 'Shopify Inc.' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'PANW', name: 'Palo Alto Networks, Inc.' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings, Inc.' },
  { symbol: 'MU', name: 'Micron Technology, Inc.' },
  { symbol: 'SMCI', name: 'Super Micro Computer, Inc.' },
  { symbol: 'ARM', name: 'Arm Holdings plc' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'LLY', name: 'Eli Lilly and Company' },
  { symbol: 'PG', name: 'Procter & Gamble Company' },
  { symbol: 'HD', name: 'Home Depot, Inc.' },
  { symbol: 'DIS', name: 'Walt Disney Company' },
  { symbol: 'BA', name: 'Boeing Company' },
  { symbol: 'NKE', name: 'NIKE, Inc.' },
  { symbol: 'T', name: 'AT&T Inc.' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'MRK', name: 'Merck & Co., Inc.' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'KO', name: 'Coca-Cola Company' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.' },
  { symbol: 'MCD', name: 'McDonald\'s Corporation' },
  { symbol: 'LOW', name: 'Lowe\'s Companies, Inc.' },
  { symbol: 'GE', name: 'GE Aerospace' },
  { symbol: 'CAT', name: 'Caterpillar Inc.' },
  { symbol: 'DE', name: 'Deere & Company' },
  { symbol: 'F', name: 'Ford Motor Company' },
  { symbol: 'GM', name: 'General Motors Company' },
];

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')[0]
    .split('.')[0];

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const NYSE_SYMBOLS = new Set([
  'SPY', 'DIA', 'IWM', 'JPM', 'BAC', 'WFC', 'V', 'MA', 'PLTR', 'UBER', 'ABNB', 'SHOP',
  'XOM', 'CVX', 'WMT', 'UNH', 'JNJ', 'LLY', 'PG', 'HD', 'DIS', 'BA', 'NKE', 'T', 'PFE',
  'MRK', 'ABBV', 'KO', 'PEP', 'MCD', 'LOW', 'GE', 'CAT', 'DE', 'F', 'GM',
]);

const resolveEquityExchange = (symbol, exchangeHint = '') => {
  const hint = String(exchangeHint || '').toUpperCase();
  if (hint.includes('NASDAQ')) return 'NASDAQ';
  if (hint.includes('NYSE')) return 'NYSE';
  if (hint.includes('AMEX')) return 'AMEX';
  if (hint.includes('ARCA')) return 'ARCA';
  return NYSE_SYMBOLS.has(symbol) ? 'NYSE' : 'NASDAQ';
};

const loadPanelState = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = String(localStorage.getItem(key) || '').trim();
    return PANEL_STATES.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
};

const getNextPanelState = (current) => {
  const index = PANEL_STATES.indexOf(current);
  if (index < 0) return PANEL_STATES[0];
  return PANEL_STATES[(index + 1) % PANEL_STATES.length];
};

const formatPrice = (value) => {
  const price = Number(value);
  if (!Number.isFinite(price)) return '--';
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
};

const formatPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return '--';
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString();
};

const formatUsd = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const formatTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '--';

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });

  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce((accumulator, part) => {
    accumulator[part.type] = part.value;
    return accumulator;
  }, {});

  return `${lookup.month} ${lookup.day}, ${lookup.year} at ${lookup.hour}:${lookup.minute} ${lookup.dayPeriod} ${lookup.timeZoneName}`;
};

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist, addTrade }) => {
  const [watchlistPanelState, setWatchlistPanelState] = useState(() => loadPanelState(WATCHLIST_PANEL_KEY, 'small'));
  const [orderPanelState, setOrderPanelState] = useState(() => loadPanelState(ORDER_PANEL_KEY, 'closed'));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedTicker, setSelectedTicker] = useState(null);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamStatus, setStreamStatus] = useState({ connected: false, connecting: false, error: null, retryCount: 0 });

  const [orderSide, setOrderSide] = useState('buy');
  const [orderQty, setOrderQty] = useState('1');
  const [orderSizeMode, setOrderSizeMode] = useState('shares');
  const [orderDollars, setOrderDollars] = useState('');
  const [orderType, setOrderType] = useState('market');
  const [timeInForce, setTimeInForce] = useState('day');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailAmount, setTrailAmount] = useState('');
  const [orderStep, setOrderStep] = useState('entry');
  const [orderError, setOrderError] = useState('');
  const [orderStatus, setOrderStatus] = useState({ state: 'idle', message: '', data: null, timestamp: null });

  const [account, setAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState({ state: 'idle', message: '' });
  const [tradePositions, setTradePositions] = useState([]);
  const [positionsStatus, setPositionsStatus] = useState({ state: 'idle', message: '' });

  const refreshInFlightRef = useRef(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_PANEL_KEY, watchlistPanelState);
  }, [watchlistPanelState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ORDER_PANEL_KEY, orderPanelState);
  }, [orderPanelState]);

  const normalizedWatchlist = useMemo(() => {
    const source = Array.isArray(watchlist) && watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST;
    const seen = new Set();

    return source
      .map((item) => {
        const symbol = normalizeSymbol(typeof item === 'string' ? item : item?.symbol);
        if (!symbol) return null;
        const name = typeof item === 'object' && item?.name ? item.name : symbol;
        const exchange = typeof item === 'object' ? item?.exchange : undefined;
        return { symbol, name, exchange };
      })
      .filter((item) => {
        if (!item?.symbol || seen.has(item.symbol)) return false;
        seen.add(item.symbol);
        return true;
      });
  }, [watchlist]);

  const visibleWatchlist = useMemo(() => normalizedWatchlist.slice(0, MAX_SYMBOLS), [normalizedWatchlist]);

  const activeSymbols = useMemo(() => visibleWatchlist.map((item) => item.symbol), [visibleWatchlist]);

  const labelMap = useMemo(() => {
    const map = {};

    SEARCH_FALLBACK.forEach((item) => {
      map[item.symbol] = item.name;
    });

    visibleWatchlist.forEach((item) => {
      map[item.symbol] = item.name || map[item.symbol] || item.symbol;
    });

    return map;
  }, [visibleWatchlist]);

  const refreshQuotes = useCallback(async ({ manual = false } = {}) => {
    if (activeSymbols.length === 0) {
      setQuotesBySymbol({});
      setLastUpdated(null);
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    if (manual) setIsRefreshing(true);
    setLoading(true);

    try {
      const response = await fetch('/api/watchlist/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: activeSymbols }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load watchlist quotes');
      }

      const map = {};
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      rows.forEach((row) => {
        const symbol = normalizeSymbol(row?.symbol);
        if (!symbol) return;

        map[symbol] = {
          ...row,
          symbol,
          name: row?.name || labelMap[symbol] || symbol,
          exchange: row?.exchange || null,
          dayBaselinePrice: Number.isFinite(toNumber(row?.change))
            ? (toNumber(row?.price) ?? 0) - toNumber(row?.change)
            : (
              Number.isFinite(toNumber(row?.price))
              && Number.isFinite(toNumber(row?.percentChange))
              && toNumber(row?.percentChange) !== -100
                ? (toNumber(row?.price) / (1 + (toNumber(row?.percentChange) / 100)))
                : null
            ),
          source: 'rest',
        };
      });

      setQuotesBySymbol(map);
      setLastUpdated(new Date().toISOString());
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'Failed to refresh quotes');
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
      refreshInFlightRef.current = false;
    }
  }, [activeSymbols, labelMap]);

  useEffect(() => {
    refreshQuotes({ manual: false });
  }, [refreshQuotes]);

  useEffect(() => {
    if (activeSymbols.length === 0) return undefined;

    const unsubscribeQuotes = subscribeTwelveDataQuotes(activeSymbols, (update) => {
      const symbol = normalizeSymbol(update?.symbol);
      if (!symbol) return;

      setQuotesBySymbol((previous) => {
        const current = previous[symbol] || {};
        const nextPrice = toNumber(update?.price);
        const previousPrice = toNumber(current?.price);
        const streamPercent = toNumber(update?.percentChange);
        const baselineFromCurrent = toNumber(current?.dayBaselinePrice);
        const baselineFromPercent = (
          Number.isFinite(previousPrice)
          && Number.isFinite(toNumber(current?.percentChange))
          && toNumber(current?.percentChange) !== -100
        )
          ? previousPrice / (1 + (toNumber(current?.percentChange) / 100))
          : null;
        const baseline = baselineFromCurrent ?? baselineFromPercent;
        const derivedPercent = (
          Number.isFinite(nextPrice)
          && Number.isFinite(baseline)
          && baseline !== 0
        )
          ? ((nextPrice - baseline) / baseline) * 100
          : null;
        const nextChange = (
          Number.isFinite(nextPrice)
          && Number.isFinite(baseline)
        )
          ? nextPrice - baseline
          : toNumber(update?.change) ?? toNumber(current?.change);

        return {
          ...previous,
          [symbol]: {
            ...current,
            symbol,
            name: current?.name || labelMap[symbol] || symbol,
            price: Number.isFinite(nextPrice) ? nextPrice : current?.price ?? null,
            change: nextChange,
            percentChange: Number.isFinite(streamPercent)
              ? streamPercent
              : Number.isFinite(derivedPercent)
                ? derivedPercent
                : current?.percentChange ?? null,
            dayBaselinePrice: baseline,
            timestamp: update?.timestamp || new Date().toISOString(),
            source: 'ws',
          },
        };
      });

      setLastUpdated(new Date().toISOString());
    });

    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      setStreamStatus(status || { connected: false, connecting: false, error: null, retryCount: 0 });
      if (status?.error) {
        setError(status.error);
      }
    });

    return () => {
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [activeSymbols, labelMap]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const query = searchQuery.trim().toUpperCase();
    const activeSet = new Set(activeSymbols);

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);

      try {
        const response = await fetch(
          `/api/global-markets/list?market=nyse&q=${encodeURIComponent(query)}&limit=40`,
          { cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));

        const upstream = response.ok && Array.isArray(payload?.data)
          ? payload.data.map((item) => ({
              symbol: normalizeSymbol(item?.symbol),
              name: item?.instrumentName || item?.name || item?.symbol,
              exchange: item?.exchange || '',
            }))
          : [];

        const fallback = SEARCH_FALLBACK.filter(
          (item) => item.symbol.includes(query) || item.name.toUpperCase().includes(query)
        );

        const merged = [...upstream, ...fallback]
          .filter((item) => item.symbol && !activeSet.has(item.symbol))
          .reduce((accumulator, item) => {
            if (!accumulator.some((entry) => entry.symbol === item.symbol)) {
              accumulator.push(item);
            }
            return accumulator;
          }, [])
          .slice(0, 20);

        setSearchResults(merged);
      } catch {
        const fallback = SEARCH_FALLBACK
          .filter((item) => item.symbol.includes(query) || item.name.toUpperCase().includes(query))
          .filter((item) => !activeSet.has(item.symbol))
          .slice(0, 20);

        setSearchResults(fallback);
      } finally {
        setSearchLoading(false);
      }
    }, 220);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, activeSymbols]);

  useEffect(() => {
    if (!selectedTicker && activeSymbols.length > 0) {
      setSelectedTicker(activeSymbols[0]);
      return;
    }

    if (selectedTicker && !activeSymbols.includes(selectedTicker)) {
      setSelectedTicker(activeSymbols[0] || null);
    }
  }, [activeSymbols, selectedTicker]);

  const selectedQuote = selectedTicker ? quotesBySymbol[selectedTicker] : null;
  const selectedWatchlistEntry = visibleWatchlist.find((item) => item.symbol === selectedTicker) || null;
  const selectedName = selectedWatchlistEntry?.name || selectedTicker;
  const selectedExchange = resolveEquityExchange(
    selectedTicker,
    selectedWatchlistEntry?.exchange || selectedQuote?.exchange
  );
  const tradingViewSymbol = selectedTicker
    ? `${selectedExchange}:${selectedTicker}`
    : '';

  const marketPrice = useMemo(() => {
    return selectedQuote?.price ?? selectedQuote?.last ?? selectedQuote?.ask ?? selectedQuote?.bid ?? 0;
  }, [selectedQuote]);

  const bidPrice = selectedQuote?.bid ?? null;
  const askPrice = selectedQuote?.ask ?? null;

  const sharesQtyNumber = useMemo(() => {
    const parsed = parseFloat(orderQty);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [orderQty]);

  const orderDollarsNumber = useMemo(() => {
    const parsed = parseFloat(orderDollars);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [orderDollars]);

  const limitPriceNumber = useMemo(() => {
    const parsed = parseFloat(limitPrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [limitPrice]);

  const stopPriceNumber = useMemo(() => {
    const parsed = parseFloat(stopPrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [stopPrice]);

  const trailAmountNumber = useMemo(() => {
    const parsed = parseFloat(trailAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [trailAmount]);

  useEffect(() => {
    if (orderType !== 'limit' && orderType !== 'stop_limit') return;
    if (limitPrice !== '') return;
    const next = orderSide === 'buy' ? askPrice : bidPrice;
    if (Number.isFinite(next) && next > 0) {
      setLimitPrice(next.toFixed(2));
    }
  }, [orderType, orderSide, askPrice, bidPrice, limitPrice]);

  const priceForEstimate = useMemo(() => {
    if (orderType === 'limit') return limitPriceNumber;
    if (orderType === 'stop') return stopPriceNumber;
    if (orderType === 'stop_limit') return limitPriceNumber;
    if (orderType === 'trailing_stop') return marketPrice;
    return marketPrice;
  }, [orderType, limitPriceNumber, stopPriceNumber, marketPrice]);

  const orderQtyNumber = useMemo(() => {
    if (orderSizeMode === 'dollars') {
      if (priceForEstimate <= 0 || orderDollarsNumber <= 0) return 0;
      return orderDollarsNumber / priceForEstimate;
    }
    return sharesQtyNumber;
  }, [orderSizeMode, priceForEstimate, orderDollarsNumber, sharesQtyNumber]);

  const estimatedTotal = useMemo(() => {
    if (orderSizeMode === 'dollars') return orderDollarsNumber;
    return orderQtyNumber > 0 && priceForEstimate > 0 ? orderQtyNumber * priceForEstimate : 0;
  }, [orderSizeMode, orderDollarsNumber, orderQtyNumber, priceForEstimate]);

  const requiresLimit = orderType === 'limit' || orderType === 'stop_limit';
  const requiresStop = orderType === 'stop' || orderType === 'stop_limit';
  const requiresTrail = orderType === 'trailing_stop';

  const isPriceMissing =
    (requiresLimit && limitPriceNumber <= 0)
    || (requiresStop && stopPriceNumber <= 0)
    || (requiresTrail && trailAmountNumber <= 0);

  const hasOrderSize = orderSizeMode === 'dollars' ? orderDollarsNumber > 0 : orderQtyNumber > 0;

  const canReview = selectedTicker && hasOrderSize && !isPriceMissing && orderStep === 'entry';

  const orderTypeLabel = ORDER_TYPE_LABELS[orderType] || 'Market';

  const orderTimestamp =
    orderStatus.data?.filled_at
    || orderStatus.data?.submitted_at
    || orderStatus.data?.created_at
    || orderStatus.timestamp;

  const refreshAccount = useCallback(async () => {
    try {
      setAccountStatus({ state: 'loading', message: '' });
      const response = await fetch('/api/account');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to fetch account');
      setAccount(data);
      setAccountStatus({ state: 'success', message: '' });
    } catch (fetchError) {
      setAccountStatus({ state: 'error', message: fetchError?.message || 'Failed to fetch account' });
    }
  }, []);

  const refreshPositions = useCallback(async () => {
    try {
      setPositionsStatus({ state: 'loading', message: '' });
      const response = await fetch('/api/positions');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to fetch positions');
      setTradePositions(Array.isArray(data) ? data : []);
      setPositionsStatus({ state: 'success', message: '' });
    } catch (fetchError) {
      setPositionsStatus({ state: 'error', message: fetchError?.message || 'Failed to fetch positions' });
    }
  }, []);

  useEffect(() => {
    if (orderPanelState === 'closed') return;
    refreshAccount();
    refreshPositions();
  }, [orderPanelState, refreshAccount, refreshPositions]);

  const positionForTicker = useMemo(() => {
    return tradePositions.find(
      (position) => position?.symbol?.toUpperCase() === selectedTicker?.toUpperCase()
    );
  }, [tradePositions, selectedTicker]);

  const availableShares = useMemo(() => {
    const rawQty =
      positionForTicker?.qty_available
      ?? positionForTicker?.qty
      ?? positionForTicker?.quantity;
    const parsed = parseFloat(rawQty);
    return Number.isFinite(parsed) ? parsed : null;
  }, [positionForTicker]);

  const availableSharesDisplay =
    positionsStatus.state === 'loading'
      ? '...'
      : availableShares === null
        ? '--'
        : availableShares.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          });

  const buyingPower = account?.buying_power ?? account?.buyingPower ?? account?.cash ?? null;
  const buyingPowerDisplay =
    accountStatus.state === 'loading'
      ? '...'
      : accountStatus.state === 'error'
        ? '--'
        : buyingPower !== null && buyingPower !== undefined
          ? formatUsd(buyingPower)
          : '--';

  const clearOrderError = useCallback(() => {
    if (orderError) setOrderError('');
  }, [orderError]);

  const handleReview = useCallback(() => {
    if (!selectedTicker) {
      setOrderError('Select a ticker to continue.');
      return;
    }
    if (orderSizeMode === 'dollars' && orderDollarsNumber <= 0) {
      setOrderError('Enter a valid dollar amount.');
      return;
    }
    if (orderQtyNumber <= 0) {
      setOrderError('Enter a valid share quantity.');
      return;
    }
    if (orderSide === 'sell' && orderSizeMode === 'shares' && Number.isFinite(availableShares) && orderQtyNumber > availableShares) {
      setOrderError('Sell size exceeds available shares.');
      return;
    }
    if (requiresLimit && limitPriceNumber <= 0) {
      setOrderError('Enter a valid limit price.');
      return;
    }
    if (requiresStop && stopPriceNumber <= 0) {
      setOrderError('Enter a valid stop price.');
      return;
    }
    if (requiresTrail && trailAmountNumber <= 0) {
      setOrderError('Enter a valid trail amount.');
      return;
    }

    setOrderError('');
    setOrderStep('review');
  }, [
    availableShares,
    limitPriceNumber,
    orderDollarsNumber,
    orderQtyNumber,
    orderSide,
    orderSizeMode,
    requiresLimit,
    requiresStop,
    requiresTrail,
    selectedTicker,
    stopPriceNumber,
    trailAmountNumber,
  ]);

  const handleSubmitOrder = useCallback(async () => {
    const submittedAt = new Date().toISOString();
    setOrderStatus({ state: 'submitting', message: '', data: null, timestamp: submittedAt });

    try {
      if (!Number.isFinite(orderQtyNumber) || orderQtyNumber <= 0) {
        throw new Error('Invalid order quantity.');
      }

      const payload = {
        symbol: selectedTicker,
        qty: orderQtyNumber,
        side: orderSide,
        type: orderType,
        time_in_force: timeInForce,
      };

      if (orderSizeMode === 'dollars' && orderType === 'market' && orderDollarsNumber > 0) {
        payload.notional = orderDollarsNumber;
        delete payload.qty;
      }

      if (requiresLimit) payload.limit_price = limitPriceNumber;
      if (requiresStop) payload.stop_price = stopPriceNumber;
      if (orderType === 'trailing_stop') payload.trail_price = trailAmountNumber;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Order failed');
      }

      if (typeof addTrade === 'function') {
        addTrade({
          symbol: selectedTicker,
          shares: orderQtyNumber,
          side: orderSide,
          price: data?.filled_avg_price ?? marketPrice,
          timestamp: data?.submitted_at || submittedAt,
        });
      }

      setOrderStatus({
        state: 'success',
        message: 'Order submitted.',
        data,
        timestamp: data?.submitted_at || submittedAt,
      });
      setOrderStep('confirm');
      refreshAccount();
      refreshPositions();
    } catch (submitError) {
      setOrderStatus({
        state: 'error',
        message: submitError?.message || 'Order failed',
        data: null,
        timestamp: submittedAt,
      });
      setOrderStep('confirm');
    }
  }, [
    addTrade,
    limitPriceNumber,
    marketPrice,
    orderDollarsNumber,
    orderQtyNumber,
    orderSide,
    orderSizeMode,
    orderType,
    refreshAccount,
    refreshPositions,
    requiresLimit,
    requiresStop,
    selectedTicker,
    stopPriceNumber,
    timeInForce,
    trailAmountNumber,
  ]);

  const handleResetOrder = useCallback(() => {
    setOrderStep('entry');
    setOrderStatus({ state: 'idle', message: '', data: null, timestamp: null });
    setOrderError('');
  }, []);

  const addSymbolToWatchlist = useCallback((symbol, name, exchange) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    if (activeSymbols.includes(normalized)) return;

    if (activeSymbols.length >= MAX_SYMBOLS) {
      setError(`Watchlist limit reached (${MAX_SYMBOLS} symbols)`);
      return;
    }

    onAddToWatchlist?.({
      symbol: normalized,
      name: name || labelMap[normalized] || normalized,
      exchange: resolveEquityExchange(normalized, exchange),
    });

    setSearchQuery('');
    setSearchResults([]);
    setError('');
  }, [activeSymbols, labelMap, onAddToWatchlist]);

  const handleDirectAdd = useCallback(() => {
    const normalized = normalizeSymbol(searchQuery);
    if (!normalized) return;
    const exactResult = searchResults.find((item) => item.symbol === normalized);
    addSymbolToWatchlist(
      normalized,
      exactResult?.name || labelMap[normalized],
      exactResult?.exchange
    );
  }, [addSymbolToWatchlist, labelMap, searchQuery, searchResults]);

  const handleTicketSymbolSubmit = useCallback((symbolInput) => {
    const normalized = normalizeSymbol(symbolInput);
    if (!normalized) return;

    const watchlistMatch = activeSymbols.find((symbol) => symbol === normalized);
    if (watchlistMatch) {
      setSelectedTicker(watchlistMatch);
      return;
    }

    const searchMatch = searchResults.find((item) => item.symbol === normalized)
      || SEARCH_FALLBACK.find((item) => item.symbol === normalized);

    addSymbolToWatchlist(
      normalized,
      searchMatch?.name || labelMap[normalized],
      searchMatch?.exchange
    );
    setSelectedTicker(normalized);
  }, [activeSymbols, addSymbolToWatchlist, labelMap, searchResults]);

  const isWatchlistCollapsed = watchlistPanelState === 'closed';
  const isOrderPanelClosed = orderPanelState === 'closed';

  const cycleWatchlistPanel = () => {
    setWatchlistPanelState((previous) => getNextPanelState(previous));
  };

  const toggleOrderPanelSize = () => {
    setOrderPanelState((previous) => (previous === 'open' ? 'small' : 'open'));
  };

  const openOrderPanel = () => {
    setOrderPanelState((previous) => (previous === 'closed' ? 'open' : previous));
  };

  const closeOrderPanel = () => {
    setOrderPanelState('closed');
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-transparent">
      <div
        className="relative z-10 flex flex-col border-r border-[#1f1f1f] transition-all duration-300"
        style={{ width: WATCHLIST_PANEL_WIDTHS[watchlistPanelState] }}
      >
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-3 py-3">
          {!isWatchlistCollapsed ? (
            <div>
              <h1 className="text-base font-semibold text-white">Watchlist</h1>
              <p className="text-[11px] text-gray-400">Twelve Data live stream</p>
            </div>
          ) : <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">WL</span>}

          <button
            type="button"
            onClick={cycleWatchlistPanel}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/5 px-2 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/12 hover:text-emerald-200"
            title="Resize watchlist panel"
          >
            {isWatchlistCollapsed ? <ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.5} /> : <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {!isWatchlistCollapsed && <span>{watchlistPanelState === 'open' ? 'Large' : 'Small'}</span>}
          </button>
        </div>

        {!isWatchlistCollapsed ? (
          <>
            <div className="relative z-20 border-b border-[#1f1f1f] px-3 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (searchResults.length > 0) {
                        addSymbolToWatchlist(searchResults[0].symbol, searchResults[0].name);
                      } else {
                        handleDirectAdd();
                      }
                    }
                  }}
                  placeholder="Search ticker or company"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="rounded p-0.5 text-gray-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleDirectAdd}
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3 w-3" strokeWidth={1.5} />
                  Add
                </button>
              </div>

              {searchQuery.trim() ? (
                <div className="absolute left-3 right-3 top-[100%] mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#060d18]/95 p-1 shadow-2xl" style={{ scrollbarWidth: 'none' }}>
                  {searchLoading ? (
                    <div className="px-2 py-2 text-xs text-gray-400">Searching symbols...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={result.symbol}
                        type="button"
                        onClick={() => addSymbolToWatchlist(result.symbol, result.name, result.exchange)}
                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left hover:bg-blue-500/10"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white">${result.symbol}</div>
                          <div className="truncate text-[11px] text-gray-400">{result.name || result.symbol}</div>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-blue-300" strokeWidth={1.5} />
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-xs text-gray-400">No symbols found</div>
                  )}
                </div>
              ) : null}

              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>{activeSymbols.length}/{MAX_SYMBOLS} symbols</span>
                <span className={`inline-flex items-center gap-1 ${streamStatus.connected ? 'text-emerald-400' : streamStatus.connecting ? 'text-yellow-400' : 'text-gray-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${streamStatus.connected ? 'animate-pulse bg-emerald-400' : streamStatus.connecting ? 'bg-yellow-400' : 'bg-gray-500'}`} />
                  {streamStatus.connected ? 'Live' : streamStatus.connecting ? 'Connecting...' : 'Offline'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Last tick: {formatTime(lastUpdated)}</span>
                <button
                  type="button"
                  onClick={() => refreshQuotes({ manual: true })}
                  className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {error ? (
                <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {loading && visibleWatchlist.length === 0 ? (
                <div className="px-3 py-5 text-sm text-gray-400">Loading watchlist...</div>
              ) : null}

              {visibleWatchlist.map((item) => {
                const quote = quotesBySymbol[item.symbol] || {};
                const pct = Number(quote?.percentChange);
                const positive = Number.isFinite(pct) ? pct >= 0 : true;
                const rowActive = selectedTicker === item.symbol;

                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => setSelectedTicker(item.symbol)}
                    className={`flex w-full items-center justify-between gap-1 border-b border-[#1f1f1f]/40 px-3 py-2 text-left transition-colors ${rowActive ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'}`}
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-[13px] font-semibold text-white">${item.symbol}</div>
                      <div className="truncate text-[11px] text-gray-500">{item.name || labelMap[item.symbol] || item.symbol}</div>
                    </div>

                    <div className="flex items-center gap-1">
                      <div className="min-w-[76px] text-right">
                        <div className="text-[13px] font-mono text-white">{formatPrice(quote?.price)}</div>
                        <div className={`text-[11px] font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPercent(quote?.percentChange)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveFromWatchlist?.(item.symbol);
                        }}
                        className="rounded p-1 text-gray-500 hover:bg-red-500/15 hover:text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-2 py-3 text-center text-[10px] text-gray-500">
            {activeSymbols.length}
            <br />
            symbols
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 bg-transparent">
        {selectedTicker ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">${selectedTicker}</div>
                  <div className="text-xs text-gray-400">{selectedName || selectedTicker}</div>
                </div>
                {Number.isFinite(Number(selectedQuote?.price)) ? (
                  <span className="text-sm font-semibold text-white">{formatPrice(selectedQuote?.price)}</span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {!isOrderPanelClosed ? (
                  <button
                    type="button"
                    onClick={toggleOrderPanelSize}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/20"
                    title="Resize order panel"
                  >
                    {orderPanelState === 'open' ? 'Ticket: Large' : 'Ticket: Small'}
                  </button>
                ) : null}

                {isOrderPanelClosed ? (
                  <button
                    type="button"
                    onClick={openOrderPanel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/70 bg-transparent px-3 py-2 text-sm font-semibold text-emerald-300 hover:border-emerald-300 hover:text-emerald-200 hover:shadow-[0_0_14px_rgba(16,185,129,0.22)]"
                  >
                    Trade
                    <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeOrderPanel}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/12 hover:text-emerald-200"
                    title="Collapse order panel"
                  >
                    <span>Collapse</span>
                    <ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="min-h-0 flex-1">
                <iframe
                  key={tradingViewSymbol || selectedTicker}
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=watchlist_widget&symbol=${encodeURIComponent(tradingViewSymbol || selectedTicker)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen
                />
              </div>

              {!isOrderPanelClosed ? (
                <div
                  className="flex min-h-0 flex-col border-l border-white/10 bg-[#0a0f1a] transition-all duration-300"
                  style={{ width: ORDER_PANEL_WIDTHS[orderPanelState] }}
                >
                  <div className="border-b border-white/10 px-3 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400">Order Entry</span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: 'none' }}>
                    <div className={`space-y-4 overflow-hidden transition-all duration-300 ${orderStep === 'entry' ? 'max-h-[1400px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                      <AlpacaOrderTicket
                        side={orderSide}
                        onSideChange={(nextSide) => {
                          clearOrderError();
                          setOrderSide(nextSide);
                        }}
                        symbol={selectedTicker ? `$${selectedTicker}` : ''}
                        onSymbolSubmit={handleTicketSymbolSubmit}
                        marketPrice={marketPrice}
                        quantity={orderQty}
                        onQuantityChange={(value) => {
                          clearOrderError();
                          setOrderQty(value);
                        }}
                        orderType={orderType}
                        onOrderTypeChange={(value) => {
                          clearOrderError();
                          setOrderType(value);
                        }}
                        orderTypeOptions={ORDER_TYPE_OPTIONS}
                        sizeMode={orderSizeMode}
                        onSizeModeChange={(mode) => {
                          clearOrderError();
                          setOrderSizeMode(mode);
                        }}
                        dollarAmount={orderDollars}
                        onDollarAmountChange={(value) => {
                          clearOrderError();
                          setOrderDollars(value);
                        }}
                        timeInForce={timeInForce}
                        onTimeInForceChange={(value) => setTimeInForce(value)}
                        timeInForceOptions={TIME_IN_FORCE_OPTIONS}
                        estimatedCost={estimatedTotal}
                        buyingPowerDisplay={buyingPowerDisplay}
                        onReview={handleReview}
                        reviewDisabled={!canReview}
                        density="trade"
                        extraFields={
                          <div className="space-y-2">
                            {(orderType === 'limit' || orderType === 'stop_limit') && (
                              <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-300">Limit Price</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={limitPrice}
                                  onChange={(event) => {
                                    clearOrderError();
                                    setLimitPrice(event.target.value);
                                  }}
                                  className="h-[46px] w-full rounded-xl border border-[#1f2a3a] bg-[#050b16] px-4 text-[15px] font-semibold text-white outline-none focus:border-blue-500/60"
                                />
                              </div>
                            )}
                            {(orderType === 'stop' || orderType === 'stop_limit') && (
                              <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-300">Stop Price</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={stopPrice}
                                  onChange={(event) => {
                                    clearOrderError();
                                    setStopPrice(event.target.value);
                                  }}
                                  className="h-[46px] w-full rounded-xl border border-[#1f2a3a] bg-[#050b16] px-4 text-[15px] font-semibold text-white outline-none focus:border-blue-500/60"
                                />
                              </div>
                            )}
                            {orderType === 'trailing_stop' && (
                              <div className="space-y-1">
                                <label className="block text-sm font-semibold text-slate-300">Trail Amount ($)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={trailAmount}
                                  onChange={(event) => {
                                    clearOrderError();
                                    setTrailAmount(event.target.value);
                                  }}
                                  className="h-[46px] w-full rounded-xl border border-[#1f2a3a] bg-[#050b16] px-4 text-[15px] font-semibold text-white outline-none focus:border-blue-500/60"
                                />
                              </div>
                            )}
                            {orderSide === 'sell' && orderSizeMode === 'shares' && (
                              <div className="text-xs font-semibold text-slate-400">{availableSharesDisplay} shares available</div>
                            )}
                          </div>
                        }
                      />

                      {orderError ? <div className="text-xs text-red-300">{orderError}</div> : null}
                    </div>

                    <div className={`space-y-4 overflow-hidden transition-all duration-300 ${orderStep === 'review' ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                      <div className="space-y-3 rounded-lg border border-white/10 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Side</span>
                          <span className={orderSide === 'buy' ? 'text-emerald-300' : 'text-red-300'}>{orderSide === 'buy' ? 'Buy' : 'Sell'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Ticker</span>
                          <span className="text-white">{selectedTicker}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Order Type</span>
                          <span className="text-white">{orderTypeLabel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Size</span>
                          <span className="text-white">
                            {orderSizeMode === 'dollars'
                              ? `${formatUsd(orderDollarsNumber)} (${orderQtyNumber.toFixed(6)} shares)`
                              : orderQtyNumber}
                          </span>
                        </div>
                        {orderType === 'limit' && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Limit Price</span>
                            <span className="text-white">{formatUsd(limitPriceNumber)}</span>
                          </div>
                        )}
                        {orderType === 'stop' && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Stop Price</span>
                            <span className="text-white">{formatUsd(stopPriceNumber)}</span>
                          </div>
                        )}
                        {orderType === 'stop_limit' && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-white/60">Stop Price</span>
                              <span className="text-white">{formatUsd(stopPriceNumber)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-white/60">Limit Price</span>
                              <span className="text-white">{formatUsd(limitPriceNumber)}</span>
                            </div>
                          </>
                        )}
                        {orderType === 'trailing_stop' && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Trail Amount</span>
                            <span className="text-white">{formatUsd(trailAmountNumber)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Estimated Total</span>
                          <span className="text-white">{estimatedTotal > 0 ? formatUsd(estimatedTotal) : '--'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Time in Force</span>
                          <span className="text-white">{String(timeInForce || '').toUpperCase()}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setOrderStep('entry')}
                        className="w-full rounded-lg border border-white/20 py-2 text-sm text-white/60 hover:text-white transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitOrder}
                        disabled={orderStatus.state === 'submitting'}
                        className={`h-10 w-full rounded-lg text-sm font-medium text-white ${orderSide === 'buy' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500 hover:bg-red-400'} ${orderStatus.state === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {orderStatus.state === 'submitting' ? 'Submitting...' : 'Submit Order'}
                      </button>
                    </div>

                    <div className={`space-y-4 overflow-hidden transition-all duration-300 ${orderStep === 'confirm' ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className={`mt-1 h-5 w-5 ${orderStatus.state === 'success' ? 'text-emerald-400' : 'text-red-400'}`} />
                        <div>
                          <div className="text-lg font-medium text-white">{orderStatus.state === 'success' ? 'Order Submitted' : 'Order Failed'}</div>
                          {orderStatus.state === 'error' ? <div className="mt-1 text-sm text-red-300">{orderStatus.message}</div> : null}
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Ticker</span>
                          <span className="text-white">{selectedTicker}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Side</span>
                          <span className="text-white">{orderSide === 'buy' ? 'Buy' : 'Sell'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Size</span>
                          <span className="text-white">
                            {orderSizeMode === 'dollars'
                              ? `${formatUsd(orderDollarsNumber)} (${orderQtyNumber.toFixed(6)} shares)`
                              : orderQtyNumber}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Order Type</span>
                          <span className="text-white">{orderTypeLabel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Time in Force</span>
                          <span className="text-white">{String(timeInForce || '').toUpperCase()}</span>
                        </div>
                        {orderStatus.data?.filled_avg_price ? (
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Fill Price</span>
                            <span className="text-white">{formatUsd(orderStatus.data.filled_avg_price)}</span>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Timestamp</span>
                          <span className="text-white">{orderTimestamp ? formatTimestamp(orderTimestamp) : '--'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetOrder}
                        className="w-full rounded-lg border border-white/20 py-2 text-sm text-white/60 hover:text-white transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-gray-500">
            <div>
              <p className="text-lg text-white/70">Select a symbol</p>
              <p className="mt-1 text-sm">Add symbols on the left to build your watchlist</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistPage;
