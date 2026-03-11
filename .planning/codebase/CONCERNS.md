# Codebase Concerns

**Analysis Date:** 2026-03-10

## Tech Debt

**Large Component Files (5000+ LOC):**
- Files: `src/components/dashboard/TraderPage.jsx` (5592 LOC), `src/components/dashboard/Dashboard.jsx` (3080 LOC)
- Issue: Single components handling multiple concerns (state management, rendering, WebSocket subscriptions). Difficult to test, maintain, and refactor.
- Fix approach: Extract state management to custom hooks, split into smaller components, move business logic to services

**Shared Alpaca Keys Exposure via /api/alpaca-keys.js:**
- File: `api/alpaca-keys.js`
- Issue: Endpoint exposes shared `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` to frontend without authentication check. Comment acknowledges this needs "Rate limiting", "User authentication check", "CORS restrictions" but none are implemented.
- Impact: Shared keys could be extracted and abused if endpoint is discovered. User keys are sent over unencrypted WebSocket subscription setup.
- Fix approach: Add user authentication before returning keys, implement rate limiting, add CORS validation, consider rotating keys frequently

**Polling Intervals in useAlpacaData Hook:**
- File: `src/hooks/useAlpacaData.js`, line 4
- Issue: Uses `setInterval(load, POLL_INTERVAL)` with 30-second refresh rate. No jitter to prevent thundering herd when multiple tabs/users refresh simultaneously.
- Impact: Potential spike in API load at regular intervals if deployed at scale.
- Fix approach: Add exponential backoff with jitter, consider switching to WebSocket or server-sent events for real-time updates

**Legacy Backend References:**
- Files: CLAUDE.md mentions `/server/` (Node.js/Express) and `/backend/` (Python/FastAPI) as "legacy — not deployed"
- Issue: Codebase contains two unused backend directories. No clear migration path documented for their removal.
- Fix approach: Archive legacy backends, document which features they provided, ensure Vercel serverless has all equivalent endpoints

**Twelve Data Migration Incomplete:**
- File: TWELVE-DATA-MIGRATION.md
- Issue: Plan exists to migrate all market data to Twelve Data (shared keys) but options data still requires shared Alpaca keys. Options feature unclear — "Choose one: A) Keep shared Alpaca keys ONLY for options data, B) Disable options feature, C) Find alternative"
- Impact: Split architecture with two data providers increases complexity. Decision unmade on options handling.
- Fix approach: Make decision on options feature, commit to architecture, document in CLAUDE.md

**Cron Jobs Configuration (Vercel):**
- File: `vercel.json` lines 11-116
- Issue: 21 cron jobs scheduled with no error logging or alerting mechanism visible. Failed jobs silently fail. No dashboard to monitor job health.
- Impact: Premarket/close summaries, feed updates, community bot, X tweets could fail without alerting. Users get stale data.
- Fix approach: Add Sentry/error tracking to all cron handlers, implement Slack/Discord webhooks on failure, add job status endpoint for monitoring

**Supabase Realtime Channels Not Always Cleaned Up:**
- Files: `src/hooks/useSubscription.js` (line 175-194), `src/hooks/useTradingMode.js` (line 182-203)
- Issue: Channels subscribed but cleanup depends on component unmount. If component unmounts before subscription completes, memory leak possible. No timeout on subscription setup.
- Fix approach: Add promise-based subscription with timeout, ensure cleanup fires before unsubscribe call completes

---

## Known Bugs

**Auth Gate Session Lock (RESOLVED but risk remains):**
- Issue: Users could get stuck on "Checking your session..." screen indefinitely
- Files: `src/App.jsx`, `src/hooks/useSubscription.js`
- Fix: Added 5s timeout in `useSubscription.js`, auth gate fail-safe in App.jsx
- Remaining risk: If Supabase auth endpoints become slow again (network degradation, suspended tab recovery), timeout still applies but user is redirected to `/auth`. This is correct behavior, but worth monitoring for timeout frequency in Sentry

**Alpaca Connection Limit Exceeded (RESOLVED but edge cases remain):**
- Issue: Race condition allowed overlapping WebSocket connects, hitting "connection limit exceeded"
- Files: `src/services/alpacaStream.js`
- Fix: Added `stockConnectPromise` and `cryptoConnectPromise` locks (lines 93-94)
- Remaining risk: If connection lock is somehow bypassed (e.g., multiple manager instances created), issue returns. Global singleton pattern (`getSingleton()` line 858) relies on `globalThis` — could fail in SSR contexts

