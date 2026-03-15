// api/lib/redis.js
// Upstash Redis client using fetch — no Node.js http module required

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = {
    async get(key) {
          if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
          try {
                  const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
                            headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
                          });
                  const json = await res.json();
                  return json.result ? JSON.parse(json.result) : null;
                } catch { return null; }
        },
    async set(key, value, opts = {}) {
          if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
          try {
                  const url = opts.ex
                    ? `${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}?EX=${opts.ex}`
                    : `${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}`;
                  await fetch(url, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(JSON.stringify(value)),
                          });
                } catch {}
        },
  };

export default redis;
