# Codebase Structure

**Analysis Date:** 2026-03-10

## Directory Layout

```
stratify/
├── src/                          # React frontend (Vite)
│   ├── App.jsx                   # Router, landing page, auth check
│   ├── main.jsx                  # Entry point, Sentry init
│   ├── index.css                 # Global styles
│   ├── assets/                   # Images, icons, SVGs
│   ├── components/               # React components
│   │   ├── dashboard/            # Dashboard pages + panels (largest subsystem)
│   │   │   ├── Dashboard.jsx     # Main shell, layout, state
│   │   │   ├── TradePage.jsx     # Wrapper for TraderPage
│   │   │   ├── TraderPage.jsx    # Stock/ETF order entry + chart (245KB)
│   │   │   ├── CryptoPage.jsx    # Crypto trading UI
│   │   │   ├── Sidebar.jsx       # Left nav (hover to expand)
│   │   │   ├── TopMetricsBar.jsx # World clocks, P&L, metrics
│   │   │   ├── LiveAlertsTicker.jsx # Scrolling news ticker
│   │   │   ├── DataTable.jsx     # Positions/orders/trades/balances
│   │   │   ├── RightPanel.jsx    # Collapsible right sidebar
│   │   │   ├── SophiaPanel.jsx   # AI chat panel (Sophia)
│   │   │   ├── TerminalPanel.jsx # Strategy terminal
│   │   │   ├── StatusBar.jsx     # Connection status bar
│   │   │   ├── WarRoom.jsx       # Live alerts + war room
│   │   │   ├── CommunityPage.jsx # Social trading features
│   │   │   ├── StrategyRadarPage.jsx # Strategy discovery (118KB)
│   │   │   ├── charts/           # Chart components
│   │   │   │   ├── LiveChart.jsx # TradingView Lightweight Charts
│   │   │   ├── community/        # Community features (forums, posts)
│   │   ├── xray/                 # Fundamentals analyzer
│   │   │   ├── XRayPage.jsx      # Income, balance, cash flow, stats
│   │   │   ├── charts/           # Recharts-based fundamental charts
│   │   │   └── hooks/
│   │   │       ├── useTwelveData.js # Fetch via /api/xray/*
│   │   │       └── useTwelveDataWS.js # WebSocket for X-Ray data
│   │   ├── auth/                 # Auth pages
│   │   │   └── SignUpPage.jsx
│   │   ├── shared/               # Reusable UI components
│   │   │   ├── AppErrorBoundary.jsx # Top-level error boundary
│   │   │   ├── SearchBar.jsx
│   │   │   ├── LiveScoresPill.jsx
│   │   ├── strategies/           # Strategy-related UI
│   │   ├── legal/                # Legal pages (privacy, ToS)
│   │   └── ui/                   # Primitive UI components
│   ├── context/                  # React Context providers
│   │   └── AuthContext.jsx       # Authentication state (user, session)
│   ├── store/                    # Global state management
│   │   ├── StratifyProvider.jsx  # Root context provider
│   │   └── hooks/                # Store hooks
│   │       ├── useMarketData.js  # Market prices + streams
│   │       ├── usePortfolio.js   # Portfolio + P&L computation
│   │       ├── useWatchlist.js   # Watched symbols
│   │       ├── useTradeHistory.js # Trade records
│   │       ├── useLeaderboard.js # Leaderboard state
│   │       └── useStrategies.js  # Saved strategies
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAlpacaStream.js    # Hook into alpacaStream singleton
│   │   ├── useAlpacaData.js      # Fetch account data from /api/account
│   │   ├── usePaperTrading.js    # Paper trading mode logic
│   │   ├── useSubscription.js    # Check subscription status
│   │   ├── useWatchlistSync.js   # Sync watchlist with Supabase
│   │   ├── useStrategySync.js    # Sync strategies with Supabase
│   │   ├── useDashboardStateSync.js # Persist panel state
│   │   └── useTradingMode.js     # Trading mode (paper/live) detection
│   ├── services/                 # Singletons and managers
│   │   ├── alpacaStream.js       # Alpaca WebSocket singleton (1 stock + 1 crypto)
│   │   ├── twelveDataStream.js   # Twelve Data WebSocket helpers
│   │   ├── alpacaService.js      # Alpaca REST API wrappers
│   │   └── marketData.js         # Market data utilities
│   ├── lib/                      # Utility functions and clients
│   │   ├── supabaseClient.js     # Supabase browser client
│   │   ├── twelvedata.js         # Twelve Data formatting helpers
│   │   ├── marketHours.js        # Market open/close times
│   │   ├── billing.js            # Subscription helpers (Pro/Pro+)
│   │   ├── kalshi.js             # Kalshi prediction market API
│   │   ├── arbScanner.js         # Arbitrage opportunity scanner
│   │   ├── warRoomIntel.js       # War Room data processing
│   │   ├── checkoutSession.js    # Stripe checkout persistence
│   │   └── withTimeout.js        # Promise timeout wrapper
│   ├── data/                     # Static/generated data
│   │   └── stockDatabase.js      # Stock symbol database (extracted to avoid circular imports)
│   ├── pages/                    # Top-level pages (outside dashboard)
│   │   ├── ResetPasswordPage.jsx # Password reset flow
│   │   └── SportsOddsPage.jsx    # Sports betting page
│   ├── styles/                   # Global CSS
│   ├── utils/                    # Utility functions
│   ├── plugins/                  # Plugin system
│   └── assets/                   # Static assets
├── api/                          # Vercel serverless functions
│   ├── account.js                # GET /api/account (account balance, buying power, etc.)
│   ├── orders.js                 # POST /api/orders (create order, paper + live)
│   ├── paper-portfolio.js        # GET/POST paper portfolio endpoints
│   ├── paper-history.js          # GET paper trade history
│   ├── alpaca-keys.js            # GET cached Alpaca keys (for browser WebSocket)
│   ├── xray/                     # Fundamentals API endpoints
│   │   ├── profile.js            # Company profile from Twelve Data
│   │   ├── quote.js              # Real-time quote
│   │   ├── statistics.js         # Financial stats
│   │   ├── income-statement.js   # Income statement data
│   │   ├── balance-sheet.js      # Balance sheet data
│   │   └── cash-flow.js          # Cash flow statement
│   ├── sophia-chat.js            # POST /api/sophia-chat (Sophia AI chat)
│   ├── sophia-copilot.js         # POST /api/sophia-copilot (contextual AI)
│   ├── sophia-insight.js         # POST /api/sophia-insight (market insight)
│   ├── cron/                     # Scheduled jobs
│   │   ├── market-summary.js     # Premarket + close summaries
│   │   ├── warm-cache.js         # Cache warming
│   │   ├── warm-warroom.js       # Warm War Room cache
│   │   └── community-bot.js      # Community bot actions
│   ├── feeds.js                  # GET /api/feeds (news feeds: Earnings, Momentum, Trending, etc.)
│   ├── news.js                   # GET /api/news (latest news)
│   ├── earnings.js               # GET /api/earnings (earnings data)
│   ├── earnings-transcript.js    # GET /api/earnings-transcript
│   ├── x-bot-v2.js               # POST /api/x-bot-v2 (Twitter posting)
│   ├── discord-post.js           # Discord webhook posting
│   ├── market-intel.js           # Market intelligence data
│   ├── market-movers.js          # Top gainers/losers
│   ├── finance.js                # General finance data
│   ├── discover.js               # Stock discovery API
│   ├── latest-quote.js           # Latest stock quote
│   ├── backtest.js               # POST /api/backtest (strategy backtesting)
│   ├── chat.js                   # General chat endpoint
│   ├── stripe-webhook.js         # POST /api/stripe-webhook (payment handling)
│   ├── create-checkout-session.js # Stripe checkout session
│   ├── confirm-checkout-session.js # Confirm checkout
│   ├── create-portal-session.js  # Stripe customer portal
│   ├── contact.js                # POST /api/contact (contact form)
│   ├── broker-connect.js         # Alpaca connection flow
│   ├── broker-disconnect.js      # Disconnect broker
│   ├── lib/                      # Shared serverless utilities
│   │   ├── supabase.js           # Supabase admin client
│   │   ├── tradingMode.js        # Trading mode helpers (paper/live)
│   │   ├── alpaca.js             # Alpaca API client
│   │   ├── twelvedata.js         # Twelve Data API client
│   │   ├── indicators.js         # Technical indicators
│   │   ├── pro-plus.js           # Sophia usage tracking + Pro+ helpers
│   │   ├── discord.js            # Discord webhook client
│   │   ├── stocks-cache.js       # Redis stock database cache
│   │   └── warroom-cache.js      # War Room Redis cache
│   ├── crypto/                   # Crypto-specific endpoints
│   ├── lse/                      # London Stock Exchange endpoints
│   ├── global-markets/           # Global market data endpoints
│   ├── community/                # Community API endpoints
│   ├── discord/                  # Discord-related endpoints
│   ├── odds/                     # Sports odds endpoints
│   └── indicators/               # Technical indicator endpoints
├── vite.config.js                # Vite build config
├── vercel.json                   # Vercel deployment config (cron jobs)
├── tailwind.config.js            # Tailwind CSS config
├── postcss.config.js             # PostCSS config
├── eslint.config.js              # ESLint config
├── package.json                  # Dependencies
├── .env.development              # Local dev env vars
├── .env.production               # Production env vars (minimal)
├── index.html                    # HTML entry point
├── CLAUDE.md                     # Project context + rules
└── .planning/codebase/           # GSD documentation
    ├── ARCHITECTURE.md           # This file
    └── STRUCTURE.md              # Directory structure & conventions
```

