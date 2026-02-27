// api/feeds.js — Real news feed endpoint (Vercel serverless)
// Uses Claude API with web_search tool to pull actual current news
// Cache-first with Redis (Upstash) — 7-day TTL

import { Redis } from '@upstash/redis'

const CACHE_TTL = 604800 // 7 days

const FEED_CATEGORIES = {
  'Market Pulse': [
    'Earnings', 'Momentum', 'Macro', 'Options', 'Sentiment',
    'PreMarket', 'AfterHours', 'Sectors', 'Indices', 'Volume'
  ],
  'Hot & Trending': [
    'Trending', 'MemeStocks', 'Runners', 'Squeezes', 'IPOs',
    'SPACs', 'PennyStocks', 'Breakouts'
  ],
  'Tech & Innovation': [
    'BigTech', 'AI', 'Semis', 'EVs', 'Fintech', 'Biotech', 'SpaceTech'
  ],
  'Macro & Politics': [
    'FedWatch', 'Trump', 'ElonMusk', 'Politics', 'Tariffs',
    'Bonds', 'Commodities', 'Forex', 'Housing', 'Jobs'
  ],
  'Crypto': [
    'Bitcoin', 'Ethereum', 'Altcoins', 'DeFi', 'CryptoNews'
  ],
  'Strategy & Education': [
    'TechnicalAnalysis', 'Fundamentals', 'DayTrading',
    'SwingTrades', 'Dividends', 'RiskManagement'
  ],
  'Culture & Vibes': [
    'LossPorn', 'GainPorn', 'TradingMemes', 'HotTakes'
  ],
}

const ALL_FEEDS = Object.values(FEED_CATEGORIES).flat()

