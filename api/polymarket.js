// Proxy for Polymarket Gamma API — avoids CORS from browser
export default async function handler(req, res) {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false'
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Polymarket API error' });
    }
    const raw = await response.json();
    if (!Array.isArray(raw)) {
      return res.status(200).json([]);
    }

    // Filter to top-level markets with real Yes/No probabilities (skip sub-items of grouped events)
    const markets = raw
      .filter(m => {
        if (!m.question || !m.outcomePrices) return false;
        // Skip sub-market items (e.g. "50+ bps decrease" within "Fed decision")
        // These have groupItemTitle and extreme 0/1 prices
        let prices;
        try {
          prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        } catch {
          return false;
        }
        if (!Array.isArray(prices) || prices.length < 2) return false;
        const yes = parseFloat(prices[0]);
        if (!Number.isFinite(yes)) return false;
        // Filter out extreme probabilities (< 2% or > 98%) — these are uninteresting
        if (yes < 0.02 || yes > 0.98) return false;
        return true;
      })
      .slice(0, 50)
      .map(m => {
        let prices;
        try {
          prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        } catch {
          prices = [];
        }
        return {
          id: m.id,
          question: m.question,
          yesPct: Math.round(parseFloat(prices[0]) * 100),
          image: m.image || m.icon || null,
          slug: m.slug || null,
        };
      });

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json(markets);
  } catch (err) {
    console.error('[polymarket proxy]', err);
    return res.status(500).json({ error: 'Failed to fetch Polymarket data' });
  }
}
