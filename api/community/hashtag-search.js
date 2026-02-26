export const config = { maxDuration: 30 };

const MAX_RESULTS = 5;
const SYSTEM_PROMPT = 'You are a financial news aggregator. Search the web for the latest news and discussion about the given financial topic. Return ONLY a JSON array of 5 items, no markdown, no backticks.';

function normalizeHashtag(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/\s+/g, '').replace(/^#+/, '');
  if (!cleaned) return '';
  return `#${cleaned}`;
}

function stripMarkdownFences(text) {
  return String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function tryParseJsonArray(text) {
  const cleaned = stripMarkdownFences(text);
  if (!cleaned) return null;

  try {
    const direct = JSON.parse(cleaned);
    return Array.isArray(direct) ? direct : null;
  } catch {
    // Continue scanning for JSON array boundaries.
  }

  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (char === '[') {
      if (start === -1) start = i;
      depth += 1;
      continue;
    }

    if (char !== ']') continue;
    depth -= 1;
    if (depth !== 0 || start === -1) continue;

    const candidate = cleaned.slice(start, i + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Keep scanning for another possible array block.
    }
  }

  return null;
}

function normalizeTickers(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((value) => String(value || '').trim().replace(/^\$/, '').toUpperCase())
    .map((value) => value.replace(/[^A-Z0-9./=-]/g, '').slice(0, 14))
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, 6);
}

function normalizeItems(rows = []) {
  const deduped = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      headline: String(row?.headline || row?.title || '').replace(/\s+/g, ' ').trim(),
      summary: String(row?.summary || row?.description || '').replace(/\s+/g, ' ').trim(),
      source: String(row?.source || row?.publisher || row?.outlet || 'Web').replace(/\s+/g, ' ').trim() || 'Web',
      relatedTickers: normalizeTickers(row?.relatedTickers || row?.tickers || []),
    }))
    .filter((row) => row.headline)
    .filter((row) => {
      const key = row.headline.toLowerCase();
      if (deduped.has(key)) return false;
      deduped.add(key);
      return true;
    })
    .slice(0, MAX_RESULTS);
}

async function callGrokHashtagSearch(hashtag) {
  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('XAI_API_KEY is missing. Please add it in environment variables.');

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini-fast',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Find 5 current trending discussions about ${hashtag} in financial markets. Return JSON array: [{ "headline": string, "summary": string (1-2 sentences), "source": string, "relatedTickers": [string] }]`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`xAI API error ${response.status}: ${errorBody.slice(0, 240)}`);
  }

  return response.json();
}

function parseHashtagSearchPayload(payload) {
  const assistantText = String(payload?.choices?.[0]?.message?.content || '').trim();
  const parsed = tryParseJsonArray(assistantText);
  if (Array.isArray(parsed)) return normalizeItems(parsed);
  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const hashtag = normalizeHashtag(req.body?.hashtag || req.body?.tag);
  if (!hashtag) {
    return res.status(400).json({ error: 'hashtag is required' });
  }

  try {
    const payload = await callGrokHashtagSearch(hashtag);
    const items = parseHashtagSearchPayload(payload);
    return res.status(200).json({
      hashtag,
      items,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    return res.status(502).json({
      error: String(error?.message || 'Hashtag web search failed'),
      items: [],
      hashtag,
    });
  }
}
