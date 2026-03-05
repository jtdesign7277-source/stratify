// /src/components/dashboard/NewsFeedPanel.jsx
// News feed panel for TradePage — shows sentiment-tagged articles for selected ticker
// Sits below the chart or as a toggleable panel

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowLeft, ExternalLink, RefreshCw, X } from 'lucide-react';
import { useNews, useTrending, getSentimentColor, getSentimentLabel } from '../../hooks/useMarketAux';

// ─── Single Article Row ─────────────────────────────────────
function ArticleRow({ article, onOpen }) {
  const colors = getSentimentColor(article.sentiment);
  const timeAgo = getTimeAgo(article.publishedAt);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(article)}
      className="group flex gap-3 p-3 rounded-lg hover:bg-white/[0.03] transition-all duration-200
                 border border-transparent hover:border-white/[0.06] cursor-pointer"
    >
      {/* Sentiment indicator bar */}
      <div className="flex-shrink-0 w-1 rounded-full self-stretch mt-0.5"
           style={{
             backgroundColor: article.sentiment >= 0.2
               ? 'rgba(52, 211, 153, 0.6)'
               : article.sentiment <= -0.2
               ? 'rgba(248, 113, 113, 0.6)'
               : 'rgba(107, 114, 128, 0.3)',
           }}
      />

      <div className="flex-1 min-w-0">
        {/* Title */}
        <h4 className="text-[13px] font-medium text-gray-200 leading-snug
                        group-hover:text-white transition-colors line-clamp-2">
          {article.title}
        </h4>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5">
          {/* Source */}
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
            {formatSource(article.source)}
          </span>

          <span className="text-gray-700">·</span>

          {/* Time */}
          <span className="text-[10px] text-gray-600">{timeAgo}</span>

          <span className="text-gray-700">·</span>

          {/* Sentiment pill */}
          {article.sentiment !== null && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
                              font-mono font-medium ${colors.bg} ${colors.text}`}>
              {article.sentiment > 0 ? '+' : ''}{article.sentiment.toFixed(2)}
            </span>
          )}

          {/* Entity tags */}
          {article.entities?.slice(0, 3).map((entity) => (
            <span
              key={entity.symbol}
              className="text-[10px] text-blue-400/70 font-mono"
            >
              ${entity.symbol}
            </span>
          ))}
        </div>

        {/* Highlight snippet (if available) */}
        {article.highlight && (
          <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-1 leading-relaxed"
             dangerouslySetInnerHTML={{ __html: cleanHighlight(article.highlight) }}
          />
        )}
      </div>

      {/* External link icon */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
                       self-center">
        <ExternalLink className="w-3.5 h-3.5 text-gray-600" strokeWidth={1.5} />
      </div>
    </button>
  );
}

// ─── Trending Ticker Pill ───────────────────────────────────
function TrendingPill({ ticker, onClick }) {
  const colors = getSentimentColor(ticker.sentiment);

  return (
    <button
      onClick={() => onClick(ticker.symbol)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]
                   font-medium border transition-all duration-200 hover:scale-105
                   ${colors.bg} ${colors.border} ${colors.text}
                   hover:brightness-125 cursor-pointer`}
    >
      <span className="font-mono font-semibold">${ticker.symbol}</span>
      <span className="text-[9px] opacity-70">{ticker.totalDocs} articles</span>
    </button>
  );
}

