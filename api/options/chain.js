// /api/options/chain.js — Vercel serverless function
// Returns options chain data grouped by expiration with calls/puts mirrored around strikes

const ALPACA_KEY = process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '';
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY || '';

const headers = {
  'APCA-API-KEY-ID': ALPACA_KEY.trim(),
  'APCA-API-SECRET-KEY': ALPACA_SECRET.trim(),
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = (ALPACA_KEY || '').trim();
  const secret = (ALPACA_SECRET || '').trim();
  if (!key || !secret) return res.status(500).json({ error: 'Alpaca API keys not configured' });

  const symbol = (req.query.symbol || 'AAPL').toUpperCase();
  const numStrikes = Math.min(parseInt(req.query.strikes) || 6, 50);

  const now = new Date();
  const today = toDateStr(now);
  const future = new Date(now);
  future.setDate(future.getDate() + 60); // 2 months out
  const futureStr = toDateStr(future);

  try {
    // 1. Get active contracts for this underlying
    const contractsUrl = `https://api.alpaca.markets/v2/options/contracts?underlying_symbols=${symbol}&expiration_date_gte=${today}&expiration_date_lte=${futureStr}&status=active&limit=250`;
    const contractsData = await fetchJSON(contractsUrl);
    const contracts = contractsData.option_contracts || contractsData || [];

    if (contracts.length === 0) {
      return res.status(200).json({ symbol, expirations: [] });
    }

    // 2. Get snapshots for all contracts
    const contractSymbols = contracts.map((c) => c.symbol).filter(Boolean);
    const snapshots = {};

    for (let i = 0; i < contractSymbols.length; i += 100) {
      const batch = contractSymbols.slice(i, i + 100);
      const url = `https://data.alpaca.markets/v1beta1/options/snapshots?feed=opra&symbols=${batch.join(',')}`;
      const data = await fetchJSON(url);
      Object.assign(snapshots, data.snapshots || data || {});
    }

    // 3. Get current stock price for ATM reference
    let currentPrice = null;
    try {
      const snapshotUrl = `https://data.alpaca.markets/v2/stocks/${symbol}/snapshot?feed=sip`;
      const stockSnap = await fetchJSON(snapshotUrl);
      currentPrice = stockSnap?.latestTrade?.p || stockSnap?.minuteBar?.c || null;
    } catch {}

    // 4. Group by expiration and pair calls/puts by strike
    const byExpiration = {};

    for (const contract of contracts) {
      const exp = contract.expiration_date;
      const strike = Number(contract.strike_price);
      const type = contract.type; // 'call' or 'put'
      const snap = snapshots[contract.symbol] || {};

      const lt = snap.latestTrade || {};
      const lq = snap.latestQuote || {};
      const db = snap.dailyBar || {};
      const pdb = snap.prevDailyBar || {};

      const bid = lq.bp || 0;
      const ask = lq.ap || 0;
      const mid = bid && ask ? (bid + ask) / 2 : lt.p || 0;
      const last = lt.p || db.c || 0;
      const prevClose = pdb.c || 0;
      const pctChange = prevClose > 0 ? ((last - prevClose) / prevClose) * 100 : null;
      const iv = snap.impliedVolatility || null;

      if (!byExpiration[exp]) {
        byExpiration[exp] = { strikes: {} };
      }

      if (!byExpiration[exp].strikes[strike]) {
        byExpiration[exp].strikes[strike] = { strike, call: null, put: null };
      }

      const data = { bid, ask, mid, last, pctChange, iv, volume: db.v || 0, oi: snap.openInterest || 0 };

      if (type === 'call') {
        byExpiration[exp].strikes[strike].call = data;
      } else {
        byExpiration[exp].strikes[strike].put = data;
      }
    }

    // 5. For each expiration, select strikes centered around current price
    const expirations = Object.entries(byExpiration)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([exp, data]) => {
        const allStrikes = Object.values(data.strikes).sort((a, b) => a.strike - b.strike);

        let selectedStrikes = allStrikes;
        if (currentPrice && allStrikes.length > numStrikes) {
          // Find ATM index
          let atmIdx = 0;
          let minDiff = Infinity;
          allStrikes.forEach((s, i) => {
            const diff = Math.abs(s.strike - currentPrice);
            if (diff < minDiff) { minDiff = diff; atmIdx = i; }
          });

          const half = Math.floor(numStrikes / 2);
          let start = Math.max(0, atmIdx - half);
          let end = start + numStrikes;
          if (end > allStrikes.length) {
            end = allStrikes.length;
            start = Math.max(0, end - numStrikes);
          }
          selectedStrikes = allStrikes.slice(start, end);
        }

        // Detect strike gap
        let strikeGap = 2.5;
        if (selectedStrikes.length >= 2) {
          strikeGap = selectedStrikes[1].strike - selectedStrikes[0].strike;
        }

        // Detect weekly (expiry not on 3rd Friday)
        const expDate = new Date(exp + 'T00:00:00');
        const dayOfWeek = expDate.getDay();
        const dayOfMonth = expDate.getDate();
        const isThirdFriday = dayOfWeek === 5 && dayOfMonth >= 15 && dayOfMonth <= 21;
        const isWeekly = !isThirdFriday;

        return {
          expiration: exp,
          isWeekly,
          strikeGap,
          strikes: selectedStrikes,
        };
      });

    return res.status(200).json({
      symbol,
      currentPrice,
      expirations,
    });
  } catch (err) {
    console.error('Options chain error:', err);
    return res.status(500).json({ error: err.message });
  }
}
