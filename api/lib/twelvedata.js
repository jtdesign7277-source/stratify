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

const LSE_FALLBACK_UNIVERSE = [
  { symbol: 'SHEL', instrumentName: 'Shell plc' },
  { symbol: 'AZN', instrumentName: 'AstraZeneca' },
  { symbol: 'HSBA', instrumentName: 'HSBC Holdings' },
  { symbol: 'BP', instrumentName: 'BP plc' },
  { symbol: 'ULVR', instrumentName: 'Unilever PLC' },
  { symbol: 'RIO', instrumentName: 'Rio Tinto' },
  { symbol: 'GSK', instrumentName: 'GSK plc' },
  { symbol: 'BARC', instrumentName: 'Barclays PLC' },
  { symbol: 'LLOY', instrumentName: 'Lloyds Banking Group' },
  { symbol: 'NG', instrumentName: 'National Grid' },
  { symbol: 'REL', instrumentName: 'RELX' },
  { symbol: 'VOD', instrumentName: 'Vodafone Group' },
  { symbol: 'DGE', instrumentName: 'Diageo' },
  { symbol: 'BATS', instrumentName: 'British American Tobacco' },
  { symbol: 'GLEN', instrumentName: 'Glencore' },
  { symbol: 'PRU', instrumentName: 'Prudential' },
  { symbol: 'STAN', instrumentName: 'Standard Chartered' },
  { symbol: 'AAL', instrumentName: 'Anglo American' },
  { symbol: 'LSEG', instrumentName: 'London Stock Exchange Group' },
  { symbol: 'CPG', instrumentName: 'Compass Group' },
  { symbol: 'BA', instrumentName: 'BAE Systems' },
  { symbol: 'TSCO', instrumentName: 'Tesco' },
  { symbol: 'IMB', instrumentName: 'Imperial Brands' },
  { symbol: 'MNG', instrumentName: 'M&G' },
  { symbol: 'SSE', instrumentName: 'SSE' },
  { symbol: 'SMIN', instrumentName: 'Smiths Group' },
  { symbol: 'AHT', instrumentName: 'Ashtead Group' },
  { symbol: 'JD', instrumentName: 'JD Sports Fashion' },
  { symbol: 'RR', instrumentName: 'Rolls-Royce Holdings' },
  { symbol: 'IAG', instrumentName: 'International Consolidated Airlines Group' },
  { symbol: 'EXPN', instrumentName: 'Experian' },
  { symbol: 'SPX', instrumentName: 'Spirax Group' },
  { symbol: 'LAND', instrumentName: 'Land Securities' },
  { symbol: 'HLN', instrumentName: 'Haleon' },
  { symbol: 'SGE', instrumentName: 'Sage Group' },
  { symbol: 'WPP', instrumentName: 'WPP' },
  { symbol: 'ABF', instrumentName: 'Associated British Foods' },
  { symbol: 'BLND', instrumentName: 'British Land' },
  { symbol: 'HIK', instrumentName: 'Hikma Pharmaceuticals' },
  { symbol: 'CNA', instrumentName: 'Centrica' },
  { symbol: 'BT.A', instrumentName: 'BT Group' },
  { symbol: 'MKS', instrumentName: 'Marks and Spencer Group' },
  { symbol: 'WEIR', instrumentName: 'The Weir Group' },
  { symbol: 'ADM', instrumentName: 'Admiral Group' },
  { symbol: 'AUTO', instrumentName: 'Auto Trader Group' },
  { symbol: 'BKG', instrumentName: 'Berkeley Group Holdings' },
  { symbol: 'EDV', instrumentName: 'Endeavour Mining' },
  { symbol: 'FRES', instrumentName: 'Fresnillo' },
  { symbol: 'ICG', instrumentName: 'Intermediate Capital Group' },
  { symbol: 'ITRK', instrumentName: 'Intertek Group' },
  { symbol: 'PSN', instrumentName: 'Persimmon' },
  { symbol: 'RKT', instrumentName: 'Reckitt Benckiser' },
  { symbol: 'SN', instrumentName: 'Smith & Nephew' },
  { symbol: 'SVT', instrumentName: 'Severn Trent' },
  { symbol: 'UU', instrumentName: 'United Utilities Group' },
  { symbol: 'WTB', instrumentName: 'Whitbread' },
  { symbol: 'ENT', instrumentName: 'Entain' },
  { symbol: 'INF', instrumentName: 'Informa' },
];

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeWatchlistSymbol = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  const noDollar = raw.replace(/^\$/, '');
  const base = noDollar.split(':')[0];
  return base;
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

