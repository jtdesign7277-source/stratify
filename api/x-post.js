// api/x-post.js — Stratify Content Engine for X (@stratify_hq)
// Generates AI-powered market content and posts to X via API
// Supports: morning briefings, technical setups, top movers, market recaps
// Triggered by Vercel cron or manual API call

import { Redis } from '@upstash/redis'

const CONTENT_TYPES = {
  'morning-briefing':    { schedule: '8:30am EST',  description: 'Daily pre-market briefing' },
  'technical-setup':     { schedule: 'multiple/day', description: 'Technical entry/exit setups with chart analysis' },
  'top-movers':          { schedule: '10:00am EST',  description: 'Top pre-market movers' },
  'midday-update':       { schedule: '12:30pm EST',  description: 'Midday market pulse' },
  'power-hour':          { schedule: '3:00pm EST',   description: 'Power hour movers and setups' },
  'market-recap':        { schedule: '4:15pm EST',   description: 'End of day market recap' },
  'afterhours-movers':   { schedule: '5:00pm EST',   description: 'After hours earnings movers' },
  'weekend-watchlist':   { schedule: 'Sat 10am EST', description: 'Weekend watchlist for next week' },
}

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
const X_POST_ENABLED = isTruthy(process.env.ENABLE_X_POST)
const X_POST_KILL_SWITCH = isTruthy(process.env.X_POST_KILL_SWITCH)
const X_POST_DISABLED = X_POST_KILL_SWITCH || !X_POST_ENABLED

const getXPostAnthropicKey = () => String(
  process.env.ANTHROPIC_API_KEY_XPOST
  || ''
).trim()

// Post to X via API v2
async function postToX(text, mediaIds = []) {
  const body = { text }
  if (mediaIds.length > 0) {
    body.media = { media_ids: mediaIds }
  }

  const response = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.X_BEARER_TOKEN}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`X API ${response.status}: ${err}`)
  }

  return await response.json()
}

// Post to X using OAuth 1.0a (for user-context tweets)
async function postToXOAuth(text) {
  const crypto = await import('crypto')
  
  const oauthParams = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
  }

  // Build signature base string
  const url = 'https://api.x.com/2/tweets'
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')
  
  const signatureBase = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(process.env.X_API_SECRET)}&${encodeURIComponent(process.env.X_ACCESS_TOKEN_SECRET)}`
  
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64')
  
  oauthParams.oauth_signature = signature

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`X OAuth ${response.status}: ${err}`)
  }

  return await response.json()
}

// Generate content via Claude API
async function generateContent(type, context = {}) {
  const prompts = {
    'morning-briefing': `You are the social media manager for Stratify (@stratify_hq), an AI-powered stock trading platform. Write a morning market briefing tweet thread (1 main tweet + 3-4 reply tweets).

The main tweet should be punchy, professional, and grab attention. Use emojis sparingly but effectively. Include the most important things traders need to know today.

Format the response as a JSON array of tweet strings. Each tweet must be under 280 characters. The first tweet is the main post, the rest are thread replies.

Include:
- Key overnight futures/index levels
- Major earnings today (if any)
- Economic data releases
- Key technical levels for SPY/QQQ
- One actionable insight

End the thread with: "Follow @stratify_hq for real-time alerts ⚡"

JSON array only, no markdown, no backticks.`,

    'technical-setup': `You are a professional technical analyst posting from @stratify_hq on X. Generate a single high-quality technical trading setup tweet.

Pick ONE specific stock that has a clean, textbook technical setup RIGHT NOW. Choose from well-known, liquid stocks ($NVDA, $TSLA, $AAPL, $AMZN, $META, $MSFT, $AMD, $GOOGL, $SPY, $QQQ, $SOFI, $PLTR, $COIN, $SMCI).

The setup must be one of these patterns:
- Bull flag breakout with entry, stop, target
- Break and retest of key support/resistance
- Double bottom reversal with neckline level
- Ascending triangle with measured move target
- Cup and handle formation
- Golden cross (50 MA crossing above 200 MA)
- VWAP reclaim setup for intraday
- Falling wedge breakout
- Head and shoulders (inverse for bullish)

Format as a JSON object with:
- "tweet": the tweet text (under 280 chars, include $TICKER, entry price, stop loss, target price, R:R ratio)
- "pattern": the pattern name
- "ticker": the stock symbol
- "entry": entry price
- "stop": stop loss price  
- "target": target price
- "rr_ratio": risk/reward ratio as string like "3:1"
- "timeframe": "1D", "4H", "1H", etc.
- "chartUrl": "https://www.tradingview.com/chart/?symbol={TICKER}"

Make the tweet sound confident but not arrogant. Include the risk/reward ratio. Use 1-2 emojis max. End with #trading #stocksetup or similar relevant hashtags.

Example tone: "$NVDA bull flag on the daily. Entry: $875, Stop: $858, Target: $920. 2.6:1 R/R. Volume confirming. This is textbook. 📊 #trading"

JSON object only, no markdown.`,

    'top-movers': `You are posting from @stratify_hq on X. Generate a "Top Pre-Market Movers" tweet.

Create a tweet listing the top 5-6 pre-market movers with percentage moves and brief reason.

Format as JSON object with:
- "tweet": the main tweet (under 280 chars)
- "thread": array of 1-2 follow-up tweets with more detail

