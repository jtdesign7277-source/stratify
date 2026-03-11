# External Integrations

**Analysis Date:** 2026-03-10

## APIs & External Services

**Broker & Trading:**
- Alpaca - Stock/crypto trading and paper trading
  - SDK: `@alpacahq/alpaca-trade-api` 3.1.3
  - Auth: `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` (set in Vercel)
  - Endpoints:
    - REST: `https://api.alpaca.markets` (live), `https://paper-api.alpaca.markets` (paper)
    - WebSocket: `wss://stream.data.alpaca.markets/v2/sip` (stocks), `/v1beta3/crypto/us` (crypto)
  - Usage: `src/services/alpacaStream.js` (singleton WebSocket manager), `api/bars.js`, `api/positions.js`, `api/orders.js`, `api/account.js`
  - Note: Critical singleton pattern — single connection per stream type prevents "connection limit exceeded" errors

**Market Data:**
- Twelve Data - Real-time quotes, fundamentals, technical indicators, extended market data
  - SDK/Client: REST API (HTTP fetch, no SDK)
  - Auth: `TWELVE_DATA_API_KEY` (primary), fallback: `TWELVEDATA_API_KEY`
  - Endpoints: `https://api.twelvedata.com`
  - WebSocket: Real-time quote streams for charts (`src/components/xray/useTwelveDataWS.js`)
  - Usage: `api/xray/profile.js`, `api/xray/statistics.js`, `api/xray/income-statement.js`, `api/xray/balance-sheet.js`, `api/xray/cash-flow.js`, `api/radar/candles.js`, `api/watchlist/quotes.js`, `api/lib/twelvedata.js`

**AI & LLMs:**
- Anthropic Claude - Sophia AI assistant
  - SDK: Direct HTTP calls to `https://api.anthropic.com/v1/messages`
  - Auth: `ANTHROPIC_API_KEY`
  - Version: 2023-06-01
  - Usage: `api/sophia-chat.js`, `api/sophia-insight.js`, `api/sophia-copilot.js`, `api/summarize.js`, `api/x-bot-v2.js`
  - Features: Prompt caching on system prompts (ephemeral) for cost optimization — **CRITICAL: cache_control required**

- Grok (xAI) - Alternative LLM for market trends
  - Auth: `XAI_API_KEY` (fallback: `GROK_API_KEY`)
  - Endpoint: HTTP API
  - Usage: `api/trends.js` (market sentiment analysis)

**Video & Avatars:**
- HeyGen - AI avatar video generation
  - SDK: `@heygen/liveavatar-web-sdk` 0.0.10
  - Auth: `HEYGEN_API_KEY`
  - Usage: `api/sophia-speak.js` (Sophia avatar video responses)
  - Alternative: `LIVEAVATAR_API_KEY`

**Email & Communication:**
- Resend - Transactional email service
  - SDK: Direct HTTP to `https://api.resend.com/emails`
  - Auth: `RESEND_API_KEY`
  - Usage: `api/contact.js` (contact form emails to `jeff@stratify-associates.com`)

**Payments & Subscriptions:**
- Stripe - Payment processing and subscription management
  - SDK: `stripe` 20.3.1
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Endpoints: Checkout sessions, billing portal, webhook verification
  - Usage:
    - `api/create-checkout-session.js` - Create subscription checkout
    - `api/stripe-webhook.js` - Listen for `checkout.session.completed`, update `profiles.subscription_status` to 'pro'
    - `api/create-portal-session.js` - Manage billing in customer portal
    - `api/confirm-checkout-session.js` - Verify checkout completion
    - `api/refresh-subscription.js` - Update subscription status
  - Webhook signature verification: Stripe headers validated, then Supabase updated

**Economic & Financial Data:**
- FRED (Federal Reserve Economic Data) - Macroeconomic indicators
  - Auth: `FRED_API_KEY`
  - Endpoint: `https://api.stlouisfed.org/fred/`
  - Usage: `api/fred.js` (series search, observations)

- MarketAux - Breaking news feed
  - Auth: `MARKETAUX_API_KEY`
  - Feature: Pro+ only
  - Usage: Live breaking news alerts (`api/` feeds)

- Odds API - Sports betting odds
  - Auth: `ODDS_API_KEY`
  - Usage: `api/settle-sports-bets.js` (sports bet settlement via cron)

**Community & Messaging:**
- Discord - Community notifications and alerts
  - SDK: Direct HTTP webhook POST
  - Auth: Multiple `DISCORD_WEBHOOK_*` environment variables
  - Webhook Channels:
    - `DISCORD_WEBHOOK_GENERAL` - General chat
    - `DISCORD_WEBHOOK_STRATEGIES` - Strategy announcements
    - `DISCORD_WEBHOOK_TRADE_SETUPS` - Trade setup alerts
    - `DISCORD_WEBHOOK_MARKET_TALK` - Market commentary
    - `DISCORD_WEBHOOK_ANNOUNCEMENTS` - Major announcements
    - `DISCORD_WEBHOOK_SHOW_YOUR_PNL` - P&L submissions
    - `DISCORD_WEBHOOK_BRIEFINGS` - Market briefings
    - `DISCORD_WEBHOOK_ALERTS` - General alerts
    - `DISCORD_WEBHOOK_MOVERS` - Top movers
    - `DISCORD_WEBHOOK_RECAPS` - Market recaps
  - Usage: `api/lib/discord.js` (webhook posting), `api/x-bot-v2.js` (X-bot posts to Discord), `api/cron/market-summary.js`, `api/settle-sports-bets.js`
  - Embeds: Formatted message payloads with title, description, fields, images

