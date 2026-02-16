import { useState, useRef, useEffect } from 'react';

/* ─────────────────────────────────────────────
   STRATIFY WEEKLY — Newsletter & Sophia Recaps
   Professional editorial layout with:
   • Sophia video hero section
   • Full newsletter content
   • Archive sidebar with folder structure
   • Subscribe CTA
   ───────────────────────────────────────────── */

// Newsletter archive — newest first
const NEWSLETTERS = [
  {
    id: '2026-02-15',
    date: 'February 15, 2026',
    dateShort: 'Feb 15',
    title: 'Gold Shatters $5K, Truth Social Files Crypto ETFs, Markets Eye Holiday Week',
    videoPath: '/sophia-recaps/sophia-recap-15-02-2026.mp4',
    content: `## 🔥 This Week's Hot Take

**Gold just smashed through $5,000 for the first time in history.** At $5,029 an ounce, this isn't just a number — it's a statement. Central banks are hoarding, inflation hedges are in full force, and the safe-haven bid is relentless. Meanwhile, the S&P grinds higher at 6,836 like nothing can stop it. But here's what's interesting: Truth Social just filed with the SEC for Bitcoin and Ethereum ETFs, plus a Cronos staking fund. The Trump brand is going all-in on crypto. Love it or hate it, that's a signal.

---

## 📊 Unusual Options Activity

### NVDA - NVIDIA Corp
- Consensus AI pick across 4+ hedge fund managers (Asness, Laffont, multiple others)
- Still the most-mentioned name in institutional portfolios
- Watch for pre-earnings positioning this week

### COIN - Coinbase Global
- Wall Street slashed price targets after Q4 miss (Barclays, JPMorgan, Benchmark)
- **But shares still rallied** — classic disconnect between analysts and market
- Ark Invest bought $18M in crypto stocks — 10th consecutive bullish purchase

### SPY - S&P 500 ETF
- Grinding at 6,836 (+0.05%) near all-time highs
- Dow approaching 50,000 at 49,501
- Nasdaq slight weakness (-0.22%) on tech profit-taking

---

## 🎰 Prediction Markets Update

### Polymarket Hot Markets

| Market | YES Price | 7-Day Change |
|--------|-----------|--------------|
| Fed cuts rates in March | 18¢ | -5¢ |
| Gold stays above $5K through March | 72¢ | +15¢ |
| Truth Social crypto ETF approved Q2 | 23¢ | NEW |
| NVDA beats next earnings | 68¢ | +3¢ |
| Government shutdown lasts >1 week | 34¢ | +12¢ |

### Arbitrage Alert 🚨
**Gold $5K by March** — Polymarket has it at 72¢ YES while Kalshi shows 65¢ YES on similar wording. If you can execute both sides, there's a potential 7% spread. Gold is already above $5K, so this is essentially a "will it hold" bet.

---

## 📈 Sector Watch

**Winners This Week:**
- 🟢 Gold Miners (+4.9%) — Gold $5K milestone driving euphoria
- 🟢 Defense (+5.8%) — Geopolitical tensions escalating
- 🟢 Utilities (+2.3%) — Defensive rotation starting

**Losers This Week:**
- 🔴 Crypto (-18.4%) — BTC led the bloodbath despite ETF news
- 🔴 High-Growth Tech (-6.2%) — Rate fears creeping back
- 🔴 Semiconductors (-3.7%) — Profit taking pre-earnings

---

## 💡 Alpha Idea of the Week

**The Gold Momentum Play**

Gold above $5K is a psychological milestone that tends to attract momentum chasers. Historically, when gold breaks major round numbers ($1K in 2009, $2K in 2020), it runs another 8-15% before any meaningful pullback.

**Setup:** GLD calls or gold miner ETFs (GDX, GDXJ) on any dip to $4,950
**Target:** $5,200-$5,400 within 30 days
**Stop:** Close below $4,900

*Not financial advice. Gold is volatile. Size accordingly.*

---

## 🗓️ Key Events Next Week

- **Monday:** Markets CLOSED (Presidents' Day)
- **Tuesday:** ISM Manufacturing PMI — first data point of the week
- **Wednesday:** FOMC Minutes — what did they really discuss?
- **Thursday:** Weekly Jobless Claims, Existing Home Sales
- **Friday:** S&P Global PMI Flash — manufacturing and services pulse

**Earnings to Watch:** $WMT (Thu), $HD (Tue), $MRNA (Thu) — retail meets biotech.

---

*Stay sharp. Volatility is opportunity.* 📈

— Sophia & The Stratify Team`
  },
  {
    id: '2026-02-01',
    date: 'February 1, 2026',
    dateShort: 'Feb 1',
    title: 'Bitcoin Crashes to $78K, Options Flow Signals Major Volatility Ahead',
    videoPath: null,
    content: `## 🔥 This Week's Hot Take

**Bitcoin just cratered to $78,131** — a brutal 15% drop that caught overleveraged longs completely off-guard. Our paper account auto-bought the dip this morning. Meanwhile, the options market is going absolutely insane with TSLA and NVDA sweep activity suggesting smart money sees a major move coming.

---

## 📊 Unusual Options Activity

### TSLA - Tesla Inc.
- **Feb 28 $420 Calls** - 1.2M contracts swept in 30 minutes
- Premium paid: $18.7M across multiple block trades
- Someone knows something about the Q1 delivery numbers
- IV rank: 78th percentile (elevated)

### NVDA - NVIDIA Corp
- **Feb 21 $1000 Calls** - Aggressive accumulation continues
- $14.3M in call premiums before next week's earnings
- Put/call ratio: 0.38 (extremely bullish skew)
- Watch the $900 level as support

### SPY - S&P 500 ETF
- **Massive Feb 7 $480 Put spread** - $22M notional
- Hedge fund protection or directional bet?
- VIX term structure steepening (caution signal)
- 0DTE volume hit record highs again

---

## 📈 Sector Watch

**Winners This Week:**
- 🟢 Defense (+5.8%) - Geopolitical tensions escalating
- 🟢 Gold Miners (+4.9%) - Flight to safety trade
- 🟢 Utilities (+2.3%) - Defensive rotation starting

**Losers This Week:**
- 🔴 Crypto (-18.4%) - BTC led the bloodbath
- 🔴 High-Growth Tech (-6.2%) - Rate fears back
- 🔴 Semiconductors (-3.7%) - Profit taking pre-earnings
- 🔴 Homebuilders (-2.9%) - Mortgage rates ticking up

---

## 💡 Alpha Idea of the Week

**The Post-Crash Crypto Bounce**

When BTC drops >10% in a single week AND RSI hits oversold (<30) on the daily, historically it bounces 8-15% within the following 5 trading days. Current setup:
- BTC RSI: 24 (deeply oversold)
- Weekly drop: -15.3%
- Similar setups: 7/9 profitable since 2023

**Trade idea:** Scale into spot BTC or BITO calls here. Target: $85K-$88K bounce. Stop: Close below $75K.

*Not financial advice. Crypto is volatile. Size accordingly.*

---

## 🗓️ Key Events Next Week

- **Monday:** ISM Manufacturing PMI
- **Tuesday:** Job Openings (JOLTS)
- **Wednesday:** ADP Employment, NVDA Earnings 🔥
- **Thursday:** Weekly Jobless Claims, AAPL & AMZN Earnings
- **Friday:** Non-Farm Payrolls (big one)

**Earnings to Watch:** NVDA (Wed), AAPL (Thu), AMZN (Thu), GOOGL (Thu) — the Mag 7 gauntlet begins.

---

*Stay sharp. Volatility is opportunity.* 📈

— The Stratify Team`
  },
  {
    id: '2026-01-28',
    date: 'January 28, 2026',
    dateShort: 'Jan 28',
    title: 'TSLA Weekly Calls Explode, Prediction Markets Eye Fed Decision',
    videoPath: null,
    content: `## 🔥 This Week's Hot Take

Tesla (TSLA) saw **unprecedented call option activity** this week with over 2.3 million contracts traded on the $450 strike for February expiration. Institutional flow suggests big money is betting on a breakout above the recent consolidation range.

---

## 📊 Unusual Options Activity

### TSLA - Tesla Inc.
- **Feb 21 $450 Calls** - 847,000 contracts (3x normal volume)
- Premium paid: $12.4M in a single block trade
- Implied move: +18% by expiration

### NVDA - NVIDIA Corp
- **Feb 14 $950 Calls** - Massive sweep orders
- Someone spent $8.2M betting on new highs before earnings
- This is a YOLO-level conviction play

### SPY - S&P 500 ETF
- Put/Call ratio dropped to 0.62 (bullish)
- Big money rotating OUT of hedges
- Risk-on sentiment building

---

## 📈 Sector Watch

**Winners This Week:**
- 🟢 Semiconductors (+4.2%) - AI demand still insatiable
- 🟢 Financials (+2.8%) - Rate cut hopes fading = bank profits
- 🟢 Energy (+2.1%) - Oil creeping back up

**Losers This Week:**
- 🔴 REITs (-3.1%) - Higher for longer rates hurt
- 🔴 Utilities (-1.8%) - Rotation into growth
- 🔴 Consumer Staples (-0.9%) - Boring is out

---

## 💡 Alpha Idea of the Week

**The Friday Capitulation Play**

When SPY bleeds Monday through Thursday AND Friday is still red by 3:30 PM, load up on ATM calls expiring next week. Historical win rate: 73% over the past 2 years.

Why it works: Institutional rebalancing and short covering typically kicks in the following Monday.

*Not financial advice. Trade at your own risk.*

---

## 🗓️ Key Events Next Week

- **Monday:** Durable Goods Orders
- **Tuesday:** Consumer Confidence, MSFT Earnings
- **Wednesday:** Fed Rate Decision (no change expected)
- **Thursday:** GDP First Estimate, AAPL Earnings
- **Friday:** PCE Inflation (Fed's favorite metric)

---

*See you next week. Stack those gains.* 📈

— The Stratify Team`
  }
];

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
  const [selected, setSelected] = useState(NEWSLETTERS[0]);
  const [showArchive, setShowArchive] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
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

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 4000);
      setEmail('');
    }
  };

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
                {selected === NEWSLETTERS[0] && (
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
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl transition-colors whitespace-nowrap"
                    >
                      {subscribed ? '✓ Subscribed' : 'Subscribe'}
                    </button>
                  </form>
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
                  <span className="text-[10px] text-white/20">{NEWSLETTERS.length}</span>
                </div>
                <div className="space-y-1 ml-1">
                  {NEWSLETTERS.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelected(n)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                        selected.id === n.id
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : 'hover:bg-white/[0.03] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${selected.id === n.id ? 'text-emerald-400' : 'text-white/20'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className={`text-[10px] font-medium ${selected.id === n.id ? 'text-emerald-400' : 'text-white/40'}`}>{n.dateShort}</span>
                        {n.videoPath && (
                          <svg className="w-3 h-3 text-white/20 ml-auto" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </div>
                      <p className={`text-xs leading-snug line-clamp-2 ${selected.id === n.id ? 'text-white/80' : 'text-white/40 group-hover:text-white/60'}`}>
                        {n.title}
                      </p>
                    </button>
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
                  {NEWSLETTERS.filter(n => n.videoPath).map((n) => (
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
