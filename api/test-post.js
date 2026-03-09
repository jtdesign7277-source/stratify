/**
 * Manually trigger one X bot post immediately.
 * Calls the x-bot-v2 handler with type=market-open (no changes to x-bot-v2.js).
 * Redis lock test:lock (TTL 30s) prevents duplicate firing.
 */
import { Redis } from '@upstash/redis';

const TEST_LOCK_KEY = 'test:lock';
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

  const redis = getRedis();
  if (redis) {
    try {
      const existing = await redis.get(TEST_LOCK_KEY);
      if (existing != null) {
        return res.status(200).json({ status: 'skipped', reason: 'already fired recently' });
      }
      await redis.set(TEST_LOCK_KEY, 'true', { ex: TEST_LOCK_TTL });
    } catch {
      // proceed without lock if Redis fails
    }
  }

  const type = req.query.type || 'market-open';

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
