import { useState } from 'react';

// Newsletter archive - newest first
const NEWSLETTERS = [
  {
    id: '2026-01-28',
    date: 'January 28, 2026',
    title: 'TSLA Weekly Calls Explode, Prediction Markets Eye Fed Decision',
    content: `
## 🔥 This Week's Hot Take

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

## 🎰 Prediction Markets Update

### Polymarket Hot Markets

| Market | YES Price | 7-Day Change |
|--------|-----------|--------------|
| Fed cuts rates in March | 23¢ | -8¢ |
| Bitcoin $100K by March | 41¢ | +12¢ |
| Trump announces 2028 run | 67¢ | +3¢ |
| TSLA hits $500 Q1 2026 | 34¢ | +9¢ |

### Arbitrage Alert 🚨
**Bitcoin $100K by March** shows a 3.2% spread between Polymarket (41¢ YES) and Kalshi (56¢ NO). Free money for those who can execute both sides.

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

— The Stratify Team
    `
  }
];

export default function NewsletterPage({ themeClasses }) {
  const [selectedNewsletter, setSelectedNewsletter] = useState(NEWSLETTERS[0]);
  const [showArchive, setShowArchive] = useState(false);

  return (
    <div className="h-full flex">
      {/* Main Newsletter Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Weekly Newsletter</h1>
            <p className="text-[#9AA0A6] text-sm mt-1">Market insights, unusual options activity & prediction markets</p>
          </div>
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 px-4 py-2 bg-[#303134] hover:bg-[#3c4043] border border-[#5f6368] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[#8ab4f8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-sm text-[#E8EAED]">Archive ({NEWSLETTERS.length})</span>
          </button>
        </div>

        {/* Current Newsletter */}
        <div className="bg-[#303134] border border-[#5f6368] rounded-xl overflow-hidden">
          {/* Newsletter Header */}
          <div className="px-6 py-4 border-b border-[#5f6368] bg-gradient-to-r from-[#303134] to-[#3c4043]">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-[#8ab4f8]/20 text-[#8ab4f8] text-xs font-medium rounded">LATEST</span>
              <span className="text-[#9AA0A6] text-sm">{selectedNewsletter.date}</span>
            </div>
            <h2 className="text-xl font-semibold text-white">{selectedNewsletter.title}</h2>
          </div>

          {/* Newsletter Body */}
          <div className="px-6 py-6 prose prose-invert max-w-none">
            <div 
              className="text-[#E8EAED] text-[15px] leading-relaxed newsletter-content"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(selectedNewsletter.content) }}
            />
          </div>
        </div>

        {/* Subscribe CTA */}
        <div className="mt-6 bg-gradient-to-r from-[#1a73e8]/20 to-[#8ab4f8]/20 border border-[#8ab4f8]/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Never miss an issue</h3>
              <p className="text-[#9AA0A6] text-sm mt-1">Get the weekly newsletter delivered to your inbox every Sunday</p>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="email" 
                placeholder="Enter your email"
                className="px-4 py-2 bg-[#202124] border border-[#5f6368] rounded-lg text-white text-sm w-64 focus:border-[#8ab4f8] focus:outline-none"
              />
              <button className="px-4 py-2 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-medium text-sm rounded-lg transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Archive Sidebar */}
      {showArchive && (
        <div className="w-80 border-l border-[#5f6368] bg-[#202124] overflow-y-auto">
          <div className="p-4 border-b border-[#5f6368] sticky top-0 bg-[#202124]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Newsletter Archive</h3>
              <button onClick={() => setShowArchive(false)} className="text-[#9AA0A6] hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-2">
            {NEWSLETTERS.map((newsletter) => (
              <button
                key={newsletter.id}
                onClick={() => setSelectedNewsletter(newsletter)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                  selectedNewsletter.id === newsletter.id 
                    ? 'bg-[#8ab4f8]/20 border border-[#8ab4f8]/50' 
                    : 'hover:bg-[#303134] border border-transparent'
                }`}
              >
                <div className="text-xs text-[#9AA0A6] mb-1">{newsletter.date}</div>
                <div className="text-sm text-[#E8EAED] line-clamp-2">{newsletter.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .newsletter-content h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #E8EAED;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .newsletter-content h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #8ab4f8;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .newsletter-content p {
          margin-bottom: 1rem;
          color: #BDC1C6;
        }
        .newsletter-content strong {
          color: #E8EAED;
        }
        .newsletter-content ul, .newsletter-content ol {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .newsletter-content li {
          margin-bottom: 0.5rem;
          color: #BDC1C6;
        }
        .newsletter-content hr {
          border: none;
          border-top: 1px solid #5f6368;
          margin: 1.5rem 0;
        }
        .newsletter-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .newsletter-content th, .newsletter-content td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #5f6368;
        }
        .newsletter-content th {
          color: #9AA0A6;
          font-weight: 500;
          font-size: 0.875rem;
        }
        .newsletter-content td {
          color: #E8EAED;
        }
        .newsletter-content code {
          background: #3c4043;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

// Simple markdown to HTML converter
function formatMarkdown(text) {
  return text
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^---$/gim, '<hr/>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => c.includes('---'))) return '';
      const isHeader = !match.includes('¢') && !match.includes('%') && !match.includes('+') && !match.includes('-');
      const tag = isHeader ? 'th' : 'td';
      return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>)/gs, '<table>$1</table>')
    .replace(/<p><\/p>/g, '')
    .replace(/^\s+|\s+$/g, '');
}
