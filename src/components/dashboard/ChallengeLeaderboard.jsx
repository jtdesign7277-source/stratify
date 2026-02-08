/*
═══════════════════════════════════════════════════════════════
STRATIFY LEGEND — FEATURE SPEC + COMPONENT
═══════════════════════════════════════════════════════════════

WHAT THIS IS:
A new "Legend" tab in Stratify's left sidebar. Paid feature —
free users see a paywall, paid users get the full Portfolio
Challenge system. This is an ADD-ON. Do NOT replace or break
anything that already works.

FILE LOCATION: src/components/dashboard/ChallengeLeaderboard.jsx

═══════════════════════════════════════════════════════════════
1. SIDEBAR + NAVIGATION
═══════════════════════════════════════════════════════════════

Add "Legend" to left sidebar:
- Position: between "Social" and "Predict" tabs
- Icon: trophy (thin pencil-line, strokeWidth 1.5)
- Label: "Legend"
- When active → CENTER PANEL renders <ChallengeLeaderboard />
  instead of chart/positions view
- ALL other tabs keep working exactly as they do now

Gold trophy button in top bar:
- Goes in top-right area, next to portfolio value
- Gold border rgba(251,191,36,0.3), gradient background
- 🏆 emoji inside, red notification dot, glow animation
- On click → sets active tab to "legend"

═══════════════════════════════════════════════════════════════
2. PAYWALL (FREE USERS)
═══════════════════════════════════════════════════════════════

When isPaid={false}:
- Blurred preview of leaderboard behind overlay
- Show top 3 winners with returns (social proof / FOMO)
- CTA: "Upgrade to Legend — $9.99/mo"
- Subtext: "Cancel anytime · First week free"
- Block all challenge functionality

═══════════════════════════════════════════════════════════════
3. CHALLENGE PERIODS + CALENDAR PICKER
═══════════════════════════════════════════════════════════════

4 independent challenge periods:
- Weekly:  Monday 9:29 AM → Friday 4:00 PM
- Monthly: 1st of month → last trading day
- 6 Month: Jan–Jun, Jul–Dec
- Yearly:  Jan 1 → Dec 31

CALENDAR DATE PICKER (critical):
When user clicks "Enter Challenge" for ANY period:
1. Show popup/modal with calendar widget
2. Calendar shows available periods (upcoming weeks, months, etc)
3. User clicks the specific period they want to enter
4. VALIDATION: If already entered that exact period → show error
   "You're already entered in this challenge" + gray out submit
5. User CAN be in multiple DIFFERENT periods at once
   (e.g., one weekly AND one monthly) but NEVER same period twice

═══════════════════════════════════════════════════════════════
4. CHALLENGE RULES (ENFORCE THESE)
═══════════════════════════════════════════════════════════════

- Starting balance: $100,000 paper money
- Max 10 tickers per portfolio
- Min $5,000 per position
- Must deploy at least $95,000 (max $5K left as cash)
- Submissions lock at 9:29 AM ET (1 min before market open)
- Once locked → NO changes until period ends
- Performance tracked using REAL prices from Alpaca API
- Winner = highest portfolio value at period end

═══════════════════════════════════════════════════════════════
5. TABS INSIDE LEGEND VIEW
═══════════════════════════════════════════════════════════════

TAB 1: 🏅 LEADERBOARD
- Ranked list of all participants for selected period
- Each row: rank, avatar, username (CLICKABLE — see below),
  ticker tags, portfolio value, P&L %, risk score, rank arrows
- Top 3 get medals: 🥇 🥈 🥉
- Win streaks: 🔥3W badge
- Super Bowl Challenge banner at top (limited-time event)
- "Copy #1 Portfolio" + "Enter This Challenge" buttons at bottom

CLICKING A USERNAME (important):
- Opens profile card/modal showing that user's FULL portfolio
- Shows: every ticker, shares, buy price, current price,
  P&L per holding, total value
- FULLY TRANSPARENT — everyone sees everyone's picks
- "Copy This Portfolio" button pre-fills Enter Challenge form
- Like open source — no hidden information

TAB 2: 📊 MY PORTFOLIO
- Current user's challenge portfolio
- Summary: total value, P&L ($ and %), rank, rank change
- Stats: Starting ($100K), Deployed, Cash remaining,
  Holdings count (/10), Period name
- Holdings table: Ticker, Shares, Buy Price, Current Price,
  Current Value, P&L %
- "Share P&L Card" button (generates shareable image)
- "View Leaderboard" button

TAB 3: 🎯 ENTER CHALLENGE
- Calendar date picker popup FIRST (Section 3 above)
- Budget progress bar (how much of $100K allocated)
- Ticker search input
- Quick-add buttons: $NVDA $AAPL $TSLA $BTC $SPY $SOL
  $META $AMZN $GOOGL $MSFT
- Current picks list: ticker, shares, $ amount, P&L, remove (X)
- Dollar amount input per ticker (enforce $5K min)
- Remaining budget display
- Validation errors shown inline:
  "Must deploy at least $95K"
  "Maximum 10 picks"
  "Minimum $5K per position"
- 🔒 Submit Portfolio button (disabled if validation fails)
- After submit → confirmation → switch to My Portfolio tab

TAB 4: 💬 LIVE FEED
- Super Bowl Challenge banner at top
- Real-time social feed from challenge participants
- Each post: avatar, username, verified badge, timestamp,
  message, P&L badge, ticker tag, likes/comments/share
- Posts about challenge performance and picks
- Like, comment, share buttons must work

TAB 5: 🏆 PAST WINNERS (HALL OF FAME)
- Previous winners organized by period
- Each: trophy, username, period, return %, final value
- "Copy Picks" button on each → pre-fills Enter Challenge
- "How It Works" rules section at bottom

═══════════════════════════════════════════════════════════════
6. COPY PICKS (MUST WORK END TO END)
═══════════════════════════════════════════════════════════════

Triggered from:
- Leaderboard → click username → profile → "Copy This Portfolio"
- Past Winners → "Copy Picks" button
- Leaderboard → "Copy #1 Portfolio" button

When triggered:
1. Switch to Enter Challenge tab
2. Pre-fill all ticker picks from that user's portfolio
3. Pre-fill dollar amounts proportionally (matching original %)
4. User can modify before submitting
5. All validation rules still enforced

═══════════════════════════════════════════════════════════════
7. DATA + API
═══════════════════════════════════════════════════════════════

- Prices from Alpaca API (same as rest of Stratify)
- Portfolio values update real-time during market hours
- Leaderboard rankings recalculate as prices change
- Live feed connects to same social system as main Social tab

═══════════════════════════════════════════════════════════════
8. DESIGN (MATCH EXISTING STRATIFY)
═══════════════════════════════════════════════════════════════

- Dark theme: #060a10 bg, #0a1628 panels
- Cyan #22d3ee gains, Red #f87171 losses, Gold #fbbf24 trophy
- JetBrains Mono for numbers/tickers, IBM Plex Sans for text
- Icons: thin pencil-line (strokeWidth 1.5), no box backgrounds
- Tickers always $ prefix ($AAPL, $BTC)
- No scrolling on main layout — internal scroll only
- Animations: fadeIn, slideIn from existing keyframes

═══════════════════════════════════════════════════════════════
9. CHECKLIST (verify each one)
═══════════════════════════════════════════════════════════════

[ ] Legend tab in sidebar with trophy icon
[ ] Gold trophy button in top bar
[ ] Paywall for free users (blurred + upgrade CTA)
[ ] 4 period tabs: weekly / monthly / 6 month / yearly
[ ] Calendar date picker when entering a challenge
[ ] Cannot enter same period twice validation
[ ] Leaderboard with clickable usernames
[ ] User profile cards showing full transparent portfolio
[ ] My Portfolio with holdings table + P&L
[ ] Enter Challenge with budget bar, search, validation
[ ] Live Feed with Super Bowl banner + social posts
[ ] Past Winners with Copy Picks buttons
[ ] Copy Picks pre-fills the Enter Challenge form
[ ] Share P&L Card button works
[ ] All prices from Alpaca API
[ ] Matches Stratify dark theme
[ ] Nothing existing is broken

═══════════════════════════════════════════════════════════════
AGENT INSTRUCTIONS:
1. Move this file to src/components/dashboard/ChallengeLeaderboard.jsx
2. Import in main dashboard
3. Wire Legend sidebar tab to render this in center panel
4. Add gold trophy to top bar
5. Make ALL tabs and interactions functional per spec above
6. Connect to Alpaca API for real prices
7. git add . && git commit -m "feat: Legend challenge system" && git push
═══════════════════════════════════════════════════════════════
*/
import { useState, useMemo } from "react";
import { Plus, X, Search } from "lucide-react";
import { PnLShareCard } from "./PnLShareCard";