const isLseVenue = (value) => {
  const text = String(value || '').toUpperCase();
  return text.includes('LSE') || text.includes('XLON') || text.includes('LONDON');
};

const normalizeListRow = (item = {}) => {
  const symbol = extractBaseSymbol(item.symbol || item.code || item.ticker || '');
  if (!symbol) return null;

  return {
    symbol,
    instrumentName:
      item.instrument_name ||
      item.name ||
      item.company_name ||
      item.description ||
      LSE_COMPANY_NAMES[symbol] ||
      symbol,
    exchange: item.exchange || item.market || 'LSE',
    micCode: item.mic_code || item.mic || 'XLON',
    country: item.country || 'United Kingdom',
    currency: item.currency || 'GBP',
    type: item.type || item.instrument_type || 'Common Stock',
  };
};

const dedupeListRows = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!row?.symbol) return;
    if (!map.has(row.symbol)) map.set(row.symbol, row);
  });
  return [...map.values()];
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
        open: toNumber(item?.open),
        high: toNumber(item?.high),
        low: toNumber(item?.low),
        close: toNumber(item?.close),
        volume: toNumber(item?.volume),
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

  const filtered = data
    .filter((item) => isLseVenue(item?.exchange) || isLseVenue(item?.mic_code) || isLseVenue(item?.country))
    .map((item) => normalizeListRow(item))
    .filter(Boolean);

  return dedupeListRows(filtered);
};

const collectRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.values)) return payload.values;
  if (Array.isArray(payload?.result)) return payload.result;
  if (payload && typeof payload === 'object') return [payload];
  return [];
};

export const fetchLseUniverse = async (limit = 600) => {
  const safeLimit = Math.max(50, Math.min(Number(limit) || 600, 1200));
  const attemptParams = [
    { exchange: 'LSE', outputsize: safeLimit },
    { exchange: 'XLON', outputsize: safeLimit },
    { mic_code: 'XLON', outputsize: safeLimit },
    { country: 'United Kingdom', outputsize: safeLimit },
  ];

  for (const params of attemptParams) {
    try {
      const payload = await requestTwelveData('/stocks', params);
      const rows = collectRows(payload)
        .map((item) => normalizeListRow(item))
        .filter(Boolean)
        .filter((item) => isLseVenue(item.exchange) || isLseVenue(item.micCode) || isLseVenue(item.country));

      const deduped = dedupeListRows(rows);
      if (deduped.length > 0) return deduped.slice(0, safeLimit);
    } catch {
      // Try next query strategy.
    }
  }

  return dedupeListRows(
    LSE_FALLBACK_UNIVERSE.map((item) =>
      normalizeListRow({
        symbol: item.symbol,
        instrument_name: item.instrumentName,
        exchange: 'LSE',
        mic_code: 'XLON',
        country: 'United Kingdom',
        currency: 'GBP',
      })
    ).filter(Boolean)
  ).slice(0, safeLimit);
};

