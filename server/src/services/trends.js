// Social Trend Scanner Service
// Aggregates trending topics from Reddit, Hacker News, Yahoo Finance, and RSS feeds

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

// ==================== REDDIT ====================
async function fetchRedditTrending() {
  const cached = getCached('reddit');
  if (cached) return cached;

  const subreddits = [
    'wallstreetbets',
    'stocks',
    'investing',
    'CryptoCurrency',
    'technology',
    'news',
    'worldnews',
    'finance',
  ];

  const results = [];

  await Promise.all(
    subreddits.map(async (sub) => {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, {
          headers: { 'User-Agent': 'Stratify/1.0 (Trading Platform)' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const posts = (data?.data?.children || []).map((child) => {
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
            thumbnail: post.thumbnail !== 'self' && post.thumbnail !== 'default' ? post.thumbnail : null,
            flair: post.link_flair_text,
          };
        });
        results.push(...posts);
      } catch (err) {
        console.error(`Reddit fetch error for r/${sub}:`, err.message);
      }
    })
  );

  // Sort by score (popularity)
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 25);
  setCache('reddit', top);
  return top;
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

  // Use publicly available RSS-to-JSON services and APIs
  const feeds = [
    {
      name: 'TechCrunch',
      url: 'https://techcrunch.com/wp-json/wp/v2/posts?per_page=5&_fields=id,title,link,date,excerpt',
      parser: 'wp',
    },
  ];

  const results = [];

  // Fetch from Google News RSS via a simple text parse
  try {
    const gnRes = await fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
    if (gnRes.ok) {
      const xml = await gnRes.text();
      // Simple XML parsing for RSS items
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

  // Fetch TechCrunch via WP API
  for (const feed of feeds) {
    if (feed.parser === 'wp') {
      try {
        const res = await fetch(feed.url);
        if (!res.ok) continue;
        const posts = await res.json();
        posts.forEach((post) => {
          results.push({
            id: `tc-${post.id}`,
            title: post.title?.rendered?.replace(/(<([^>]+)>)/gi, '') || '',
            url: post.link,
            source: feed.name,
            created: new Date(post.date).getTime(),
          });
        });
      } catch (err) {
        console.error(`${feed.name} fetch error:`, err.message);
      }
    }
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
  const [reddit, hackerNews, finance, news, crypto] = await Promise.all([
    fetchRedditTrending(),
    fetchHackerNewsTrending(),
    yahooFinance ? fetchFinanceTrending(yahooFinance) : Promise.resolve([]),
    fetchNewsFeeds(),
    fetchCryptoTrending(),
  ]);

  return {
    reddit,
    hackerNews,
    finance,
    news,
    crypto,
    fetchedAt: new Date().toISOString(),
  };
}

export {
  fetchRedditTrending,
  fetchHackerNewsTrending,
  fetchFinanceTrending,
  fetchNewsFeeds,
  fetchCryptoTrending,
};
