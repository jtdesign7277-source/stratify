import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, Clock3, Radio, Volume2 } from 'lucide-react';

const SECTION_BADGE_STYLES = {
  '🔥': 'bg-red-500/15 text-red-200 border-red-400/30',
  '📈': 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  '💰': 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30',
  '🔵': 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  '🟠': 'bg-orange-500/15 text-orange-200 border-orange-400/30',
  '🐦': 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  '🦍': 'bg-violet-500/15 text-violet-200 border-violet-400/30',
  '🚀': 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30',
  '💻': 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  '🏈': 'bg-lime-500/15 text-lime-200 border-lime-400/30',
  '💎': 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30',
};

const SECTION_HEADER_REGEX = /^(?:#{1,3}\s*)?([🔥📈💰🔵🟠🐦🦍🚀💻🏈💎])\s*(.+)$/u;
const LAST_VIEWED_KEY = 'lastViewedMarketIntel';
const LEGACY_LAST_VIEWED_KEY = 'stratify-market-intel-last-viewed';
const VOICE_PREF_KEY = 'stratify-market-intel-voice';

const stripMarkdown = (md = '') =>
  String(md)
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/[-*_]{3,}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sanitizeUrl = (rawUrl = '') => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {}
  return '#';
};

const applyInlineFormatting = (value = '') => {
  let text = value;
  text = text.replace(/`([^`]+)`/g, '<code class="market-inline-code">$1</code>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="market-strong">$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em class="market-em">$1</em>');
  text = text.replace(/(^|[^A-Za-z0-9])(\$[A-Z]{1,5}\b)/g, '$1<span class="market-ticker">$2</span>');
  return text;
};

const formatInline = (raw = '') => {
  const source = String(raw || '');
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

  let html = '';
  let cursor = 0;
  let match;

  while ((match = linkRegex.exec(source)) !== null) {
    const [fullMatch, label, url] = match;
    html += applyInlineFormatting(escapeHtml(source.slice(cursor, match.index)));
    html += `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer" class="market-link">${applyInlineFormatting(escapeHtml(label))}</a>`;
    cursor = match.index + fullMatch.length;
  }

  html += applyInlineFormatting(escapeHtml(source.slice(cursor)));
  return html;
};

