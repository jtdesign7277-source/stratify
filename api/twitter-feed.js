export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, count = '20' } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: 'Missing ticker parameter. Usage: /api/twitter-feed?ticker=NVDA' });
  }

  const BEARER_TOKEN = process.env.X_BEARER_TOKEN;

  if (!BEARER_TOKEN) {
    return res.status(500).json({ error: 'X_BEARER_TOKEN not configured' });
  }

  try {
    // Search for tweets mentioning the ticker with cashtag
    const query = encodeURIComponent(`$${ticker.toUpperCase()} -is:retweet lang:en`);
    const maxResults = Math.min(Math.max(parseInt(count), 10), 100);

    const url = `https://api.x.com/2/tweets/search/recent?query=${query}&max_results=${maxResults}&tweet.fields=created_at,public_metrics,author_id,lang&expansions=author_id&user.fields=name,username,profile_image_url,verified`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('X API error:', response.status, errorBody);
      return res.status(response.status).json({
        error: `X API returned ${response.status}`,
        details: errorBody,
      });
    }

    const data = await response.json();

    // Build user lookup map
    const users = {};
    if (data.includes?.users) {
      data.includes.users.forEach(user => {
        users[user.id] = {
          name: user.name,
          username: user.username,
          avatar: user.profile_image_url,
          verified: user.verified || false,
        };
      });
    }

    // Format tweets
    const tweets = (data.data || []).map(tweet => {
      const author = users[tweet.author_id] || {};
      const metrics = tweet.public_metrics || {};

      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author: {
          name: author.name || 'Unknown',
          username: author.username || 'unknown',
          avatar: author.avatar || '',
          verified: author.verified || false,
        },
        metrics: {
          likes: metrics.like_count || 0,
          retweets: metrics.retweet_count || 0,
          replies: metrics.reply_count || 0,
          impressions: metrics.impression_count || 0,
        },
      };
    });

    // Quick sentiment analysis based on keywords
    const sentimentKeywords = {
      bullish: ['buy', 'bull', 'bullish', 'moon', 'pump', 'long', 'calls', 'breakout', 'rocket', 'surge', 'green', 'up', 'gain', 'profit', 'undervalued', '🚀', '📈', '🔥', '💎', '🐂'],
      bearish: ['sell', 'bear', 'bearish', 'dump', 'short', 'puts', 'crash', 'drop', 'red', 'down', 'loss', 'overvalued', 'bubble', 'correction', '📉', '🐻', '💀', '⚠️'],
    };

    let bullCount = 0;
    let bearCount = 0;

    tweets.forEach(tweet => {
      const text = tweet.text.toLowerCase();
      const bullHits = sentimentKeywords.bullish.filter(kw => text.includes(kw)).length;
      const bearHits = sentimentKeywords.bearish.filter(kw => text.includes(kw)).length;

      if (bullHits > bearHits) {
        tweet.sentiment = 'bullish';
        bullCount++;
      } else if (bearHits > bullHits) {
        tweet.sentiment = 'bearish';
        bearCount++;
      } else {
        tweet.sentiment = 'neutral';
      }
    });

    const total = tweets.length || 1;
    const sentiment = {
      bullish: Math.round((bullCount / total) * 100),
      bearish: Math.round((bearCount / total) * 100),
      neutral: Math.round(((total - bullCount - bearCount) / total) * 100),
      score: bullCount - bearCount, // positive = bullish, negative = bearish
    };

    res.status(200).json({
      ticker: ticker.toUpperCase(),
      count: tweets.length,
      sentiment,
      tweets,
      meta: data.meta || {},
    });

  } catch (error) {
    console.error('Twitter feed error:', error);
    res.status(500).json({ error: error.message });
  }
}
