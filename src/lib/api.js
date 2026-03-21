const SUPABASE_FUNCTIONS_BASE_URL = 'https://mszilrexlupzthauoaxb.supabase.co/functions/v1';
const RAILWAY_API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const API_ROUTES = Object.freeze({
  watchlistQuotes: '/api/watchlist/quotes',
  quote: '/api/quote',
  xray: '/api/xray',
  xrayQuote: '/api/xray/quote',
  chat: '/api/chat',
  chatV1: '/api/v1/chat',
});

const EDGE_ROUTE_MAP = new Map([
  [API_ROUTES.watchlistQuotes, `${SUPABASE_FUNCTIONS_BASE_URL}/watchlist-quotes`],
  [API_ROUTES.quote, `${SUPABASE_FUNCTIONS_BASE_URL}/quote`],
  [API_ROUTES.xray, `${SUPABASE_FUNCTIONS_BASE_URL}/xray`],
  [API_ROUTES.xrayQuote, `${SUPABASE_FUNCTIONS_BASE_URL}/xray-quote`],
  [API_ROUTES.chat, `${SUPABASE_FUNCTIONS_BASE_URL}/chat`],
  [API_ROUTES.chatV1, `${SUPABASE_FUNCTIONS_BASE_URL}/chat`],
]);

const resolveRoutePath = (route) => (
  Object.prototype.hasOwnProperty.call(API_ROUTES, route) ? API_ROUTES[route] : route
);

const splitRoute = (route) => {
  const trimmedRoute = String(route || '').trim();
  if (!trimmedRoute) return { path: '', query: '' };
  if (/^https?:\/\//i.test(trimmedRoute)) return { path: trimmedRoute, query: '', isAbsolute: true };

  const [rawPath, ...queryParts] = trimmedRoute.split('?');
  return {
    path: rawPath.replace(/\/+$/, '') || '/',
    query: queryParts.length > 0 ? `?${queryParts.join('?')}` : '',
    isAbsolute: false,
  };
};

export const getApiUrl = (route) => {
  const routePath = resolveRoutePath(route);
  const { path, query, isAbsolute } = splitRoute(routePath);

  if (isAbsolute || !path) return path;

  const edgeUrl = EDGE_ROUTE_MAP.get(path);
  if (edgeUrl) {
    return `${edgeUrl}${query}`;
  }

  return RAILWAY_API_BASE_URL ? `${RAILWAY_API_BASE_URL}${path}${query}` : `${path}${query}`;
};
