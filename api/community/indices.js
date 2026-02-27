// api/community/indices.js
// Returns quotes + intraday sparklines for SPY, QQQ, DIA, BTC/USD

const TD_BASE = 'https://api.twelvedata.com';
const SPARKLINE_POINTS = 78; // full trading day at 5-min intervals

const getApiKey = () =>
  String(
    process.env.TWELVE_DATA_API_KEY ||
    process.env.TWELVEDATA_API_KEY ||
    process.env.VITE_TWELVE_DATA_API_KEY ||
    process.env.VITE_TWELVEDATA_API_KEY ||
    ''
  ).trim();

const INDICES = [
  { key: 'SPY',     label: 'SPY',  symbol: 'SPY'     },
  { key: 'QQQ',     label: 'QQQ',  symbol: 'QQQ'     },
  { key: 'DIA',     label: 'DIA',  symbol: 'DIA'     },
  { key: 'BTC/USD', label: 'BTC',  symbol: 'BTC/USD' },
];

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

async function tdFetch(path, params) {
  const apiKey = getApiKey();
  const qs = new URLSearchParams({ ...params, apikey: apiKey }).toString();
  const url = `${TD_BASE}${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data;
}

async function fetchQuote(symbol) {
  try {
    const data = await tdFetch('/quote', { symbol });
    if (!data || data.status === 'error' || !data.close) return null;
    const price = toNum(data.close);
    if (!price) return null;
    return {
      price,
      change: toNum(data.change) ?? 0,
      pct:    toNum(data.percent_change) ?? 0,
      open:   toNum(data.open) ?? price,
      name:   data.name || symbol,
    };
  } catch {
    return null;
  }
}

async function fetchSparkline(symbol) {
  try {
    const data = await tdFetch('/time_series', {
      symbol,
      interval: '5min',
      outputsize: String(SPARKLINE_POINTS),
    });
    if (!Array.isArray(data?.values) || data.values.length === 0) return [];
    // Twelve Data returns newest-first — reverse for left→right rendering
    return data.values
      .slice()
      .reverse()
      .map((v) => toNum(v.close))
      .filter((n) => n !== null);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'Twelve Data API key not configured' });
  }

  try {
    const results = await Promise.all(
      INDICES.map(async (idx) => {
        const [quote, sparkline] = await Promise.all([
          fetchQuote(idx.symbol),
          fetchSparkline(idx.symbol),
        ]);

        return {
          key:      idx.key,
          label:    idx.label,
          quote:    quote ?? null,
          sparkline: sparkline ?? [],
        };
      })
    );

    return res.status(200).json({ indices: results });
  } catch (err) {
    console.error('[api/community/indices] error:', err);
    return res.status(500).json({ error: 'Failed to fetch index data' });
  }
}
