// GET /api/odds/sports - list in-season sports (The Odds API)
// Does not count against usage quota

const ODDS_BASE = 'https://api.the-odds-api.com/v4';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = (process.env.ODDS_API_KEY || process.env.VITE_ODDS_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'ODDS_API_KEY not configured' });
  }

  try {
    const url = `${ODDS_BASE}/sports?apiKey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => []);
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || 'Odds API error' });
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error('[odds/sports]', e);
    return res.status(502).json({ error: String(e?.message || 'Failed to fetch sports') });
  }
}
