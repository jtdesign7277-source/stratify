const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_HEADLINES = 8;
const VALID_CATEGORIES = new Set(['bullish', 'bearish', 'crypto', 'breaking']);

let cachedHeadlines = null;
let cachedAt = 0;

const SYSTEM_PROMPT = `You are a financial news aggregator. Return exactly 8 short trending financial headlines from Twitter/X right now. Each headline should be under 80 characters. Include stock tickers where relevant. Mix of: breaking market news, trending stock moves, crypto updates, and notable financial tweets. Make them current and realistic for today.

Return ONLY valid JSON in this exact format:
[
  {"text":"headline here","category":"bullish"},
  {"text":"headline here","category":"bearish"},
  {"text":"headline here","category":"crypto"},
  {"text":"headline here","category":"breaking"}
]

Allowed categories: bullish, bearish, crypto, breaking.
No markdown. No extra commentary.`;
const USER_PROMPT = 'Return the JSON array now.';

const clampText = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);

const normalizeCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (VALID_CATEGORIES.has(normalized)) return normalized;
  if (normalized.includes('bull')) return 'bullish';
  if (normalized.includes('bear')) return 'bearish';
  if (normalized.includes('crypto') || normalized.includes('btc') || normalized.includes('eth')) return 'crypto';
  return 'breaking';
};

const extractJsonArray = (content) => {
  if (!content) return null;

  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (_) {}
  }

  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (_) {}
  }

  return null;
};

const normalizeHeadlines = (payload) => {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      if (typeof item === 'string') {
        return { text: clampText(item), category: 'breaking' };
      }

      const text = clampText(item?.text || item?.headline);
      if (!text) return null;

      return {
        text,
        category: normalizeCategory(item?.category),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_HEADLINES);
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'XAI_API_KEY is not configured' });
  }

  const now = Date.now();
  if (cachedHeadlines && now - cachedAt < CACHE_TTL_MS) {
    return res.status(200).json(cachedHeadlines);
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        temperature: 0.3,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: USER_PROMPT,
          },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('xAI trending API error:', response.status, details);
      return res.status(502).json({ error: 'Failed to fetch trending headlines from xAI' });
    }

    const data = await response.json();
    const content = getMessageText(data?.choices?.[0]?.message?.content);
    const parsed = extractJsonArray(content);
    const headlines = normalizeHeadlines(parsed);

    if (headlines.length !== MAX_HEADLINES) {
      return res.status(502).json({ error: 'xAI returned an invalid response format' });
    }

    cachedHeadlines = headlines;
    cachedAt = now;
    return res.status(200).json(headlines);
  } catch (error) {
    console.error('Trending handler error:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
