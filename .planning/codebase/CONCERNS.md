# Codebase Concerns

**Analysis Date:** 2026-03-10

## Tech Debt

**Legacy backend directories still present:**
- Issue: `/backend/` (Python/FastAPI, 328K) and `/server/` (Node.js/Express, 3.7M) remain in repo but are not deployed. They consume disk space and create confusion about production code location.
- Files: `/backend/`, `/server/` (entire directories)
- Impact: Increases repo clutter, unclear which backend is "real," stale dependencies in these directories may introduce supply chain risks if accidentally referenced
- Fix approach: Confirm these are not needed, then delete both directories entirely or move to separate archive. Production is Vercel + `/api/` only per CLAUDE.md.

**API Key resolution is fragile across multiple env vars:**
- Issue: Twelve Data API key lookup chain in `api/lib/twelvedata.js` (lines 95-102) checks 4 different variable names: `TWELVEDATA_API_KEY`, `TWELVE_DATA_API_KEY`, `VITE_TWELVE_DATA_API_KEY`, `VITE_TWELVEDATA_API_KEY`. Similar pattern in frontend `src/components/dashboard/LiveChart.jsx` resolveApiKey(). If env var is set in wrong place, requests silently fail.
- Files: `api/lib/twelvedata.js` (line 95), `src/components/dashboard/LiveChart.jsx`, `api/lib/indicators.js`
- Impact: Hard to debug why Twelve Data calls fail. On boarding new developers or CI/CD changes causes silent failures.
- Fix approach: Standardize on exactly ONE env var name per environment (serverless: `TWELVE_DATA_API_KEY`, browser: `VITE_TWELVE_DATA_API_KEY`). Add startup validation to confirm correct vars are set before any requests.

**Sophia prompt caching not actively used:**
- Issue: CLAUDE.md (line 228-234) states that Sophia uses Anthropic prompt caching with `cache_control: { type: 'ephemeral' }` as "CRITICAL for cost control." However, `api/sophia-chat.js` (line 496-509) makes Claude API call without cache_control block attached to system prompt. No `cache_read_input_tokens` verification mentioned.
- Files: `api/sophia-chat.js` (line 503-509)
- Impact: Sophia requests not benefiting from prompt cache, ~3-5x higher Claude API costs per request. CLAUDE.md explicitly marks this as non-negotiable but it is not implemented.
- Fix approach: Add `cache_control: { type: 'ephemeral' }` to system prompt block in request body. Verify in response that `usage.cache_read_input_tokens > 0` on consecutive requests. Add monitoring alert if cache hits drop.

**TraderPage component exceeds safe complexity:**
- Issue: `src/components/dashboard/TraderPage.jsx` is 5,592 lines — largest single file in codebase by far. Contains chart rendering, WebSocket subscriptions, drawing tools, order entry UI, news fetching, and sentiment analysis all in one component. Makes it difficult to isolate bugs, test individual features, or reason about state flow.
- Files: `src/components/dashboard/TraderPage.jsx`
- Impact: Hard to debug, high regression risk on any change, blocks parallel development, bundle size inflated
- Fix approach: Break into smaller, focused components: `TradeChartContainer`, `DrawingToolbar`, `OrderEntryPanel`, `NewsSection`, `SentimentPanel`. Use React.memo and lazy loading for non-critical features.

**No comprehensive error recovery in auth gate:**
- Issue: BUGS-RESOLVED.md (line 18-23) documents a past bug where users got stuck on "Checking your session..." screen forever. The fix added a 5s timeout + fallback. However, only the initial auth gate has this timeout. Supabase operations throughout the app (fetch profiles, update preferences, load watchlists) have no consistent timeout/retry logic.
- Files: `src/App.jsx`, `src/hooks/useSubscription.js`, and all component hooks calling Supabase
- Impact: Users can get stuck on any page if a Supabase call stalls. Bad network or auth edge cases cascade into broken UI.
- Fix approach: Create a shared `withTimeout` utility. Apply to all critical Supabase calls (profile lookup, subscription check, position fetch). Log timeouts for monitoring.

## Known Bugs

**Alpaca WebSocket connection limit error handling already resolved but fragile:**
- Symptoms: Markets page shows "connection limit exceeded" banner, stock/crypto prices stop updating
- Files: `src/services/alpacaStream.js` (line 6, line 58-60, line 454-461, line 607-614)
- Trigger: Rapid page navigation or multiple browser tabs all calling `connectStockWs()` / `connectCryptoWs()` in parallel
- Workaround: Current implementation (line 93-94, 531, 378-380) uses `stockConnectPromise` and `cryptoConnectPromise` locks to serialize connects. Commit `e36240e` fixed this. **Ensure no new direct WebSocket calls are added outside the singleton**.

