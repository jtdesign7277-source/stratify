export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol, expiration } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || '').trim();
  const ALPACA_SECRET = (process.env.ALPACA_API_SECRET || '').trim();
  if (!ALPACA_KEY || !ALPACA_SECRET) return res.status(500).json({ error: 'Alpaca API keys not configured' });

  const headers = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET, Accept: 'application/json' };
  const sym = symbol.toUpperCase();

  try {
    // Fetch underlying price
    const snapRes = await fetch(`https://data.alpaca.markets/v2/stocks/${sym}/snapshot`, { headers });
    let underlying = { price: null, change: null, changePercent: null };
    if (snapRes.ok) {
      const snap = await snapRes.json();
      const last = snap?.latestTrade?.p ?? snap?.dailyBar?.c;
      const prevClose = snap?.prevDailyBar?.c;
      if (last && prevClose) {
        underlying = { price: last, change: +(last - prevClose).toFixed(2), changePercent: +(((last - prevClose) / prevClose) * 100).toFixed(2) };
      } else {
        underlying = { price: last || null, change: null, changePercent: null };
      }
    }

    // If no expiration, fetch available expirations first
    let contractsParams = `underlying_symbols=${sym}&status=active&limit=250`;
    if (expiration) {
      contractsParams += `&expiration_date=${expiration}`;
    } else {
      contractsParams += `&expiration_date_gte=${new Date().toISOString().split('T')[0]}`;
    }

    const contractsRes = await fetch(`https://api.alpaca.markets/v2/options/contracts?${contractsParams}`, { headers });
    if (!contractsRes.ok) {
      const detail = await contractsRes.text();
      return res.status(contractsRes.status).json({ error: 'Failed to fetch contracts', detail });
    }
    const contractsData = await contractsRes.json();
    const contracts = contractsData.option_contracts || contractsData || [];

    // Collect unique expirations
    const expSet = new Set();
    contracts.forEach(c => expSet.add(c.expiration_date));
    const expirations = [...expSet].sort();

    // If no expiration was specified and we have expirations, filter to the nearest one
    let filtered = contracts;
    if (!expiration && expirations.length > 0) {
      const nearest = expirations[0];
      filtered = contracts.filter(c => c.expiration_date === nearest);
    }

    if (filtered.length === 0) {
      return res.status(200).json({ calls: [], puts: [], expirations, underlying });
    }

    // Batch fetch snapshots (max ~100 symbols per request)
    const contractSymbols = filtered.map(c => c.symbol);
    const batches = [];
    for (let i = 0; i < contractSymbols.length; i += 100) {
      batches.push(contractSymbols.slice(i, i + 100));
    }

    const snapshots = {};
    for (const batch of batches) {
      const snapUrl = `https://data.alpaca.markets/v1beta1/options/snapshots?feed=opra&symbols=${batch.join(',')}`;
      const sRes = await fetch(snapUrl, { headers });
      if (sRes.ok) {
        const sData = await sRes.json();
        const snaps = sData.snapshots || sData;
        Object.assign(snapshots, snaps);
      }
    }

    const calls = [];
    const puts = [];

    for (const contract of filtered) {
      const snap = snapshots[contract.symbol];
      const quote = snap?.latestQuote || {};
      const trade = snap?.latestTrade || {};
      const greeks = snap?.greeks || {};
      const impliedVol = snap?.impliedVolatility ?? greeks?.implied_volatility ?? null;

      const option = {
        symbol: contract.symbol,
        strike: parseFloat(contract.strike_price),
        type: contract.type,
        expiration: contract.expiration_date,
        bid: quote.bp ?? quote.bid_price ?? null,
        ask: quote.ap ?? quote.ask_price ?? null,
        last: trade.p ?? trade.price ?? null,
        volume: snap?.dailyBar?.v ?? null,
        openInterest: contract.open_interest ?? snap?.openInterest ?? null,
        change: snap?.dailyBar ? +(trade.p - (snap.dailyBar.o || trade.p)).toFixed(2) : null,
        impliedVol: impliedVol ? +(impliedVol * 100).toFixed(1) : null,
        delta: greeks?.delta ?? null,
        gamma: greeks?.gamma ?? null,
        theta: greeks?.theta ?? null,
        vega: greeks?.vega ?? null,
      };

      if (contract.type === 'call') calls.push(option);
      else puts.push(option);
    }

    calls.sort((a, b) => a.strike - b.strike);
    puts.sort((a, b) => a.strike - b.strike);

    return res.status(200).json({ calls, puts, expirations, underlying });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
