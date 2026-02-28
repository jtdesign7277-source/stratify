const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { countries = 'us', min_doc_count = '5' } = req.query;

  try {
    const url = `https://api.marketaux.com/v1/entity/trending/aggregation?countries=${countries}&min_doc_count=${min_doc_count}&language=en&api_token=${MARKETAUX_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: 'MarketAux error' });

    const data = await response.json();
    const trending = (data.data || []).map(e => ({ symbol: e.key, totalDocs: e.total_documents, sentiment: e.sentiment_avg, score: e.score }));

    return res.status(200).json({ trending, _fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Trending error:', err);
    return res.status(500).json({ error: err.message });
  }
}