**Paper trading total gain/loss computation may diverge:**
- Symptoms: Order entry panel shows different P&L than dashboard top bar
- Files: `src/components/dashboard/TraderPage.jsx`, `src/components/dashboard/CryptoPage.jsx`, `src/components/dashboard/Dashboard.jsx`
- Trigger: Dashboard updates paper portfolio but doesn't propagate `paperTotalGainLoss` prop to TraderPage/CryptoPage on every update
- Workaround: CLAUDE.md (line 100-109) specifies Dashboard computes once and passes `paperTotalGainLoss={{ dollar, percent }}` to both pages. Ensure TradePage always forwards to TraderPage. Current: must be passed explicitly, not computed locally.

**Chart rendering stalls on heavy volume of WebSocket updates:**
- Symptoms: Chart becomes unresponsive, UI lags after several minutes of trading
- Files: `src/components/dashboard/TraderPage.jsx` (line ~1800+, chart update logic), `src/services/twelveDataStream.js`
- Trigger: Multiple symbols subscribed, all receiving quotes simultaneously, each triggering chart redraw
- Workaround: No explicit batching of WebSocket messages before chart update. Lightweight Charts handles this but React reconciliation can still bottleneck.

## Security Considerations

**Alpaca API keys exposed in WebSocket URL:**
- Risk: `api/lib/twelvedata.js` line 229 embeds API key in WebSocket URL string and returns it to client. If browser DevTools are open or URL is logged, key is visible.
- Files: `api/lib/twelvedata.js` (line 227-230), frontend consuming this in `src/components/dashboard/LiveChart.jsx`
- Current mitigation: Keys are marked as read-only on Twelve Data side, but exposure is still not ideal
- Recommendations: Verify Twelve Data keys have minimal necessary scopes. Consider proxying WebSocket through backend to avoid exposing keys to browser.

**CLAUDE_SECRET and CRON_SECRET not validated in all cron jobs:**
- Risk: Vercel cron jobs defined in `vercel.json` (line 11-115) invoke endpoints like `/api/cron/market-summary`, `/api/warm-cache`, `/api/cron/community-bot`. If auth middleware is missing or bypassed, external callers could trigger expensive operations.
- Files: `api/cron/market-summary.js`, `api/warm-cache.js`, `api/cron/community-bot.js`, `vercel.json`
- Current mitigation: Endpoints should check `req.headers['authorization']` === `CRON_SECRET`, but not all may do this consistently
- Recommendations: Create middleware to enforce CRON_SECRET on all `*/cron/*` endpoints. Fail hard (403) if missing.

**Environment variables with secrets in .env files still in repo:**
- Risk: `.env`, `.env.local`, `.env.development`, `.env.production.local` exist in root (visible in `git status`). If accidentally committed, secrets leak into git history.
- Files: `.env`, `.env.local`, `.env.development`, `.env.production.local`, `/backend/.env`, `/server/.env`
- Current mitigation: `.gitignore` should exclude these, but legacy dirs still have `.env` files
- Recommendations: Verify `.gitignore` covers all `.env*` files. Use Vercel dashboard or secure vault for production secrets only. Never commit `.env*`.

**Private key file in backend directory:**
- Risk: `/backend/kalshi_private_key.pem` and `/server/kalshi_private_key.pem` exist. If these are real private keys, they should never be in version control.
- Files: `/backend/kalshi_private_key.pem`, `/server/kalshi_private_key.pem`
- Current mitigation: Likely placeholder files given backend is not deployed
- Recommendations: Delete both immediately. Use secret manager (Vercel dashboard, AWS Secrets Manager, etc.) for real keys.

## Performance Bottlenecks

**Twelve Data API rate limits not actively managed:**
- Problem: Multiple concurrent requests to Twelve Data from different endpoints. No deduplication or caching layer for identical requests within same second.
- Files: `api/lib/twelvedata.js` (line 192-214), all endpoints using `fetchTwelveData()`
- Cause: Each component/request independently calls Twelve Data. No shared cache between user sessions or across requests.
- Improvement path: Implement Redis-backed request cache (ttl: 1-5s for quotes, 1min for fundamentals). Deduplicate in-flight requests. Monitor rate limit headers and throttle on 429.

**Dashboard WebSocket subscriptions bloom without cleanup:**
- Problem: Opening Markets page, switching to Trade page, back to Markets creates duplicate subscriptions that are never unsubscribed.
- Files: `src/services/alpacaStream.js` (line 174-195, line 198-219), component hooks that call `subscribeStocks()` / `subscribeCrypto()`
- Cause: useEffect cleanup functions must call returned unsubscribe function. If hook is re-run without cleanup, subscriptions accumulate.
- Improvement path: Add debug logging to subscription counts. Audit all `useAlpacaStream` usage for missing cleanup. Consider using a WeakMap to auto-cleanup when components unmount.

