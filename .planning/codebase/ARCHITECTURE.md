# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** Multi-tier SPA with Vercel serverless backend

**Key Characteristics:**
- React 18 (Vite) frontend + Vercel Node.js serverless functions backend
- Real-time WebSocket streams (Alpaca broker, Twelve Data market data)
- Supabase PostgreSQL for persistence + auth
- Context API for state management (StratifyProvider)
- Singleton services for critical resources (Alpaca WebSocket, Twelve Data streams)

## Layers

**Presentation (React Components):**
- Purpose: Render UI, handle user interaction, display real-time data
- Location: `src/components/`
- Contains: Page components (Dashboard, TradePage, CryptoPage, etc.), shared UI components, feature-specific components (xray, landing, auth)
- Depends on: Context (AuthContext, StratifyProvider), hooks, services, lib utilities
- Used by: App.jsx router

**State Management:**
- Purpose: Centralize application state, manage data subscriptions
- Location: `src/context/`, `src/store/`
- Contains: AuthContext (Supabase auth state), StratifyProvider (market data, portfolio, watchlist, strategies)
- Depends on: Hooks (useMarketData, usePortfolio, etc.), services
- Used by: Components via custom hooks

**Hooks (Business Logic):**
- Purpose: Encapsulate stateful logic, connect to external services
- Location: `src/hooks/`
- Contains: useAlpacaStream, useTwelveData, usePaperTrading, usePortfolio, useSophiaChat, useIndicators, useFeed
- Depends on: Services, lib utilities, context
- Used by: Components and other hooks

**Services (Singleton Managers):**
- Purpose: Manage external connections and data streams
- Location: `src/services/`
- Contains: alpacaStream.js (WebSocket manager with connect locks), twelveDataStream.js, twelveDataWebSocket.js, alpacaService.js, marketData.js
- Depends on: Environment variables for API keys
- Used by: Hooks

**Utilities & Libraries:**
- Purpose: Shared functions, formatting, client initialization
- Location: `src/lib/`, `src/utils/`, `src/data/`
- Contains: supabaseClient.js, twelvedata.js (formatting), billing.js, warRoomIntel.js, marketHours.js, initNewUser.js, stockDatabase.js
- Depends on: External SDKs (Supabase, date libraries)
- Used by: All layers

