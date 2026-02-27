// api/article.js — Article reader endpoint (Vercel serverless)
// Fetches a URL, extracts article content, caches in Redis for 7 days

import { Redis } from '@upstash/redis'
import { parse } from 'node-html-parser'

const CACHE_TTL = 604800 // 7 days

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// Selectors to remove before extracting text
const REMOVE_SELECTORS = [
  'script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer',
  'header', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.ad', '.ads', '.advertisement', '.social-share', '.share-buttons',
  '.newsletter', '.signup', '.popup', '.modal', '.sidebar', '.related',
  '.comments', '.comment', '#comments', '.cookie', '.consent',
  '[data-ad]', '[data-testid="ad"]', '.promo', '.sponsor',
]

// Extract the best article body from parsed HTML
function extractArticleContent(root) {
  // Remove junk elements
  for (const sel of REMOVE_SELECTORS) {
    try {
      root.querySelectorAll(sel).forEach(el => el.remove())
    } catch (_) {}
  }

  // Try <article> first
  let container = root.querySelector('article')

  // Try <main>
  if (!container) container = root.querySelector('main')

  // Try [role="main"]
  if (!container) container = root.querySelector('[role="main"]')

  // Try common content selectors
  if (!container) {
    const contentSelectors = [
      '.article-body', '.article-content', '.post-content', '.entry-content',
      '.story-body', '.story-content', '#article-body', '#content',
      '.content-body', '.article__body', '.article__content',
    ]
    for (const sel of contentSelectors) {
      container = root.querySelector(sel)
      if (container) break
    }
  }

  // Fallback: find the largest text block
  if (!container) {
    let best = null
    let bestLen = 0
    const candidates = root.querySelectorAll('div, section')
    for (const el of candidates) {
      const text = el.text.trim()
      if (text.length > bestLen && text.length > 200) {
        // Skip elements that are likely wrappers of the whole page
        const childDivs = el.querySelectorAll('div').length
        if (childDivs < 30) {
          bestLen = text.length
          best = el
        }
      }
    }
    container = best
  }

  if (!container) return null

  // Extract paragraphs
  const paragraphs = []
  const pTags = container.querySelectorAll('p')

  if (pTags.length > 0) {
    for (const p of pTags) {
      const text = p.text.trim()
      // Skip very short paragraphs that are likely captions or metadata
      if (text.length > 20) {
        paragraphs.push(text)
      }
    }
  }

  // If no <p> tags, split on double newlines
  if (paragraphs.length === 0) {
    const raw = container.text.trim()
    const chunks = raw.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 20)
    paragraphs.push(...chunks)
  }

  return paragraphs.length > 0 ? paragraphs : null
}

// Extract title from HTML
function extractTitle(root) {
  // Try og:title
  const ogTitle = root.querySelector('meta[property="og:title"]')
  if (ogTitle) {
    const content = ogTitle.getAttribute('content')
    if (content) return content.trim()
  }

  // Try <h1>
  const h1 = root.querySelector('h1')
  if (h1) {
    const text = h1.text.trim()
    if (text.length > 5) return text
  }

  // Try <title>
  const title = root.querySelector('title')
  if (title) return title.text.trim()

  return null
}

// Extract source/site name
function extractSource(root, url) {
  const ogSite = root.querySelector('meta[property="og:site_name"]')
  if (ogSite) {
    const content = ogSite.getAttribute('content')
    if (content) return content.trim()
  }
  // Fallback to hostname
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return hostname.charAt(0).toUpperCase() + hostname.slice(1)
  } catch (_) {
    return 'Unknown'
  }
}

// Extract description for fallback
function extractDescription(root) {
  const ogDesc = root.querySelector('meta[property="og:description"]')
  if (ogDesc) {
    const content = ogDesc.getAttribute('content')
    if (content) return content.trim()
  }
  const metaDesc = root.querySelector('meta[name="description"]')
  if (metaDesc) {
    const content = metaDesc.getAttribute('content')
    if (content) return content.trim()
  }
  return null
}

