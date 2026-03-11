# Codebase Structure

**Analysis Date:** 2026-03-10

## Directory Layout

```
stratify/
├── src/                          # React frontend (Vite)
│   ├── main.jsx                  # Entry point (creates React root, Sentry init, error handling)
│   ├── App.jsx                   # Router and auth wrapper
│   ├── index.css                 # Global styles
│   ├── components/
│   │   ├── dashboard/            # Dashboard page components (124 files)
│   │   │   ├── Dashboard.jsx     # Main layout, state sync, panel management
│   │   │   ├── TradePage.jsx     # Live chart + order entry for stocks
│   │   │   ├── CryptoPage.jsx    # Live chart + order entry for crypto
│   │   │   ├── Watchlist.jsx     # Tracked symbols with live quotes
│   │   │   ├── DataTable.jsx     # Positions, orders, trades, balances
│   │   │   ├── LiveChart.jsx     # TradingView Lightweight Charts + Twelve Data
│   │   │   ├── TopMetricsBar.jsx # World clocks, P&L, search bar
│   │   │   ├── Sidebar.jsx       # VS Code-style navigation
│   │   │   ├── StatusBar.jsx     # Connection status indicator
│   │   │   ├── AdvancedChartsPage.jsx
│   │   │   ├── AnalyticsPage.jsx
│   │   │   ├── CommunityPage.jsx
│   │   │   ├── GlobalMarketsPage.jsx
│   │   │   └── [many more dashboard components]
│   │   ├── xray/                 # Fundamentals feature (company analysis)
│   │   │   ├── XRayPage.jsx      # Main page
│   │   │   ├── charts/           # Recharts-based fundamentals charts
│   │   │   │   ├── IncomeChart.jsx
│   │   │   │   ├── BalanceChart.jsx
│   │   │   │   └── CashFlowChart.jsx
│   │   │   └── hooks/            # X-Ray specific hooks
│   │   │       ├── useTwelveData.js
│   │   │       └── useTwelveDataWS.js   # X-Ray WebSocket
│   │   ├── auth/                 # Authentication pages
│   │   │   ├── SignUpPage.jsx
│   │   │   ├── SignInPage.jsx
│   │   │   └── ResetPasswordPage.jsx
│   │   ├── landing/              # Public landing pages
│   │   │   ├── LandingPage.jsx
│   │   │   └── [hero, features, etc.]
│   │   ├── shared/               # Reusable UI components
│   │   │   ├── AppErrorBoundary.jsx
│   │   │   ├── TickerHoverCard.jsx
│   │   │   ├── LiveScoresPill.jsx
│   │   │   ├── KalshiPill.jsx
│   │   │   ├── MiniGamePill.jsx
│   │   │   └── [input fields, buttons, modals]
│   │   └── [other feature dirs: strategies, premium-examples, legal, etc.]
│   ├── context/
│   │   └── AuthContext.jsx       # Supabase auth context
│   ├── store/
│   │   ├── StratifyProvider.jsx  # Root state provider (composes hooks)
│   │   └── hooks/                # State hooks for StratifyProvider
│   │       ├── useMarketData.js
│   │       ├── usePortfolio.js
│   │       ├── useWatchlist.js
│   │       ├── useTradeHistory.js
│   │       ├── useLeaderboard.js
│   │       └── useStrategies.js
│   ├── hooks/                    # Custom hooks (business logic)
│   │   ├── useAlpacaStream.js    # Subscribe to Alpaca live prices
│   │   ├── useAlpacaData.js      # Historical data from Alpaca
│   │   ├── useTwelveData.js      # Twelve Data REST calls
│   │   ├── usePaperTrading.js    # Paper account position/trade logic
│   │   ├── usePortfolio.js       # Portfolio calculations
│   │   ├── useSophiaChat.js      # Sophia AI chat state
│   │   ├── useIndicators.js      # Technical indicators
│   │   ├── useFeed.js            # Market news/feeds
│   │   ├── useTradingMode.js     # Paper vs. live mode
│   │   ├── useSubscription.js    # Subscription status
│   │   └── [more hooks]
│   ├── services/                 # Singleton connection managers
│   │   ├── alpacaStream.js       # Alpaca WebSocket (ONE persistent socket)
│   │   ├── alpacaService.js      # Alpaca REST API (auth, orders)
│   │   ├── twelveDataStream.js   # Twelve Data stream helpers
│   │   ├── twelveDataWebSocket.js
│   │   └── marketData.js
│   ├── lib/                      # Utilities and helpers
│   │   ├── supabaseClient.js     # Supabase browser client
│   │   ├── twelvedata.js         # Twelve Data formatting helpers
│   │   ├── billing.js            # Stripe pricing, subscription logic
│   │   ├── marketHours.js        # Market open/close times
│   │   ├── warRoomIntel.js       # War room data queries
│   │   ├── withTimeout.js        # Timeout wrapper for async calls
│   │   ├── tickerStyling.js      # Ticker display formatting
│   │   ├── initNewUser.js        # New user profile setup
│   │   ├── checkoutSession.js    # Stripe checkout state
│   │   ├── kalshi.js             # Prediction market integration
│   │   └── [more utilities]
│   ├── data/                     # Static data
│   │   ├── stockDatabase.js      # S&P 500 symbols (breaks circular imports)
│   │   ├── cryptoTop20.js        # Top crypto assets
│   │   └── newsletters.json      # Newsletter data
│   ├── styles/                   # CSS/Tailwind
│   └── assets/                   # Images, icons, SVGs
├── api/                          # Vercel serverless functions (Node.js)
│   ├── sophia-chat.js            # Sophia AI chat endpoint
│   ├── sophia-copilot.js         # Sophia copilot mode
│   ├── sophia-insight.js         # Sophia market insights
│   ├── quote.js                  # Get latest quote from Alpaca
│   ├── latest-quote.js           # Quote wrapper
│   ├── orders.js                 # Fetch Alpaca orders
│   ├── positions.js              # Fetch Alpaca positions
│   ├── paper-trade.js            # Place paper trade
│   ├── paper-portfolio.js        # Get paper portfolio
│   ├── paper-history.js          # Paper trade history
│   ├── xray/                     # Company fundamentals endpoints
│   │   ├── profile.js            # Company profile
│   │   ├── quote.js              # Quote data
│   │   ├── statistics.js         # Key statistics
│   │   ├── income-statement.js
│   │   ├── balance-sheet.js
│   │   └── cash-flow.js
│   ├── crypto/                   # Crypto endpoints
│   │   ├── quote.js
│   │   └── [more crypto endpoints]
│   ├── lse/                      # London Stock Exchange endpoints
│   │   └── [LSE-specific endpoints]
│   ├── watchlist/                # Watchlist quote endpoints
│   │   └── quote.js
│   ├── indicators/               # Technical indicators
│   │   ├── rsi.js
│   │   ├── macd.js
│   │   └── [more indicators]
│   ├── cron/                     # Scheduled jobs
│   │   ├── market-summary.js     # Premarket/close summaries
│   │   ├── community-bot.js      # Community engagement
│   │   ├── warm-warroom.js       # Cache warming
│   │   └── [more cron jobs]
│   ├── community/                # Community features
│   │   ├── [community endpoints]
│   ├── discord/                  # Discord webhooks
│   │   ├── [discord integrations]
│   ├── lib/                      # Shared serverless utilities
│   │   ├── twelvedata.js         # Twelve Data API wrapper (server)
│   │   ├── indicators.js         # Technical indicators library
│   │   ├── pro-plus.js           # Pro/Plus subscription logic
│   │   ├── discord.js            # Discord integration
│   │   ├── discord-alerts.js     # Discord alert formatting
│   │   ├── stocks-cache.js       # Stocks cache (Redis/Supabase)
│   │   ├── supabase.js           # Supabase admin client
│   │   ├── alpaca.js             # Alpaca API credentials
│   │   └── [more utilities]
│   ├── create-checkout-session.js
│   ├── stripe-webhook.js
│   ├── contact.js
│   ├── chat.js
│   └── [many more API endpoints]
├── vercel.json                   # Vercel deployment config (rewrites, cron jobs)
├── vite.config.js                # Vite build config
├── tailwind.config.js            # Tailwind CSS config
├── eslint.config.js              # ESLint config
├── package.json                  # Frontend dependencies
├── index.html                    # HTML entry point (#root div)
├── CLAUDE.md                     # Project context and constraints
└── [legacy dirs: server/, backend/ - NOT deployed]
```

