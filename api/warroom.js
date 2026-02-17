export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
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
      return res.status(500).json({ error: 'API request failed', details: data });
    }

    const content = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return res.status(200).json({ content, raw: data.content });
  } catch (error) {
    console.error('War Room error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
