import { getCachedScan, setCachedScan, getCachedTranscript, setCachedTranscript } from '../lib/warroom-cache.js';

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

const TRANSCRIPT_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'MSFT', 'JPM', 'NFLX'];

const SCAN_SYSTEM = 'You are a classified market intelligence analyst. Provide institutional-grade research for active traders. Search the web for real-time data. Include specific price levels, key dates, catalyst events, and risk factors. Format with markdown. Always use $ prefix for tickers. Include bull and bear cases. Be direct and data-driven. Cite your sources with URLs.';

const TRANSCRIPT_SYSTEM = [
  'You are a financial transcript analyst. Search the web for the most recent earnings call transcript for the requested company.',
  'Return the transcript content in this exact format:',
  '',
  '## [Company Name] ($SYMBOL) — Q[X] [YEAR] Earnings Call',
  '**Date:** [date of the call]',
  '**Participants:** [CEO name, CFO name, other key executives]',
  '',
  '### Key Highlights',
  '- [3-5 bullet points of the most important takeaways]',
  '',
  '### Management Commentary',
  '[Summarize the key quotes and commentary from executives, organized by topic. Include direct quotes where possible.]',
  '',
  '### Q&A Highlights',
  '[Summarize the most important analyst questions and management responses]',
  '',
  '### Guidance',
  '[Revenue guidance, EPS guidance, and any forward-looking statements]',
  '',
  'Be thorough and data-driven. Include specific numbers, percentages, and dollar amounts mentioned in the call.',
].join('\n');

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

async function callClaude(system, userMessage) {
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
      system,
      messages: [{ role: 'user', content: userMessage }],
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

// Run tasks in parallel batches to stay within time limits
async function runBatch(tasks, concurrency = 3) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn => fn()));
    results.push(...batchResults);
  }
  return results;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // batch=scans | batch=transcripts | batch=transcripts2 | (default: scans only)
  const batch = String(req.query.batch || 'scans').toLowerCase();
  const results = [];

  if (batch === 'scans') {
    // Warm quick scans — 6 items, run 3 at a time (~2 batches, ~100s total)
    const tasks = QUICK_SCANS.map((scan) => async () => {
      const existing = await getCachedScan(scan.label);
      if (existing) return { type: 'scan', label: scan.label, status: 'cached' };
      const data = await callClaude(SCAN_SYSTEM, scan.query);
      await setCachedScan(scan.label, data);
      return { type: 'scan', label: scan.label, status: 'warmed' };
    });

    const batchResults = await runBatch(tasks, 3);
    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : { status: 'failed', error: r.reason?.message });
    }
  }

  if (batch === 'transcripts') {
    // First 5 tickers in parallel (3 at a time)
    const tickers = TRANSCRIPT_TICKERS.slice(0, 5);
    const tasks = tickers.map((symbol) => async () => {
      const existing = await getCachedTranscript(symbol);
      if (existing) return { type: 'transcript', symbol, status: 'cached' };
      const data = await callClaude(TRANSCRIPT_SYSTEM, `Find the most recent earnings call transcript for ${symbol} and provide a detailed summary.`);
      await setCachedTranscript(symbol, { symbol, ...data });
      return { type: 'transcript', symbol, status: 'warmed' };
    });

    const batchResults = await runBatch(tasks, 3);
    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : { status: 'failed', error: r.reason?.message });
    }
  }

  if (batch === 'transcripts2') {
    // Remaining 4 tickers
    const tickers = TRANSCRIPT_TICKERS.slice(5);
    const tasks = tickers.map((symbol) => async () => {
      const existing = await getCachedTranscript(symbol);
      if (existing) return { type: 'transcript', symbol, status: 'cached' };
      const data = await callClaude(TRANSCRIPT_SYSTEM, `Find the most recent earnings call transcript for ${symbol} and provide a detailed summary.`);
      await setCachedTranscript(symbol, { symbol, ...data });
      return { type: 'transcript', symbol, status: 'warmed' };
    });

    const batchResults = await runBatch(tasks, 3);
    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : { status: 'failed', error: r.reason?.message });
    }
  }

  const warmed = results.filter(r => r.status === 'warmed').length;
  const cached = results.filter(r => r.status === 'cached').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return res.status(200).json({
    success: true,
    batch,
    warmed,
    cached,
    failed,
    details: results,
    timestamp: new Date().toISOString(),
  });
}