Use 📈 for gainers, 📉 for losers. Format like:
"🔥 Pre-Market Movers

📈 $NVDA +4.2% — AI chip demand
📉 $TSLA -2.1% — Delivery miss
📈 $META +3.5% — Ad revenue beat
..."

End with something about Stratify or a call to action.

JSON object only, no markdown.`,

    'market-recap': `You are posting from @stratify_hq on X. Generate an end-of-day market recap thread.

Format as JSON array of 3-4 tweets (thread). Include:
1. Main tweet: Major indices close (SPY, QQQ, DIA) with % changes, overall tone
2. Sector performance and rotation
3. Notable individual stock moves and why
4. What to watch tomorrow + "Follow @stratify_hq" CTA

Each tweet under 280 chars. Professional but engaging tone. Use data and specifics.

JSON array only, no markdown.`,

    'power-hour': `You are posting from @stratify_hq on X. Generate a power hour alert tweet.

It's 3pm EST — the last hour of trading. Call out:
- Stocks making late-day moves
- Key levels being tested on SPY/QQQ
- Any unusual volume or options activity
- Quick actionable setup if there is one

Format as JSON object with "tweet" (under 280 chars). Urgent, exciting tone. This is the most active hour.

JSON object only, no markdown.`,

    'afterhours-movers': `You are posting from @stratify_hq on X. Generate an after-hours movers tweet about earnings reactions.

Focus on companies reporting earnings today. Include:
- Ticker, AH move %, and brief reason (beat/miss, guidance)
- 3-5 tickers

Format as JSON object with:
- "tweet": main tweet under 280 chars
- "thread": optional 1-2 follow-up tweets

JSON object only, no markdown.`,

    'weekend-watchlist': `You are posting from @stratify_hq on X. Generate a weekend watchlist thread.

Pick 5-6 stocks with the best setups heading into next week. For each:
- Ticker, current price area
- Setup type (breakout, pullback, earnings play, etc.)
- Key level to watch

Format as JSON array of 3-4 tweets (thread):
1. "🎯 Weekend Watchlist — [date]" intro with first 2-3 stocks
2. Remaining stocks
3. Summary and risk reminder
4. CTA for Stratify

Each under 280 chars. JSON array only, no markdown.`,
  }

  const systemPrompt = prompts[type]
  if (!systemPrompt) throw new Error(`Unknown content type: ${type}`)

  const anthropicApiKey = getXPostAnthropicKey()
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY_XPOST is missing')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: systemPrompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API ${response.status}: ${body}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text || '[]'
  const clean = content.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { type, action, post } = req.query

  // List available content types
  if (action === 'list') {
    return res.status(200).json({
      contentTypes: CONTENT_TYPES,
      enabled: !X_POST_DISABLED,
      killSwitch: X_POST_KILL_SWITCH,
    })
  }

  if (X_POST_DISABLED) {
    return res.status(503).json({
      error: 'X post generation is disabled by kill switch',
      code: 'X_POST_DISABLED',
      enabled: false,
      killSwitch: X_POST_KILL_SWITCH,
    })
  }

  // Validate type
  if (!type || !CONTENT_TYPES[type]) {
    return res.status(400).json({
      error: `Invalid type. Available: ${Object.keys(CONTENT_TYPES).join(', ')}`,
      contentTypes: CONTENT_TYPES,
    })
  }

  console.log(`[x-post] Generating: ${type}`)

  try {
    // Step 1: Generate content
    const content = await generateContent(type)
    console.log(`[x-post] Generated content for ${type}:`, JSON.stringify(content).slice(0, 200))

    const result = {
      type,
      content,
      generatedAt: new Date().toISOString(),
    }

    // Step 2: Post to X if requested
    if (post === 'true' || post === '1') {
      console.log(`[x-post] Posting to X...`)

      const tweets = Array.isArray(content) ? content : 
                     content.thread ? [content.tweet, ...content.thread] :
                     [content.tweet || JSON.stringify(content)]

      const posted = []
      let lastTweetId = null

      for (const tweet of tweets) {
        try {
          // If it's a thread, reply to the previous tweet
          const body = { text: typeof tweet === 'string' ? tweet : tweet.text || JSON.stringify(tweet) }
          if (lastTweetId) {
            body.reply = { in_reply_to_tweet_id: lastTweetId }
          }

          const xResult = await postToXOAuth(body.text)
          lastTweetId = xResult.data?.id
          posted.push({ text: body.text, id: lastTweetId, status: 'posted' })
          
          // Small delay between thread tweets
          if (tweets.length > 1) {
            await new Promise(r => setTimeout(r, 1000))
          }
        } catch (err) {
          posted.push({ text: typeof tweet === 'string' ? tweet.slice(0, 50) : '...', status: 'failed', error: err.message })
        }
      }

      result.posted = posted
      result.tweetCount = posted.filter(p => p.status === 'posted').length
    }

    // Cache the generated content
    const redis = getRedis()
    if (redis) {
      try {
        const cacheKey = `xpost:${type}:${new Date().toISOString().split('T')[0]}`
        await redis.set(cacheKey, JSON.stringify(result), { ex: 86400 })
      } catch (_) {}
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error(`[x-post] Error:`, err.message)
    return res.status(500).json({
      error: 'Content generation failed',
      details: err.message,
      type,
    })
  }
}