const renderReportMarkdown = (raw = '') => {
  if (!raw || !String(raw).trim()) {
    return '<p class="market-paragraph">No report content available.</p>';
  }

  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push(`<ul class="market-list">${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList();
      html.push('<hr class="market-divider" />');
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_HEADER_REGEX);
    if (sectionMatch) {
      flushList();
      const emoji = sectionMatch[1];
      const label = sectionMatch[2] || '';
      const styleClass = SECTION_BADGE_STYLES[emoji] || 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30';
      html.push(`<div class="market-section-header ${styleClass}">${emoji} ${formatInline(label)}</div>`);
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      flushList();
      html.push(`<h3 class="market-h3">${formatInline(trimmed.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      flushList();
      html.push(`<h2 class="market-h2">${formatInline(trimmed.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      flushList();
      html.push(`<h1 class="market-h1">${formatInline(trimmed.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      listItems.push(formatInline(line.replace(/^\s*[-*]\s+/, '')));
      continue;
    }

    flushList();
    html.push(`<p class="market-paragraph">${formatInline(trimmed)}</p>`);
  }

  flushList();
  return html.join('');
};

const normalizeSources = (rawSources) => {
  if (!rawSources) return [];

  if (Array.isArray(rawSources)) {
    return rawSources
      .map((source) => (typeof source === 'string' ? source : source?.name || source?.source || ''))
      .map((source) => String(source).trim())
      .filter(Boolean);
  }

  if (typeof rawSources === 'string') {
    const trimmed = rawSources.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeSources(parsed);
      if (parsed && typeof parsed === 'object') return normalizeSources(Object.values(parsed));
    } catch {}

    return trimmed
      .split(/[|,]/)
      .map((source) => source.trim())
      .filter(Boolean);
  }

  if (typeof rawSources === 'object') {
    return normalizeSources(Object.values(rawSources));
  }

  return [];
};

const toTimestamp = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateTime = (value) => {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Unknown time';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const normalizeReport = (report, index) => {
  const createdAt = report?.created_at || new Date().toISOString();
  const reportContent = String(report?.report_content || report?.content || '').trim();
  const fallbackHeadline = reportContent
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#{1,3}\s+/, '')
    ?.slice(0, 120);

  return {
    id: report?.id || `market-intel-${index}`,
    headline: String(report?.headline || fallbackHeadline || 'Market Intel Update').trim(),
    report_content: reportContent,
    sources: normalizeSources(report?.sources),
    created_at: createdAt,
  };
};

export default function MarketIntelPage({ onClose, onViewed }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showArchive, setShowArchive] = useState(true);
  const [expandedReportIds, setExpandedReportIds] = useState([]);

  // Sophia voice narration state
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/market-intel');
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        const payload = await response.json();
        const normalized = Array.isArray(payload)
          ? payload.map((report, index) => normalizeReport(report, index))
          : [];

        normalized.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));

        if (!cancelled) {
          setReports(normalized);
          setExpandedReportIds(normalized[1] ? [String(normalized[1].id)] : []);

          const latestTimestamp = toTimestamp(normalized[0]?.created_at);
          if (latestTimestamp) {
            try {
              localStorage.setItem(LAST_VIEWED_KEY, String(latestTimestamp));
              localStorage.setItem(LEGACY_LAST_VIEWED_KEY, String(latestTimestamp));
            } catch {}
          }

          if (typeof onViewed === 'function' && normalized[0]?.created_at) {
            onViewed(normalized[0].created_at);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load market intelligence reports.');
          setReports([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [onViewed]);

  // Play / stop Sophia voice — triggered only by button click (user gesture)
  const handlePlaySophia = useCallback(async () => {
    // If playing, stop
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    const report = reports[0];
    if (!report?.report_content) return;

    const plainText = stripMarkdown(report.report_content).slice(0, 800);
    if (!plainText) return;

    setVoiceLoading(true);
    try {
      const res = await fetch('/api/sophia-speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const data = await res.json();
      if (!data.audio_url) throw new Error('No audio URL');

      const audio = new Audio(data.audio_url);
      audioRef.current = audio;
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('ended', () => { setIsPlaying(false); audioRef.current = null; });
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('error', () => { setIsPlaying(false); audioRef.current = null; });
      await audio.play();
    } catch (err) {
      console.error('Sophia voice error:', err);
      setIsPlaying(false);
    } finally {
      setVoiceLoading(false);
    }
  }, [isPlaying, reports]);

  const latestReport = reports[0] || null;
  const archivedReports = reports.slice(1);

  const renderedLatestHtml = useMemo(() => {
    return renderReportMarkdown(latestReport?.report_content || '');
  }, [latestReport]);

  const toggleArchivedReport = useCallback((reportId) => {
    setExpandedReportIds((previous) => {
      const key = String(reportId);
      if (previous.includes(key)) {
        return previous.filter((id) => id !== key);
      }
      return [...previous, key];
    });
  }, []);

  return (
    <div className="h-full bg-[#0b0b0b] overflow-y-auto">
      <div className="sticky top-0 z-20 bg-[#0b0b0b]/90 backdrop-blur-md border-b border-[#1f1f1f]">
        <div className="max-w-[960px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {onClose && (
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors" aria-label="Close market intel page">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white tracking-tight">Market Intel</h1>
                <p className="text-sm text-zinc-400">AI-powered market intelligence, updated every 2 hours</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePlaySophia}
              disabled={voiceLoading || (!reports[0] && !isPlaying)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs tracking-wide transition-colors rounded-lg border ${
                isPlaying
                  ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                  : voiceLoading
                    ? 'text-zinc-500 border-[#1f1f1f] bg-[#121212] cursor-wait'
                    : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
              }`}
              title={isPlaying ? 'Stop Sophia' : 'Listen to Sophia read the report'}
            >
              {voiceLoading ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>Loading...</span>
                </>
              ) : isPlaying ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>Playing — Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>▶ Play Sophia</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowArchive((previous) => !previous)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs tracking-wide uppercase text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg border border-[#1f1f1f] bg-[#121212]"
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchive ? 'Hide Archive' : 'Show Archive'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-6 py-8">
        {loading && (
          <div className="rounded-2xl border border-[#1f1f1f] bg-[#090909] p-6 text-zinc-400 text-sm">
            Loading market intelligence reports...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && !latestReport && (
          <div className="rounded-2xl border border-[#1f1f1f] bg-[#090909] p-6 text-zinc-400 text-sm">
            No market intelligence reports available yet.
          </div>
        )}

        {!loading && !error && latestReport && (
          <>
            <section className="mb-12">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-[11px] font-semibold text-emerald-300/90 tracking-widest uppercase">Latest Report</div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Clock3 className="w-3.5 h-3.5" />
                  {formatDateTime(latestReport.created_at)}
                </div>
              </div>

              <h2 className="text-3xl font-bold text-white tracking-tight mb-4">{latestReport.headline}</h2>

              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold tracking-wide uppercase text-emerald-300">Latest</span>
                {latestReport.sources.map((source) => (
                  <span key={`${latestReport.id}-${source}`} className="px-2 py-0.5 rounded border border-[#2a2a2a] bg-[#141414] text-[10px] text-zinc-300">
                    {source}
                  </span>
                ))}
              </div>

              <div className="rounded-2xl border border-[#1f1f1f] bg-[#090909] p-6">
                <div className="market-intel-body" dangerouslySetInnerHTML={{ __html: renderedLatestHtml }} />
              </div>
            </section>

            <section className="pb-16">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-semibold text-white">Archive</h3>
                <span className="text-xs text-zinc-500">{archivedReports.length} previous reports</span>
              </div>

              {!showArchive && (
                <div className="rounded-xl border border-[#1f1f1f] bg-[#090909] px-4 py-3 text-xs text-zinc-400">
                  Archive is hidden.
                </div>
              )}

              {showArchive && archivedReports.length === 0 && (
                <div className="rounded-xl border border-[#1f1f1f] bg-[#090909] px-4 py-3 text-xs text-zinc-400">
                  No previous reports yet.
                </div>
              )}

              {showArchive && archivedReports.length > 0 && (
                <div className="space-y-3">
                  {archivedReports.map((report) => {
                    const isExpanded = expandedReportIds.includes(String(report.id));
                    const renderedArchiveHtml = renderReportMarkdown(report.report_content || '');

                    return (
                      <article key={report.id} className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden">
                        <button
                          onClick={() => toggleArchivedReport(report.id)}
                          className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-white truncate">{report.headline}</h4>
                              <div className="mt-1 text-xs text-zinc-500">{formatDateTime(report.created_at)}</div>
                              {report.sources.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {report.sources.map((source) => (
                                    <span key={`${report.id}-${source}`} className="px-1.5 py-0.5 rounded border border-[#2a2a2a] bg-[#151515] text-[10px] text-zinc-300">
                                      {source}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 text-zinc-400 mt-0.5">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0 border-t border-[#1f1f1f] bg-[#090909]">
                            <div className="market-intel-body pt-4" dangerouslySetInnerHTML={{ __html: renderedArchiveHtml }} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <style>{`
        .market-intel-body {
          color: rgba(212, 212, 216, 0.95);
          line-height: 1.75;
          font-size: 0.95rem;
        }
        .market-intel-body .market-h1 {
          color: #ffffff;
          font-size: 1.35rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
          letter-spacing: -0.01em;
        }
        .market-intel-body .market-h2 {
          color: #ffffff;
          font-size: 1.2rem;
          font-weight: 700;
          margin: 1.15rem 0 0.5rem;
          letter-spacing: -0.01em;
        }
        .market-intel-body .market-h3 {
          color: #86efac;
          font-size: 1rem;
          font-weight: 600;
          margin: 1rem 0 0.45rem;
        }
        .market-intel-body .market-paragraph {
          color: rgba(212, 212, 216, 0.9);
          margin: 0.35rem 0;
          line-height: 1.8;
        }
        .market-intel-body .market-list {
          margin: 0.55rem 0 0.85rem;
          padding-left: 1.2rem;
          color: rgba(212, 212, 216, 0.92);
        }
        .market-intel-body .market-list li {
          margin: 0.35rem 0;
          line-height: 1.7;
        }
        .market-intel-body .market-list li::marker {
          color: rgba(16, 185, 129, 0.7);
        }
        .market-intel-body .market-link {
          color: #93c5fd;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .market-intel-body .market-link:hover {
          color: #bfdbfe;
        }
        .market-intel-body .market-inline-code {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #a7f3d0;
          border-radius: 0.375rem;
          font-size: 0.82rem;
          padding: 0.1rem 0.35rem;
        }
        .market-intel-body .market-divider {
          border: none;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent);
          margin: 1.2rem 0;
        }
        .market-intel-body .market-strong {
          color: rgba(255, 255, 255, 0.95);
          font-weight: 600;
        }
        .market-intel-body .market-em {
          color: rgba(228, 228, 231, 0.85);
          font-style: italic;
        }
        .market-intel-body .market-ticker {
          color: #fcd34d;
          font-weight: 700;
          background: rgba(251, 191, 36, 0.12);
          border: 1px solid rgba(251, 191, 36, 0.22);
          padding: 0.02rem 0.3rem;
          border-radius: 0.28rem;
        }
        .market-intel-body .market-section-header {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          border: 1px solid;
          border-radius: 0.55rem;
          padding: 0.28rem 0.6rem;
          margin: 1rem 0 0.55rem;
          font-size: 0.77rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  );
}