---

## Security Considerations

**Shared Broker API Keys Exposed in Frontend:**
- Risk: `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` sent to browser via `/api/alpaca-keys.js`. WebSocket authentication includes these keys in plaintext JSON. If browser is compromised or network is intercepted (MitM), keys leaked.
- Files: `api/alpaca-keys.js`, `src/services/alpacaStream.js` (lines 421-425, 574-578)
- Current mitigation: HTTPS in production, browser same-origin policy
- Recommendations:
  1. Use Alpaca OAuth or rotate keys frequently
  2. Move WebSocket auth to backend proxy instead of exposing keys to frontend
  3. Add Alpaca IP allowlist to restrict which networks can use keys
  4. Monitor Alpaca API logs for unauthorized access patterns

**Environment Variables Not Validated at Startup:**
- Risk: Missing or malformed environment variables cause runtime errors in production
- Files: Multiple API handlers check env vars on each request
- Current mitigation: Environment variables set in Vercel dashboard
- Recommendations: Add startup validation script that runs before deploy, check all required `TWELVE_DATA_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_*`, `STRIPE_*` vars exist and are non-empty

**Creator Override Emails in Frontend Config:**
- Risk: `src/lib/subscriptionAccess.js` reads `VITE_CREATOR_OVERRIDE_EMAILS` and `VITE_CREATOR_OVERRIDE_DOMAINS` from `import.meta.env` — these are exposed to browser
- Files: `src/lib/subscriptionAccess.js` (lines 23-31)
- Impact: Any user can see which emails bypass paywall by reading browser console
- Current mitigation: Only affects display/feature access, not auth
- Recommendations: Remove email list from frontend, check against backend-only allowlist on API calls. Keep current email hardcoded only for display

**localStorage Not Cleared on Logout:**
- Risk: Sensitive data like subscription status, trading mode, cached session stored in localStorage. If device shared, next user can access cache.
- Files: `src/hooks/useSubscription.js` (readCachedSubscriptionStatus), `src/hooks/useTradingMode.js` (readStoredMode)
- Fix approach: On logout event, clear all Stratify-prefixed localStorage keys

**Stripe Webhook Secret in Vercel Dashboard:**
- Risk: If Vercel dashboard is compromised, webhook secret leaked. Attacker can forge payment events.
- Files: `api/stripe-webhook.js` (uses `STRIPE_WEBHOOK_SECRET` env var)
- Current mitigation: Stripe event validation via signature, HTTPS
- Recommendations: Rotate webhook secret quarterly, enable Stripe event signing, log all webhook events to Supabase for audit

---

## Performance Bottlenecks

**30-Second Poll Interval in useAlpacaData:**
- Problem: 30s refresh interval (`src/hooks/useAlpacaData.js` line 4) means positions/account stale for up to 30 seconds. If user executes trade, account data not refreshed until next interval.
- Files: `src/hooks/useAlpacaData.js`
- Cause: Polling instead of WebSocket. Alpaca offers WebSocket for positions but hook doesn't use it.
- Improvement path: Switch to Alpaca WebSocket for account updates, use polling only as fallback

**Multiple Supabase Queries in useSubscription Initialization:**
- Problem: `loadUser()` makes call to `getUser()`, then on error falls back to `getSession()`. Subscription check does separate call. Total 2-3 Supabase round trips on app load.
- Files: `src/hooks/useSubscription.js` (lines 88-122)
- Cause: Chained error handling without batching
- Improvement path: Use single `getSession()` call (already includes user), combine auth and subscription checks if possible

**Eleven Cron Jobs Running Every 5-10 Minutes:**
- Problem: High frequency job churn (warm-cache runs every minute, community-bot every 10 min). If each job makes API calls to Twelve Data / Discord / Supabase, could hit rate limits.
- Files: `vercel.json` (crons), no batching visible
- Cause: No optimization, each job independent
- Improvement path: Batch related jobs (e.g., all market summary crons into one), use Upstash Redis for deduplication

**Large Dashboard Components Render Full State:**
- Problem: Dashboard.jsx (3080 LOC) re-renders entire tree when any state updates. Watchlist, chat, news panels all re-render even if unrelated state changed.
- Files: `src/components/dashboard/Dashboard.jsx`
- Cause: Component uses single state object instead of context/slice
- Improvement path: Split Dashboard into smaller components, use context selectors, add React.memo() to prevent unnecessary renders

