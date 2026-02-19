// /api/latest-quote.js — Vercel serverless function
// Fetches latest quote data from Alpaca SIP feed

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid symbol' });
  }

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '').trim();
  const ALPACA_SECRET = (
    process.env.ALPACA_SECRET_KEY ||
    process.env.ALPACA_API_SECRET ||
    process.env.APCA_API_SECRET_KEY ||
    ''
  ).trim();

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  const normalizeRawSymbol = (value) =>
    String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^\$/, '');

  const normalizeCryptoSymbol = (value) => {
    const raw = normalizeRawSymbol(value);
    if (!raw) return null;
    if (raw.includes('/')) {
      const [base, quote] = raw.split('/');
      if (!base || !quote) return null;
      return `${base}/${quote}`;
    }
    if (raw.endsWith('-USD')) return `${raw.slice(0, -4)}/USD`;
    if (raw.endsWith('USD') && raw.length > 3) return `${raw.slice(0, -3)}/USD`;
    return null;
  };

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  try {
    const upperSymbol = normalizeRawSymbol(symbol);
    const cryptoSymbol = normalizeCryptoSymbol(upperSymbol);

    if (cryptoSymbol) {
      const quotesUrl = `https://data.alpaca.markets/v1beta3/crypto/us/latest/quotes?symbols=${encodeURIComponent(cryptoSymbol)}`;
      const quotesResponse = await fetch(quotesUrl, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_KEY,
          'APCA-API-SECRET-KEY': ALPACA_SECRET,
          Accept: 'application/json',
        },
      });

      const quotesPayload = await quotesResponse.json().catch(() => ({}));
      const quoteMap = quotesPayload?.quotes && typeof quotesPayload.quotes === 'object' ? quotesPayload.quotes : {};
      const quote =
        quoteMap[cryptoSymbol] ||
        quoteMap[cryptoSymbol.replace('/', '')] ||
        quoteMap[cryptoSymbol.replace('/', '-')] ||
        null;

      const bid = toNumber(quote?.bp ?? quote?.BidPrice);
      const ask = toNumber(quote?.ap ?? quote?.AskPrice);
      const timestamp = quote?.t ?? quote?.Timestamp ?? null;

      let price = null;
      if (Number.isFinite(bid) && Number.isFinite(ask)) {
        price = (bid + ask) / 2;
      } else if (Number.isFinite(ask)) {
        price = ask;
      } else if (Number.isFinite(bid)) {
        price = bid;
      }

      if (!Number.isFinite(price)) {
        const tradesUrl = `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(cryptoSymbol)}`;
        const tradesResponse = await fetch(tradesUrl, {
          headers: {
            'APCA-API-KEY-ID': ALPACA_KEY,
            'APCA-API-SECRET-KEY': ALPACA_SECRET,
            Accept: 'application/json',
          },
        });

        if (tradesResponse.ok) {
          const tradesPayload = await tradesResponse.json().catch(() => ({}));
          const tradesMap = tradesPayload?.trades && typeof tradesPayload.trades === 'object' ? tradesPayload.trades : {};
          const trade =
            tradesMap[cryptoSymbol] ||
            tradesMap[cryptoSymbol.replace('/', '')] ||
            tradesMap[cryptoSymbol.replace('/', '-')] ||
            null;
          price = toNumber(trade?.p ?? trade?.Price);
        }
      }

      if (!Number.isFinite(price) && !quotesResponse.ok) {
        return res.status(quotesResponse.status).json({
          error: `Alpaca crypto API error: ${quotesResponse.status}`,
          detail: quotesPayload,
        });
      }

      return res.status(200).json({
        price: Number.isFinite(price) ? price : null,
        bid,
        ask,
        timestamp,
      });
    }

    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(
      upperSymbol
    )}/quotes/latest?feed=sip`;

    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: `Alpaca API error: ${response.status}`,
        detail,
      });
    }

    const data = await response.json();
    const quote = data?.quote || data?.latestQuote || {};
    const bid = toNumber(quote.bp ?? quote.BidPrice);
    const ask = toNumber(quote.ap ?? quote.AskPrice);
    const timestamp = quote.t ?? quote.Timestamp ?? null;

    let price = null;
    if (Number.isFinite(bid) && Number.isFinite(ask)) {
      price = (bid + ask) / 2;
    } else if (Number.isFinite(ask)) {
      price = ask;
    } else if (Number.isFinite(bid)) {
      price = bid;
    }

    return res.status(200).json({
      price,
      bid,
      ask,
      timestamp,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch latest quote' });
  }
}
