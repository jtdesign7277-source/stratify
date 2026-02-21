# Stratify — Complete Platform Knowledge Base

## What Is Stratify
Stratify is an AI-powered stock trading strategy platform at stratify.associates. It combines real-time market data, AI strategy generation (via Sophia AI), backtesting, paper/live trading via connected brokers, and social features like leaderboards and challenges. Think TradingView meets AI meets brokerage — all in one dark terminal-pro interface.

## Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: TailwindCSS (dark theme, emerald accents)
- **Animations**: Framer Motion
- **Charts**: TradingView Lightweight Charts (pending full Charting Library approval)
- **Hosting**: Vercel (stratify-eight.vercel.app / stratify.associates)
- **Auto-deploy**: GitHub push to main → Vercel auto-deploys

### Backend
- **Serverless Functions**: Vercel /api/ directory (Node.js)
- **Legacy Backend**: Railway (stratify-backend-production-3ebd.up.railway.app) — handles WebSocket streaming for live prices to 500+ concurrent users. Being phased out for everything except WebSocket streaming.
- **Why both**: Vercel serverless can't maintain persistent WebSocket connections. Railway handles the SIP WebSocket stream. All REST endpoints are migrating to Vercel serverless.

### Database & Auth
- **Supabase** (project: mszilrexlupzthauoaxb)
- Auth: Email/password signup, persistent sessions via localStorage token
- Tables: profiles, broker_connections, newsletter_subscribers, sophia_conversations, strategies, trades, leaderboard, emails, tiktok_scripts, tiktok_videos
- RLS: Row Level Security on all tables — users can only see their own data
- Service role key on Vercel env vars for server-side operations

### Market Data
- **Alpaca Markets Premium SIP Feed** (+$192K investment)
  - Real-time stock quotes via WebSocket (onStockQuote, onStockBar methods)
  - Crypto polling every 10 seconds (separate handling required)
  - 3 weeks of intraday historical data for charts
  - SHARED Alpaca keys power market data for ALL users (prices, charts, watchlist)
  - Individual user broker keys are separate — only for their portfolio/trading

- **Twelve Data Pro** ($29/mo)
  - API Key: VITE_TWELVE_DATA_API_KEY in .env.local
  - Plan: 1,597 API calls/min + 1,500 WebSocket credits
  - Coverage: 75 global exchanges — stocks, forex, crypto, ETFs, commodities
  - REST API: https://api.twelvedata.com (time_series, indicators, market movers)
  - WebSocket: wss://ws.twelvedata.com/v1/quotes/price
  - LiveChart component: TradingView Lightweight Charts v5 + Twelve Data WS streaming
  - Features: 100+ server-side technical indicators, batch requests (120 symbols/call), fundamentals, analyst ratings, earnings calendar, insider transactions, market movers

- **Finnhub**: Additional market data source
- **News ticker**: Live scrolling financial news headlines

### Error Monitoring
- **Sentry** (Application Performance Monitoring)
  - Organization: jeff-thompson-uy
  - Project: stratify
  - DSN: https://33b0952ac3a4edcd34f2741854287569@o4510744882642944.ingest.us.sentry.io/4510920320811008
  - SDK: @sentry/react initialized in src/main.jsx
  - Dashboard: 🛡️ Sentry tab in Mission Control
  - API Token: SENTRY_AUTH_TOKEN in Vercel env vars (Mission Control)
  - Permissions: event:admin, project:read, organization:read
  - URL: https://jeff-thompson-uy.sentry.io

### AI — Sophia
- **Model**: Claude Sonnet 4 (claude-sonnet-4-20250514) via Anthropic API
- **Endpoint**: /api/sophia-chat.js on Vercel
- **Streaming**: Yes, SSE parsed manually for real-time typing effect
- **Max tokens**: 4096
- **System prompt**: Trading strategist persona, generates backtest analysis with Key Trade Setups (5 fields), strategy performance metrics, signal quality analysis. NO Python code in responses. Max 6-month backtest lookback.
- **Memory**: sophia_conversations table in Supabase — stores every message per user. Loads last 20 messages as context.
- **Voice**: HeyGen TTS integration
  - Avatar ID: Sophia_public_3_20240320
  - Voice ID: 0b41c487c6da4f5ba5782bbe462958e8 (Annie - Professional)
- **Quick Presets**: Growth Investing, Momentum Trading, Day Trading, RSI Bounce, MACD Crossover, Bollinger Squeeze

