const isUsExchange = (value) => {
  const exchange = String(value || '').trim().toUpperCase();
  return exchange === 'NYSE' || exchange === 'NASDAQ';
};

const normalizeType = (value) => String(value || '').trim();

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
      ''
  ).trim();

  if (!apiKey) {
    console.error('Symbol search error: Missing TWELVE_DATA_API_KEY');
    return res.status(500).json({ data: [], error: 'Missing TWELVE_DATA_API_KEY' });
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=20`,
      {
        headers: {
          Authorization: `apikey ${apiKey}`,
          Accept: 'application/json',
        },
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.status === 'error') {
      const message = payload?.message || `Twelve Data symbol search failed (${response.status})`;
      throw new Error(message);
    }

    const results = (Array.isArray(payload?.data) ? payload.data : [])
      .filter((item) => {
        const instrumentType = normalizeType(item?.instrument_type);
        return (
          instrumentType === 'Common Stock' ||
          instrumentType === 'ETF' ||
          instrumentType === 'ETP'
        );
      })
      .sort((a, b) => {
        const aUsPriority = isUsExchange(a?.exchange) ? 0 : 1;
        const bUsPriority = isUsExchange(b?.exchange) ? 0 : 1;
        if (aUsPriority !== bUsPriority) return aUsPriority - bUsPriority;
        return String(a?.symbol || '').localeCompare(String(b?.symbol || ''));
      })
      .slice(0, 15)
      .map((item) => ({
        symbol: String(item?.symbol || '').trim(),
        name: String(item?.instrument_name || '').trim(),
        exchange: String(item?.exchange || '').trim(),
        type: normalizeType(item?.instrument_type),
      }))
      .filter((item) => item.symbol);

    return res.status(200).json({ data: results });
  } catch (error) {
    console.error('Symbol search error:', error);
    return res.status(502).json({ data: [], error: 'Symbol search failed' });
  }
}
