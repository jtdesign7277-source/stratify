# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** Hybrid full-stack with React frontend (Vite) + Vercel serverless functions backend. Split-stack pattern: frontend handles real-time UI state via WebSocket singletons, serverless functions handle authentication, third-party API integration, and data persistence.

**Key Characteristics:**
- Frontend-centric state management via context + custom hooks (StratifyProvider)
- WebSocket singletons for live market data (Alpaca, Twelve Data) — no polling
- Paper trading state in Supabase profiles with local caching
- Vercel serverless for all API routes; cron jobs for market summaries and social posting
- Anthropic Claude (Sophia) with prompt caching for cost control
- Error Boundaries on all top-level pages to prevent gray-screen crashes

## Layers

**Presentation (React Components):**
- Purpose: User interface, real-time data visualization, user interactions
- Location: `src/components/`
- Contains: Page components (TradePage, Dashboard, CryptoPage), charts (LiveChart), panels (SophiaPanel, RightPanel), shared UI widgets
- Depends on: Context (AuthContext, StratifyProvider), Hooks (useAlpacaStream, useAlpacaData), Services (alpacaStream singleton)
- Used by: App router (src/App.jsx)

**State Management & Context:**
- Purpose: Global application state (auth, market data, portfolio, strategies, watchlist)
- Location: `src/context/`, `src/store/`
- Contains: AuthContext (user/session), StratifyProvider (market data, portfolio, watchlist, leaderboard, strategies)
- Depends on: Supabase client, custom store hooks
- Used by: All components via useContext hooks

**Custom Hooks (Store Hooks):**
- Purpose: Encapsulated state logic for market data, portfolio, watchlist, strategies, trade history, leaderboard
- Location: `src/store/hooks/`
- Contains: useMarketData, usePortfolio, useWatchlist, useTradeHistory, useLeaderboard, useStrategies
- Depends on: Supabase, fetch (via /api endpoints), alpacaStream service
- Used by: StratifyProvider, components
- Key patterns: localStorage for dashboard state, Redux-like read/write pattern

**Services (Singletons & Stream Management):**
- Purpose: Centralized WebSocket management and market data streams
- Location: `src/services/`
- Contains: alpacaStream.js (stock + crypto WebSocket manager), twelveDataStream.js (helpers for Twelve Data WebSocket)
- Dependencies: Alpaca API key (from localStorage or env)
- Used by: useAlpacaStream hook, components via hook
- Critical: alpacaStream is a singleton — only ONE stock socket and ONE crypto socket allowed per app instance

**API Layer (Frontend HTTP):**
- Purpose: Client-side API calls to Vercel serverless functions
- Location: Embedded in hooks and components (fetch calls to /api/*)
- Used for: Account data, portfolio sync, watchlist updates, Sophia chat, market data fallbacks
- Pattern: Direct fetch with JWT auth or browser context

**Serverless Backend (API Routes):**
- Purpose: Authentication, third-party API integration, data persistence, cron jobs
- Location: `api/`
- Contains: Account endpoints (`account.js`), orders (`orders.js`), Sophia AI (`sophia-*.js`), cron jobs (`cron/`), webhooks
- Depends on: Supabase (auth, profiles, broker connections), Alpaca API, Twelve Data API, Anthropic API, Redis (for caching/throttling)
- Used by: Frontend (via fetch), Vercel cron scheduler, external webhooks

**Data Persistence:**
- Purpose: User profiles, broker connections, trading mode state, strategies, watchlists
- Location: Supabase (postgres) + Redis (ephemeral cache)
- Tables: profiles, broker_connections, strategies, watchlist_items, community_posts
- Caching: Redis for Twelve Data market data, warroom cache, stocks database

## Data Flow

**Market Data (Live Prices):**

1. App boots → StratifyProvider initializes useMarketData hook
2. useMarketData subscribes to alpacaStream singleton via useAlpacaStream hook
3. alpacaStream maintains one stock WebSocket to Alpaca `/v2/sip` and one crypto WebSocket to `/v1beta3/crypto/us`
4. alpacaStream emits quote updates (bid, ask, last, volume) to registered listeners
5. Components subscribe to specific symbols via useAlpacaStream, receive real-time updates
6. If live data unavailable (not live trading), fallback to Twelve Data WebSocket via useTwelveDataWS hook
7. All updates flow back to components → DOM renders with latest prices

**Paper Trading (Simulation):**

1. User logs in → useAuth loads session from Supabase
2. Dashboard checks trading_mode from user profile (paper or live)
3. If paper: account data cached in profile JSON, portfolio computed from positions array
4. usePaperTrading hook computes paper P&L from cached positions + live quotes
5. Order entry (TraderPage) sends buy/sell to `/api/orders` (paper mode)
6. `/api/orders` creates order record and applies trade to paper portfolio in Supabase
7. Dashboard re-fetches account → usePaperTrading recalculates P&L
8. TopMetricsBar and order panels show updated total gain/loss

**Sophia AI Chat:**

1. User types message in SophiaPanel or StrategyBuilder
2. Component sends message + context (chart, strategy) to `/api/sophia-chat`
3. `/api/sophia-chat` builds system prompt with cache control, sends to Anthropic with prompt caching
4. Response cached on Anthropic (cache_read_input_tokens > 0 on next request)
5. Server returns markdown; frontend renders in Sophia panel
6. Cost tracked via `/api/sophia-chat` using usage metrics

**Market Summary (Cron):**

1. Vercel cron triggers `/api/cron/market-summary?period=premarket` at 9:25 AM ET (Mon-Fri)
2. Handler fetches breaking news, premarket gainers/losers, economic calendar
3. Generates Discord + Twitter summary message
4. Posts to Discord webhook + Twitter via `/api/x-bot-v2`
5. Same flow for market close at 4:05 PM ET

**State Hydration on Mount:**

1. src/main.jsx mounts StratifyProvider
2. StratifyProvider initializes all hooks (useMarketData, usePortfolio, useWatchlist, etc.)
3. Each hook fetches initial state from Supabase or localStorage
4. App.jsx mounts, AuthProvider checks session
5. If user logged in: AuthContext loads user profile
6. Dashboard mounts, loads saved state from localStorage (panel visibility, sidebar expanded)
7. TradePage mounts, connects to alpacaStream
8. All listeners wired; app is interactive

## Key Abstractions

**alpacaStream Singleton:**
- Purpose: Manages one global Alpaca WebSocket connection per stream type (stock, crypto)
- Location: `src/services/alpacaStream.js`
- Pattern: Class-based singleton with connect locks (stockConnectPromise, cryptoConnectPromise) to prevent race conditions
- Exported: Direct instance, not a hook (hook wrapper is useAlpacaStream)
- Critical: Must never open new WebSockets directly — all subscriptions go through this singleton
- Subscribe method: alpacaStream.subscribe('AAPL', (quote) => { /* update */ })

