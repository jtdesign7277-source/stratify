import { getCachedScan, setCachedScan, getCachedTranscript, setCachedTranscript, flushTranscriptCache } from '../lib/warroom-cache.js';

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

function getTodayContext() {
  const now = new Date();
  return {
    isoDate: now.toISOString().split('T')[0],
    localeDate: now.toLocaleDateString(),
  };
}

function getScanSystem(todayLocale) {
  return [
    'You are a classified market intelligence analyst.',
    'Provide institutional-grade research for active traders.',
    `Today is ${todayLocale}. Only provide current information. Never reference data from 2023 or 2024.`,
    'Search the web for real-time data.',
    'Include specific price levels, key dates, catalyst events, and risk factors.',
    'Format with markdown.',
    'Always use $ prefix for tickers.',
    'Include bull and bear cases.',
    'Be direct and data-driven.',
    'Cite your sources with URLs.',
  ].join(' ');
}

function getScanUserPrompt(query, todayLocale, todayIso) {
  return `Today is ${todayLocale} (${todayIso}). ${query}`;
}

function getTranscriptSystem(todayIso, todayLocale) {
  return [
    `You are a financial transcript analyst. TODAY IS ${todayIso}. This is an absolute fact — do not ignore it.`,
    `Today is ${todayLocale}. Only provide current information. Never reference data from 2023 or 2024.`,
    '',
    '=== MANDATORY DATE RULES (VIOLATION = FAILURE) ===',
    `1. The current date is ${todayIso}. Any earnings call dated AFTER ${todayIso} has NOT happened yet.`,
    '2. You MUST search the web to find the ACTUAL most recent earnings call date.',
    '3. You MUST verify the call date is ON or BEFORE today before reporting it.',
    '4. If a company\'s next earnings call is in the future, report the PREVIOUS quarter\'s call instead.',
    '5. NEVER write a date in the **Date:** field that is after today.',
    '6. If you cannot find a verified past earnings call, say "No verified recent earnings call found" — do NOT guess.',
    '',
    'Return the transcript content in this exact format:',
    '',
    '## [Company Name] ($SYMBOL) — Q[X] FY[YEAR] Earnings Call',
    '**Date:** [THE ACTUAL DATE THE CALL TOOK PLACE — must be on or before today]',
    '**Participants:** [CEO name, CFO name, other key executives]',
    '',
    '### Key Highlights',
    '- [3-5 bullet points of the most important takeaways]',
    '',
    '### Management Commentary',
    '[Summarize the key quotes and commentary from executives]',
    '',
    '### Q&A Highlights',
    '[Summarize the most important analyst questions and management responses]',
    '',
    '### Guidance',
    '[Revenue guidance, EPS guidance, and any forward-looking statements]',
    '',
    'Be thorough and data-driven. Include specific numbers, percentages, and dollar amounts.',
  ].join('\n');
}

function getTranscriptUserPrompt(symbol, todayLocale, todayIso) {
  return `Today is ${todayLocale} (${todayIso}). Search the web and find the most recent earnings call transcript for ${symbol} that has ALREADY taken place. The call date must be on or before ${todayIso}. Provide a detailed summary.`;
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

async function callClaude(system, userMessage) {
  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('XAI_API_KEY is missing. Please add it in environment variables.');
  }

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
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`xAI API error: ${response.status}`);

  const content = String(data?.choices?.[0]?.message?.content || '').trim();

  return { content, sources: extractSources(data?.content || [], content) };
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

  const xaiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!xaiKey) {
    return res.status(500).json({ error: 'XAI_API_KEY is missing. Please add it in environment variables.' });
  }

  // batch=scans | batch=transcripts | batch=transcripts2 | batch=flush-transcripts
  const batch = String(req.query.batch || 'scans').toLowerCase();
  const results = [];
  const { isoDate: todayIso, localeDate: todayLocale } = getTodayContext();

  if (batch === 'flush-transcripts') {
    const flushed = await flushTranscriptCache(TRANSCRIPT_TICKERS);
    return res.status(200).json({ success: true, batch, flushed, timestamp: new Date().toISOString() });
  }

  if (batch === 'scans') {
    // Warm quick scans — 6 items, run 3 at a time (~2 batches, ~100s total)
    // Always refresh so users get instant results when they click
    const tasks = QUICK_SCANS.map((scan) => async () => {
      const data = await callClaude(getScanSystem(todayLocale), getScanUserPrompt(scan.query, todayLocale, todayIso));
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
      const data = await callClaude(getTranscriptSystem(todayIso, todayLocale), getTranscriptUserPrompt(symbol, todayLocale, todayIso));
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
      const data = await callClaude(getTranscriptSystem(todayIso, todayLocale), getTranscriptUserPrompt(symbol, todayLocale, todayIso));
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
