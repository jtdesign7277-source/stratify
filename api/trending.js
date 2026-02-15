const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_ITEMS = 15;
const MAX_ITEMS = 20;

let cachedPayload = null;
let cachedAt = 0;

const clampText = (value, max = 160) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

const uniqueList = (list) => {
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    if (!item) return;
    const key = String(item).toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
};

const normalizeSymbols = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return uniqueList(
      value
        .map((item) => String(item || '').replace(/[^A-Za-z0-9.-]/g, '').toUpperCase())
        .filter(Boolean)
    );
  }

  if (typeof value === 'string') {
    return uniqueList(
      value
        .split(/[\s,]+/)
        .map((item) => item.replace(/[^A-Za-z0-9.-]/g, '').toUpperCase())
        .filter(Boolean)
    );
  }

  return [];
};

const extractSymbolsFromText = (text) => {
  if (!text) return [];
  const matches = String(text).match(/\$[A-Z]{1,6}(?:\.[A-Z]{1,2})?\b/g) || [];
  return uniqueList(matches.map((match) => match.replace('$', '').toUpperCase()));
};

const normalizeTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') {
    return new Date(value * (value > 1e12 ? 1 : 1000)).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const finalizeItems = (items, fallbackSource) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const text = clampText(item?.text || item?.headline || item?.title || item?.summary);
      if (!text) return null;
      const source = clampText(item?.source || fallbackSource || 'Unknown', 40) || 'Unknown';
      const rawSymbols = normalizeSymbols(item?.symbols || item?.symbol || item?.related);
      const derivedSymbols = extractSymbolsFromText(text);
      const symbols = uniqueList([...rawSymbols, ...derivedSymbols]);
      const timestamp = normalizeTimestamp(item?.timestamp || item?.created_at || item?.updated_at || item?.datetime);

      return {
        text,
        source,
        timestamp,
        symbols,
      };
    })
    .filter(Boolean);
};

const extractJson = (content) => {
  if (!content) return null;
  const trimmed = String(content).trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (_) {}
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (_) {}
  }

  return null;
};

const getMessageText = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('\n')
    .trim();
};

const fetchGrokNews = async () => {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) return [];

  const systemPrompt = `You are a financial news aggregator. Return 15-20 real, current financial headlines, viral finance tweets, and trending market topics. Each item must be real-world and recent. Provide JSON ONLY in this exact format: {"items":[{"text":"headline","source":"Reuters","timestamp":"2025-01-01T00:00:00Z","symbols":["TSLA"]}]}. The timestamp must be ISO 8601. Symbols must be uppercase without $. If you cannot find enough, return as many as you can.`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Return the JSON object now.' },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('xAI trending API error:', response.status, details);
      return [];
    }

    const data = await response.json();
    const content = getMessageText(data?.choices?.[0]?.message?.content);
    const parsed = extractJson(content);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    return finalizeItems(items, 'xAI');
  } catch (error) {
    console.error('xAI trending fetch error:', error);
    return [];
  }
};

const fetchFinnhubNews = async () => {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`);
    if (!response.ok) {
      const details = await response.text();
      console.error('Finnhub news error:', response.status, details);
      return [];
    }

    const data = await response.json();
    return finalizeItems(data, 'Finnhub');
  } catch (error) {
    console.error('Finnhub news fetch error:', error);
    return [];
  }
};

const fetchAlpacaNews = async () => {
  const apiKey = (process.env.ALPACA_API_KEY || '').trim();
  const apiSecret = (process.env.ALPACA_SECRET_KEY || '').trim();
  if (!apiKey || !apiSecret) return [];

  try {
    const response = await fetch('https://data.alpaca.markets/v1beta1/news?sort=desc&limit=20', {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Alpaca news error:', response.status, details);
      return [];
    }

    const data = await response.json();
    const news = data?.news || data?.data || data || [];
    return finalizeItems(news, 'Alpaca');
  } catch (error) {
    console.error('Alpaca news fetch error:', error);
    return [];
  }
};

const dedupeItems = (items) => {
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const key = String(item?.text || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const now = Date.now();
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) {
    return res.status(200).json(cachedPayload);
  }

  const [grokItems, alpacaItems, finnhubItems] = await Promise.all([
    fetchGrokNews(),
    fetchAlpacaNews(),
    fetchFinnhubNews(),
  ]);

  let combined = dedupeItems([
    ...grokItems,
    ...alpacaItems,
    ...finnhubItems,
  ]);

  if (combined.length < MIN_ITEMS) {
    combined = dedupeItems([
      ...alpacaItems,
      ...finnhubItems,
      ...grokItems,
    ]);
  }

  combined = combined.slice(0, MAX_ITEMS);

  const payload = { items: combined };
  cachedPayload = payload;
  cachedAt = now;

  return res.status(200).json(payload);
}
