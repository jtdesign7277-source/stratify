const SB = 'https://mszilrexlupzthauoaxb.supabase.co/functions/v1';
const RW = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const EDGE_MAP = {
  '/api/stocks': SB + '/stocks',
  '/api/bars': SB + '/bars',
  '/api/chart/candles': SB + '/chart-candles',
  '/api/stock/search': SB + '/stock-search',
  '/api/search': SB + '/news',
  '/api/news': SB + '/news',
  '/api/quote': SB + '/quote',
  '/api/latest-quote': SB + '/latest-quote',
  '/api/sparkline': SB + '/sparkline',
  '/api/crypto/twelve-data-price': SB + '/crypto-price',
  '/api/xray': SB + '/xray',
  '/api/xray/quote': SB + '/xray-quote',
  '/api/xray/statistics': SB + '/xray',
  '/api/xray/profile': SB + '/xray',
  '/api/xray/income-statement': SB + '/xray',
  '/api/xray/balance-sheet': SB + '/xray',
  '/api/xray/cash-flow': SB + '/xray',
  '/api/chat': SB + '/chat',
  '/api/v1/chat': SB + '/chat',
  '/api/v1/chat/': SB + '/chat',
  '/api/sophia-chat': SB + '/chat',
  '/api/watchlist/quotes': SB + '/watchlist-quotes',
  '/api/odds/events': SB + '/odds-events',
};

export const API_ROUTES = Object.freeze({
  stocks: '/api/stocks',
  bars: '/api/bars',
  chartCandles: '/api/chart/candles',
  stockSearch: '/api/stock/search',
  search: '/api/search',
  news: '/api/news',
  quote: '/api/quote',
  latestQuote: '/api/latest-quote',
  sparkline: '/api/sparkline',
  cryptoPrice: '/api/crypto/twelve-data-price',
  xray: '/api/xray',
  xrayQuote: '/api/xray/quote',
  chat: '/api/chat',
  chatV1: '/api/v1/chat',
  sophiaChat: '/api/sophia-chat',
  watchlistQuotes: '/api/watchlist/quotes',
  oddsEvents: '/api/odds/events',
});

export const getApiUrl = (route) => {
  const path = API_ROUTES[route] || route;
  const clean = String(path || '').trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  const [basePath, ...qParts] = clean.split('?');
  const normalized = basePath.replace(/\/+$/, '');
  const qs = qParts.length > 0 ? '?' + qParts.join('?') : '';
  const edgeUrl = EDGE_MAP[normalized];
  if (edgeUrl) return edgeUrl + qs;
  return RW ? RW + normalized + qs : normalized + qs;
};
