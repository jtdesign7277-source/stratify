// GET /api/odds/events?sport=americanfootball_nfl - odds for a sport (The Odds API)

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

  const sport = (req.query.sport || req.query.sportKey || '').trim();
  if (!sport) {
    return res.status(400).json({ error: 'Query param sport required (e.g. americanfootball_nfl)' });
  }

  const regions = (req.query.regions || 'us').trim();
  const oddsFormat = (req.query.oddsFormat || 'american').trim();

  try {
    const url = `${ODDS_BASE}/sports/${encodeURIComponent(sport)}/odds?regions=${encodeURIComponent(regions)}&oddsFormat=${encodeURIComponent(oddsFormat)}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || 'Odds API error' });
    }
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error('[odds/events]', e);
    return res.status(502).json({ error: String(e?.message || 'Failed to fetch odds') });
  }
}
