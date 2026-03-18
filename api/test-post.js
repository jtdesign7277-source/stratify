/**
 * Manually trigger one X bot post immediately.
 * Protected in production by the same CRON_SECRET used by Vercel cron jobs.
 */
import { Redis } from '@upstash/redis';

const TEST_LOCK_TTL = 30;

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (!cronSecret) {
    if (isProduction) {
      return res.status(500).json({ error: 'CRON_SECRET is required in production' });
    }
  } else if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type || 'market-open';
  const testLockKey = `test:lock:${type}`;
  const redis = getRedis();
  if (redis) {
    try {
      const locked = await redis.set(testLockKey, '1', { nx: true, ex: TEST_LOCK_TTL });
      if (locked !== 'OK') {
        return res.status(200).json({ status: 'skipped', reason: 'already fired recently' });
      }
    } catch {
      // proceed without lock if Redis fails
    }
  }

  try {
    const xBotHandler = (await import('./x-bot-v2.js')).default;

    const mockReq = {
      method: 'GET',
      query: { type },
      headers: req.headers.authorization
        ? { authorization: req.headers.authorization }
        : {},
    };

    let statusCode = 200;
    let body = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return mockRes;
      },
      json(b) {
        body = b;
        return mockRes;
      },
    };

    await xBotHandler(mockReq, mockRes);

    res.status(statusCode).json(body);
  } catch (error) {
    console.error('test-post error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
}
