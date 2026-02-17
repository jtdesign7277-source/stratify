import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
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
  Flame,
  Newspaper,
  Bitcoin,
  BarChart3,
} from 'lucide-react';
import { API_URL } from '../../config';

// X logo SVG component
function XLogo({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// WSB diamond hands icon
function WSBIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 9l10 7 10-7-10-7z" />
      <path d="M2 15l10 7 10-7" />
      <path d="M2 12l10 7 10-7" />
    </svg>
  );
}

const SOURCE_OPTIONS = [
  { id: 'reddit', label: 'Reddit', icon: Flame, color: 'orange' },
  { id: 'wsb', label: 'WSB', icon: WSBIcon, color: 'lime' },
  { id: 'x', label: 'X', icon: XLogo, color: 'white' },
  { id: 'hackerNews', label: 'Hacker News', icon: Hash, color: 'amber' },
  { id: 'finance', label: 'Finance', icon: BarChart3, color: 'emerald' },
  { id: 'news', label: 'News', icon: Newspaper, color: 'blue' },
  { id: 'crypto', label: 'Crypto', icon: Bitcoin, color: 'purple' },
];

const COLOR_MAP = {
  orange: { active: 'bg-orange-500/15 text-orange-400 border-orange-500/30', hover: 'hover:border-orange-500/20' },
  lime: { active: 'bg-lime-500/15 text-lime-400 border-lime-500/30', hover: 'hover:border-lime-500/20' },
  white: { active: 'bg-white/15 text-white border-white/30', hover: 'hover:border-white/20' },
  amber: { active: 'bg-amber-500/15 text-amber-400 border-amber-500/30', hover: 'hover:border-amber-500/20' },
  emerald: { active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', hover: 'hover:border-emerald-500/20' },
  blue: { active: 'bg-blue-500/15 text-blue-400 border-blue-500/30', hover: 'hover:border-blue-500/20' },
  purple: { active: 'bg-purple-500/15 text-purple-400 border-purple-500/30', hover: 'hover:border-purple-500/20' },
};

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

// Reddit / WSB post card
function RedditCard({ post, accentColor = 'orange' }) {
  const colorClass = accentColor === 'lime' ? 'text-lime-400' : 'text-orange-400';
  const borderClass = accentColor === 'lime' ? 'hover:border-lime-500/30 hover:bg-lime-500/[0.04]' : 'hover:border-orange-500/30 hover:bg-orange-500/[0.04]';
  const bgClass = accentColor === 'lime' ? 'bg-lime-500/10 text-lime-300/70' : 'bg-orange-500/10 text-orange-300/70';

  return (
    <motion.a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`block p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] ${borderClass} transition-all group`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 min-w-[40px]">
          <ArrowUp className={`w-3.5 h-3.5 ${colorClass}`} strokeWidth={2} />
          <span className={`text-sm font-bold ${colorClass}`}>{formatNumber(post.score)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {post.title}
          </h3>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <span className={`font-medium ${colorClass} opacity-70`}>{post.subreddit}</span>
            {post.flair && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${bgClass}`}>
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

// X trending topic card
function XCard({ topic }) {
  const engagementColors = {
    high: 'text-emerald-400 bg-emerald-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-white/40 bg-white/[0.04]',
  };
  const catColors = {
    stocks: 'text-emerald-400',
    crypto: 'text-purple-400',
    economy: 'text-blue-400',
    earnings: 'text-amber-400',
    politics: 'text-red-400',
    tech: 'text-cyan-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.05] transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
          <XLogo className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-bold text-white leading-snug">{topic.topic}</h3>
          <p className="text-[11px] text-white/50 mt-1 line-clamp-2">{topic.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-medium ${catColors[topic.category] || 'text-white/40'}`}>
              {topic.category}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${engagementColors[topic.engagement] || engagementColors.medium}`}>
              {topic.engagement}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
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
              Discussion
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

// Section header helper
function SectionHeader({ icon: Icon, label, count, colorClass }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-6 h-6 rounded-md bg-${colorClass}-500/10 flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 text-${colorClass}-400`} strokeWidth={1.5} />
      </div>
      <h2 className="text-[13px] font-semibold text-white/70">{label}</h2>
      <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{count}</span>
    </div>
  );
}

export default function TrendScanner() {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSources, setActiveSources] = useState(() => {
    // All sources on by default
    return new Set(SOURCE_OPTIONS.map((s) => s.id));
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);

  const toggleSource = (id) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchTrends = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/trends`);
      if (!res.ok) throw new Error('Failed to fetch trends');
      const data = await res.json();
      setTrends(data);
    } catch (err) {
      console.error('Trend fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTrends();
  }, [fetchTrends]);

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

  const totalItems = activeSources.size === 0 ? 0 :
    (activeSources.has('reddit') ? (trends?.reddit?.length || 0) : 0) +
    (activeSources.has('wsb') ? (trends?.wsb?.length || 0) : 0) +
    (activeSources.has('x') ? (trends?.x?.length || 0) : 0) +
    (activeSources.has('hackerNews') ? (trends?.hackerNews?.length || 0) : 0) +
    (activeSources.has('finance') ? (trends?.finance?.length || 0) : 0) +
    (activeSources.has('news') ? (trends?.news?.length || 0) : 0) +
    (activeSources.has('crypto') ? (trends?.crypto?.length || 0) : 0);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0b0b0b]">
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
                Live from Reddit, WSB, X, Hacker News, Finance, News & Crypto
                {trends?.fetchedAt && (
                  <span className="ml-2 text-emerald-400/50">
                    Updated {timeAgo(new Date(trends.fetchedAt).getTime())}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/50">
              <span className="text-white font-medium">{totalItems}</span> items
            </div>
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
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Multi-select source toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {SOURCE_OPTIONS.map((source) => {
            const Icon = source.icon;
            const isActive = activeSources.has(source.id);
            const colors = COLOR_MAP[source.color];
            return (
              <button
                key={source.id}
                onClick={() => toggleSource(source.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border cursor-pointer ${
                  isActive
                    ? colors.active
                    : `text-white/30 bg-white/[0.02] border-white/[0.06] ${colors.hover} hover:text-white/50`
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {source.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'none' }}>
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
            {/* 3-Column Layout: Reddit | WSB | X */}
            {(activeSources.has('reddit') || activeSources.has('wsb') || activeSources.has('x')) && (
              <div className="grid grid-cols-3 gap-4">
                {/* Reddit Column */}
                {activeSources.has('reddit') && (trends?.reddit?.length || 0) > 0 && (
                  <section className="min-w-0">
                    <SectionHeader icon={Flame} label="Reddit" count={trends.reddit.length} colorClass="orange" />
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                      {trends.reddit.map((post) => (
                        <RedditCard key={post.id} post={post} accentColor="orange" />
                      ))}
                    </div>
                  </section>
                )}

                {/* WSB Column */}
                {activeSources.has('wsb') && (trends?.wsb?.length || 0) > 0 && (
                  <section className="min-w-0">
                    <SectionHeader icon={WSBIcon} label="WSB" count={trends.wsb.length} colorClass="lime" />
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                      {trends.wsb.map((post) => (
                        <RedditCard key={post.id} post={post} accentColor="lime" />
                      ))}
                    </div>
                  </section>
                )}

                {/* X Column */}
                {activeSources.has('x') && (trends?.x?.length || 0) > 0 && (
                  <section className="min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                        <XLogo className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h2 className="text-[13px] font-semibold text-white/70">X</h2>
                      <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{trends.x.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                      {trends.x.map((topic) => (
                        <XCard key={topic.id} topic={topic} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Hacker News */}
            {activeSources.has('hackerNews') && (trends?.hackerNews?.length || 0) > 0 && (
              <section>
                <SectionHeader icon={Hash} label="Hacker News" count={trends.hackerNews.length} colorClass="amber" />
                <div className="grid gap-2">
                  {trends.hackerNews.map((story) => (
                    <HNCard key={story.id} story={story} />
                  ))}
                </div>
              </section>
            )}

            {/* Finance */}
            {activeSources.has('finance') && (trends?.finance?.length || 0) > 0 && (
              <section>
                <SectionHeader icon={BarChart3} label="Trending Stocks" count={trends.finance.length} colorClass="emerald" />
                <div className="grid grid-cols-2 gap-2">
                  {trends.finance.map((stock) => (
                    <FinanceCard key={stock.symbol} stock={stock} />
                  ))}
                </div>
              </section>
            )}

            {/* News */}
            {activeSources.has('news') && (trends?.news?.length || 0) > 0 && (
              <section>
                <SectionHeader icon={Newspaper} label="News Headlines" count={trends.news.length} colorClass="blue" />
                <div className="grid gap-2">
                  {trends.news.map((article) => (
                    <NewsCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )}

            {/* Crypto */}
            {activeSources.has('crypto') && (trends?.crypto?.length || 0) > 0 && (
              <section>
                <SectionHeader icon={Bitcoin} label="Trending Crypto" count={trends.crypto.length} colorClass="purple" />
                <div className="grid grid-cols-2 gap-2">
                  {trends.crypto.map((coin) => (
                    <CryptoCard key={coin.id} coin={coin} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {activeSources.size === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Globe className="w-8 h-8 text-white/20" />
                <p className="text-[13px] text-white/40">Select a source above to see trends</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