## Directory Purposes

**src/components/dashboard/:**
- Purpose: Dashboard UI components (trading interface, charts, data tables)
- Contains: Page-level components (TradePage, CryptoPage, Dashboard), child components (LiveChart, Watchlist, DataTable, TopMetricsBar, StatusBar)
- Key files: `Dashboard.jsx` (main layout), `TradePage.jsx`, `CryptoPage.jsx`, `LiveChart.jsx`

**src/components/xray/:**
- Purpose: Company fundamentals analysis (income statements, balance sheets, cash flow)
- Contains: XRayPage.jsx, chart components, hooks for Twelve Data WebSocket
- Key files: `XRayPage.jsx`, `charts/IncomeChart.jsx`, `hooks/useTwelveData.js`

**src/components/shared/:**
- Purpose: Reusable UI components used across pages
- Contains: Error boundaries, hover cards, pills, buttons, modals
- Key files: `AppErrorBoundary.jsx` (REQUIRED for all new pages)

**src/context/:**
- Purpose: Global context providers
- Contains: AuthContext (Supabase JWT, session)
- Key files: `AuthContext.jsx`

**src/store/:**
- Purpose: Root state management
- Contains: StratifyProvider (composes all state hooks), specialized state hooks
- Key files: `StratifyProvider.jsx`

