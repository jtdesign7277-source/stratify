# CLAUDE.md - Stratify Project Context

*Last updated: 2026-03-07*

## Project Overview

**Stratify** — AI-powered trading platform that translates natural language into executable trading strategies.

### Core Flow
1. User describes strategy in plain English
2. AI translates input into backtestable strategy logic
3. User reviews backtest results and deploys
4. Bot scans markets for matching setups
5. Bot executes trades automatically

---

## Tech Stack

| Layer | Tech | Location |
|-------|------|----------|
| Frontend | React + Vite + TailwindCSS | `/src/` |
| Serverless API | Vercel Functions (Node.js) | `/api/` ⚠️ **Vercel deploys this** |
| Database / Auth | Supabase | Keys in Vercel dashboard |
| Broker API | Alpaca | WebSocket singleton in `src/services/alpacaStream.js` |
| Market Data | Twelve Data Pro | Charts, fundamentals, WebSocket |
| AI Assistant | Anthropic Claude (Sophia) | `api/sophia-*.js` |
| Payments | Stripe | `api/create-checkout-session.js`, `api/stripe-webhook.js` |
| Email | Resend | `api/contact.js` |
| Hosting | Vercel | Frontend + serverless functions |

> `/server/` (Node.js/Express) and `/backend/` (Python/FastAPI) are **legacy** — not deployed in production.

---

## Key URLs

- **Local dev:** http://localhost:5173
- **Production:** Vercel (auto-deploy from `main` branch)
- **Legacy Railway backend:** https://stratify-backend-production-3ebd.up.railway.app *(not primary)*
- **GitHub:** github.com/jtdesign7277-source/stratify

---

## Project Structure

```
~/Desktop/stratify/
├── src/                          # React frontend
│   ├── components/
│   │   ├── dashboard/            # All dashboard page components
│   │   ├── xray/                 # X-Ray fundamentals feature
│   │   │   ├── XRayPage.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useTwelveData.js      # Fetches via /api/xray/*
│   │   │   │   └── useTwelveDataWS.js    # X-Ray WebSocket (VITE_TWELVE_DATA_WS_KEY)
│   │   │   └── charts/           # Recharts-based fundamentals charts
│   │   ├── auth/                 # Auth pages
│   │   └── shared/               # Shared UI components
│   ├── services/
│   │   ├── alpacaStream.js       # ⚠️ SINGLETON Alpaca WebSocket manager
│   │   └── twelveDataStream.js   # Twelve Data stream helpers
│   ├── lib/
│   │   ├── twelvedata.js         # Shared formatting/utility functions (no API calls)
│   │   └── supabaseClient.js     # Supabase browser client
│   ├── hooks/
│   │   └── useAlpacaStream.js    # Hook into alpacaStream.js singleton
│   └── App.jsx                   # Main router + landing page
├── api/                          # Vercel serverless functions
│   ├── xray/                     # X-Ray fundamentals endpoints
│   │   ├── profile.js
│   │   ├── quote.js
│   │   ├── statistics.js
│   │   ├── income-statement.js
│   │   ├── balance-sheet.js
│   │   └── cash-flow.js
│   ├── lib/
│   │   ├── twelvedata.js         # Shared Twelve Data fetch helper (server-side)
│   │   └── indicators.js         # Technical indicators helper
│   ├── lse/                      # London Stock Exchange endpoints
│   ├── crypto/                   # Crypto price endpoints
│   ├── watchlist/                # Watchlist quote endpoints
│   ├── cron/                     # Vercel cron jobs (premarket + close summaries)
│   ├── sophia-chat.js            # Sophia AI chat
│   ├── sophia-copilot.js         # Sophia copilot
│   ├── sophia-insight.js         # Sophia market insight
│   └── ...                       # Other endpoints
├── vercel.json                   # Vercel config (rewrites + cron schedule)
├── vite.config.js
├── tailwind.config.js
└── CLAUDE.md                     # This file
```

---

## Environment Variables

