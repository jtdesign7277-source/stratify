// api/summarize.js
// Summarizes a financial news article using Anthropic Claude.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured' });
  }

  const { title = '', content = '', source = '', url = '' } = req.body || {};

  if (!title && !content) {
    return res.status(400).json({ error: 'title or content is required' });
  }

  const articleText = [
    title && `Title: ${title}`,
    source && `Source: ${source}`,
    url && `URL: ${url}`,
    content && `Content: ${content}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Summarize this financial news article in 2-3 concise sentences. Focus on the key takeaway and market impact. Be direct and specific.\n\n${articleText}`;

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.type === 'error') {
      const msg = data?.error?.message || `Anthropic API error ${response.status}`;
      return res.status(502).json({ error: msg });
    }

    const summary = data?.content?.[0]?.text;
    if (!summary) {
      return res.status(502).json({ error: 'Empty response from Anthropic' });
    }

    return res.status(200).json({ summary });
  } catch (err) {
    console.error('[api/summarize] error:', err);
    return res.status(500).json({ error: 'Failed to summarize' });
  }
}
