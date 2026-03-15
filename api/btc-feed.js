/**
 * /api/btc-feed — Real-time BTC price feed
 * Sources: Crypto.com Exchange API (primary), Twelve Data (fallback)
 * Returns: { price, bid, ask, high, low, volume, change24h, source, ts }
 */

const CRYPTO_COM_TICKER = 'https://api.crypto.com/exchange/v1/public/get-tickers?instrument_name=BTC_USDT';
const TWELVE_DATA_URL = 'https://api.twelvedata.com/price?symbol=BTC/USD';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Primary: Crypto.com Exchange
    const ccResp = await fetch(CRYPTO_COM_TICKER, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (ccResp.ok) {
      const ccData = await ccResp.json();
      const t = ccData?.result?.data?.[0];
      if (t) {
        return res.status(200).json({
          price: parseFloat(t.best_bid || t.last_trade_price),
          bid: parseFloat(t.best_bid),
          ask: parseFloat(t.best_ask),
          high: parseFloat(t.high),
          low: parseFloat(t.low),
          volume: parseFloat(t.total_quantity_traded || t.volume || 0),
          volumeUsd: parseFloat(t.volume_value || 0),
          change24h: parseFloat(t.change || 0) * 100,
          spread: parseFloat(t.best_ask) - parseFloat(t.best_bid),
          source: 'crypto.com',
          ts: t.timestamp || new Date().toISOString(),
        });
      }
    }

    // Fallback: Twelve Data
    const tdKey = process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY;
    if (tdKey) {
      const tdResp = await fetch(`${TWELVE_DATA_URL}&apikey=${tdKey}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (tdResp.ok) {
        const tdData = await tdResp.json();
        return res.status(200).json({
          price: parseFloat(tdData.price),
          bid: null,
          ask: null,
          high: null,
          low: null,
          volume: null,
          volumeUsd: null,
          change24h: null,
          spread: null,
          source: 'twelvedata',
          ts: new Date().toISOString(),
        });
      }
    }

    return res.status(502).json({ error: 'All BTC price sources failed' });
  } catch (err) {
    console.error('[btc-feed] error:', err.message);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
