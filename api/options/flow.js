export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = (req.query.symbol || 'TSLA').toUpperCase();

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || '').trim();
  const ALPACA_SECRET = (process.env.ALPACA_API_SECRET || '').trim();
  if (!ALPACA_KEY || !ALPACA_SECRET) return res.status(500).json({ error: 'Alpaca API keys not configured' });

  const headers = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET, Accept: 'application/json' };

  try {
    const today = new Date();
    const sixtyDaysOut = new Date(today);
    sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);

    const contractsUrl = `https://api.alpaca.markets/v2/options/contracts?underlying_symbols=${symbol}&expiration_date_gte=${today.toISOString().split('T')[0]}&expiration_date_lte=${sixtyDaysOut.toISOString().split('T')[0]}&status=active&limit=100`;
    const cRes = await fetch(contractsUrl, { headers });
    if (!cRes.ok) {
      return res.status(cRes.status).json({ error: 'Failed to fetch contracts', detail: await cRes.text() });
    }
    const cData = await cRes.json();
    const contracts = cData.option_contracts || cData || [];

    if (contracts.length === 0) return res.status(200).json({ trades: [] });

    // Build contract lookup
    const contractMap = {};
    contracts.forEach(c => { contractMap[c.symbol] = c; });

    // Fetch recent trades in batches
    const contractSymbols = contracts.map(c => c.symbol);
    const allTrades = [];

    for (let i = 0; i < contractSymbols.length; i += 30) {
      const batch = contractSymbols.slice(i, i + 30);
      const tradesUrl = `https://data.alpaca.markets/v1beta1/options/trades?feed=opra&symbols=${batch.join(',')}&limit=50`;
      const tRes = await fetch(tradesUrl, { headers });
      if (!tRes.ok) continue;
      const tData = await tRes.json();
      const tradesBySymbol = tData.trades || tData;

      for (const [contractSym, trades] of Object.entries(tradesBySymbol)) {
        if (!Array.isArray(trades)) continue;
        const contract = contractMap[contractSym];
        if (!contract) continue;

        for (const t of trades) {
          const size = t.s || t.size || 0;
          const price = t.p || t.price || 0;
          const premium = price * size * 100;

          if (size > 10 || premium > 10000) {
            allTrades.push({
              time: t.t || t.timestamp,
              symbol: symbol,
              contractSymbol: contractSym,
              strike: parseFloat(contract.strike_price),
              type: contract.type,
              expiration: contract.expiration_date,
              price,
              size,
              premium: Math.round(premium),
              exchange: t.x || t.exchange || '',
              side: contract.type === 'call' ? 'bullish' : 'bearish',
            });
          }
        }
      }
    }

    allTrades.sort((a, b) => new Date(b.time) - new Date(a.time));
    return res.status(200).json({ trades: allTrades.slice(0, 50) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
