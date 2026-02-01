import { useState } from 'react';

// Bet Slip Modal Component
const BetSlipModal = ({ market, onClose }) => {
  const [betAmount, setBetAmount] = useState('');
  const [position, setPosition] = useState('YES');
  
  if (!market) return null;
  
  const price = position === 'YES' ? market.yesPrice : (100 - market.yesPrice);
  const potentialWin = betAmount ? ((100 / price) * parseFloat(betAmount) - parseFloat(betAmount)).toFixed(2) : '0.00';
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#202124] border border-[#5f6368] rounded-xl w-[400px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#5f6368] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-white">Quick Trade</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Market Info */}
        <div className="px-4 py-4 border-b border-[#5f6368]">
          <div className="text-white font-medium mb-1">{market.name}</div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-400">YES {market.yesPrice}¢</span>
            <span className="text-red-400">NO {100 - market.yesPrice}¢</span>
            <span className={`${market.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {market.change >= 0 ? '+' : ''}{market.change}¢ 7d
            </span>
          </div>
        </div>
        
        {/* Position Toggle */}
        <div className="px-4 py-3">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPosition('YES')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                position === 'YES' 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-[#303134] text-gray-400 hover:bg-[#3c4043]'
              }`}
            >
              YES {market.yesPrice}¢
            </button>
            <button
              onClick={() => setPosition('NO')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                position === 'NO' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-[#303134] text-gray-400 hover:bg-[#3c4043]'
              }`}
            >
              NO {100 - market.yesPrice}¢
            </button>
          </div>
          
          {/* Amount Input */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-2 bg-[#303134] border border-[#5f6368] rounded-lg text-white text-sm focus:border-[#8ab4f8] focus:outline-none"
              />
            </div>
          </div>
          
          {/* Quick Amounts */}
          <div className="flex gap-2 mb-4">
            {[10, 25, 50, 100].map(amount => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount.toString())}
                className="flex-1 py-1.5 bg-[#303134] hover:bg-[#3c4043] border border-[#5f6368] rounded text-xs text-gray-300"
              >
                ${amount}
              </button>
            ))}
          </div>
          
          {/* Potential Win */}
          <div className="bg-[#303134] rounded-lg p-3 mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Shares</span>
              <span className="text-white">{betAmount ? (parseFloat(betAmount) / (price / 100)).toFixed(0) : '0'}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Avg Price</span>
              <span className="text-white">{price}¢</span>
            </div>
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-[#5f6368]">
              <span className="text-gray-400">Potential Profit</span>
              <span className="text-emerald-400">+${potentialWin}</span>
            </div>
          </div>
          
          {/* Submit Button */}
          <button
            disabled={!betAmount || parseFloat(betAmount) <= 0}
            className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
              position === 'YES'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white disabled:bg-emerald-500/30 disabled:text-emerald-300/50'
                : 'bg-red-500 hover:bg-red-400 text-white disabled:bg-red-500/30 disabled:text-red-300/50'
            }`}
          >
            {betAmount ? `Buy ${position} for $${betAmount}` : 'Enter Amount'}
          </button>
          
          <p className="text-[10px] text-gray-600 text-center mt-3">
            Trading on {market.platform || 'Polymarket'} • Requires connected account
          </p>
        </div>
      </div>
    </div>
  );
};