**Social Media:**
- Twitter/X - Trading signals and market alerts
  - Usage: `api/x-bot-v2.js` (automated trading posts), `api/test-post.js`
  - Post types: market-open, mag7, breaking, top-movers, crypto, market-close
  - Standard: Breaking news only if confirmed, <280 chars, real market impact

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Browser client: `@supabase/supabase-js` with anon key (`src/lib/supabaseClient.js`)
  - Server client: Service role key in Vercel for admin operations (`api/lib/supabase.js`)
  - Tables: profiles, strategies, positions, orders, trades, broker_connections, paper_portfolio, cache tables
  - Auth: Supabase native (email/password signup, session management)
  - Realtime: Supabase channels (minimal use; prioritized WebSocket for market data)

**Caching:**
- Upstash Redis (serverless)
  - Connection: `KV_REST_API_URL` + `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`)
  - SDK: `@upstash/redis` 1.36.3
  - Usage:
    - Sophia monthly usage tracking: `sophia-usage:{userId}:{year}-{month}`
    - Paper account buy notional limits: `limits:paper:buy-notional:{userId}`
    - Strategy warroom cache (`api/lib/warroom-cache.js`)
    - Stock quote cache (`api/lib/stocks-cache.js`)
    - Feed article cache (`api/article.js`)
  - Expiry: Monthly keys auto-expire after 31 days

**File Storage:**
- Local filesystem only — no cloud object storage (S3, GCS, etc.)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (custom, PostgreSQL-backed)
  - Email/password signup and login
  - Session tokens stored in localStorage (browser)
  - Service role access for admin operations (Vercel)
  - User ID: UUID primary key in profiles table

**Social Logins:**
- Not implemented (Supabase OAuth configured but not active in codebase)

## Monitoring & Observability

**Error Tracking:**
- Sentry React 10.42.0 - Client-side crash reporting

**Logs:**
- Console logging in API functions and services (no centralized log aggregation)

## CI/CD & Deployment

**Hosting:**
- Vercel - Frontend + serverless functions
  - Auto-deploy from `main` branch
  - Build: `npm run build` → outputs to `dist/`
  - Functions: `/api/*` directory auto-deployed as serverless functions

**Cron Jobs:**
Defined in `vercel.json`, authenticated via `CRON_SECRET`:
- Pre-market summary: `25 13 * * 1-5` (9:25 AM ET)
- Market close summary: `5 20 * * 1-5` (4:05 PM ET)
- Cache warming: `* * * * *` (every minute)
- Warroom batch (scans): `0 13,14,15,16,17,18,19,20,21 * * 1-5` (trading hours)
- Warroom batch (transcripts): `5 13,17,21 * * 1-5`
- Warroom batch (transcripts2): `10 13,17,21 * * 1-5`
- Trends analysis: `*/10 13-21 * * 1-5` (every 10 min during market hours)
- Community bot: `*/10 6-16 * * 1-5` (every 10 min pre/post market)
- Feed generation (Earnings, Momentum, Trending, Options, Macro, Sentiment, Bitcoin, AI, Trump, MemeStocks): `0-8 12 * * 0` (Sundays)
- X-Bot posts (market-open, mag7, breaking, top-movers, crypto, market-close): Scheduled throughout trading day
- Sports bet settlement: `*/5 * * * *` (every 5 minutes)

**Legacy:**
- Railway (deprecated) — old backend at `https://stratify-backend-production-3ebd.up.railway.app`

## Environment Configuration

**Required for Production:**
Frontend (Vercel dashboard):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` - Supabase
- `VITE_TWELVE_DATA_WS_KEY` - Real-time data
- `VITE_STRIPE_PRO_PRICE_ID` - Checkout
- `VITE_APP_URL` - Public URL

Serverless (Vercel dashboard):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database admin
- `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` - Trading
- `TWELVE_DATA_API_KEY` - Market data
- `ANTHROPIC_API_KEY` - Sophia AI
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payments
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` - Redis caching
- `FRED_API_KEY`, `XAI_API_KEY`, `HEYGEN_API_KEY`, `RESEND_API_KEY` - Optional integrations
- `DISCORD_WEBHOOK_*` - Discord channels
- `CRON_SECRET` - Cron job auth

**Secrets Management:**
- All secrets stored in Vercel dashboard (not in codebase)
- Environment file (`.env*`) contains only non-sensitive defaults

---

*Integration audit: 2026-03-10*