/* ═══════════════════════════════════════════════════════════════
   CHALLENGE LEADERBOARD — Standalone component for center panel
   Drops into existing Stratify layout. Not a full page.
   Includes: Leaderboard, My Portfolio, Enter Challenge, 
             Past Winners, Live Social Feed, Super Bowl Challenge
   ═══════════════════════════════════════════════════════════════ */

const MONO = "'JetBrains Mono', monospace";
const fs = (n) => Math.round(n * 1.3);
const fmt = (n,d=2) => n?.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}) ?? "—";
const fmtK = (n) => n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":n?.toString()??"—";
const pnlColor = (v) => v>=0 ? "#22d3ee" : "#f87171";
const pnlSign = (v) => v>=0 ? "+" : "";
const badgeColors = { gold:"#fbbf24", silver:"#94a3b8", bronze:"#d97706" };
const riskColors = { Low:"#22c55e", Med:"#f59e0b", High:"#ef4444" };

const Icon = ({d,size=18,style:s={}}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={s}><path d={d}/></svg>
);
const I = {
  search:"M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  heart:"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  msg:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  share:"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  x:"M18 6L6 18M6 6l12 12",
  arrowUp:"M12 19V5M5 12l7-7 7 7",
  arrowDown:"M12 5v14M19 12l-7 7-7-7",
  clock:"M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0M12 6v6l4 2",
  copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  fire:"M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z",
  trophy:"M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22v-4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4M6 2h12v7a6 6 0 0 1-12 0V2z",
  down:"M6 9l6 6 6-6",
  right:"M9 18l6-6-6-6",
  users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
};

const STOCK_DATABASE = [
  "AAPL","GOOGL","AMZN","NVDA","META","TSLA","MSFT","HOOD","SOFI","AMD","INTC","NFLX","PYPL","COIN","PLTR","SPY","QQQ","DIA",
  "JPM","BAC","V","MA","DIS","UBER","ABNB","SQ","CRWD","GME","AMC","RIVN","NIO","F","XOM","JNJ","WMT","HD","BA","AVGO",
  "CRM","ADBE","PANW","SNOW","NET","HIMS","MARA","SMCI","ARM","RKLB","BRK.B","MSTR","PG","IWM","VTI","BB"
];

const CRYPTO_DATABASE = ["BTC","ETH","SOL","XRP","DOGE","ADA","AVAX","LINK"];

const PRICE_LOOKUP = {
  AAPL:237.42, GOOGL:156.20, AMZN:176.85, NVDA:142.87, META:470.12, TSLA:394.21, MSFT:421.33, HOOD:19.22, SOFI:9.14,
  AMD:167.80, INTC:45.30, NFLX:615.20, PYPL:66.40, COIN:205.15, PLTR:20.18, SPY:500.12, QQQ:421.90, DIA:380.40,
  JPM:190.25, BAC:34.12, V:280.15, MA:470.05, DIS:101.25, UBER:70.18, ABNB:149.80, SQ:80.10, CRWD:320.40, GME:25.10,
  AMC:5.25, RIVN:20.35, NIO:8.95, F:12.40, XOM:105.20, JNJ:160.12, WMT:170.18, HD:350.55, BA:210.10, AVGO:1250.40,
  CRM:260.25, ADBE:610.30, PANW:340.18, SNOW:190.40, NET:95.20, HIMS:14.10, MARA:24.50, SMCI:720.10, ARM:130.25,
  RKLB:6.12, 'BRK.B':420.10, MSTR:650.15, PG:160.20, IWM:200.35, VTI:250.20, BB:4.12,
  BTC:102483, ETH:5120, SOL:214.87, XRP:0.65, DOGE:0.12, ADA:0.55, AVAX:46.20, LINK:18.10
};

const getPrice = (sym) => PRICE_LOOKUP[sym] ?? 100;
const symbolHash = (sym) => sym.split("").reduce((s,c)=>s+c.charCodeAt(0),0);
const isCrypto = (sym) => CRYPTO_DATABASE.includes(sym);
const formatShares = (sym, shares) => fmt(shares, isCrypto(sym) ? 4 : 2);
const getMockPnlPct = (sym) => {
  const price = getPrice(sym);
  const variance = ((symbolHash(sym) % 11) - 5) / 100;
  const buyPrice = price * (1 - variance);
  return ((price - buyPrice) / buyPrice) * 100;
};
const buildHoldings = (picks, totalValue) => {
  const weights = picks.map(sym => 1 + ((symbolHash(sym) % 9) / 20));
  const weightSum = weights.reduce((s,w)=>s+w,0) || 1;
  return picks.map((sym, idx) => {
    const price = getPrice(sym);
    const weight = weights[idx] / weightSum;
    const curValue = totalValue * weight;
    const shares = curValue / price;
    const variance = ((symbolHash(sym) % 11) - 5) / 100;
    const buyPrice = price * (1 - variance);
    return { sym, shares, buyPrice, curPrice: price };
  });
};

// ── Mock Data ─────────────────────────────────────────────────
const LEADERBOARD = [
  { rank:1, user:"AlgoAnna", avi:"AA", curVal:134820, picks:["NVDA","SOL","BTC","TSLA","META"], streak:4, badge:"gold", rankChange:0, risk:"High" },
  { rank:2, user:"TraderMike", avi:"TM", curVal:128450, picks:["AAPL","MSFT","GOOGL","SPY","AMZN"], streak:2, badge:"silver", rankChange:1, risk:"Low" },
  { rank:3, user:"CryptoKing", avi:"CK", curVal:124200, picks:["BTC","ETH","SOL","XRP","DOGE"], streak:1, badge:"bronze", rankChange:-1, risk:"High" },
  { rank:4, user:"SwingSetSam", avi:"SS", curVal:118730, picks:["SPY","QQQ","AAPL","NVDA"], streak:0, badge:null, rankChange:2, risk:"Med" },
  { rank:5, user:"DayTraderDan", avi:"DD", curVal:115400, picks:["TSLA","NVDA","SOL"], streak:0, badge:null, rankChange:0, risk:"High" },
  { rank:6, user:"ValueVictor", avi:"VV", curVal:112890, picks:["BRK.B","JPM","V","JNJ","PG"], streak:3, badge:null, rankChange:1, risk:"Low" },
  { rank:7, user:"MomoMary", avi:"MM", curVal:109340, picks:["NVDA","AMD","SMCI","MSTR"], streak:0, badge:null, rankChange:-2, risk:"High" },
  { rank:8, user:"ETFEddie", avi:"EE", curVal:107200, picks:["SPY","QQQ","IWM","DIA","VTI"], streak:1, badge:null, rankChange:0, risk:"Low" },
  { rank:9, user:"OptionsOscar", avi:"OO", curVal:103450, picks:["TSLA","AMZN","META","NFLX"], streak:0, badge:null, rankChange:3, risk:"Med" },
  { rank:10, user:"NewbieNick", avi:"NN", curVal:98200, picks:["GME","AMC","BB","PLTR"], streak:0, badge:null, rankChange:-1, risk:"High" },
];

const MY_HOLDINGS = [
  { sym:"NVDA", shares:200, buyPrice:138.50, curPrice:142.87 },
  { sym:"BTC", shares:0.35, buyPrice:98400, curPrice:102483 },
  { sym:"TSLA", shares:50, buyPrice:388.00, curPrice:394.21 },
  { sym:"SOL", shares:45, buyPrice:198.20, curPrice:214.87 },
  { sym:"AAPL", shares:40, buyPrice:234.80, curPrice:237.42 },
];
const MY_CASH = 247.35;
const START_VAL = 100000;
const MIN_DEPLOY = 95000;
const MIN_POSITION = 5000;