// ─── Filter Tabs ────────────────────────────────────────────
function FilterTabs({ active, onChange }) {
  const tabs = [
    { key: 'all', label: 'All News' },
    { key: 'bullish', label: 'Bullish' },
    { key: 'bearish', label: 'Bearish' },
  ];

  return (
    <div className="flex gap-1 p-0.5 bg-white/[0.03] rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200
            ${active === tab.key
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main NewsFeedPanel ─────────────────────────────────────
export default function NewsFeedPanel({
  selectedSymbol = 'AAPL',
  onSymbolChange,
  onArticleOpenChange,
  className = '',
}) {
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('news'); // 'news' | 'trending'
  const [activeArticle, setActiveArticle] = useState(null);
  const { articles, loading, error, refetch } = useNews(selectedSymbol, { limit: 15 });
  const { trending, loading: trendingLoading } = useTrending();

  const openArticle = useCallback((article) => {
    setActiveArticle(article);
    onArticleOpenChange?.(true);
  }, [onArticleOpenChange]);

  const closeArticle = useCallback(() => {
    setActiveArticle(null);
    onArticleOpenChange?.(false);
  }, [onArticleOpenChange]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Filter articles by sentiment
  const filteredArticles = useMemo(() => {
    if (filter === 'all') return articles;
    if (filter === 'bullish') return articles.filter((a) => a.sentiment >= 0.2);
    if (filter === 'bearish') return articles.filter((a) => a.sentiment <= -0.2);
    return articles;
  }, [articles, filter]);

  useEffect(() => {
    setActiveArticle(null);
    onArticleOpenChange?.(false);
  }, [selectedSymbol, activeTab, onArticleOpenChange]);

  const articleKey = activeArticle ? (activeArticle.uuid || activeArticle.url || activeArticle.title || '') : '';

  return (
    <div className={`soft-glass-surface flex flex-col min-h-0 bg-[#0b0b0b] border-t border-white/[0.06] ${className}`}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {/* News / Trending toggle */}
          <div className="flex gap-1 p-0.5 bg-white/[0.03] rounded-lg">
            <button
              onClick={() => setActiveTab('news')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all
                ${activeTab === 'news'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
                News
              </span>
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all
                ${activeTab === 'trending'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
                Trending
              </span>
            </button>
          </div>

          {/* Ticker context */}
          {activeTab === 'news' && (
            <span className="text-[11px] text-gray-500">
              for <span className="text-blue-400 font-mono font-medium">${selectedSymbol}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'news' && <FilterTabs active={filter} onChange={setFilter} />}

          {/* Refresh button — only when list is shown */}
          {activeTab === 'news' && !activeArticle && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRefresh(); }}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-white/5 text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-all duration-200"
              title="Refresh news"
              aria-label="Refresh news"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Content — scrollable list and article; no scrollbars, natural trackpad/wheel scroll */}
      <div
        className="flex flex-1 min-h-0 flex-col overflow-hidden"
        style={activeArticle ? undefined : { maxHeight: '400px' }}
      >
        {activeTab === 'news' ? (
          <>
            {loading && !articles.length ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-[11px] text-gray-600">Loading news...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span className="text-[11px] text-red-400/70">Failed to load news</span>
                <button onClick={refetch} className="text-[10px] text-blue-400 hover:underline">Try again</button>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <span className="text-[11px] text-gray-600">
                  No {filter !== 'all' ? filter : ''} articles found for ${selectedSymbol}
                </span>
              </div>
            ) : activeArticle ? (
              /* Split screen: list left, article right */
              <div className="flex flex-1 min-h-0 min-w-0">
                {/* Left: article list — natural scroll, no scrollbar */}
                <div className="scrollbar-hide flex-shrink-0 w-[45%] min-w-0 border-r border-white/[0.06] overflow-y-auto overflow-x-hidden">
                  <div className="divide-y divide-white/[0.03]">
                    {filteredArticles.map((article) => (
                      <ArticleRow
                        key={article.uuid}
                        article={article}
                        onOpen={openArticle}
                      />
                    ))}
                  </div>
                </div>
                {/* Right: selected article — natural scroll, no scrollbar */}
                <div
                  key={articleKey}
                  className="scrollbar-hide flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4"
                >
                  <div className="flex items-center justify-end gap-2 mb-3">
                    <button
                      type="button"
                      onClick={closeArticle}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      aria-label="Close article"
                    >
                      <X className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      Close
                    </button>
                  </div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">
                    {formatSource(activeArticle.source)} · {getTimeAgo(activeArticle.publishedAt)}
                  </p>
                  <h3 className="mt-1.5 text-[17px] font-semibold leading-snug text-white">
                    {activeArticle.title}
                  </h3>
                  {activeArticle.imageUrl ? (
                    <img
                      key={`img-${articleKey}`}
                      src={activeArticle.imageUrl}
                      alt={activeArticle.title}
                      className="mt-3 mb-4 w-full rounded-lg object-cover max-h-[220px]"
                    />
                  ) : null}
                  {activeArticle.description ? (
                    <p className="text-gray-300 text-[15px] leading-relaxed mb-4">{activeArticle.description}</p>
                  ) : null}
                  {activeArticle.content ? (
                    <>
                      <div className="my-4 border-t border-white/[0.06]" />
                      <p className="text-gray-300 text-[15px] leading-relaxed whitespace-pre-line">{activeArticle.content}</p>
                    </>
                  ) : activeArticle.snippet ? (
                    <>
                      <div className="my-4 border-t border-white/[0.06]" />
                      <p className="text-gray-300 text-[15px] leading-relaxed">{activeArticle.snippet}</p>
                    </>
                  ) : null}
                  {activeArticle.url ? (
                    <a
                      href={activeArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-400 hover:text-blue-300"
                    >
                      Open source article
                      <ExternalLink className="h-4 w-4" strokeWidth={1.7} />
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="divide-y divide-white/[0.03]">
                  {filteredArticles.map((article) => (
                    <ArticleRow key={article.uuid} article={article} onOpen={openArticle} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Trending tab */
          <div className="p-4">
            <p className="text-[11px] text-gray-500 mb-3">
              Tickers with the most news activity right now
            </p>
            {trendingLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500
                                rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trending.map((t) => (
                  <TrendingPill
                    key={t.symbol}
                    ticker={t}
                    onClick={(sym) => {
                      onSymbolChange?.(sym);
                      setActiveTab('news');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function formatSource(source) {
  if (!source) return '';
  return source
    .replace(/^www\./, '')
    .replace(/\.com$|\.org$|\.net$|\.co$/, '')
    .split('.')
    .pop();
}

function cleanHighlight(html) {
  // Strip <em> tags from MarketAux highlights, keep text
  return html
    .replace(/<\/?em>/g, '')
    .replace(/\[\+\d+ characters\]/g, '...');
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
