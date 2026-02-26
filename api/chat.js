export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages required' });
  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'XAI_API_KEY is missing. Please add it in environment variables.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Extract tickers from the latest user message
  const lastMessage = messages[messages.length - 1]?.content || '';
  const tickerMatches = lastMessage.match(/\$?[A-Z]{1,5}/g) || [];
  const possibleTickers = [...new Set(tickerMatches.map(t => t.replace('$', '')))].filter(t => t.length >= 2 && t.length <= 5);

  // Fetch real prices from Alpaca for mentioned tickers
  let priceContext = '';
  if (possibleTickers.length > 0) {
    try {
      const symbols = possibleTickers.slice(0, 5).join(',');
      const [tradesRes, barsRes] = await Promise.all([
        fetch(`https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${symbols}`, {
          headers: {
            'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
          },
        }),
        fetch(`https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols}&timeframe=1Day&limit=2`, {
          headers: {
            'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
          },
        }),
      ]);

      const tradesData = tradesRes.ok ? await tradesRes.json() : {};
      const barsData = barsRes.ok ? await barsRes.json() : {};

      const priceLines = [];
      for (const sym of possibleTickers.slice(0, 5)) {
        const trade = tradesData.trades?.[sym];
        const bars = barsData.bars?.[sym] || [];
        if (trade) {
          const price = trade.p;
          const prevClose = bars.length >= 2 ? bars[bars.length - 2].c : bars[0]?.c || price;
          const change = ((price - prevClose) / prevClose * 100).toFixed(2);
          const direction = change >= 0 ? '+' : '';
          priceLines.push(`$${sym}: $${price.toFixed(2)} (${direction}${change}% today) | Day High: $${bars[bars.length - 1]?.h?.toFixed(2) || 'N/A'} | Day Low: $${bars[bars.length - 1]?.l?.toFixed(2) || 'N/A'} | Volume: ${bars[bars.length - 1]?.v?.toLocaleString() || 'N/A'}`);
        }
      }
      if (priceLines.length > 0) {
        priceContext = '\n\nREAL-TIME MARKET DATA (from Alpaca SIP feed, use these exact prices):\n' + priceLines.join('\n');
      }
    } catch (e) {
      console.error('Price fetch error:', e);
    }
  }

  const systemPrompt = `You are Stratify AI, a trading copilot built into the Stratify platform. You help users analyze stocks, build trading strategies, interpret backtest results, and understand market conditions.

You HAVE access to real-time market data through Alpaca's premium SIP data feed. When price data is provided below, use those EXACT prices in your analysis. Never say you don't have access to real-time data — you do.

Be concise and actionable. Use trading terminology naturally. Format with markdown bold (**text**) and bullet points (•) when helpful. Always reference tickers with $ prefix like $TSLA.

When users ask about strategies, suggest specific entry/exit conditions, position sizing, and risk management. You are expert in technical analysis (RSI, MACD, moving averages, breakout patterns, volume analysis), fundamental analysis, and quantitative trading.

When giving price levels for support/resistance, use round numbers near the actual price. When suggesting stop losses, calculate them as specific dollar amounts based on the real price.${priceContext}`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        max_tokens: 2048,
        temperature: 0.8,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.write(`data: ${JSON.stringify({ error: err })}\n\n`);
      res.end();
      return;
    }

    const data = await response.json();
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}
