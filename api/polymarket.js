// Proxy for Polymarket API — avoids CORS issues from browser
export default async function handler(req, res) {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=20&active=true&closed=false&order=volume24hr&ascending=false'
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Polymarket API error' });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[polymarket proxy]', err);
    return res.status(500).json({ error: 'Failed to fetch Polymarket data' });
  }
}
