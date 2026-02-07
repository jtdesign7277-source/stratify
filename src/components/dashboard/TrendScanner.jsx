import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ArrowUp,
  Clock,
  Hash,
  Globe,
  Zap,
  Filter,
  ChevronDown,
  Flame,
  Newspaper,
  Bitcoin,
  BarChart3,
  Search,
} from 'lucide-react';
import { API_URL } from '../../config';

const SOURCE_TABS = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'reddit', label: 'Reddit', icon: Flame },
  { id: 'hackerNews', label: 'Hacker News', icon: Hash },
  { id: 'finance', label: 'Finance', icon: BarChart3 },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'crypto', label: 'Crypto', icon: Bitcoin },
];

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Reddit post card
function RedditCard({ post }) {
  return (
    <motion.a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="block p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-orange-500/30 hover:bg-orange-500/[0.04] transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Score */}
        <div className="flex flex-col items-center gap-0.5 min-w-[40px]">
          <ArrowUp className="w-3.5 h-3.5 text-orange-400" strokeWidth={2} />
          <span className="text-sm font-bold text-orange-400">{formatNumber(post.score)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {post.title}
          </h3>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <span className="text-orange-400/70 font-medium">{post.subreddit}</span>
            {post.flair && (
              <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300/70 text-[10px]">
                {post.flair}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {formatNumber(post.comments)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(post.created)}
            </span>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 flex-shrink-0 mt-1" />
      </div>
    </motion.a>
  );
}

// Hacker News card
function HNCard({ story }) {
  return (
    <motion.a
      href={story.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="block p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/30 hover:bg-amber-500/[0.04] transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 min-w-[40px]">
          <ArrowUp className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
          <span className="text-sm font-bold text-amber-400">{formatNumber(story.score)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {story.title}
          </h3>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <span className="text-amber-400/70 font-medium">@{story.author}</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {formatNumber(story.comments)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(story.created)}
            </span>
            <a
              href={story.hnUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-amber-400/50 hover:text-amber-400 transition-colors"
            >
              HN Discussion
            </a>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 flex-shrink-0 mt-1" />
      </div>
    </motion.a>
  );
}

// Finance trending card
function FinanceCard({ stock }) {
  const isPositive = stock.changePercent >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-white">{stock.symbol}</span>
            <span className="text-[11px] text-white/40 truncate max-w-[140px]">{stock.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] text-white/80 font-medium">${stock.price?.toFixed(2)}</span>
            <span className={`text-[12px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-white/30 uppercase">Volume</div>
          <div className="text-[12px] text-white/60 font-medium">{formatNumber(stock.volume)}</div>
        </div>
      </div>
    </motion.div>
  );
}

// News card
function NewsCard({ article }) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="block p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/30 hover:bg-blue-500/[0.04] transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Newspaper className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {article.title}
          </h3>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <span className="text-blue-400/70 font-medium">{article.source}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(article.created)}
            </span>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 flex-shrink-0 mt-1" />
      </div>
    </motion.a>
  );
}

// Crypto card
function CryptoCard({ coin }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/[0.04] transition-all"
    >
      <div className="flex items-center gap-3">
        {coin.thumb && (
          <img src={coin.thumb} alt={coin.name} className="w-8 h-8 rounded-full" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-white">{coin.symbol?.toUpperCase()}</span>
            <span className="text-[11px] text-white/40 truncate">{coin.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {coin.rank && (
              <span className="text-[10px] text-purple-400/70 bg-purple-500/10 px-1.5 py-0.5 rounded">
                #{coin.rank}
              </span>
            )}
            <span className="text-[10px] text-white/30">Trending Score: {coin.score + 1}</span>
          </div>
        </div>
        <TrendingUp className="w-4 h-4 text-purple-400 flex-shrink-0" />
      </div>
    </motion.div>
  );
}

export default function TrendScanner() {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSource, setActiveSource] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);

  const fetchTrends = useCallback(async () => {
    try {
      setError(null);
      const endpoint = activeSource === 'all'
        ? `${API_URL}/api/trends`
        : `${API_URL}/api/trends/${activeSource === 'hackerNews' ? 'hackernews' : activeSource}`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to fetch trends');
      const data = await res.json();

      if (activeSource === 'all') {
        setTrends(data);
      } else {
        setTrends((prev) => ({
          ...(prev || {}),
          ...data,
          fetchedAt: data.fetchedAt,
        }));
      }
    } catch (err) {
      console.error('Trend fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeSource]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchTrends();
  }, [fetchTrends]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(fetchTrends, 5 * 60 * 1000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, fetchTrends]);

  const handleRefresh = () => {
    setLoading(true);
    fetchTrends();
  };

  // Filter by search
  const filterBySearch = (items, fields) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      fields.some((f) => item[f]?.toString().toLowerCase().includes(q))
    );
  };

  const filteredReddit = filterBySearch(trends?.reddit || [], ['title', 'subreddit', 'flair']);
  const filteredHN = filterBySearch(trends?.hackerNews || [], ['title', 'author']);
  const filteredFinance = filterBySearch(trends?.finance || [], ['symbol', 'name']);
  const filteredNews = filterBySearch(trends?.news || [], ['title', 'source']);
  const filteredCrypto = filterBySearch(trends?.crypto || [], ['name', 'symbol']);

  const totalItems =
    (trends?.reddit?.length || 0) +
    (trends?.hackerNews?.length || 0) +
    (trends?.finance?.length || 0) +
    (trends?.news?.length || 0) +
    (trends?.crypto?.length || 0);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Trend Scanner</h1>
              <p className="text-[11px] text-white/40 mt-0.5">
                Live from Reddit, Hacker News, Finance, News & Crypto
                {trends?.fetchedAt && (
                  <span className="ml-2 text-emerald-400/50">
                    Updated {timeAgo(new Date(trends.fetchedAt).getTime())}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Total count */}
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/50">
              <span className="text-white font-medium">{totalItems}</span> items
            </div>
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-white/40'
              }`}
            >
              {autoRefresh ? 'Auto' : 'Manual'}
            </button>
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Search + Source Tabs */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter trends..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/30 transition-colors"
            />
          </div>

          {/* Source tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {SOURCE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSource === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSource(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {loading && !trends ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            <p className="text-[13px] text-white/40">Scanning social feeds...</p>
          </div>
        ) : error && !trends ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-[13px] text-white/50">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[12px] text-white/70 hover:text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Reddit Section */}
            {(activeSource === 'all' || activeSource === 'reddit') && filteredReddit.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center">
                    <Flame className="w-3.5 h-3.5 text-orange-400" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-[13px] font-semibold text-white/70">Reddit</h2>
                  <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{filteredReddit.length}</span>
                </div>
                <div className="grid gap-2">
                  {filteredReddit.map((post) => (
                    <RedditCard key={post.id} post={post} />
                  ))}
                </div>
              </section>
            )}

            {/* Hacker News Section */}
            {(activeSource === 'all' || activeSource === 'hackerNews') && filteredHN.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <Hash className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-[13px] font-semibold text-white/70">Hacker News</h2>
                  <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{filteredHN.length}</span>
                </div>
                <div className="grid gap-2">
                  {filteredHN.map((story) => (
                    <HNCard key={story.id} story={story} />
                  ))}
                </div>
              </section>
            )}

            {/* Finance Section */}
            {(activeSource === 'all' || activeSource === 'finance') && filteredFinance.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-[13px] font-semibold text-white/70">Trending Stocks</h2>
                  <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{filteredFinance.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredFinance.map((stock) => (
                    <FinanceCard key={stock.symbol} stock={stock} />
                  ))}
                </div>
              </section>
            )}

            {/* News Section */}
            {(activeSource === 'all' || activeSource === 'news') && filteredNews.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                    <Newspaper className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-[13px] font-semibold text-white/70">News Headlines</h2>
                  <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{filteredNews.length}</span>
                </div>
                <div className="grid gap-2">
                  {filteredNews.map((article) => (
                    <NewsCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )}

            {/* Crypto Section */}
            {(activeSource === 'all' || activeSource === 'crypto') && filteredCrypto.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                    <Bitcoin className="w-3.5 h-3.5 text-purple-400" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-[13px] font-semibold text-white/70">Trending Crypto</h2>
                  <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{filteredCrypto.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredCrypto.map((coin) => (
                    <CryptoCard key={coin.id} coin={coin} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {totalItems === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Globe className="w-8 h-8 text-white/20" />
                <p className="text-[13px] text-white/40">No trends found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