// Extract author
function extractAuthor(root) {
  const metaAuthor = root.querySelector('meta[name="author"]')
  if (metaAuthor) {
    const content = metaAuthor.getAttribute('content')
    if (content) return content.trim()
  }
  const ogAuthor = root.querySelector('meta[property="article:author"]')
  if (ogAuthor) {
    const content = ogAuthor.getAttribute('content')
    if (content) return content.trim()
  }
  // Try common author selectors
  const authorSels = ['.author', '.byline', '[rel="author"]', '.article-author']
  for (const sel of authorSels) {
    const el = root.querySelector(sel)
    if (el) {
      const text = el.text.trim()
      if (text.length > 1 && text.length < 100) return text
    }
  }
  return null
}

// Extract og:image
function extractImage(root) {
  const ogImage = root.querySelector('meta[property="og:image"]')
  if (ogImage) {
    const content = ogImage.getAttribute('content')
    if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
      return content.trim()
    }
  }
  const twitterImage = root.querySelector('meta[name="twitter:image"]')
  if (twitterImage) {
    const content = twitterImage.getAttribute('content')
    if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
      return content.trim()
    }
  }
  return null
}

// Extract published date
function extractDate(root) {
  const timeMeta = root.querySelector('meta[property="article:published_time"]')
  if (timeMeta) {
    const content = timeMeta.getAttribute('content')
    if (content) return content.trim()
  }
  const timeEl = root.querySelector('time[datetime]')
  if (timeEl) return timeEl.getAttribute('datetime')
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing ?url= parameter' })
  }

  // Validate URL
  let parsedUrl
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  console.log(`[article] Fetching: ${url}`)

  // Check Redis cache
  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('[article] Redis init failed:', err.message)
  }

  const cacheKey = `article:v1:${Buffer.from(url).toString('base64').slice(0, 100)}`

  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log(`[article] Cache HIT for ${url}`)
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached
        return res.status(200).json({ ...data, source: 'cache' })
      }
      console.log(`[article] Cache MISS for ${url}`)
    } catch (err) {
      console.error('[article] Redis GET failed:', err.message)
    }
  }

  // Fetch the page
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Stratify/1.0; +https://stratifymarket.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`)
    }

    const html = await response.text()
    const root = parse(html, { comment: false })

    const title = extractTitle(root)
    const paragraphs = extractArticleContent(root)
    const sourceName = extractSource(root, url)
    const description = extractDescription(root)
    const author = extractAuthor(root)
    const publishedAt = extractDate(root)
    const image = extractImage(root)

    // Build content — paragraphs joined, or fallback to description
    let content = null
    if (paragraphs && paragraphs.length > 0) {
      content = paragraphs.join('\n\n')
    } else if (description) {
      content = description
    }

    if (!title && !content) {
      return res.status(422).json({
        error: 'Could not extract article content',
        url,
      })
    }

    const result = {
      title: title || 'Untitled',
      content: content || description || '',
      source: sourceName,
      author,
      publishedAt,
      image,
      url,
      paragraphs: paragraphs || (description ? [description] : []),
      fetchedAt: new Date().toISOString(),
    }

    // Cache in Redis
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL })
        console.log(`[article] Cached: ${url}`)
      } catch (err) {
        console.error('[article] Redis SET failed:', err.message)
      }
    }

    return res.status(200).json({ ...result, source: sourceName })
  } catch (err) {
    console.error(`[article] Error fetching ${url}:`, err.message)

    // Try stale cache
    if (redis) {
      try {
        const stale = await redis.get(cacheKey)
        if (stale) {
          const data = typeof stale === 'string' ? JSON.parse(stale) : stale
          return res.status(200).json({ ...data, source: 'stale-cache' })
        }
      } catch (_) {}
    }

    return res.status(500).json({
      error: 'Failed to fetch article',
      details: err.message,
      url,
    })
  }
}
