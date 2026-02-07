// Social Trend Scanner Service
// Aggregates trending topics from Reddit, WSB, X, Hacker News, Yahoo Finance, News, and Crypto

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

const REDDIT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchSubreddit(sub, limit = 10) {
  const res = await fetch(
    `https://old.reddit.com/r/${sub}/hot.json?limit=${limit}&raw_json=1`,
    { headers: REDDIT_HEADERS }
  );
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  const data = await res.json();
  return (data?.data?.children || []).map((child) => {
    const post = child.data;
    return {
      id: post.id,
      title: post.title,
      url: `https://reddit.com${post.permalink}`,
      score: post.score,
      comments: post.num_comments,
      subreddit: post.subreddit_name_prefixed,
      author: post.author,
      created: post.created_utc * 1000,
      flair: post.link_flair_text,
    };
  });
}

// ==================== REDDIT (general) ====================
async function fetchRedditTrending() {
  const cached = getCached('reddit');
  if (cached) return cached;

  const subreddits = ['stocks', 'investing', 'CryptoCurrency', 'technology', 'news', 'finance'];
  const results = [];

  // Fetch sequentially with a small delay to avoid Reddit rate limits
  for (const sub of subreddits) {
    try {
      const posts = await fetchSubreddit(sub, 5);
      results.push(...posts);
    } catch (err) {
      console.error(`Reddit r/${sub} error:`, err.message);
    }
    // Small delay between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 25);
  setCache('reddit', top);
  return top;
}

// ==================== WALLSTREETBETS (dedicated) ====================
async function fetchWSBTrending() {
  const cached = getCached('wsb');
  if (cached) return cached;

  try {
    const posts = await fetchSubreddit('wallstreetbets', 20);
    posts.sort((a, b) => b.score - a.score);
    setCache('wsb', posts);
    return posts;
  } catch (err) {
    console.error('WSB fetch error:', err.message);
    return [];
  }
}

// ==================== X / TWITTER (via Grok xAI) ====================
async function fetchXTrending() {
  const cached = getCached('x');
  if (cached) return cached;

  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) {
    console.warn('No xAI API key for X trends');
    return [];
  }

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'You are a financial trends reporter. Return ONLY valid JSON, no markdown or extra text.',
          },
          {
            role: 'user',
            content: `What are the top 15 trending topics on X (Twitter) right now related to stocks, trading, crypto, finance, and markets? Return as a JSON array with objects containing: "topic" (the trending hashtag or topic name), "description" (1 sentence summary of why it's trending), "category" (one of: stocks, crypto, economy, earnings, politics, tech), "engagement" (estimated engagement level: "high", "medium", or "low"). Return ONLY the JSON array, nothing else.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) throw new Error(`Grok API ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const topics = JSON.parse(cleaned);
    const results = (Array.isArray(topics) ? topics : []).map((t, i) => ({
      id: `x-${i}-${Date.now()}`,
      topic: t.topic || t.hashtag || '',
      description: t.description || t.summary || '',
      category: t.category || 'general',
      engagement: t.engagement || 'medium',
      created: Date.now(),
    }));

    setCache('x', results);
    return results;
  } catch (err) {
    console.error('X/Grok trends error:', err.message);
    return [];
  }
}

