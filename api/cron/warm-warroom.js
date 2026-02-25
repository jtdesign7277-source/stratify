import { getCachedScan, setCachedScan } from '../lib/warroom-cache.js';

const QUICK_SCANS = [
  {
    label: 'Market Movers',
    query: 'Identify the biggest U.S. equity market movers right now with catalyst breakdown, price levels, and near-term risk factors.',
  },
  {
    label: 'Earnings Intel',
    query: "Scan this week's most important earnings reports for active traders. Include expected volatility, key levels, and bull/bear setup probabilities.",
  },
  {
    label: '$SPY Analysis',
    query: 'Provide real-time $SPY trade intelligence with key support/resistance, options flow context, catalyst calendar, and tactical bull/bear scenarios.',
  },
  {
    label: 'Fed & Macro',
    query: 'Summarize live Fed and macro developments affecting risk assets. Include dates, event impact map, and likely market reactions across major indices.',
  },
  {
    label: 'Sector Rotation',
    query: 'Map current sector rotation in U.S. equities with relative strength shifts, institutional flow clues, and tradeable implications for the next 1-2 weeks.',
  },
  {
    label: 'Crypto Pulse',
    query: 'Deliver live crypto pulse on $BTC and $ETH with key levels, catalysts, liquidity zones, and bullish vs bearish trigger points for traders.',
  },
];

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

async function fetchScan(query) {
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
  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const content = (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return { content, sources: extractSources(data.content) };
}

export default async function handler(req, res) {
  // Auth check for cron
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const warmed = [];
  const failed = [];

  // Process scans sequentially to avoid rate limits
  for (const scan of QUICK_SCANS) {
    try {
      // Check if already cached and fresh
      const existing = await getCachedScan(scan.label);
      if (existing) {
        warmed.push({ label: scan.label, status: 'already-cached' });
        continue;
      }

      const result = await fetchScan(scan.query);
      await setCachedScan(scan.label, result);
      warmed.push({ label: scan.label, status: 'warmed' });
    } catch (error) {
      failed.push({ label: scan.label, error: error.message });
      console.error(`[warm-warroom] Failed to warm "${scan.label}":`, error);
    }
  }

  return res.status(200).json({
    success: true,
    warmed: warmed.length,
    failed: failed.length,
    details: [...warmed, ...failed],
    timestamp: new Date().toISOString(),
  });
}
