const SYSTEM_PROMPT = `You are a classified market intelligence analyst. Provide institutional-grade research for active traders. Search the web for real-time data. Include specific price levels, key dates, catalyst events, and risk factors. Format with markdown. Always use $ prefix for tickers. Include bull and bear cases. Be direct and data-driven. Cite your sources.`;

const URL_REGEX = /https?:\/\/[^\s)\]"']+/gi;

const cleanUrl = (url = '') =>
  String(url || '')
    .replace(/[)>.,;]+$/g, '')
    .trim();

const collectUrls = (value, bucket) => {
  if (!value) return;

  if (typeof value === 'string') {
    for (const match of value.matchAll(URL_REGEX)) {
      const next = cleanUrl(match[0]);
      if (next) bucket.add(next);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectUrls(entry, bucket));
    return;
  }

  if (typeof value === 'object') {
    const directUrl = cleanUrl(
      value.url || value.href || value.link || value.source_url || value.sourceUrl || ''
    );
    if (directUrl) bucket.add(directUrl);

    Object.values(value).forEach((entry) => collectUrls(entry, bucket));
  }
};

const extractTextBlocks = (content) => {
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean);
};

const extractSources = (payload) => {
  const urls = new Set();
  collectUrls(payload, urls);
  return [...urls];
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
  }

  const query = String(req.body?.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (response.status === 429) {
      return res.status(429).json({ error: 'Rate limit reached. Please retry shortly.' });
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        payload?.error?.message || payload?.error || `Anthropic request failed (${response.status})`;
      return res.status(response.status).json({ error: errorMessage });
    }

    const textBlocks = extractTextBlocks(payload?.content);
    const content = textBlocks.join('\n\n').trim();
    const sources = extractSources(payload);

    return res.status(200).json({
      content: content || 'No intelligence output was generated.',
      sources,
    });
  } catch (error) {
    const message = error?.message || 'War Room request failed';
    return res.status(500).json({ error: message });
  }
}
