import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Grid from '@highcharts/grid-lite';
import { getExtendedHoursStatus, getMarketStatus } from '../../lib/marketHours';
import { subscribeTwelveDataQuotes, subscribeTwelveDataStatus } from '../../services/twelveDataWebSocket';
import '@highcharts/grid-lite/css/grid.css';
import './AnalyticsWatchlistGrid.css';

const WATCHLIST_STORAGE_KEY = 'stratify-analytics-grid-watchlist';
const MAX_SYMBOLS = 120;
const QUOTE_POLL_INTERVAL_MS = 5000;
const DEFAULT_SYMBOLS = [
  'TSLA',
  'NVDA',
  'AAPL',
  'AMD',
  'PLTR',
  'META',
  'AMZN',
  'SOFI',
  'HIMS',
  'NIO',
];

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')
    .pop();

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPrice = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatSigned = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatSignedPercent = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const formatVolume = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  if (Math.abs(number) >= 1e9) return `${(number / 1e9).toFixed(2)}B`;
  if (Math.abs(number) >= 1e6) return `${(number / 1e6).toFixed(2)}M`;
  if (Math.abs(number) >= 1e3) return `${(number / 1e3).toFixed(2)}K`;
  return number.toLocaleString('en-US');
};

const getDirectionClass = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number) || number === 0) return 'watchlist-value-neutral';
  return number > 0 ? 'watchlist-value-positive' : 'watchlist-value-negative';
};

const deriveMainChangeAndPercent = (quote = {}) => {
  const price = toNumber(quote?.price);
  const previousClose = toNumber(quote?.previousClose);

  let change = toNumber(quote?.change);
  let percent = toNumber(quote?.percentChange);

  if (!Number.isFinite(change) && Number.isFinite(price) && Number.isFinite(previousClose)) {
    change = price - previousClose;
  }

  if (!Number.isFinite(percent) && Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0) {
    percent = (change / previousClose) * 100;
  }

  if (!Number.isFinite(change) && Number.isFinite(percent) && Number.isFinite(previousClose)) {
    change = previousClose * (percent / 100);
  }

  return {
    change: Number.isFinite(change) ? change : null,
    percent: Number.isFinite(percent) ? percent : null,
  };
};

const getReferencePrice = (priceValue, changeValue, percentValue) => {
  const price = toNumber(priceValue);
  const change = toNumber(changeValue);
  const percent = toNumber(percentValue);

  if (Number.isFinite(price) && Number.isFinite(change)) {
    return price - change;
  }

  if (Number.isFinite(price) && Number.isFinite(percent) && percent !== -100) {
    return price / (1 + (percent / 100));
  }

  return null;
};

