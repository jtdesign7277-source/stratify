const isUsExchange = (value) => {
  const exchange = String(value || '').trim().toUpperCase();
  return exchange === 'NYSE' || exchange === 'NASDAQ';
};

const normalizeType = (value) => String(value || '').trim();
const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();
const toSearchKey = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const getTypePriority = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (!type) return 9;
  if (type.includes('common stock') || type.includes('stock')) return 0;
  if (type.includes('etf') || type.includes('etp')) return 1;
  if (type.includes('index')) return 2;
  if (type.includes('crypto')) return 3;
  return 4;
};

const scoreSearchEntry = (entry, query) => {
  const normalizedQuery = String(query || '').trim().toUpperCase();
  const queryKey = toSearchKey(normalizedQuery);
  const symbol = normalizeSymbol(entry?.symbol);
  const symbolKey = toSearchKey(symbol);
  const name = String(entry?.name || '').toUpperCase();

  if (!normalizedQuery) return 99;
  if (symbol === normalizedQuery || symbolKey === queryKey) return 0;
  if (symbol.startsWith(normalizedQuery) || symbolKey.startsWith(queryKey)) return 1;
  if (symbol.includes(normalizedQuery) || symbolKey.includes(queryKey)) return 2;
  if (name.startsWith(normalizedQuery)) return 3;
  if (name.includes(normalizedQuery)) return 4;
  return 99;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ data: [], error: 'Method not allowed' });
  }

  const query = String(req.query?.query || '').trim();
  if (!query || query.length < 1) {
    return res.status(200).json({ data: [] });
  }

  const apiKey = String(
    process.env.TWELVE_DATA_API_KEY ||
      process.env.TWELVEDATA_API_KEY ||
      process.env.VITE_TWELVE_DATA_API_KEY ||
      process.env.VITE_TWELVEDATA_API_KEY ||
      process.env.VITE_TWELVE_DATA_APIKEY ||
      ''
  ).trim();

  if (!apiKey) {
    console.error('Symbol search error: Missing TWELVE_DATA_API_KEY');
    return res.status(500).json({ data: [], error: 'Missing TWELVE_DATA_API_KEY' });
  }

  try {
    const params = new URLSearchParams({
      symbol: query,
      outputsize: '120',
      apikey: apiKey,
    });
    const response = await fetch(
      `https://api.twelvedata.com/symbol_search?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.status === 'error') {
      const message = payload?.message || `Twelve Data symbol search failed (${response.status})`;
      throw new Error(message);
    }

    const rawRows = Array.isArray(payload?.data) ? payload.data : [];
    const normalizedRows = rawRows
      .map((item) => ({
        symbol: normalizeSymbol(item?.symbol),
        name: String(item?.instrument_name || item?.name || item?.description || '').trim(),
        exchange: String(item?.exchange || item?.mic_code || item?.country || '').trim(),
        type: normalizeType(item?.instrument_type || item?.type),
      }))
      .filter((item) => item.symbol);

    const dedupedMap = new Map();
    normalizedRows.forEach((item) => {
      if (!dedupedMap.has(item.symbol)) {
        dedupedMap.set(item.symbol, item);
      }
    });

    const dedupedRows = [...dedupedMap.values()];
    const scoredRows = dedupedRows
      .map((item) => ({
        ...item,
        score: scoreSearchEntry(item, query),
      }))
      .filter((item) => item.score !== 99);

    scoredRows.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const aTypePriority = getTypePriority(a.type);
      const bTypePriority = getTypePriority(b.type);
      if (aTypePriority !== bTypePriority) return aTypePriority - bTypePriority;
      const aUsPriority = isUsExchange(a.exchange) ? 0 : 1;
      const bUsPriority = isUsExchange(b.exchange) ? 0 : 1;
      if (aUsPriority !== bUsPriority) return aUsPriority - bUsPriority;
      return String(a.symbol || '').localeCompare(String(b.symbol || ''));
    });

    const results = scoredRows
      .slice(0, 80)
      .map(({ score, ...item }) => item);

    return res.status(200).json({ data: results });
  } catch (error) {
    console.error('Symbol search error:', error);
    return res.status(502).json({ data: [], error: 'Symbol search failed' });
  }
}