const DEFAULT_PICKS = [
  { sym:"NVDA", amount:28000 },
  { sym:"BTC", amount:25000 },
  { sym:"SOL", amount:19800 },
];

const PAST_WINNERS = [
  { period:"Week of Jan 27", user:"AlgoAnna", ret:"+18.4%", val:118400 },
  { period:"Week of Jan 20", user:"CryptoKing", ret:"+22.1%", val:122100 },
  { period:"Week of Jan 13", user:"TraderMike", ret:"+15.7%", val:115700 },
  { period:"January 2026", user:"AlgoAnna", ret:"+34.8%", val:134800 },
  { period:"December 2025", user:"QuantQueen", ret:"+28.2%", val:128200 },
];

const LIVE_FEED = [
  { user:"TraderMike", avi:"TM", verified:true, time:"2m", text:"Just closed my $NVDA calls for +340% — Grok AI strategy nailed the entry 🎯", pnl:"+$12,847", pnlPct:"+340%", likes:234, comments:18, ticker:"NVDA" },
  { user:"AlgoAnna", avi:"AA", verified:true, time:"8m", text:"Super Bowl Challenge update: Up 23% this week. AI scalping on $TSLA is printing 🏈💰", pnl:"+$5,120", pnlPct:"+23%", likes:156, comments:12, ticker:"TSLA" },
  { user:"CryptoKing", avi:"CK", verified:false, time:"15m", text:"$BTC breaking 100K resistance. Challenge portfolio up 24.2% — chasing AlgoAnna for #1", pnl:"+$8,432", pnlPct:"+24.2%", likes:412, comments:31, ticker:"BTC" },
  { user:"QuantQueen", avi:"QQ", verified:true, time:"22m", text:"Mean reversion on $SPY hitting 73% win rate. Slow and steady wins the monthly challenge 📈", pnl:"+$3,210", pnlPct:"+18%", likes:89, comments:7, ticker:"SPY" },
  { user:"DayTraderDan", avi:"DD", verified:false, time:"38m", text:"Breakout on $SOL triggered — added to my challenge portfolio at $198. Target $240 🚀", pnl:"+$1,890", pnlPct:"+44%", likes:67, comments:4, ticker:"SOL" },
  { user:"SwingSetSam", avi:"SS", verified:false, time:"1h", text:"Moved up to #4 on the weekly leaderboard! $SPY and $QQQ carrying me. Conservative but consistent.", pnl:"+$2,340", pnlPct:"+18.7%", likes:43, comments:3, ticker:"SPY" },
  { user:"MomoMary", avi:"MM", verified:true, time:"1h", text:"$NVDA + $AMD + $SMCI combo for the AI semiconductor play. High risk but high reward challenge strat 🔥", pnl:"+$4,670", pnlPct:"+9.3%", likes:98, comments:8, ticker:"NVDA" },
];

const EXTRA_USER_PICKS = {
  QuantQueen: ["SPY","QQQ","AAPL","MSFT","JPM"],
};

// ── Social Card ───────────────────────────────────────────────
const FeedCard = ({ post }) => {
  const [liked, setLiked] = useState(false);
  return (
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 14px",marginBottom:6,transition:"background 0.2s",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.05))",border:"1px solid rgba(34,211,238,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:fs(11),fontWeight:700,color:"#22d3ee",fontFamily:MONO}}>{post.avi}</div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontWeight:600,fontSize:fs(13),color:"#e2e8f0"}}>{post.user}</span>
            {post.verified&&<span style={{color:"#22d3ee",fontSize:fs(10)}}>✓</span>}
            <span style={{color:"#475569",fontSize:fs(11)}}>· {post.time}</span>
          </div>
        </div>
        <div style={{background:"rgba(34,211,238,0.08)",border:"1px solid rgba(34,211,238,0.15)",borderRadius:5,padding:"2px 7px",fontSize:fs(11),fontWeight:700,fontFamily:MONO,color:"#22d3ee"}}>{post.pnlPct}</div>
      </div>
      <p style={{color:"#94a3b8",fontSize:fs(13),lineHeight:1.5,margin:"0 0 8px"}}>{post.text}</p>
      <div style={{display:"flex",alignItems:"center",gap:14,paddingTop:6,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
        <button onClick={()=>setLiked(!liked)} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:4,color:liked?"#f87171":"#475569",fontSize:fs(12),cursor:"pointer",padding:0}}><Icon d={I.heart} size={13}/>{liked?post.likes+1:post.likes}</button>
        <button style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:4,color:"#475569",fontSize:fs(12),cursor:"pointer",padding:0}}><Icon d={I.msg} size={13}/>{post.comments}</button>
        <button style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:4,color:"#475569",fontSize:fs(12),cursor:"pointer",padding:0}}><Icon d={I.share} size={13}/>Share</button>
        <div style={{flex:1}}/>
        <span style={{fontSize:fs(11),fontWeight:600,color:"#22d3ee",background:"rgba(34,211,238,0.08)",padding:"2px 7px",borderRadius:3,fontFamily:MONO}}>${post.ticker}</span>
      </div>
    </div>
  );
};

