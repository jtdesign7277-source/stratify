import { postToDiscord, buildStrategyEmbed } from '../lib/discord.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { name, ticker, type, description, winRate, signals } = req.body;
    if (!ticker || !type) return res.status(400).json({ error: 'Missing ticker or type' });

    const embed = buildStrategyEmbed({
      name: name || `${type} Strategy`,
      ticker, type, description, winRate, signals,
    });

    await postToDiscord('strategies', { embeds: [embed] });
    return res.status(200).json({ success: true, posted: 'strategies' });
  } catch (err) {
    console.error('Strategy hook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
