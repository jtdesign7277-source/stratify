const ALPACA_DATA = 'https://data.alpaca.markets';
const ALPACA_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

const INDICES = ['SPY', 'QQQ', 'DIA', 'IWM'];
const MACRO = ['TLT', 'GLD', 'USO', 'UUP']; // bonds, gold, oil, dollar
const SECTORS = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLY', name: 'Consumer Disc' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Communication' },
  { symbol: 'XLB', name: 'Materials' },
];
const CRYPTO = ['BTC/USD', 'ETH/USD'];
const FEAR_GAUGE = ['UVXY']; // VIX proxy

const INDEX_NAMES = { SPY: 'S&P 500', QQQ: 'NASDAQ', DIA: 'DOW 30', IWM: 'RUSSELL 2K' };
const MACRO_NAMES = { TLT: '20Y BONDS', GLD: 'GOLD', USO: 'CRUDE OIL', UUP: 'US DOLLAR' };

async function getSnapshots(symbols) {
  if (!ALPACA_KEY) return {};
  try {
    const res = await fetch(`${ALPACA_DATA}/v2/stocks/snapshots?symbols=${symbols.join(',')}`, {
      headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const results = {};
    for (const [sym, snap] of Object.entries(data)) {
      const price = snap.latestTrade?.p || snap.minuteBar?.c || 0;
      const prevClose = snap.prevDailyBar?.c || 0;
      const change = prevClose ? ((price - prevClose) / prevClose * 100) : 0;
      const volume = snap.dailyBar?.v || 0;
      const prevVolume = snap.prevDailyBar?.v || 1;
      results[sym] = {
        price,
        change: parseFloat(change.toFixed(2)),
        volume,
        volumeRatio: parseFloat((volume / prevVolume).toFixed(1)),
        high: snap.dailyBar?.h || 0,
        low: snap.dailyBar?.l || 0,
        prevClose,
      };
    }
    return results;
  } catch { return {}; }
}

async function getCryptoSnapshots() {
  if (!ALPACA_KEY) return {};
  const results = {};
  for (const sym of CRYPTO) {
    try {
      const encoded = encodeURIComponent(sym);
      const res = await fetch(`${ALPACA_DATA}/v1beta3/crypto/us/latest/trades?symbols=${encoded}`, {
        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const trade = data.trades?.[sym];
      if (trade) {
        results[sym] = { price: trade.p, change: 0, volume: 0, volumeRatio: 0 };
      }
    } catch {}
  }
  return results;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const allStockSymbols = [...INDICES, ...MACRO, ...FEAR_GAUGE, ...SECTORS.map((s) => s.symbol)];
    
    const [stockSnaps, cryptoSnaps] = await Promise.all([
      getSnapshots(allStockSymbols),
      getCryptoSnapshots(),
    ]);

    // Build indices
    const indices = INDICES.map((sym) => ({
      symbol: sym,
      name: INDEX_NAMES[sym] || sym,
      ...stockSnaps[sym],
    }));

    // Build macro
    const macro = MACRO.map((sym) => ({
      symbol: sym,
      name: MACRO_NAMES[sym] || sym,
      ...stockSnaps[sym],
    }));

    // VIX proxy
    const vix = stockSnaps['UVXY'] || {};

    // Build sectors sorted by change
    const sectors = SECTORS.map((s) => ({
      ...s,
      ...stockSnaps[s.symbol],
    })).sort((a, b) => (b.change || 0) - (a.change || 0));

    // Crypto
    const crypto = CRYPTO.map((sym) => ({
      symbol: sym,
      name: sym.replace('/USD', ''),
      ...cryptoSnaps[sym],
    }));

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      indices,
      macro,
      sectors,
      crypto,
      vix: { price: vix.price || 0, change: vix.change || 0 },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
