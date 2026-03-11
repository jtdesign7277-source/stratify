# Technology Stack

**Analysis Date:** 2026-03-10

## Languages

**Primary:**
- JavaScript/ES2020+ - React frontend (`src/`), Vercel serverless functions (`api/`), legacy Node.js server (`server/`)
- HTML5 / JSX - React component templates

**Secondary:**
- Python - Legacy backend only (`backend/` directory, not deployed in production)

## Runtime

**Environment:**
- Node.js 18+ (inferred from ES2020+ syntax and module system)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

## Frameworks

**Core Frontend:**
- React 19.2.0 - Frontend UI framework
- Vite 7.2.4 - Build tool and development server
- Vite React Plugin 5.1.1 - JSX support

**Styling:**
- TailwindCSS 4.1.18 - Utility-first CSS framework
- PostCSS 8.5.6 - CSS processing (autoprefixer)

**Charts & Visualization:**
- TradingView Lightweight Charts 5.1.0 - Core charting library (`src/components/dashboard/LiveChart.jsx`)
- Lightweight Charts Line Tools (custom fork from `github:difurious/`) - Drawing tools (Fibonacci, parallel channels, rectangles, lines)
- Fancy Canvas 2.1.0 - Canvas optimization
- Recharts - Fundamentals charts in X-Ray component (`src/components/xray/`)
- AmCharts 5 - Secondary charting option
- Highcharts 12.5.0 + React wrapper - Additional charting capability

**UI & Animation:**
- Framer Motion 12.29.2 - React animation library
- GSAP 3.14.2 - Advanced animation framework
- Canvas Confetti 1.9.3 - Celebration animations
- Lucide React 0.563.0 - Icon library
- Lenis 1.3.18 - Smooth scrolling

**Development:**
- ESLint - JavaScript linting (`eslint.config.js` with React Hooks + React Refresh plugins)
- @vitejs/plugin-react 5.1.1 - React fast refresh

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.95.3 - Database + auth backend (browser + server versions)
- Stripe 20.3.1 - Payment processing (`api/create-checkout-session.js`, `api/stripe-webhook.js`)
- @alpacahq/alpaca-trade-api 3.1.3 - Broker API and WebSocket (stock data, orders, trading)
- node-html-parser 6.1.13 - HTML parsing for feeds/articles

**Real-time & WebSocket:**
- WebSocket (native) - Alpaca streams (`src/services/alpacaStream.js`), Twelve Data streams
- LiveKit Client 2.17.1 - Real-time video/audio communication

**Code Editor & Utilities:**
- @monaco-editor/react 4.7.0 - Monaco code editor (strategy building)
- @hello-pangea/dnd 18.0.1 - Drag-and-drop library
- react-countup 6.5.3 - Animated number counters
- html2canvas 1.4.1 - Screenshot / canvas export

**Server-side (Vercel Functions):**
- @supabase/supabase-js 2.95.3 - Service role database access
- @upstash/redis 1.36.3 - Redis caching (usage limits, Sophia monthly spend tracking, cache warming)

## Configuration

**Build Configuration:**
- `vite.config.js` - Vite build config with React plugin, API proxy, and path alias (`components`)
- `tailwind.config.js` - Custom colors (Linear dark theme + Google Finance dark theme), typography, shadows
- `eslint.config.js` - ESLint rules with React Hooks validation
- `postcss.config.js` - TailwindCSS PostCSS plugin

**Deployment Configuration:**
- `vercel.json` - Deployment config specifying:
  - Build command: `npm run build` → `dist/`
  - Framework: `vite`
  - API rewrites (SPA routing)
  - Cron jobs (premarket summary, market close, cache warming, warroom, feeds, X-bot, sports bets)
  - 18 scheduled Vercel cron jobs for market data, email summaries, Discord posts, strategy generation

**Environment Variables (Frontend - VITE_ prefix):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_TWELVEDATA_API_KEY` / `VITE_TWELVE_DATA_WS_KEY` - Twelve Data API + WebSocket
- `VITE_API_URL` / `VITE_API_BASE` - Legacy API (Railway)
- `VITE_API_PROXY_TARGET` - Local dev proxy target (defaults to `https://stratify.associates`)
- `VITE_STRIPE_PRO_PRICE_ID` - Stripe price ID for Pro subscription
- `VITE_APP_URL` - Public application URL

**Environment Variables (Serverless - Vercel Dashboard):**
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` - Service role for admin API access
- `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` - Broker authentication
- `TWELVE_DATA_API_KEY` / `TWELVEDATA_API_KEY` - Market data (fallback names checked in `api/lib/twelvedata.js`)
- `ANTHROPIC_API_KEY` - Sophia AI (Claude API for strategy building, insights, chat)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Payment processing
- `FRED_API_KEY` - Federal Reserve economic data
- `XAI_API_KEY` / `GROK_API_KEY` - Grok AI (market trends)
- `HEYGEN_API_KEY` / `LIVEAVATAR_API_KEY` - AI avatar video generation
- `RESEND_API_KEY` - Transactional email (`api/contact.js`)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis (usage limits, caching)
- `CRON_SECRET` - Vercel cron job authentication
- `DISCORD_WEBHOOK_*` - Multiple Discord channel webhooks (general, strategies, trade-setups, market-talk, announcements, show-your-pnl, briefings, alerts, movers, recaps)
- `MARKETAUX_API_KEY` - Breaking news feed (Pro+ feature)
- `ODDS_API_KEY` - Sports odds for betting settlement

**Production Hosting:**
- Vercel (frontend + serverless functions)
- Auto-deploy from `main` branch

**Legacy (Not Production):**
- Railway (legacy backend at `https://stratify-backend-production-3ebd.up.railway.app`)
- Express.js server (`server/` directory)
- FastAPI Python backend (`backend/` directory)

## Build Scripts

```bash
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run preview    # Preview built app
```

## Database & Caching

**Primary Database:**
- Supabase (PostgreSQL backend)
  - Tables: `profiles`, `strategies`, `positions`, `orders`, `trades`, `paper_portfolio`
  - Auth: Supabase Auth (email/password, session management)
  - Real-time: Supabase Realtime channels (not heavily used; WebSockets prioritized for market data)

**Caching:**
- Upstash Redis (serverless Redis)
  - Usage tracking (Sophia monthly spend, paper account buy notional limits)
  - Strategy cache (`api/lib/warroom-cache.js`)
  - Stock quote cache (`api/lib/stocks-cache.js`)
  - Feed cache (`api/article.js`)
  - Key patterns: `sophia-usage:{userId}:{year}-{month}`, `limits:paper:buy-notional:{userId}`

**Market Data Streaming:**
- Alpaca WebSocket: `wss://stream.data.alpaca.markets/v2/sip` (stocks), `/v1beta3/crypto/us` (crypto)
- Twelve Data WebSocket: Real-time quotes for charts and tickers

## Analytics & Monitoring

**Error Tracking:**
- Sentry React 10.42.0 - Client-side error monitoring

**Observability:**
- Console logging throughout API functions and services

---

*Stack analysis: 2026-03-10*
