import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STORAGE_KEY = 'stratify-newsletter-archive';
const WEEK_ANCHOR_DAY = 2; // Tuesday
const DEFAULT_WEEKS = 4;

// ── Markdown → HTML converter ──
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^---$/gim, '<hr/>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => c.includes('---'))) return '';
      const isHeader = cells.every(c => !c.includes('¢') && !c.includes('%') && !c.includes('+'));
      const tag = isHeader ? 'th' : 'td';
      return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>)/gs, '<table>$1</table>')
    .replace(/<p><\/p>/g, '');
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getWeekAnchor(date) {
  const d = new Date(date);
  const diff = (d.getDay() - WEEK_ANCHOR_DAY + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildVideoContent(dateShort) {
  return `### Highlights\n- Macro check-in and rate expectations for the week of ${dateShort}\n- Sector rotation watch: financials, semis, and energy\n- Risk signals to monitor before Friday's close`;
}

function buildNewsletterContent(dateShort) {
  return `## Market Pulse\nSophia breaks down the key catalysts shaping sentiment for the week of ${dateShort}.\n\n## What mattered\n- Inflation data steadied risk appetite\n- Mega-cap earnings improved breadth\n- Volatility cooled as liquidity returned\n\n## Watchlist\n- NVDA, MSFT, XLF, XLK\n\n---\n### Actionable Takeaways\nStay selective, size smaller into earnings, and keep stops tight.`;
}

function createVideoItem(date, idSuffix) {
  const dateShort = formatDateShort(date);
  const dateLong = formatDateLong(date);
  return {
    id: `video-${idSuffix || date.toISOString().slice(0, 10)}`,
    title: `Week of ${dateShort}`,
    date: dateLong,
    type: 'video',
    content: buildVideoContent(dateShort),
    url: '',
  };
}

function createNewsletterItem(date, idSuffix) {
  const dateShort = formatDateShort(date);
  const dateLong = formatDateLong(date);
  const content = buildNewsletterContent(dateShort);
  return {
    id: `newsletter-${idSuffix || date.toISOString().slice(0, 10)}`,
    title: `Newsletter - ${dateShort}`,
    date: dateLong,
    type: 'newsletter',
    content,
    htmlContent: renderMarkdown(content),
  };
}

function normalizeItem(item, index) {
  if (!item || !item.type) return null;
  const next = { ...item };
  const parsed = parseDate(next.date) || new Date();
  const dateShort = formatDateShort(parsed);

  if (!next.id) {
    next.id = `${next.type}-${parsed.toISOString().slice(0, 10)}-${index}`;
  }
  if (!next.date) {
    next.date = formatDateLong(parsed);
  }
  if (!next.title) {
    next.title = next.type === 'video' ? `Week of ${dateShort}` : `Newsletter - ${dateShort}`;
  }

  if (next.type === 'video') {
    if (!next.content) {
      next.content = buildVideoContent(dateShort);
    }
    if (typeof next.url !== 'string') {
      next.url = '';
    }
  }

  if (next.type === 'newsletter') {
    if (!next.content) {
      next.content = buildNewsletterContent(dateShort);
    }
    if (!next.htmlContent) {
      next.htmlContent = renderMarkdown(next.content);
    }
  }

  return next;
}

function ensureWeeklyEntries(items) {
  const normalized = Array.isArray(items)
    ? items.map((item, index) => normalizeItem(item, index)).filter(Boolean)
    : [];
  const anchor = getWeekAnchor(new Date());
  const weekKeysByType = {
    video: new Set(),
    newsletter: new Set(),
  };

  normalized.forEach((item) => {
    if (!item?.type || !item?.date) return;
    const parsed = parseDate(item.date);
    if (!parsed) return;
    const key = getWeekAnchor(parsed).toISOString().slice(0, 10);
    if (weekKeysByType[item.type]) {
      weekKeysByType[item.type].add(key);
    }
  });

  const nextItems = [...normalized];
  for (let i = 0; i < DEFAULT_WEEKS; i += 1) {
    const weekDate = new Date(anchor);
    weekDate.setDate(anchor.getDate() - i * 7);
    const key = weekDate.toISOString().slice(0, 10);
    if (!weekKeysByType.video.has(key)) {
      nextItems.push(createVideoItem(weekDate));
    }
    if (!weekKeysByType.newsletter.has(key)) {
      nextItems.push(createNewsletterItem(weekDate));
    }
  }

  return nextItems;
}

function sortByDateDesc(a, b) {
  const dateA = parseDate(a?.date)?.getTime() || 0;
  const dateB = parseDate(b?.date)?.getTime() || 0;
  return dateB - dateA;
}

function getDisplayDate(item) {
  const parsed = parseDate(item?.date);
  return parsed ? formatDateShort(parsed) : item?.date || '';
}

// ── Newsletter Page ──
export default function NewsletterPage({ onClose }) {
  const [archiveItems, setArchiveItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showVideos, setShowVideos] = useState(true);
  const [showNewsletters, setShowNewsletters] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setArchiveItems(ensureWeeklyEntries(parsed));
      } catch (err) {
        setArchiveItems(ensureWeeklyEntries([]));
      }
    } else {
      setArchiveItems(ensureWeeklyEntries([]));
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(archiveItems));
  }, [archiveItems, hasLoaded]);

  const selectedItem = useMemo(
    () => archiveItems.find((item) => item.id === selectedId) || null,
    [archiveItems, selectedId]
  );

  const videoItems = useMemo(
    () => archiveItems.filter((item) => item.type === 'video').sort(sortByDateDesc),
    [archiveItems]
  );

  const newsletterItems = useMemo(
    () => archiveItems.filter((item) => item.type === 'newsletter').sort(sortByDateDesc),
    [archiveItems]
  );

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 4000);
      setEmail('');
    }
  };

  const handleAddEntry = (type) => {
    const now = new Date();
    const idSuffix = String(Date.now());
    const newItem = type === 'video'
      ? createVideoItem(now, idSuffix)
      : createNewsletterItem(now, idSuffix);
    setArchiveItems((prev) => [newItem, ...prev]);
    setSelectedId(newItem.id);
    setShowAddMenu(false);
  };

  return (
    <div className="h-full bg-[#060d18] flex flex-col">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-20 bg-[#060d18]/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onClose && (
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-lg font-bold tracking-tight">STRATIFY</span>
              <span className="text-white/20 text-lg font-light">|</span>
              <span className="text-white/60 text-sm tracking-widest uppercase">Weekly Archive</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Archive Sidebar ── */}
        <aside className="w-[280px] bg-[#0a1628] border-r border-gray-800 flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-300 text-sm font-semibold">📁 Archive</h3>
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu((prev) => !prev)}
                  className="w-7 h-7 rounded-full border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center text-sm"
                >
                  +
                </button>
                <AnimatePresence>
                  {showAddMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-800 bg-[#0f1c30] shadow-xl p-2 z-10"
                    >
                      <button
                        onClick={() => handleAddEntry('video')}
                        className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-white/5 rounded-md transition-colors"
                      >
                        Add Sophia video
                      </button>
                      <button
                        onClick={() => handleAddEntry('newsletter')}
                        className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-white/5 rounded-md transition-colors"
                      >
                        Add newsletter
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
            {/* Folder: Sophia Market Analysis */}
            <div>
              <button
                onClick={() => setShowVideos((prev) => !prev)}
                className="w-full flex items-center justify-between text-gray-400 text-xs tracking-wider uppercase"
              >
                <span className="flex items-center gap-2">
                  <span>📁</span>
                  Sophia Market Analysis
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showVideos ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <AnimatePresence initial={false}>
                {showVideos && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {videoItems.map((item) => {
                        const isActive = selectedId === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full text-left rounded-lg border-l-2 px-3 py-2.5 transition-colors ${
                              isActive
                                ? 'bg-blue-500/10 border-blue-400'
                                : 'border-transparent hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-8 rounded-md bg-[#0f213b] border border-white/10 flex items-center justify-center text-white/40 text-xs">
                                ▶
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs ${isActive ? 'text-blue-300' : 'text-gray-300'}`}>
                                    🎬
                                  </span>
                                  <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-white/70'}`}>
                                    {item.title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-white/40 mt-1">{getDisplayDate(item)}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Folder: Weekly Newsletter */}
            <div>
              <button
                onClick={() => setShowNewsletters((prev) => !prev)}
                className="w-full flex items-center justify-between text-gray-400 text-xs tracking-wider uppercase"
              >
                <span className="flex items-center gap-2">
                  <span>📁</span>
                  Weekly Newsletter
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showNewsletters ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <AnimatePresence initial={false}>
                {showNewsletters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {newsletterItems.map((item) => {
                        const isActive = selectedId === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full text-left rounded-lg border-l-2 px-3 py-2.5 transition-colors ${
                              isActive
                                ? 'bg-blue-500/10 border-blue-400'
                                : 'border-transparent hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`text-xs ${isActive ? 'text-blue-300' : 'text-gray-300'}`}>
                                📰
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-white/70'}`}>
                                  {item.title}
                                </p>
                                <p className="text-[11px] text-white/40 mt-1">{getDisplayDate(item)}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[960px] mx-auto px-6 py-8">
            {!selectedItem && (
              <div className="min-h-[60vh] flex items-center justify-center rounded-2xl border border-gray-800 bg-[#0a1628]">
                <p className="text-white/50">Select a document from the archive to view</p>
              </div>
            )}

            {selectedItem?.type === 'video' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-gray-400 text-xs tracking-widest uppercase">Sophia Market Analysis</span>
                  <span className="text-white/20">·</span>
                  <span className="text-white/50 text-xs">{selectedItem.date}</span>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-[#0a1628] p-6">
                  <div className="relative rounded-xl overflow-hidden bg-[#0b1d34] border border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10" />
                    <div className="relative aspect-video flex flex-col items-center justify-center text-white/50">
                      <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center bg-black/30">
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <p className="mt-4 text-sm">{selectedItem.title}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h1 className="text-2xl font-semibold text-white mb-3">{selectedItem.title}</h1>
                    <div className="newsletter-body">
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedItem.content) }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedItem?.type === 'newsletter' && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-gray-400 text-xs tracking-widest uppercase">Weekly Newsletter</span>
                  <span className="text-white/20">·</span>
                  <span className="text-white/50 text-xs">{selectedItem.date}</span>
                </div>

                <h1 className="text-3xl font-bold text-white leading-tight tracking-tight mb-6">
                  {selectedItem.title}
                </h1>

                <div className="newsletter-body">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: selectedItem.htmlContent || renderMarkdown(selectedItem.content),
                    }}
                  />
                </div>

                {/* ── Subscribe CTA ── */}
                <div className="pt-10">
                  <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0a1628]">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10" />
                    <div className="relative px-8 py-10 text-center">
                      <h3 className="text-xl font-semibold text-white mb-2">Never miss an issue</h3>
                      <p className="text-white/40 text-sm mb-6">Sophia delivers the weekly recap every Sunday at 6 PM ET</p>
                      <form onSubmit={handleSubscribe} className="flex items-center gap-3 max-w-md mx-auto">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-colors"
                        />
                        <button
                          type="submit"
                          className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-black font-semibold text-sm rounded-xl transition-colors whitespace-nowrap"
                        >
                          {subscribed ? '✓ Subscribed' : 'Subscribe'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Styles ── */}
      <style>{`
        .newsletter-body h2 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #fff;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          letter-spacing: -0.01em;
        }
        .newsletter-body h3 {
          font-size: 1.05rem;
          font-weight: 600;
          color: #60a5fa;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .newsletter-body p {
          color: rgba(255,255,255,0.65);
          line-height: 1.8;
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .newsletter-body strong {
          color: rgba(255,255,255,0.9);
          font-weight: 600;
        }
        .newsletter-body em {
          color: rgba(255,255,255,0.6);
        }
        .newsletter-body li {
          color: rgba(255,255,255,0.65);
          margin-bottom: 0.5rem;
          padding-left: 0.5rem;
          margin-left: 1.25rem;
          font-size: 0.95rem;
          line-height: 1.7;
        }
        .newsletter-body li::marker {
          color: rgba(96, 165, 250, 0.6);
        }
        .newsletter-body hr {
          border: none;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent);
          margin: 2.5rem 0;
        }
        .newsletter-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.25rem 0;
          font-size: 0.875rem;
        }
        .newsletter-body th {
          color: rgba(255,255,255,0.35);
          font-weight: 500;
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .newsletter-body td {
          color: rgba(255,255,255,0.75);
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .newsletter-body tr:hover td {
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