**API (Vercel Serverless):**
- Purpose: Backend endpoints for client-server communication and scheduled tasks
- Location: `api/`
- Contains: Quote fetching (quote.js, latest-quote.js), market data (xray/*, crypto/*, lse/*), AI chat (sophia-*.js), orders (orders.js, paper-trade.js), cron jobs, webhooks
- Depends on: External APIs (Twelve Data, Alpaca, Anthropic, Stripe), Supabase, Redis
- Used by: Frontend via fetch(), external services (webhooks, cron)

## Data Flow

**Live Market Quotes (WebSocket):**

1. Component mounts (TradePage, Watchlist, etc.) → calls `useAlpacaStream()` hook
2. Hook subscribes to symbols via `alpacaStream.subscribe(symbols)` singleton
3. Singleton opens one persistent WebSocket to Alpaca (`wss://stream.data.alpaca.markets/v2/sip` for stocks, `v1beta3/crypto/us` for crypto)
4. WebSocket messages arrive → singleton caches quotes in `stockQuotes` / `cryptoQuotes` Map
5. Listeners notified → component state updates → re-render with live prices
6. Connect locks (`stockConnectPromise`, `cryptoConnectPromise`) prevent race conditions on reconnect

**Twelve Data Charts (WebSocket + REST):**

1. `LiveChart.jsx` needs OHLC bars + live tick data
2. Resolves `VITE_TWELVE_DATA_API_KEY` via `resolveApiKey()` function (checks variants)
3. Connects to Twelve Data WebSocket (`wss://ws.twelvedata.com/v1/quotes/`) for live ticks
4. REST calls to `/api/xray/*` endpoints for fundamentals (goes through Vercel + `fetchTwelveData()` helper)
5. Caching headers on xray endpoints (3600s max-age)

**Sophia AI Chat:**

1. Component calls `useSophiaChat()` hook → builds messages + system prompt
2. Hook calls `POST /api/sophia-chat` (or sophia-copilot, sophia-insight)
3. API endpoint checks subscription status, rates limit, cost estimation
4. Calls Anthropic with system prompt cached (`cache_control: { type: 'ephemeral' }`)
5. Stream response back to frontend → display token by token
6. Cost tracking via Redis + Supabase usage table

**Paper Trading:**

1. User places order in `TraderOrderEntry` / `OrderEntry` components
2. Component calls `POST /api/paper-trade` with order details
3. Server creates `paper_trades` record in Supabase
4. `usePaperTrading()` hook syncs positions from server
5. `paperPortfolioPositions` cached in `StratifyProvider` context
6. Dashboard computes `syncedPaperUnrealizedPnL` from cached positions + live Alpaca quotes

**Premarket/Close Summaries (Cron):**

1. Vercel cron job triggers at `25 13 * * 1-5` (9:25 AM ET) or `5 20 * * 1-5` (4:05 PM ET)
2. Calls `/api/cron/market-summary?period=premarket|close`
3. Fetches market data, earnings, economic calendar via Twelve Data
4. Posts summary to Discord webhook
5. Updates `warroom_scans` / `warroom_transcripts` in Redis/Supabase

**State Management (StratifyProvider):**

```
StratifyProvider
├── useMarketDataHook() → marketData { prices, ... }
├── usePortfolioHook(prices) → portfolio { positions, totalValue, applyTrade() }
├── useWatchlistHook() → watchlist { symbols, quotes, ... }
├── useTradeHistoryHook() → tradeHistory { trades, ... }
├── useLeaderboardHook() → leaderboard { ranking, ... }
└── useStrategiesHook() → strategies { list, ... }
```

**Subscription Flow:**

1. User upgrades to Pro → Stripe checkout session created
2. Stripe webhook calls `/api/stripe-webhook`
3. Updates `subscriptions` table in Supabase with `status: 'active'`
4. `useSubscription()` hook reads status
5. Components check `isPaidStatus()` or `getSubscriptionStatus()` to unlock features

## Key Abstractions

**AlpacaStreamManager (Singleton):**
- Purpose: Single persistent connection to Alpaca, manage reconnect, avoid connection limit errors
- Examples: `src/services/alpacaStream.js`
- Pattern: Class-based singleton with connect locks, exponential backoff, symbol subscriptions via Map<symbol, Set<listenerId>>
- Critical: No direct `new WebSocket()` in components — all go through `useAlpacaStream()` hook

**fetchTwelveData (Helper):**
- Purpose: Unified Twelve Data API wrapper with error handling, caching support
- Examples: `api/lib/twelvedata.js`, `src/lib/twelvedata.js`
- Pattern: Resolves API key with fallback chain, makes fetch request, validates response
- Used by: All endpoints that need market data (xray, quotes, fundamentals)

**StratifyProvider (Context Tree):**
- Purpose: Root state manager, delegates to specialized hooks
- Examples: `src/store/StratifyProvider.jsx`
- Pattern: Custom hooks + useContext, each hook is responsible for one slice of state
- Access: `useMarketData()`, `usePortfolio()`, `useWatchlist()`, etc.

**Vercel Serverless Handler Pattern:**
- Purpose: Lightweight request handlers with CORS, caching headers, error responses
- Examples: All files in `api/` directory
- Pattern: `export default async function handler(req, res)` with method check, validation, try-catch, CORS headers
- Caching: `Cache-Control: s-maxage=3600, stale-while-revalidate=300` for data endpoints

**Paper Trading Portfolio:**
- Purpose: Simulate live trading without real money
- Examples: `src/hooks/usePaperTrading.js`, `api/paper-trade.js`, `api/paper-portfolio.js`
- Pattern: Supabase `paper_trades` table, compute P&L from position average cost vs. current price
- Access: `Dashboard.syncedPaperUnrealizedPnL`, `Dashboard.syncedPaperTotalGainLossPercent`

## Entry Points

**Frontend Entry Point:**
- Location: `src/main.jsx`
- Triggers: Browser loads index.html → imports main.jsx
- Responsibilities:
  1. Initialize Sentry error tracking
  2. Handle chunk load errors (Vite dynamic imports)
  3. Wrap App in StratifyProvider + StrictMode
  4. Render to #root div

**App Router:**
- Location: `src/App.jsx`
- Triggers: User navigation or direct URL visit
- Responsibilities:
  1. Wrap in AuthProvider + AppErrorBoundary
  2. Define routes (Dashboard, TradePage, CryptoPage, AuthPages, etc.)
  3. Redirect unauthenticated users to landing page

**API Endpoints (Serverless Functions):**
- Location: `api/*.js` (Vercel routing)
- Triggers: Browser fetch() or cron job
- Example entry points:
  - `POST /api/sophia-chat` — Sophia AI chat responses
  - `GET /api/quote?symbol=SPY` — Latest quote from Alpaca
  - `GET /api/xray/profile?symbol=NVDA` — Company fundamentals
  - `POST /api/paper-trade` — Place paper trade
  - `GET /api/cron/market-summary?period=premarket` — Premarket summary (cron)

## Error Handling

**Strategy:** Try-catch with descriptive error messages, preserve user state on errors

**Patterns:**

**Frontend Components:**
- Wrap top-level pages in `<ErrorBoundary>` (see `src/components/shared/AppErrorBoundary.jsx`)
- Gray screen prevents when import fails — Error Boundary catches and displays fallback UI
- Example usage in Dashboard, TradePage, CryptoPage

**API Endpoints:**
```javascript
try {
  const data = await externalApi();
  res.status(200).json({ data });
} catch (err) {
  console.error('[endpoint-name] error:', err);
  const status = err?.status || 500;
  res.status(status).json({ error: err.message || 'Unknown error' });
}
```

**Hooks:**
- Return error state alongside data: `{ data, loading, error }`
- Components display error messages or graceful fallbacks
- Example: `useSophiaChat()` returns `{ messages, loading, error, sendMessage }`

**WebSocket Services:**
- Reconnect on disconnect with exponential backoff
- Track connection state separately for stock/crypto streams
- Connection limit errors trigger cooldown period (30s) before retry
- Singleton pattern ensures only one connection attempt at a time (via `connectPromise`)

**Supabase Auth:**
- Session timeout: 12 seconds (checked via `withSessionTimeout()`)
- Failed session check doesn't force sign-out — preserves existing session on transient failures
- User initialization (`initNewUser`) is resilient — non-fatal if profile already exists

## Cross-Cutting Concerns

**Logging:** `console.error()` / `console.warn()` with module prefixes `[ModuleName]` for debugging

**Validation:**
- API queries: `if (!symbol || symbol.length > 10) return 400`
- WebSocket symbols: Normalize via `normalizeStockSymbol()`, `normalizeCryptoSymbol()` functions
- Auth: Supabase handles JWT validation server-side

**Authentication:**
- Supabase Auth (JWT-based)
- AuthContext provides `useAuth()` hook for components
- Protected endpoints check `Authorization: Bearer {token}` header
- Subscriptions checked via `getSubscriptionStatus()` for feature access

**Rate Limiting:**
- Sophia usage tracked via Redis + Supabase `sophia_usage` table
- Hard limit: `SOPHIA_USAGE_LIMIT_USD` (prevents runaway costs)
- Check before each Sophia request: `estimateSophiaCostUsd()`, `getSophiaUsageUsd()`

**Caching:**
- Redis: Warroom scans, transcripts, cache warming via cron jobs
- HTTP: Vercel caches xray endpoints with `s-maxage=3600`
- Local: Browser caches chart data, watchlist symbols
- Prompt caching: Sophia system prompt uses `cache_control: { type: 'ephemeral' }` for cost savings

---

*Architecture analysis: 2026-03-10*
