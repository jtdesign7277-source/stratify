const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols, limit = '10', page = '1' } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  try {
    const url = `https://api.marketaux.com/v1/news/all?symbols=${symbols.toUpperCase()}&filter_entities=true&language=en&limit=${limit}&page=${page}&api_token=${MARKETAUX_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: 'MarketAux error' });

    const data = await response.json();
    const articles = (data.data || []).map(a => {
      const entity = a.entities?.find(e => symbols.toUpperCase().split(',').includes(e.symbol));
      return {
        uuid: a.uuid, title: a.title, description: a.description, content: a.content || null, snippet: a.snippet,
        url: a.url, imageUrl: a.image_url, source: a.source, publishedAt: a.published_at,
        sentiment: entity?.sentiment_score ?? null, matchScore: entity?.match_score ?? null,
        highlight: entity?.highlights?.[0]?.highlight ?? null,
        entities: (a.entities || []).map(e => ({ symbol: e.symbol, name: e.name, type: e.type, sentiment: e.sentiment_score })),
      };
    });

    return res.status(200).json({ articles, meta: data.meta || {}, _fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('News error:', err);
    return res.status(500).json({ error: err.message });
  }
}
