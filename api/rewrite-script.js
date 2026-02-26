export const config = { maxDuration: 30 };

const STYLE_PROMPTS = {
  funny: 'Rewrite this in a funny, witty, humor-filled style that makes people laugh. Use clever wordplay, jokes, and a light-hearted tone. Keep it entertaining but the core message intact.',
  professional: 'Rewrite this in a polished, professional tone suitable for LinkedIn or a business audience. Use clear, confident language with strong vocabulary. Sound authoritative and credible.',
  financial: 'Rewrite this in the style of a Wall Street analyst or financial commentator. Use market terminology, precise data references, and a confident analytical tone. Sound like Bloomberg or CNBC.',
  boss: 'Rewrite this in a bold, commanding, boss-level tone. Short punchy sentences. Sound like a CEO addressing their team — direct, powerful, no fluff. Make it sound like money talks.',
  gen_z: 'Rewrite this in a Gen Z / internet culture style. Use casual slang, abbreviations, and a vibe that would resonate on Twitter/X. Keep it real and relatable. No cap.',
  motivational: 'Rewrite this as a motivational, hype-style post. Inspire action, use power words, and make the reader feel like they can conquer the markets. Energy and confidence.',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { script, style } = req.body || {};
  if (!script?.trim()) return res.status(400).json({ error: 'Missing script content' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const styleKey = (style || 'professional').toLowerCase();
  const styleInstruction = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS.professional;

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
        max_tokens: 1024,
        system: [
          'You are a creative writing assistant for Stratify, an AI trading platform.',
          'Your job is to rewrite user scripts/notes into polished, shareable content.',
          'Keep the rewrite concise — ideal for a tweet or short social post (under 280 characters when possible, but can go longer if needed).',
          'Always preserve the core message and any ticker symbols ($AAPL, $SPY, etc.).',
          'Do NOT add hashtags unless the user\'s original had them.',
          'Return ONLY the rewritten text — no preamble, no quotes, no explanation.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: `${styleInstruction}\n\nOriginal script:\n${script.trim()}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Rewrite API error:', data);
      return res.status(500).json({ error: 'API request failed' });
    }

    const rewritten = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    return res.status(200).json({ rewritten, style: styleKey });
  } catch (error) {
    console.error('Rewrite error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
