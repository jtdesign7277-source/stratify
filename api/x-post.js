// api/x-post.js — Agent_X for @stratify_hq
// Real Twelve Data → Claude writes copy → chart image → post to X

import { Redis } from '@upstash/redis'

const TD_KEY   = process.env.TWELVE_DATA_API_KEY
const TODAY    = () => new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
})

const CONTENT_TYPES = {
  'morning-briefing':   { schedule: '8:30am EST',  description: 'Pre-market briefing' },
  'technical-setup':    { schedule: 'multiple/day', description: 'Chart setup with entry/exit — image attached' },
  'alert':              { schedule: 'on demand',    description: '🚨 ALERT — urgent market move' },
  'breaking-news':      { schedule: 'on demand',    description: 'BREAKING: major market event' },
  'top-movers':         { schedule: '10:00am EST',  description: 'Top movers' },
  'power-hour':         { schedule: '3:00pm EST',   description: 'Power hour alert' },
  'market-recap':       { schedule: '4:15pm EST',   description: 'End of day recap' },
  'afterhours-movers':  { schedule: '5:00pm EST',   description: 'AH movers' },
  'weekend-watchlist':  { schedule: 'Sat 10am EST', description: 'Weekend watchlist' },
  'midday-update':      { schedule: '12:30pm EST',  description: 'Midday pulse' },
  'just-in':            { schedule: 'on demand',    description: 'JUST IN — Trump/Iran/Israel market news' },
}

// ── Twelve Data ────────────────────────────────────────────────────────────

async function fetchQuotes(symbols) {
  const sym = Array.isArray(symbols) ? symbols.join(',') : symbols
  const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${TD_KEY}&extended_hours=1`)
  if (!res.ok) throw new Error(`Twelve Data quote failed: ${res.status}`)
  return res.json()
}

async function fetchOHLC(symbol, interval = '1day', outputsize = 30) {
  const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TD_KEY}`)
  if (!res.ok) throw new Error(`Twelve Data OHLC failed: ${res.status}`)
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

// ── QuickChart — generate chart PNG ───────────────────────────────────────