---

## Fragile Areas

**Alpaca WebSocket Singleton Architecture:**
- Files: `src/services/alpacaStream.js` (getSingleton pattern, lines 856-870)
- Why fragile: Entire stock/crypto data flow depends on single shared manager instance. If instance is recreated (e.g., SSR context, stale closure), duplicate WebSocket connections possible. Reconnection logic complex with multiple state transitions.
- Safe modification: Never create new AlpacaStreamManager() directly — always use exported functions (subscribeStocks, subscribeCrypto). Add unit tests for all state transitions (connect → auth → subscribe → unsubscribe → reconnect).
- Test coverage: No visible tests for alpacaStream.js. Critical path untested.

**useSubscription Hook Timeout Handling:**
- Files: `src/hooks/useSubscription.js`
- Why fragile: 5-second timeout is hardcoded. If Supabase slow, users bounced to auth. No telemetry to detect if timeouts increasing. Fallback to cached status could be stale.
- Safe modification: Make timeout configurable, add Sentry tracking for timeout events, document fallback behavior to users
- Test coverage: No visible tests for timeout scenarios or cache fallback

**Paper Trading State in Database:**
- Files: `src/hooks/useTradingMode.js` (persists to `profiles.trading_mode` column, lines 265-282)
- Why fragile: If column missing (backwards compatibility check on lines 94-110), fallback assumes paper mode. If fallback logic wrong, users silently switch to paper. Stores entire trading_mode_switches array in user_state JSON (line 254-262) — unbounded growth possible.
- Safe modification: Add migration script to ensure trading_mode column exists, limit trading_mode_switches array to last 200 (already done line 262), add schema validation before save
- Test coverage: No visible tests for schema fallback logic

**Cron Jobs No Error Monitoring:**
- Files: `vercel.json`, `api/cron/*.js`
- Why fragile: 21 jobs run on schedule with no visible error handling. If Twelve Data API down, all data endpoints silently fail. Users see stale content.
- Safe modification: Add try/catch in every cron handler, log errors to Sentry, return 200 OK even on failure so Vercel doesn't retry infinitely
- Test coverage: No visible monitoring or alerting setup

---

## Scaling Limits

**Alpaca $192K Investment Hit Ceiling:**
- Current capacity: 500+ concurrent WebSocket users via Alpaca SIP feed
- Limit: Alpaca Premium SIP plan includes this user count. Adding institutional features (options, derivatives) requires higher tier at $X00K/year
- Scaling path: Benchmark current load, negotiate Alpaca volume discount, or migrate to alternative data provider (Interactive Brokers, IB API, E*Trade)

**Supabase Row-Level Security (RLS) Complexity:**
- Current capacity: RLS policies work fine for single-user queries. Multi-tenant features (public leaderboard, community posts) require complex policy logic.
- Limit: RLS policies don't scale well for complex business logic. SQL becomes unmaintainable at 50+ policies.
- Scaling path: Move sensitive access control to application logic (backend functions), keep RLS for basic user isolation only

**Vercel Serverless Cold Starts:**
- Current capacity: Response times acceptable for < 10 req/s
- Limit: Cold starts (500ms-2s) visible at scale, especially during market open when traffic spikes
- Scaling path: Use Vercel Enterprise with regional deployment, keep functions warm via cron pings, move compute-heavy endpoints to persistent backend (Railway, AWS Lambda)

**Supabase Realtime Connection Limit:**
- Current capacity: Free/Pro tiers limit concurrent connections
- Limit: As trading dashboard scales to 1000+ concurrent users, Realtime channels will hit connection limits
- Scaling path: Batch updates into fewer channels, use polling fallback if Realtime full, migrate to enterprise Supabase

---

## Dependencies at Risk

**Twelve Data Pro Plan ($29/mo):**
- Risk: Plan includes 1,597 API calls/min and 1,500 WebSocket credits. No clear documentation on what happens when limits exceeded — rate limit or auto-escalate?
- Impact: If plan exhausted during market open, market data endpoints fail and users see stale prices
- Migration plan: Monitor usage via Twelve Data dashboard, set up billing alerts, document upgrade path to Enterprise plan