### Frontend (`VITE_` prefix — exposed to browser via Vite)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_TWELVEDATA_API_KEY` | Twelve Data — frontend charts (LiveChart WebSocket) |
| `VITE_TWELVE_DATA_WS_KEY` | Twelve Data — X-Ray WebSocket (`useTwelveDataWS.js`) |
| `VITE_API_URL` | Legacy Railway backend URL |
| `VITE_STRIPE_PRO_PRICE_ID` | Stripe Pro subscription price ID |
| `VITE_APP_URL` | Public app URL |

### Serverless (set in Vercel dashboard — no `VITE_` prefix)

| Variable | Purpose |
|----------|---------|
| `TWELVE_DATA_API_KEY` | Twelve Data — serverless API calls (primary) |
| `TWELVEDATA_API_KEY` | Twelve Data — alternate name (fallback in `api/lib/twelvedata.js`) |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | Alpaca broker |
| `ANTHROPIC_API_KEY` | Sophia AI (Claude) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin (service role) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payments |
| `FRED_API_KEY` | FRED economic data |
| `XAI_API_KEY` / `GROK_API_KEY` | Grok AI (xAI) |
| `HEYGEN_API_KEY` / `LIVEAVATAR_API_KEY` | HeyGen AI avatar |
| `RESEND_API_KEY` | Transactional email |
| `CRON_SECRET` | Vercel cron job auth header |
| `DISCORD_WEBHOOK_*` | Multiple Discord channel webhooks |

> **Twelve Data key resolution in `api/lib/twelvedata.js` and `api/lib/indicators.js`:**
> Checks `TWELVEDATA_API_KEY` → `TWELVE_DATA_API_KEY` → `VITE_TWELVE_DATA_API_KEY` → `VITE_TWELVEDATA_API_KEY`

> **LiveChart (`src/components/dashboard/LiveChart.jsx`) `resolveApiKey()`:**
> Checks `VITE_TWELVE_DATA_API_KEY` → `VITE_TWELVE_DATA_APIKEY` → `VITE_TWELVEDATA_API_KEY`

---

## Design System

- **Background:** `#060d18` (primary dark)
- **Accent:** `blue-500` / `#3b82f6`
- **Positive / Buy:** `emerald-400` / `#34d399`
- **Negative / Sell:** `red-400` / `#f87171`
- **Borders:** `white/10` or `#1f1f1f`
- **Text muted:** `gray-400` / `text-white/40`
- **Font:** monospace for prices and metrics

All new pages must match the existing dark theme — do not introduce light backgrounds or off-palette colors.

---

## Critical Rules (Non-Negotiable)

### 1. Never Poll for Market Data
- Use WebSocket only — never `setInterval` + fetch for live prices.
- Alpaca prices → `src/services/alpacaStream.js` singleton → `useAlpacaStream` hook.
- Twelve Data prices → `src/services/twelveDataStream.js` or `useTwelveDataWS.js`.

### 2. Always Add Error Boundary to New Pages
- Every new top-level page component must be wrapped in an `<ErrorBoundary>`.
- Gray screen crashes from import errors have occurred before — Error Boundaries prevent them surfacing to users.
- See `85b52d6` for precedent.

### 3. Test Imports Before Pushing
- Circular imports cause immediate gray screen crashes in production.
- Before pushing any new file, confirm its imports resolve without circular dependencies.
- Use `src/data/stockDatabase.js` for shared stock data (extracted in `49afbf8` to break circular import).

### 4. Always Push to `main`
- Vercel auto-deploys from `main`. All work goes to `main` — there are no staging branches.

---

## Sophia AI — Prompt Caching (Cost Critical)

- Sophia uses Anthropic prompt caching on the system prompt.
- System prompt must use `cache_control: { type: 'ephemeral' }` — this is CRITICAL for cost control.
- Verify caching is active: response `usage.cache_read_input_tokens` must be `> 0` on consecutive requests.
- If `cache_read_input_tokens` is `0` on consecutive requests, caching is broken — fix immediately.
- **Never remove or restructure the system prompt block in `api/sophia-*.js` without verifying caching still works.**

