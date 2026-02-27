import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock3, Newspaper, ChevronDown } from 'lucide-react';
import TodaysNews from 'components/dashboard/TodaysNews';

// ─── History View ─────────────────────────────────────────
export const HistoryView = ({ history, loading, onClear }) => {
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
        <a
          key={`${item.content_type}-${item.content_id}-${idx}`}
          href={item.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 rounded-xl border border-white/6 bg-white/2 p-3 hover:bg-white/4 transition-colors group"
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
        </a>
      ))}
    </div>
  );
};

// ─── Discover View ────────────────────────────────────────
export const DiscoverView = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="p-4 space-y-4">
        <div className="rounded-xl border border-white/6 bg-white/2 p-4 animate-pulse">
          <div className="h-4 bg-white/6 rounded w-1/3 mb-3" />
          <div className="h-16 bg-white/4 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`disc-sk-${i}`} className="rounded-xl border border-white/6 bg-white/2 p-3 animate-pulse">
              <div className="h-3 bg-white/6 rounded w-1/2 mb-2" />
              <div className="h-5 bg-white/4 rounded w-2/3" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`disc-story-sk-${i}`} className="rounded-xl border border-white/6 bg-white/2 p-3 animate-pulse">
            <div className="h-3 bg-white/6 rounded w-3/4 mb-2" />
            <div className="h-2.5 bg-white/4 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  const weather = data.weather;
  const outlook = data.marketOutlook || [];
  const stories = data.topStories || [];

  return (
    <div className="p-3 space-y-4">
      {weather && weather.temp != null && (
        <div className="rounded-xl border border-white/6 bg-white/2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[#7d8590] uppercase tracking-wider mb-1">{weather.location}</div>
              <div className="text-3xl font-bold text-[#e6edf3]">{weather.temp}°F</div>
              <div className="text-sm text-[#7d8590] mt-0.5">{weather.condition}</div>
            </div>
            <div className="text-right text-xs text-[#7d8590] space-y-0.5">
              {weather.high != null && <div>H: {weather.high}°</div>}
              {weather.low != null && <div>L: {weather.low}°</div>}
              {weather.humidity != null && <div>{weather.humidity}% humidity</div>}
            </div>
          </div>
        </div>
      )}

      {outlook.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Market Outlook</div>
          <div className="grid grid-cols-2 gap-2">
            {outlook.map((item) => {
              const isPositive = (item.changePercent || 0) >= 0;
              return (
                <div key={item.symbol} className="rounded-xl border border-white/6 bg-white/2 p-3">
                  <div className="text-xs text-[#7d8590] mb-1">{item.name}</div>
                  <div className="text-base font-semibold text-[#e6edf3]">
                    {item.value != null ? item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </div>
                  {item.changePercent != null && (
                    <div className={`text-xs font-medium mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-[#f85149]'}`}>
                      {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stories.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Top Stories</div>
          <div className="space-y-2">
            {stories.map((story, idx) => (
              <a
                key={`story-${idx}`}
                href={story.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-xl border border-white/6 bg-white/2 p-3 hover:bg-white/4 transition-colors group"
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
                  <div className="text-xs text-[#7d8590] mt-1">{story.source}{story.sourcesCount > 1 ? ` +${story.sourcesCount - 1} sources` : ''}</div>
                </div>
              </a>
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
export const FinanceView = ({ data, loading }) => {
  const [expandedHeadline, setExpandedHeadline] = useState(null);

  if (loading || !data) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`fin-idx-sk-${i}`} className="rounded-xl border border-white/6 bg-white/2 p-3 animate-pulse">
              <div className="h-3 bg-white/6 rounded w-1/2 mb-2" />
              <div className="h-5 bg-white/4 rounded w-2/3 mb-2" />
              <div className="h-8 bg-white/4 rounded" />
            </div>
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`fin-hl-sk-${i}`} className="rounded-xl border border-white/6 bg-white/2 p-3 animate-pulse">
            <div className="h-3 bg-white/6 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const indices = data.indices || [];
  const headlines = data.marketSummary || [];
  const trending = data.trendingCompanies || [];

  return (
    <div className="p-3 space-y-4">
      {indices.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Indices</div>
          <div className="grid grid-cols-2 gap-2">
            {indices.map((idx) => {
              const isPositive = (idx.changePercent || 0) >= 0;
              const sparkline = idx.sparkline || [];
              const sparkMin = Math.min(...(sparkline.length > 0 ? sparkline : [0]));
              const sparkMax = Math.max(...(sparkline.length > 0 ? sparkline : [1]));
              const sparkRange = sparkMax - sparkMin || 1;
              const sparkPoints = sparkline.map((v, i) => `${(i / Math.max(sparkline.length - 1, 1)) * 100},${100 - ((v - sparkMin) / sparkRange) * 100}`).join(' ');

              return (
                <div key={idx.symbol} className="rounded-xl border border-white/6 bg-white/2 p-3">
                  <div className="text-xs text-[#7d8590] mb-1">{idx.name}</div>
                  <div className="text-base font-semibold text-[#e6edf3]">
                    {idx.value != null ? idx.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </div>
                  <div className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-[#f85149]'}`}>
                    {idx.changePercent != null ? `${isPositive ? '+' : ''}${idx.changePercent.toFixed(2)}%` : '—'}
                  </div>
                  {sparkline.length > 2 && (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8 mt-2">
                      <polyline
                        points={sparkPoints}
                        fill="none"
                        stroke={isPositive ? '#34d399' : '#f85149'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {headlines.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Market Summary</div>
          <div className="space-y-1">
            {headlines.map((hl, idx) => {
              const isOpen = expandedHeadline === idx;
              return (
                <div key={`hl-${idx}`} className="rounded-xl border border-white/6 bg-white/2 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedHeadline(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-white/3 transition-colors"
                  >
                    <span className="text-sm text-[#e6edf3] font-medium line-clamp-1 flex-1 mr-2">{hl.headline}</span>
                    <ChevronDown className={`w-4 h-4 text-[#7d8590] flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 text-xs text-[#7d8590] space-y-1">
                          <div>{hl.snippet}</div>
                          <div className="flex items-center gap-2">
                            <span>{hl.source}</span>
                            {hl.url && <a href={hl.url} target="_blank" rel="noopener noreferrer" className="text-[#58a6ff] hover:underline">Read more</a>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {trending.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-[#7d8590] px-1 mb-2">Trending Companies</div>
          <div className="space-y-1">
            {trending.map((co) => {
              const isPositive = (co.changePercent || 0) >= 0;
              return (
                <div key={co.ticker} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 p-3">
                  {co.logoUrl ? (
                    <img src={co.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white/4 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-white/6 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#e6edf3]">{co.name}</div>
                    <div className="text-xs text-[#7d8590]">{co.ticker}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#e6edf3]">
                      {co.price != null ? `$${co.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </div>
                    {co.changePercent != null && (
                      <div className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-[#f85149]'}`}>
                        {isPositive ? '+' : ''}{co.changePercent.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Right Sidebar ────────────────────────────────────────
export const RightSidebar = () => {
  const [newsOpen, setNewsOpen] = useState(true);
  const [panelHeight, setPanelHeight] = useState(400);
  const panelRef = React.useRef(null);
  const isDragging = React.useRef(false);

  const handleResizeStart = React.useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (moveEvent) => {
      if (!isDragging.current || !panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const newH = moveEvent.clientY - rect.top;
      setPanelHeight(Math.min(800, Math.max(150, newH)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
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
      className="hidden xl:flex w-[340px] h-full min-h-0 flex-col"
    >
      <div className="h-full flex-1 min-h-0 pr-1 flex flex-col">
        <div className="flex flex-col min-h-0 rounded-xl border border-white/6 bg-white/2 overflow-hidden">
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
                ref={panelRef}
                className="overflow-y-auto"
                style={{ height: panelHeight + 'px' }}
              >
                <TodaysNews hideHeader />
              </div>
              <div
                onMouseDown={handleResizeStart}
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