async function generateChartImage(symbol, ohlcData, entry, stop, target) {
  const candles = (ohlcData.values || []).slice(0, 20).reverse()
  if (!candles.length) return null

  const labels = candles.map(c => c.datetime.split(' ')[0])
  const closes = candles.map(c => parseFloat(c.close))
  const highs  = candles.map(c => parseFloat(c.high))
  const lows   = candles.map(c => parseFloat(c.low))

  const lastPrice = closes[closes.length - 1]
  const minPrice  = Math.min(...lows, stop || lastPrice * 0.95)
  const maxPrice  = Math.max(...highs, target || lastPrice * 1.08)
  const padding   = (maxPrice - minPrice) * 0.1

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: symbol,
          data: closes,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        ...(entry ? [{
          label: `Entry $${entry}`,
          data: Array(labels.length).fill(entry),
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderDash: [6, 3],
          pointRadius: 0,
          fill: false,
        }] : []),
        ...(stop ? [{
          label: `Stop $${stop}`,
          data: Array(labels.length).fill(stop),
          borderColor: '#ef4444',
          borderWidth: 1.5,
          borderDash: [6, 3],
          pointRadius: 0,
          fill: false,
        }] : []),
        ...(target ? [{
          label: `Target $${target}`,
          data: Array(labels.length).fill(target),
          borderColor: '#a855f7',
          borderWidth: 1.5,
          borderDash: [6, 3],
          pointRadius: 0,
          fill: false,
        }] : []),
      ]
    },
    options: {
      plugins: {
        legend: {
          labels: { color: '#e2e8f0', font: { size: 12, family: 'monospace' } }
        },
        title: {
          display: true,
          text: `$${symbol} — Technical Setup`,
          color: '#f0f0f5',
          font: { size: 16, weight: 'bold', family: 'monospace' },
          padding: { bottom: 12 }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          min: minPrice - padding,
          max: maxPrice + padding,
          ticks: { color: '#64748b', font: { size: 10, family: 'monospace' }, callback: (v) => `$${v.toFixed(2)}` },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      },
      layout: { padding: 16 }
    }
  }

  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&backgroundColor=%230a0a0f&w=1200&h=630&f=png`

  const res = await fetch(chartUrl)
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

// ── X Media Upload ─────────────────────────────────────────────────────────

async function uploadMediaToX(imageBuffer) {
  const crypto  = await import('crypto')
  const base64  = imageBuffer.toString('base64')

  // Step 1: INIT
  const initRes = await xMediaRequest('POST', 'https://upload.twitter.com/1.1/media/upload.json',
    `command=INIT&total_bytes=${imageBuffer.length}&media_type=image%2Fpng&media_category=tweet_image`, crypto)
  const initData = await initRes.json()
  const mediaId  = initData.media_id_string
  if (!mediaId) throw new Error(`Media INIT failed: ${JSON.stringify(initData)}`)

  // Step 2: APPEND
  const form = new FormData()
  form.append('command', 'APPEND')
  form.append('media_id', mediaId)
  form.append('segment_index', '0')
  form.append('media_data', base64)
  await xMediaFormRequest('POST', 'https://upload.twitter.com/1.1/media/upload.json', form, crypto)

  // Step 3: FINALIZE
  const finalRes = await xMediaRequest('POST', 'https://upload.twitter.com/1.1/media/upload.json',
    `command=FINALIZE&media_id=${mediaId}`, crypto)
  const finalData = await finalRes.json()

  return finalData.media_id_string || mediaId
}

async function xMediaRequest(method, url, body, crypto) {
  const oauthParams = buildOAuth(method, url, {}, crypto)
  return fetch(url, {
    method,
    headers: {
      'Authorization': oauthHeader(oauthParams),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
}

async function xMediaFormRequest(method, url, form, crypto) {
  const oauthParams = buildOAuth(method, url, {}, crypto)
  return fetch(url, {
    method,
    headers: { 'Authorization': oauthHeader(oauthParams) },
    body: form,
  })
}

function buildOAuth(method, url, extraParams, crypto) {
  const params = {
    oauth_consumer_key:     process.env.X_API_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_token:            process.env.X_ACCESS_TOKEN,
    oauth_version:          '1.0',
    ...extraParams,
  }
  const allParams = { ...params, ...extraParams }
  const paramString = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`).join('&')
  const base = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
  const key  = `${encodeURIComponent(process.env.X_API_SECRET)}&${encodeURIComponent(process.env.X_ACCESS_TOKEN_SECRET)}`
  params.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64')
  return params
}

function oauthHeader(params) {
  return 'OAuth ' + Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(', ')
}

// ── Post tweet (with optional media) ──────────────────────────────────────

