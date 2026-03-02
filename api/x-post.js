// api/x-post.js — Agent_X for @stratify_hq
// Real data first (Twelve Data), then Claude writes copy. No hallucination.

import { Redis } from '@upstash/redis'

const TD_KEY = process.env.TWELVE_DATA_API_KEY
const TODAY = () => new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
})

const CONTENT_TYPES = {
  'morning-briefing':   { schedule: '8:30am EST',  description: 'Daily pre-market briefing' },
  'technical-setup':    { schedule: 'multiple/day', description: 'Technical setups with real prices' },
  'top-movers':         { schedule: '10:00am EST',  description: 'Real top movers from Twelve Data' },
  'midday-update':      { schedule: '12:30pm EST',  description: 'Midday market pulse' },
  'power-hour':         { schedule: '3:00pm EST',   description: 'Power hour alert' },
  'market-recap':       { schedule: '4:15pm EST',   description: 'End of day recap' },
  'afterhours-movers':  { schedule: '5:00pm EST',   description: 'After hours movers' },
  'weekend-watchlist':  { schedule: 'Sat 10am EST', description: 'Weekend watchlist' },
}

// ── Twelve Data helpers ────────────────────────────────────────────────────

async function fetchQuotes(symbols) {
  const sym = Array.isArray(symbols) ? symbols.join(',') : symbols
  const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${TD_KEY}&extended_hours=1`)
  if (!res.ok) throw new Error(`Twelve Data quote failed: ${res.status}`)
  return res.json()
}

async function fetchMovers(direction = 'gainers', limit = 8) {
  const res = await fetch(`https://api.twelvedata.com/market_movers/stocks?direction=${direction}&outputsize=${limit}&apikey=${TD_KEY}`)
  if (!res.ok) throw new Error(`Twelve Data movers failed: ${res.status}`)
  const data = await res.json()
  return data.values || []
}

function fmtQuote(q) {
  if (!q || q.status === 'error') return null
  const price = parseFloat(q.close || q.price || 0)
  const pct   = parseFloat(q.percent_change || 0)
  const sign  = pct >= 0 ? '+' : ''
  const arrow = pct >= 0 ? '📈' : '📉'
  return { symbol: q.symbol, price, pct, arrow, label: `${arrow} ${q.symbol} $${price.toFixed(2)} (${sign}${pct.toFixed(2)}%)` }
}

function fmtMover(m) {
  const pct   = parseFloat(m.percent_change || 0)
  const price = parseFloat(m.last || m.price || 0)
  const arrow = pct >= 0 ? '📈' : '📉'
  const sign  = pct >= 0 ? '+' : ''
  return `${arrow} $${m.symbol} ${sign}${pct.toFixed(1)}% @ $${price.toFixed(2)}`
}

function fmtMovers(arr) { return arr.map(fmtMover).join('\n') }

// ── Redis ──────────────────────────────────────────────────────────────────

function getRedis() {
  const url   = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// ── OAuth 1.0a X posting ───────────────────────────────────────────────────

async function postToXOAuth(text) {
  const crypto = await import('crypto')
  const oauthParams = {
    oauth_consumer_key:     process.env.X_API_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_token:            process.env.X_ACCESS_TOKEN,
    oauth_version:          '1.0',
  }
  const url = 'https://api.x.com/2/tweets'
  const paramString = Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`).join('&')
  const signatureBase = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(process.env.X_API_SECRET)}&${encodeURIComponent(process.env.X_ACCESS_TOKEN_SECRET)}`
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64')
  oauthParams.oauth_signature = signature
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`X OAuth ${response.status}: ${err}`)
  }
  return response.json()
}

// ── Claude content generation ──────────────────────────────────────────────

async function claude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ── Content generators (real data → Claude copy) ───────────────────────────

