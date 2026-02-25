import { getCachedTranscript, setCachedTranscript } from './lib/warroom-cache.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  // Check Redis cache first — transcripts cached for 4 hours
  const cached = await getCachedTranscript(symbol);
  if (cached) {
    return res.status(200).json({ ...cached, fromCache: true });
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
        system: [
          `You are a financial transcript analyst. Today's date is ${today}.`,
          '',
          'CRITICAL RULES:',
          `- Only report earnings calls that have ALREADY happened on or before ${today}.`,
          '- NEVER fabricate or guess an earnings call that has not occurred yet.',
          '- If the most recent call you find is from a previous quarter, report that one — do not invent a newer one.',
          '- Search the web to verify the actual date of the most recent earnings call.',
          '',
          'Return the transcript content in this exact format:',
          '',
          '## [Company Name] ($SYMBOL) — Q[X] FY[YEAR] Earnings Call',
          '**Date:** [actual date the call took place]',
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
        ].join('\n'),
        messages: [{ role: 'user', content: `Today is ${today}. Search the web and find the most recent earnings call transcript for ${symbol} that has ALREADY taken place. Provide a detailed summary.` }],
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

    const result = { symbol, content, sources };

    // Cache for 4 hours
    setCachedTranscript(symbol, result).catch(() => {});

    return res.status(200).json(result);
  } catch (error) {
    console.error('Earnings transcript error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