**Chart rendering with 5000 candles causes initial lag:**
- Problem: TraderPage requests up to 5000 candles (line 74: `MAX_CHART_OUTPUTSIZE = '5000'`) and renders all at once on first load.
- Files: `src/components/dashboard/TraderPage.jsx` (line 74), chart initialization logic
- Cause: Lightweight Charts renders full dataset before viewport is visible. Large datasets trigger recalculation.
- Improvement path: Load candles in 500-bar chunks. Show first 200 immediately, then lazy-load rest. Use Lightweight Charts `setVisibleRange()` to focus initial viewport on recent bars.

## Fragile Areas

**Symbol normalization across three different systems:**
- Files: `src/services/alpacaStream.js` (line 8-50), `api/lib/twelvedata.js` (line 87-181), `src/components/dashboard/TraderPage.jsx` (line 84-170)
- Why fragile: Three independent symbol normalizers with slightly different logic. Alpaca uses `$` prefix stripping and uppercase. Twelve Data uses colon/dot notation (`:LSE`, `.LON`). TraderPage has its own market filter logic. If one normalizer changes, symbols can mismatch between layers.
- Safe modification: Create shared utility in `src/lib/symbolNormalization.js`. Consolidate all three normalizers into single source of truth with clear enum for each market (US_EQUITY, LSE, CRYPTO, etc.). Test against test vectors covering all symbol formats.
- Test coverage: No dedicated tests for symbol normalization. Create `symbolNormalization.test.js` with 50+ test cases.

**Cron job orchestration in vercel.json**
- Files: `vercel.json` (line 11-115)
- Why fragile: 18 cron jobs scheduled with overlapping times (e.g., line 26-27: `/api/cron/warm-warroom` runs hourly 13-21, line 37-38: `/api/trends` runs every 10min 13-21). If one job fails or runs long, it can starve others. No retry logic defined.
- Safe modification: Add observability: log start/end time, error state for each cron. Set up alerts if cron doesn't complete. Stagger schedules to avoid concurrency. Consider adding `max_duration` constraint.
- Test coverage: No CI tests for cron schedules. Add integration test that mocks cron triggers and verifies all endpoints respond in <5s.

**Supabase schema assumptions hardcoded in frontend:**
- Files: `src/hooks/useSubscription.js`, all components reading from `profiles`, `sophia_conversations`, paper trading tables
- Why fragile: If Supabase schema column names change (e.g., `subscription_status` → `plan`), frontend silently gets `undefined` and cascades into broken UI. No type validation on fetch responses.
- Safe modification: Create Supabase types file (Supabase CLI can generate this). Use TypeScript to enforce schema contracts. Add runtime validation with zod/joi on all Supabase responses.
- Test coverage: No schema validation tests.

## Scaling Limits

**Alpaca WebSocket subscription limits:**
- Current capacity: Single stock socket at `/v2/sip` and single crypto socket at `/v1beta3/crypto/us`. Each accepts up to ~500 symbol subscriptions.
- Limit: If user watchlist grows beyond 500 symbols across all pages, Alpaca will reject additional subscribe commands.
- Scaling path: Implement multi-socket strategy with round-robin subscription distribution. Monitor `stockSubscribedSymbols.size` and `cryptoSubscribedSymbols.size` in `alpacaStream.js`. When approaching limit, open second socket.

**Twelve Data API rate limit (900 calls/day on free tier):**
- Current capacity: Unknown actual usage, but requests come from `/api/xray/*`, `/api/chart/candles`, `/api/quote*`, manual search, and cron jobs.
- Limit: If user base grows or cron jobs intensify, will hit rate limit and start getting 429 errors.
- Scaling path: Implement tiered caching (1s for quotes, 1hr for fundamentals). Estimate current usage by logging all Twelve Data calls. Move to paid tier with higher limit or implement request batching.

**Redis connection pool (if used for caching):**
- Current capacity: Unknown — depends on env configuration
- Limit: If all users hit cache simultaneously, connections saturate.
- Scaling path: Monitor Redis connection count. Use connection pooling library (e.g., `redis` npm package with pool settings). Set up Redis Cluster for redundancy.

**Vercel Serverless function concurrency:**
- Current capacity: Default is 1000 concurrent invocations per region
- Limit: If user count spikes or cron jobs overlap, functions may queue or timeout.
- Scaling path: Add monitoring for function execution time. Set up auto-scaling alerts. Use Vercel's concurrency limits config in `vercel.json`.