const GLOBAL_MARKETS = {
  nyse: {
    id: 'nyse',
    label: 'New York Stock Exchange',
    currency: 'USD',
    country: 'United States',
    defaultSymbols: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'],
    exchangeHints: ['NYSE', 'NASDAQ', 'AMEX', 'ARCA', 'US'],
    candidateFormats: (base) => [base, `${base}:NYSE`, `${base}:NASDAQ`, `${base}:AMEX`, `${base}:ARCA`, `${base}.US`],
    stockListParams: [
      { exchange: 'NYSE' },
      { exchange: 'NASDAQ' },
      { country: 'United States' },
    ],
    fallbackUniverse: [
      { symbol: 'AAPL', instrumentName: 'Apple Inc.' },
      { symbol: 'MSFT', instrumentName: 'Microsoft Corporation' },
      { symbol: 'NVDA', instrumentName: 'NVIDIA Corporation' },
      { symbol: 'TSLA', instrumentName: 'Tesla, Inc.' },
      { symbol: 'AMZN', instrumentName: 'Amazon.com, Inc.' },
      { symbol: 'META', instrumentName: 'Meta Platforms, Inc.' },
      { symbol: 'GOOGL', instrumentName: 'Alphabet Inc. Class A' },
      { symbol: 'GOOG', instrumentName: 'Alphabet Inc. Class C' },
      { symbol: 'AVGO', instrumentName: 'Broadcom Inc.' },
      { symbol: 'BRK.B', instrumentName: 'Berkshire Hathaway Inc. Class B' },
      { symbol: 'JPM', instrumentName: 'JPMorgan Chase & Co.' },
      { symbol: 'V', instrumentName: 'Visa Inc.' },
      { symbol: 'MA', instrumentName: 'Mastercard Inc.' },
      { symbol: 'XOM', instrumentName: 'Exxon Mobil Corporation' },
      { symbol: 'WMT', instrumentName: 'Walmart Inc.' },
      { symbol: 'UNH', instrumentName: 'UnitedHealth Group Incorporated' },
      { symbol: 'LLY', instrumentName: 'Eli Lilly and Company' },
      { symbol: 'HD', instrumentName: 'The Home Depot, Inc.' },
      { symbol: 'PG', instrumentName: 'The Procter & Gamble Company' },
      { symbol: 'NFLX', instrumentName: 'Netflix, Inc.' },
      { symbol: 'AMD', instrumentName: 'Advanced Micro Devices, Inc.' },
      { symbol: 'INTC', instrumentName: 'Intel Corporation' },
      { symbol: 'PYPL', instrumentName: 'PayPal Holdings, Inc.' },
      { symbol: 'SPY', instrumentName: 'SPDR S&P 500 ETF Trust' },
      { symbol: 'QQQ', instrumentName: 'Invesco QQQ Trust' },
      { symbol: 'DIA', instrumentName: 'SPDR Dow Jones Industrial Average ETF Trust' },
      { symbol: 'IWM', instrumentName: 'iShares Russell 2000 ETF' },
      { symbol: 'GLD', instrumentName: 'SPDR Gold Shares' },
    ],
  },
  lse: {
    id: 'lse',
    label: 'London Stock Exchange',
    currency: 'GBP',
    country: 'United Kingdom',
    defaultSymbols: ['SHEL', 'AZN', 'HSBA', 'BP', 'BARC', 'LLOY'],
    exchangeHints: ['LSE', 'XLON', 'LONDON'],
    candidateFormats: (base) => [`${base}:LSE`, `${base}:XLON`, `${base}.LON`, `${base}.LSE`, base],
    stockListParams: [
      { exchange: 'LSE' },
      { exchange: 'XLON' },
      { mic_code: 'XLON' },
      { country: 'United Kingdom' },
    ],
    fallbackUniverse: LSE_FALLBACK_UNIVERSE,
  },
  tokyo: {
    id: 'tokyo',
    label: 'Tokyo Stock Exchange',
    currency: 'JPY',
    country: 'Japan',
    defaultSymbols: ['7203', '6758', '9984', '8306', '6861', '9432'],
    exchangeHints: ['TYO', 'TSE', 'JPX', 'TOKYO', 'JAPAN'],
    candidateFormats: (base) => [`${base}:TYO`, `${base}:TSE`, `${base}:JPX`, `${base}.JP`, base],
    stockListParams: [
      { exchange: 'TYO' },
      { exchange: 'TSE' },
      { country: 'Japan' },
    ],
    fallbackUniverse: [
      { symbol: '7203', instrumentName: 'Toyota Motor Corporation' },
      { symbol: '6758', instrumentName: 'Sony Group Corporation' },
      { symbol: '9984', instrumentName: 'SoftBank Group Corp.' },
      { symbol: '8306', instrumentName: 'Mitsubishi UFJ Financial Group, Inc.' },
      { symbol: '6861', instrumentName: 'Keyence Corporation' },
      { symbol: '9432', instrumentName: 'Nippon Telegraph and Telephone Corporation' },
      { symbol: '6501', instrumentName: 'Hitachi, Ltd.' },
      { symbol: '8035', instrumentName: 'Tokyo Electron Limited' },
      { symbol: '4063', instrumentName: 'Shin-Etsu Chemical Co., Ltd.' },
      { symbol: '6098', instrumentName: 'Recruit Holdings Co., Ltd.' },
      { symbol: '9433', instrumentName: 'KDDI Corporation' },
      { symbol: '8058', instrumentName: 'Mitsubishi Corporation' },
      { symbol: '8001', instrumentName: 'ITOCHU Corporation' },
      { symbol: '8766', instrumentName: 'Tokio Marine Holdings, Inc.' },
      { symbol: '2914', instrumentName: 'Japan Tobacco Inc.' },
      { symbol: '7267', instrumentName: 'Honda Motor Co., Ltd.' },
      { symbol: '9983', instrumentName: 'Fast Retailing Co., Ltd.' },
      { symbol: '4519', instrumentName: 'Chugai Pharmaceutical Co., Ltd.' },
      { symbol: '4568', instrumentName: 'Daiichi Sankyo Company, Limited' },
      { symbol: '6503', instrumentName: 'Mitsubishi Electric Corporation' },
    ],
  },
  sydney: {
    id: 'sydney',
    label: 'Sydney Stock Exchange',
    currency: 'AUD',
    country: 'Australia',
    defaultSymbols: ['BHP', 'CBA', 'WBC', 'NAB', 'ANZ', 'CSL'],
    exchangeHints: ['ASX', 'XASX', 'SYDNEY', 'AUSTRALIA'],
    candidateFormats: (base) => [`${base}:ASX`, `${base}:XASX`, `${base}.AU`, base],
    stockListParams: [
      { exchange: 'ASX' },
      { exchange: 'XASX' },
      { country: 'Australia' },
    ],
    fallbackUniverse: [
      { symbol: 'BHP', instrumentName: 'BHP Group Limited' },
      { symbol: 'CBA', instrumentName: 'Commonwealth Bank of Australia' },
      { symbol: 'WBC', instrumentName: 'Westpac Banking Corporation' },
      { symbol: 'NAB', instrumentName: 'National Australia Bank Limited' },
      { symbol: 'ANZ', instrumentName: 'ANZ Group Holdings Limited' },
      { symbol: 'CSL', instrumentName: 'CSL Limited' },
      { symbol: 'WES', instrumentName: 'Wesfarmers Limited' },
      { symbol: 'MQG', instrumentName: 'Macquarie Group Limited' },
      { symbol: 'WOW', instrumentName: 'Woolworths Group Limited' },
      { symbol: 'RIO', instrumentName: 'Rio Tinto Limited' },
      { symbol: 'GMG', instrumentName: 'Goodman Group' },
      { symbol: 'TLS', instrumentName: 'Telstra Group Limited' },
      { symbol: 'TCL', instrumentName: 'Transurban Group' },
      { symbol: 'ALL', instrumentName: 'Aristocrat Leisure Limited' },
      { symbol: 'COL', instrumentName: 'Coles Group Limited' },
      { symbol: 'QBE', instrumentName: 'QBE Insurance Group Limited' },
      { symbol: 'FMG', instrumentName: 'Fortescue Ltd' },
      { symbol: 'STO', instrumentName: 'Santos Limited' },
      { symbol: 'ORG', instrumentName: 'Origin Energy Limited' },
      { symbol: 'REA', instrumentName: 'REA Group Ltd' },
    ],
  },
};

