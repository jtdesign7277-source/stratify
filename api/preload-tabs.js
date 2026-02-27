// api/preload-tabs.js — Warm Redis cache for Discover + Finance tabs
// Called on CommunityPage mount to preload both endpoints in parallel

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const baseUrl = `https://${req.headers.host}`
  const results = { discover: 'error', finance: 'error', timestamp: new Date().toISOString() }

  try {
    const [discoverRes, financeRes] = await Promise.all([
      fetch(`${baseUrl}/api/discover`, { signal: AbortSignal.timeout(15000) }).catch((err) => {
        console.error('[preload-tabs] discover failed:', err.message)
        return null
      }),
      fetch(`${baseUrl}/api/finance`, { signal: AbortSignal.timeout(15000) }).catch((err) => {
        console.error('[preload-tabs] finance failed:', err.message)
        return null
      }),
    ])

    if (discoverRes?.ok) {
      const data = await discoverRes.json().catch(() => ({}))
      results.discover = data.cacheHit ? 'cached' : 'warmed'
    }

    if (financeRes?.ok) {
      const data = await financeRes.json().catch(() => ({}))
      results.finance = data.cacheHit ? 'cached' : 'warmed'
    }
  } catch (err) {
    console.error('[preload-tabs] Error:', err.message)
  }

  return res.status(200).json(results)
}