// Arb Bet Slip Modal - Unified dual-side execution
const ArbBetSlipModal = ({ arb, onClose }) => {
  const [betAmount, setBetAmount] = useState('');
  
  if (!arb) return null;
  
  const amount = parseFloat(betAmount) || 0;
  const HOUSE_FEE_PERCENT = 0.5; // 0.5% fee
  
  // Calculate optimal allocation for arb
  // To guarantee profit, we need: (amount on YES / YES price) = (amount on NO / NO price)
  // This ensures we win the same amount regardless of outcome
  const yesPrice = arb.polymarket.price / 100;
  const noPrice = arb.kalshi.price / 100;
  const totalCost = yesPrice + noPrice; // Combined cost per $1 of guaranteed return
  
  const yesAllocation = amount * (yesPrice / totalCost);
  const noAllocation = amount * (noPrice / totalCost);
  
  // Guaranteed payout is $1 for every $totalCost invested
  const grossPayout = amount / totalCost;
  const grossProfit = grossPayout - amount;
  const houseFee = amount * (HOUSE_FEE_PERCENT / 100);
  const netProfit = grossProfit - houseFee;
  const profitPercent = amount > 0 ? ((netProfit / amount) * 100).toFixed(1) : '0.0';
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#202124] border border-amber-500/50 rounded-xl w-[440px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#5f6368] bg-amber-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">🎯</span>
              <span className="text-sm font-medium text-white">Arbitrage Executor</span>
              <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded">GUARANTEED PROFIT</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Market Info */}
        <div className="px-4 py-4 border-b border-[#5f6368]">
          <div className="text-white font-medium mb-2">{arb.name}</div>
          <div className="text-xs text-gray-400 mb-3">Execute both sides simultaneously to lock in profit</div>
          
          {/* Two Legs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">LEG 1 • Polymarket</div>
              <div className="text-emerald-400 font-medium">Buy YES @ {arb.polymarket.price}¢</div>
              {amount > 0 && <div className="text-xs text-gray-400 mt-1">${yesAllocation.toFixed(2)}</div>}
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">LEG 2 • Kalshi</div>
              <div className="text-red-400 font-medium">Buy NO @ {arb.kalshi.price}¢</div>
              {amount > 0 && <div className="text-xs text-gray-400 mt-1">${noAllocation.toFixed(2)}</div>}
            </div>
          </div>
        </div>
        
        {/* Amount Input */}
        <div className="px-4 py-4">
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Total Investment (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-3 bg-[#303134] border border-[#5f6368] rounded-lg text-white text-lg focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
          
          {/* Quick Amounts */}
          <div className="flex gap-2 mb-4">
            {[50, 100, 250, 500, 1000].map(amt => (
              <button
                key={amt}
                onClick={() => setBetAmount(amt.toString())}
                className="flex-1 py-2 bg-[#303134] hover:bg-[#3c4043] border border-[#5f6368] rounded text-xs text-gray-300"
              >
                ${amt}
              </button>
            ))}
          </div>
          
          {/* Breakdown */}
          <div className="bg-[#303134] rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Polymarket (YES)</span>
                <span className="text-white">${yesAllocation.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kalshi (NO)</span>
                <span className="text-white">${noAllocation.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-[#5f6368] pt-2">
                <span className="text-gray-500">Total Investment</span>
                <span className="text-white">${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Guaranteed Payout</span>
                <span className="text-white">${grossPayout.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Gross Profit</span>
                <span className="text-emerald-400">+${grossProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Stratify Fee ({HOUSE_FEE_PERCENT}%)</span>
                <span className="text-gray-500">-${houseFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-amber-500/30 pt-2">
                <span className="text-amber-400 font-medium">Net Profit</span>
                <span className="text-amber-400 font-semibold">+${netProfit.toFixed(2)} ({profitPercent}%)</span>
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <button
            disabled={!betAmount || parseFloat(betAmount) <= 0}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {amount > 0 ? `Execute Arb • Lock in +$${netProfit.toFixed(2)}` : 'Enter Amount to Calculate'}
          </button>
          
          <p className="text-[10px] text-gray-600 text-center mt-3">
            Executes on Polymarket + Kalshi simultaneously • {HOUSE_FEE_PERCENT}% Stratify fee
          </p>
        </div>
      </div>
    </div>
  );
};

// Prediction Markets data (structured for rendering with trade buttons)
const PREDICTION_MARKETS = [
  { id: 1, name: 'Fed cuts rates in March', yesPrice: 23, change: -8 },
  { id: 2, name: 'Bitcoin $100K by March', yesPrice: 41, change: 12 },
  { id: 3, name: 'Trump announces 2028 run', yesPrice: 67, change: 3 },
  { id: 4, name: 'TSLA hits $500 Q1 2026', yesPrice: 34, change: 9 },
];

// Arbitrage opportunities
const ARBITRAGE_OPPORTUNITIES = [
  { 
    id: 'arb-1', 
    name: 'Bitcoin $100K by March', 
    polymarket: { side: 'YES', price: 41 },
    kalshi: { side: 'NO', price: 56 },
    spread: 3.0
  },
];

// Newsletter archive - newest first
const NEWSLETTERS = [
  {
    id: '2026-02-01',
    date: 'February 1, 2026',
    title: 'Bitcoin Crashes to $78K, Options Flow Signals Major Volatility Ahead',
    content: `
## 🔥 This Week's Hot Take

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

## 🎰 Prediction Markets Update

### Polymarket Hot Markets

| Market | YES Price | 7-Day Change |
|--------|-----------|--------------|
| Fed cuts rates in March | 18¢ | -5¢ |
| Bitcoin $100K by March | 28¢ | -13¢ |
| NVDA beats earnings | 72¢ | +4¢ |
| Trump wins popular vote | 51¢ | +2¢ |
| ETH flips BTC market cap | 8¢ | -3¢ |

### Kalshi Movers
- **Super Bowl: Chiefs win** jumped from 45¢ to 58¢
- **LA wildfire damage >$50B** trading at 67¢ YES
- **Tesla robotaxi 2026 launch** dropped to 22¢

### Arbitrage Alert 🚨
**NVDA Earnings Beat** shows a 4.1% spread: Polymarket 72¢ YES vs Kalshi 64¢ YES (inverted). Arb exists if you go long both YES sides and one must pay out. Estimated profit: $41 per $1000 deployed.

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

— The Stratify Team
    `
  },
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

export default function NewsletterPage({ themeClasses, onClose }) {
  const [selectedNewsletter, setSelectedNewsletter] = useState(NEWSLETTERS[0]);
  const [showArchive, setShowArchive] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedArb, setSelectedArb] = useState(null);

  return (
    <div className="h-full flex">
      {/* Main Newsletter Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Header - Compact */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-[#303134] rounded-lg transition-colors mr-1"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-semibold text-white">Newsletter</h1>
            <span className="text-[#9AA0A6] text-xs">Market insights & unusual options activity</span>
          </div>
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#303134] hover:bg-[#3c4043] border border-[#5f6368] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-[#8ab4f8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-xs text-[#E8EAED]">Archive ({NEWSLETTERS.length})</span>
          </button>
        </div>

        {/* Current Newsletter */}
        <div className="bg-[#303134] border border-[#5f6368] rounded-xl overflow-hidden">
          {/* Newsletter Header - Compact */}
          <div className="px-4 py-3 border-b border-[#5f6368] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-[#8ab4f8]/20 text-[#8ab4f8] text-[10px] font-medium rounded">LATEST</span>
              <h2 className="text-base font-medium text-white">{selectedNewsletter.title}</h2>
            </div>
            <span className="text-[#9AA0A6] text-xs">{selectedNewsletter.date}</span>
          </div>

          {/* Newsletter Body */}
          <div className="px-6 py-6 prose prose-invert max-w-none">
            <div 
              className="text-[#E8EAED] text-[15px] leading-relaxed newsletter-content"
              dangerouslySetInnerHTML={{ __html: formatMarkdownWithoutPredictionMarkets(selectedNewsletter.content) }}
            />
            
            {/* Interactive Prediction Markets Section */}
            <div className="my-6">
              <h2 className="text-xl font-semibold text-[#E8EAED] flex items-center gap-2 mb-4">
                🎰 Prediction Markets Update
              </h2>
              <h3 className="text-base font-semibold text-[#8ab4f8] mb-3">Polymarket Hot Markets</h3>
              <div className="bg-[#202124] rounded-lg border border-[#5f6368] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#5f6368]">
                      <th className="px-4 py-3 text-left text-xs text-[#9AA0A6] font-medium">Market</th>
                      <th className="px-4 py-3 text-left text-xs text-[#9AA0A6] font-medium">YES Price</th>
                      <th className="px-4 py-3 text-left text-xs text-[#9AA0A6] font-medium">7-Day Change</th>
                      <th className="px-4 py-3 text-right text-xs text-[#9AA0A6] font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PREDICTION_MARKETS.map((market) => (
                      <tr key={market.id} className="border-b border-[#5f6368] last:border-b-0 hover:bg-[#303134] transition-colors">
                        <td className="px-4 py-3 text-sm text-[#E8EAED]">{market.name}</td>
                        <td className="px-4 py-3 text-sm text-emerald-400 font-medium">{market.yesPrice}¢</td>
                        <td className={`px-4 py-3 text-sm font-medium ${market.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {market.change >= 0 ? '+' : ''}{market.change}¢
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedMarket(market)}
                            className="px-3 py-1 bg-[#8ab4f8]/20 hover:bg-[#8ab4f8]/30 text-[#8ab4f8] text-xs font-medium rounded transition-colors"
                          >
                            Trade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Arbitrage Alerts */}
              {ARBITRAGE_OPPORTUNITIES.map((arb) => (
                <div key={arb.id} className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-amber-400 font-semibold">🚨 Arbitrage Alert</span>
                    <span className="text-xs text-amber-400/80 bg-amber-500/20 px-2 py-0.5 rounded">+{arb.spread}% guaranteed</span>
                  </div>
                  <p className="text-sm text-[#BDC1C6] mb-3">
                    <strong className="text-white">{arb.name}</strong> — {arb.spread}% spread between Polymarket ({arb.polymarket.price}¢ {arb.polymarket.side}) and Kalshi ({arb.kalshi.price}¢ {arb.kalshi.side}). Lock in guaranteed profit by executing both sides.
                  </p>
                  
                  {/* Leg Preview */}
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <div className="flex-1 py-1.5 px-3 bg-[#202124] rounded border border-emerald-500/30 text-center">
                      <span className="text-gray-500">Polymarket</span>
                      <span className="text-emerald-400 ml-2">YES @ {arb.polymarket.price}¢</span>
                    </div>
                    <span className="text-gray-600">+</span>
                    <div className="flex-1 py-1.5 px-3 bg-[#202124] rounded border border-red-500/30 text-center">
                      <span className="text-gray-500">Kalshi</span>
                      <span className="text-red-400 ml-2">NO @ {arb.kalshi.price}¢</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedArb(arb)}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/50 text-amber-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>🎯</span>
                    <span>Execute Arb</span>
                    <span className="text-amber-400/60 text-xs">+{arb.spread}% profit</span>
                  </button>
                </div>
              ))}
            </div>
            
            {/* Rest of newsletter content after prediction markets */}
            <div 
              className="text-[#E8EAED] text-[15px] leading-relaxed newsletter-content"
              dangerouslySetInnerHTML={{ __html: formatMarkdownAfterPredictionMarkets(selectedNewsletter.content) }}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
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
      
      {/* Bet Slip Modal */}
      {selectedMarket && (
        <BetSlipModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />
      )}
      
      {/* Arb Bet Slip Modal */}
      {selectedArb && (
        <ArbBetSlipModal arb={selectedArb} onClose={() => setSelectedArb(null)} />
      )}
    </div>
  );
}

// Helper to convert markdown to HTML
function convertMarkdown(text) {
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

// Get content BEFORE prediction markets section
function formatMarkdownWithoutPredictionMarkets(text) {
  const predictionMarketsIndex = text.indexOf('## 🎰 Prediction Markets Update');
  if (predictionMarketsIndex === -1) return convertMarkdown(text);
  return convertMarkdown(text.substring(0, predictionMarketsIndex));
}

// Get content AFTER prediction markets section (starts at Sector Watch)
function formatMarkdownAfterPredictionMarkets(text) {
  const sectorWatchIndex = text.indexOf('## 📈 Sector Watch');
  if (sectorWatchIndex === -1) return '';
  return convertMarkdown(text.substring(sectorWatchIndex));
}