const deriveExtendedMetric = (quote = {}, sessionStatus = null, marketStatus = '') => {
  const previousClose = toNumber(quote?.previousClose);
  const livePrice = toNumber(quote?.price);
  const mainMetric = deriveMainChangeAndPercent(quote);

  const buildMetric = (prefix, options = {}) => {
    const fallbackLivePrice = toNumber(options?.fallbackLivePrice);
    const fallbackReferencePrice = toNumber(options?.fallbackReferencePrice);
    let extPrice = toNumber(quote?.[`${prefix}Price`]);
    let extChange = toNumber(quote?.[`${prefix}Change`]);
    let extPercent = toNumber(quote?.[`${prefix}ChangePercent`]);
    let referencePrice = toNumber(quote?.[`${prefix}ReferencePrice`]);

    if (!Number.isFinite(extPrice) && Number.isFinite(fallbackLivePrice)) {
      extPrice = fallbackLivePrice;
    }

    if (!Number.isFinite(referencePrice) && Number.isFinite(fallbackReferencePrice)) {
      referencePrice = fallbackReferencePrice;
    }

    if (!Number.isFinite(referencePrice)) {
      referencePrice = getReferencePrice(extPrice, extChange, extPercent);
    }

    if (!Number.isFinite(extChange) && Number.isFinite(extPrice) && Number.isFinite(referencePrice)) {
      extChange = extPrice - referencePrice;
    }

    if (!Number.isFinite(extPercent) && Number.isFinite(extChange) && Number.isFinite(referencePrice) && referencePrice !== 0) {
      extPercent = (extChange / referencePrice) * 100;
    }

    if (!Number.isFinite(extChange) && Number.isFinite(extPercent) && Number.isFinite(referencePrice)) {
      extChange = referencePrice * (extPercent / 100);
    }

    return {
      price: Number.isFinite(extPrice) ? extPrice : null,
      change: Number.isFinite(extChange) ? extChange : null,
      percent: Number.isFinite(extPercent) ? extPercent : null,
      referencePrice: Number.isFinite(referencePrice) ? referencePrice : null,
    };
  };

  const deriveFromLive = (label) => {
    if (Number.isFinite(livePrice) && Number.isFinite(previousClose)) {
      const change = livePrice - previousClose;
      return {
        label,
        price: livePrice,
        change,
        percent: previousClose !== 0 ? (change / previousClose) * 100 : null,
      };
    }

    return {
      label,
      price: Number.isFinite(livePrice) ? livePrice : null,
      change: mainMetric.change,
      percent: mainMetric.percent,
    };
  };

  if (marketStatus === 'Open') {
    return {
      label: 'Live',
      price: Number.isFinite(livePrice) ? livePrice : null,
      change: mainMetric.change,
      percent: mainMetric.percent,
    };
  }

  const pre = buildMetric('preMarket', {
    fallbackLivePrice: sessionStatus === 'pre-market' ? livePrice : null,
    fallbackReferencePrice: previousClose,
  });
  const post = buildMetric('afterHours', {
    fallbackLivePrice: sessionStatus === 'post-market' ? livePrice : null,
    fallbackReferencePrice: toNumber(quote?.afterHoursReferencePrice),
  });

  if (sessionStatus === 'pre-market' || marketStatus === 'Pre-Market') {
    if (Number.isFinite(pre.percent) || Number.isFinite(pre.change)) {
      return { label: 'Pre', ...pre };
    }
    return deriveFromLive('Pre');
  }

  if (sessionStatus === 'post-market' || marketStatus === 'After Hours') {
    if (Number.isFinite(post.percent) || Number.isFinite(post.change)) {
      return { label: 'Post', ...post };
    }
    return { label: 'Post', price: null, change: null, percent: null };
  }

  if (Number.isFinite(post.percent) || Number.isFinite(post.change)) {
    return { label: 'Post', ...post };
  }

  if (Number.isFinite(pre.percent) || Number.isFinite(pre.change)) {
    return { label: 'Pre', ...pre };
  }

  return { label: 'Ext', price: null, change: null, percent: null };
};

const loadStoredSymbols = () => {
  if (typeof window === 'undefined') return DEFAULT_SYMBOLS;
  try {
    const raw = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
    const source = Array.isArray(raw) ? raw : [];
    const cleaned = source.map((symbol) => normalizeSymbol(symbol)).filter(Boolean);
    if (cleaned.length > 0) return cleaned.slice(0, MAX_SYMBOLS);
  } catch {}
  return DEFAULT_SYMBOLS;
};

const extractInputSymbols = (value) =>
  String(value || '')
    .split(',')
    .map((item) => normalizeSymbol(item))
    .filter(Boolean);

const buildExtCell = (symbol, metric, mode = 'percent') => {
  const toneValue = Number.isFinite(toNumber(metric?.percent)) ? metric?.percent : metric?.change;
  const directionClass = getDirectionClass(toneValue);
  const hasValue = mode === 'dollar'
    ? Number.isFinite(toNumber(metric?.change))
    : Number.isFinite(toNumber(metric?.percent));

  if (!hasValue) {
    return '<span class="watchlist-value watchlist-value-neutral">--</span>';
  }

  const renderedValue = mode === 'dollar'
    ? formatSigned(metric?.change)
    : formatSignedPercent(metric?.percent);

  return `
    <button
      type="button"
      class="watchlist-ext-btn watchlist-value ${directionClass}"
      data-symbol="${symbol}"
      title="Click to toggle % / $"
    >
      ${renderedValue}
    </button>
  `;
};