// ==================== HACKER NEWS ====================
async function fetchHackerNewsTrending() {
  const cached = getCached('hackernews');
  if (cached) return cached;

  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!res.ok) throw new Error('HN API error');
    const ids = await res.json();
    const topIds = ids.slice(0, 20);

    const stories = await Promise.all(
      topIds.map(async (id) => {
        try {
          const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!storyRes.ok) return null;
          const story = await storyRes.json();
          return {
            id: story.id,
            title: story.title,
            url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            score: story.score,
            comments: story.descendants || 0,
            author: story.by,
            created: story.time * 1000,
            hnUrl: `https://news.ycombinator.com/item?id=${story.id}`,
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = stories.filter(Boolean);
    setCache('hackernews', filtered);
    return filtered;
  } catch (err) {
    console.error('Hacker News fetch error:', err.message);
    return [];
  }
}

// ==================== YAHOO FINANCE TRENDING ====================
async function fetchFinanceTrending(yahooFinance) {
  const cached = getCached('finance');
  if (cached) return cached;

  try {
    const trending = await yahooFinance.trendingSymbols('US');
    const symbols = trending.quotes.slice(0, 15).map((q) => q.symbol);

    const quotes = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const quote = await yahooFinance.quote(sym);
          return {
            symbol: sym,
            name: quote.shortName || quote.longName || sym,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            volume: quote.regularMarketVolume || 0,
            marketCap: quote.marketCap || 0,
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = quotes.filter(Boolean);
    setCache('finance', filtered);
    return filtered;
  } catch (err) {
    console.error('Yahoo Finance trending error:', err.message);
    return [];
  }
}

// ==================== RSS / NEWS FEEDS ====================
async function fetchNewsFeeds() {
  const cached = getCached('news');
  if (cached) return cached;

  const results = [];

  // Google News RSS
  try {
    const gnRes = await fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
    if (gnRes.ok) {
      const xml = await gnRes.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      items.slice(0, 10).forEach((item, idx) => {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source.*?>(.*?)<\/source>/);

        if (titleMatch) {
          results.push({
            id: `gn-${idx}`,
            title: titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
            url: linkMatch ? linkMatch[1] : '',
            source: sourceMatch ? sourceMatch[1] : 'Google News',
            created: pubDateMatch ? new Date(pubDateMatch[1]).getTime() : Date.now(),
          });
        }
      });
    }
  } catch (err) {
    console.error('Google News RSS error:', err.message);
  }

  // TechCrunch via WP API
  try {
    const res = await fetch('https://techcrunch.com/wp-json/wp/v2/posts?per_page=5&_fields=id,title,link,date,excerpt');
    if (res.ok) {
      const posts = await res.json();
      posts.forEach((post) => {
        results.push({
          id: `tc-${post.id}`,
          title: post.title?.rendered?.replace(/(<([^>]+)>)/gi, '') || '',
          url: post.link,
          source: 'TechCrunch',
          created: new Date(post.date).getTime(),
        });
      });
    }
  } catch (err) {
    console.error('TechCrunch fetch error:', err.message);
  }

  setCache('news', results);
  return results;
}

// ==================== CRYPTO TRENDING ====================
async function fetchCryptoTrending() {
  const cached = getCached('crypto');
  if (cached) return cached;

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
    if (!res.ok) throw new Error('CoinGecko API error');
    const data = await res.json();

    const coins = (data.coins || []).map((item) => ({
      id: item.item.id,
      name: item.item.name,
      symbol: item.item.symbol,
      rank: item.item.market_cap_rank,
      thumb: item.item.thumb,
      price_btc: item.item.price_btc,
      score: item.item.score,
    }));

    setCache('crypto', coins);
    return coins;
  } catch (err) {
    console.error('CoinGecko trending error:', err.message);
    return [];
  }
}

// ==================== AGGREGATE ALL ====================
export async function fetchAllTrends(yahooFinance) {
  const [reddit, wsb, x, hackerNews, finance, news, crypto] = await Promise.all([
    fetchRedditTrending(),
    fetchWSBTrending(),
    fetchXTrending(),
    fetchHackerNewsTrending(),
    yahooFinance ? fetchFinanceTrending(yahooFinance) : Promise.resolve([]),
    fetchNewsFeeds(),
    fetchCryptoTrending(),
  ]);

  return {
    reddit,
    wsb,
    x,
    hackerNews,
    finance,
    news,
    crypto,
    fetchedAt: new Date().toISOString(),
  };
}

export {
  fetchRedditTrending,
  fetchWSBTrending,
  fetchXTrending,
  fetchHackerNewsTrending,
  fetchFinanceTrending,
  fetchNewsFeeds,
  fetchCryptoTrending,
};
