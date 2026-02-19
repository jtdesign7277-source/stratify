const TWELVE_DATA_BASE = 'https://api.twelvedata.com';
const DEFAULT_LSE_SYMBOLS = ['SHEL', 'AZN', 'HSBA', 'BP', 'ULVR', 'RIO', 'GSK', 'BARC', 'LLOY', 'NG', 'REL', 'VOD'];

const LSE_COMPANY_NAMES = {
  SHEL: 'Shell plc',
  AZN: 'AstraZeneca',
  HSBA: 'HSBC Holdings',
  BP: 'BP plc',
  ULVR: 'Unilever PLC',
  RIO: 'Rio Tinto',
  GSK: 'GSK plc',
  BARC: 'Barclays PLC',
  LLOY: 'Lloyds Banking Group',
  NG: 'National Grid',
  REL: 'RELX',
  VOD: 'Vodafone Group',
};

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

const extractBaseSymbol = (symbol) => {
  const normalized = normalizeSymbols([symbol])[0] || '';
  if (!normalized) return '';
  const colonBase = normalized.split(':')[0];
  const dotBase = colonBase.split('.')[0];
  return dotBase.replace(/^\$/, '').trim().toUpperCase();
};

const symbolCandidates = (symbol) => {
  const normalized = normalizeSymbols([symbol])[0] || '';
  const base = extractBaseSymbol(normalized);
  const candidates = [
    normalized,
    `${base}:LSE`,
    `${base}:XLON`,
    `${base}.LON`,
    `${base}.LSE`,
    base,
  ];
  return normalizeSymbols(candidates);
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

const toQuoteRow = ({ requestedSymbol, attemptedSymbol, payload }) => {
  const base = extractBaseSymbol(requestedSymbol) || extractBaseSymbol(attemptedSymbol);
  const streamSymbol = String(payload?.symbol || attemptedSymbol || requestedSymbol || '').toUpperCase();
  return {
    requestedSymbol: String(requestedSymbol || base || '').toUpperCase(),
    symbol: streamSymbol,
    streamSymbol,
    name: payload?.name || LSE_COMPANY_NAMES[base] || base || streamSymbol,
    exchange: payload?.exchange || 'LSE',
    currency: payload?.currency || 'GBP',
    price: toNumber(payload?.close || payload?.price || payload?.last),
    change: toNumber(payload?.change),
    percentChange: toNumber(payload?.percent_change ?? payload?.percentChange),
    timestamp: payload?.datetime || payload?.timestamp || null,
    raw: payload,
  };
};

const fetchSingleLseQuote = async (inputSymbol) => {
  const requestedBase = extractBaseSymbol(inputSymbol);
  const requestedSymbol = requestedBase || normalizeSymbols([inputSymbol])[0];
  if (!requestedSymbol) return null;

  const candidates = symbolCandidates(requestedSymbol);
  for (const candidate of candidates) {
    try {
      const payload = await requestTwelveData('/quote', { symbol: candidate });
      const row = toQuoteRow({ requestedSymbol, attemptedSymbol: candidate, payload });
      if (row.price != null) return row;
    } catch {
      // Try next candidate format.
    }
  }

  try {
    const searchPayload = await requestTwelveData('/symbol_search', {
      symbol: requestedBase,
      outputsize: 20,
    });
    const searchItems = Array.isArray(searchPayload?.data) ? searchPayload.data : [];
    const lseMatch = searchItems.find((item) =>
      String(item?.exchange || '').toUpperCase().includes('LSE')
    );

    if (lseMatch?.symbol) {
      const payload = await requestTwelveData('/quote', { symbol: lseMatch.symbol });
      const row = toQuoteRow({ requestedSymbol, attemptedSymbol: lseMatch.symbol, payload });
      if (row.price != null) return row;
    }
  } catch {
    // No-op fallback below.
  }

  return {
    requestedSymbol,
    symbol: requestedSymbol,
    streamSymbol: requestedSymbol,
    name: LSE_COMPANY_NAMES[requestedBase] || requestedSymbol,
    exchange: 'LSE',
    currency: 'GBP',
    price: null,
    change: null,
    percentChange: null,
    timestamp: null,
    raw: null,
  };
};

export const fetchLseQuotes = async (symbols) => {
  const normalized = normalizeSymbols(symbols);
  const targetSymbols = normalized.length > 0 ? normalized : DEFAULT_LSE_SYMBOLS;
  const rows = await Promise.all(targetSymbols.map((symbol) => fetchSingleLseQuote(symbol)));
  return rows.filter(Boolean);
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