## Dependencies at Risk

**Anthropic Claude API model pinning:**
- Risk: `api/sophia-chat.js` hardcodes `claude-sonnet-4-20250514` (line 504). If Anthropic deprecates this model, Sophia breaks and requires immediate code change.
- Impact: No Sophia availability until model is updated.
- Migration plan: Move model name to environment variable `ANTHROPIC_MODEL`. Default to `claude-sonnet-4-20250514`. Add fallback model. Monitor Anthropic deprecation notices.

**Lightweight Charts (TradingView charting library):**
- Risk: Major version updates may change API. Plugins (`VolumeProfilePlugin`, `SessionHighlightPlugin`, `PriceAlertsPlugin`) are custom-built and may not be compatible with new versions.
- Impact: Chart rendering breaks, custom drawing tools stop working.
- Migration plan: Vendor lock-in is high. Before upgrading, test all plugins + drawing tools. Consider maintaining a fork if upstream doesn't support needed features.

**Framer Motion for animations:**
- Risk: Low risk — widely used library — but if version pinning is loose, new versions may introduce performance regressions.
- Impact: Page transitions lag or become jittery.
- Migration plan: Use exact version pin (not `^`). Monitor bundle size on updates.

## Missing Critical Features

**No rate limiting on user-facing API endpoints:**
- Problem: Endpoints like `/api/sophia-chat.js`, `/api/quote.js`, `/api/search.js` accept unlimited requests from authenticated users. A single user with a script could exhaust rate limits on downstream APIs (Anthropic, Twelve Data, Alpaca).
- Blocks: Protecting API quotas, preventing abuse, enforcing fair usage
- Fix: Implement per-user rate limiter in Redis. Apply to high-cost endpoints (Sophia calls, backtest requests). Return 429 with retry-after header when limit hit.

**No observability/tracing for cron jobs:**
- Problem: 18 cron jobs run on schedule but have no centralized dashboard showing success/failure rates, execution time, or error logs.
- Blocks: Diagnosing cron failures, understanding bottlenecks, alerting on outages
- Fix: Instrument cron handlers with structured logging (timestamp, duration, status). Send to centralized log sink (e.g., Datadog, Vercel Analytics). Add PagerDuty alerts for failures.

**No feature flag system:**
- Problem: New features require code push and redeploy. No ability to toggle features on/off for A/B testing or gradual rollout.
- Blocks: Safe feature releases, canary deployments, quick rollbacks
- Fix: Use feature flag service (LaunchDarkly, PostHog, or homegrown Redis-backed system). Wrap new features with flag checks.

## Test Coverage Gaps

**WebSocket reconnection logic not tested:**
- What's not tested: `src/services/alpacaStream.js` connection loss + auto-reconnect, exponential backoff, connection limit cooldown
- Files: `src/services/alpacaStream.js` (line 303-325, 530-759)
- Risk: Regressions in reconnect logic could leave users stuck with stale quotes
- Priority: **High** — affects core data flow

**Twelve Data API key fallback chain not tested:**
- What's not tested: API key resolution order. If `TWELVEDATA_API_KEY` is missing but `TWELVE_DATA_API_KEY` is set, does it work?
- Files: `api/lib/twelvedata.js` (line 95-102)
- Risk: Key misconfiguration could silently fail in production
- Priority: **High** — affects all market data

**Symbol normalization not tested across all markets:**
- What's not tested: LSE ticker format (e.g., `BP.L` vs `BP:LSE`), Tokyo tickers (`.T` suffix), crypto pairs (`BTC-USD` vs `BTC/USD`)
- Files: `src/services/alpacaStream.js`, `api/lib/twelvedata.js`, TraderPage
- Risk: Symbol mismatches cause broken quotes, wrong prices displayed
- Priority: **High** — visible user impact

**Paper trading math not verified:**
- What's not tested: P&L calculation (entry price × shares vs exit price × shares). Buying power updates. Position averaging on add-to-position.
- Files: `src/hooks/usePaperTrading.js` (if exists) or wherever paper trades are computed
- Risk: Incorrect balance display, wrong P&L shown, user confusion
- Priority: **Critical** — financial accuracy

**Error boundary coverage incomplete:**
- What's not tested: Ensure all top-level pages have ErrorBoundary. CLAUDE.md (line 85) specifies this is non-negotiable after React #300 incident.
- Files: All page components in `src/components/dashboard/`
- Risk: Import errors cascade into gray screen crashes
- Priority: **Medium** — affects UX but not data

---

*Concerns audit: 2026-03-10*
