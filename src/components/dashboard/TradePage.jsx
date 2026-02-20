import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight, GripVertical, CheckCircle2, Pin } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import BreakingNewsBanner from './BreakingNewsBanner';
import SocialSentiment from './SocialSentiment';
import AlpacaLightweightChart from './AlpacaLightweightChart';
import TwelveDataLightweightChart from './TwelveDataLightweightChart';
import TransparentChart from './TransparentChart';
import AlpacaOrderTicket from './AlpacaOrderTicket';
import useBreakingNews from '../../hooks/useBreakingNews';
import useAlpacaStream from '../../hooks/useAlpacaStream';
import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';
const TRADE_UI_LOCAL_KEY = 'stratify-trade-ui-state';
const TRADE_UI_USER_STATE_KEY = 'trade_ui';
const DEFAULT_PINNED_TABS = ['NVDA', 'TSLA', 'AAPL'];

const US_STOCK_UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', exchange: 'NASDAQ' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', exchange: 'NASDAQ' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Class B', exchange: 'NYSE' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', exchange: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
  { symbol: 'UNH', name: 'UnitedHealth Group', exchange: 'NYSE' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
  { symbol: 'PG', name: 'Procter & Gamble', exchange: 'NYSE' },
  { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE' },
  { symbol: 'HD', name: 'Home Depot', exchange: 'NYSE' },
  { symbol: 'COST', name: 'Costco Wholesale', exchange: 'NASDAQ' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', exchange: 'NYSE' },
  { symbol: 'MRK', name: 'Merck & Co., Inc.', exchange: 'NYSE' },
  { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE' },
  { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE' },
  { symbol: 'KO', name: 'Coca-Cola Company', exchange: 'NYSE' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', exchange: 'NASDAQ' },
  { symbol: 'CRM', name: 'Salesforce, Inc.', exchange: 'NYSE' },
  { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ' },
  { symbol: 'ACN', name: 'Accenture plc', exchange: 'NYSE' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', exchange: 'NASDAQ' },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ' },
  { symbol: 'QCOM', name: 'Qualcomm, Inc.', exchange: 'NASDAQ' },
  { symbol: 'TMUS', name: 'T-Mobile US, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MCD', name: "McDonald's Corporation", exchange: 'NYSE' },
  { symbol: 'ABT', name: 'Abbott Laboratories', exchange: 'NYSE' },
  { symbol: 'DHR', name: 'Danaher Corporation', exchange: 'NYSE' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific', exchange: 'NYSE' },
  { symbol: 'TXN', name: 'Texas Instruments', exchange: 'NASDAQ' },
  { symbol: 'INTU', name: 'Intuit Inc.', exchange: 'NASDAQ' },
  { symbol: 'LIN', name: 'Linde plc', exchange: 'NASDAQ' },
  { symbol: 'AMGN', name: 'Amgen Inc.', exchange: 'NASDAQ' },
  { symbol: 'DIS', name: 'Walt Disney Company', exchange: 'NYSE' },
  { symbol: 'PM', name: 'Philip Morris International', exchange: 'NYSE' },
  { symbol: 'RTX', name: 'RTX Corporation', exchange: 'NYSE' },
  { symbol: 'GE', name: 'GE Aerospace', exchange: 'NYSE' },
  { symbol: 'SPGI', name: 'S&P Global Inc.', exchange: 'NYSE' },
  { symbol: 'IBM', name: 'IBM', exchange: 'NYSE' },
  { symbol: 'WFC', name: 'Wells Fargo & Company', exchange: 'NYSE' },
  { symbol: 'GS', name: 'Goldman Sachs Group', exchange: 'NYSE' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NYSE' },
  { symbol: 'BLK', name: 'BlackRock, Inc.', exchange: 'NYSE' },
  { symbol: 'BKNG', name: 'Booking Holdings Inc.', exchange: 'NASDAQ' },
  { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ' },
  { symbol: 'GILD', name: 'Gilead Sciences, Inc.', exchange: 'NASDAQ' },
  { symbol: 'NOW', name: 'ServiceNow, Inc.', exchange: 'NYSE' },
  { symbol: 'ADP', name: 'Automatic Data Processing', exchange: 'NASDAQ' },
  { symbol: 'LRCX', name: 'Lam Research Corp.', exchange: 'NASDAQ' },
  { symbol: 'MU', name: 'Micron Technology, Inc.', exchange: 'NASDAQ' },
  { symbol: 'KLAC', name: 'KLA Corporation', exchange: 'NASDAQ' },
  { symbol: 'PANW', name: 'Palo Alto Networks', exchange: 'NASDAQ' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', exchange: 'NASDAQ' },
  { symbol: 'SNPS', name: 'Synopsys, Inc.', exchange: 'NASDAQ' },
  { symbol: 'CDNS', name: 'Cadence Design Systems', exchange: 'NASDAQ' },
  { symbol: 'ANET', name: 'Arista Networks', exchange: 'NYSE' },
  { symbol: 'SNOW', name: 'Snowflake Inc.', exchange: 'NYSE' },
  { symbol: 'PLTR', name: 'Palantir Technologies', exchange: 'NASDAQ' },
  { symbol: 'UBER', name: 'Uber Technologies', exchange: 'NYSE' },
  { symbol: 'ABNB', name: 'Airbnb, Inc.', exchange: 'NASDAQ' },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', exchange: 'NASDAQ' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.', exchange: 'NASDAQ' },
  { symbol: 'SHOP', name: 'Shopify Inc.', exchange: 'NASDAQ' },
  { symbol: 'SOFI', name: 'SoFi Technologies, Inc.', exchange: 'NASDAQ' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.', exchange: 'NASDAQ' },
  { symbol: 'RIVN', name: 'Rivian Automotive', exchange: 'NASDAQ' },
  { symbol: 'NIO', name: 'NIO Inc.', exchange: 'NYSE' },
  { symbol: 'F', name: 'Ford Motor Company', exchange: 'NYSE' },
  { symbol: 'GM', name: 'General Motors Company', exchange: 'NYSE' },
  { symbol: 'T', name: 'AT&T Inc.', exchange: 'NYSE' },
  { symbol: 'VZ', name: 'Verizon Communications', exchange: 'NYSE' },
  { symbol: 'CMCSA', name: 'Comcast Corporation', exchange: 'NASDAQ' },
  { symbol: 'CHTR', name: 'Charter Communications', exchange: 'NASDAQ' },
  { symbol: 'DE', name: 'Deere & Company', exchange: 'NYSE' },
  { symbol: 'NKE', name: 'Nike, Inc.', exchange: 'NYSE' },
  { symbol: 'PFE', name: 'Pfizer Inc.', exchange: 'NYSE' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb', exchange: 'NYSE' },
  { symbol: 'LLY', name: 'Eli Lilly and Company', exchange: 'NYSE' },
  { symbol: 'VRTX', name: 'Vertex Pharmaceuticals', exchange: 'NASDAQ' },
  { symbol: 'MDT', name: 'Medtronic plc', exchange: 'NYSE' },
  { symbol: 'SYK', name: 'Stryker Corporation', exchange: 'NYSE' },
  { symbol: 'C', name: 'Citigroup Inc.', exchange: 'NYSE' },
  { symbol: 'USB', name: 'U.S. Bancorp', exchange: 'NYSE' },
  { symbol: 'CME', name: 'CME Group Inc.', exchange: 'NASDAQ' },
  { symbol: 'ICE', name: 'Intercontinental Exchange', exchange: 'NYSE' },
  { symbol: 'AON', name: 'Aon plc', exchange: 'NYSE' },
  { symbol: 'CB', name: 'Chubb Limited', exchange: 'NYSE' },
  { symbol: 'MMC', name: 'Marsh & McLennan Companies', exchange: 'NYSE' },
  { symbol: 'HCA', name: 'HCA Healthcare', exchange: 'NYSE' },
  { symbol: 'ZTS', name: 'Zoetis Inc.', exchange: 'NYSE' },
  { symbol: 'ROST', name: 'Ross Stores, Inc.', exchange: 'NASDAQ' },
  { symbol: 'WDAY', name: 'Workday, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MELI', name: 'MercadoLibre, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MAR', name: 'Marriott International', exchange: 'NASDAQ' },
  { symbol: 'APD', name: 'Air Products and Chemicals', exchange: 'NYSE' },
  { symbol: 'ETN', name: 'Eaton Corporation', exchange: 'NYSE' },
  { symbol: 'DUK', name: 'Duke Energy Corporation', exchange: 'NYSE' },
  { symbol: 'SO', name: 'Southern Company', exchange: 'NYSE' },
  { symbol: 'FDX', name: 'FedEx Corporation', exchange: 'NYSE' },
  { symbol: 'UPS', name: 'United Parcel Service', exchange: 'NYSE' },
  { symbol: 'UNP', name: 'Union Pacific Corporation', exchange: 'NYSE' },
  { symbol: 'PLD', name: 'Prologis, Inc.', exchange: 'NYSE' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ' },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF', exchange: 'NYSE' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', exchange: 'NYSE' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', exchange: 'NYSE' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR', exchange: 'NYSE' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR', exchange: 'NYSE' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR', exchange: 'NYSE' },
  { symbol: 'XLI', name: 'Industrial Select Sector SPDR', exchange: 'NYSE' },
  { symbol: 'XLY', name: 'Consumer Discretionary SPDR', exchange: 'NYSE' },
  { symbol: 'SQ', name: 'Block, Inc.', exchange: 'NYSE' },
  { symbol: 'NET', name: 'Cloudflare, Inc.', exchange: 'NYSE' },
  { symbol: 'HIMS', name: 'Hims & Hers Health', exchange: 'NYSE' },
  { symbol: 'MARA', name: 'Marathon Digital', exchange: 'NASDAQ' },
  { symbol: 'SMCI', name: 'Super Micro Computer', exchange: 'NASDAQ' },
  { symbol: 'ARM', name: 'Arm Holdings', exchange: 'NASDAQ' },
  { symbol: 'RKLB', name: 'Rocket Lab USA', exchange: 'NASDAQ' },
  { symbol: 'GME', name: 'GameStop Corp.', exchange: 'NYSE' },
  { symbol: 'AMC', name: 'AMC Entertainment', exchange: 'NYSE' },
  { symbol: 'BA', name: 'Boeing Company', exchange: 'NYSE' },
  { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ' },
];

const LSE_STOCK_UNIVERSE = [
  { symbol: 'SHEL', name: 'Shell plc', exchange: 'LSE' },
  { symbol: 'AZN', name: 'AstraZeneca plc', exchange: 'LSE' },
  { symbol: 'HSBA', name: 'HSBC Holdings plc', exchange: 'LSE' },
  { symbol: 'ULVR', name: 'Unilever plc', exchange: 'LSE' },
  { symbol: 'BP.', name: 'BP plc', exchange: 'LSE' },
  { symbol: 'RIO', name: 'Rio Tinto plc', exchange: 'LSE' },
  { symbol: 'GSK', name: 'GSK plc', exchange: 'LSE' },
  { symbol: 'BARC', name: 'Barclays plc', exchange: 'LSE' },
  { symbol: 'LLOY', name: 'Lloyds Banking Group', exchange: 'LSE' },
  { symbol: 'VOD', name: 'Vodafone Group plc', exchange: 'LSE' },
  { symbol: 'LSEG', name: 'London Stock Exchange', exchange: 'LSE' },
  { symbol: 'BATS', name: 'British American Tobacco', exchange: 'LSE' },
];

const STOCK_DATABASE = [...US_STOCK_UNIVERSE, ...LSE_STOCK_UNIVERSE].filter((stock, index, allStocks) => {
  const key = `${stock.exchange}:${stock.symbol}`.toUpperCase();
  return allStocks.findIndex((candidate) => `${candidate.exchange}:${candidate.symbol}`.toUpperCase() === key) === index;
});

const DEFAULT_EQUITY_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
];

const CRYPTO_DATABASE = TOP_CRYPTO_BY_MARKET_CAP.map((crypto) => ({
  symbol: `${crypto.symbol}-USD`,
  name: crypto.name,
  displaySymbol: crypto.symbol,
  exchange: 'CRYPTO',
}));

const DEFAULT_CRYPTO_WATCHLIST = (() => {
  const primary = CRYPTO_DATABASE.filter((crypto) =>
    ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD'].includes(crypto.symbol)
  );
  return primary.length > 0 ? primary : CRYPTO_DATABASE.slice(0, 5);
})();

const CRYPTO_TV_MAP = {
  BTC: 'COINBASE:BTCUSD',
  'BTC-USD': 'COINBASE:BTCUSD',
  ETH: 'COINBASE:ETHUSD',
  'ETH-USD': 'COINBASE:ETHUSD',
  SOL: 'COINBASE:SOLUSD',
  'SOL-USD': 'COINBASE:SOLUSD',
  XRP: 'COINBASE:XRPUSD',
  'XRP-USD': 'COINBASE:XRPUSD',
  DOGE: 'COINBASE:DOGEUSD',
  'DOGE-USD': 'COINBASE:DOGEUSD',
  ADA: 'COINBASE:ADAUSD',
  'ADA-USD': 'COINBASE:ADAUSD',
  AVAX: 'COINBASE:AVAXUSD',
  'AVAX-USD': 'COINBASE:AVAXUSD',
  LINK: 'COINBASE:LINKUSD',
  'LINK-USD': 'COINBASE:LINKUSD',
  MATIC: 'COINBASE:MATICUSD',
  'MATIC-USD': 'COINBASE:MATICUSD',
};

const CHART_INTERVALS = ['1m', '5m', '15m', '1H', '1D', '1W'];
const CHART_INTERVAL_TO_ALPACA = {
  '1m': '1Min',
  '5m': '5Min',
  '15m': '15Min',
  '1H': '1Hour',
  '1D': '1Day',
  '1W': '1Week',
  '1': '1Min',
  '5': '5Min',
  '15': '15Min',
  '60': '1Hour',
  'D': '1Day',
  'W': '1Week',
};

const resolveAlpacaInterval = (value) => CHART_INTERVAL_TO_ALPACA[value] || '1Day';
const ALPACA_TO_TWELVE_TIMEFRAME = {
  '1Min': '1Min',
  '5Min': '5Min',
  '15Min': '15Min',
  '1Hour': '1Hour',
  '1Day': '1Day',
  '1Week': '1Week',
};

const LSE_EXCHANGE = 'LSE';
const LSE_TIMEZONE = 'Europe/London';
const LSE_OPEN_MINUTES = 8 * 60;
const LSE_CLOSE_MINUTES = 16 * 60 + 30;
const LSE_SYMBOLS = new Set(
  STOCK_DATABASE.filter((item) => item.exchange === LSE_EXCHANGE).map((item) => String(item.symbol).toUpperCase())
);

const normalizeLseBaseSymbol = (symbol) =>
  String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .split(':')[0]
    .replace(/\.$/, '');

const isLseEquitySymbol = (symbol) => {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return false;
  if (raw.endsWith(':LSE') || raw.includes('.LON')) return true;
  const base = normalizeLseBaseSymbol(raw);
  return LSE_SYMBOLS.has(raw) || LSE_SYMBOLS.has(base) || LSE_SYMBOLS.has(`${base}.`);
};

const toLseQuoteSymbol = (symbol) => `${normalizeLseBaseSymbol(symbol)}:LSE`;

const isLseMarketOpen = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LSE_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const weekday = String(parts.find((part) => part.type === 'weekday')?.value || '').toLowerCase();
  if (weekday.startsWith('sat') || weekday.startsWith('sun')) return false;

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const minutes = hour * 60 + minute;
  return minutes >= LSE_OPEN_MINUTES && minutes < LSE_CLOSE_MINUTES;
};

const EASTERN_TIMEZONE = 'America/New_York';
const PRE_MARKET_START_MINUTES = 4 * 60;
const PRE_MARKET_END_MINUTES = 9 * 60 + 30;
const AFTER_HOURS_START_MINUTES = 16 * 60;
const AFTER_HOURS_END_MINUTES = 20 * 60;

const getEasternMinutes = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
};

const getMarketSession = () => {
  const minutes = getEasternMinutes(new Date());
  if (minutes >= PRE_MARKET_START_MINUTES && minutes < PRE_MARKET_END_MINUTES) return 'pre';
  if (minutes >= PRE_MARKET_END_MINUTES && minutes < AFTER_HOURS_START_MINUTES) return 'regular';
  if (minutes >= AFTER_HOURS_START_MINUTES && minutes < AFTER_HOURS_END_MINUTES) return 'after';
  return 'closed';
};

const normalizeWatchlistItem = (item) => (typeof item === 'string' ? { symbol: item, name: item } : item);

const getCryptoDisplaySymbol = (symbol) => {
  if (!symbol) return '';
  const normalized = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  if (CRYPTO_TV_MAP[normalized]) return normalized.replace('-USD', '').replace('USD', '');
  if (normalized.includes('-')) return normalized.split('-')[0];
  if (normalized.includes('/')) return normalized.split('/')[0];
  if (normalized.endsWith('USDT')) return normalized.slice(0, -4);
  if (normalized.endsWith('USD')) return normalized.slice(0, -3);
  return normalized;
};


// TradingView Advanced Chart Widget (replaces basic iframe embed)
const TradingViewWidget = ({ symbol, interval }) => {
  const containerRef = React.useRef(null);
  React.useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(0, 0, 0, 1)',
      gridColor: 'rgba(30, 30, 30, 0.3)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: true,
      details: true,
      hotlist: false,
      show_popup_button: false,
      studies: ['STD;MACD'],
    });
    containerRef.current.appendChild(script);
  }, [symbol, interval]);
  return <div ref={containerRef} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }} />;
};

const getTradingViewSymbol = (symbol, market) => {
  if (!symbol) return symbol;
  if (symbol.includes(':')) {
    if (market === 'crypto') {
      const normalized = symbol.split(':')[1] || symbol;
      const base = getCryptoDisplaySymbol(normalized);
      return base ? `COINBASE:${base}USD` : symbol;
    }
    return symbol;
  }
  if (market === 'crypto') {
    if (CRYPTO_TV_MAP[symbol]) return CRYPTO_TV_MAP[symbol];
    const base = getCryptoDisplaySymbol(symbol);
    return base ? `COINBASE:${base}USD` : symbol;
  }
  return symbol;
};

const normalizeCryptoQuoteSymbol = (symbol) => {
  if (!symbol) return symbol;
  let normalized = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  if (normalized.includes('-') || normalized.includes('/')) return normalized;
  if (normalized.endsWith('USDT')) normalized = normalized.slice(0, -4);
  if (normalized.endsWith('USD')) normalized = normalized.slice(0, -3);
  return `${normalized}-USD`;
};

const normalizeCryptoWatchlistItem = (item) => {
  const normalized = normalizeWatchlistItem(item);
  const normalizedSymbol = normalizeCryptoQuoteSymbol(normalized.symbol);
  const displaySymbol = normalized.displaySymbol || getCryptoDisplaySymbol(normalizedSymbol);
  return { ...normalized, symbol: normalizedSymbol, displaySymbol };
};

const normalizePinnedTabs = (value) => {
  if (!Array.isArray(value)) return [...DEFAULT_PINNED_TABS];
  const seen = new Set();
  const normalized = [];
  value.forEach((item) => {
    const symbol = String(item || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    normalized.push(symbol);
  });
  return normalized.slice(0, 5);
};

const normalizeTradeUiState = (value) => {
  const candidate = value && typeof value === 'object' ? value : {};
  const watchlistState = ['open', 'small', 'closed'].includes(String(candidate.watchlistState))
    ? String(candidate.watchlistState)
    : 'small';
  const activeMarket = candidate.activeMarket === 'crypto' ? 'crypto' : 'equity';
  const pinnedTabs = normalizePinnedTabs(candidate.pinnedTabs);
  const cryptoWatchlist = Array.isArray(candidate.cryptoWatchlist)
    ? candidate.cryptoWatchlist.map(normalizeCryptoWatchlistItem)
    : DEFAULT_CRYPTO_WATCHLIST.map(normalizeCryptoWatchlistItem);

  return {
    activeMarket,
    pinnedTabs,
    watchlistState,
    cryptoWatchlist,
  };
};

const loadLocalTradeUiState = () => {
  if (typeof window === 'undefined') return normalizeTradeUiState({});
  try {
    const raw = localStorage.getItem(TRADE_UI_LOCAL_KEY);
    if (!raw) {
      const legacyPinnedTabs = localStorage.getItem('stratify-pinned-tabs');
      const legacyCryptoWatchlist = localStorage.getItem('stratify-crypto-watchlist');
      return normalizeTradeUiState({
        pinnedTabs: legacyPinnedTabs ? JSON.parse(legacyPinnedTabs) : undefined,
        cryptoWatchlist: legacyCryptoWatchlist ? JSON.parse(legacyCryptoWatchlist) : undefined,
      });
    }
    return normalizeTradeUiState(JSON.parse(raw));
  } catch {
    return normalizeTradeUiState({});
  }
};

const saveLocalTradeUiState = (state) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRADE_UI_LOCAL_KEY, JSON.stringify(normalizeTradeUiState(state)));
};

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
};

const toNumber = (value) => {
  if (typeof value === 'number') return value;
  if (value == null) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const buildQuote = (quote) => {
  if (!quote) return null;
  const price = toNumber(quote.price);
  if (!Number.isFinite(price)) return null;
  const prevClose = toNumber(quote.prevClose ?? quote.previousClose ?? quote.prev_close);
  const fallbackPrevClose = Number.isFinite(prevClose) ? prevClose : price;
  const rawChange = toNumber(quote.change);
  const change = Number.isFinite(rawChange) ? rawChange : price - fallbackPrevClose;
  const rawChangePercent = toNumber(quote.changePercent ?? quote.change_percent ?? quote.percentChange);
  const changePercent = Number.isFinite(rawChangePercent)
    ? rawChangePercent
    : fallbackPrevClose > 0
      ? (change / fallbackPrevClose) * 100
      : 0;
  const preMarketPrice = toNumber(quote.preMarketPrice);
  const preMarketChange = toNumber(quote.preMarketChange);
  const preMarketChangePercent = toNumber(quote.preMarketChangePercent);
  const afterHoursPrice = toNumber(quote.afterHoursPrice ?? quote.postMarketPrice);
  const afterHoursChange = toNumber(quote.afterHoursChange ?? quote.postMarketChange);
  const afterHoursChangePercent = toNumber(quote.afterHoursChangePercent ?? quote.postMarketChangePercent);
  return {
    price,
    change,
    changePercent,
    open: toNumber(quote.open),
    high: toNumber(quote.high),
    low: toNumber(quote.low),
    volume: toNumber(quote.volume),
    preMarketPrice,
    preMarketChange,
    preMarketChangePercent,
    afterHoursPrice,
    afterHoursChange,
    afterHoursChangePercent,
  };
};


const ORDER_TYPE_LABELS = {
  market: 'Market',
  limit: 'Limit',
  stop: 'Stop',
  stop_limit: 'Stop Limit',
  trailing_stop: 'Trailing Stop',
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
  const lookup = parts.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${lookup.month} ${lookup.day}, ${lookup.year} at ${lookup.hour}:${lookup.minute} ${lookup.dayPeriod} ${lookup.timeZoneName}`;
};

const TradePage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist, onReorderWatchlist, onPinToTop, addTrade }) => {
  const { user } = useAuth();
  const initialTradeUiRef = useRef(loadLocalTradeUiState());
  const [activeMarket, setActiveMarket] = useState(() => initialTradeUiRef.current.activeMarket);
  const [chartInterval, setChartInterval] = useState('1D');
  const [selectedEquity, setSelectedEquity] = useState(() => {
    // Check if coming from Active trades with a symbol
    const chartSymbol = localStorage.getItem('stratify_chart_symbol');
    if (chartSymbol) {
      localStorage.removeItem('stratify_chart_symbol'); // Clear after reading
      const stock = STOCK_DATABASE.find((s) => s.symbol === chartSymbol);
      return stock || { symbol: chartSymbol, name: chartSymbol, exchange: 'NASDAQ' };
    }
    return null;
  });
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [equitySearchMarket, setEquitySearchMarket] = useState('all');
  
  // Mini tabs - pinned tickers for quick access
  const [pinnedTabs, setPinnedTabs] = useState(() => initialTradeUiRef.current.pinnedTabs);
  const [dragOverTabs, setDragOverTabs] = useState(false);
  const [marketSession, setMarketSession] = useState(getMarketSession);
  const [tradeUiLoaded, setTradeUiLoaded] = useState(false);
  const tradeUiSaveTimerRef = useRef(null);
  const lastTradeUiSavedRef = useRef('');

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const addPinnedTab = (symbol) => {
    if (!pinnedTabs.includes(symbol) && pinnedTabs.length < 5) {
      setPinnedTabs([...pinnedTabs, symbol]);
    }
  };

  const removePinnedTab = (symbol) => {
    setPinnedTabs(pinnedTabs.filter(s => s !== symbol));
  };

  const handleTabDrop = (e) => {
    e.preventDefault();
    const symbol = e.dataTransfer.getData('text/plain');
    if (symbol) addPinnedTab(symbol);
    setDragOverTabs(false);
  };

  // Watchlist states: 'open' (384px) → 'small' (280px) → 'closed' (80px) → 'open'...
  // Default to 'small' size
  const [watchlistState, setWatchlistState] = useState(() => initialTradeUiRef.current.watchlistState);
  
  const stateWidths = { open: 384, small: 280, closed: 80 };
  
  const cycleWatchlistState = () => {
    setWatchlistState(prev => {
      if (prev === 'open') return 'small';
      if (prev === 'small') return 'closed';
      return 'open';
    });
  };
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [socialCollapsed, setSocialCollapsed] = useState(false);
  const [equityQuotes, setEquityQuotes] = useState({});
  const [cryptoQuotes, setCryptoQuotes] = useState({});
  const [equityLoading, setEquityLoading] = useState(true);
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const [cryptoWatchlist, setCryptoWatchlist] = useState(() => initialTradeUiRef.current.cryptoWatchlist);
  const [orderSide, setOrderSide] = useState('buy');
  const [orderQty, setOrderQty] = useState('1');
  const [orderSizeMode, setOrderSizeMode] = useState('shares');
  const [orderDollars, setOrderDollars] = useState('');
  const [orderType, setOrderType] = useState('market');
  const [timeInForce, setTimeInForce] = useState('day');
  const [orderStatus, setOrderStatus] = useState({ state: 'idle', message: '', data: null, timestamp: null });
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailAmount, setTrailAmount] = useState('');
  const [orderStep, setOrderStep] = useState('entry');
  const [orderError, setOrderError] = useState('');
  const [account, setAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState({ state: 'idle', message: '' });
  const [tradePositions, setTradePositions] = useState([]);
  const [positionsStatus, setPositionsStatus] = useState({ state: 'idle', message: '' });
  const [showDollarChange, setShowDollarChange] = useState(false); // Toggle % vs $ display
  const {
    breakingNews,
    isVisible: isBreakingNewsVisible,
    status: breakingNewsStatus,
    triggerBreakingNews,
    dismissBreakingNews,
  } = useBreakingNews();

  const saveTradeUiToSupabase = useCallback(async (userId, state, serializedState) => {
    if (!userId || !supabase) return false;

    try {
      const profileLookup = await supabase
        .from('profiles')
        .select('user_state')
        .eq('id', userId)
        .maybeSingle();

      if (profileLookup.error) {
        if (!isMissingColumnError(profileLookup.error, 'user_state')) {
          console.warn('[TradePage] Trade UI save error:', profileLookup.error.message);
        }
        return false;
      }

      const existingState = profileLookup.data?.user_state && typeof profileLookup.data.user_state === 'object'
        ? profileLookup.data.user_state
        : {};

      const nextUserState = {
        ...existingState,
        [TRADE_UI_USER_STATE_KEY]: normalizeTradeUiState(state),
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          user_state: nextUserState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.warn('[TradePage] Trade UI save error:', error.message);
        return false;
      }

      if (serializedState) {
        lastTradeUiSavedRef.current = serializedState;
      }
      return true;
    } catch (error) {
      console.warn('[TradePage] Trade UI save failed:', error);
      return false;
    }
  }, []);
  
  const equityStocks = useMemo(() => (
    watchlist.length > 0
      ? watchlist.map(normalizeWatchlistItem)
      : DEFAULT_EQUITY_WATCHLIST.map(normalizeWatchlistItem)
  ), [watchlist]);
  const cryptoStocks = useMemo(() => (
    cryptoWatchlist.length > 0 ? cryptoWatchlist.map(normalizeWatchlistItem) : []
  ), [cryptoWatchlist]);
  const filteredEquityDatabase = useMemo(() => {
    if (equitySearchMarket === 'lse') {
      return STOCK_DATABASE.filter((stock) => stock.exchange === LSE_EXCHANGE);
    }
    return STOCK_DATABASE;
  }, [equitySearchMarket]);
  const nonLseEquityStocks = useMemo(
    () => equityStocks.filter((stock) => !isLseEquitySymbol(stock.symbol)),
    [equityStocks]
  );
  const lseEquityStocks = useMemo(
    () => equityStocks.filter((stock) => isLseEquitySymbol(stock.symbol)),
    [equityStocks]
  );
  const lseEquitySymbolsKey = useMemo(
    () => lseEquityStocks.map((stock) => stock.symbol).join(','),
    [lseEquityStocks]
  );
  
  // Real-time WebSocket streaming from Alpaca
  const stockSymbolsForStream = useMemo(() => nonLseEquityStocks.map(s => s.symbol), [nonLseEquityStocks]);
  const cryptoSymbolsForStream = useMemo(() => cryptoStocks.map(s => s.symbol), [cryptoStocks]);
  
  const {
    stockQuotes: wsStockQuotes,
    cryptoQuotes: wsCryptoQuotes,
    stockConnected,
    cryptoConnected,
  } = useAlpacaStream({
    stockSymbols: stockSymbolsForStream,
    cryptoSymbols: cryptoSymbolsForStream,
    enabled: true
  });
  
  const activeWatchlist = activeMarket === 'crypto' ? cryptoStocks : equityStocks;
  const activeDatabase = activeMarket === 'crypto' ? CRYPTO_DATABASE : filteredEquityDatabase;
  const defaultEquitySymbol = equityStocks.find(s => s.symbol === 'NVDA')?.symbol || equityStocks[0]?.symbol || 'NVDA';
  const defaultCryptoSymbol = cryptoStocks[0]?.symbol || 'BTC-USD';
  const selectedTicker = activeMarket === 'crypto' ? (selectedCrypto || defaultCryptoSymbol) : (selectedEquity || defaultEquitySymbol);
  const selectedWatchlistTicker = useMemo(() => {
    const selected = activeMarket === 'crypto' ? selectedCrypto : selectedEquity;
    if (!selected) return null;
    return activeWatchlist.some((stock) => stock.symbol === selected) ? selected : null;
  }, [activeMarket, activeWatchlist, selectedCrypto, selectedEquity]);
  const activeQuotes = activeMarket === 'crypto' ? cryptoQuotes : equityQuotes;
  const selectedQuote = selectedTicker ? activeQuotes[selectedTicker] : null;
  const activeLoading = activeMarket === 'crypto' ? cryptoLoading : equityLoading;
  const selectedDisplaySymbol = activeMarket === 'crypto' ? getCryptoDisplaySymbol(selectedTicker) : selectedTicker;
  const selectedWatchlistDisplaySymbol = selectedWatchlistTicker
    ? (activeMarket === 'crypto' ? getCryptoDisplaySymbol(selectedWatchlistTicker) : selectedWatchlistTicker)
    : '';
  const canUseWatchlistActions = Boolean(selectedWatchlistTicker);
  const pinTooltip = canUseWatchlistActions ? `Pin ${selectedWatchlistDisplaySymbol}` : 'Pin';
  const removeTooltip = canUseWatchlistActions ? `Remove ${selectedWatchlistDisplaySymbol}` : 'Remove';
  const selectedName = useMemo(() => {
    if (!selectedTicker) return '';
    if (activeMarket === 'crypto') {
      return CRYPTO_DATABASE.find(s => s.symbol === selectedTicker || s.displaySymbol === selectedTicker)?.name
        || cryptoStocks.find(s => s.symbol === selectedTicker)?.name
        || selectedTicker;
    }
    return STOCK_DATABASE.find(s => s.symbol === selectedTicker)?.name
      || equityStocks.find(s => s.symbol === selectedTicker)?.name
      || 'S&P 500 ETF';
  }, [activeMarket, cryptoStocks, equityStocks, selectedTicker]);
  const selectedSymbol = selectedTicker;
  const selectedInterval = useMemo(() => resolveAlpacaInterval(chartInterval), [chartInterval]);
  const isSelectedLse = activeMarket === 'equity' && isLseEquitySymbol(selectedSymbol);
  const lseMarketOpen = useMemo(() => isLseMarketOpen(), [marketSession]);
  const lseChartSymbol = useMemo(() => toLseQuoteSymbol(selectedSymbol), [selectedSymbol]);
  const lseChartTimeframe = useMemo(
    () => ALPACA_TO_TWELVE_TIMEFRAME[selectedInterval] || '1Day',
    [selectedInterval]
  );
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

  const marketPrice = useMemo(() => {
    return selectedQuote?.price ?? selectedQuote?.last ?? selectedQuote?.ask ?? selectedQuote?.bid ?? 0;
  }, [selectedQuote]);

  const bidPrice = selectedQuote?.bid ?? null;
  const askPrice = selectedQuote?.ask ?? null;

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
    (requiresLimit && limitPriceNumber <= 0) ||
    (requiresStop && stopPriceNumber <= 0) ||
    (requiresTrail && trailAmountNumber <= 0);

  const hasOrderSize =
    orderSizeMode === 'dollars' ? orderDollarsNumber > 0 : orderQtyNumber > 0;

  const canReview =
    selectedTicker && hasOrderSize && !isPriceMissing && orderStep === 'entry';

  const positionForTicker = useMemo(() => {
    return tradePositions.find(
      (position) => position?.symbol?.toUpperCase() === selectedTicker?.toUpperCase()
    );
  }, [tradePositions, selectedTicker]);

  const availableShares = useMemo(() => {
    const rawQty =
      positionForTicker?.qty_available ??
      positionForTicker?.qty ??
      positionForTicker?.quantity;
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

  const actionButtonClass =
    orderSide === 'buy'
      ? 'bg-emerald-500 hover:bg-emerald-400'
      : 'bg-red-500 hover:bg-red-400';

  const orderTypeLabel = ORDER_TYPE_LABELS[orderType] || 'Market';

  const orderTimestamp =
    orderStatus.data?.filled_at ||
    orderStatus.data?.submitted_at ||
    orderStatus.data?.created_at ||
    orderStatus.timestamp;

  const buyingPower =
    account?.buying_power ?? account?.buyingPower ?? account?.cash ?? null;
  const buyingPowerDisplay =
    accountStatus.state === 'loading'
      ? '...'
      : accountStatus.state === 'error'
        ? '--'
        : buyingPower !== null && buyingPower !== undefined
          ? formatUsd(buyingPower)
          : '--';

  // Fetch quote snapshot via Railway backend
  const fetchSnapshot = useCallback(async () => {
    try {
      const symbols = nonLseEquityStocks.map(s => s.symbol).join(',');
      if (!symbols) return [];
      const res = await fetch('/api/stocks?symbols=' + symbols);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Snapshot fetch error:', err);
      return [];
    }
  }, [nonLseEquityStocks]);

  const fetchLseQuotes = useCallback(async () => {
    if (lseEquityStocks.length === 0) return {};

    try {
      const baseToOriginal = new Map();
      const requestSymbols = lseEquityStocks.map((stock) => {
        const base = normalizeLseBaseSymbol(stock.symbol);
        baseToOriginal.set(base, stock.symbol);
        return `${base}:LSE`;
      });

      const response = await fetch(`/api/lse/quotes?symbols=${encodeURIComponent(requestSymbols.join(','))}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return {};
      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const next = {};

      rows.forEach((row) => {
        const requested = normalizeLseBaseSymbol(row?.requestedSymbol || row?.symbol || row?.streamSymbol);
        const originalSymbol = baseToOriginal.get(requested) || requested;
        const price = toNumber(row?.price);
        const change = toNumber(row?.change);
        const changePercent = toNumber(row?.percentChange);
        if (!Number.isFinite(price)) return;

        const prevClose = Number.isFinite(change) ? price - change : price;
        next[originalSymbol] = buildQuote({
          price,
          change,
          changePercent,
          prevClose,
        });
      });

      return next;
    } catch (error) {
      console.error('LSE quote fetch error:', error);
      return {};
    }
  }, [lseEquityStocks]);

  const fetchCryptoQuote = useCallback(async (symbol) => {
    try {
      const normalizedSymbol = normalizeCryptoQuoteSymbol(symbol);
      const url = new URL(`${API_URL}/api/public/quote/${encodeURIComponent(normalizedSymbol)}`);
      url.searchParams.set('t', Date.now());
      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return buildQuote(data);
    } catch (err) {
      console.error('Crypto quote fetch error:', symbol, err);
      return null;
    }
  }, []);

  const equitySymbolsKey = useMemo(() => nonLseEquityStocks.map(s => s.symbol).join(','), [nonLseEquityStocks]);
  const cryptoSymbolsKey = useMemo(() => cryptoStocks.map(s => s.symbol).join(','), [cryptoStocks]);

  // Merge WebSocket data with polling data for equity quotes
  useEffect(() => {
    if (Object.keys(wsStockQuotes).length > 0) {
      setEquityQuotes(prev => {
        const merged = { ...prev };
        Object.entries(wsStockQuotes).forEach(([symbol, wsQuote]) => {
          if (wsQuote.price) {
            merged[symbol] = {
              ...prev[symbol],
              ...wsQuote,
              // Keep previous day data if we have it
              prevClose: prev[symbol]?.prevClose || wsQuote.prevClose,
              change: wsQuote.price - (prev[symbol]?.prevClose || wsQuote.price),
              changePercent: prev[symbol]?.prevClose 
                ? ((wsQuote.price - prev[symbol].prevClose) / prev[symbol].prevClose) * 100 
                : prev[symbol]?.changePercent || 0
            };
          }
        });
        return merged;
      });
      setEquityLoading(false);
    }
  }, [wsStockQuotes]);

  // LSE quotes (REST path): fetch from Twelve Data endpoint for international symbols.
  useEffect(() => {
    if (lseEquityStocks.length === 0) return undefined;

    const loadLseQuotes = async () => {
      const lseQuotes = await fetchLseQuotes();
      if (Object.keys(lseQuotes).length > 0) {
        setEquityQuotes((prev) => ({ ...prev, ...lseQuotes }));
      }
      setEquityLoading(false);
    };

    loadLseQuotes();
    const interval = setInterval(loadLseQuotes, 15000);
    return () => clearInterval(interval);
  }, [fetchLseQuotes, lseEquitySymbolsKey, lseEquityStocks.length]);

  // Merge WebSocket data with polling data for crypto quotes
  useEffect(() => {
    if (Object.keys(wsCryptoQuotes).length > 0) {
      setCryptoQuotes(prev => {
        const merged = { ...prev };
        Object.entries(wsCryptoQuotes).forEach(([symbol, wsQuote]) => {
          if (wsQuote.price) {
            merged[symbol] = {
              ...prev[symbol],
              ...wsQuote,
              prevClose: prev[symbol]?.prevClose || wsQuote.prevClose,
              change: wsQuote.price - (prev[symbol]?.prevClose || wsQuote.price),
              changePercent: prev[symbol]?.prevClose 
                ? ((wsQuote.price - prev[symbol].prevClose) / prev[symbol].prevClose) * 100 
                : prev[symbol]?.changePercent || 0
            };
          }
        });
        return merged;
      });
      setCryptoLoading(false);
    }
  }, [wsCryptoQuotes]);

  // Fallback polling for equity quotes (runs on initial load and as backup)
  useEffect(() => {
    const fetchEquityQuotes = async () => {
      // Only show loading on initial fetch
      if (Object.keys(equityQuotes).length === 0) {
        setEquityLoading(true);
      }
      const results = {};
      const snapshotData = await fetchSnapshot();
      const snapshotsBySymbol = {};
      snapshotData.forEach((item) => {
        if (item?.symbol) {
          snapshotsBySymbol[item.symbol] = item;
        }
      });
      equityStocks.forEach((stock) => {
        const quote = buildQuote(snapshotsBySymbol[stock.symbol]);
        if (quote && quote.price) {
          results[stock.symbol] = quote;
        }
      });
      setEquityQuotes(prev => ({ ...prev, ...results }));
      setEquityLoading(false);
    };

    fetchEquityQuotes();
    // Poll less frequently when WebSocket is connected (60s vs 10s)
    const pollInterval = stockConnected ? 60000 : 10000;
    const interval = setInterval(fetchEquityQuotes, pollInterval);
    return () => clearInterval(interval);
  }, [equitySymbolsKey, fetchSnapshot, stockConnected]);

  // Fallback polling for crypto quotes (runs on initial load and as backup)
  useEffect(() => {
    const fetchCryptoQuotes = async () => {
      if (Object.keys(cryptoQuotes).length === 0) {
        setCryptoLoading(true);
      }
      const results = {};
      await Promise.all(
        cryptoStocks.map(async (stock) => {
          const quote = await fetchCryptoQuote(stock.symbol);
          if (quote && quote.price) {
            results[stock.symbol] = quote;
          }
        })
      );
      setCryptoQuotes(prev => ({ ...prev, ...results }));
      setCryptoLoading(false);
    };

    fetchCryptoQuotes();
    // Poll less frequently when WebSocket is connected
    const pollInterval = cryptoConnected ? 60000 : 10000;
    const interval = setInterval(fetchCryptoQuotes, pollInterval);
    return () => clearInterval(interval);
  }, [cryptoSymbolsKey, fetchCryptoQuote, cryptoConnected]);

  useEffect(() => {
    const localState = loadLocalTradeUiState();

    if (!user?.id || !supabase) {
      setActiveMarket(localState.activeMarket);
      setPinnedTabs(localState.pinnedTabs);
      setWatchlistState(localState.watchlistState);
      setCryptoWatchlist(localState.cryptoWatchlist);
      const serialized = JSON.stringify(localState);
      lastTradeUiSavedRef.current = serialized;
      setTradeUiLoaded(true);
      return;
    }

    let cancelled = false;

    const loadFromSupabase = async () => {
      setTradeUiLoaded(false);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_state')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          if (!isMissingColumnError(error, 'user_state')) {
            console.warn('[TradePage] Trade UI load error:', error.message);
          }
          if (!cancelled) {
            setActiveMarket(localState.activeMarket);
            setPinnedTabs(localState.pinnedTabs);
            setWatchlistState(localState.watchlistState);
            setCryptoWatchlist(localState.cryptoWatchlist);
            lastTradeUiSavedRef.current = JSON.stringify(localState);
            setTradeUiLoaded(true);
          }
          return;
        }

        const remoteRaw = data?.user_state?.[TRADE_UI_USER_STATE_KEY];
        const hasRemote = remoteRaw && typeof remoteRaw === 'object';
        const resolved = hasRemote ? normalizeTradeUiState(remoteRaw) : localState;
        const serialized = JSON.stringify(resolved);

        if (cancelled) return;

        setActiveMarket(resolved.activeMarket);
        setPinnedTabs(resolved.pinnedTabs);
        setWatchlistState(resolved.watchlistState);
        setCryptoWatchlist(resolved.cryptoWatchlist);
        saveLocalTradeUiState(resolved);
        lastTradeUiSavedRef.current = serialized;
        setTradeUiLoaded(true);

        if (!hasRemote) {
          saveTradeUiToSupabase(user.id, resolved, serialized);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[TradePage] Trade UI load failed:', error);
        setActiveMarket(localState.activeMarket);
        setPinnedTabs(localState.pinnedTabs);
        setWatchlistState(localState.watchlistState);
        setCryptoWatchlist(localState.cryptoWatchlist);
        saveLocalTradeUiState(localState);
        lastTradeUiSavedRef.current = JSON.stringify(localState);
        setTradeUiLoaded(true);
      }
    };

    loadFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [user?.id, saveTradeUiToSupabase]);

  useEffect(() => {
    const payload = normalizeTradeUiState({
      activeMarket,
      pinnedTabs,
      watchlistState,
      cryptoWatchlist,
    });

    saveLocalTradeUiState(payload);
    if (!tradeUiLoaded) return;

    const serialized = JSON.stringify(payload);
    if (serialized === lastTradeUiSavedRef.current) return;

    if (tradeUiSaveTimerRef.current) clearTimeout(tradeUiSaveTimerRef.current);
    tradeUiSaveTimerRef.current = setTimeout(() => {
      if (!user?.id || !supabase) {
        lastTradeUiSavedRef.current = serialized;
        return;
      }
      saveTradeUiToSupabase(user.id, payload, serialized);
    }, 1500);

    return () => {
      if (tradeUiSaveTimerRef.current) clearTimeout(tradeUiSaveTimerRef.current);
    };
  }, [activeMarket, pinnedTabs, watchlistState, cryptoWatchlist, tradeUiLoaded, user?.id, saveTradeUiToSupabase]);

  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, [activeMarket]);

  // Local search from active database
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const existingSymbols = new Set(activeWatchlist.map((stock) => stock.symbol));
    const filtered = activeDatabase.filter(s => {
      const symbolMatch = s.symbol.toLowerCase().includes(query);
      const nameMatch = s.name.toLowerCase().includes(query);
      const displayMatch = s.displaySymbol ? s.displaySymbol.toLowerCase().includes(query) : false;
      return symbolMatch || nameMatch || displayMatch;
    }).slice(0, 20).map((stock) => ({
      ...stock,
      alreadyInWatchlist: existingSymbols.has(stock.symbol),
    }));
    setSearchResults(filtered);
  }, [searchQuery, activeDatabase, activeWatchlist]);

  useEffect(() => {
    if (activeMarket === 'equity') {
      if (!selectedEquity || !equityStocks.find(s => s.symbol === selectedEquity)) {
        setSelectedEquity(defaultEquitySymbol);
      }
    }
  }, [activeMarket, defaultEquitySymbol, equityStocks, selectedEquity]);

  useEffect(() => {
    if (activeMarket === 'crypto') {
      if (!selectedCrypto || !cryptoStocks.find(s => s.symbol === selectedCrypto)) {
        setSelectedCrypto(defaultCryptoSymbol);
      }
    }
  }, [activeMarket, defaultCryptoSymbol, cryptoStocks, selectedCrypto]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      triggerBreakingNews({
        headline: '⚡ SpaceX acquiring xAI for $50B',
        tickerSymbol: 'TSLA',
        tickerChange: 12,
        newsUrl: 'https://example.com/breaking-news',
        isLive: true,
      });
    }, 600);

    return () => clearTimeout(timeout);
  }, [triggerBreakingNews]);

  const handleAddStock = (stock) => {
    if (activeMarket === 'crypto') {
      const normalizedStock = normalizeCryptoWatchlistItem(stock);
      if (stock?.alreadyInWatchlist) {
        setSelectedCrypto(normalizedStock.symbol);
        setSearchQuery('');
        setSearchResults([]);
        return;
      }
      setCryptoWatchlist(prev => {
        if (prev.some(s => s.symbol === normalizedStock.symbol)) return prev;
        // Add new tickers to TOP of list (prepend)
        return [normalizedStock, ...prev];
      });
      setSelectedCrypto(normalizedStock.symbol);
    } else if (onAddToWatchlist) {
      if (!stock?.alreadyInWatchlist) {
        onAddToWatchlist({ symbol: stock.symbol, name: stock.name });
      }
      setSelectedEquity(stock.symbol);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveStock = useCallback((symbol) => {
    if (!symbol) return;
    if (activeMarket === 'crypto') {
      setCryptoWatchlist(prev => prev.filter(s => s.symbol !== symbol));
    } else if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(symbol);
    }
  }, [activeMarket, onRemoveFromWatchlist]);

  const handleSelectSymbol = useCallback((symbol) => {
    if (activeMarket === 'crypto') {
      setSelectedCrypto(symbol);
    } else {
      setSelectedEquity(symbol);
    }
  }, [activeMarket]);

  const handleTicketSymbolSubmit = useCallback((symbolInput) => {
    const normalized = String(symbolInput || '')
      .replace(/^\$/, '')
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!normalized) return;

    if (activeMarket === 'crypto') {
      const exactMatch = cryptoStocks.find((item) =>
        item.symbol === normalized ||
        item.symbol === `${normalized}-USD` ||
        item.displaySymbol === normalized
      );
      if (exactMatch) {
        setSelectedCrypto(exactMatch.symbol);
      }
      return;
    }

    const cleanedInput = normalized.replace(/:LSE$/i, '').replace(/\.LON$/i, '');
    const equitySymbolInput = cleanedInput.includes('/') ? cleanedInput.split('/')[0] : cleanedInput;
    const matchingStock = STOCK_DATABASE.find((item) => {
      if (item.symbol === equitySymbolInput) return true;
      return normalizeLseBaseSymbol(item.symbol) === normalizeLseBaseSymbol(equitySymbolInput);
    });
    const equitySymbol = matchingStock?.symbol || equitySymbolInput;

    handleSelectSymbol(equitySymbol);

    const inWatchlist = equityStocks.some((item) => item.symbol === equitySymbol);
    if (!inWatchlist && onAddToWatchlist) {
      const stockMeta = matchingStock || STOCK_DATABASE.find((item) => item.symbol === equitySymbol);
      onAddToWatchlist({
        symbol: equitySymbol,
        name: stockMeta?.name || equitySymbol,
      });
    }
  }, [activeMarket, cryptoStocks, equityStocks, handleSelectSymbol, onAddToWatchlist]);

  const handlePinSelectedTicker = useCallback(() => {
    if (!selectedWatchlistTicker) return;
    if (pinnedTabs.includes(selectedWatchlistTicker)) {
      removePinnedTab(selectedWatchlistTicker);
      return;
    }
    if (onPinToTop) onPinToTop(selectedWatchlistTicker);
    addPinnedTab(selectedWatchlistTicker);
  }, [selectedWatchlistTicker, pinnedTabs, onPinToTop, addPinnedTab, removePinnedTab]);

  const handleRemoveSelectedTicker = useCallback(() => {
    if (!selectedWatchlistTicker) return;
    handleRemoveStock(selectedWatchlistTicker);
  }, [selectedWatchlistTicker, handleRemoveStock]);

  // Handle drag & drop reordering
  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    if (activeMarket === 'crypto') {
      setCryptoWatchlist(prev => {
        const reordered = Array.from(prev);
        const [removed] = reordered.splice(sourceIndex, 1);
        reordered.splice(destIndex, 0, removed);
        return reordered;
      });
    } else if (onReorderWatchlist) {
      onReorderWatchlist(sourceIndex, destIndex);
    }
  }, [activeMarket, onReorderWatchlist]);

  const refreshAccount = useCallback(async () => {
    try {
      setAccountStatus({ state: 'loading', message: '' });
      const response = await fetch('/api/account');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to fetch account');
      setAccount(data);
      setAccountStatus({ state: 'success', message: '' });
    } catch (err) {
      setAccountStatus({ state: 'error', message: err.message });
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
    } catch (err) {
      setPositionsStatus({ state: 'error', message: err.message });
    }
  }, []);

  useEffect(() => {
    if (!isTradePanelOpen) return;
    refreshAccount();
    refreshPositions();
  }, [isTradePanelOpen, refreshAccount, refreshPositions]);

  const handleReview = () => {
    if (!selectedTicker) { setOrderError('Select a ticker to continue.'); return; }
    if (orderSizeMode === 'dollars' && orderDollarsNumber <= 0) {
      setOrderError('Enter a valid dollar amount.');
      return;
    }
    if (orderQtyNumber <= 0) { setOrderError('Enter a valid share quantity.'); return; }
    if (requiresLimit && limitPriceNumber <= 0) { setOrderError('Enter a valid limit price.'); return; }
    if (requiresStop && stopPriceNumber <= 0) { setOrderError('Enter a valid stop price.'); return; }
    if (requiresTrail && trailAmountNumber <= 0) { setOrderError('Enter a valid trail amount.'); return; }
    setOrderError('');
    setOrderStep('review');
  };

  const clearOrderError = () => { if (orderError) setOrderError(''); };

  const handleSubmitOrder = async () => {
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
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Order failed');

      if (typeof addTrade === 'function') {
        addTrade({
          symbol: selectedTicker,
          shares: orderQtyNumber,
          side: orderSide,
          price: data?.filled_avg_price ?? marketPrice,
          timestamp: data?.submitted_at || submittedAt,
        });
      }

      setOrderStatus({ state: 'success', message: 'Order submitted.', data, timestamp: data?.submitted_at || submittedAt });
      setOrderStep('confirm');
      refreshAccount();
      refreshPositions();
    } catch (err) {
      setOrderStatus({ state: 'error', message: err.message, data: null, timestamp: submittedAt });
      setOrderStep('confirm');
    }
  };

  const handleResetOrder = () => {
    setOrderStep('entry');
    setOrderStatus({ state: 'idle', message: '', data: null, timestamp: null });
    setOrderError('');
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '...';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatSignedPercent = (value) => {
    if (!Number.isFinite(value)) return null;
    return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
  };

  const formatOrderSide = (side) => {
    if (!side) return '';
    return `${side.charAt(0).toUpperCase()}${side.slice(1)}`;
  };

  const formatExecutionTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const timeZone = 'America/New_York';
    const datePart = date.toLocaleDateString('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = date.toLocaleTimeString('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    return `${datePart} · ${timePart}`;
  };

  const formatExecutionPrice = (price) => {
    if (!Number.isFinite(price)) return '...';
    return `$${formatPrice(price)}`;
  };

  const getChangeColor = (value) => {
    if (value > 0) return 'text-emerald-400';
    if (value < 0) return 'text-red-400';
    return 'text-white/50';
  };

  const scrollStyle = { scrollbarWidth: 'none', msOverflowStyle: 'none' };
  const showBreakingBanner = watchlistState !== 'closed' && isBreakingNewsVisible && breakingNews;
  // Ticker tape removed per user request
  const collapseToggle = (
    <button
      onClick={cycleWatchlistState}
      className="p-1 hover:bg-gray-800 rounded transition-colors focus:outline-none"
      aria-label="Resize watchlist"
      type="button"
    >
      <ChevronsLeft 
        className={`w-5 h-5 transition-all duration-200 ${
          watchlistState !== 'closed' 
            ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]' 
            : 'text-gray-600'
        }`}
      />
    </button>
  );

  return (
    <div className="flex-1 flex h-full bg-transparent overflow-hidden">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .ticker-tape-track { height: 100%; display: flex; align-items: center; overflow: hidden; }
        .ticker-tape-content { display: inline-flex; align-items: center; white-space: nowrap; animation: ticker-scroll 500s linear infinite; }
        .ticker-tape-content span { padding-right: 3rem; }
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
      
      {/* Watchlist Panel */}
      <div 
        className="flex flex-col border-r border-[#1f1f1f] flex-shrink-0 transition-all duration-300 ease-out"
        style={{ width: stateWidths[watchlistState] }}
      >
        {/* Header */}
        <div className="border-b border-[#1f1f1f] relative">
          {/* Mini Tabs - Drag tickers here */}
          <div 
            className={`flex-1 px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide ${
              dragOverTabs ? 'bg-emerald-500/10 border-emerald-500/30' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverTabs(true); }}
            onDragLeave={() => setDragOverTabs(false)}
            onDrop={handleTabDrop}
          >
            {pinnedTabs.map((symbol) => (
              <button
                key={symbol}
                onClick={() => {
                  if (activeMarket === 'crypto') setSelectedCrypto(symbol);
                  else setSelectedEquity(symbol);
                }}
                className={`group flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  selectedTicker === symbol
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-gray-800 text-gray-400 border border-[#2a2a2a] hover:border-gray-600 hover:text-white'
                }`}
              >
                <span>{symbol}</span>
                <X 
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); removePinnedTab(symbol); }}
                />
              </button>
            ))}
            {pinnedTabs.length < 5 && (
              <div className={`px-2 py-1 rounded border border-dashed text-xs transition-colors ${
                dragOverTabs 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-[#2a2a2a] text-gray-600'
              }`}>
                {dragOverTabs ? 'Drop here' : '+ Drag'}
              </div>
            )}
            {/* Spacer for collapse button */}
            <div className="w-8 flex-shrink-0" />
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
            {collapseToggle}
          </div>
        </div>

        {/* Search */}
        {watchlistState !== 'closed' && (
          <div className="p-3 border-b border-[#1f1f1f] relative">
            <div className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5">
              <Search className="w-4 h-4 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(String(e.target.value || '').toUpperCase())}
                placeholder={activeMarket === 'crypto' ? 'Search coin or token...' : 'Search symbol or company...'}
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
              {activeMarket === 'equity' && (
                <div className="flex items-center rounded-full bg-white/5 border border-white/10 p-0.5">
                  <button
                    type="button"
                    onClick={() => setEquitySearchMarket('all')}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      equitySearchMarket === 'all'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-white/55 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setEquitySearchMarket('lse')}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      equitySearchMarket === 'lse'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-white/55 hover:text-white'
                    }`}
                  >
                    🇬🇧 LSE
                  </button>
                </div>
              )}
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide" style={scrollStyle}>
                {searchResults.map((stock) => {
                  const displaySymbol = activeMarket === 'crypto'
                    ? (stock.displaySymbol || getCryptoDisplaySymbol(stock.symbol))
                    : stock.symbol;
                  const isLseResult = activeMarket === 'equity' && stock.exchange === LSE_EXCHANGE;
                  const inWatchlist = Boolean(stock.alreadyInWatchlist);
                  return (
                    <div 
                      key={stock.symbol}
                      className="flex items-center justify-between px-4 py-3 hover:bg-emerald-500/10 cursor-pointer border-b border-[#1f1f1f]/50 last:border-0 transition-colors"
                      onClick={() => handleAddStock(stock)}
                    >
                      <div className="flex-1">
                        <span className="text-white font-bold text-base">${displaySymbol}</span>
                        <span className="text-gray-400 text-sm ml-3">{stock.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {inWatchlist && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 font-medium">
                            In Watchlist
                          </span>
                        )}
                        {isLseResult && (
                          <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                            LSE
                          </span>
                        )}
                        {inWatchlist ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" strokeWidth={1.75} />
                        ) : (
                          <Plus className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 text-center text-gray-400 text-sm z-50">
                No results for "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher */}
        {watchlistState !== 'closed' && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1 p-1 rounded-lg border border-[#2a2a2a] bg-[#111111]">
              <button
                type="button"
                onClick={() => setActiveMarket('equity')}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeMarket === 'equity'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Equity
              </button>
              <button
                type="button"
                onClick={() => setActiveMarket('crypto')}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeMarket === 'crypto'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Crypto
              </button>
            </div>
            {/* WebSocket Connection Status */}
            <div className="flex items-center justify-center gap-2 mt-2 text-[10px]">
              {(activeMarket === 'equity' ? stockConnected : cryptoConnected) ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 font-medium">LIVE STREAMING</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-500"></span>
                  </span>
                  <span className="text-gray-500 font-medium">POLLING (10s)</span>
                </>
              )}
              <button
                type="button"
                onClick={handlePinSelectedTicker}
                disabled={!canUseWatchlistActions}
                className={`text-emerald-400 transition-opacity ${
                  canUseWatchlistActions ? 'opacity-40 hover:opacity-100' : 'opacity-20 cursor-not-allowed'
                }`}
                title={pinTooltip}
              >
                <Pin className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={handleRemoveSelectedTicker}
                disabled={!canUseWatchlistActions}
                className={`text-emerald-400 transition-opacity ${
                  canUseWatchlistActions ? 'opacity-40 hover:opacity-100' : 'opacity-20 cursor-not-allowed'
                }`}
                title={removeTooltip}
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}

        {/* Stock/Crypto List with Drag & Drop */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="watchlist">
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-1 overflow-auto scrollbar-hide" 
                style={scrollStyle}
              >
                {activeLoading && Object.keys(activeQuotes).length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-gray-400 text-sm">Loading prices...</span>
                  </div>
                )}
                
                {activeWatchlist.length === 0 && !activeLoading && (
                  <div className="px-4 py-6 text-center text-white/50 text-sm">
                    Watchlist is empty. Search to add symbols.
                  </div>
                )}

                {activeWatchlist.map((stock, index) => {
                  const quote = activeQuotes[stock.symbol] || {};
                  const price = quote.price || 0;
                  const change = quote.change || 0;
                  const changePercent = quote.changePercent || 0;
                  const preMarketPrice = quote.preMarketPrice;
                  const preMarketChange = quote.preMarketChange;
                  const preMarketChangePercent = quote.preMarketChangePercent;
                  const afterHoursPrice = quote.afterHoursPrice;
                  const afterHoursChange = quote.afterHoursChange;
                  const afterHoursChangePercent = quote.afterHoursChangePercent;
                  const isPositive = changePercent !== 0 ? changePercent >= 0 : change >= 0;
                  const isSelected = selectedWatchlistTicker === stock.symbol;
                  const stockInfo = activeMarket === 'crypto'
                    ? CRYPTO_DATABASE.find(s => s.symbol === stock.symbol || s.displaySymbol === stock.symbol)
                    : STOCK_DATABASE.find(s => s.symbol === stock.symbol);
                  const displaySymbol = activeMarket === 'crypto'
                    ? (stock.displaySymbol || stockInfo?.displaySymbol || getCryptoDisplaySymbol(stock.symbol))
                    : stock.symbol;
                  const name = stockInfo?.name || stock.name || displaySymbol;
                  const isExtendedHours = marketSession === 'pre' || marketSession === 'after' || marketSession === 'closed';
                  const showPreMarket = activeMarket === 'equity' && (marketSession === 'pre' || marketSession === 'closed') && Number.isFinite(preMarketPrice) && preMarketPrice > 0;
                  const showAfterHours = activeMarket === 'equity' && (marketSession === 'after' || marketSession === 'closed') && Number.isFinite(afterHoursPrice) && afterHoursPrice > 0;
                  const preMarketPercentLabel = formatSignedPercent(preMarketChangePercent);
                  const afterHoursPercentLabel = formatSignedPercent(afterHoursChangePercent);
                  
                  return (
                    <Draggable key={stock.symbol} draggableId={stock.symbol} index={index}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', stock.symbol);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className={`relative flex items-center justify-between cursor-pointer transition-all border-b border-[#1f1f1f]/30 ${
                            isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/5'
                          } ${watchlistState === 'closed' ? 'px-2 py-3' : 'px-4 py-3'} ${
                            snapshot.isDragging ? 'bg-[#1a1a1a] shadow-lg ring-1 ring-emerald-500/40' : ''
                          }`}
                          onClick={() => handleSelectSymbol(stock.symbol)}
                        >
                          {watchlistState === 'closed' ? (
                            <div className="w-full text-center">
                              <div className="text-white text-xs font-bold">${displaySymbol}</div>
                              <div className={`text-[10px] font-medium mt-0.5 ${price > 0 ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-white/50'}`}>
                                {price > 0 ? `$${formatPrice(price)}` : '...'}
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Drag Handle */}
                              <div 
                                {...provided.dragHandleProps}
                                className="mr-2 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              <div className="flex-1 min-w-0 pr-4">
                                <div className="text-white font-bold text-base">${displaySymbol}</div>
                                <div className="text-white/50 text-sm truncate">{name}</div>
                              </div>

                              <div className="ml-auto pr-3 text-right flex-shrink-0">
                                <div className="text-white font-semibold text-base font-mono">
                                  {price > 0 ? `$${formatPrice(price)}` : '...'}
                                </div>
                                {price > 0 && (
                                  <div className="flex flex-col items-end gap-1">
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowDollarChange(!showDollarChange);
                                      }}
                                      className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
                                    >
                                      {showDollarChange 
                                        ? `${isPositive ? '+' : ''}$${Math.abs(change).toFixed(2)}`
                                        : `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`
                                      }
                                    </span>
                                    {showPreMarket && (
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowDollarChange(!showDollarChange);
                                        }}
                                        className="text-xs font-semibold text-blue-400 flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                      >
                                        <span className="text-yellow-400">☀️</span>
                                        {showDollarChange 
                                          ? `${preMarketChange >= 0 ? '+' : ''}$${Math.abs(preMarketChange || 0).toFixed(2)}`
                                          : preMarketPercentLabel
                                        }
                                      </span>
                                    )}
                                    {showAfterHours && (
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowDollarChange(!showDollarChange);
                                        }}
                                        className="text-xs font-semibold text-blue-400 flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                      >
                                        <span className="text-purple-400">🌙</span>
                                        {showDollarChange 
                                          ? `${afterHoursChange >= 0 ? '+' : ''}$${Math.abs(afterHoursChange || 0).toFixed(2)}`
                                          : afterHoursPercentLabel
                                        }
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                            </>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Footer */}
        {watchlistState !== 'closed' && (
          <div className="p-3 border-t border-[#1f1f1f] flex items-center justify-between text-xs">
            <span className="text-gray-400">{activeWatchlist.length} symbols</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
              <span className={activeMarket === 'crypto' ? 'text-amber-400' : 'text-emerald-400'}>Alpaca</span>
            </div>
          </div>
        )}
      </div>

      {/* TradingView Chart + Trade Panel */}
      <div className="flex-1 flex flex-col bg-transparent min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-lg">${selectedDisplaySymbol}</h2>
            <span className="text-gray-400 text-sm">{selectedName}</span>
            {Number.isFinite(selectedQuote?.price) && (
              <span className={`text-sm font-semibold font-mono ${selectedQuote?.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {isSelectedLse
                  ? `£${Number(selectedQuote.price).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `$${formatPrice(selectedQuote.price)}`}
              </span>
            )}
            {isSelectedLse && (
              <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${
                lseMarketOpen
                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                  : 'border-white/20 text-white/55 bg-white/5'
              }`}>
                {lseMarketOpen ? 'Live' : 'Closed'}
              </span>
            )}
            <span className={`text-[10px] uppercase tracking-[0.2em] ${
              activeMarket === 'crypto'
                ? 'text-amber-400'
                : isSelectedLse
                  ? 'text-blue-400'
                  : 'text-white/40'
            }`}>
              {activeMarket === 'crypto' ? 'Crypto' : isSelectedLse ? 'LSE' : 'Equity'}
            </span>
            {!isTradePanelOpen && (
              <button
                onClick={() => setIsTradePanelOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-transparent border border-emerald-400/70 text-emerald-300 hover:text-emerald-200 hover:border-emerald-300 hover:shadow-[0_0_14px_rgba(16,185,129,0.22)] transition-colors"
              >
                <span>Trade</span>
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
          <div className="flex-1 min-h-0 min-w-0 relative">
            <TransparentChart
              symbol={isSelectedLse ? lseChartSymbol : selectedSymbol}
              onSymbolChange={(sym) => {
                if (activeMarket === 'crypto') setSelectedCrypto(sym);
                else setSelectedEquity(sym);
              }}
            />
          </div>

          <div
            className={`relative flex flex-col bg-[#0a0f1a] transition-all duration-300 overflow-hidden ${
              isTradePanelOpen
                ? 'w-[344px] border-l border-white/10 opacity-100'
                : 'w-0 border-l border-transparent opacity-0 pointer-events-none'
            }`}
          >
            <div className="border-b border-white/10 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400">Trade Entry</span>
                <button
                  type="button"
                  onClick={() => setIsTradePanelOpen(false)}
                  aria-label="Collapse trade panel"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-[11px] font-medium text-emerald-300 transition-all hover:border-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/12 hover:shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                >
                  <span>Collapse</span>
                  <ChevronsRight className="h-3.5 w-3.5 drop-shadow-[0_0_8px_rgba(16,185,129,0.35)]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {/* Entry Step */}
              <div className={`space-y-4 overflow-hidden transition-all duration-300 ${
                orderStep === 'entry' ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
                <AlpacaOrderTicket
                  side={orderSide}
                  onSideChange={(nextSide) => {
                    clearOrderError();
                    setOrderSide(nextSide);
                  }}
                  symbol={selectedDisplaySymbol ? `$${selectedDisplaySymbol}` : ''}
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
                        <div className="text-xs font-semibold text-slate-400">
                          {availableSharesDisplay} shares available
                        </div>
                      )}
                    </div>
                  }
                />
                {orderError && <div className="text-xs text-red-300">{orderError}</div>}
              </div>

              {/* Review Step */}
              <div className={`space-y-4 overflow-hidden transition-all duration-300 ${
                orderStep === 'review' ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
                <div className="space-y-3 rounded-lg border border-white/10 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Side</span>
                    <span className={orderSide === 'buy' ? 'text-emerald-300' : 'text-red-300'}>
                      {orderSide === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Ticker</span>
                    <span className="text-white">{selectedDisplaySymbol}</span>
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
                    <span className="text-white">
                      {estimatedTotal > 0 ? formatUsd(estimatedTotal) : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Time in Force</span>
                    <span className="text-white">{String(timeInForce || '').toUpperCase()}</span>
                  </div>
                </div>

                <button type="button" onClick={() => setOrderStep('entry')}
                  className="w-full rounded-lg border border-white/20 py-2 text-sm text-white/60 hover:text-white transition"
                >
                  Edit
                </button>
                <button type="button" onClick={handleSubmitOrder}
                  disabled={orderStatus.state === 'submitting'}
                  className={`h-10 w-full rounded-lg text-sm font-medium text-white ${actionButtonClass} ${
                    orderStatus.state === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {orderStatus.state === 'submitting' ? 'Submitting...' : 'Submit Order'}
                </button>
              </div>

              {/* Confirm Step */}
              <div className={`space-y-4 overflow-hidden transition-all duration-300 ${
                orderStep === 'confirm' ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className={`mt-1 h-5 w-5 ${orderStatus.state === 'success' ? 'text-emerald-400' : 'text-red-400'}`} />
                  <div>
                    <div className="text-lg font-medium text-white">
                      {orderStatus.state === 'success' ? 'Order Submitted' : 'Order Failed'}
                    </div>
                    {orderStatus.state === 'error' && (
                      <div className="mt-1 text-sm text-red-300">{orderStatus.message}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Ticker</span>
                    <span className="text-white">{selectedDisplaySymbol}</span>
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
                  {orderStatus.data?.filled_avg_price && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Fill Price</span>
                      <span className="text-white">{formatUsd(orderStatus.data.filled_avg_price)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Timestamp</span>
                    <span className="text-white">
                      {orderTimestamp ? formatTimestamp(orderTimestamp) : '--'}
                    </span>
                  </div>
                </div>

                <button type="button" onClick={handleResetOrder}
                  className="w-full rounded-lg border border-white/20 py-2 text-sm text-white/60 hover:text-white transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>

          <div className={`relative border-t xl:border-t-0 xl:border-l border-white/[0.06] bg-[#0b0b0b] min-h-0 transition-all duration-300 ${
            socialCollapsed ? 'w-full xl:w-14 p-1' : 'w-full xl:w-72 p-1.5'
          }`}>
            {!socialCollapsed && (
              <button
                type="button"
                onClick={() => setSocialCollapsed(true)}
                className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300 hover:text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/12 hover:shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all"
                title="Collapse social feed"
              >
                <span>Social</span>
                <ChevronsRight className="h-3.5 w-3.5 drop-shadow-[0_0_8px_rgba(16,185,129,0.35)]" />
              </button>
            )}
            {socialCollapsed ? (
              <div className="h-[360px] xl:h-full flex flex-col items-center gap-3 pt-2">
                {/* Social collapsed icon */}
                <button
                  type="button"
                  className="flex flex-col items-center justify-center w-11 h-11 bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg cursor-pointer hover:border-blue-500/40 transition-all group"
                  onClick={() => setSocialCollapsed(false)}
                  title="Expand Social Pulse"
                >
                  <div className="relative">
                    <ChevronsLeft className="relative w-4 h-4 text-blue-300/80 group-hover:text-blue-200 transition-colors" />
                  </div>
                </button>
                {!isTradePanelOpen && (
                  <button
                    type="button"
                    className="flex flex-col items-center justify-center w-11 h-11 bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg cursor-pointer hover:border-emerald-500/40 transition-all group"
                    onClick={() => setIsTradePanelOpen(true)}
                    title="Open Trade Panel"
                  >
                    <div className="relative">
                      <ChevronsLeft className="relative w-4 h-4 text-emerald-300/80 group-hover:text-emerald-300 transition-colors" />
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <div className="h-[360px] xl:h-full min-h-0">
                <SocialSentiment activeTicker={selectedDisplaySymbol} onCollapseChange={setSocialCollapsed} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradePage;
// v1770073772
