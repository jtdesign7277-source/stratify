// api/feeds.js — News feed endpoint powered by Marketaux API
// Cache-first with Redis (Upstash) — 4-hour TTL

import { Redis } from '@upstash/redis'

const CACHE_TTL = 14400 // 4 hours

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

// Map each feed to Marketaux API query parameters
const FEED_PARAMS = {
  // Market Pulse
  Earnings:     { search: 'earnings report beat miss guidance' },
  Momentum:     { search: 'stock momentum breakout surge rally' },
  Macro:        { search: 'federal reserve inflation GDP interest rate economic' },
  Options:      { search: 'options activity unusual volume calls puts' },
  Sentiment:    { search: 'market sentiment fear greed VIX indicator' },
  PreMarket:    { search: 'premarket movers gap up gap down futures' },
  AfterHours:   { search: 'after hours trading earnings movers' },
  Sectors:      { search: 'sector rotation performance energy tech healthcare' },
  Indices:      { search: 'S&P 500 Nasdaq Dow Jones index market' },
  Volume:       { search: 'unusual volume dark pool block trade' },
  // Hot & Trending
  Trending:     { sort: 'entity_match_score', search: 'stock market trending' },
  MemeStocks:   { symbols: 'GME,AMC,BB,PLTR,SOFI' },
  Runners:      { search: 'stock runner surge 10 percent breakout catalyst' },
  Squeezes:     { search: 'short squeeze short interest covering rally' },
  IPOs:         { search: 'IPO initial public offering listing debut' },
  SPACs:        { search: 'SPAC merger acquisition deal blank check' },
  PennyStocks:  { search: 'penny stock small cap micro cap low price' },
  Breakouts:    { search: 'breakout resistance technical level all time high' },
  // Tech & Innovation
  BigTech:      { symbols: 'AAPL,MSFT,GOOGL,META,AMZN' },
  AI:           { search: 'artificial intelligence AI stocks NVDA chip GPU' },
  Semis:        { symbols: 'NVDA,AMD,INTC,TSM,AVGO' },
  EVs:          { symbols: 'TSLA,RIVN,LCID,NIO,LI' },
  Fintech:      { symbols: 'SOFI,HOOD,SQ,PYPL' },
  Biotech:      { search: 'biotech FDA approval clinical trial drug pipeline' },
  SpaceTech:    { search: 'space rocket satellite SpaceX Rocket Lab launch' },
  // Macro & Politics
  FedWatch:     { search: 'Federal Reserve FOMC rate decision Powell' },
  Trump:        { search: 'Trump tariff policy executive order market' },
  ElonMusk:     { search: 'Elon Musk Tesla SpaceX DOGE xAI' },
  Politics:     { search: 'politics regulation legislation government market' },
  Tariffs:      { search: 'tariff trade war import export duty' },
  Bonds:        { search: 'treasury bond yield interest rate TLT' },
  Commodities:  { search: 'gold oil copper commodity prices' },
  Forex:        { search: 'forex currency dollar euro yen exchange rate' },
  Housing:      { search: 'housing market mortgage rate home sales REIT' },
  Jobs:         { search: 'jobs employment payroll unemployment hiring' },
  // Crypto
  Bitcoin:      { search: 'bitcoin BTC crypto price ETF' },
  Ethereum:     { search: 'ethereum ETH crypto DeFi layer 2' },
  Altcoins:     { search: 'altcoin solana XRP dogecoin cardano crypto' },
  DeFi:         { search: 'DeFi decentralized finance yield staking TVL' },
  CryptoNews:   { search: 'cryptocurrency regulation exchange adoption' },
  // Strategy & Education
  TechnicalAnalysis: { search: 'technical analysis chart pattern support resistance' },
  Fundamentals:      { search: 'fundamental analysis valuation earnings PE ratio' },
  DayTrading:        { search: 'day trading scalp VWAP opening range' },
  SwingTrades:       { search: 'swing trade pullback entry setup multi day' },
  Dividends:         { search: 'dividend yield ex-dividend aristocrat income' },
  RiskManagement:    { search: 'risk management stop loss position sizing hedge' },
  // Culture & Vibes
  LossPorn:     { search: 'trading loss portfolio crash mistake lesson' },
  GainPorn:     { search: 'trading win profit gain rally return' },
  TradingMemes: { search: 'stock market meme Wall Street humor trading' },
  HotTakes:     { search: 'market prediction forecast bold opinion controversial' },
}

// Default category assignment based on feed name
const FEED_DEFAULT_CATEGORY = {
  Earnings: 'EARNINGS', AfterHours: 'EARNINGS',
  FedWatch: 'REGULATORY', Politics: 'REGULATORY', Tariffs: 'REGULATORY',
  TechnicalAnalysis: 'ANALYSIS', Fundamentals: 'ANALYSIS', Breakouts: 'ANALYSIS',
  SwingTrades: 'ANALYSIS', DayTrading: 'ANALYSIS', RiskManagement: 'ANALYSIS',
  Sentiment: 'DATA', Volume: 'DATA', Indices: 'DATA',
  PreMarket: 'ALERT', Squeezes: 'ALERT', Runners: 'ALERT',
}

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error(`Missing Redis env vars — url: ${!!url}, token: ${!!token}`)
  return new Redis({ url, token })
}

