# External Integrations

**Analysis Date:** 2025-03-10

## APIs & External Services

**Broker & Market Data:**
- Alpaca - Live stock and crypto trading
  - SDK: `@alpacahq/alpaca-trade-api` 3.1.3
  - Auth: `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`
  - Endpoints: Stock quotes, orders, positions, WebSocket streams (`/v2/sip` stocks, `/v1beta3/crypto/us` crypto)
  - Location: `src/services/alpacaStream.js`, `api/positions.js`, `api/orders.js`

- Twelve Data - Market data, technical indicators, fundamentals
  - SDK: Fetch-based wrapper in `api/lib/twelvedata.js`
  - Auth: `TWELVE_DATA_API_KEY` or `TWELVEDATA_API_KEY` (fallback chain)
  - Endpoints: Time series, RSI, MACD, Bollinger Bands, EMA, quotes, symbol search, LSE universe
  - WebSocket: `wss://ws.twelvedata.com/v1/quotes/price`
  - Location: `api/lib/twelvedata.js`, `api/xray/*`, `api/indicators/*`, `api/cron/market-summary.js`

**AI & Language Models:**
- Anthropic Claude (Sophia)
  - Model: `claude-sonnet-4-20250514`
  - Auth: `ANTHROPIC_API_KEY_SOPHIA`
  - Features: Strategy backtesting, market analysis, chat-based AI assistant
  - Uses prompt caching for cost control
  - Location: `api/sophia-chat.js`, `api/sophia-copilot.js`, `api/sophia-insight.js`

- xAI Grok
  - Auth: `XAI_API_KEY`
  - Features: Alternative AI for content rewriting and community bot personas
  - Location: `api/cron/community-bot.js`, `api/rewrite-script.js`

**News & Market Intelligence:**
- MarketAux
  - Auth: `MARKETAUX_API_KEY`
  - Endpoints: News sentiment, trending articles
  - Location: `api/trending.js`, `api/marketaux/sentiment.js`, `api/marketaux/news.js`

- FRED (Federal Reserve Economic Data)
  - Auth: `FRED_API_KEY`
  - Endpoints: Economic indicators, time series data
  - Location: `api/fred.js`

**Sports & Odds:**
- The Odds API
  - Auth: `ODDS_API_KEY` or `VITE_ODDS_API_KEY`
  - Endpoints: Sports events, live odds
  - Location: `api/odds/sports.js`, `api/odds/events.js`, `api/settle-sports-bets.js`

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side), `VITE_SUPABASE_ANON_KEY` (browser)
  - Client: `@supabase/supabase-js` 2.95.3
  - Tables: Users, subscriptions, watchlists, sophia conversations, strategies, paper portfolio, Discord alerts
  - Location: `src/lib/supabaseClient.js`, `api/lib/supabase.js`

**Caching:**
- Upstash Redis
  - Connection: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Client: `@upstash/redis` 1.36.3
  - Use: Rate limiting, Sophia usage tracking, warroom cache, economic calendar cache
  - Location: `api/paper-portfolio.js`, `api/cron/community-bot.js`, `api/radar/search.js`, `api/economic-calendar/index.js`

**File Storage:**
- Vercel static hosting for frontend assets (images, icons)
- Discord webhook attachments for file delivery
- No explicit S3/cloud storage in current stack

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (custom implementation)
  - Methods: Email/password, OAuth
  - Session management: Browser client (`VITE_SUPABASE_ANON_KEY`)
  - Server-side: Service role key for admin operations
  - Location: `src/lib/supabaseClient.js`, `api/lib/supabase.js`, auth pages in `src/components/auth/`

**Broker Credentials:**
- Alpaca API Key/Secret stored in Supabase (encrypted user credentials)
- Webull API credentials (legacy, not primary)
- Location: `api/alpaca-keys.js`, `api/webull-account.js`

## Monitoring & Observability

**Error Tracking:**
- Sentry
  - Client: `@sentry/react` 10.42.0
  - Integration: Browser error reporting, performance monitoring
  - Location: Configured in app initialization (likely in `src/App.jsx`)

**Logs:**
- Console-based logging (development)
- Vercel runtime logs (production)
- No external log aggregation service

## CI/CD & Deployment

**Hosting:**
- Vercel
  - Frontend: Auto-deploy from `main` branch
  - Serverless: Node.js Functions in `/api` directory
  - Build: `npm run build` → outputs to `dist/`
  - Configuration: `vercel.json` (rewrites, cron jobs, build settings)

**CI Pipeline:**
- None (direct push to `main` triggers Vercel deployment)

