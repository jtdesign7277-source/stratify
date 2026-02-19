const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

const INDICATOR_DEFINITIONS = {
  rsi: {
    endpoint: '/rsi',
    defaults: { interval: '1day', time_period: 14, outputsize: 2 },
  },
  macd: {
    endpoint: '/macd',
    defaults: {
      interval: '1day',
      fast_period: 12,
      slow_period: 26,
      signal_period: 9,
      outputsize: 2,
    },
  },
  bbands: {
    endpoint: '/bbands',
    defaults: { interval: '1day', time_period: 20, sd: 2, outputsize: 2 },
  },
  ema: {
    endpoint: '/ema',
    defaults: { interval: '1day', time_period: 20, outputsize: 2 },
  },
  sma: {
    endpoint: '/sma',
    defaults: { interval: '1day', time_period: 20, outputsize: 2 },
  },
  stoch: {
    endpoint: '/stoch',
    defaults: { interval: '1day', k_period: 14, d_period: 3, outputsize: 2 },
  },
  adx: {
    endpoint: '/adx',
    defaults: { interval: '1day', time_period: 14, outputsize: 2 },
  },
  atr: {
    endpoint: '/atr',
    defaults: { interval: '1day', time_period: 14, outputsize: 2 },
  },
  supertrend: {
    endpoint: '/supertrend',
    defaults: { interval: '1day', period: 10, multiplier: 3, outputsize: 2 },
  },
  obv: {
    endpoint: '/obv',
    defaults: { interval: '1day', outputsize: 3 },
  },
  ichimoku: {
    endpoint: '/ichimoku',
    defaults: { interval: '1day', outputsize: 2 },
  },
};

export const AVAILABLE_INDICATORS = Object.freeze(
  Object.keys(INDICATOR_DEFINITIONS).map((name) => ({
    name,
    endpoint: INDICATOR_DEFINITIONS[name].endpoint,
  })),
);

const NUMERIC_VALUE_PATTERN = /^-?\d+(\.\d+)?$/;

const toScalar = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (NUMERIC_VALUE_PATTERN.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return value;
};

const normalizeRow = (row = {}) =>
  Object.entries(row).reduce((acc, [key, value]) => {
    acc[key] = toScalar(value);
    return acc;
  }, {});

const normalizeRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeRow(row))
    .filter((row) => row && typeof row === 'object');

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

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase().replace(/^\$/, '');

const normalizeIndicatorName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const normalizeValue = (value) => {
  if (Array.isArray(value)) return normalizeValue(value[0]);
  if (value == null) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
};

const buildParams = ({ symbol, interval, outputsize, params = {}, defaults = {} }) => {
  const merged = {
    ...defaults,
    ...params,
  };

  const maybeInterval = normalizeValue(interval);
  if (maybeInterval) merged.interval = maybeInterval;

  const maybeOutputSize = Number(outputsize);
  if (Number.isFinite(maybeOutputSize) && maybeOutputSize > 0) {
    merged.outputsize = Math.floor(maybeOutputSize);
  }

  return {
    symbol: normalizeSymbol(symbol),
    ...merged,
  };
};

const makeUrl = (path, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    searchParams.set(key, String(value));
  });
  return `${TWELVE_DATA_BASE}${path}?${searchParams.toString()}`;
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
    const error = new Error(payload?.message || 'Twelve Data indicator error');
    error.status = 502;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const normalizeIndicatorPayload = ({ indicatorName, requestedSymbol, payload }) => {
  const values = normalizeRows(payload?.values || payload?.data || []);
  const latest = values[0] || null;
  const previous = values[1] || null;

  return {
    indicator: indicatorName,
    symbol: normalizeSymbol(payload?.meta?.symbol || requestedSymbol),
    interval: payload?.meta?.interval || null,
    latest,
    previous,
    values,
    meta: payload?.meta || {},
    fetchedAt: new Date().toISOString(),
  };
};

export const resolveIndicatorConfig = (name) => {
  const normalizedName = normalizeIndicatorName(name);
  const config = INDICATOR_DEFINITIONS[normalizedName];
  if (!config) {
    const error = new Error(`Unsupported indicator: ${name}`);
    error.status = 400;
    throw error;
  }
  return { normalizedName, config };
};

export const fetchIndicator = async ({ name, symbol, interval, outputsize, params = {} }) => {
  const requestedSymbol = normalizeSymbol(symbol);
  if (!requestedSymbol) {
    const error = new Error('Missing symbol');
    error.status = 400;
    throw error;
  }

  const { normalizedName, config } = resolveIndicatorConfig(name);
  const requestParams = buildParams({
    symbol: requestedSymbol,
    interval,
    outputsize,
    params,
    defaults: config.defaults,
  });

  const payload = await requestTwelveData(config.endpoint, requestParams);
  return normalizeIndicatorPayload({
    indicatorName: normalizedName,
    requestedSymbol,
    payload,
  });
};

const normalizeIndicatorList = (indicators) => {
  const source = Array.isArray(indicators)
    ? indicators
    : String(indicators || '').split(',');

  const seen = new Set();
  return source
    .map((name) => normalizeIndicatorName(name))
    .filter((name) => {
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .filter((name) => Boolean(INDICATOR_DEFINITIONS[name]));
};

export const fetchIndicatorsBatch = async ({
  symbol,
  indicators,
  interval,
  outputsize,
  paramsByIndicator = {},
} = {}) => {
  const requestedSymbol = normalizeSymbol(symbol);
  if (!requestedSymbol) {
    const error = new Error('Missing symbol');
    error.status = 400;
    throw error;
  }

  const requestedIndicators = normalizeIndicatorList(indicators);
  if (requestedIndicators.length === 0) {
    const error = new Error('No valid indicators requested');
    error.status = 400;
    throw error;
  }

  const entries = await Promise.all(
    requestedIndicators.map(async (indicatorName) => {
      try {
        const result = await fetchIndicator({
          name: indicatorName,
          symbol: requestedSymbol,
          interval,
          outputsize,
          params: paramsByIndicator?.[indicatorName] || {},
        });

        return [indicatorName, { ok: true, data: result }];
      } catch (error) {
        return [
          indicatorName,
          {
            ok: false,
            error: {
              message: error?.message || 'Indicator request failed',
              status: Number(error?.status) || 500,
              details: error?.payload || null,
            },
          },
        ];
      }
    }),
  );

  const data = {};
  const errors = {};

  entries.forEach(([indicatorName, result]) => {
    if (result.ok) {
      data[indicatorName] = result.data;
      return;
    }
    errors[indicatorName] = result.error;
  });

  return {
    symbol: requestedSymbol,
    interval: normalizeValue(interval) || null,
    requestedIndicators,
    count: requestedIndicators.length,
    data,
    errors,
    fetchedAt: new Date().toISOString(),
  };
};