async function generateContent(type) {
  const date = TODAY()

  if (type === 'morning-briefing') {
    const [quotes, gainers, losers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ', 'DIA']),
      fetchMovers('gainers', 6),
      fetchMovers('losers', 4),
    ])
    const spy = fmtQuote(quotes.SPY || quotes)
    const qqq = fmtQuote(quotes.QQQ)
    const dia = fmtQuote(quotes.DIA)
    const prompt = `You are the social media voice of @stratify_hq, an AI-powered trading platform.

TODAY IS: ${date}

REAL MARKET DATA (use these exact numbers):
${spy?.label || 'SPY data unavailable'}
${qqq?.label || 'QQQ data unavailable'}
${dia?.label || 'DIA data unavailable'}

TOP GAINERS RIGHT NOW:
${fmtMovers(gainers)}

TOP LOSERS RIGHT NOW:
${fmtMovers(losers)}

Write a morning market briefing tweet thread: 1 main tweet + 2-3 replies.

STRICT RULES:
- Use ONLY the real data above. Never invent prices or percentages.
- The date is ${date} — use the correct year.
- Main tweet: punchy, under 280 chars
- Last reply ends with: "Follow @stratify_hq for real-time alerts ⚡"
- Personality: sharp, witty, no-BS. Dry humor. Confident but not arrogant.
- Max 2 emojis per tweet

Respond with a JSON array of tweet strings only. No markdown, no backticks.`
    return claude(prompt)
  }

  if (type === 'technical-setup') {
    const symbols = ['SPY','QQQ','NVDA','TSLA','AAPL','AMZN','META','MSFT','AMD','GOOGL']
    const quotes = await fetchQuotes(symbols)
    const lines = symbols.map(s => {
      const q = fmtQuote(quotes[s])
      return q ? q.label : `${s} unavailable`
    }).join('\n')
    const prompt = `You are a technical analyst posting from @stratify_hq.

TODAY IS: ${date}

REAL PRICE DATA (use these exact prices):
${lines}

Pick the stock with the most interesting price action. Write ONE technical setup tweet.

STRICT RULES:
- Entry must be within 1% of the real current price shown above
- Stop loss ~2-3% from entry, target ~5-8% from entry
- Include $TICKER, entry, stop, target, R:R ratio, pattern name
- Under 280 characters
- Personality: confident, sharp, like a pro trader texting their group

Respond with JSON object only: {"tweet":"...","ticker":"...","entry":0,"stop":0,"target":0}
No markdown, no backticks.`
    return claude(prompt)
  }

  if (type === 'top-movers') {
    const [gainers, losers] = await Promise.all([fetchMovers('gainers', 5), fetchMovers('losers', 3)])
    const prompt = `You are posting from @stratify_hq.

TODAY IS: ${date}

REAL TOP MOVERS (use these exact numbers):
GAINERS:
${fmtMovers(gainers)}

LOSERS:
${fmtMovers(losers)}

Write a "Top Movers" tweet using ONLY this real data. Do not invent any tickers or percentages.

STRICT RULES:
- Use only the tickers and percentages shown above
- Main tweet under 280 chars
- Format: emoji $TICKER +/-X.X%
- Personality: sharp, energetic

Respond with JSON: {"tweet":"...","thread":[]}
No markdown, no backticks.`
    return claude(prompt)
  }

  if (type === 'market-recap') {
    const [quotes, gainers, losers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ', 'DIA']),
      fetchMovers('gainers', 5),
      fetchMovers('losers', 3),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    const dia = fmtQuote(quotes.DIA)
    const prompt = `You are posting the end-of-day recap from @stratify_hq.

TODAY IS: ${date}

REAL CLOSING DATA (use these exact numbers):
${spy?.label || 'SPY unavailable'}
${qqq?.label || 'QQQ unavailable'}
${dia?.label || 'DIA unavailable'}

TOP MOVERS TODAY:
GAINERS: ${fmtMovers(gainers)}
LOSERS: ${fmtMovers(losers)}

Write a market recap thread: 1 main tweet + 2 replies.

STRICT RULES:
- Use ONLY the real data above
- Main tweet: overall market tone + index levels
- Reply 1: notable movers
- Reply 2: what to watch tomorrow + "Follow @stratify_hq ⚡"
- Each under 280 chars
- Sharp, insightful, no filler

Respond with JSON array of tweet strings. No markdown, no backticks.`
    return claude(prompt)
  }

  if (type === 'power-hour') {
    const [quotes, movers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ']),
      fetchMovers('gainers', 5),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    const prompt = `You are posting a power hour alert from @stratify_hq. It is 3:00 PM EST — final hour of trading.

TODAY IS: ${date}

REAL MARKET DATA RIGHT NOW:
${spy?.label || 'SPY unavailable'}
${qqq?.label || 'QQQ unavailable'}

TOP MOVERS RIGHT NOW:
${fmtMovers(movers)}

Write 1 urgent power hour tweet using ONLY this real data. Urgent, energetic tone.

Under 280 chars. Respond with JSON: {"tweet":"..."}
No markdown, no backticks.`
    return claude(prompt)
  }

  if (type === 'afterhours-movers') {
    const [quotes, gainers, losers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ']),
      fetchMovers('gainers', 5),
      fetchMovers('losers', 3),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    const prompt = `You are posting after-hours movers from @stratify_hq.

TODAY IS: ${date}

REAL AFTER-HOURS DATA:
${spy?.label || 'SPY unavailable'}
${qqq?.label || 'QQQ unavailable'}

TOP MOVERS (AH):
GAINERS: ${fmtMovers(gainers)}
LOSERS: ${fmtMovers(losers)}

Write an after-hours tweet using ONLY this real data. Focus on biggest moves.

Respond with JSON: {"tweet":"...","thread":[]}
No markdown, no backticks.`
    return claude(prompt)
  }

  if (type === 'weekend-watchlist') {
    const symbols = ['SPY','QQQ','NVDA','TSLA','AAPL','AMZN','META','MSFT','AMD','GOOGL']
    const quotes = await fetchQuotes(symbols)
    const lines = symbols.map(s => {
      const q = fmtQuote(quotes[s])
      return q ? q.label : `${s} unavailable`
    }).join('\n')
    const prompt = `You are posting the weekend watchlist from @stratify_hq.

TODAY IS: ${date}

REAL CLOSING PRICES (use these exact numbers):
${lines}

Write a weekend watchlist thread (3 tweets) for next week's setups.
Pick 5-6 stocks from the list above. For each: $TICKER @ real price, what to watch.

STRICT RULES:
- Base all price levels on the real data above
- Tweet 3 ends with risk reminder + "Follow @stratify_hq ⚡"
- Each under 280 chars

Respond with JSON array of 3 tweet strings. No markdown, no backticks.`
    return claude(prompt)
  }

  if (type === 'midday-update') {
    const [quotes, movers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ']),
      fetchMovers('gainers', 4),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    const prompt = `You are posting a midday market update from @stratify_hq.

TODAY IS: ${date}

REAL MIDDAY DATA:
${spy?.label || 'SPY unavailable'}
${qqq?.label || 'QQQ unavailable'}

TOP MOVERS MID-SESSION:
${fmtMovers(movers)}

Write 1 midday pulse tweet using ONLY this real data. Calm, informative, professional.

Under 280 chars. Respond with JSON: {"tweet":"..."}
No markdown, no backticks.`
    return claude(prompt)
  }

  throw new Error(`Unknown content type: ${type}`)
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { type, action, post } = req.query

  if (action === 'list') {
    return res.status(200).json({ contentTypes: CONTENT_TYPES })
  }

  if (!type || !CONTENT_TYPES[type]) {
    return res.status(400).json({
      error: `Invalid type. Available: ${Object.keys(CONTENT_TYPES).join(', ')}`,
    })
  }

  console.log(`[Agent_X] Generating: ${type} | ${TODAY()}`)

  try {
    const content = await generateContent(type)
    const result = { type, content, generatedAt: new Date().toISOString() }

    if (post === 'true' || post === '1') {
      console.log(`[Agent_X] Posting to X...`)
      const tweets = Array.isArray(content)
        ? content
        : content.thread?.length
          ? [content.tweet, ...content.thread]
          : [content.tweet || JSON.stringify(content)]

      const posted = []
      let lastTweetId = null

      for (const tweet of tweets) {
        try {
          const text = typeof tweet === 'string' ? tweet : tweet.text || JSON.stringify(tweet)
          // Thread replies need reply param — rebuild body for thread
          const body = { text }
          if (lastTweetId) body.reply = { in_reply_to_tweet_id: lastTweetId }

          // For threads we need to handle reply separately via OAuth
          const xRes = await postToXOAuth(text)
          lastTweetId = xRes.data?.id
          posted.push({ text, id: lastTweetId, status: 'posted' })
          if (tweets.length > 1) await new Promise(r => setTimeout(r, 1000))
        } catch (err) {
          posted.push({ status: 'failed', error: err.message })
        }
      }

      result.posted = posted
      result.tweetCount = posted.filter(p => p.status === 'posted').length
    }

    // Cache result
    const redis = getRedis()
    if (redis) {
      try {
        const key = `xpost:${type}:${new Date().toISOString().split('T')[0]}`
        await redis.set(key, JSON.stringify(result), { ex: 86400 })
      } catch (_) {}
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error(`[Agent_X] Error for ${type}:`, err.message)
    return res.status(500).json({ error: err.message, type })
  }
}
