export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || '').trim();
  const ALPACA_SECRET = (process.env.ALPACA_API_SECRET || '').trim();
  if (!ALPACA_KEY || !ALPACA_SECRET) return res.status(500).json({ error: 'Alpaca API keys not configured' });

  const headers = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET, Accept: 'application/json' };

  const TICKERS = ['TSLA','NVDA','SPY','QQQ','HIMS','SOFI','FUBO','ADBE','COIN','NKE','CELH','ENPH','LULU','RBLX','PYPL','AMD','RKLB','AVGO','META','AAPL'];

  const today = new Date();
  const dateGte = today.toISOString().split('T')[0];
  const fourteenOut = new Date(today);
  fourteenOut.setDate(fourteenOut.getDate() + 14);
  const dateLte = fourteenOut.toISOString().split('T')[0];

  try {
    const alerts = [];

    // Process symbols in parallel batches of 5
    for (let i = 0; i < TICKERS.length; i += 5) {
      const batch = TICKERS.slice(i, i + 5);
      await Promise.all(batch.map(async (sym) => {
        try {
          const cRes = await fetch(
            `https://api.alpaca.markets/v2/options/contracts?underlying_symbols=${sym}&expiration_date_gte=${dateGte}&expiration_date_lte=${dateLte}&status=active&limit=100`,
            { headers }
          );
          if (!cRes.ok) return;
          const cData = await cRes.json();
          const contracts = cData.option_contracts || cData || [];
          if (contracts.length === 0) return;

          // Batch fetch snapshots
          const syms = contracts.map(c => c.symbol);
          const snapshots = {};
          for (let j = 0; j < syms.length; j += 100) {
            const chunk = syms.slice(j, j + 100);
            const sRes = await fetch(
              `https://data.alpaca.markets/v1beta1/options/snapshots?feed=opra&symbols=${chunk.join(',')}`,
              { headers }
            );
            if (sRes.ok) {
              const sData = await sRes.json();
              Object.assign(snapshots, sData.snapshots || sData);
            }
          }

          for (const contract of contracts) {
            const snap = snapshots[contract.symbol];
            if (!snap) continue;

            const volume = snap.dailyBar?.v || 0;
            const oi = contract.open_interest ?? snap.openInterest ?? 0;
            const quote = snap.latestQuote || {};
            const trade = snap.latestTrade || {};
            const lastPrice = trade.p ?? trade.price ?? 0;
            const bid = quote.bp ?? quote.bid_price ?? null;
            const ask = quote.ap ?? quote.ask_price ?? null;
            const midPrice = (bid && ask) ? (bid + ask) / 2 : lastPrice;
            const estimatedPremium = midPrice * volume * 100;
            const voiRatio = oi > 0 ? +(volume / oi).toFixed(2) : (volume > 0 ? 999 : 0);

            const isUnusual = (oi > 0 && volume > 3 * oi) || volume > 500 || estimatedPremium > 100000;
            if (!isUnusual || volume === 0) continue;

            // Determine trade type badge
            let tradeType = null;
            const exchange = trade.x || trade.exchange || '';
            // Heuristic: dark pool if exchange is 'D' or empty, sweep if multiple conditions
            if (exchange === 'D' || exchange === '' || exchange === 'DARK') {
              tradeType = 'DARK POOL';
            } else if (volume > 2000 && voiRatio > 5) {
              tradeType = 'SWEEP';
            } else if (estimatedPremium > 500000) {
              tradeType = 'BLOCK';
            }

            alerts.push({
              symbol: sym,
              contractSymbol: contract.symbol,
              strike: parseFloat(contract.strike_price),
              type: contract.type,
              expiration: contract.expiration_date,
              bid,
              ask,
              last: lastPrice,
              volume,
              openInterest: oi,
              volumeOIRatio: voiRatio,
              estimatedPremium: Math.round(estimatedPremium),
              sentiment: contract.type === 'call' ? 'bullish' : 'bearish',
              tradeType,
            });
          }
        } catch (_) { /* skip symbol */ }
      }));
    }

    alerts.sort((a, b) => b.volumeOIRatio - a.volumeOIRatio);
    return res.status(200).json({ alerts: alerts.slice(0, 100), timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
