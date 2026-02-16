import { useState, useRef, useEffect } from 'react';
import newsletterData from '../../data/newsletters.json';
import { supabase } from '../../lib/supabaseClient';

/* ─────────────────────────────────────────────
   STRATIFY WEEKLY — Newsletter & Sophia Recaps
   Dynamic: reads from src/data/newsletters.json
   Sophia video auto-matched by date
   ───────────────────────────────────────────── */

// Build newsletter list from JSON, add video paths + short dates
const NEWSLETTERS = (newsletterData || []).map((n) => {
  const d = new Date(n.date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return {
    ...n,
    dateShort: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    videoPath: `/sophia-recaps/sophia-recap-${dd}-${mm}-${yyyy}.mp4`,
  };
});

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

// ── Newsletter Page ──
export default function NewsletterPage({ onClose }) {
  const [items, setItems] = useState(NEWSLETTERS);
  const [selected, setSelected] = useState(items[0] || null);
  const [showArchive, setShowArchive] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subError, setSubError] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  // Check if video exists
  useEffect(() => {
    if (selected?.videoPath) {
      fetch(selected.videoPath, { method: 'HEAD' })
        .then(r => { if (r.ok) setVideoReady(true); else setVideoReady(false); })
        .catch(() => setVideoReady(false));
    } else {
      setVideoReady(false);
    }
  }, [selected]);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubLoading(true);
    setSubError('');
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email, source: 'newsletter_page' }, { onConflict: 'email' });
      if (error) throw error;
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    } catch (err) {
      setSubError(err.message?.includes('duplicate') ? 'Already subscribed!' : 'Something went wrong. Try again.');
      setTimeout(() => setSubError(''), 3000);
    } finally {
      setSubLoading(false);
    }
  };

  const handleDelete = (id) => {
    const next = items.filter(n => n.id !== id);
    setItems(next);
    if (selected?.id === id) {
      setSelected(next[0] || null);
    }
  };

  if (!selected) {
    return (
      <div className="h-full bg-[#0a0a0a] flex items-center justify-center">
        {onClose && (
          <button onClick={onClose} className="absolute top-4 left-4 text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <p className="text-white/40">No newsletters yet. Check back Sunday at 6 PM ET.</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0a0a] overflow-y-auto">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-[960px] mx-auto px-6 py-3 flex items-center justify-between">
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
              <span className="text-white/50 text-sm tracking-widest uppercase">Weekly</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowArchive(!showArchive)}
              className="flex items-center gap-2 px-3 py-1.5 text-white/40 hover:text-white/70 text-xs tracking-wide uppercase transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">
          <div className="max-w-[960px] mx-auto px-6">

            {/* ── Hero / Sophia Video ── */}
            {videoReady && selected?.videoPath && (
              <div className="mt-8 mb-8">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-white/[0.06] shadow-2xl shadow-black/40">
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-white/70 font-medium tracking-widest uppercase bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded">Sophia's Recap</span>
                  </div>
                  <video
                    ref={videoRef}
                    src={selected.videoPath}
                    className="w-full aspect-video object-contain"
                    playsInline
                    controls
                  />
                </div>
              </div>
            )}

            {/* ── Newsletter Header ── */}
            <div className="mt-8 mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-emerald-400 text-[11px] font-semibold tracking-widest uppercase">{selected.date}</span>
                {selected === items[0] && (
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-medium rounded border border-emerald-500/20">Latest</span>
                )}
              </div>
              <h1 className="text-3xl font-bold text-white leading-tight tracking-tight mb-4">
                {selected.title}
              </h1>
              <div className="flex items-center gap-3 text-white/30 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">S</span>
                  </div>
                  <span>Sophia & The Stratify Team</span>
                </div>
                <span>·</span>
                <span>5 min read</span>
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-10" />

            {/* ── Newsletter Body ── */}
            <div className="newsletter-body pb-16">
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.content) }} />
            </div>

            {/* ── Subscribe CTA ── */}
            <div className="pb-16">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5" />
                <div className="relative px-8 py-10 text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">Never miss an issue</h3>
                  <p className="text-white/40 text-sm mb-6">Sophia delivers the weekly recap every Sunday at 6 PM ET</p>
                  <form onSubmit={handleSubscribe} className="flex items-center gap-3 max-w-md mx-auto">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={subLoading}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-sm rounded-xl transition-colors whitespace-nowrap"
                    >
                      {subLoading ? '...' : subscribed ? '✓ Subscribed' : 'Subscribe'}
                    </button>
                  </form>
                  {subError && <p className="text-red-400 text-xs mt-3">{subError}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Archive Sidebar ── */}
        {showArchive && (
          <div className="w-72 border-l border-white/[0.06] bg-[#0d0d0d] flex-shrink-0 sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-semibold text-white/50 tracking-widest uppercase">Archive</h3>
                <button onClick={() => setShowArchive(false)} className="text-white/30 hover:text-white/60 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Folder: Newsletters */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-white/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-[10px] font-semibold tracking-widest uppercase">Newsletters</span>
                  <span className="text-[10px] text-white/20">{items.length}</span>
                </div>
                <div className="space-y-1 ml-1">
                  {items.map((n) => (
                    <div
                      key={n.id}
                      className={`group relative w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                        selected.id === n.id
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : 'hover:bg-white/[0.03] border border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => setSelected(n)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${selected.id === n.id ? 'text-emerald-400' : 'text-white/20'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className={`text-[10px] font-medium ${selected.id === n.id ? 'text-emerald-400' : 'text-white/40'}`}>{n.dateShort}</span>
                        </div>
                        <p className={`text-xs leading-snug line-clamp-2 ${selected.id === n.id ? 'text-white/80' : 'text-white/40 group-hover:text-white/60'}`}>
                          {n.title}
                        </p>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400"
                        title="Remove from archive"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Folder: Sophia Recaps */}
              <div>
                <div className="flex items-center gap-2 mb-3 text-white/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] font-semibold tracking-widest uppercase">Sophia Recaps</span>
                </div>
                <div className="space-y-1 ml-1">
                  {items.map((n) => (
                    <button
                      key={`vid-${n.id}`}
                      onClick={() => setSelected(n)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-all group border border-transparent"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-white/20 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span className="text-xs text-white/40 group-hover:text-white/60">Recap — {n.dateShort}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
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
          color: #34d399;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .newsletter-body p {
          color: rgba(255,255,255,0.55);
          line-height: 1.8;
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .newsletter-body strong {
          color: rgba(255,255,255,0.9);
          font-weight: 600;
        }
        .newsletter-body em {
          color: rgba(255,255,255,0.5);
        }
        .newsletter-body li {
          color: rgba(255,255,255,0.55);
          margin-bottom: 0.5rem;
          padding-left: 0.5rem;
          margin-left: 1.25rem;
          font-size: 0.95rem;
          line-height: 1.7;
        }
        .newsletter-body li::marker {
          color: rgba(52, 211, 153, 0.5);
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
          color: rgba(255,255,255,0.65);
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
