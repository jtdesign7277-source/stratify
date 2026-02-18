import {
  postToDiscord,
  buildStrategyEmbed,
  buildTradeSetupEmbed,
  buildMarketMoverEmbed,
  buildAnnouncementEmbed,
  buildPnlEmbed,
} from '../lib/discord.js';

function authenticate(req) {
  const secret = process.env.DISCORD_NOTIFY_SECRET;
  if (!secret) return true;
  const auth = req.headers['authorization'];
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!authenticate(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { channel, type, data } = req.body;

  if (!channel || !type || !data) {
    return res.status(400).json({ error: 'Missing: channel, type, data' });
  }

  try {
    let payload = {};
    switch (type) {
      case 'text':         payload = { content: data.content }; break;
      case 'strategy':     payload = { embeds: [buildStrategyEmbed(data)] }; break;
      case 'tradeSetup':   payload = { embeds: [buildTradeSetupEmbed(data)] }; break;
      case 'marketMover':  payload = { embeds: [buildMarketMoverEmbed(data)] }; break;
      case 'announcement': payload = { embeds: [buildAnnouncementEmbed(data)] }; break;
      case 'pnl':          payload = { embeds: [buildPnlEmbed(data)] }; break;
      case 'custom':       payload = { content: data.content, embeds: data.embeds }; break;
      default: return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    const result = await postToDiscord(channel, payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Discord notify error:', err);
    return res.status(500).json({ error: err.message });
  }
}