// Strip HTML tags from text
function stripHtml(text) {
  if (!text) return ''
  return text.replace(/<\/?[^>]+(>|$)/g, '').trim()
}

// Convert published_at (ISO string) to relative time
function relativeTime(publishedAt) {
  if (!publishedAt) return ''
  try {
    const now = Date.now()
    const then = new Date(publishedAt).getTime()
    const diffMs = now - then
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
    return `${Math.floor(diffDay / 30)}mo ago`
  } catch (_) {
    return ''
  }
}

// Derive sentiment from entity sentiment scores
function deriveSentiment(entities) {
  if (!entities || entities.length === 0) return 'neutral'
  const scores = entities
    .map(e => e.sentiment_score)
    .filter(s => typeof s === 'number')
  if (scores.length === 0) return 'neutral'
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  if (avg > 0.3) return 'bullish'
  if (avg < -0.3) return 'bearish'
  return 'neutral'
}

// Extract tickers from entities
function extractTickers(entities) {
  if (!entities || entities.length === 0) return []
  return entities
    .filter(e => e.symbol && e.symbol.length <= 5)
    .map(e => `$${e.symbol}`)
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
    .slice(0, 6)
}

// Determine category from article content/feed
function categorize(article, feedName) {
  const defaultCat = FEED_DEFAULT_CATEGORY[feedName] || 'NEWS'
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase()

  if (text.match(/earn|revenue|eps|guidance|beat|miss|quarter|q[1-4]/)) return 'EARNINGS'
  if (text.match(/fda|regulat|sec |antitrust|legislation|policy|law/)) return 'REGULATORY'
  if (text.match(/alert|warning|crash|halt|circuit breaker|emergency/)) return 'ALERT'
  if (text.match(/data|report|survey|index|statistic|numbers|payroll/)) return 'DATA'
  if (text.match(/analysis|forecast|outlook|predict|estimate|valuation/)) return 'ANALYSIS'

  return defaultCat
}

// Transform Marketaux article to our feed item format
function transformArticle(article, feedName) {
  const entities = article.entities || []
  const tickers = extractTickers(entities)

  return {
    title: stripHtml(article.title || '').slice(0, 100),
    summary: stripHtml(article.description || '').slice(0, 200),
    source: article.source || 'Unknown',
    url: article.url || null,
    image: (article.image_url && article.image_url.startsWith('http')) ? article.image_url : null,
    ticker: tickers.length > 0 ? tickers[0] : null,
    tickers,
    sentiment: deriveSentiment(entities),
    time: relativeTime(article.published_at),
    category: categorize(article, feedName),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { feed, action, flush } = req.query

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

  // Redis cache
  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('[feeds] Redis init failed:', err.message)
  }

  const cacheKey = `feed:v3:${feed.toLowerCase()}`

  // Flush cache if requested
  if (flush === 'true' && redis) {
    try {
      await redis.del(cacheKey)
      console.log(`[feeds] Cache FLUSHED for #${feed}`)
    } catch (err) {
      console.error('[feeds] Redis DEL failed:', err.message)
    }
  }

  if (redis && flush !== 'true') {
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

  // Fetch from Marketaux API
  const apiKey = process.env.MARKETAUX_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'MARKETAUX_API_KEY not configured', feed, items: [] })
  }

  const feedParams = FEED_PARAMS[feed] || { search: feed }

  try {
    const params = new URLSearchParams({
      api_token: apiKey,
      language: 'en',
      limit: '15',
    })

    if (feedParams.search) params.set('search', feedParams.search)
    if (feedParams.symbols) params.set('symbols', feedParams.symbols)
    if (feedParams.sort) params.set('sort', feedParams.sort)

    // Get articles from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    params.set('published_after', sevenDaysAgo)

    const url = `https://api.marketaux.com/v1/news/all?${params.toString()}`
    console.log(`[feeds] Fetching Marketaux for #${feed}...`)

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(`[feeds] Marketaux ${response.status}:`, body.substring(0, 300))
      throw new Error(`Marketaux API ${response.status}`)
    }

    const data = await response.json()
    const articles = data.data || []

    console.log(`[feeds] Marketaux raw: ${articles.length} articles for #${feed}`)
    if (articles.length === 0 && data.error) {
      console.error(`[feeds] Marketaux error:`, JSON.stringify(data.error).substring(0, 300))
    }

    // Transform to our format
    const items = articles
      .map(a => transformArticle(a, feed))
      .filter(item => item.title && item.title.length > 10)

    const result = {
      feed,
      items,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
    }

    // Cache the result
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
      feed,
      items: [],
    })
  }
}
