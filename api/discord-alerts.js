import { runDiscordAlertCycle } from './lib/discord-alerts.js';

const toInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const authorizeCron = (req) => {
  if (!process.env.CRON_SECRET) return true;

  const authHeader = req.headers.authorization;
  const xCronSecret = req.headers['x-cron-secret'];
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  return authHeader === expected || xCronSecret === process.env.CRON_SECRET;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.method === 'POST' ? (req.body || {}) : (req.query || {});

  const limit = toInteger(payload.limit, 10);
  const marketMoverPosts = toInteger(payload.marketMoverPosts, 3);
  const mention = typeof payload.mention === 'string' ? payload.mention : undefined;
  const dryRun =
    req.method === 'GET'
      ? true
      : String(payload.dryRun || '').toLowerCase() === 'true' || payload.dryRun === true;

  try {
    const result = await runDiscordAlertCycle({
      limit,
      marketMoverPosts,
      mention,
      dryRun,
    });

    return res.status(200).json({
      success: true,
      route: '/api/discord-alerts',
      ...result,
    });
  } catch (error) {
    console.error('[discord-alerts] failed:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to run discord alerts',
    });
  }
}