**Cron Jobs (Vercel):**
- `/api/cron/market-summary?period=premarket` - 9:25 AM ET weekdays
- `/api/cron/market-summary?period=close` - 4:05 PM ET weekdays
- `/api/warm-cache` - Every minute
- `/api/cron/warm-warroom?batch=scans` - Hourly 1-9 PM ET weekdays
- `/api/cron/warm-warroom?batch=transcripts` - 1:05 PM, 5:05 PM, 9:05 PM ET weekdays
- `/api/cron/community-bot` - Every 10 minutes 6 AM-4 PM ET weekdays
- `/api/feeds?feed=*` (10 feeds) - Weekly on Sundays at 12:00-12:09 PM ET
- `/api/x-bot-v2?type=*` (5 types) - Multiple times daily 1-11 PM ET
- `/api/settle-sports-bets` - Every 5 minutes

## Environment Configuration

**Required env vars (Vercel dashboard):**

**Broker:**
- `ALPACA_API_KEY` - Alpaca broker API key
- `ALPACA_SECRET_KEY` - Alpaca broker secret

**Database & Auth:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase server admin key
- `VITE_SUPABASE_URL` - Supabase URL (browser)
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key (browser)

**Market Data:**
- `TWELVE_DATA_API_KEY` or `TWELVEDATA_API_KEY` - Twelve Data API key
- `VITE_TWELVE_DATA_API_KEY` or `VITE_TWELVEDATA_API_KEY` - Twelve Data key (browser)
- `VITE_TWELVE_DATA_WS_KEY` - Twelve Data WebSocket key for X-Ray

**AI:**
- `ANTHROPIC_API_KEY_SOPHIA` - Claude Sonnet 4 for Sophia
- `XAI_API_KEY` - Grok API for alternative AI tasks

**Payments:**
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `VITE_STRIPE_PRO_PRICE_ID` - Stripe Pro subscription price ID (browser)

**Communications:**
- `DISCORD_WEBHOOK_GENERAL` - Discord general channel webhook
- `DISCORD_WEBHOOK_STRATEGIES` - Strategy notifications
- `DISCORD_WEBHOOK_TRADE_SETUPS` - Trade setup alerts
- `DISCORD_WEBHOOK_MARKET_TALK` - Market discussion
- `DISCORD_WEBHOOK_ANNOUNCEMENTS` - App announcements
- `DISCORD_WEBHOOK_SHOW_YOUR_PNL` - Community P&L sharing
- `RESEND_API_KEY` - Resend email service

**Economic & Market Intelligence:**
- `FRED_API_KEY` - Federal Reserve economic data
- `MARKETAUX_API_KEY` - MarketAux for news/sentiment
- `ODDS_API_KEY` or `VITE_ODDS_API_KEY` - Sports betting odds

**Cache & Rate Limiting:**
- `UPSTASH_REDIS_REST_URL` - Upstash Redis endpoint
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis auth token

**Video & Avatars:**
- `LIVEAVATAR_API_KEY` - HeyGen/LiveAvatar SDK
- `HEYGEN_API_KEY` - HeyGen AI video generation

**Security:**
- `CRON_SECRET` - Vercel cron job authorization header

**App URLs:**
- `VITE_API_URL` - Legacy Railway backend URL (fallback only, not primary)
- `VITE_API_PROXY_TARGET` - Local API proxy for dev (default: `https://stratify.associates`)
- `VITE_APP_URL` - Public app URL

**Secrets location:**
- Vercel Environment Variables dashboard (encrypted at rest)
- `.env.development` for local development (Git-ignored)
- Never committed to repository

## Webhooks & Callbacks

**Incoming Webhooks:**
- Stripe webhook: `POST /api/stripe-webhook`
  - Triggers subscription created/updated/deleted events
  - Location: `api/stripe-webhook.js`

**Outgoing Webhooks:**
- Discord webhooks (6 channels): Discord bot posts strategy alerts, trades, market news
  - Location: `api/lib/discord.js`, multiple cron jobs
- Alpaca order callbacks: (if configured) - order fill notifications
- Supabase realtime: WebSocket subscriptions for live data updates

## Data Flows

**Live Market Data:**
1. Browser → Alpaca WebSocket (`wss://stream.data.alpaca.markets/v2/sip` for stocks, `/v1beta3/crypto/us` for crypto)
2. Managed by singleton: `src/services/alpacaStream.js`
3. Consumed via hook: `src/hooks/useAlpacaStream.js`

**Strategy Backtesting:**
1. Browser → `POST /api/sophia-chat` with strategy request
2. Server fetches OHLCV from Twelve Data API
3. Claude Sonnet processes backtest engine server-side
4. Returns backtest results + AI analysis

**Paper Trading:**
1. Browser → `POST /api/paper-trade` (create trade)
2. Server updates Supabase `paper_portfolio` table
3. Realtime subscription notifies UI of P&L changes

**Market Intelligence:**
1. Vercel cron → `/api/cron/market-summary` (9:25 AM & 4:05 PM ET)
2. Fetches market data from Alpaca
3. Posts summary to Discord webhook
4. Updates Supabase for UI display

---

*Integration audit: 2025-03-10*