const normalizeMarketId = (market) => {
  const normalized = String(market || '').trim().toLowerCase();
  if (normalized === 'nyse' || normalized === 'new-york' || normalized === 'newyork' || normalized === 'us') return 'nyse';
  if (normalized === 'lse' || normalized === 'london' || normalized === 'uk') return 'lse';
  if (normalized === 'tokyo' || normalized === 'tse' || normalized === 'tyo' || normalized === 'japan') return 'tokyo';
  if (normalized === 'sydney' || normalized === 'asx' || normalized === 'australia') return 'sydney';
  return normalized;
};

const getMarketConfig = (market) => {
  const key = normalizeMarketId(market);
  return GLOBAL_MARKETS[key] || null;
};

const normalizeGlobalListRow = (item = {}, marketConfig) => {
  const symbol = extractBaseSymbol(item.symbol || item.code || item.ticker || '');
  if (!symbol) return null;

  return {
    symbol,
    instrumentName:
      item.instrument_name ||
      item.name ||
      item.company_name ||
      item.description ||
      symbol,
    exchange: item.exchange || item.market || marketConfig.label,
    micCode: item.mic_code || item.mic || '',
    country: item.country || marketConfig.country,
    currency: item.currency || marketConfig.currency,
    type: item.type || item.instrument_type || 'Common Stock',
  };
};

