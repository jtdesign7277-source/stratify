import { getCachedScan, setCachedScan } from './lib/warroom-cache.js';

export const config = { maxDuration: 60 };

function getTodayContext() {
  const now = new Date();
  return {
    localeDate: now.toLocaleDateString(),
    isoDate: now.toISOString().split('T')[0],
  };
}

function buildScanSystemPrompt(localeDate) {
  return [
    'You are a classified market intelligence analyst.',
    'Provide institutional-grade research for active traders.',
    `Today is ${localeDate}. Only provide current information. Never reference data from 2023 or 2024.`,
    'Search the web for real-time data.',
    'Include specific price levels, key dates, catalyst events, and risk factors.',
    'Format with markdown.',
    'Always use $ prefix for tickers.',
    'Include bull and bear cases.',
    'Be direct and data-driven.',
    'Cite your sources with URLs.',
  ].join(' ');
}

function buildScanUserPrompt(query, localeDate, isoDate) {
  return `Today is ${localeDate} (${isoDate}). ${String(query || '').trim()}`;
}

function extractSources(contentBlocks, contentText = '') {
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

  if (sources.length === 0) {
    const urlMatches = String(contentText || '').match(/https?:\/\/[^\s)]+/gi) || [];
    for (const match of urlMatches) {
      const url = match.replace(/[),.;!?]+$/g, '');
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({ title: url, url });
    }
  }

  return sources;
}

async function fetchFromClaude(query) {
  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('XAI_API_KEY is missing. Please add it in environment variables.');
  }
  const { localeDate, isoDate } = getTodayContext();

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini-fast',
      max_tokens: 4096,
      temperature: 0.8,
      messages: [
        { role: 'system', content: buildScanSystemPrompt(localeDate) },
        { role: 'user', content: buildScanUserPrompt(query, localeDate, isoDate) },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('xAI API error:', data);
    throw new Error('API request failed');
  }

  const content = String(data?.choices?.[0]?.message?.content || '').trim();

  const sources = extractSources(data?.content || [], content);
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

  const xaiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!xaiKey) {
    return res.status(500).json({ error: 'XAI_API_KEY is missing. Please add it in environment variables.' });
  }

  const { query, cacheLabel, forceRefresh } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: 'Missing query' });
  }
  const refreshRequested = forceRefresh === true || String(forceRefresh || '').toLowerCase() === 'true' || String(forceRefresh || '') === '1';

  // If a cache label is provided, check cache first — return instantly
  if (cacheLabel && !refreshRequested) {
    const cached = await getCachedScan(cacheLabel);
    if (cached) {
      return res.status(200).json({ ...cached, fromCache: true });
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
