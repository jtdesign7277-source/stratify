import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Heart,
  Repeat2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ExternalLink,
  Search,
} from 'lucide-react';

const SENTIMENT_COLORS = {
  bullish: '#22c55e',
  bearish: '#ef4444',
  neutral: '#64748b',
};

const SENTIMENT_ICONS = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  neutral: Minus,
};

function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function SentimentBar({ sentiment }) {
  if (!sentiment) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span style={{ color: SENTIMENT_COLORS.bullish }}>
          🐂 {sentiment.bullish}% Bullish
        </span>
        <span style={{ color: SENTIMENT_COLORS.neutral }}>
          {sentiment.neutral}% Neutral
        </span>
        <span style={{ color: SENTIMENT_COLORS.bearish }}>
          🐻 {sentiment.bearish}% Bearish
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sentiment.bullish}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ backgroundColor: SENTIMENT_COLORS.bullish }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sentiment.neutral}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          style={{ backgroundColor: SENTIMENT_COLORS.neutral, opacity: 0.4 }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sentiment.bearish}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          style={{ backgroundColor: SENTIMENT_COLORS.bearish }}
        />
      </div>
    </div>
  );
}

function TweetCard({ tweet, index }) {
  const SentimentIcon = SENTIMENT_ICONS[tweet.sentiment] || Minus;
  const sentimentColor = SENTIMENT_COLORS[tweet.sentiment] || SENTIMENT_COLORS.neutral;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="group px-3 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
      onClick={() => window.open(`https://x.com/${tweet.author.username}/status/${tweet.id}`, '_blank')}
    >
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {tweet.author.avatar ? (
            <img
              src={tweet.author.avatar}
              alt={tweet.author.name}
              className="w-8 h-8 rounded-full bg-white/5"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-bold">
              {tweet.author.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-white/90 truncate">
              {tweet.author.name}
            </span>
            {tweet.author.verified && (
              <svg className="w-3 h-3 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/>
              </svg>
            )}
            <span className="text-[10px] text-white/30 font-mono">
              @{tweet.author.username}
            </span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] text-white/30 font-mono">
              {timeAgo(tweet.created_at)}
            </span>
            <div className="ml-auto flex-shrink-0">
              <SentimentIcon
                size={12}
                style={{ color: sentimentColor }}
                strokeWidth={2}
              />
            </div>
          </div>

          {/* Tweet text */}
          <p className="text-[11px] text-white/70 leading-relaxed line-clamp-3">
            {tweet.text}
          </p>

          {/* Metrics */}
          <div className="flex items-center gap-4 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-white/25 hover:text-blue-400 transition-colors">
              <MessageCircle size={10} strokeWidth={1.5} />
              {formatNumber(tweet.metrics.replies)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-white/25 hover:text-green-400 transition-colors">
              <Repeat2 size={10} strokeWidth={1.5} />
              {formatNumber(tweet.metrics.retweets)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-white/25 hover:text-red-400 transition-colors">
              <Heart size={10} strokeWidth={1.5} />
              {formatNumber(tweet.metrics.likes)}
            </span>
            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink size={10} className="text-white/20" strokeWidth={1.5} />
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SocialSentiment({ activeTicker = 'NVDA', onCollapseChange }) {
  const [ticker, setTicker] = useState(activeTicker);
  const [inputValue, setInputValue] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchFeed = useCallback(async (symbol) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/twitter-feed?ticker=${symbol}&count=20`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(ticker);
  }, [ticker, fetchFeed]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchFeed(ticker), 300000);
    return () => clearInterval(interval);
  }, [ticker, fetchFeed]);

  // Sync with parent ticker changes
  useEffect(() => {
    if (activeTicker && activeTicker !== ticker) {
      setTicker(activeTicker);
    }
  }, [activeTicker, ticker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setTicker(inputValue.trim().toUpperCase().replace('$', ''));
      setInputValue('');
    }
  };

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full w-10 bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg cursor-pointer hover:border-blue-500/40 transition-all group"
        onClick={() => { setCollapsed(false); onCollapseChange?.(false); }}
        title="Expand Social Pulse"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md group-hover:bg-blue-500/40 transition-all" />
          <svg className="relative w-5 h-5 text-white/60 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCollapsed(true); onCollapseChange?.(true); }}
            className="hover:opacity-80 transition-opacity"
            title="Collapse"
          >
            <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>
          <span className="text-xs font-semibold text-white/70">Social Pulse</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            ${ticker}
          </span>
        </div>

        <button
          onClick={() => fetchFeed(ticker)}
          disabled={loading}
          className="p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-30"
        >
          <RefreshCw
            size={12}
            className={`text-white/40 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
        <Search size={12} className="text-white/20" strokeWidth={1.5} />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search ticker..."
          className="flex-1 bg-transparent text-xs text-white/80 placeholder-white/20 outline-none font-mono"
        />
      </form>

      {/* Sentiment bar */}
      {data?.sentiment && (
        <div className="px-3 py-2 border-b border-white/[0.04]">
          <SentimentBar sentiment={data.sentiment} />
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && !data && (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={16} className="text-blue-400/50 animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-red-400/70 font-mono">{error}</p>
            <button
              onClick={() => fetchFeed(ticker)}
              className="mt-2 text-[10px] text-blue-400/70 hover:text-blue-400 font-mono"
            >
              Retry
            </button>
          </div>
        )}

        {data?.tweets?.length === 0 && !loading && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-white/30 font-mono">No posts found for ${ticker}</p>
          </div>
        )}

        <AnimatePresence>
          {data?.tweets?.map((tweet, i) => (
            <TweetCard key={tweet.id} tweet={tweet} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[9px] text-white/15 font-mono">
          {data?.count || 0} posts · auto-refresh 5m
        </span>
        {data?.sentiment && (
          <span
            className="text-[9px] font-mono font-bold"
            style={{
              color: data.sentiment.score > 0
                ? SENTIMENT_COLORS.bullish
                : data.sentiment.score < 0
                  ? SENTIMENT_COLORS.bearish
                  : SENTIMENT_COLORS.neutral,
            }}
          >
            {data.sentiment.score > 0 ? '▲' : data.sentiment.score < 0 ? '▼' : '—'}{' '}
            SENTIMENT {data.sentiment.score > 0 ? '+' : ''}{data.sentiment.score}
          </span>
        )}
      </div>
    </div>
  );
}
