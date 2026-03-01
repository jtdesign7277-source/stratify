import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Newspaper, ChevronDown, BarChart3, RefreshCw } from 'lucide-react';
import TodaysNews from 'components/dashboard/TodaysNews';
import WatchlistPanel from './WatchlistPanel';
import IndexCards from './IndexCards';

const dedupeArticles = (rows = []) => {
  const seen = new Set();

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const title = String(row?.title || '').trim().toLowerCase();
    const source = String(row?.source || '').trim().toLowerCase();
    const url = String(row?.url || '').trim().toLowerCase().replace(/[?#].*$/, '');
    const key = `${title}|${source}|${url}`;
    if (!title && !url) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatPublishedDateTime = (value) => {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ─── History View ─────────────────────────────────────────
export const HistoryView = ({ history, loading, onClear, onArticleClick }) => {
  const relTime = (iso) => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(ms / 3600000);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(ms / 86400000);
    return `${d}d ago`;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`hist-sk-${i}`} className="rounded-xl border border-white/6 bg-white/2 p-3 animate-pulse">
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-lg bg-white/6 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/6 rounded w-3/4" />
                <div className="h-2.5 bg-white/4 rounded w-1/2" />
                <div className="h-2 bg-white/4 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
        <Clock3 className="w-10 h-10 text-[#7d8590] mb-3" strokeWidth={1.2} />
        <div className="text-sm font-medium text-[#e6edf3] mb-1">No history yet</div>
        <div className="text-xs text-[#7d8590]">Articles and content you click will appear here.</div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs uppercase tracking-widest text-[#7d8590]">Recent</span>
        <button type="button" onClick={onClear} className="text-xs text-[#f85149] hover:text-[#ff7b72] transition">Clear All</button>
      </div>
      {history.map((item, idx) => (
        <button
          type="button"
          key={`${item.content_type}-${item.content_id}-${idx}`}
          onClick={() => onArticleClick?.({
            title: item.title || 'Untitled',
            source: item.source || 'History',
            url: item.url,
            summary: item.description || '',
            image: item.thumbnail_url || null,
            category: 'NEWS',
          })}
          className="w-full text-left flex gap-3 rounded-xl border border-white/6 bg-white/2 p-3 hover:bg-white/4 transition-colors group"
        >
          {item.thumbnail_url ? (
            <img src={item.thumbnail_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-white/4" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-white/6 flex-shrink-0 flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-[#7d8590]" strokeWidth={1.2} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#e6edf3] line-clamp-2 group-hover:text-[#58a6ff] transition-colors">{item.title || 'Untitled'}</div>
            <div className="flex items-center gap-2 mt-1">
              {item.source && <span className="text-xs text-[#7d8590]">{item.source}</span>}
              <span className="text-xs text-[#7d8590]">{relTime(item.clicked_at)}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

// ─── Discover View ────────────────────────────────────────
export const DiscoverView = ({ data, loading, onArticleClick }) => {
  if (loading || !data) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`disc-story-sk-${i}`} className="rounded-xl border border-white/6 bg-white/2 p-3 animate-pulse">
            <div className="h-3 bg-white/6 rounded w-3/4 mb-2" />
            <div className="h-2.5 bg-white/4 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  const stories = dedupeArticles(data.topStories || []);

  return (
    <div className="p-3 space-y-4">
      {stories.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Top Stories</div>
          <div className="space-y-2">
            {stories.map((story, idx) => (
              <button
                type="button"
                key={`story-${idx}`}
                onClick={() => onArticleClick?.({
                  title: story.title || 'Untitled',
                  source: story.source || 'News',
                  url: story.url,
                  summary: story.description || '',
                  image: story.thumbnailUrl || null,
                  time: formatPublishedDateTime(story.publishedAt),
                  publishedAt: story.publishedAt || null,
                  category: 'NEWS',
                })}
                className="w-full text-left flex gap-3 rounded-xl border border-white/6 bg-white/2 p-3 hover:bg-white/4 transition-colors group"
              >
                {story.thumbnailUrl ? (
                  <img src={story.thumbnailUrl} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0 bg-white/4" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-white/6 flex-shrink-0 flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-[#7d8590]" strokeWidth={1.2} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e6edf3] line-clamp-2 group-hover:text-[#58a6ff] transition-colors">{story.title}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#7d8590] mt-1">
                    <span>{story.source}{story.sourcesCount > 1 ? ` +${story.sourcesCount - 1} sources` : ''}</span>
                    {formatPublishedDateTime(story.publishedAt) ? (
                      <span>• {formatPublishedDateTime(story.publishedAt)}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Spaces View ──────────────────────────────────────────
export const SpacesView = () => (
  <div className="h-full flex flex-col">
    <div className="px-3 pt-3 pb-2">
      <div className="text-xs uppercase tracking-widest text-[#7d8590]">Spaces</div>
    </div>
    <div className="flex-1 min-h-0">
      <iframe
        src="https://syndication.twitter.com/srv/timeline-profile/screen-name/stratify_hq?dnt=true&embedId=twitter-widget-0&frame=false&hideBorder=true&hideFooter=true&hideHeader=true&hideScrollBar=false&lang=en&theme=dark&transparent=true"
        title="Stratify on X"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
      />
    </div>
  </div>
);

// ─── Finance View ─────────────────────────────────────────
export const FinanceView = ({ onArticleClick }) => {
  const [articles, setArticles] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(false);

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError(false);
    try {
      const res = await fetch('/api/search?q=financial+market+news');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setArticles(dedupeArticles(Array.isArray(data.articles) ? data.articles : []));
    } catch {
      setNewsError(true);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchNews(); }, [fetchNews]);

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#58a6ff]" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-[#e6edf3]">Finance</span>
          {!newsLoading && articles.length > 0 && (
            <span className="text-xs text-[#7d8590] bg-white/5 rounded-full px-2 py-0.5">{articles.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={fetchNews}
          disabled={newsLoading}
          className="text-[#7d8590] hover:text-[#e6edf3] transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${newsLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Index cards — self-fetching */}
      <div>
        <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Indices</div>
        <IndexCards />
      </div>

      {/* Latest financial news */}
      <div>
        <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Latest News</div>

        {newsLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-white/6 bg-white/2 p-3 animate-pulse h-[90px]" />
            ))}
          </div>
        )}

        {!newsLoading && newsError && (
          <div className="text-xs text-[#7d8590] text-center py-6">
            Couldn't load news. <button type="button" onClick={fetchNews} className="text-[#58a6ff] hover:underline">Retry</button>
          </div>
        )}

        {!newsLoading && !newsError && articles.length === 0 && (
          <div className="text-xs text-[#7d8590] text-center py-6">No articles found.</div>
        )}

        {!newsLoading && articles.map((article) => (
          <button
            type="button"
            key={article.id || article.url}
            onClick={() => onArticleClick?.({
              title: article.title || 'Untitled',
              source: article.source || 'Marketaux',
              url: article.url,
              summary: article.description || '',
              image: article.image || null,
              tickers: Array.isArray(article.tickers) ? article.tickers : [],
              category: 'NEWS',
            })}
            className="w-full text-left rounded-xl border border-white/6 bg-white/2 p-3 mb-2 hover:bg-white/4 transition-colors"
          >
            <div className="flex gap-3">
              {article.image && (
                <img
                  src={article.image}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-white/4"
                  loading="lazy"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {(article.tickers || []).slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">${t}</span>
                  ))}
                  <span className="text-[10px] text-[#7d8590]">{article.source} · {article.timeAgo}</span>
                </div>
                <div className="text-sm font-medium text-[#e6edf3] line-clamp-2 leading-snug">
                  {article.title}
                </div>
                {article.description && (
                  <div className="text-xs text-[#7d8590] mt-1 line-clamp-1">{article.description}</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Right Sidebar ────────────────────────────────────────
export const RightSidebar = ({ onArticleClick, onTickerClick }) => {
  const [newsOpen, setNewsOpen] = useState(true);
  const [newsPanelHeight, setNewsPanelHeight] = useState(400);
  const newsPanelRef = React.useRef(null);
  const isNewsDragging = React.useRef(false);

  const handleNewsResizeStart = React.useCallback((e) => {
    e.preventDefault();
    isNewsDragging.current = true;

    const onMouseMove = (moveEvent) => {
      if (!isNewsDragging.current || !newsPanelRef.current) return;
      const rect = newsPanelRef.current.getBoundingClientRect();
      const newH = moveEvent.clientY - rect.top;
      setNewsPanelHeight(Math.min(800, Math.max(150, newH)));
    };

    const onMouseUp = () => {
      isNewsDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className="hidden lg:flex w-[340px] h-full min-h-0 flex-col"
    >
      <div className="pr-1 flex flex-col gap-3 overflow-y-auto">
        {/* ── Watchlist panel ── */}
        <WatchlistPanel onTickerClick={onTickerClick} />

        {/* ── News panel ── */}
        <div className="flex flex-col rounded-xl border border-white/6 bg-white/2 overflow-hidden flex-shrink-0">
          <button
            type="button"
            onClick={() => setNewsOpen((prev) => !prev)}
            className="flex items-center justify-between w-full px-3 py-2 hover:bg-white/4 transition-colors flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <Newspaper className="w-3.5 h-3.5 text-[#7d8590]" strokeWidth={1.5} />
              <div className="text-left">
                <div className="text-xs font-semibold text-[#e6edf3] leading-tight">TODAY'S NEWS</div>
                <div className="text-[10px] text-[#7d8590] leading-tight">Trending on the web</div>
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-[#7d8590] transition-transform duration-200 ${newsOpen ? '' : '-rotate-90'}`} strokeWidth={1.5} />
          </button>

          {newsOpen && (
            <>
              <div
                ref={newsPanelRef}
                className="overflow-y-auto"
                style={{ height: newsPanelHeight + 'px' }}
              >
                <TodaysNews hideHeader onArticleClick={onArticleClick} />
              </div>
              <div
                onMouseDown={handleNewsResizeStart}
                className="h-1.5 w-full cursor-row-resize group flex-shrink-0"
              >
                <div className="w-10 h-1 rounded-full bg-white/10 group-hover:bg-[#58a6ff]/50 mx-auto transition-colors mt-px" />
              </div>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
};
