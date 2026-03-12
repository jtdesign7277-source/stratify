// GET /api/odds/scores?sport=basketball_nba — live scores from The Odds API

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

  const sport = (req.query.sport || '').trim();
  if (!sport) {
    return res.status(400).json({ error: 'Query param sport required' });
  }

  try {
    const url = `${ODDS_BASE}/sports/${encodeURIComponent(sport)}/scores?apiKey=${encodeURIComponent(apiKey)}&daysFrom=1`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || 'Scores API error' });
    }
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error('[odds/scores]', e);
    return res.status(502).json({ error: String(e?.message || 'Failed to fetch scores') });
  }
}
