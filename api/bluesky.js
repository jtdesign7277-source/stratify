export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q = 'ALL', limit = 25 } = req.query;

  // Try search endpoint first (may work from Vercel's servers)
  if (q !== 'ALL') {
    try {
      const searchUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=${limit}&sort=latest`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 Stratify/1.0' }
      });
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.posts && data.posts.length > 0) {
          res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
          return res.status(200).json(data);
        }
      }
    } catch {}
  }

  // Fallback: curated finance account feeds
  const FINANCE_ACCOUNTS = [
    'iankmsmith.ft.com',
    'ellenychang.bsky.social',
    'unusual-whales.bsky.social',
    'stockmktnews.bsky.social',
    'benzinga.bsky.social',
    'marketwatch.bsky.social',
    'cnbc.bsky.social',
    'bloomberg.bsky.social',
  ];

  try {
    const feedPromises = FINANCE_ACCOUNTS.map(async (handle) => {
      try {
        const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=10&filter=posts_no_replies`;
        const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 Stratify/1.0' } });
        if (!r.ok) return [];
        const data = await r.json();
        return (data.feed || []).map(item => item.post);
      } catch { return []; }
    });

    const allFeeds = await Promise.all(feedPromises);
    let posts = allFeeds.flat();

    // Filter by ticker if specified
    const ticker = q.replace('$', '').toUpperCase();
    if (ticker && ticker !== 'ALL') {
      const filtered = posts.filter(p =>
        p.record?.text?.toUpperCase().includes(`$${ticker}`) ||
        p.record?.text?.toUpperCase().includes(ticker)
      );
      if (filtered.length > 0) posts = filtered;
    }

    // Sort by date, deduplicate, limit
    posts.sort((a, b) => new Date(b.record?.createdAt || 0) - new Date(a.record?.createdAt || 0));
    const seen = new Set();
    posts = posts.filter(p => {
      if (seen.has(p.uri)) return false;
      seen.add(p.uri);
      return true;
    }).slice(0, 25);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ posts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
