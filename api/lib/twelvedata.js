const TWELVE_DATA_BASE = 'https://api.twelvedata.com';
const DEFAULT_LSE_SYMBOLS = ['VOD:LSE', 'HSBA:LSE', 'BP:LSE', 'AZN:LSE', 'BARC:LSE', 'SHEL:LSE'];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getApiKey = () => String(process.env.TWELVEDATA_API_KEY || '').trim();

const assertApiKey = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error('TWELVEDATA_API_KEY not configured');
    error.status = 500;
    throw error;
  }
  return apiKey;
};

const normalizeSymbols = (symbols) => {
  const source = Array.isArray(symbols) ? symbols : String(symbols || '').split(',');
  const seen = new Set();
  return source
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter((symbol) => {
      if (!symbol || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
};

const makeUrl = (path, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    query.set(key, String(value));
  });
  return `${TWELVE_DATA_BASE}${path}?${query.toString()}`;
};

const requestTwelveData = async (path, params = {}) => {
  const apiKey = assertApiKey();
  const url = makeUrl(path, { ...params, apikey: apiKey });

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || `Twelve Data request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload?.status === 'error') {
    const error = new Error(payload?.message || 'Twelve Data error');
    error.status = 502;
    error.payload = payload;
    throw error;
  }

  return payload;
};

export const getTwelveDataWebSocketUrl = () => {
  const apiKey = assertApiKey();
  return `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(apiKey)}`;
};

export const getDefaultLseSymbols = () => [...DEFAULT_LSE_SYMBOLS];

export const fetchLseQuotes = async (symbols) => {
  const normalized = normalizeSymbols(symbols);
  const targetSymbols = normalized.length > 0 ? normalized : DEFAULT_LSE_SYMBOLS;
  const payload = await requestTwelveData('/quote', { symbol: targetSymbols.join(',') });

  if (Array.isArray(payload)) {
    return payload.map((item) => ({
      symbol: String(item?.symbol || '').toUpperCase(),
      name: item?.name || item?.symbol || '',
      exchange: item?.exchange || '',
      currency: item?.currency || '',
      price: toNumber(item?.close || item?.price || item?.last),
      change: toNumber(item?.change),
      percentChange: toNumber(item?.percent_change),
      timestamp: item?.datetime || null,
      raw: item,
    }));
  }

  if (payload && typeof payload === 'object') {
    const symbol = String(payload.symbol || '').toUpperCase();
    return [{
      symbol,
      name: payload?.name || symbol,
      exchange: payload?.exchange || '',
      currency: payload?.currency || '',
      price: toNumber(payload?.close || payload?.price || payload?.last),
      change: toNumber(payload?.change),
      percentChange: toNumber(payload?.percent_change),
      timestamp: payload?.datetime || null,
      raw: payload,
    }];
  }

  return [];
};

export const fetchLseTimeSeries = async (symbol, interval = '5min', outputsize = 120) => {
  const normalizedSymbol = normalizeSymbols([symbol])[0];
  if (!normalizedSymbol) {
    const error = new Error('Missing symbol');
    error.status = 400;
    throw error;
  }

  const payload = await requestTwelveData('/time_series', {
    symbol: normalizedSymbol,
    interval,
    outputsize,
    order: 'ASC',
    dp: 4,
  });

  const values = Array.isArray(payload?.values) ? payload.values : [];
  return {
    symbol: normalizedSymbol,
    interval,
    values: values
      .map((item) => ({
        datetime: item?.datetime || null,
        close: toNumber(item?.close),
      }))
      .filter((item) => item.datetime && item.close != null),
    meta: payload?.meta || {},
  };
};

export const searchLseSymbols = async (query) => {
  const q = String(query || '').trim();
  if (!q) return [];

  const payload = await requestTwelveData('/symbol_search', { symbol: q, outputsize: 30 });
  const data = Array.isArray(payload?.data) ? payload.data : [];

  return data
    .filter((item) => String(item?.exchange || '').toUpperCase().includes('LSE'))
    .map((item) => ({
      symbol: String(item?.symbol || '').toUpperCase(),
      instrumentName: item?.instrument_name || item?.symbol || '',
      exchange: item?.exchange || '',
      micCode: item?.mic_code || '',
      country: item?.country || '',
      currency: item?.currency || '',
      type: item?.type || '',
    }));
};