---

## Naming Lock (Hard Rule)

- The AI assistant is named `Sophia`.
- `Atlas` naming is **deprecated** — must not appear in new UI, API routes, prompts, or docs.

---

## Dashboard Components

| Component | File | Purpose |
|-----------|------|---------|
| Dashboard | `Dashboard.jsx` | Main layout, state management |
| Sidebar | `Sidebar.jsx` | VS Code-style nav (hover to expand) |
| TradePage | `TradePage.jsx` | Live chart + order ticket |
| LiveChart | `LiveChart.jsx` | TradingView Lightweight Charts + Twelve Data WebSocket |
| TopMetricsBar | `TopMetricsBar.jsx` | P&L stats, search bar, theme toggle |
| DataTable | `DataTable.jsx` | Positions/orders/trades/balances |
| Watchlist | `Watchlist.jsx` | Tracked stocks with live Alpaca quotes |
| SearchBar | `SearchBar.jsx` | Stock search (exact symbol matches first) |
| StatusBar | `StatusBar.jsx` | Connection status |
| XRayPage | `xray/XRayPage.jsx` | Fundamentals — income, balance, cash flow, key stats |

---

## Vercel Cron Jobs

Defined in `vercel.json`:

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/market-summary?period=premarket` | `25 13 * * 1-5` (9:25 AM ET) | Pre-market summary |
| `/api/cron/market-summary?period=close` | `5 20 * * 1-5` (4:05 PM ET) | Market close summary |

Cron requests are authenticated via the `CRON_SECRET` env var.

---

## Critical Incident Runbook: Alpaca `connection limit exceeded`

**Date fixed:** 2026-02-18 | **Commit:** `e36240e`

### Symptoms
- Markets page banner: `connection limit exceeded`
- ETFs/Stocks or Crypto cards stuck at `Connecting...` / `Waiting for stream...`
- Data works on one page but fails on another

### Root Cause
Duplicate Alpaca WebSocket connects during concurrent mount/reconnect calls. Race condition in `src/services/alpacaStream.js` allowed overlapping `connectStockWs()` / `connectCryptoWs()` before socket state settled.

### Permanent Fix
Added connect locks: `stockConnectPromise` and `cryptoConnectPromise` — guarantee one in-flight connect per stream.

### Non-Negotiable Rules
- Use only the shared singleton in `src/services/alpacaStream.js`.
- **Do not** open direct Alpaca `new WebSocket(...)` in UI components.
- Keep at most: 1 stock socket (`/v2/sip`), 1 crypto socket (`/v1beta3/crypto/us`).

### If It Happens Again
1. Confirm no direct `new WebSocket(...)` exists outside `src/services/alpacaStream.js`.
2. Verify connect locks still exist in both `connectStockWs` and `connectCryptoWs`.
3. Confirm all pages subscribe through `useAlpacaStream` / shared manager.
4. Re-test Markets + Trade + Watchlist together.

---

## Preserved design (as-built state)

**Keep this entire website behavior and layout for future work.** The following is the canonical state; do not change unless explicitly requested.

### Dashboard header (one unified area)
- **Single visual band:** Top bar is one continuous area on `bg-linear-canvas` (#111111). No separate “tab” panels — use transparent child backgrounds and only subtle dividers (`border-white/[0.06]`).
- **Top row — World clocks (`TopMetricsBar.jsx`):** One horizontal row, full width (`justify-between`). Each market: **country flag** (emoji) + short code (NY, LON, TYO, SYD, SHA, DXB) + local time + status dot (green/blue) + Open/Closed + countdown (e.g. `1d21h`). 11px text. No per-city boxes or pills; flags and labels in `GLOBAL_MARKET_CLOCKS` (with `short`, `flag`). Tooltip = full city name + hours.
- **Second row:** Daily P&L, Buying Power, Total gain / loss (with %) — same single-row treatment, subtle bottom border only.
- **Third row — Live ticker (`LiveAlertsTicker.jsx`):** Scrolling headlines only. No “LATEST” label, no left badge, no left gradient overlay; content starts at left edge. Right-edge fade only. Same canvas background (transparent).

### Total gain / loss — single source of truth
- **Dashboard** computes paper total gain/loss once: `syncedPaperUnrealizedPnL`, `syncedPaperTotalGainLossPercent` from `paperPortfolioPositions` + `watchlistQuotesBySymbol`.
- **Dashboard** passes `paperTotalGainLoss={{ dollar, percent }}` to **TradePage** and **CryptoPage** when `shouldUsePaperTopBarMetrics`. **TradePage** must forward `paperTotalGainLoss` to **TraderPage** (wrapper does not pass it through by default).
- **Top bar** and **both order entry panels** (Trader + Crypto) display that same value. Order entry components accept optional `totalGainLossDollar` / `totalGainLossPercent`; when provided (from Dashboard), use them instead of local computation so numbers never diverge.

### Order entry parity (Trader + Crypto)
- **Same layout and copy:** Quantity, Order Type, Time in Force, Estimated Cost, Buying Power, Review button, then Available Cash + Holdings block, then **Total gain / loss** (dollar + percent) at bottom. Label: “Total gain / loss” (not “Unrealized P&L”). 13px font for values and labels.
- **Position summary card:** When user has any position, show one card: “Position: {qty} {symbol} · Avg $X” / “Value: $Y” / “P&L: $Z (%).” Use **display position** = selected symbol’s position if it exists, else **first position** so the card is never missing when there are positions. Same card styling both tabs (soft glass, 13px). “Sell All” only when selected symbol has a position and side is Sell.
- **Trader:** `TraderOrderEntry` in `TraderPage.jsx`, receives `paperTotalGainLoss` from Dashboard via TradePage. **Crypto:** `OrderEntry` in `CryptoPage.jsx`, same props and same position-summary + total-gain/loss logic.
- **PAPER ACCOUNT** badge: yellow, `font-medium`, on all order entry surfaces (Trader, Crypto, AdvancedCharts, Watchlist).

### Sidebar, Sophia panel, and soft glass
- **Sidebar:** Matches watchlist panel (same glass, base `#0a0a0a`, gradient, backdrop blur, rounded-r-xl).
- **Sophia panel:** Matches news article drawer (gradient, blur, border, shadow).
- **Order entry panels:** Emerald “Order Entry” label; gradient + blur + shadow; AlpacaOrderTicket root soft glass, inputs inset-style.