## Directory Purposes

**src/components/dashboard/:**
- Purpose: Dashboard application — all trading UI, panels, charts, data tables
- Contains: 120+ components ranging from 1KB (simple buttons) to 245KB (TraderPage)
- Key files: Dashboard.jsx (shell), TraderPage.jsx (largest), CryptoPage.jsx, StrategyRadarPage.jsx
- Pattern: Component per feature/page, no shared state except via context/hooks
- Largest subsystem: handles 80% of UI interactions

**src/context/:**
- Purpose: Global React Context providers
- Contains: AuthContext (user/session management)
- Pattern: Hooks-based context (useAuth)
- Size: Minimal — only authentication; market data state moved to store/

**src/store/:**
- Purpose: Application state management (market data, portfolio, watchlist, strategies)
- Contains: StratifyProvider.jsx (root context) + hook implementations
- Pattern: Composed custom hooks, each with read/write methods
- Hydration: Each hook loads initial state from Supabase or localStorage on mount
- Used by: All components via useMarketData, usePortfolio, etc.

**src/services/:**
- Purpose: Singletons and stateful managers (WebSocket, API clients)
- Contains: alpacaStream.js (Alpaca WebSocket singleton), twelveDataStream.js (helpers)
- Access pattern: Import directly (not via hooks) for singleton, then use via hooks for subscriptions
- Critical: alpacaStream must remain singleton — no concurrent connects allowed

