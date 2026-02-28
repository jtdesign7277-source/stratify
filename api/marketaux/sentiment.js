const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  try {
    const url = `https://api.marketaux.com/v1/entity/stats/aggregation?symbols=${symbols.toUpperCase()}&language=en&api_token=${MARKETAUX_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: 'MarketAux error' });

    const data = await response.json();
    const sentimentMap = {};
    (data.data || []).forEach(e => {
      sentimentMap[e.key] = { sentiment: e.sentiment_avg, totalDocs: e.total_documents };
    });

    return res.status(200).json({ sentimentMap, _fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Sentiment error:', err);
    return res.status(500).json({ error: err.message });
  }
}
