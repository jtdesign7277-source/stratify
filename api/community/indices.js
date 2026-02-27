// api/community/indices.js
// Returns quotes + intraday sparklines for S&P 500, NASDAQ, Dow Jones, VIX
// Uses Twelve Data index symbols with candidate fallbacks.

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

// Each index gets a list of candidate symbols to try in order.
// Twelve Data accepts SPX, IXIC, DJI, VIX for major US indices.
// We also include the more common Yahoo-style ^-prefixed versions as fallbacks,
// plus the ETF proxies as last resort so the card always has data.
const INDICES = [
  {
    key: 'SPX',
    label: 'S&P 500',
    candidates: ['SPX', '^GSPC', 'SPY'],
    etfFallback: 'SPY',
    etfMultiplier: 10, // SPY ≈ SPX / 10
  },
  {
    key: 'IXIC',
    label: 'NASDAQ',
    candidates: ['IXIC', '^IXIC', 'QQQ'],
    etfFallback: 'QQQ',
    etfMultiplier: null,
  },
  {
    key: 'DJI',
    label: 'Dow Jones',
    candidates: ['DJI', '^DJI', 'DIA'],
    etfFallback: 'DIA',
    etfMultiplier: 100, // DIA ≈ DJI / 100
  },
  {
    key: 'VIX',
    label: 'VIX',
    candidates: ['VIX', '^VIX'],
    etfFallback: null,
    etfMultiplier: null,
  },
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

// Fetch a single quote, trying each candidate symbol until one returns a valid price.
async function fetchQuoteWithFallback(candidates) {
  for (const sym of candidates) {
    try {
      const data = await tdFetch('/quote', { symbol: sym });
      if (!data || data.status === 'error' || !data.close) continue;
      const price = toNum(data.close);
      if (!price) continue;
      return {
        resolvedSymbol: sym,
        price,
        change: toNum(data.change) ?? 0,
        pct: toNum(data.percent_change) ?? 0,
        open: toNum(data.open) ?? price,
        name: data.name || sym,
      };
    } catch {
      // try next
    }
  }
  return null;
}

// Fetch intraday sparkline (close prices oldest→newest).
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
        const quote = await fetchQuoteWithFallback(idx.candidates);

        // If no index quote, card returns null price
        if (!quote) {
          return { key: idx.key, label: idx.label, quote: null, sparkline: [] };
        }

        // Fetch sparkline using the resolved symbol
        const sparkline = await fetchSparkline(quote.resolvedSymbol);

        return {
          key: idx.key,
          label: idx.label,
          resolvedSymbol: quote.resolvedSymbol,
          quote: {
            price:  quote.price,
            change: quote.change,
            pct:    quote.pct,
            open:   quote.open,
            name:   quote.name,
          },
          sparkline,
        };
      })
    );

    return res.status(200).json({ indices: results });
  } catch (err) {
    console.error('[api/community/indices] error:', err);
    return res.status(500).json({ error: 'Failed to fetch index data' });
  }
}