const buildDeleteCell = (symbol) => `
  <button
    type="button"
    class="watchlist-remove-btn"
    data-symbol="${symbol}"
    aria-label="Remove ${symbol}"
    title="Remove ${symbol}"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 10v7M14 10v7" />
    </svg>
  </button>
`;

function generateWatchlistColumns(rows) {
  const columns = {
    Symbol: [],
    Last: [],
    Chg: [],
    ChgPercent: [],
    Vol: [],
    Ext: [],
  };

  rows.forEach((row) => {
    columns.Symbol.push(row.symbol);
    columns.Last.push(row.last);
    columns.Chg.push(row.chg);
    columns.ChgPercent.push(row.chgPercent);
    columns.Vol.push(row.vol);
    columns.Ext.push(row.ext);
  });

  return columns;
}

export default function AnalyticsPage() {
  const [symbols, setSymbols] = useState(loadStoredSymbols);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [extDisplayModeBySymbol, setExtDisplayModeBySymbol] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const gridRef = useRef(null);
  const searchWrapRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchOpen]);

  const removeSymbol = useCallback((symbolToRemove) => {
    const target = normalizeSymbol(symbolToRemove);
    if (!target) return;

    setSymbols((previous) => previous.filter((symbol) => normalizeSymbol(symbol) !== target));
    setQuotesBySymbol((previous) => {
      const next = { ...previous };
      delete next[target];
      return next;
    });
    setExtDisplayModeBySymbol((previous) => {
      const next = { ...previous };
      delete next[target];
      return next;
    });
  }, []);

  const toggleExtDisplayMode = useCallback((symbolToToggle) => {
    const target = normalizeSymbol(symbolToToggle);
    if (!target) return;

    setExtDisplayModeBySymbol((previous) => ({
      ...previous,
      [target]: previous[target] === 'dollar' ? 'percent' : 'dollar',
    }));
  }, []);

  useEffect(() => {
    const container = document.getElementById('analytics-watchlist-grid');
    if (!container) return undefined;

    const handleGridClick = (event) => {
      const extButton = event.target?.closest?.('.watchlist-ext-btn');
      if (extButton) {
        const targetSymbol = normalizeSymbol(extButton.getAttribute('data-symbol'));
        if (targetSymbol) toggleExtDisplayMode(targetSymbol);
        return;
      }

      const button = event.target?.closest?.('.watchlist-remove-btn');
      if (!button) return;
      const targetSymbol = normalizeSymbol(button.getAttribute('data-symbol'));
      if (!targetSymbol) return;
      removeSymbol(targetSymbol);
    };

    container.addEventListener('click', handleGridClick);
    return () => container.removeEventListener('click', handleGridClick);
  }, [removeSymbol, toggleExtDisplayMode]);

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) {
      setQuotesBySymbol({});
      return;
    }

    setFetchError('');

    try {
      const params = new URLSearchParams({ symbols: symbols.join(',') });
      const response = await fetch(`/api/stocks?${params.toString()}`, { cache: 'no-store' });

      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error('Failed to load watchlist quotes');
      }

      const rows = Array.isArray(payload) ? payload : [];
      const next = {};

      rows.forEach((row) => {
        const symbol = normalizeSymbol(row?.symbol);
        if (!symbol) return;

        const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
        const parsedPrice = toNumber(row?.price ?? raw?.close ?? raw?.price ?? raw?.last);
        const parsedChange = toNumber(row?.change ?? raw?.change);
        const parsedPercent = toNumber(
          row?.changePercent ?? row?.percentChange ?? raw?.percent_change ?? raw?.percentChange
        );
        let parsedPreviousClose = toNumber(
          row?.previousClose
          ?? raw?.previous_close
          ?? raw?.previousClose
          ?? raw?.prev_close
          ?? raw?.prevClose
        );

        if (!Number.isFinite(parsedPreviousClose) && Number.isFinite(parsedPrice) && Number.isFinite(parsedChange)) {
          parsedPreviousClose = parsedPrice - parsedChange;
        }

        if (
          !Number.isFinite(parsedPreviousClose)
          && Number.isFinite(parsedPrice)
          && Number.isFinite(parsedPercent)
          && parsedPercent !== -100
        ) {
          parsedPreviousClose = parsedPrice / (1 + (parsedPercent / 100));
        }

        const parsedPreMarketPrice = toNumber(row?.preMarketPrice ?? raw?.pre_market_price ?? raw?.premarket_price);
        const parsedPreMarketChange = toNumber(row?.preMarketChange ?? raw?.pre_market_change ?? raw?.premarket_change);
        const parsedPreMarketChangePercent = toNumber(
          row?.preMarketChangePercent
          ?? raw?.pre_market_change_percent
          ?? raw?.premarket_change_percent
        );
        const parsedAfterHoursPrice = toNumber(row?.afterHoursPrice ?? raw?.after_hours_price ?? raw?.post_market_price);
        const parsedAfterHoursChange = toNumber(row?.afterHoursChange ?? raw?.after_hours_change ?? raw?.post_market_change);
        const parsedAfterHoursChangePercent = toNumber(
          row?.afterHoursChangePercent
          ?? raw?.after_hours_change_percent
          ?? raw?.post_market_change_percent
        );

        const parsedPreMarketReferencePrice = getReferencePrice(
          parsedPreMarketPrice,
          parsedPreMarketChange,
          parsedPreMarketChangePercent
        ) ?? parsedPreviousClose;

        const parsedAfterHoursReferencePrice = getReferencePrice(
          parsedAfterHoursPrice,
          parsedAfterHoursChange,
          parsedAfterHoursChangePercent
        );

        next[symbol] = {
          symbol,
          name: String(row?.name || raw?.name || symbol).trim(),
          price: parsedPrice,
          change: parsedChange,
          percentChange: parsedPercent,
          previousClose: parsedPreviousClose,
          preMarketPrice: parsedPreMarketPrice,
          preMarketChange: parsedPreMarketChange,
          preMarketChangePercent: parsedPreMarketChangePercent,
          preMarketReferencePrice: parsedPreMarketReferencePrice,
          afterHoursPrice: parsedAfterHoursPrice,
          afterHoursChange: parsedAfterHoursChange,
          afterHoursChangePercent: parsedAfterHoursChangePercent,
          afterHoursReferencePrice: parsedAfterHoursReferencePrice,
          volume: toNumber(row?.volume ?? raw?.volume ?? raw?.day_volume),
          timestamp: row?.timestamp || raw?.datetime || raw?.timestamp || null,
        };
      });

      setQuotesBySymbol((previous) => {
        const merged = {};
        symbols.forEach((symbolValue) => {
          const normalized = normalizeSymbol(symbolValue);
          merged[normalized] = next[normalized] || previous[normalized] || {
            symbol: normalized,
            name: normalized,
          };
        });
        return merged;
      });
    } catch (error) {
      setFetchError(error?.message || 'Failed to load watchlist quotes');
    }
  }, [symbols]);

  useEffect(() => {
    fetchQuotes();
    const timer = window.setInterval(fetchQuotes, QUOTE_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [fetchQuotes]);

  useEffect(() => {
    if (symbols.length === 0) return undefined;
    const unsubscribeQuotes = subscribeTwelveDataQuotes(symbols, (update) => {
      const symbol = normalizeSymbol(update?.symbol);
      const livePrice = toNumber(update?.price);
      if (!symbol || !Number.isFinite(livePrice)) return;

      setQuotesBySymbol((previous) => {
        const current = previous[symbol];
        if (!current) return previous;

        let previousClose = toNumber(current.previousClose);
        if (!Number.isFinite(previousClose)) {
          const knownPrice = toNumber(current.price);
          const knownChange = toNumber(current.change);
          const knownPercent = toNumber(current.percentChange);
          if (Number.isFinite(knownPrice) && Number.isFinite(knownChange)) {
            previousClose = knownPrice - knownChange;
          } else if (Number.isFinite(knownPrice) && Number.isFinite(knownPercent) && knownPercent !== -100) {
            previousClose = knownPrice / (1 + (knownPercent / 100));
          }
        }

        let nextChange = toNumber(update?.change);
        let nextPercent = toNumber(update?.percentChange);

        if (!Number.isFinite(nextChange) && Number.isFinite(previousClose)) {
          nextChange = livePrice - previousClose;
        }

        if (!Number.isFinite(nextPercent) && Number.isFinite(nextChange) && Number.isFinite(previousClose) && previousClose !== 0) {
          nextPercent = (nextChange / previousClose) * 100;
        }

        if (!Number.isFinite(nextChange) && Number.isFinite(nextPercent) && Number.isFinite(previousClose)) {
          nextChange = previousClose * (nextPercent / 100);
        }

        const sessionStatus = getExtendedHoursStatus();
        const marketStatus = getMarketStatus();
        const isPreMarket = sessionStatus === 'pre-market' || marketStatus === 'Pre-Market';
        const isPostMarket = sessionStatus === 'post-market' || marketStatus === 'After Hours';
        const rawPayload = update?.raw && typeof update.raw === 'object' ? update.raw : {};
        const payloadPreMarketPrice = toNumber(
          rawPayload?.pre_market_price
          ?? rawPayload?.premarket_price
          ?? rawPayload?.preMarketPrice
        );
        const payloadPreMarketChange = toNumber(
          rawPayload?.pre_market_change
          ?? rawPayload?.premarket_change
          ?? rawPayload?.preMarketChange
        );
        const payloadPreMarketPercent = toNumber(
          rawPayload?.pre_market_change_percent
          ?? rawPayload?.premarket_change_percent
          ?? rawPayload?.preMarketChangePercent
        );
        const payloadAfterHoursPrice = toNumber(
          rawPayload?.after_hours_price
          ?? rawPayload?.post_market_price
          ?? rawPayload?.postmarket_price
          ?? rawPayload?.afterHoursPrice
        );
        const payloadAfterHoursChange = toNumber(
          rawPayload?.after_hours_change
          ?? rawPayload?.post_market_change
          ?? rawPayload?.postmarket_change
          ?? rawPayload?.afterHoursChange
        );
        const payloadAfterHoursPercent = toNumber(
          rawPayload?.after_hours_change_percent
          ?? rawPayload?.post_market_change_percent
          ?? rawPayload?.postmarket_change_percent
          ?? rawPayload?.afterHoursChangePercent
        );

        let preMarketReferencePrice = toNumber(current.preMarketReferencePrice);
        if (!Number.isFinite(preMarketReferencePrice) && Number.isFinite(previousClose)) {
          preMarketReferencePrice = previousClose;
        }

        let afterHoursReferencePrice = toNumber(current.afterHoursReferencePrice);
        if (!Number.isFinite(afterHoursReferencePrice)) {
          afterHoursReferencePrice = getReferencePrice(
            current.afterHoursPrice,
            current.afterHoursChange,
            current.afterHoursChangePercent
          );
        }

        const next = {
          ...current,
          // During pre-market/post-market, freeze Last price at previous close
          // Only update preMarketPrice or afterHoursPrice for the Ext column
          price: (isPreMarket || isPostMarket) && Number.isFinite(previousClose)
            ? previousClose
            : livePrice,
          change: Number.isFinite(nextChange) ? nextChange : toNumber(current.change),
          percentChange: Number.isFinite(nextPercent) ? nextPercent : toNumber(current.percentChange),
          volume: toNumber(update?.volume ?? current.volume),
          timestamp: update?.timestamp || new Date().toISOString(),
        };

        if (Number.isFinite(previousClose)) {
          next.previousClose = previousClose;
        }

        if (isPreMarket) {
          const nextPrePrice = Number.isFinite(payloadPreMarketPrice) ? payloadPreMarketPrice : livePrice;
          let nextPreChange = Number.isFinite(payloadPreMarketChange) ? payloadPreMarketChange : null;
          let nextPrePercent = Number.isFinite(payloadPreMarketPercent) ? payloadPreMarketPercent : null;

          if (!Number.isFinite(preMarketReferencePrice)) {
            preMarketReferencePrice = getReferencePrice(nextPrePrice, nextPreChange, nextPrePercent);
          }

          if (!Number.isFinite(nextPreChange) && Number.isFinite(nextPrePrice) && Number.isFinite(preMarketReferencePrice)) {
            nextPreChange = nextPrePrice - preMarketReferencePrice;
          }

          if (
            !Number.isFinite(nextPrePercent)
            && Number.isFinite(nextPreChange)
            && Number.isFinite(preMarketReferencePrice)
            && preMarketReferencePrice !== 0
          ) {
            nextPrePercent = (nextPreChange / preMarketReferencePrice) * 100;
          }

          if (!Number.isFinite(nextPreChange) && Number.isFinite(nextPrePercent) && Number.isFinite(preMarketReferencePrice)) {
            nextPreChange = preMarketReferencePrice * (nextPrePercent / 100);
          }

          next.preMarketPrice = Number.isFinite(nextPrePrice) ? nextPrePrice : null;
          next.preMarketChange = Number.isFinite(nextPreChange) ? nextPreChange : null;
          next.preMarketChangePercent = Number.isFinite(nextPrePercent) ? nextPrePercent : null;

          if (Number.isFinite(preMarketReferencePrice)) {
            next.preMarketReferencePrice = preMarketReferencePrice;
          }
        }

        if (isPostMarket) {
          const nextPostPrice = Number.isFinite(payloadAfterHoursPrice) ? payloadAfterHoursPrice : livePrice;
          let nextPostChange = Number.isFinite(payloadAfterHoursChange) ? payloadAfterHoursChange : null;
          let nextPostPercent = Number.isFinite(payloadAfterHoursPercent) ? payloadAfterHoursPercent : null;

          if (!Number.isFinite(afterHoursReferencePrice)) {
            afterHoursReferencePrice = getReferencePrice(nextPostPrice, nextPostChange, nextPostPercent);
          }

          if (!Number.isFinite(nextPostChange) && Number.isFinite(nextPostPrice) && Number.isFinite(afterHoursReferencePrice)) {
            nextPostChange = nextPostPrice - afterHoursReferencePrice;
          }

          if (
            !Number.isFinite(nextPostPercent)
            && Number.isFinite(nextPostChange)
            && Number.isFinite(afterHoursReferencePrice)
            && afterHoursReferencePrice !== 0
          ) {
            nextPostPercent = (nextPostChange / afterHoursReferencePrice) * 100;
          }

          if (!Number.isFinite(nextPostChange) && Number.isFinite(nextPostPercent) && Number.isFinite(afterHoursReferencePrice)) {
            nextPostChange = afterHoursReferencePrice * (nextPostPercent / 100);
          }

          next.afterHoursPrice = Number.isFinite(nextPostPrice) ? nextPostPrice : null;
          next.afterHoursChange = Number.isFinite(nextPostChange) ? nextPostChange : null;
          next.afterHoursChangePercent = Number.isFinite(nextPostPercent) ? nextPostPercent : null;

          if (Number.isFinite(afterHoursReferencePrice)) {
            next.afterHoursReferencePrice = afterHoursReferencePrice;
          }
        }

        return {
          ...previous,
          [symbol]: next,
        };
      });
    });

    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      if (status?.error) {
        setFetchError(status.error);
      }
    });

    return () => {
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [symbols]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    const query = searchQuery.trim().toUpperCase();
    setSearchLoading(true);

    const CRYPTO_SYMBOLS = [
      { symbol: 'BTC/USD', name: 'Bitcoin', exchange: 'Crypto' },
      { symbol: 'ETH/USD', name: 'Ethereum', exchange: 'Crypto' },
      { symbol: 'SOL/USD', name: 'Solana', exchange: 'Crypto' },
      { symbol: 'XRP/USD', name: 'Ripple', exchange: 'Crypto' },
      { symbol: 'BNB/USD', name: 'Binance Coin', exchange: 'Crypto' },
      { symbol: 'ADA/USD', name: 'Cardano', exchange: 'Crypto' },
      { symbol: 'DOGE/USD', name: 'Dogecoin', exchange: 'Crypto' },
      { symbol: 'AVAX/USD', name: 'Avalanche', exchange: 'Crypto' },
      { symbol: 'DOT/USD', name: 'Polkadot', exchange: 'Crypto' },
      { symbol: 'MATIC/USD', name: 'Polygon', exchange: 'Crypto' },
      { symbol: 'LINK/USD', name: 'Chainlink', exchange: 'Crypto' },
      { symbol: 'UNI/USD', name: 'Uniswap', exchange: 'Crypto' },
      { symbol: 'ATOM/USD', name: 'Cosmos', exchange: 'Crypto' },
      { symbol: 'LTC/USD', name: 'Litecoin', exchange: 'Crypto' },
      { symbol: 'BCH/USD', name: 'Bitcoin Cash', exchange: 'Crypto' },
      { symbol: 'XLM/USD', name: 'Stellar', exchange: 'Crypto' },
      { symbol: 'ALGO/USD', name: 'Algorand', exchange: 'Crypto' },
      { symbol: 'VET/USD', name: 'VeChain', exchange: 'Crypto' },
      { symbol: 'ICP/USD', name: 'Internet Computer', exchange: 'Crypto' },
      { symbol: 'FIL/USD', name: 'Filecoin', exchange: 'Crypto' },
    ];

    const cryptoMatches = CRYPTO_SYMBOLS.filter(
      (crypto) =>
        crypto.symbol.includes(query) ||
        crypto.name.toUpperCase().includes(query)
    );

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;

        const stockList = Array.isArray(payload?.results) ? payload.results : [];
        const stockResults = stockList
          .map((item) => ({
            symbol: normalizeSymbol(item?.symbol),
            name: String(item?.name || '').trim(),
            exchange: String(item?.exchange || '').trim(),
          }))
          .filter((item) => item.symbol);

        setSearchResults([...cryptoMatches, ...stockResults]);
      } catch (error) {
        if (error?.name !== 'AbortError' && active) {
          setSearchResults(cryptoMatches);
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const gridRows = useMemo(() => {
    const sessionStatus = getExtendedHoursStatus();
    const marketStatus = getMarketStatus();

    return symbols.map((rawSymbol) => {
      const symbol = normalizeSymbol(rawSymbol);
      const quote = quotesBySymbol[symbol] || { symbol, name: symbol };
      const mainMetric = deriveMainChangeAndPercent(quote);
      const extMetric = deriveExtendedMetric(quote, sessionStatus, marketStatus);
      const extMode = extDisplayModeBySymbol[symbol] === 'dollar' ? 'dollar' : 'percent';
      const directionClass = getDirectionClass(mainMetric.percent ?? mainMetric.change);

      return {
        symbol: `
          <span class="watchlist-symbol-cell">
            <span class="watchlist-symbol-text">${symbol}</span>
            ${buildDeleteCell(symbol)}
          </span>
        `,
        last: `<span class="watchlist-value watchlist-value-neutral">${formatPrice(quote.price)}</span>`,
        chg: `<span class="watchlist-value ${directionClass}">${formatSigned(mainMetric.change)}</span>`,
        chgPercent: `<span class="watchlist-value ${directionClass}">${formatSignedPercent(mainMetric.percent)}</span>`,
        vol: `<span class="watchlist-value watchlist-value-neutral">${formatVolume(quote.volume)}</span>`,
        ext: buildExtCell(symbol, extMetric, extMode),
      };
    });
  }, [extDisplayModeBySymbol, quotesBySymbol, symbols]);

  const dataTable = useMemo(
    () => ({
      columns: generateWatchlistColumns(gridRows),
    }),
    [gridRows]
  );

  useEffect(() => {
    if (gridRef.current) return undefined;

    const grid = Grid.grid('analytics-watchlist-grid', {
      dataTable,
      rendering: {
        rows: {
          minVisibleRows: 18,
        },
      },
      pagination: {
        enabled: false,
      },
      columns: [
        { id: 'Symbol', width: 280 },
        { id: 'Last', width: 170 },
        { id: 'Chg', width: 160 },
        { id: 'ChgPercent', title: 'Chg%', width: 170 },
        { id: 'Vol', width: 170 },
        { id: 'Ext', width: 170 },
      ],
    });

    gridRef.current = grid;

    return () => {
      if (gridRef.current) {
        gridRef.current.destroy();
        gridRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    try {
      gridRef.current.update({ dataTable });
    } catch {
      if (gridRef.current) {
        gridRef.current.destroy();
        gridRef.current = null;
      }
      gridRef.current = Grid.grid('analytics-watchlist-grid', {
        dataTable,
        rendering: {
          rows: {
            minVisibleRows: 18,
          },
        },
        pagination: {
          enabled: false,
        },
        columns: [
          { id: 'Symbol', width: 280 },
          { id: 'Last', width: 170 },
          { id: 'Chg', width: 160 },
          { id: 'ChgPercent', title: 'Chg%', width: 170 },
          { id: 'Vol', width: 170 },
          { id: 'Ext', width: 170 },
        ],
      });
    }
  }, [dataTable]);

  const addSymbols = useCallback((items = []) => {
    const normalized = items.map((item) => normalizeSymbol(item)).filter(Boolean);
    if (normalized.length === 0) return;

    setSymbols((previous) => {
      const seen = new Set(previous.map((item) => normalizeSymbol(item)));
      const next = [...previous];

      normalized.forEach((symbol) => {
        if (seen.has(symbol)) return;
        if (next.length >= MAX_SYMBOLS) return;
        seen.add(symbol);
        next.push(symbol);
      });

      return next;
    });
  }, []);

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    const pickedResult = searchResults[0]?.symbol;
    const nextSymbols = pickedResult ? [pickedResult] : extractInputSymbols(searchQuery);
    if (nextSymbols.length === 0) return;
    addSymbols(nextSymbols);
    setSearchQuery('');
    setSearchOpen(false);
    setSearchResults([]);
  };

  const handlePickSearch = (symbol) => {
    addSymbols([symbol]);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="watchlist-grid-page">
      <div className="watchlist-grid-shell">
        <form className="watchlist-grid-controls" onSubmit={handleSubmitSearch}>
          <div className="watchlist-grid-search" ref={searchWrapRef}>
            <input
              className="watchlist-grid-input watchlist-grid-single-input"
              value={searchQuery}
              onChange={(event) => {
                setSearchOpen(true);
                setSearchQuery(event.target.value);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search and add ticker (press Enter)"
            />
            {searchOpen && (searchQuery.trim() || searchLoading) && (
              <div className="watchlist-grid-search-results">
                {searchLoading ? (
                  <div className="watchlist-grid-search-empty">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="watchlist-grid-search-empty">No results</div>
                ) : (
                  searchResults.slice(0, 10).map((item) => (
                    <button
                      key={`${item.symbol}-${item.exchange}`}
                      type="button"
                      className="watchlist-grid-search-item"
                      onClick={() => handlePickSearch(item.symbol)}
                    >
                      <span className="watchlist-grid-search-symbol">{item.symbol}</span>
                      <span className="watchlist-grid-search-name">{item.name || item.exchange || ''}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </form>

        {fetchError && <div className="watchlist-grid-error">{fetchError}</div>}
        <div id="analytics-watchlist-grid" className="watchlist-grid-container" />
      </div>
    </div>
  );
}
