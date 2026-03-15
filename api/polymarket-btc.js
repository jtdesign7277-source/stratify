/**
 * /api/polymarket-btc — Polymarket BTC prediction market data
 * Returns: Active BTC strike markets with probabilities, spreads, arb opportunities
 */

const GAMMA_API = 'https://gamma-api.polymarket.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Fetch active Polymarket events
    const eventsResp = await fetch(
      `${GAMMA_API}/events?active=true&closed=false&limit=100`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!eventsResp.ok) {
      return res.status(502).json({ error: 'Polymarket API unavailable' });
    }

    const events = await eventsResp.json();

    // Filter BTC-related prediction markets
    const btcKeywords = ['bitcoin', 'btc', 'above', 'price', 'hit', 'reach', 'below'];
    const btcMarkets = [];

    for (const event of events) {
      const title = (event.title || '').toLowerCase();
      const isBtc = btcKeywords.some(kw => title.includes(kw)) &&
        (title.includes('bitcoin') || title.includes('btc'));
      if (!isBtc) continue;

      for (const market of (event.markets || [])) {
        const question = market.question || market.groupItemTitle || '';
        const yesPrice = parseFloat(market.outcomePrices?.[0] || market.bestBid || 0);
        const noPrice = parseFloat(market.outcomePrices?.[1] || (1 - yesPrice));
        const pSum = yesPrice + noPrice;

        // Extract strike price from question
        const strikeMatch = question.match(/\$?([\d,]+(?:\.\d+)?)/);
        const strike = strikeMatch ? parseFloat(strikeMatch[1].replace(/,/g, '')) : null;

        btcMarkets.push({
          id: market.id || market.conditionId,
          conditionId: market.conditionId,
          question,
          eventTitle: event.title,
          strike,
          yesPrice: +yesPrice.toFixed(4),
          noPrice: +noPrice.toFixed(4),
          pSum: +pSum.toFixed(4),
          spread: +(1 - pSum).toFixed(4),
          volume: parseFloat(market.volume || 0),
          liquidity: parseFloat(market.liquidityClob || market.liquidity || 0),
          endDate: market.endDate || event.endDate,
          active: market.active !== false,
        });
      }
    }

    // Sort by spread opportunity (larger spread = more arb potential)
    btcMarkets.sort((a, b) => b.spread - a.spread);

    // Calculate arb opportunities: p_sum < 1 means arbitrage exists
    const arbOpportunities = btcMarkets
      .filter(m => m.pSum < 0.98 && m.active)
      .map(m => ({
        ...m,
        arbEdge: +((1 - m.pSum) * 100).toFixed(2),
        evPerDollar: +((1 / m.pSum - 1)).toFixed(4),
      }));

    return res.status(200).json({
      markets: btcMarkets,
      arbOpportunities,
      totalMarkets: btcMarkets.length,
      totalArbs: arbOpportunities.length,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[polymarket-btc] error:', err.message);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