**StratifyProvider:**
- Purpose: Global state tree providing market data, portfolio, watchlist, strategies
- Location: `src/store/StratifyProvider.jsx`
- Pattern: React Context with composed custom hooks
- Exports: useMarketData, usePortfolio, useWatchlist, useTradeHistory, useLeaderboard, useStrategies
- Hydration: Initializes all store hooks on mount; each hook reads from Supabase or localStorage

**Paper Portfolio:**
- Purpose: Simulate trading with $100k starting capital
- Location: `src/store/hooks/usePortfolio.js`, `api/orders.js` (paper mode), `api/paper-portfolio.js`
- State: positions array, buying_power, total cash value stored in Supabase profiles table
- Computation: Total gain/loss = (sum of position values - initial cash) + current cash - starting cash
- Updates: applyTrade method in usePortfolio parses /api/orders responses and updates local state

**Error Boundaries:**
- Purpose: Catch React component errors and display fallback UI instead of gray screen
- Location: `src/components/shared/AppErrorBoundary.jsx`
- Applied: Dashboard.jsx, TradePage.jsx (via lazy load wrapper), new pages must wrap in ErrorBoundary
- Pattern: Class component with componentDidCatch lifecycle

**Lazy Loading Pages:**
- Purpose: Code-split large pages to reduce initial bundle size
- Pattern: import.meta.glob('path') + lazy() wrapper with chunk error handling
- Applied to: TradePage, CommunityPage, AnalyticsPage
- Fallback: "Loading..." message if chunk fails, automatic reload on retry

## Entry Points

**Browser App:**
- Location: `index.html`
- Triggers: Script loads `/src/main.jsx`
- Responsibilities: Mount React app, initialize Sentry error tracking, wrap in StratifyProvider + AuthProvider

**Main React App:**
- Location: `src/App.jsx`
- Responsibilities: Router (landing, auth, dashboard, pages), render layout
- Contains: Auth state check, page navigation, landing page vs dashboard detection

**Dashboard (Main App Shell):**
- Location: `src/components/dashboard/Dashboard.jsx`
- Responsibilities: Layout (sidebar, top metrics, main content area), panel management, modal state
- Contains: Sidebar, TopMetricsBar, DataTable, RightPanel, SophiaPanel, TerminalPanel
- Lazy loads: TradePage, CommunityPage, AnalyticsPage
- Size: 113KB (largest component — contains all dashboard logic)

**Vercel Serverless Entry:**
- Location: `api/` (each `.js` file is a route handler)
- Pattern: export default async function handler(req, res)
- Example: `api/account.js` handles GET /api/account
- Auth: JWT from Authorization header or browser auth context

## Error Handling

**Strategy:** Try-catch with graceful fallback. Frontend errors logged to Sentry. API errors return JSON { error, message }.

**Patterns:**

1. **Component Errors:** Caught by ErrorBoundary → fallback UI rendered
2. **API Call Errors:** Fetch catches → returns error state → component shows error message or falls back to stale data
3. **WebSocket Errors:** alpacaStream reconnects with exponential backoff (max 20s delay)
4. **Auth Errors:** 401 responses trigger sign-out; 403 blocks access
5. **Timeout Errors:** withTimeout utility wraps promises; fails gracefully if exceeded

**Sentry Integration:**
- Initialized in `src/main.jsx` with DSN
- Filters chunk-load errors (app auto-recovers) to reduce noise
- Captures uncaught errors, unhandled rejections, and React error boundaries

## Cross-Cutting Concerns

**Logging:** console.log + Sentry (structured errors)

**Validation:**
- Client-side: HTML5 validation + custom form validators in components
- Server-side: getUserFromToken, resolveAlpacaCredentialsForMode, normalizeTradingMode check auth/mode
- Data validation on Supabase: RLS policies enforce user ownership

**Authentication:**
- Frontend: Supabase Auth (OAuth + email/password)
- Serverless: JWT validation via getUserFromToken (api/lib/tradingMode.js)
- Broker API: API keys retrieved from broker_connections table, rotated per mode (paper/live)

**Rate Limiting:**
- Sophia AI usage tracked in `/api/lib/pro-plus.js` (SOPHIA_USAGE_LIMIT_USD)
- Vercel cron jobs use CRON_SECRET header for auth

**Market Hours Awareness:**
- Utility: `src/lib/marketHours.js` (getMarketStatus, getNextMarketOpen, isMarketOpen)
- Used by: StatusBar, order validation, cron scheduling
- Handles: US market hours (9:30-16:00 ET), pre/after market, weekends, holidays

---

*Architecture analysis: 2026-03-10*
