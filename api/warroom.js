import { getCachedScan, setCachedScan } from './lib/warroom-cache.js';

function extractSources(contentBlocks) {
  const sources = [];
  const seen = new Set();
  for (const block of contentBlocks || []) {
    if (block.type === 'web_search_tool_result') {
      for (const result of block.content || []) {
        if (result.type === 'web_search_result' && result.url && !seen.has(result.url)) {
          seen.add(result.url);
          sources.push({ title: result.title || result.url, url: result.url });
        }
      }
    }
  }
  return sources;
}

async function fetchFromClaude(query) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: 'You are a classified market intelligence analyst. Provide institutional-grade research for active traders. Search the web for real-time data. Include specific price levels, key dates, catalyst events, and risk factors. Format with markdown. Always use $ prefix for tickers. Include bull and bear cases. Be direct and data-driven. Cite your sources with URLs.',
      messages: [{ role: 'user', content: query }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Anthropic API error:', data);
    throw new Error('API request failed');
  }

  const content = (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  const sources = extractSources(data.content);
  return { content, sources };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // GET — return all cached quick scans for instant load
  if (req.method === 'GET') {
    const label = String(req.query.label || '').trim();
    if (label) {
      const cached = await getCachedScan(label);
      if (cached) return res.status(200).json({ ...cached, fromCache: true });
      return res.status(404).json({ error: 'No cached data for this scan' });
    }
    return res.status(400).json({ error: 'Missing label query param' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, cacheLabel } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: 'Missing query' });
  }

  // If a cache label is provided, check cache first
  if (cacheLabel) {
    const cached = await getCachedScan(cacheLabel);
    if (cached) {
      // Return cached result immediately, refresh in background
      res.status(200).json({ ...cached, fromCache: true });
      // Fire-and-forget background refresh
      fetchFromClaude(query)
        .then((fresh) => setCachedScan(cacheLabel, fresh))
        .catch((err) => console.error('[warroom] Background refresh failed:', err));
      return;
    }
  }

  try {
    const result = await fetchFromClaude(query);

    // Cache the result if label provided
    if (cacheLabel) {
      setCachedScan(cacheLabel, result).catch(() => {});
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('War Room error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
