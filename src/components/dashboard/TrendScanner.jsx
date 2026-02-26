import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ArrowUp,
  Clock,
} from 'lucide-react';

function XLogo({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
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

const CARD_CLASS = 'block rounded-xl bg-white/[0.02] border border-white/[0.06] transition-all';
const CARD_HEIGHT = 'h-[120px]';

function TrendCard({ href, hoverBorder = 'hover:border-white/15', children }) {
  const cls = `${CARD_CLASS} ${CARD_HEIGHT} px-4 py-3 ${hoverBorder} group`;
  if (href) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cls}
      >
        {children}
      </motion.a>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cls}>
      {children}
    </motion.div>
  );
}

function RedditItem({ post, color = 'orange' }) {
  const accent = color === 'lime' ? 'text-lime-400' : 'text-orange-400';
  const border = color === 'lime' ? 'hover:border-lime-500/30' : 'hover:border-orange-500/30';
  return (
    <TrendCard href={post.url} hoverBorder={border}>
      <div className="flex items-start gap-2.5 h-full">
        <div className="flex flex-col items-center min-w-[32px]">
          <ArrowUp className={`w-3.5 h-3.5 ${accent}`} strokeWidth={2} />
          <span className={`text-xs font-bold ${accent}`}>{formatNumber(post.score)}</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
          <p className="text-sm text-white/90 leading-snug line-clamp-3 group-hover:text-white">{post.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-white/35">
            <span className={`font-medium ${accent} opacity-70`}>{post.subreddit}</span>
            <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />{formatNumber(post.comments)}</span>
            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{timeAgo(post.created)}</span>
          </div>
        </div>
        <ExternalLink className="w-3 h-3 text-white/15 group-hover:text-white/40 shrink-0 mt-0.5" />
      </div>
    </TrendCard>
  );
}

function XItem({ topic }) {
  const catColor = { stocks: 'text-emerald-400', crypto: 'text-purple-400', economy: 'text-blue-400', earnings: 'text-amber-400' };
  const engColor = { high: 'text-emerald-400 bg-emerald-500/10', medium: 'text-amber-400 bg-amber-500/10', low: 'text-white/40 bg-white/[0.04]' };
  return (
    <TrendCard hoverBorder="hover:border-white/15">
      <div className="flex items-start gap-2.5 h-full">
        <XLogo className="w-4 h-4 text-white/50 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
          <div>
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{topic.topic}</p>
            <p className="text-[11px] text-white/45 mt-0.5 line-clamp-1">{topic.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium ${catColor[topic.category] || 'text-white/40'}`}>{topic.category}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${engColor[topic.engagement] || engColor.medium}`}>{topic.engagement}</span>
          </div>
        </div>
      </div>
    </TrendCard>
  );
}

function HNItem({ story }) {
  return (
    <TrendCard href={story.url} hoverBorder="hover:border-amber-500/30">
      <div className="flex items-start gap-2.5 h-full">
        <div className="flex flex-col items-center min-w-[32px]">
          <ArrowUp className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
          <span className="text-xs font-bold text-amber-400">{formatNumber(story.score)}</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
          <p className="text-sm text-white/90 leading-snug line-clamp-3 group-hover:text-white">{story.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-white/35">
            <span className="text-amber-400/70 font-medium">@{story.author}</span>
            <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />{formatNumber(story.comments)}</span>
            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{timeAgo(story.created)}</span>
          </div>
        </div>
        <ExternalLink className="w-3 h-3 text-white/15 group-hover:text-white/40 shrink-0 mt-0.5" />
      </div>
    </TrendCard>
  );
}

function NewsItem({ article }) {
  return (
    <TrendCard href={article.url} hoverBorder="hover:border-blue-500/30">
      <div className="flex items-start gap-2.5 h-full">
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
          <p className="text-sm text-white/90 leading-snug line-clamp-3 group-hover:text-white">{article.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-white/35">
            <span className="text-blue-400/70 font-medium">{article.source}</span>
            {article.symbols?.length > 0 && (
              <span className="text-emerald-400/70">{article.symbols.map(s => `$${s}`).join(' ')}</span>
            )}
            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{timeAgo(article.created)}</span>
          </div>
        </div>
        <ExternalLink className="w-3 h-3 text-white/15 group-hover:text-white/40 shrink-0 mt-0.5" />
      </div>
    </TrendCard>
  );
}

const SECTIONS = [
  { key: 'reddit', label: 'Reddit', color: 'text-orange-400' },
  { key: 'wsb', label: 'WallStreetBets', color: 'text-lime-400' },
  { key: 'x', label: 'X', color: 'text-white' },
  { key: 'hackerNews', label: 'Hacker News', color: 'text-amber-400' },
  { key: 'news', label: 'Financial News', color: 'text-blue-400' },
];

export default function TrendScanner() {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshTimerRef = useRef(null);

  const fetchTrends = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/trends');
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
    refreshTimerRef.current = setInterval(fetchTrends, 10 * 60 * 1000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [fetchTrends]);

  const renderSection = (key, items) => {
    if (!items || items.length === 0) return null;
    switch (key) {
      case 'reddit': return items.map(p => <RedditItem key={p.id} post={p} color="orange" />);
      case 'wsb': return items.map(p => <RedditItem key={p.id} post={p} color="lime" />);
      case 'x': return items.map(t => <XItem key={t.id} topic={t} />);
      case 'hackerNews': return items.map(s => <HNItem key={s.id} story={s} />);
      case 'news': return items.map(a => <NewsItem key={a.id} article={a} />);
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-white tracking-tight">Trend Scanner</h1>
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          {trends?.fromCache && <span className="text-[9px] text-emerald-400/50 uppercase tracking-wider">cached</span>}
        </div>
        <button
          onClick={() => { setLoading(true); fetchTrends(); }}
          disabled={loading}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'none' }}>
        {loading && !trends ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <p className="text-xs text-white/40">Scanning feeds...</p>
          </div>
        ) : error && !trends ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-xs text-white/50">{error}</p>
            <button
              onClick={() => { setLoading(true); fetchTrends(); }}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-xs text-white/70 hover:text-white"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-5">
            {SECTIONS.map(({ key, label, color }) => {
              const items = trends?.[key];
              if (!items || items.length === 0) return (
                <div key={key} className="min-w-0">
                  <h2 className={`text-sm font-bold ${color} mb-3 uppercase tracking-wider`}>{label}</h2>
                  <p className="text-xs text-white/25">No data</p>
                </div>
              );
              return (
                <div key={key} className="min-w-0">
                  <h2 className={`text-sm font-bold ${color} mb-3 uppercase tracking-wider`}>{label}</h2>
                  <div className="space-y-3">
                    {renderSection(key, items)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
