export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbolsParam = req.query.symbols || 'TSLA,NVDA,SPY,QQQ,META,AMD,AAPL,AMZN,COIN,SOFI';
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).slice(0, 15);

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || '').trim();
  const ALPACA_SECRET = (process.env.ALPACA_API_SECRET || '').trim();
  if (!ALPACA_KEY || !ALPACA_SECRET) return res.status(500).json({ error: 'Alpaca API keys not configured' });

  const headers = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET, Accept: 'application/json' };

  try {
    const today = new Date();
    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
    const dateGte = today.toISOString().split('T')[0];
    const dateLte = thirtyDaysOut.toISOString().split('T')[0];

    const alerts = [];

    for (const sym of symbols) {
      try {
        const contractsUrl = `https://api.alpaca.markets/v2/options/contracts?underlying_symbols=${sym}&expiration_date_gte=${dateGte}&expiration_date_lte=${dateLte}&status=active&limit=250`;
        const cRes = await fetch(contractsUrl, { headers });
        if (!cRes.ok) continue;
        const cData = await cRes.json();
        const contracts = cData.option_contracts || cData || [];
        if (contracts.length === 0) continue;

        const contractSymbols = contracts.map(c => c.symbol);
        const batches = [];
        for (let i = 0; i < contractSymbols.length; i += 100) {
          batches.push(contractSymbols.slice(i, i + 100));
        }

        const snapshots = {};
        for (const batch of batches) {
          const sRes = await fetch(`https://data.alpaca.markets/v1beta1/options/snapshots?feed=opra&symbols=${batch.join(',')}`, { headers });
          if (sRes.ok) {
            const sData = await sRes.json();
            Object.assign(snapshots, sData.snapshots || sData);
          }
        }

        for (const contract of contracts) {
          const snap = snapshots[contract.symbol];
          if (!snap) continue;

          const volume = snap.dailyBar?.v || 0;
          const oi = contract.open_interest || snap.openInterest || 0;
          const lastPrice = snap.latestTrade?.p || 0;
          const premium = lastPrice * volume * 100;
          const voiRatio = oi > 0 ? volume / oi : volume;

          const isUnusual = (oi > 0 && volume > 5 * oi) || volume > 1000 || premium > 500000;
          if (!isUnusual || volume === 0) continue;

          alerts.push({
            symbol: sym,
            contractSymbol: contract.symbol,
            strike: parseFloat(contract.strike_price),
            type: contract.type,
            expiration: contract.expiration_date,
            volume,
            openInterest: oi,
            volumeOIRatio: +voiRatio.toFixed(2),
            premium: Math.round(premium),
            lastPrice,
            sentiment: contract.type === 'call' ? 'bullish' : 'bearish',
          });
        }
      } catch (_) { /* skip symbol */ }
    }

    alerts.sort((a, b) => b.volumeOIRatio - a.volumeOIRatio);
    return res.status(200).json({ alerts: alerts.slice(0, 50) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