**src/hooks/:**
- Purpose: Custom React hooks with business logic
- Contains: Data fetching (useAlpacaData, useTwelveData), stream subscriptions (useAlpacaStream), trading (usePaperTrading), UI state (useTradingMode)
- Key files: `useAlpacaStream.js` (critical singleton interface), `usePaperTrading.js`, `useSophiaChat.js`

**src/services/:**
- Purpose: Singleton connection managers (WebSockets, long-lived resources)
- Contains: AlpacaStreamManager class, Twelve Data stream helpers
- Key files: `alpacaStream.js` (DO NOT open direct WebSocket in components — use this instead), `twelveDataStream.js`

**src/lib/:**
- Purpose: Utility functions and helpers
- Contains: API clients (Supabase), formatters, market hours, billing logic
- Key files: `supabaseClient.js`, `twelvedata.js` (format helpers, NOT API calls), `billing.js`, `marketHours.js`

**src/data/:**
- Purpose: Static data (stock lists, crypto assets)
- Contains: stockDatabase.js (extracted to prevent circular imports), cryptoTop20.js, newsletters.json
- Key files: `stockDatabase.js` (S&P 500 symbols)

**api/:**
- Purpose: Vercel serverless function endpoints
- Contains: Market data endpoints (xray/*, quote.js), AI endpoints (sophia-*.js), trading endpoints (paper-trade.js, orders.js), cron jobs, webhooks
- Key files: `sophia-chat.js` (Sophia AI), `xray/profile.js` (fundamentals), `cron/market-summary.js` (premarket/close summaries)

**api/lib/:**
- Purpose: Shared serverless utilities
- Contains: Twelve Data API wrapper, Redis client, Supabase admin, Discord integration, subscription logic
- Key files: `twelvedata.js` (server-side API wrapper), `pro-plus.js` (subscription checks), `discord-alerts.js` (formatting)

**api/cron/:**
- Purpose: Scheduled jobs triggered by Vercel cron
- Contains: Market summaries, cache warming, community bot actions
- Key files: `market-summary.js` (premarket/close), `warm-warroom.js` (Redis cache)

## Key File Locations

**Entry Points:**
- `src/main.jsx`: React app initialization (creates root, Sentry, error handlers)
- `src/App.jsx`: Router and auth wrapper
- `index.html`: HTML root document

**Configuration:**
- `vercel.json`: Deployment config, cron schedules, rewrites
- `vite.config.js`: Build config (HMR, plugins)
- `tailwind.config.js`: Design tokens (colors, spacing)
- `package.json`: Dependencies, scripts (npm run build, npm run dev)

**Core Logic:**
- `src/services/alpacaStream.js`: Alpaca WebSocket singleton (CRITICAL — do not bypass)
- `src/hooks/usePaperTrading.js`: Paper trading state and position calculations
- `src/store/StratifyProvider.jsx`: Root state composition
- `api/sophia-chat.js`: Sophia AI chat with prompt caching

**Testing:**
- Not applicable — no test files found in codebase

## Naming Conventions

**Files:**
- Components: PascalCase with .jsx extension (e.g., `Dashboard.jsx`, `TradePage.jsx`)
- Hooks: camelCase starting with "use" (e.g., `useAlpacaStream.js`, `usePaperTrading.js`)
- Utilities: camelCase with .js extension (e.g., `supabaseClient.js`, `twelvedata.js`)
- API endpoints: kebab-case or camelCase (e.g., `paper-trade.js`, `sophia-chat.js`)
- Directories: kebab-case (e.g., `xray/`, `api/lib/`, `store/hooks/`)

**Functions:**
- React components: PascalCase (e.g., `export default function Dashboard() {}`)
- Hooks: camelCase starting with "use" (e.g., `export function useAlpacaStream() {}`)
- Utilities: camelCase (e.g., `export const normalizeStockSymbol = (symbol) => {}`)
- Classes: PascalCase (e.g., `class AlpacaStreamManager {}`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `STOCK_WS_URL`, `RECONNECT_BASE_DELAY`)
- State variables: camelCase (e.g., `symbol`, `positions`, `isLoading`)
- Maps/Sets: camelCase with descriptive suffix (e.g., `stockQuotes`, `cryptoListeners`)

**Types:**
- React components: PascalCase (e.g., `Dashboard`, `TradePage`, `LiveChart`)
- Context: suffix with "Context" (e.g., `AuthContext`, `StratifyContext`)
- Props: camelCase or object literal notation

## Where to Add New Code

**New Feature (e.g., stock screener, AI analysis):**
- Primary code: Create feature folder in `src/components/` (e.g., `src/components/screener/`)
  - Main component: `src/components/screener/ScreenerPage.jsx`
  - Sub-components: `src/components/screener/ScreenerTable.jsx`, `src/components/screener/FilterPanel.jsx`
  - Hook: `src/hooks/useScreener.js` (if complex state)
  - Library: `src/lib/screenerUtils.js` (if utilities needed)
- API endpoints: `api/screener/*.js` (if backend needed)
- Route: Add to `src/App.jsx` router

**New Component (reusable, shared across pages):**
- Implementation: `src/components/shared/NewComponent.jsx`
- Example: `src/components/shared/AppErrorBoundary.jsx`, `src/components/shared/TickerHoverCard.jsx`
- If complex: add hook in `src/hooks/` for state logic

**Utilities:**
- Shared helpers: `src/lib/newUtility.js`
- Market-specific: `src/lib/marketHours.js`, `src/lib/tickerStyling.js`
- Data/static: `src/data/newData.js`

**API Endpoints:**
- Market data: `api/xray/` (fundamentals), `api/crypto/`, `api/stocks/`
- Trading: `api/orders.js`, `api/paper-trade.js`
- AI: `api/sophia-*.js`
- Webhooks: `api/stripe-webhook.js`, `api/discord-post.js`
- Cron: `api/cron/new-job.js`
- Utilities: `api/lib/newUtility.js`

**Hooks (state/data fetching):**
- New hook: `src/hooks/useNewFeature.js`
- Pattern: Export a function that returns an object with state + methods
- Example: `export function usePaperTrading() { return { positions, totalValue, applyTrade } }`
- Provider hooks (for StratifyProvider): `src/store/hooks/useNewSlice.js`

## Special Directories

**src/assets/:**
- Purpose: Static assets (images, icons, SVGs)
- Generated: No
- Committed: Yes

**dist/:**
- Purpose: Build output (Vite)
- Generated: Yes (from `npm run build`)
- Committed: No (in .gitignore)

**.planning/codebase/:**
- Purpose: Generated codebase documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD agents)
- Committed: Yes

**.vercel/:**
- Purpose: Vercel build cache and metadata
- Generated: Yes (by Vercel during deploy)
- Committed: No

**server/ and backend/:**
- Purpose: Legacy Node.js/Express and Python/FastAPI backends (NOT deployed)
- Status: Not used in production (Vercel serverless is primary)
- Maintenance: Deprecated

## How to Avoid Circular Imports

**Problem:** Circular imports cause gray screen crashes in production.

**Solution:** Extract shared data to neutral location.

**Example:** `src/data/stockDatabase.js` contains S&P 500 symbols. It is imported by:
- `src/components/dashboard/Dashboard.jsx`
- `src/hooks/useWatchlist.js`
- `src/services/alpacaStream.js`

Without extraction, these would create circular dependency: Dashboard → useWatchlist → alpacaStream → Dashboard.

**Rule:** If multiple layers (components, hooks, services) need the same data, extract to `src/data/` or `src/lib/`.

## Error Boundary Requirement

**MANDATORY:** Every new top-level page component must be wrapped in `<ErrorBoundary>`.

**Location:** `src/components/shared/AppErrorBoundary.jsx`

**Usage:**
```jsx
import AppErrorBoundary from '../shared/AppErrorBoundary';

export default function NewPage() {
  return (
    <AppErrorBoundary>
      <div className="page-content">
        {/* page content */}
      </div>
    </AppErrorBoundary>
  );
}
```

**Why:** Catches import errors and component crashes before they gray out the entire app.

---

*Structure analysis: 2026-03-10*