**src/hooks/:**
- Purpose: Custom React hooks for data fetching, streaming, persistence
- Contains: useAlpacaStream (subscribe to alpacaStream), useSubscription, usePaperTrading, useWatchlistSync
- Pattern: Fetch from Supabase or /api endpoints, manage local state, return update methods
- Key: useAlpacaStream is the only interface to alpacaStream singleton (no direct imports in components)

**src/lib/:**
- Purpose: Pure utility functions and clients
- Contains: Supabase client, Twelve Data formatters, market hours calculator, billing helpers
- Pattern: No side effects, reusable across components/hooks/API
- Note: supabaseClient.js is the browser client (RLS policies apply); api/lib/supabase.js is the admin client

**api/:**
- Purpose: Vercel serverless functions — all backend logic
- Contains: API routes, cron jobs, webhooks
- Pattern: export default async function handler(req, res) per file
- Auth: JWT from headers, browser context, or CRON_SECRET
- Routes: Mounted at /api/{filename}.js → /api/{filename} endpoint

**api/lib/:**
- Purpose: Shared utilities for serverless functions (not used by frontend)
- Contains: API clients (Alpaca, Twelve Data, Discord), caching (Redis), auth helpers
- Pattern: Stateless functions, no singleton state
- Key: tradingMode.js determines paper vs live trading per request

## Key File Locations

**Entry Points:**
- `index.html`: HTML skeleton, loads `/src/main.jsx`
- `src/main.jsx`: React app initialization, Sentry setup, provider wrapping
- `src/App.jsx`: Router, landing page vs authenticated dashboard routing
- `src/components/dashboard/Dashboard.jsx`: Main dashboard shell and layout

**Configuration:**
- `vite.config.js`: Build config, API proxy, path aliases (components/)
- `vercel.json`: Deployment config, cron job schedule, rewrites
- `tailwind.config.js`: Tailwind CSS customization (dark theme)
- `package.json`: Dependencies, build/dev scripts

**Core Logic:**
- `src/services/alpacaStream.js`: Alpaca WebSocket singleton (stock + crypto)
- `src/store/StratifyProvider.jsx`: Global state tree
- `src/context/AuthContext.jsx`: Authentication state
- `api/lib/tradingMode.js`: Paper vs live mode resolution