const FEED_PROMPTS = {
  Earnings:          'Recent and upcoming earnings reports, beats, misses, and guidance updates for major companies.',
  Momentum:          'Stocks showing strong directional momentum today — big movers, trend continuations, unusual strength or weakness.',
  Macro:             'Federal Reserve updates, interest rate expectations, inflation data, GDP, jobs reports, and macroeconomic news.',
  Options:           'Unusual options activity, large sweeps, notable flow, put/call ratio changes, and options strategy ideas.',
  Sentiment:         'Market sentiment indicators — VIX movement, fear/greed index, put/call ratios, retail vs institutional flow.',
  PreMarket:         'Pre-market movers, gap ups and gap downs, overnight catalysts, and early morning trade setups.',
  AfterHours:        'After-hours earnings movers, post-close news catalysts, and AH volume spikes.',
  Sectors:           'Sector rotation updates, relative strength between sectors, and sector-specific catalysts.',
  Indices:           'S&P 500, Nasdaq, Dow Jones, Russell 2000 analysis — key levels, trends, and market structure.',
  Volume:            'Unusual volume alerts, dark pool prints, block trades, and volume-based signals.',
  Trending:          'The most talked-about and actively traded tickers across social media and trading platforms right now.',
  MemeStocks:        'Meme stock activity — GME, AMC, and other retail-favorite stocks. Short squeeze potential, Reddit/WSB sentiment.',
  Runners:           'Stocks running 10%+ intraday, momentum plays, and multi-day runners with catalysts.',
  Squeezes:          'Short squeeze setups — high short interest stocks, rising borrow costs, and covering signals.',
  IPOs:              'Recent and upcoming IPOs, first-day performance, lockup expirations, and new listing analysis.',
  SPACs:             'SPAC deals, definitive agreement announcements, redemption rates, and post-merger performance.',
  PennyStocks:       'Sub-$5 stock movers, small cap runners, and micro-cap catalysts. High risk/reward setups.',
  Breakouts:         'Stocks breaking out of key technical levels — resistance breaks, range expansions, and volume confirmations.',
  BigTech:           'Apple, Microsoft, Google, Meta, Amazon news — product launches, earnings, regulatory, and market moves.',
  AI:                'Artificial intelligence stocks and news — NVDA, AI chip demand, model releases, enterprise AI adoption.',
  Semis:             'Semiconductor industry updates — chip stocks, fab capacity, export controls, SOX index movement.',
  EVs:               'Electric vehicle stocks — Tesla, Rivian, Lucid, BYD, charging infrastructure, EV sales data.',
  Fintech:           'Fintech stocks and news — SoFi, Robinhood, Block, PayPal, digital banking, payments innovation.',
  Biotech:           'Biotech catalysts — FDA approvals, clinical trial results, drug pipeline updates, M&A activity.',
  SpaceTech:         'Space industry stocks — SpaceX updates, Rocket Lab, satellite companies, defense/space contracts.',
  FedWatch:          'Federal Reserve watch — FOMC decisions, dot plot analysis, Fed speaker commentary, rate probabilities.',
  Trump:             'Trump-related market moves — policy announcements, tariffs, deregulation, Truth Social, and political trades.',
  ElonMusk:          'Elon Musk updates — Tesla, SpaceX, X/Twitter, xAI, Neuralink, DOGE government, and market impact.',
  Politics:          'Political news affecting markets — elections, legislation, regulatory changes, government spending.',
  Tariffs:           'Trade war updates — tariff announcements, import/export data, supply chain disruptions, trade deals.',
  Bonds:             'Bond market updates — Treasury yields, TLT, credit spreads, duration risk, and fixed income analysis.',
  Commodities:       'Commodity markets — gold, oil, copper, natural gas, agriculture, and supply/demand dynamics.',
  Forex:             'Currency markets — DXY (dollar index), EUR/USD, USD/JPY, emerging market currencies, central bank moves.',
  Housing:           'Housing market — mortgage rates, home sales data, REITs, homebuilder stocks, housing affordability.',
  Jobs:              'Employment data — non-farm payrolls, unemployment rate, jobless claims, hiring trends, wage growth.',
  Bitcoin:           'Bitcoin news and analysis — BTC price action, ETF flows, halving cycle, institutional adoption, on-chain data.',
  Ethereum:          'Ethereum updates — ETH price, Layer 2 growth, staking yields, protocol upgrades, DeFi ecosystem.',
  Altcoins:          'Altcoin movers — SOL, XRP, DOGE, ADA, AVAX, LINK and other top altcoin catalysts and price action.',
  DeFi:              'Decentralized finance — yield farming, protocol TVL, DEX volume, lending rates, DeFi governance.',
  CryptoNews:        'Crypto industry news — regulation, exchange updates, adoption milestones, institutional moves.',
  TechnicalAnalysis: 'Technical analysis setups — chart patterns, indicator signals, support/resistance levels, trend analysis.',
  Fundamentals:      'Fundamental analysis — valuation metrics, earnings quality, balance sheet strength, DCF models.',
  DayTrading:        'Day trading setups — scalp plays, tape reading signals, Level 2 action, VWAP plays, opening range.',
  SwingTrades:       'Swing trade ideas — multi-day setups, pullback entries, trend continuation plays, risk/reward analysis.',
  Dividends:         'Dividend stocks — high yield plays, ex-dividend dates, dividend aristocrats, income strategies.',
  RiskManagement:    'Risk management insights — position sizing, stop loss strategies, portfolio hedging, drawdown analysis.',
  LossPorn:          'Spectacular trading losses and what we can learn from them. Risk management lessons the hard way.',
  GainPorn:          'Monster trading wins — life-changing trades, big percentage gains, well-executed strategies.',
  TradingMemes:      'Trading humor — market memes, trader life jokes, Wall Street comedy, and financial satire.',
  HotTakes:          'Controversial market opinions and bold predictions. Agree or disagree — the spiciest takes on the market.',
}

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error(`Missing Redis env vars — url: ${!!url}, token: ${!!token}`)
  return new Redis({ url, token })
}