### What not to change without explicit request
- Do not reintroduce separate header “tabs” (world clock / metrics / ticker as distinct panels with different backgrounds).
- Do not remove or bypass `paperTotalGainLoss` flow (Dashboard → TradePage → TraderPage; Dashboard → CryptoPage).
- Do not make Trader and Crypto order entry layouts or wording diverge.
- Do not add a “LATEST” label or left-side badge/gradient on the ticker strip.

---

## TODO

- [ ] AI Strategy Builder (core feature)
- [ ] Strategy backtesting engine
- [ ] Strategy deployment / execution
- [ ] Production launch


---

## @stratify_hq Tweet Standard — NON-NEGOTIABLE

Agent_X (`api/x-post.js`) posts to @stratify_hq. The `just-in` type is the most visible post type.

**THE STANDARD:**
- ONLY post REAL, CONFIRMED, CURRENT breaking news that moves markets
- News must be from the LAST 2 HOURS — anything older = silence
- Format: `🚨 BREAKING 🚨` — hard, urgent, impossible to scroll past
- Specific tickers. Specific market impact. Specific reason. Always.
- NO weather. NO lifestyle. NO opinions. NO filler. NO vague vibes. EVER.
- When in doubt → skip. Silence > noise. One elite tweet > ten mediocre ones.
- Zero fabrication. Only confirmed facts.
- Under 280 chars. Every word earns its place.
- A trader must read it and IMMEDIATELY act — or we don't post.

This is the most elite financial breaking news account on Twitter. Every tweet must reflect that.