**Market Data:**
- `src/store/hooks/useMarketData.js`: Market price streams
- `src/store/hooks/usePortfolio.js`: Portfolio + P&L computation
- `src/lib/marketHours.js`: US market hours utility

**Sophia AI:**
- `api/sophia-chat.js`: Sophia AI chat endpoint with prompt caching
- `api/lib/pro-plus.js`: Usage tracking and billing helpers

**Testing:**
- `src/data/stockDatabase.js`: Static stock symbol database (not test fixtures)

## Naming Conventions

**Files:**
- Components: PascalCase.jsx (e.g., Dashboard.jsx, TraderPage.jsx)
- Hooks: camelCase with 'use' prefix (e.g., useAlpacaStream.js, usePortfolio.js)
- Utilities: camelCase (e.g., marketHours.js, supabaseClient.js)
- API routes: kebab-case.js (e.g., sophia-chat.js, broker-connect.js)
- Context files: PascalCase (e.g., AuthContext.jsx)

**Directories:**
- Feature folders: lowercase (e.g., dashboard/, xray/, crypto/)
- Utility folders: lowercase (e.g., hooks/, services/, lib/, utils/)
- Grouped by feature/domain, not layer

**Variables & Functions:**
- Functions: camelCase (createOrder, fetchAccountData)
- Constants: UPPER_SNAKE_CASE (ALPACA_API_URL, RECONNECT_MAX_DELAY)
- React component props: camelCase (onOrderSubmit, totalGainLoss)
- Booleans: is/has prefix (isLoading, hasError, isMarketOpen)

**CSS Classes:**
- Tailwind utility classes only — no custom CSS classes
- Exception: `.css` files for complex styles (AnalyticsWatchlistGrid.css)

## Where to Add New Code

**New Trading Feature:**
- UI component: `src/components/dashboard/{FeatureName}.jsx`
- Hook for state: `src/store/hooks/use{Feature}.js` if global, or `src/hooks/use{Feature}.js` if local
- API endpoint: `api/{feature}.js` or `api/{feature}/handler.js` if multiple related endpoints
- Tests: None currently (add test files next to components if testing system is introduced)

**New Dashboard Panel:**
- Component: `src/components/dashboard/{PanelName}.jsx`
- Must wrap in ErrorBoundary if it's a top-level page
- Add to Dashboard.jsx state + layout
- If it needs caching: use useDashboardStateSync hook pattern

**New Sophia AI Feature:**
- Endpoint: `api/sophia-{feature}.js` with same prompt caching pattern as sophia-chat.js
- Cost tracking: Use pro-plus.js helpers (estimateSophiaCostUsd, incrementSophiaUsageUsd)
- Frontend: Hook in SophiaPanel.jsx or create new panel

**New Market Data Stream:**
- If Alpaca: Subscribe via alpacaStream singleton using useAlpacaStream hook
- If Twelve Data: Use useTwelveDataWS hook in xray/ components
- If new third-party: Create new service file in src/services/ following alpacaStream pattern

**New Utility Function:**
- Shared across components: `src/lib/{utilityName}.js`
- Specific to serverless: `api/lib/{utilityName}.js`
- Specific to one hook: Keep inline in hook file
- No cross-layer imports (frontend lib → api lib forbidden)

**New Cron Job:**
- File: `api/cron/{jobName}.js`
- Register: Add entry to `vercel.json` crons array with schedule
- Auth: Check CRON_SECRET in handler
- Alerting: Post to Discord or Twitter via discord-post.js / x-bot-v2.js

**New Page (Outside Dashboard):**
- Location: `src/pages/{PageName}.jsx` (if standalone) or `src/components/dashboard/{PageName}.jsx` (if inside dashboard)
- Routing: Add route in src/App.jsx
- Error handling: Wrap in ErrorBoundary
- Example: ResetPasswordPage.jsx, SportsOddsPage.jsx

## Special Directories

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (from package-lock.json)
- Committed: No (in .gitignore)

**dist/:**
- Purpose: Built frontend artifacts (Vite output)
- Generated: Yes (npm run build)
- Committed: No (in .gitignore)

**.planning/codebase/:**
- Purpose: GSD documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: No (written manually by Claude)
- Committed: Yes

**backend/ and server/:**
- Purpose: Legacy Node.js/Python backends
- Status: Deprecated — not deployed in production
- Note: All API routes are in api/ (Vercel serverless only)

**docs/:**
- Purpose: Project documentation
- Contains: Design docs, runbooks (e.g., BUGS-RESOLVED.md)

---

*Structure analysis: 2026-03-10*
