# Redis Cache-First Data Pattern

## Required Behavior

Implement cache-first reads for every data-backed surface.

1. Check Redis first.
2. Render cached result immediately when present.
3. On miss, fetch from upstream API, normalize response, write Redis, render.
4. Start WebSocket stream and replace cached snapshot with live updates.
5. Preload adjacent tab datasets in the background.

## UX Guarantees

1. No spinner-only cold tab transitions.
2. No blank tab content while data exists in cache.
3. No polling fallback for quote streams when WebSocket is available.

## Server Route Pattern

```js
// Pseudocode pattern for serverless route
const cacheKey = `bars:${symbol}:${timeframe}`
const cached = await redis.get(cacheKey)
if (cached) return json({ source: 'cache', data: cached })

const fresh = await fetchUpstream(symbol, timeframe)
await redis.set(cacheKey, fresh, { ex: ttlSeconds })
return json({ source: 'fresh', data: fresh })
```

## Client Hook Pattern

```js
// Pseudocode pattern for client state
const [data, setData] = useState(null)

useEffect(() => {
  loadSnapshot() // cache-backed endpoint
  const ws = connectQuoteStream(symbol)
  ws.onmessage = (next) => setData((prev) => mergeLive(prev, next))
  return () => ws.close()
}, [symbol])
```

## Tab Preloading Pattern

When opening a page with tabs:

1. Load active tab immediately.
2. Schedule background fetches for adjacent tabs.
3. Write preloaded responses to cache and state store.
4. On tab click, render already-preloaded state instantly.

## Cache Design Notes

1. Use deterministic key naming (`domain:entity:interval[:variant]`).
2. Use TTL by data volatility.
3. Include source metadata (`cache`, `fresh`, `stream`) for debugging.
4. Invalidate keys on symbol/timeframe changes or explicit refresh actions.
