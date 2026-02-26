import { getCachedTranscript, setCachedTranscript } from './lib/warroom-cache.js';

export const config = { maxDuration: 60 };

// Reject transcripts that reference a date in the future
function hasFutureDate(content, today) {
  const todayDate = new Date(today + 'T23:59:59Z');
  // Match patterns like "January 30, 2026" or "February 15, 2026"
  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})/gi;
  let match;
  while ((match = datePattern.exec(content)) !== null) {
    const parsed = new Date(match[0].replace(',', '') + ' UTC');
    if (!Number.isNaN(parsed.getTime()) && parsed > todayDate) {
      return match[0];
    }
  }
  return null;
}

function buildSystem(today) {
  return [
    `You are a financial transcript analyst. TODAY IS ${today}. This is an absolute fact — do not ignore it.`,
    '',
    '=== MANDATORY DATE RULES (VIOLATION = FAILURE) ===',
    `1. The current date is ${today}. Any earnings call dated AFTER ${today} has NOT happened yet.`,
    '2. You MUST search the web to find the ACTUAL most recent earnings call date.',
    '3. You MUST verify the call date is ON or BEFORE today before reporting it.',
    '4. If a company\'s next earnings call is in the future, report the PREVIOUS quarter\'s call instead.',
    '5. NEVER write a date in the **Date:** field that is after today.',
    '6. If you cannot find a verified past earnings call, say "No verified recent earnings call found" — do NOT guess.',
    '',
    'EXAMPLES OF WHAT NOT TO DO:',
    `- If today is ${today} and the next AAPL call is April 2026, do NOT report it. Report the January 2026 call instead.`,
    `- If today is ${today} and NVDA\'s call was February 26, 2026, but today is February 25, that call is IN THE FUTURE — report the previous quarter.`,
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const flush = req.query.flush === '1';

  // Check Redis cache first (skip if flush requested)
  if (!flush) {
    const cached = await getCachedTranscript(symbol);
    if (cached) {
      // Validate cached content doesn't have future dates
      const today = new Date().toISOString().split('T')[0];
      const futureDate = hasFutureDate(cached.content || '', today);
      if (!futureDate) {
        return res.status(200).json({ ...cached, fromCache: true });
      }
      // Bad cache — fall through to re-fetch
      console.warn(`[transcript] Flushing bad cache for ${symbol} — contains future date: ${futureDate}`);
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const today = new Date().toISOString().split('T')[0];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: buildSystem(today),
        messages: [{ role: 'user', content: `Today is exactly ${today}. Search the web and find the most recent earnings call transcript for $${symbol} that has ALREADY happened (call date must be on or before ${today}). If the next call hasn't happened yet, use the previous quarter's call. Provide a detailed summary.` }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Transcript API error:', data);
      return res.status(500).json({ error: 'API request failed' });
    }

    const content = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const sources = [];
    const seen = new Set();
    for (const block of data.content || []) {
      if (block.type === 'web_search_tool_result') {
        for (const result of block.content || []) {
          if (result.type === 'web_search_result' && result.url && !seen.has(result.url)) {
            seen.add(result.url);
            sources.push({ title: result.title || result.url, url: result.url });
          }
        }
      }
    }

    // Final safety check — reject if content mentions a future date
    const futureDate = hasFutureDate(content, today);
    if (futureDate) {
      console.warn(`[transcript] Model returned future date for ${symbol}: ${futureDate} — not caching`);
      return res.status(200).json({
        symbol,
        content: `⚠️ The AI returned a transcript dated ${futureDate}, which hasn't happened yet. This was rejected to prevent showing inaccurate data.\n\nPlease try again — the model should find the most recent past earnings call.`,
        sources: [],
        warning: `Rejected: future date ${futureDate}`,
      });
    }

    const result = { symbol, content, sources };
    setCachedTranscript(symbol, result).catch(() => {});

    return res.status(200).json(result);
  } catch (error) {
    console.error('Earnings transcript error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