**Anthropic Claude API Pricing (No Invoice):**
- Risk: Sophia uses Claude Sonnet 4 without visible rate limiting or cost monitoring. If strategy builders spam Sophia, bill could spike.
- Impact: Unexpected bill increase, potential service outage if costs spike beyond budget
- Migration plan: Implement token-based rate limiting per user, add Anthropic usage monitoring to Sentry, consider Claude 3.5 Haiku for cheaper fallback

**Stripe Payment Processing:**
- Risk: Webhook handling in `api/stripe-webhook.js` — if endpoint fails silently, subscription status not updated. Users upgrade but system doesn't know.
- Impact: Revenue recognition issues, customer support escalations
- Migration plan: Add Stripe event logging to Supabase, implement webhook retry logic, add dashboard to reconcile Stripe vs. internal subscription state

**Supabase Outage (No Backup):**
- Risk: Single Supabase instance. No backup to alternate provider. If Supabase region down, entire app unavailable.
- Impact: Complete service outage, no auth, no data access
- Migration plan: No realistic alternative without major rewrite. Recommend backup plan: document manual recovery process, set up status page, maintain customer communication templates

---

## Missing Critical Features

**No Alerting System for Cron Job Failures:**
- Problem: Cron jobs fail silently. Premarket summary doesn't send, feeds don't refresh, community bot doesn't run.
- Blocks: Data freshness monitoring, SLA guarantees, customer trust
- Solution: Integrate Sentry + Slack webhooks into every cron handler, add monitoring dashboard

**No Rate Limiting on Public API Endpoints:**
- Problem: `/api/quote`, `/api/latest-quote`, `/api/market-intel` etc. don't check request rate. Attacker could DDOS with burner accounts.
- Blocks: Production hardening, fair use policy enforcement
- Solution: Add IP-based rate limiting via middleware, require auth token for higher tier access, log suspicious patterns to Sentry

**No Backup Strategy for User Data:**
- Problem: User strategies, watchlists, paper trading history stored in Supabase only. No backup documented.
- Blocks: Disaster recovery, compliance (GDPR right to data export)
- Solution: Export user data nightly to Cloud Storage, provide data export endpoint, test restore process quarterly

**No Observability for WebSocket Health:**
- Problem: Alpaca WebSocket state (connected, authenticated, subscribed) not visible in real-time. If connection flaky, hard to diagnose.
- Blocks: Debugging production issues, identifying bottlenecks
- Solution: Add Sentry breadcrumbs for every WebSocket state transition, expose /api/health endpoint with connection status, add dashboard widget to show stream health

---

## Test Coverage Gaps

**WebSocket Manager (alpacaStream.js) Untested:**
- What's not tested: Connection retry logic, authentication flow, symbol subscription/unsubscription, error recovery, connection limit handling
- Files: `src/services/alpacaStream.js` (880 LOC, zero visible tests)
- Risk: Critical data path. If reconnect logic breaks, users see frozen prices. Connection limit error handling complex with cooldown timers.
- Priority: **High** — affects all users immediately

**useSubscription Hook Untested:**
- What's not tested: Timeout behavior, cache fallback, error scenarios, subscription refresh on profile update
- Files: `src/hooks/useSubscription.js` (210 LOC, zero visible tests)
- Risk: Auth gate blocking. If timeout doesn't work, app freezes. Cache logic could return stale status.
- Priority: **High** — affects app startup

**useTradingMode Hook Untested:**
- What's not tested: Trading mode switching, database persistence, profile update sync, error handling on switch failure
- Files: `src/hooks/useTradingMode.js` (346 LOC, zero visible tests)
- Risk: Users could switch to live mode and accidentally trade real money if switch logic broken
- Priority: **Critical** — financial impact

**API Handlers No Integration Tests:**
- What's not tested: End-to-end flows like: user connects broker → places order → portfolio updates → subscription check
- Files: `/api/*` (50+ files, zero visible test directory)
- Risk: Silent failures in production (e.g., broker auth broken, orders fail, portfolio stale)
- Priority: **High** — production reliability

**Supabase RLS Policies No Tests:**
- What's not tested: Row-level security isolation (user A can't read user B's data), multi-tenant scenarios
- Files: Supabase SQL policies (not in repo)
- Risk: Data leakage, privacy violation
- Priority: **Critical** — security/compliance

---

*Concerns audit: 2026-03-10*
