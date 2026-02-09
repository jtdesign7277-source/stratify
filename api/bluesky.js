export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const { q = '$TSLA', limit = 25 } = req.query;
  
  try {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=${limit}&sort=latest`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Stratify/1.0' }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Bluesky API error', status: response.status });
    }
    
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
