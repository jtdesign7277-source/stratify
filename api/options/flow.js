// /api/options/flow.js — Vercel serverless function
// Fetches unusual options activity from Alpaca OPRA feed

const ALPACA_KEY = process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '';
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY || '';

const DEFAULT_SYMBOLS = 'TSLA,NVDA,SPY,QQQ,AAPL,META,AMD,AMZN,MSFT,GOOGL,COIN,SOFI,HIMS,PYPL,RKLB,AVGO,NKE,ADBE,FUBO,RBLX';

const headers = {
  'APCA-API-KEY-ID': ALPACA_KEY.trim(),
  'APCA-API-SECRET-KEY': ALPACA_SECRET.trim(),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function fetchJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function getContracts(symbol, today, future) {
  const url = `https://api.alpaca.markets/v2/options/contracts?underlying_symbols=${symbol}&expiration_date_gte=${today}&expiration_date_lte=${future}&status=active&limit=100`;
  const data = await fetchJSON(url);
  return data.option_contracts || data || [];
}

async function getSnapshots(symbolList) {
  if (!symbolList.length) return {};
  const url = `https://data.alpaca.markets/v1beta1/options/snapshots?feed=opra&symbols=${symbolList.join(',')}`;
  const data = await fetchJSON(url);
  return data.snapshots || data || {};
}

function processContract(contract, snapshot) {
  if (!snapshot) return null;

  const lt = snapshot.latestTrade;
  const dq = snapshot.latestQuote;
  const db = snapshot.dailyBar;

  const volume = db?.v || 0;
  const openInterest = snapshot.openInterest || 0;
  const tradePrice = lt?.p || 0;
  const tradeSize = lt?.s || 0;

  let estimatedPremium = 0;
  if (tradePrice && tradeSize) {
    estimatedPremium = tradePrice * tradeSize * 100;
  } else if (db?.v && db?.vw) {
    estimatedPremium = db.v * db.vw * 100;
  }

  const volumeOIRatio = openInterest > 0 ? volume / openInterest : 0;

  // Filter: unusual activity
  const isUnusual = (openInterest > 0 && volumeOIRatio > 3) || (volume > 500) || (estimatedPremium > 50000);
  if (!isUnusual) return null;

  const type = contract.type || (contract.symbol?.includes('C') ? 'call' : 'put');
  const isCall = type === 'call';

  // Badge logic
  let badge = null;
  const exchanges = lt?.x ? [lt.x] : [];
  if (exchanges.length >= 3) badge = 'SWEEP';
  else if (tradeSize > 50) badge = 'BLOCK';
  else if (volumeOIRatio > 5) badge = 'UNUSUAL';

  return {
    symbol: contract.symbol,
    underlying: contract.underlying_symbol,
    strike: Number(contract.strike_price),
    type: isCall ? 'call' : 'put',
    expiration: contract.expiration_date,
    sentiment: isCall ? 'bullish' : 'bearish',
    lastPrice: tradePrice,
    tradeSize,
    volume,
    openInterest,
    volumeOIRatio: Math.round(volumeOIRatio * 100) / 100,
    estimatedPremium: Math.round(estimatedPremium),
    badge,
    bid: dq?.bp || 0,
    ask: dq?.ap || 0,
    timestamp: lt?.t || db?.t || new Date().toISOString(),
  };
}

async function processSymbol(symbol, today, future) {
  try {
    const contracts = await getContracts(symbol, today, future);
    if (!contracts.length) return [];

    const contractSymbols = contracts.map((c) => c.symbol).filter(Boolean);
    const alerts = [];

    // Batch snapshots in groups of 100
    for (let i = 0; i < contractSymbols.length; i += 100) {
      const batch = contractSymbols.slice(i, i + 100);
      const snapshots = await getSnapshots(batch);

      const contractMap = {};
      contracts.forEach((c) => { contractMap[c.symbol] = c; });

      for (const [sym, snap] of Object.entries(snapshots)) {
        const alert = processContract(contractMap[sym] || { symbol: sym, underlying_symbol: symbol }, snap);
        if (alert) alerts.push(alert);
      }
    }

    return alerts;
  } catch (err) {
    console.error(`Error processing ${symbol}:`, err.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = (ALPACA_KEY || '').trim();
  const secret = (ALPACA_SECRET || '').trim();
  if (!key || !secret) return res.status(500).json({ error: 'Alpaca API keys not configured' });

  const symbolsParam = req.query.symbols || DEFAULT_SYMBOLS;
  const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

  const now = new Date();
  const today = toDateStr(now);
  const future = new Date(now);
  future.setDate(future.getDate() + 30);
  const futureStr = toDateStr(future);

  let allAlerts = [];

  // Process in batches of 5 with 200ms delay
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    const results = await Promise.all(batch.map((s) => processSymbol(s, today, futureStr)));
    allAlerts = allAlerts.concat(results.flat());
    if (i + 5 < symbols.length) await sleep(200);
  }

  // Sort by premium descending
  allAlerts.sort((a, b) => b.estimatedPremium - a.estimatedPremium);

  // Build summary
  let totalCallPremium = 0;
  let totalPutPremium = 0;
  const byTicker = {};

  for (const alert of allAlerts) {
    const u = alert.underlying;
    if (!byTicker[u]) byTicker[u] = { calls: 0, puts: 0, premium: 0 };

    if (alert.type === 'call') {
      totalCallPremium += alert.estimatedPremium;
      byTicker[u].calls++;
    } else {
      totalPutPremium += alert.estimatedPremium;
      byTicker[u].puts++;
    }
    byTicker[u].premium += alert.estimatedPremium;
  }

  let topBullish = null;
  let topBearish = null;
  let maxBull = 0;
  let maxBear = 0;

  for (const [ticker, data] of Object.entries(byTicker)) {
    if (data.calls > maxBull) { maxBull = data.calls; topBullish = ticker; }
    if (data.puts > maxBear) { maxBear = data.puts; topBearish = ticker; }
  }

  const totalPremium = totalCallPremium + totalPutPremium;
  const callPutRatio = totalPutPremium > 0 ? Math.round((totalCallPremium / totalPutPremium) * 100) / 100 : totalCallPremium > 0 ? 999 : 0;

  return res.status(200).json({
    alerts: allAlerts,
    summary: {
      totalAlerts: allAlerts.length,
      totalCallPremium,
      totalPutPremium,
      totalPremium,
      callPutRatio,
      topBullish,
      topBearish,
      byTicker,
    },
  });
}
