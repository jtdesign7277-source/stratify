const TOP_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V',
  'UNH', 'MA', 'HD', 'PG', 'JNJ', 'XOM', 'ABBV', 'COST', 'MRK', 'AVGO',
  'PEP', 'KO', 'WMT', 'LLY', 'MCD', 'CSCO', 'TMO', 'CRM', 'ACN', 'ABT',
  'ORCL', 'NFLX', 'AMD', 'TXN', 'ADBE', 'PM', 'NKE', 'INTC', 'WFC', 'BAC',
  'DIS', 'PYPL', 'QCOM', 'COIN', 'UBER', 'PLTR', 'SQ', 'SHOP', 'SNOW',
];

const MEME_SYMBOLS = [
  'GME', 'SOFI', 'NIO', 'FUBO', 'HIMS', 'AMC', 'BBBY', 'RIVN', 'LCID', 'HOOD',
  'DKNG', 'RBLX', 'PTON', 'AFRM', 'WISH', 'CLOV', 'MSTR', 'SMCI', 'ARM', 'IONQ',
];

const TRACKED_SYMBOLS = new Set([...TOP_SYMBOLS, ...MEME_SYMBOLS]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatDateUtc = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();

const normalizeHour = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('bmo') || normalized.includes('before')) return 'bmo';
  if (normalized.includes('amc') || normalized.includes('after')) return 'amc';
  return null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = (process.env.FINHUB_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'FINHUB_API_KEY is not configured' });
  }

  const now = new Date();
  const from = formatDateUtc(now);
  const to = formatDateUtc(new Date(now.getTime() + 7 * MS_PER_DAY));

  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: `Finnhub API error: ${response.status}`,
        detail,
      });
    }

    const data = await response.json();
    const rawCalendar = Array.isArray(data?.earningsCalendar)
      ? data.earningsCalendar
      : Array.isArray(data?.earningsCalendar?.earnings)
        ? data.earningsCalendar.earnings
        : [];

    const seen = new Set();
    const earnings = rawCalendar
      .map((item) => {
        const rawSymbol = normalizeSymbol(item?.symbol);
        if (!rawSymbol) return null;
        const symbol = rawSymbol === 'BRK-B' ? 'BRK.B' : rawSymbol;
        if (!TRACKED_SYMBOLS.has(symbol)) return null;

        const date = String(item?.date || '').trim();
        if (!date) return null;

        const key = `${symbol}-${date}`;
        if (seen.has(key)) return null;
        seen.add(key);

        return {
          symbol,
          date,
          epsEstimate: item?.epsEstimate ?? null,
          epsActual: item?.epsActual ?? null,
          revenueEstimate: item?.revenueEstimate ?? null,
          hour: normalizeHour(item?.hour),
          name: item?.name || item?.company || item?.companyName || item?.description || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.symbol.localeCompare(b.symbol);
      });

    return res.status(200).json({ earnings });
  } catch (error) {
    console.error('Earnings handler error:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