async function postTweet(text, mediaId = null) {
  const crypto = await import('crypto')
  const url    = 'https://api.x.com/2/tweets'
  const params = buildOAuth('POST', url, {}, crypto)
  const body   = { text }
  if (mediaId) body.media = { media_ids: [mediaId] }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': oauthHeader(params),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`X post failed ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Claude ─────────────────────────────────────────────────────────────────

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
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ── Content generators ─────────────────────────────────────────────────────

async function generateContent(type) {
  const date = TODAY()

  // ── TECHNICAL SETUP (with chart) ─────────────────────────────────────────
  if (type === 'technical-setup') {
    const symbols  = ['NVDA','TSLA','AAPL','AMZN','META','MSFT','AMD','GOOGL','SPY','QQQ']
    const quotes   = await fetchQuotes(symbols)
    const lines    = symbols.map(s => {
      const q = fmtQuote(quotes[s])
      return q ? `${q.symbol}: $${q.price.toFixed(2)} (${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%)` : null
    }).filter(Boolean).join('\n')

    const setup = await claude(`You are a professional technical analyst for @stratify_hq.

TODAY IS: ${date}

REAL PRICE DATA — use ONLY these prices:
${lines}

Pick the stock with the cleanest setup. Write a professional technical setup tweet.

Requirements:
- Entry must be within 0.5% of the real current price above
- Stop: ~2-3% from entry (tight, professional)
- Target: ~6-10% from entry (realistic)
- Calculate R:R ratio
- Pattern: one of — bull flag, breakout, pullback to support, VWAP reclaim, golden cross, wedge breakout
- Tweet: under 270 chars, starts with $TICKER
- Tone: sharp, confident, like a pro trader. No fluff.
- End with 1-2 hashtags: #trading #stocks

Respond with JSON only:
{"tweet":"...","ticker":"...","entry":0.00,"stop":0.00,"target":0.00,"rr":"X:1","pattern":"..."}`)

    return { ...setup, hasChart: true }
  }

  // ── 🚨 ALERT ──────────────────────────────────────────────────────────────
  if (type === 'alert') {
    const [quotes, movers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ']),
      fetchMovers('gainers', 5),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)

    return claude(`You are posting an urgent alert from @stratify_hq.

TODAY IS: ${date}

REAL MARKET DATA:
${spy?.label}
${qqq?.label}

TOP MOVERS:
${fmtMovers(movers)}

Write 1 urgent alert tweet. 

RULES:
- MUST start with: 🚨 ALERT:
- Use only the real data above
- Urgent tone, makes people stop scrolling
- Under 280 chars
- No invented data

Respond with JSON: {"tweet":"..."} No markdown.`)
  }

  // ── BREAKING NEWS ─────────────────────────────────────────────────────────
  if (type === 'breaking-news') {
    const [quotes, gainers, losers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ', 'DIA']),
      fetchMovers('gainers', 5),
      fetchMovers('losers', 3),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    const dia = fmtQuote(quotes.DIA)

    return claude(`You are posting a breaking news update from @stratify_hq.

TODAY IS: ${date}

REAL MARKET DATA:
${spy?.label}
${qqq?.label}
${dia?.label}

TOP MOVERS:
GAINERS: ${fmtMovers(gainers)}
LOSERS: ${fmtMovers(losers)}

Write 1 breaking news tweet + 1 follow-up reply using ONLY the real data above.

RULES:
- Main tweet MUST start with: BREAKING:
- Pick the most significant real move from the data
- Urgent, newsroom energy
- Main tweet under 270 chars

Respond with JSON: {"tweet":"...","thread":["..."]} No markdown.`)
  }

  // ── MORNING BRIEFING ──────────────────────────────────────────────────────
  if (type === 'morning-briefing') {
    const [quotes, gainers, losers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ', 'DIA']),
      fetchMovers('gainers', 6),
      fetchMovers('losers', 4),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    const dia = fmtQuote(quotes.DIA)

    return claude(`You are the social media voice of @stratify_hq.

TODAY IS: ${date}

REAL MARKET DATA:
${spy?.label}
${qqq?.label}
${dia?.label}

TOP GAINERS: ${fmtMovers(gainers)}
TOP LOSERS: ${fmtMovers(losers)}

Write a morning briefing thread: 1 main tweet + 2-3 replies.
- Use ONLY real data above. Never invent prices.
- Main tweet: punchy, under 280 chars
- Last reply: "Follow @stratify_hq for real-time alerts ⚡"
- Sharp, witty, dry humor. No fluff.

Respond with JSON array of tweet strings. No markdown.`)
  }

  // ── TOP MOVERS ────────────────────────────────────────────────────────────
  if (type === 'top-movers') {
    const [gainers, losers] = await Promise.all([fetchMovers('gainers', 5), fetchMovers('losers', 3)])
    return claude(`You are posting from @stratify_hq.

TODAY IS: ${date}

REAL TOP MOVERS:
GAINERS: ${fmtMovers(gainers)}
LOSERS: ${fmtMovers(losers)}

Write a top movers tweet using ONLY this data. Under 280 chars.
Format: emoji $TICKER +/-X.X%

Respond with JSON: {"tweet":"...","thread":[]} No markdown.`)
  }

  // ── MARKET RECAP ─────────────────────────────────────────────────────────
  if (type === 'market-recap') {
    const [quotes, gainers, losers] = await Promise.all([
      fetchQuotes(['SPY', 'QQQ', 'DIA']),
      fetchMovers('gainers', 5),
      fetchMovers('losers', 3),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    const dia = fmtQuote(quotes.DIA)
    return claude(`You are posting end-of-day recap from @stratify_hq.

TODAY IS: ${date}

REAL CLOSING DATA:
${spy?.label}
${qqq?.label}
${dia?.label}

MOVERS:
${fmtMovers(gainers)}
${fmtMovers(losers)}

Write a recap thread: 1 main + 2 replies. ONLY real data. Each under 280 chars.
Last reply ends: "Follow @stratify_hq ⚡"

JSON array of tweet strings. No markdown.`)
  }

  // ── POWER HOUR ───────────────────────────────────────────────────────────
  if (type === 'power-hour') {
    const [quotes, movers] = await Promise.all([fetchQuotes(['SPY','QQQ']), fetchMovers('gainers', 5)])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    return claude(`Power hour alert from @stratify_hq. 3:00 PM EST.

TODAY: ${date}
${spy?.label}
${qqq?.label}
${fmtMovers(movers)}

1 urgent tweet using ONLY real data. Final hour energy.

JSON: {"tweet":"..."} No markdown.`)
  }

  // ── AFTERHOURS ───────────────────────────────────────────────────────────
  if (type === 'afterhours-movers') {
    const [quotes, gainers, losers] = await Promise.all([
      fetchQuotes(['SPY','QQQ']),
      fetchMovers('gainers', 5),
      fetchMovers('losers', 3),
    ])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    return claude(`After-hours update from @stratify_hq.

TODAY: ${date}
${spy?.label}
${qqq?.label}
GAINERS: ${fmtMovers(gainers)}
LOSERS: ${fmtMovers(losers)}

After-hours tweet, ONLY real data. Under 280 chars.

JSON: {"tweet":"...","thread":[]} No markdown.`)
  }

  // ── WEEKEND WATCHLIST ─────────────────────────────────────────────────────
  if (type === 'weekend-watchlist') {
    const symbols = ['SPY','QQQ','NVDA','TSLA','AAPL','AMZN','META','MSFT','AMD','GOOGL']
    const quotes  = await fetchQuotes(symbols)
    const lines   = symbols.map(s => { const q = fmtQuote(quotes[s]); return q ? q.label : null }).filter(Boolean).join('\n')
    return claude(`Weekend watchlist from @stratify_hq.

TODAY: ${date}

REAL PRICES:
${lines}

3-tweet thread, 5-6 stocks, setups for next week using ONLY real prices above.
Last tweet: risk reminder + "Follow @stratify_hq ⚡"

JSON array of 3 tweet strings. No markdown.`)
  }

  // ── MIDDAY ───────────────────────────────────────────────────────────────
  if (type === 'midday-update') {
    const [quotes, movers] = await Promise.all([fetchQuotes(['SPY','QQQ']), fetchMovers('gainers', 4)])
    const spy = fmtQuote(quotes.SPY)
    const qqq = fmtQuote(quotes.QQQ)
    return claude(`Midday update from @stratify_hq. 12:30 PM EST.

TODAY: ${date}
${spy?.label}
${qqq?.label}
${fmtMovers(movers)}

1 calm, professional midday pulse tweet. ONLY real data. Under 280 chars.

JSON: {"tweet":"..."} No markdown.`)
  }


  // ── JUST IN (Trump / Iran / Israel / Geopolitical) ────────────────────────
  if (type === 'just-in') {
    // Step 1: Fetch Trump's recent tweets via X API
    const trumpId = '25073877' // @realDonaldTrump user ID
    const tweetsRes = await fetch(
      `https://api.x.com/2/users/${trumpId}/tweets?max_results=10&tweet.fields=created_at,text&exclude=retweets,replies`,
      { headers: { 'Authorization': `Bearer ${process.env.X_BEARER_TOKEN}` } }
    )
    const tweetsData = await tweetsRes.json()
    const recentTweets = (tweetsData.data || []).map(t => t.text).join('\n---\n')

    // Step 2: Fetch live market news via MarketAux for context
    let newsContext = ''
    try {
      const newsRes = await fetch(
        `https://api.marketaux.com/v1/news/all?topics=politics,war,geopolitics&filter_entities=true&language=en&limit=5&api_token=${process.env.MARKETAUX_API_KEY}`
      )
      const newsData = await newsRes.json()
      const headlines = (newsData.data || []).map(n => `- ${n.title}`).join('\n')
      newsContext = `\n\nLATEST MARKET NEWS HEADLINES:\n${headlines}`
    } catch(_) {}

    // Step 3: Use Grok (xAI) to analyze and rewrite
    const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are Agent_X for @stratify_hq — a market intelligence bot that monitors geopolitical events and posts market-moving news.

TODAY IS: ${date}

TRUMP'S RECENT POSTS:
${recentTweets || 'No recent posts available'}${newsContext}

Your job:
1. Identify if any Trump post is market-moving (tariffs, Iran, Israel, war, sanctions, Fed, economy, major policy)
2. If YES — rewrite it as a sharp, professional market alert tweet
3. If NO significant post — respond with {"skip": true}

TWEET FORMAT RULES:
- Start with: JUST IN 🇺🇸
- If about IRAN: add 🇮🇷 after the flags — "JUST IN 🇺🇸🇮🇷"
- If about ISRAEL: add 🇮🇱 after the flags — "JUST IN 🇺🇸🇮🇱"
- If about tariffs/trade/China: add 🇨🇳 — "JUST IN 🇺🇸🇨🇳"
- If about Russia/Ukraine: add 🇷🇺 — "JUST IN 🇺🇸🇷🇺"
- Then: bold headline rewrite (factual, no spin)
- Then: 1 line on potential market impact (which sectors, which tickers)
- End: "Watch: $SPY $QQQ" or relevant tickers
- Under 280 chars total
- Do NOT fabricate quotes or events — only use what Trump actually posted

Respond with JSON only:
{"tweet":"...","skip":false,"topic":"iran|israel|tariffs|economy|other","marketImpact":"brief note"}

If nothing is market-moving: {"skip":true}`
        }]
      })
    })

    if (!grokRes.ok) throw new Error(`xAI API ${grokRes.status}: ${await grokRes.text()}`)
    const grokData = await grokRes.json()
    const grokText = grokData.choices?.[0]?.message?.content || '{}'
    const parsed   = JSON.parse(grokText.replace(/```json|```/g, '').trim())

    if (parsed.skip) {
      return { skip: true, reason: 'No market-moving Trump posts found', type }
    }

    return parsed
  }

  throw new Error(`Unknown type: ${type}`)
}

// ── Redis ─────────────────────────────────────────────────────────────────

function getRedis() {
  const url   = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// ── Handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { type, action, post } = req.query

  if (action === 'list') return res.status(200).json({ contentTypes: CONTENT_TYPES })

  if (!type || !CONTENT_TYPES[type]) {
    return res.status(400).json({ error: `Invalid type. Available: ${Object.keys(CONTENT_TYPES).join(', ')}` })
  }

  console.log(`[Agent_X] ${type} | ${TODAY()}`)

  try {
    const content = await generateContent(type)
    const result  = { type, content, generatedAt: new Date().toISOString() }

    if (post === 'true' || post === '1') {
      const tweets = Array.isArray(content)
        ? content
        : content.thread?.length
          ? [content.tweet, ...content.thread]
          : [content.tweet || JSON.stringify(content)]

      // Generate and upload chart image for technical-setup
      let mediaId = null
      if (type === 'technical-setup' && content.ticker) {
        try {
          console.log(`[Agent_X] Generating chart for $${content.ticker}`)
          const ohlc  = await fetchOHLC(content.ticker, '1day', 30)
          const imgBuf = await generateChartImage(content.ticker, ohlc, content.entry, content.stop, content.target)
          if (imgBuf) {
            mediaId = await uploadMediaToX(imgBuf)
            console.log(`[Agent_X] Chart uploaded, mediaId: ${mediaId}`)
          }
        } catch (chartErr) {
          console.warn(`[Agent_X] Chart generation failed (posting without image):`, chartErr.message)
        }
      }

      const posted = []
      let lastId   = null

      for (let i = 0; i < tweets.length; i++) {
        try {
          const text   = typeof tweets[i] === 'string' ? tweets[i] : JSON.stringify(tweets[i])
          // Attach chart to first tweet only
          const mid    = i === 0 && mediaId ? mediaId : null
          const xResult = await postTweet(text, mid)
          lastId = xResult.data?.id
          posted.push({ text, id: lastId, status: 'posted', hasImage: i === 0 && !!mid })
          if (tweets.length > 1) await new Promise(r => setTimeout(r, 1500))
        } catch (err) {
          posted.push({ status: 'failed', error: err.message })
        }
      }

      result.posted     = posted
      result.tweetCount = posted.filter(p => p.status === 'posted').length
    }

    // Cache
    try {
      const redis = getRedis()
      if (redis) await redis.set(`xpost:${type}:${new Date().toISOString().split('T')[0]}`, JSON.stringify(result), { ex: 86400 })
    } catch (_) {}

    return res.status(200).json(result)
  } catch (err) {
    console.error(`[Agent_X] Error:`, err.message)
    return res.status(500).json({ error: err.message, type })
  }
}