const matchesMarketConfig = (item, marketConfig) => {
  const text = [
    item?.exchange,
    item?.mic_code,
    item?.micCode,
    item?.country,
    item?.instrument_name,
    item?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  return marketConfig.exchangeHints.some((hint) => text.includes(String(hint).toUpperCase()));
};

const normalizeRequestedSymbols = (symbols, marketConfig) => {
  const input = normalizeSymbols(symbols);
  if (input.length > 0) return input;
  return [...marketConfig.defaultSymbols];
};

const globalSymbolCandidates = (symbol, marketConfig) => {
  const normalized = normalizeSymbols([symbol])[0] || '';
  const base = extractBaseSymbol(normalized);
  if (!base) return [];
  const candidates = marketConfig.candidateFormats(base);
  return normalizeSymbols(candidates);
};

const toGlobalQuoteRow = ({ requestedSymbol, attemptedSymbol, payload, marketConfig }) => {
  const base = extractBaseSymbol(requestedSymbol) || extractBaseSymbol(attemptedSymbol);
  const streamSymbol = String(payload?.symbol || attemptedSymbol || requestedSymbol || '').toUpperCase();
  return {
    requestedSymbol: String(requestedSymbol || base || '').toUpperCase(),
    symbol: streamSymbol,
    streamSymbol,
    name: payload?.name || base || streamSymbol,
    exchange: payload?.exchange || marketConfig.label,
    currency: payload?.currency || marketConfig.currency,
    price: toNumber(payload?.close || payload?.price || payload?.last),
    change: toNumber(payload?.change),
    percentChange: toNumber(payload?.percent_change ?? payload?.percentChange),
    timestamp: payload?.datetime || payload?.timestamp || null,
    raw: payload,
  };
};

const fetchSingleGlobalQuote = async (inputSymbol, marketConfig) => {
  const requestedBase = extractBaseSymbol(inputSymbol);
  const requestedSymbol = requestedBase || normalizeSymbols([inputSymbol])[0];
  if (!requestedSymbol) return null;

  const candidates = globalSymbolCandidates(requestedSymbol, marketConfig);
  for (const candidate of candidates) {
    try {
      const payload = await requestTwelveData('/quote', { symbol: candidate });
      const row = toGlobalQuoteRow({ requestedSymbol, attemptedSymbol: candidate, payload, marketConfig });
      if (row.price != null) return row;
    } catch {
      // Try the next candidate format.
    }
  }

  try {
    const searchPayload = await requestTwelveData('/symbol_search', {
      symbol: requestedBase,
      outputsize: 30,
    });
    const searchItems = Array.isArray(searchPayload?.data) ? searchPayload.data : [];
    const marketMatch = searchItems.find((item) => matchesMarketConfig(item, marketConfig));
    if (marketMatch?.symbol) {
      const payload = await requestTwelveData('/quote', { symbol: marketMatch.symbol });
      const row = toGlobalQuoteRow({
        requestedSymbol,
        attemptedSymbol: marketMatch.symbol,
        payload,
        marketConfig,
      });
      if (row.price != null) return row;
    }
  } catch {
    // No-op fallback below.
  }

  return {
    requestedSymbol,
    symbol: requestedSymbol,
    streamSymbol: requestedSymbol,
    name: requestedSymbol,
    exchange: marketConfig.label,
    currency: marketConfig.currency,
    price: null,
    change: null,
    percentChange: null,
    timestamp: null,
    raw: null,
  };
};

export const getDefaultGlobalSymbols = (market) => {
  const marketConfig = getMarketConfig(market);
  if (!marketConfig) return [];
  return [...marketConfig.defaultSymbols];
};

export const fetchGlobalQuotes = async (symbols, market) => {
  const marketConfig = getMarketConfig(market);
  if (!marketConfig) {
    const error = new Error('Unsupported market');
    error.status = 400;
    throw error;
  }

  const targetSymbols = normalizeRequestedSymbols(symbols, marketConfig);
  const rows = await Promise.all(targetSymbols.map((symbol) => fetchSingleGlobalQuote(symbol, marketConfig)));
  return rows.filter(Boolean);
};

export const searchGlobalSymbols = async (query, market) => {
  const marketConfig = getMarketConfig(market);
  if (!marketConfig) {
    const error = new Error('Unsupported market');
    error.status = 400;
    throw error;
  }

  const q = String(query || '').trim();
  if (!q) return [];

  try {
    const payload = await requestTwelveData('/symbol_search', { symbol: q, outputsize: 60 });
    const rows = (Array.isArray(payload?.data) ? payload.data : [])
      .filter((item) => matchesMarketConfig(item, marketConfig))
      .map((item) => normalizeGlobalListRow(item, marketConfig))
      .filter(Boolean);

    const deduped = dedupeListRows(rows);
    if (deduped.length > 0) return deduped;
  } catch {
    // Fallback to local list search.
  }

  return marketConfig.fallbackUniverse
    .filter((item) => `${item.symbol} ${item.instrumentName}`.toUpperCase().includes(q.toUpperCase()))
    .map((item) => ({
      symbol: extractBaseSymbol(item.symbol),
      instrumentName: item.instrumentName,
      exchange: marketConfig.label,
      micCode: '',
      country: marketConfig.country,
      currency: marketConfig.currency,
      type: 'Common Stock',
    }));
};

export const fetchGlobalUniverse = async (market, limit = 300) => {
  const marketConfig = getMarketConfig(market);
  if (!marketConfig) {
    const error = new Error('Unsupported market');
    error.status = 400;
    throw error;
  }

  const safeLimit = Math.max(50, Math.min(Number(limit) || 300, 1000));
  for (const params of marketConfig.stockListParams) {
    try {
      const payload = await requestTwelveData('/stocks', { ...params, outputsize: safeLimit });
      const rows = collectRows(payload)
        .filter((item) => matchesMarketConfig(item, marketConfig))
        .map((item) => normalizeGlobalListRow(item, marketConfig))
        .filter(Boolean);

      const deduped = dedupeListRows(rows);
      if (deduped.length > 0) return deduped.slice(0, safeLimit);
    } catch {
      // try next params
    }
  }

  return marketConfig.fallbackUniverse
    .map((item) => ({
      symbol: extractBaseSymbol(item.symbol),
      instrumentName: item.instrumentName,
      exchange: marketConfig.label,
      micCode: '',
      country: marketConfig.country,
      currency: marketConfig.currency,
      type: 'Common Stock',
    }))
    .slice(0, safeLimit);
};

const parseBatchQuotePayload = (payload) => {
  const quoteMap = {};
  if (!payload || typeof payload !== 'object') return quoteMap;

  if (Array.isArray(payload?.data)) {
    payload.data.forEach((item) => {
      const symbol = normalizeWatchlistSymbol(item?.symbol);
      if (symbol) quoteMap[symbol] = item;
    });
    return quoteMap;
  }

  const isSingleQuoteShape = payload?.symbol || payload?.close || payload?.price || payload?.last;
  if (isSingleQuoteShape) {
    const symbol = normalizeWatchlistSymbol(payload?.symbol);
    if (symbol) quoteMap[symbol] = payload;
    return quoteMap;
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (['status', 'code', 'message', 'meta'].includes(String(key))) return;
    if (!value || typeof value !== 'object') return;
    const symbol = normalizeWatchlistSymbol(value?.symbol || key);
    if (symbol) quoteMap[symbol] = value;
  });

  return quoteMap;
};

export const fetchWatchlistBatchQuotes = async (symbols, limit = 120) => {
  const source = Array.isArray(symbols) ? symbols : String(symbols || '').split(',');
  const seen = new Set();
  const normalized = source
    .map((item) => normalizeWatchlistSymbol(item))
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, Math.max(1, Math.min(Number(limit) || 120, 120)));

  if (normalized.length === 0) return [];

  const payload = await requestTwelveData('/quote', { symbol: normalized.join(',') });
  const quoteMap = parseBatchQuotePayload(payload);

  return normalized.map((symbol) => {
    const quote = quoteMap[symbol];
    return {
      symbol,
      name: quote?.name || symbol,
      exchange: quote?.exchange || '',
      currency: quote?.currency || 'USD',
      price: toNumber(quote?.close || quote?.price || quote?.last),
      change: toNumber(quote?.change),
      percentChange: toNumber(quote?.percent_change ?? quote?.percentChange),
      timestamp: quote?.datetime || quote?.timestamp || null,
      raw: quote || null,
    };
  });
};