### Payments & Email
- **Stripe**: Stratify Pro @ $9.99/month (live)
  - Webhook: Vercel serverless function handles payment events
- **Email**: jeff@stratify-associates.com
  - Contact form: Resend API
  - Newsletter signups: Stored in Supabase newsletter_subscribers table

### Video / AI Avatar
- **HeyGen**: Sophia weekly market recap videos
- **Newsletter page**: Dynamic, reads from newsletters.json

### TikTok Content Pipeline
- **Account**: @ccc72622 (rename to "Stratify" pending)
- **Automation**: Discord AI Content Factory with cron agents
  - Research Agent → Script Agent → Thumbnail Agent (separate Discord channels)
- **Scripts**: Stored in Supabase tiktok_scripts table
- **Videos**: Runway Gen4.5 → tiktok_videos table
- **Mission Control Integration**: TikTok tab with Scripts + Videos sub-tabs
- **Send to Phone**: Telegram bot sends script text or video file + TikTok upload deep link
- **Target**: 30-60s vertical trading/finance content

## File Structure
```
~/Desktop/Stratify/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── KrakenDashboard.jsx (main dashboard container)
│   │   │   ├── Home.jsx (home page with broker cards)
│   │   │   ├── TradePage.jsx (watchlist/trade interface)
│   │   │   ├── PortfolioPage.jsx (portfolio with broker connect)
│   │   │   ├── BrokerConnect.jsx (per-user broker connection UI)
│   │   │   ├── NewsletterPage.jsx (dynamic newsletter archive)
│   │   │   ├── SophiaPanel.jsx (right panel AI chat)
│   │   │   ├── StrategyOutput.jsx (strategy output with trade setup cards)
│   │   │   └── BacktestWizard.jsx (inline backtest wizard)
│   │   └── strategies/
│   │       └── FeaturedStrategies.jsx
│   ├── hooks/
│   │   ├── useSophiaChat.js
│   │   └── useAlpacaData.js
│   └── App.jsx
├── api/ (Vercel serverless functions)
│   ├── sophia-chat.js
│   ├── sophia-speak.js
│   ├── broker-connect.js
│   ├── broker-disconnect.js
│   ├── account.js
│   ├── positions.js
│   ├── stocks.js
│   └── ...
├── public/
│   ├── sophia-recaps/
│   └── broker-logos/
└── server/ (Railway backend — WebSocket streaming)
```

## Strategy Builder Flow
1. User clicks "Build Strategy" or selects Quick Preset in Sophia panel
2. Quick Preset populates editable text in chat input
3. User sends → Sophia generates strategy via Claude API
4. Center panel shows full strategy analysis
5. Key Trade Setups card (6 checkboxes: Entry Signal, Volume, Trend, Risk/Reward, Stop Loss, $ Allocation)
6. Strategy Activation: Symbol, Size, Max/Day, Stop Loss %, Take Profit %
7. Pre-Trade Checklist (6 more checkboxes) before Activate Strategy button enables
8. "Ask Sophia to Retest" sends parameters back to Sophia
9. "Save" stores strategy to user's Strategies folders

## Broker Connection System
- Per-user keys stored in Supabase broker_connections with RLS
- Paper/Live toggle
- Supported: Alpaca (READY), Tradier (READY), Webull (READY), IBKR/TD/NinjaTrader/Coinbase (COMING SOON)
- SHARED Alpaca SIP keys for market data only — never for user trading

## Design Rules
1. Dark theme (#060d18, #0a1628), emerald accents, purple/indigo for strategy cards
2. Icons: Thin pencil-line style (strokeWidth 1.5), no box backgrounds
3. No scrolling required — everything fits on screen
4. Tickers: Always use $ prefix ($AAPL, $BTC)
5. Key Trade Setups card: Dark purple/indigo bg, gold/amber labels, fire emoji, 2-column grid, pencil edit icons — exact copy from Second Brain
6. Strategy Activation: Same styling, gear icon, green input text, pre-trade checklist

## Development Workflow
1. **Codex 5.2**: `codex exec --full-auto "prompt"` for ALL coding
2. **NEVER deploy from local** — only via GitHub push (auto-deploys to Vercel)
3. **Git**: Always main branch, descriptive commit messages
4. **Prefer complete file rebuilds** over incremental patches for major changes
5. **Always include git push** in development prompts
