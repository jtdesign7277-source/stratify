// Proxy for Polymarket Gamma API — avoids CORS issues from browser
export default async function handler(req, res) {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&limit=50'
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Polymarket API error' });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[polymarket proxy]', err);
    return res.status(500).json({ error: 'Failed to fetch Polymarket data' });
  }
}