// Extract text blocks from Claude's web_search response
function extractTextFromResponse(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { feed, action } = req.query

  // Action: list — return all feeds with categories
  if (action === 'list') {
    return res.status(200).json({
      categories: FEED_CATEGORIES,
      allFeeds: ALL_FEEDS,
      total: ALL_FEEDS.length,
    })
  }

  // Validate feed name
  if (!feed || !ALL_FEEDS.includes(feed)) {
    return res.status(400).json({
      error: `Invalid feed. Use ?action=list to see all ${ALL_FEEDS.length} available feeds.`,
      validFeeds: ALL_FEEDS,
    })
  }

  console.log(`[feeds] Requested: #${feed}`)

  // Step 1: Redis cache check
  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('[feeds] Redis init failed:', err.message)
  }

  const cacheKey = `feed:v2:${feed.toLowerCase()}`

  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log(`[feeds] Cache HIT for #${feed}`)
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached
        return res.status(200).json({ ...data, source: 'cache', cacheHit: true })
      }
      console.log(`[feeds] Cache MISS for #${feed}`)
    } catch (err) {
      console.error('[feeds] Redis GET failed:', err.message)
    }
  }

  // Step 2: Call Claude API with web_search tool for real news
  const topicPrompt = FEED_PROMPTS[feed] || `Trending content about ${feed} in the stock market.`

  try {
    console.log(`[feeds] Calling Claude API with web_search for #${feed}...`)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search the web for the latest real news about: ${topicPrompt}

Find 8-12 current, real news stories from the past few days. Use web search to find actual articles.

After searching, return ONLY a valid JSON array (no markdown, no backticks, no explanation before or after). Each item must have:
- "title": real headline (max 80 chars)
- "summary": 1-2 sentence summary of the actual article (max 120 chars)
- "source": real source name (e.g. "Reuters", "Bloomberg", "CNBC", "WSJ", "Yahoo Finance", "MarketWatch")
- "url": the actual URL of the article (or null if unavailable)
- "ticker": primary relevant ticker with $ prefix (e.g. "$NVDA") or null
- "tickers": array of all relevant tickers mentioned (e.g. ["$NVDA", "$AMD", "$TSM"])
- "sentiment": "bullish", "bearish", or "neutral"
- "time": relative time like "2h ago", "5h ago", "1d ago", "2d ago"
- "category": one of "NEWS", "ANALYSIS", "DATA", "ALERT", "EARNINGS", "REGULATORY"

Return real news only. No fabricated stories. JSON array only.`
        }],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(`[feeds] Claude API ${response.status}:`, body)
      throw new Error(`Claude API ${response.status}: ${body}`)
    }

    const data = await response.json()

    // web_search responses have multiple content blocks (search results + text)
    // Extract only text blocks and parse the JSON from them
    const textContent = extractTextFromResponse(data.content)
    console.log(`[feeds] Raw response (first 300 chars):`, textContent.substring(0, 300))

    const clean = textContent.replace(/```json|```/g, '').trim()

    // Find the JSON array in the text — it might have surrounding text
    const jsonMatch = clean.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in Claude response')
    }

    const items = JSON.parse(jsonMatch[0])
    console.log(`[feeds] Parsed ${items.length} news items for #${feed}`)

    const result = {
      feed,
      items,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
    }

    // Step 3: Cache the result
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL })
        console.log(`[feeds] Cached #${feed} with ${CACHE_TTL}s TTL`)
      } catch (err) {
        console.error('[feeds] Redis SET failed:', err.message)
      }
    }

    return res.status(200).json({ ...result, source: 'api', cacheHit: false })
  } catch (err) {
    console.error(`[feeds] Error fetching #${feed}:`, err.message)

    // Try stale cache
    if (redis) {
      try {
        const stale = await redis.get(cacheKey)
        if (stale) {
          const data = typeof stale === 'string' ? JSON.parse(stale) : stale
          return res.status(200).json({ ...data, source: 'stale-cache', cacheHit: true })
        }
      } catch (_) {}
    }

    return res.status(500).json({
      error: 'Failed to fetch feed',
      details: err.message,
      step: 'claude-web-search',
      feed,
      items: [],
    })
  }
}
