# Technology Stack

**Analysis Date:** 2025-03-10

## Languages

**Primary:**
- JavaScript (ES modules) - React frontend, Vercel serverless functions, browser runtime
- React 19.2.0 - UI framework with hooks for state management

**Secondary:**
- Node.js - Serverless function runtime on Vercel

## Runtime

**Environment:**
- Node.js 18+ (Vercel default)
- Browser runtime (modern ES2020+)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React 19.2.0 - Component library and state management
- Vite 7.2.4 - Build tool and dev server
- TailwindCSS 4.1.18 - Utility-first CSS styling with custom dark theme colors

**UI Components & Charts:**
- Lightweight Charts 5.1.0 - TradingView charting (candlesticks, technical analysis)
- Highcharts 12.5.0 - Advanced financial dashboards with amCharts5
- Recharts - React charting library (fundamentals dashboards)
- Lucide React 0.563.0 - Icon library
- Framer Motion 12.29.2 - Animation framework
- `@hello-pangea/dnd` 18.0.1 - Drag-and-drop for watchlist/portfolio

**Testing & Quality:**
- ESLint (configuration file present: `eslint.config.js`)

**Build/Dev:**
- @vitejs/plugin-react 5.1.1 - React Fast Refresh for Vite
- Autoprefixer 10.4.23 - CSS vendor prefixing
- PostCSS 8.5.6 - CSS processing pipeline

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.95.3 - Backend database, auth, realtime subscriptions
- @alpacahq/alpaca-trade-api 3.1.3 - Broker API client (stocks, crypto, orders)
- stripe 20.3.1 - Payment processing (subscription checkout + webhook handling)

**Infrastructure & Data:**
- @upstash/redis 1.36.3 - Redis cache for rate limiting, session data, usage tracking
- node-html-parser 6.1.13 - Parse HTML (news articles, web scraping)

**AI & Advanced Features:**
- @heygen/liveavatar-web-sdk 0.0.10 - AI avatar video generation
- @monaco-editor/react 4.7.0 - Code editor for strategy/script building
- livekit-client 2.17.1 - Video/audio conferencing (community features)

**Monitoring & Error Handling:**
- @sentry/react 10.42.0 - Error tracking and performance monitoring

**Animations & UX:**
- gsap 3.14.2 - GSAP animation library
- canvas-confetti 1.9.3 - Celebration effects (trade wins)
- lenis 1.3.18 - Smooth scrolling library
- html2canvas 1.4.1 - Screenshot/export charts to PNG

**Line Drawing Tools (charting):**
- lightweight-charts-line-tools-core (GitHub custom build)
- lightweight-charts-line-tools-fib-retracement (GitHub custom build)
- lightweight-charts-line-tools-lines (GitHub custom build)
- lightweight-charts-line-tools-parallel-channel (GitHub custom build)
- lightweight-charts-line-tools-rectangle (GitHub custom build)

**Utilities:**
- react-countup 6.5.3 - Animated number counters (P&L, gains)
- react-dom 19.2.0 - React DOM rendering

## Configuration

**Environment:**
- Environment variables configured in Vercel dashboard (no `.env` files committed)
- Development: `.env.development` file for local API proxy
- Frontend variables prefixed with `VITE_` (exposed to browser)
- Serverless variables without prefix (private to API functions)

**Build:**
- `vite.config.js` - Vite configuration with React plugin, optimization deps for line-tools
- `tailwind.config.js` - Custom color scheme (linear-* and gf-* themes)
- `postcss.config.js` - PostCSS integration
- `vercel.json` - Vercel deployment config (rewrites, cron jobs, build command)

## Platform Requirements

**Development:**
- Node.js 18+
- npm
- Vite dev server on `http://localhost:5173`
- Optional: Vercel CLI for local serverless function testing

**Production:**
- Vercel (frontend + serverless API functions)
- Auto-deploy from `main` branch
- Frontend: Static site from `dist/` build output
- Serverless: Node.js runtime on Vercel Functions

## External Services & Credentials

**Critical secrets stored in Vercel dashboard (NOT in repo):**
- `ANTHROPIC_API_KEY_SOPHIA` - Claude Sonnet 4 AI for Sophia assistant
- `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` - Broker credentials
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database admin access
- `TWELVE_DATA_API_KEY`, `TWELVEDATA_API_KEY` - Market data API
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payment processing
- `DISCORD_WEBHOOK_*` (multiple channels) - Discord bot webhooks
- `FRED_API_KEY` - Federal Reserve economic data
- `RESEND_API_KEY` - Transactional email
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Cache/rate limit
- `LIVEAVATAR_API_KEY` - AI avatar video
- `XAI_API_KEY` - Grok AI (xAI) integration
- `ODDS_API_KEY` - Sports betting odds

---

*Stack analysis: 2025-03-10*