const UserProfileModal = ({ user, onClose, onCopy }) => {
  if (!user) return null;
  const holdings = user.portfolio || [];
  const totalValue = holdings.reduce((s,h)=>s+h.curPrice*h.shares,0);
  const costBasis = holdings.reduce((s,h)=>s+h.buyPrice*h.shares,0);
  const pnl = totalValue - costBasis;
  const pnlPct = costBasis ? (pnl / costBasis) * 100 : 0;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
      onClick={onClose}>
      <div style={{width:"100%",maxWidth:680,background:"#0b1220",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:18,boxShadow:"0 20px 60px rgba(0,0,0,0.45)"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.05))",border:"1px solid rgba(34,211,238,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:fs(12),fontWeight:700,color:"#22d3ee",fontFamily:MONO}}>
              {user.avi || user.user?.slice(0,2)?.toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:fs(16),fontWeight:700,color:"#e2e8f0"}}>{user.user}</div>
              <div style={{fontSize:fs(12),color:"#64748b"}}>Rank {user.rank ? `#${user.rank}` : "—"} · {holdings.length} holdings</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:6,color:"#94a3b8",cursor:"pointer"}}>
            <X size={16}/>
          </button>
        </div>

        <div style={{display:"flex",gap:18,marginBottom:14}}>
          <div style={{flex:1}}>
            <div style={{fontSize:fs(11),color:"#64748b",textTransform:"uppercase",letterSpacing:0.8}}>Total Value</div>
            <div style={{fontSize:fs(24),fontWeight:700,color:"#e2e8f0",fontFamily:MONO}}>${fmt(totalValue,0)}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:fs(11),color:"#64748b",textTransform:"uppercase",letterSpacing:0.8}}>Total P&L</div>
            <div style={{fontSize:fs(20),fontWeight:700,color:pnlColor(pnl),fontFamily:MONO}}>{pnlSign(pnl)}${fmt(Math.abs(pnl),0)} ({pnlSign(pnlPct)}{fmt(Math.abs(pnlPct),1)}%)</div>
          </div>
        </div>

        <div style={{fontSize:fs(11),color:"#475569",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>Holdings</div>
        <div style={{display:"grid",gridTemplateColumns:"70px 80px 90px 90px 90px 70px",gap:6,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",fontSize:fs(10),color:"#475569",fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>
          <span>Ticker</span><span>Shares</span><span>Buy</span><span>Current</span><span>Value</span><span>P&L</span>
        </div>
        {holdings.map((h,i)=>{
          const cv=h.curPrice*h.shares; const bv=h.buyPrice*h.shares; const hp=cv-bv; const hpct=bv? (hp/bv)*100 : 0;
          return (
            <div key={`${h.sym}-${i}`} style={{display:"grid",gridTemplateColumns:"70px 80px 90px 90px 90px 70px",gap:6,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:fs(13),fontFamily:MONO}}>
              <span style={{fontWeight:600,color:"#e2e8f0"}}>${h.sym}</span>
              <span style={{color:"#94a3b8"}}>{formatShares(h.sym, h.shares)}</span>
              <span style={{color:"#64748b"}}>${fmt(h.buyPrice)}</span>
              <span style={{color:"#cbd5e1"}}>${fmt(h.curPrice)}</span>
              <span style={{color:"#cbd5e1",fontWeight:500}}>${fmt(cv,0)}</span>
              <span style={{color:pnlColor(hp),fontWeight:600}}>{pnlSign(hp)}{fmt(Math.abs(hpct),1)}%</span>
            </div>
          );
        })}

        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button onClick={()=>onCopy?.(user)} style={{flex:1,padding:"10px",borderRadius:8,background:"rgba(34,211,238,0.08)",border:"1px solid rgba(34,211,238,0.18)",color:"#22d3ee",fontSize:fs(13),fontWeight:700,cursor:"pointer",fontFamily:MONO,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <Icon d={I.copy} size={14} style={{color:"#22d3ee"}}/> Copy This Portfolio
          </button>
          <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#94a3b8",fontSize:fs(13),fontWeight:600,cursor:"pointer",fontFamily:MONO}}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT — renders inside your existing center panel
// ═══════════════════════════════════════════════════════════════
export default function ChallengeLeaderboard({ isPaid = true }) {
  const [period, setPeriod] = useState("weekly");
  const [view, setView] = useState("leaderboard"); // leaderboard | myPortfolio | enter | history | feed
  const [selectedPicks, setSelectedPicks] = useState(DEFAULT_PICKS);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [validationError, setValidationError] = useState("");
  
  // Pick Modal State
  const [showPickModal, setShowPickModal] = useState(false);
  const [pendingPick, setPendingPick] = useState("");
  const [pickAmount, setPickAmount] = useState(10000);
  const [pickTimeframe, setPickTimeframe] = useState("week");
  const [savedPicks, setSavedPicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stratify-challenge-picks") || "[]"); } catch { return []; }
  });
  const [showSavedPicks, setShowSavedPicks] = useState(false);
  const [showPeriodInfo, setShowPeriodInfo] = useState(null);

  const myVal = MY_HOLDINGS.reduce((s,h)=>s+h.curPrice*h.shares,0) + MY_CASH;
  const myPnl = myVal - START_VAL;
  const myPct = (myPnl/START_VAL)*100;
  const deployed = START_VAL - MY_CASH;
  const budgetUsed = selectedPicks.reduce((s,p)=>s+p.amount,0);
  const remaining = START_VAL - budgetUsed;
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toUpperCase();
    const allSymbols = [...STOCK_DATABASE, ...CRYPTO_DATABASE];
    return allSymbols.filter(s => s.includes(q) && !selectedPicks.some(p=>p.sym===s)).slice(0,8);
  }, [searchQuery, selectedPicks]);

  const addPick = (sym) => {
    if (selectedPicks.length >= 10) { setValidationError("Max 10 picks"); return; }
    if (remaining < MIN_POSITION) { setValidationError("Not enough budget"); return; }
    setPendingPick(sym);
    setPickAmount(Math.min(remaining, 10000));
    setPickTimeframe("week");
    setShowPickModal(true);
    setSearchQuery(""); setShowSearch(false); setValidationError("");
  };
  
  const confirmPick = () => {
    if (pickAmount < MIN_POSITION) { setValidationError("Min $5,000 per position"); return; }
    if (pickAmount > remaining) { setValidationError("Exceeds budget"); return; }
    const newPick = { sym: pendingPick, amount: pickAmount, timeframe: pickTimeframe, addedAt: Date.now() };
    setSelectedPicks([...selectedPicks, newPick]);
    const updatedSaved = [...savedPicks, newPick];
    setSavedPicks(updatedSaved);
    localStorage.setItem("stratify-challenge-picks", JSON.stringify(updatedSaved));
    setShowPickModal(false);
    setPendingPick("");
  };
  
  const removeSavedPick = (idx) => {
    const updated = savedPicks.filter((_,i) => i !== idx);
    setSavedPicks(updated);
    localStorage.setItem("stratify-challenge-picks", JSON.stringify(updated));
  };
  
  const loadSavedPick = (pick) => {
    if (selectedPicks.some(p => p.sym === pick.sym)) { setValidationError("Already in picks"); return; }
    if (selectedPicks.length >= 10) { setValidationError("Max 10 picks"); return; }
    setSelectedPicks([...selectedPicks, pick]);
  };
  
  const removePick = (sym) => setSelectedPicks(selectedPicks.filter(p=>p.sym!==sym));
  const copyPortfolio = (user) => {
    const picks = (user.picks||[]).map((sym,i)=>({ sym, amount: Math.floor(START_VAL / user.picks.length) }));
    setSelectedPicks(picks); setSelectedUser(null); setView("enter");
  };

  // ── Paywall for free users ──────────────────────────────────
  if (!isPaid) {
    return (
      <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,position:"relative",overflow:"hidden"}}>
        {/* Blurred preview behind */}
        <div style={{position:"absolute",inset:0,opacity:0.15,filter:"blur(8px)",padding:20,overflow:"hidden",pointerEvents:"none"}}>
          {LEADERBOARD.slice(0,5).map((e,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{fontSize:fs(18)}}>{e.rank===1?"🥇":e.rank===2?"🥈":e.rank===3?"🥉":"  "}</span>
              <span style={{color:"#e2e8f0",fontWeight:600}}>{e.user}</span>
              <span style={{color:"#22d3ee",fontFamily:MONO,marginLeft:"auto"}}>{pnlSign(e.curVal-100000)}{fmt(((e.curVal-100000)/100000)*100,1)}%</span>
            </div>
          ))}
        </div>
        {/* Upgrade CTA */}
        <div style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:400}}>
          <div style={{fontSize:fs(52),marginBottom:16}}>🏆</div>
          <div style={{fontSize:fs(24),fontWeight:700,fontFamily:MONO,color:"#fbbf24",marginBottom:8}}>Portfolio Challenge</div>
          <div style={{fontSize:fs(15),color:"#94a3b8",lineHeight:1.6,marginBottom:6}}>Compete against 847+ traders with $100K paper money. Pick your tickers, lock in before market open, and climb the leaderboard.</div>
          <div style={{fontSize:fs(14),color:"#64748b",marginBottom:24}}>Top performers this week:</div>
          <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:24}}>
            {LEADERBOARD.slice(0,3).map((e,i)=>(
              <div key={i} style={{background:"rgba(251,191,36,0.04)",border:"1px solid rgba(251,191,36,0.12)",borderRadius:10,padding:"12px 16px",textAlign:"center",minWidth:100}}>
                <div style={{fontSize:fs(22),marginBottom:4}}>{i===0?"🥇":i===1?"🥈":"🥉"}</div>
                <div style={{fontSize:fs(13),fontWeight:600,color:"#e2e8f0"}}>{e.user}</div>
                <div style={{fontSize:fs(15),fontWeight:700,color:"#22d3ee",fontFamily:MONO,marginTop:4}}>{pnlSign(e.curVal-100000)}{fmt(((e.curVal-100000)/100000)*100,1)}%</div>
              </div>
            ))}
          </div>
          <button style={{padding:"12px 32px",borderRadius:10,background:"linear-gradient(135deg, #fbbf24, #f59e0b)",border:"none",color:"#0a0e18",fontSize:fs(16),fontWeight:700,cursor:"pointer",fontFamily:MONO,transition:"transform 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.03)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
            Upgrade to Legend — $9.99/mo
          </button>
          <div style={{fontSize:fs(12),color:"#475569",marginTop:10}}>Cancel anytime · First week free</div>
        </div>
      </div>
    );
  }

  // ── Paid user: Full challenge ───────────────────────────────
  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:fs(26)}}>🏆</span>
            <div>
              <div style={{fontSize:fs(20),fontWeight:700,fontFamily:MONO,color:"#fbbf24"}}>Portfolio Challenge</div>
              <div style={{fontSize:fs(12),color:"#64748b"}}>$100K paper money · Max 10 picks · Locks 9:29 AM ET</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:fs(11),color:"#475569"}}>Your Rank</div>
              <div style={{fontSize:fs(20),fontWeight:700,color:"#fbbf24",fontFamily:MONO}}>#4</div>
            </div>
            <div style={{width:1,height:28,background:"rgba(255,255,255,0.06)"}}/>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:fs(11),color:"#475569"}}>Your P&L</div>
              <div style={{fontSize:fs(15),fontWeight:700,color:pnlColor(myPnl),fontFamily:MONO}}>{pnlSign(myPnl)}{fmt(Math.abs(myPct),1)}%</div>
            </div>
          </div>
        </div>

        {/* Period Tabs with Info */}
        <div style={{display:"flex",gap:12,marginBottom:8,flexWrap:"wrap"}}>
          {["weekly","monthly","6month","yearly"].map(t=>{
            const participants = t==="weekly"?847:t==="monthly"?1243:t==="6month"?3156:5892;
            const isEntered = t==="weekly"||t==="monthly"; // Mock: user entered weekly & monthly
            return (
              <div key={t} style={{position:"relative",display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>setPeriod(t)} style={{padding:"5px 14px",borderRadius:6,fontSize:fs(12),fontWeight:600,background:period===t?"rgba(251,191,36,0.12)":"transparent",border:period===t?"1px solid rgba(251,191,36,0.25)":"1px solid transparent",color:period===t?"#fbbf24":"#64748b",cursor:"pointer",fontFamily:MONO}}>{t==="6month"?"6 Month":t==="yearly"?"1 Year":t.charAt(0).toUpperCase()+t.slice(1)}</button>
                <button 
                  onClick={(e)=>{e.stopPropagation();setShowPeriodInfo(showPeriodInfo===t?null:t);}}
                  style={{padding:"5px 10px",borderRadius:6,fontSize:fs(10),background:period===t?"rgba(251,191,36,0.08)":"rgba(255,255,255,0.03)",border:period===t?"1px solid rgba(251,191,36,0.2)":"1px solid rgba(255,255,255,0.08)",color:isEntered?"#29e1a6":"#64748b",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}
                >
                  <Icon d={I.users} size={10}/>{participants>999?`${(participants/1000).toFixed(1)}K`:participants}
                </button>
                {showPeriodInfo===t && (
                  <div style={{position:"absolute",top:"100%",left:0,marginTop:6,width:200,background:"#111111",border:"1px solid #1f1f1f",borderRadius:8,padding:12,zIndex:50,boxShadow:"0 10px 30px rgba(0,0,0,0.4)"}}>
                    <div style={{fontSize:fs(13),fontWeight:700,color:"#fbbf24",marginBottom:8}}>{t==="6month"?"6 Month":t==="yearly"?"1 Year":t.charAt(0).toUpperCase()+t.slice(1)} Challenge</div>
                    <div style={{fontSize:fs(11),color:"#94a3b8",marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span>Participants</span><span style={{fontFamily:MONO,color:"#e2e8f0"}}>{participants.toLocaleString()}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span>Prize Pool</span><span style={{fontFamily:MONO,color:"#29e1a6"}}>${t==="weekly"?"500":t==="monthly"?"2K":t==="6month"?"10K":"50K"}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Ends</span><span style={{fontFamily:MONO,color:"#e2e8f0"}}>{t==="weekly"?"Fri Feb 7":t==="monthly"?"Feb 28":t==="6month"?"Jul 31":"Dec 31"}</span></div>
                    </div>
                    <div style={{borderTop:"1px solid #1f1f1f",paddingTop:8,marginTop:8}}>
                      {isEntered ? (
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#29e1a6"}}/>
                          <span style={{fontSize:fs(11),color:"#29e1a6",fontWeight:600}}>You're Entered</span>
                          <span style={{fontSize:fs(10),color:"#64748b",marginLeft:"auto"}}>@legend_user</span>
                        </div>
                      ) : (
                        <button onClick={()=>{setView("enter");setShowPeriodInfo(null);}} style={{width:"100%",padding:"6px",borderRadius:5,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",border:"none",color:"#0a0e18",fontSize:fs(10),fontWeight:700,cursor:"pointer"}}>Enter Challenge</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* View Tabs */}
        <div style={{display:"flex",gap:2}}>
          {[{id:"leaderboard",label:"🏅 Leaderboard"},{id:"myPortfolio",label:"📊 My Portfolio"},{id:"enter",label:"🎯 Enter"},{id:"feed",label:"💬 Live Feed"},{id:"history",label:"🏆 Winners"}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)} style={{padding:"6px 12px",borderRadius:6,fontSize:fs(12),fontWeight:500,background:view===v.id?"rgba(255,255,255,0.06)":"transparent",border:"none",color:view===v.id?"#e2e8f0":"#475569",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div style={{flex:1,overflow:"auto",padding:"12px 20px 20px"}}>

        {/* ════════ LEADERBOARD ════════ */}
        {view==="leaderboard"&&(<div>
          {/* Super Bowl Banner */}
          <div style={{background:"linear-gradient(135deg, rgba(249,115,22,0.12), rgba(239,68,68,0.06))",border:"1px solid rgba(249,115,22,0.2)",borderRadius:10,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:fs(26)}}>🏈</span>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:fs(14),fontWeight:700,color:"#f97316"}}>SUPER BOWL CHALLENGE</span>
                  <span style={{fontSize:fs(10),background:"rgba(239,68,68,0.15)",color:"#ef4444",padding:"2px 8px",borderRadius:4,fontWeight:700,animation:"pulse 2s infinite"}}>3 DAYS LEFT</span>
                </div>
                <div style={{fontSize:fs(12),color:"#94a3b8",marginTop:2}}>Special event: $10K paper money. Top 3 win real cash prizes. 847 traders competing.</div>
              </div>
            </div>
            <button onClick={()=>setView("enter")} style={{padding:"8px 18px",borderRadius:6,background:"linear-gradient(135deg, #f97316, #ef4444)",border:"none",color:"#fff",fontSize:fs(12),fontWeight:700,cursor:"pointer",fontFamily:MONO,whiteSpace:"nowrap",flexShrink:0}}>Join Now</button>
          </div>

          {/* Rules */}
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            {[{icon:"💰",label:"$100K",desc:"Paper money"},{icon:"📊",label:"Max 10",desc:"Min $5K each"},{icon:"🔒",label:"9:29 AM",desc:"Lock time"},{icon:"🏅",label:"Top 3",desc:"Win badges"},{icon:"📋",label:"Copy Picks",desc:"Clone winners"}].map((r,i)=>(
              <div key={i} style={{flex:1,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:fs(18),marginBottom:2}}>{r.icon}</div>
                <div style={{fontSize:fs(11),fontWeight:600,color:"#e2e8f0"}}>{r.label}</div>
                <div style={{fontSize:fs(10),color:"#475569"}}>{r.desc}</div>
              </div>
            ))}
          </div>

          <div style={{fontSize:fs(11),color:"#475569",marginBottom:6,fontFamily:MONO}}>847 participants · {period==="weekly"?"Ends Fri Feb 7":period==="monthly"?"Ends Feb 28":period==="6month"?"Ends Jul 31":"Ends Dec 31"} · Live rankings</div>

          {/* Table */}
          <div style={{display:"grid",gridTemplateColumns:"36px 32px 1fr 130px 80px 65px 44px 44px",gap:6,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",fontSize:fs(10),color:"#475569",fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>
            <span>#</span><span></span><span>Trader</span><span>Picks</span><span>Value</span><span>P&L</span><span>Risk</span><span>Δ</span>
          </div>
          {LEADERBOARD.map((e,i)=>{
            const pnl=e.curVal-100000; const pct=(pnl/100000)*100; const col=pnlColor(pnl); const bc=badgeColors[e.badge];
            return (<div key={i} style={{display:"grid",gridTemplateColumns:"36px 32px 1fr 130px 80px 65px 44px 44px",gap:6,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",alignItems:"center",animation:`fadeIn 0.2s ease-out ${i*0.03}s both`,background:e.rank<=3?`linear-gradient(90deg, ${bc}06, transparent)`:"transparent",cursor:"pointer",transition:"background 0.15s",borderRadius:4}}
              onMouseEnter={ev=>ev.currentTarget.style.background=e.rank<=3?`${bc}0a`:"rgba(255,255,255,0.02)"} onMouseLeave={ev=>ev.currentTarget.style.background=e.rank<=3?`${bc}06`:"transparent"}>
              <div>{e.rank<=3?<span style={{fontSize:e.rank===1?fs(16):fs(14)}}>{e.rank===1?"🥇":e.rank===2?"🥈":"🥉"}</span>:<span style={{fontSize:fs(13),fontWeight:600,color:"#64748b",fontFamily:MONO}}>{e.rank}</span>}</div>
              <div style={{width:28,height:28,borderRadius:"50%",background:bc?`linear-gradient(135deg,${bc}44,${bc}11)`:"rgba(255,255,255,0.05)",border:bc?`2px solid ${bc}55`:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:fs(10),fontWeight:700,color:bc||"#64748b",fontFamily:MONO}}>{e.avi}</div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:fs(13),fontWeight:600,color:"#e2e8f0",cursor:"pointer"}} onClick={()=>{ const u = {...e, portfolio: buildHoldings(e.picks, e.curVal)}; setSelectedUser(u); }}>{e.user}</span>
                {e.streak>=2&&<span style={{fontSize:fs(9),background:"rgba(251,191,36,0.1)",color:"#fbbf24",padding:"1px 5px",borderRadius:3,fontWeight:700,fontFamily:MONO}}>🔥{e.streak}W</span>}
              </div>
              <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>{e.picks.slice(0,3).map(p=><span key={p} style={{fontSize:fs(9),background:"rgba(255,255,255,0.04)",padding:"1px 4px",borderRadius:2,color:"#94a3b8",fontFamily:MONO}}>${p}</span>)}{e.picks.length>3&&<span style={{fontSize:fs(9),color:"#475569"}}>+{e.picks.length-3}</span>}</div>
              <span style={{fontSize:fs(12),fontWeight:600,color:"#e2e8f0",fontFamily:MONO}}>${fmtK(e.curVal)}</span>
              <span style={{fontSize:fs(12),fontWeight:600,color:col,fontFamily:MONO}}>{pnlSign(pnl)}{fmt(pct,1)}%</span>
              <span style={{fontSize:fs(10),fontWeight:600,color:riskColors[e.risk]}}>{e.risk}</span>
              <div style={{display:"flex",alignItems:"center",gap:1}}>{e.rankChange>0&&<><Icon d={I.arrowUp} size={11} style={{color:"#22c55e"}}/><span style={{fontSize:fs(10),color:"#22c55e",fontFamily:MONO}}>{e.rankChange}</span></>}{e.rankChange<0&&<><Icon d={I.arrowDown} size={11} style={{color:"#ef4444"}}/><span style={{fontSize:fs(10),color:"#ef4444",fontFamily:MONO}}>{Math.abs(e.rankChange)}</span></>}{e.rankChange===0&&<span style={{fontSize:fs(10),color:"#334155"}}>—</span>}</div>
            </div>);
          })}

          {/* Copy Winner CTA */}
          <div style={{marginTop:12,display:"flex",gap:8}}>
            <button onClick={()=>copyPortfolio(LEADERBOARD[0])} style={{flex:1,padding:"8px 12px",borderRadius:6,background:"rgba(34,211,238,0.06)",border:"1px solid rgba(34,211,238,0.15)",color:"#22d3ee",fontSize:fs(12),fontWeight:600,cursor:"pointer",fontFamily:MONO,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Icon d={I.copy} size={13} style={{color:"#22d3ee"}}/> Copy #1 Portfolio
            </button>
            <button onClick={()=>setView("enter")} style={{flex:1,padding:"8px 12px",borderRadius:6,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",border:"none",color:"#0a0e18",fontSize:fs(12),fontWeight:700,cursor:"pointer",fontFamily:MONO}}>Enter This Challenge</button>
          </div>
        </div>)}

        {/* ════════ MY PORTFOLIO ════════ */}
        {view==="myPortfolio"&&(<div>
          <div style={{background:"linear-gradient(135deg,rgba(34,211,238,0.06),rgba(6,182,212,0.03))",border:"1px solid rgba(34,211,238,0.15)",borderRadius:12,padding:"18px 22px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}>
              <div>
                <div style={{fontSize:fs(11),color:"#64748b",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4}}>Challenge Portfolio Value</div>
                <div style={{fontSize:fs(32),fontWeight:700,fontFamily:MONO,color:"#e2e8f0"}}>${fmt(myVal,0)}</div>
                <div style={{fontSize:fs(15),fontWeight:600,color:pnlColor(myPnl),fontFamily:MONO,marginTop:4}}>{pnlSign(myPnl)}${fmt(Math.abs(myPnl),0)} ({pnlSign(myPct)}{fmt(Math.abs(myPct),1)}%)</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:fs(11),color:"#475569"}}>Rank</div>
                <div style={{fontSize:fs(28),fontWeight:700,color:"#fbbf24",fontFamily:MONO}}>#4</div>
                <div style={{fontSize:fs(11),color:"#22c55e",fontFamily:MONO}}>↑2 today</div>
              </div>
            </div>
            <div style={{display:"flex",gap:20,marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
              <div><div style={{fontSize:fs(10),color:"#475569"}}>Starting</div><div style={{fontSize:fs(13),fontFamily:MONO,fontWeight:600}}>$100,000</div></div>
              <div><div style={{fontSize:fs(10),color:"#475569"}}>Deployed</div><div style={{fontSize:fs(13),fontFamily:MONO,fontWeight:600}}>${fmt(deployed,0)}</div></div>
              <div><div style={{fontSize:fs(10),color:"#475569"}}>Cash Left</div><div style={{fontSize:fs(13),fontFamily:MONO,fontWeight:600,color:"#f59e0b"}}>${fmt(MY_CASH)}</div></div>
              <div><div style={{fontSize:fs(10),color:"#475569"}}>Holdings</div><div style={{fontSize:fs(13),fontFamily:MONO,fontWeight:600}}>{MY_HOLDINGS.length}/10</div></div>
              <div><div style={{fontSize:fs(10),color:"#475569"}}>Period</div><div style={{fontSize:fs(13),fontFamily:MONO,fontWeight:600,color:"#fbbf24"}}>{period==="weekly"?"This Week":period==="monthly"?"February":period==="6month"?"H1 2026":"2026"}</div></div>
            </div>
          </div>

          <div style={{fontSize:fs(12),fontWeight:600,color:"#94a3b8",marginBottom:6}}>Holdings</div>
          <div style={{display:"grid",gridTemplateColumns:"65px 55px 85px 85px 85px 75px",gap:6,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",fontSize:fs(10),color:"#475569",fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>
            <span>Ticker</span><span>Shares</span><span>Buy Price</span><span>Current</span><span>Value</span><span>P&L</span>
          </div>
          {MY_HOLDINGS.map((h,i)=>{
            const cv=h.curPrice*h.shares; const bv=h.buyPrice*h.shares; const hp=cv-bv; const hpct=(hp/bv)*100;
            return (<div key={h.sym} style={{display:"grid",gridTemplateColumns:"65px 55px 85px 85px 85px 75px",gap:6,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:fs(13),fontFamily:MONO,animation:`fadeIn 0.15s ease-out ${i*0.04}s both`}}>
              <span style={{fontWeight:600,color:"#e2e8f0"}}>${h.sym}</span>
              <span style={{color:"#94a3b8"}}>{h.shares}</span>
              <span style={{color:"#64748b"}}>${fmt(h.buyPrice)}</span>
              <span style={{color:"#cbd5e1"}}>${fmt(h.curPrice)}</span>
              <span style={{color:"#cbd5e1",fontWeight:500}}>${fmt(cv,0)}</span>
              <span style={{color:pnlColor(hp),fontWeight:600}}>{pnlSign(hp)}{fmt(Math.abs(hpct),1)}%</span>
            </div>);
          })}
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={()=>setShowShareCard(true)} style={{flex:1,padding:"10px",borderRadius:8,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",border:"none",color:"#0a0e18",fontSize:fs(13),fontWeight:700,cursor:"pointer",fontFamily:MONO,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Icon d={I.share} size={14} style={{color:"#0a0e18"}}/> Share P&L Card
            </button>
            <button onClick={()=>setView("leaderboard")} style={{flex:1,padding:"10px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#94a3b8",fontSize:fs(13),fontWeight:600,cursor:"pointer",fontFamily:MONO}}>View Leaderboard</button>
          </div>
        </div>)}

        {/* ════════ ENTER CHALLENGE ════════ */}
        {view==="enter"&&(<div>
          <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <Icon d={I.clock} size={15} style={{color:"#fbbf24"}}/>
              <span style={{fontSize:fs(14),fontWeight:600,color:"#fbbf24",fontFamily:MONO}}>Submissions Lock at 9:29 AM ET</span>
            </div>
            <div style={{fontSize:fs(13),color:"#94a3b8",lineHeight:1.5}}>Pick up to 10 tickers. Min $5K per position. Deploy at least $95K of your $100K. Picks lock before market open — no changes until next period.</div>
          </div>

          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:fs(12),marginBottom:4}}>
              <span style={{color:"#64748b"}}>Budget Used</span>
              <span style={{fontFamily:MONO,fontWeight:600,color:"#e2e8f0"}}>${fmt(budgetUsed,0)} / $100,000</span>
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
              <div style={{width:`${Math.min(100, Math.max(0, (budgetUsed/START_VAL)*100))}%`,height:"100%",background:"linear-gradient(90deg,#22d3ee,#06b6d4)",borderRadius:3}}/>
            </div>
            <div style={{fontSize:fs(11),color:"#475569",marginTop:3,fontFamily:MONO}}>${fmt(remaining,0)} remaining · {selectedPicks.length}/10 picks</div>
            {validationError && <div style={{fontSize:fs(12),color:"#f87171",marginTop:6,fontFamily:MONO}}>{validationError}</div>}
          </div>

          <div style={{position:"relative",marginBottom:10}}>
            <div style={{display:"flex",gap:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",alignItems:"center"}}>
              <Icon d={I.search} size={14}/>
              <input
                value={searchQuery}
                onChange={e=>{setSearchQuery(e.target.value);setShowSearch(true);setValidationError("");}}
                onFocus={()=>setShowSearch(true)}
                onBlur={()=>setTimeout(()=>setShowSearch(false),120)}
                placeholder="Search tickers to add..."
                style={{flex:1,background:"none",border:"none",color:"#e2e8f0",fontSize:fs(14),fontFamily:"inherit"}}
              />
            </div>
            {showSearch && searchResults.length>0 && (
              <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:6,background:"#0b1220",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:6,zIndex:20,boxShadow:"0 10px 30px rgba(0,0,0,0.35)"}}>
                {searchResults.map(sym=>(
                  <button key={sym} onMouseDown={e=>{e.preventDefault();addPick(sym);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 8px",borderRadius:6,background:"transparent",border:"none",color:"#e2e8f0",cursor:"pointer",fontSize:fs(13),fontFamily:MONO}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span>${sym}</span>
                    <span style={{fontSize:fs(11),color:"#64748b"}}>Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
            {["NVDA","AAPL","TSLA","BTC","SPY","SOL","META","AMZN","GOOGL","MSFT"].map(s=>(
              <button key={s} onClick={()=>addPick(s)} style={{padding:"5px 12px",borderRadius:5,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#94a3b8",fontSize:fs(12),fontFamily:MONO,fontWeight:500,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(34,211,238,0.3)";e.currentTarget.style.color="#22d3ee"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="#94a3b8"}}>${s}</button>
            ))}
          </div>

          {/* My Saved Picks - Collapsible */}
          {savedPicks.length > 0 && (
            <div style={{marginBottom:12}}>
              <button onClick={()=>setShowSavedPicks(!showSavedPicks)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",padding:0,cursor:"pointer",marginBottom:6}}>
                <Icon d={showSavedPicks ? I.down : I.right} size={12} style={{color:"#64748b"}}/>
                <span style={{fontSize:fs(11),color:"#64748b",textTransform:"uppercase",letterSpacing:0.8}}>My Saved Picks ({savedPicks.length})</span>
              </button>
              {showSavedPicks && (
                <div style={{marginLeft:18}}>
                  {savedPicks.map((p,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",background:"rgba(41,225,166,0.03)",border:"1px solid rgba(41,225,166,0.1)",borderRadius:6,marginBottom:3}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:fs(13),fontWeight:600,color:"#29e1a6",fontFamily:MONO}}>${p.sym}</span>
                        <span style={{fontSize:fs(10),color:"#475569"}}>${fmtK(p.amount)}</span>
                        <span style={{fontSize:fs(9),padding:"2px 5px",borderRadius:3,background:"rgba(255,255,255,0.05)",color:"#64748b"}}>{p.timeframe}</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>loadSavedPick(p)} style={{padding:"3px 8px",borderRadius:4,background:"rgba(41,225,166,0.1)",border:"1px solid rgba(41,225,166,0.2)",color:"#29e1a6",fontSize:fs(10),fontWeight:600,cursor:"pointer"}}>Load</button>
                        <button onClick={()=>removeSavedPick(i)} style={{padding:"3px 6px",borderRadius:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",fontSize:fs(10),cursor:"pointer"}}><Icon d={I.x} size={10}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{fontSize:fs(11),color:"#475569",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>Current Picks</div>
          {selectedPicks.map((p,i)=>{
            const shares = p.amount / getPrice(p.sym);
            const pct = getMockPnlPct(p.sym);
            return (
              <div key={`${p.sym}-${i}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:7,marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:fs(14),fontWeight:600,color:"#e2e8f0",fontFamily:MONO}}>${p.sym}</span>
                  <span style={{fontSize:fs(11),color:"#475569"}}>{formatShares(p.sym, shares)} shares</span>
                  <span style={{fontSize:fs(11),color:pnlColor(pct),fontFamily:MONO,fontWeight:600}}>{pnlSign(pct)}{fmt(Math.abs(pct),1)}%</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:fs(13),fontWeight:600,fontFamily:MONO,color:"#e2e8f0"}}>${fmtK(p.amount)}</span>
                  <button onClick={()=>removePick(p.sym)} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",padding:0}}><Icon d={I.x} size={13}/></button>
                </div>
              </div>
            );
          })}
          <button style={{marginTop:10,padding:"6px 16px",borderRadius:6,background:"linear-gradient(135deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)",border:"1px solid rgba(251,191,36,0.3)",color:"#0a0e18",fontSize:fs(11),fontWeight:600,cursor:"pointer",fontFamily:MONO,textTransform:"uppercase",letterSpacing:"0.05em",boxShadow:"0 2px 8px rgba(251,191,36,0.25)"}}>🔒 Submit Portfolio</button>
        </div>)}

        {/* ════════ LIVE FEED ════════ */}
        {view==="feed"&&(<div>
          {/* Super Bowl Banner */}
          <div style={{background:"linear-gradient(135deg,rgba(249,115,22,0.12),rgba(239,68,68,0.06))",border:"1px solid rgba(249,115,22,0.2)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontSize:fs(20)}}>🏈</span>
              <span style={{fontSize:fs(14),fontWeight:700,color:"#f97316"}}>SUPER BOWL CHALLENGE</span>
              <span style={{fontSize:fs(10),background:"rgba(239,68,68,0.15)",color:"#ef4444",padding:"2px 7px",borderRadius:4,fontWeight:700}}>3 DAYS LEFT</span>
            </div>
            <div style={{fontSize:fs(12),color:"#94a3b8"}}>847 traders competing for real prizes. Top 3 on the leaderboard win.</div>
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:fs(11),fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:0.8}}>Challenge Feed</span>
            </div>
            <span style={{fontSize:fs(11),color:"#334155",fontFamily:MONO}}>847 online</span>
          </div>

          {LIVE_FEED.map((post,i)=>(
            <div key={i} style={{animation:`fadeIn 0.2s ease-out ${i*0.05}s both`}}>
              <FeedCard post={post}/>
            </div>
          ))}
        </div>)}

        {/* ════════ PAST WINNERS ════════ */}
        {view==="history"&&(<div>
          <div style={{fontSize:fs(11),color:"#475569",textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>Hall of Fame</div>
          {PAST_WINNERS.map((w,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"rgba(251,191,36,0.03)",border:"1px solid rgba(251,191,36,0.1)",borderRadius:10,marginBottom:6,animation:`fadeIn 0.2s ease-out ${i*0.05}s both`,cursor:"pointer",transition:"background 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(251,191,36,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(251,191,36,0.03)"}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:fs(22)}}>🏆</span>
                <div>
                  <div style={{fontSize:fs(14),fontWeight:600,color:"#fbbf24"}}>{w.user}</div>
                  <div style={{fontSize:fs(11),color:"#64748b"}}>{w.period}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:fs(15),fontWeight:700,color:"#22d3ee",fontFamily:MONO}}>{w.ret}</div>
                  <div style={{fontSize:fs(11),color:"#64748b",fontFamily:MONO}}>${fmtK(w.val)}</div>
                </div>
                <button onClick={()=>copyPortfolio({user:w.user,picks:EXTRA_USER_PICKS[w.user]||["SPY","QQQ","AAPL"]})} style={{padding:"5px 10px",borderRadius:5,background:"rgba(34,211,238,0.06)",border:"1px solid rgba(34,211,238,0.12)",color:"#22d3ee",fontSize:fs(10),fontWeight:600,cursor:"pointer",fontFamily:MONO}}>Copy Picks</button>
              </div>
            </div>
          ))}

          <div style={{marginTop:14,padding:"14px 16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8}}>
            <div style={{fontSize:fs(13),fontWeight:600,color:"#94a3b8",marginBottom:8}}>How It Works</div>
            <div style={{fontSize:fs(13),color:"#64748b",lineHeight:1.7}}>
              <div style={{display:"flex",gap:8,marginBottom:4}}><span style={{color:"#fbbf24",fontFamily:MONO,fontWeight:600,minWidth:18}}>1.</span><span>Pick up to 10 tickers before 9:29 AM ET on Monday</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4}}><span style={{color:"#fbbf24",fontFamily:MONO,fontWeight:600,minWidth:18}}>2.</span><span>Deploy at least $95K of your $100K paper balance</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4}}><span style={{color:"#fbbf24",fontFamily:MONO,fontWeight:600,minWidth:18}}>3.</span><span>Min $5K per position — max 10 positions</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4}}><span style={{color:"#fbbf24",fontFamily:MONO,fontWeight:600,minWidth:18}}>4.</span><span>Portfolios lock at market open — no changes until next period</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4}}><span style={{color:"#fbbf24",fontFamily:MONO,fontWeight:600,minWidth:18}}>5.</span><span>Top 3 earn Gold 🥇, Silver 🥈, Bronze 🥉 badges</span></div>
              <div style={{display:"flex",gap:8}}><span style={{color:"#fbbf24",fontFamily:MONO,fontWeight:600,minWidth:18}}>6.</span><span>Winners featured on Social Feed + leaderboard permanently</span></div>
            </div>
          </div>
        </div>)}
      </div>

      {selectedUser && <UserProfileModal user={selectedUser} onClose={()=>setSelectedUser(null)} onCopy={copyPortfolio}/>}
      <PnLShareCard
        isOpen={showShareCard}
        onClose={()=>setShowShareCard(false)}
        strategyData={{
          ticker: "CHALLENGE",
          strategyName: "Legend Portfolio",
          timeframe: period==="weekly"?"This Week":period==="monthly"?"This Month":period==="6month"?"H1 2026":"2026",
          pnl: myPnl,
          pnlPercent: Number(myPct.toFixed(1)),
          winRate: 64,
          trades: 42,
          sharpe: 1.9,
          maxDrawdown: 3.8,
          profitFactor: 2.4,
          bestTrade: 5230,
          worstTrade: -1210,
          avgHoldTime: "1d 3h",
          volume: 148230,
          chartData: [100, 101, 99, 103, 106, 104, 108, 110, 107, 112, 115, 117],
          username: "legend_user",
          badge: "streak",
          badgeText: "4W Streak"
        }}
      />

      {/* ════════ PICK ALLOCATION MODAL ════════ */}
      {showPickModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{width:380,background:"#111111",border:"1px solid #1f1f1f",borderRadius:12,overflow:"hidden",boxShadow:"0 25px 50px rgba(0,0,0,0.5)"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #1f1f1f",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:fs(16),fontWeight:700,color:"#29e1a6",fontFamily:MONO}}>${pendingPick}</span>
                <span style={{fontSize:fs(12),color:"#64748b"}}>@ ${fmt(getPrice(pendingPick),2)}</span>
              </div>
              <button onClick={()=>setShowPickModal(false)} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:4}}><Icon d={I.x} size={16}/></button>
            </div>
            
            <div style={{padding:16}}>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:fs(11),color:"#64748b",textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>Allocation Amount</div>
                <input
                  type="range"
                  min={MIN_POSITION}
                  max={Math.min(remaining, 50000)}
                  step={1000}
                  value={pickAmount}
                  onChange={e=>setPickAmount(Number(e.target.value))}
                  style={{width:"100%",accentColor:"#29e1a6"}}
                />
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:fs(11),color:"#475569"}}>
                  <span>$5K</span>
                  <span style={{fontSize:fs(16),fontWeight:700,color:"#29e1a6",fontFamily:MONO}}>${fmtK(pickAmount)}</span>
                  <span>${fmtK(Math.min(remaining, 50000))}</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  {[5000,10000,20000,50000].filter(a=>a<=remaining).map(amt=>(
                    <button key={amt} onClick={()=>setPickAmount(amt)} style={{flex:1,padding:"6px 0",borderRadius:5,background:pickAmount===amt?"rgba(41,225,166,0.15)":"rgba(255,255,255,0.03)",border:pickAmount===amt?"1px solid rgba(41,225,166,0.4)":"1px solid rgba(255,255,255,0.08)",color:pickAmount===amt?"#29e1a6":"#94a3b8",fontSize:fs(11),fontWeight:600,cursor:"pointer",fontFamily:MONO}}>${fmtK(amt)}</button>
                  ))}
                </div>
              </div>
              
              <div style={{marginBottom:16}}>
                <div style={{fontSize:fs(11),color:"#64748b",textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>Timeframe</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {[{id:"day",label:"Day"},{id:"week",label:"Swing"},{id:"month",label:"Position"},{id:"quarter",label:"Long"}].map(tf=>(
                    <button key={tf.id} onClick={()=>setPickTimeframe(tf.id)} style={{padding:"8px 4px",borderRadius:6,background:pickTimeframe===tf.id?"rgba(41,225,166,0.15)":"rgba(255,255,255,0.03)",border:pickTimeframe===tf.id?"1px solid rgba(41,225,166,0.4)":"1px solid rgba(255,255,255,0.08)",color:pickTimeframe===tf.id?"#29e1a6":"#94a3b8",fontSize:fs(10),fontWeight:600,cursor:"pointer",textAlign:"center"}}>
                      <div>{tf.label}</div>
                      <div style={{fontSize:fs(9),color:pickTimeframe===tf.id?"#29e1a6":"#475569",marginTop:2}}>{tf.id==="day"?"1D":tf.id==="week"?"1W":tf.id==="month"?"1M":"3M+"}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{padding:10,background:"rgba(255,255,255,0.02)",borderRadius:6,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:fs(12)}}>
                  <span style={{color:"#64748b"}}>Shares</span>
                  <span style={{color:"#e2e8f0",fontFamily:MONO,fontWeight:600}}>{formatShares(pendingPick, pickAmount/getPrice(pendingPick))}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:fs(12),marginTop:4}}>
                  <span style={{color:"#64748b"}}>Budget After</span>
                  <span style={{color:"#e2e8f0",fontFamily:MONO,fontWeight:600}}>${fmtK(remaining - pickAmount)}</span>
                </div>
              </div>
              
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowPickModal(false)} style={{flex:1,padding:"10px",borderRadius:6,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#94a3b8",fontSize:fs(12),fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={confirmPick} style={{flex:1,padding:"10px",borderRadius:6,background:"linear-gradient(135deg,#29e1a6 0%,#10b981 100%)",border:"none",color:"#0a0e18",fontSize:fs(12),fontWeight:700,cursor:"pointer"}}>Add Position</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>
    </div>
  );
}
