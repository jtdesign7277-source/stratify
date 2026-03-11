# Testing Patterns

**Analysis Date:** 2026-03-10

## Test Framework

**Status:** Not detected

**No test runner configured:**
- No `jest.config.js` or `vitest.config.js` found
- No test scripts in `package.json` (only `dev`, `build`, `preview`)
- No test dependencies in `package.json` (no Jest, Vitest, Mocha, Chai, etc.)
- No test files found in `src/` directory (`*.test.js`, `*.spec.js`)

**Implications:**
- All testing is currently manual
- Integration testing relies on local dev server or staging environment
- No automated test coverage tracking or CI gate

---

## Manual Testing Approach

**What is tested:**
- Component rendering in browser via `npm run dev` (Vite dev server)
- API endpoints via curl, Postman, or direct fetch calls
- WebSocket connections via browser DevTools network inspector
- State management via React DevTools

**Test files in repo:**
- `test.html` exists at root but is unused (likely a legacy artifact for manual testing)

---

## Development Validation

**Pre-commit checks:**
- ESLint rules enforced in `eslint.config.js` catch naming/import errors
- React Hooks rules prevent dependency array issues
- Import resolution tested implicitly on build (Vite build will fail on unresolved imports)

**Common patterns for catching bugs before deployment:**
1. **Import verification** (CLAUDE.md § Critical Rules):
   > "Before pushing any new file, confirm its imports resolve without circular dependencies."
   - Developers manually verify: `npm run build` succeeds with no console errors
   - Circular imports cause "gray screen crashes" — caught by failed build or on load

2. **Error Boundaries** (from `src/components/shared/AppErrorBoundary.jsx`):
   - Wrapped around top-level pages to catch render errors
   - Suppresses transient "chunk load" errors during deployment swaps
   - All new pages MUST be wrapped in `<ErrorBoundary>` per CLAUDE.md

3. **Type safety (implicit via conventions):**
   - Helper functions like `toNumber()`, `normalizeSymbol()` validate/coerce input
   - Fallback patterns prevent null reference errors
   - Example from `usePaperTrading.js`:
     ```javascript
     const toNumber = (value, fallback = 0) => {
       const parsed = Number(value);
       return Number.isFinite(parsed) ? parsed : fallback;
     };
     ```

---

## What Gets Tested Manually

**Component rendering:**
- Dashboard layout (sidebar, panels, charts)
- Watchlist tabs (stocks vs. crypto)
- Order entry panels (Trader vs. Crypto parity check)
- Error messages and fallback states

**Data flows:**
- Stock quote fetches and WebSocket updates
- Paper trading portfolio sync
- Authentication state transitions
- Sophia AI response generation

**Integration scenarios:**
- Login → Dashboard load → Trade execution
- Market data fetch failure → graceful error display
- WebSocket reconnect after disconnection

---

## Mocking Patterns (Implicit)

**localStorage:**
- Used for UI state persistence (theme, sidebar collapse, chart settings)
- Reset between dev sessions

**API calls:**
- Actual API calls to `/api/*` endpoints (Vercel Functions)
- No mocking library; real fetch calls in development
- Environment variables provide real or test credentials

**WebSocket (Alpaca):**
- Real WebSocket connection to `wss://stream.data.alpaca.markets/...`
- Only available in browser (requires auth keys)
- Singleton pattern (`src/services/alpacaStream.js`) ensures single connection

**What NOT to mock (per code patterns):**
- Never mock Alpaca stream directly; use singleton manager
- Never poll for market data; use WebSocket only
- Real Supabase calls for auth/database (client key is public-facing)

---

## Test Data & Fixtures

**Hardcoded test data:**
- `TOP_CRYPTO_BY_MARKET_CAP` in `src/data/cryptoTop20.js`
- `DEFAULT_LSE_SYMBOLS` in `api/lib/twelvedata.js` (London Stock Exchange tickers)
- `DEFAULT_PORTFOLIO` in `usePaperTrading.js`:
  ```javascript
  const DEFAULT_PORTFOLIO = {
    cash_balance: 100000,
    starting_balance: 100000,
    positions: [],
    total_account_value: 100000,
    total_pnl: 0,
    total_pnl_percent: 0,
  };
  ```

**Demo/test URLs:**
- Local dev: `http://localhost:5173`
- No staging/test environment URLs hardcoded

**How to test locally:**
1. `npm run dev` — Start Vite dev server
2. Open `http://localhost:5173` in browser
3. Sign in with test account (Supabase credentials required)
4. Interact with dashboard, chart, watchlist, order entry
5. Monitor browser DevTools:
   - **Console:** Check for errors in ErrorBoundary or API failures
   - **Network:** Verify API calls succeed, WebSocket connects
   - **React DevTools:** Inspect component state, props

---

## Error Testing

**Observable error flows:**
- API 400/500 responses logged to console with prefix: `console.error('[endpoint] error:', error)`
- Network failures (fetch timeout, DNS failure) caught in try-catch
- Graceful fallback: If API fails, UI shows loading spinner or "--" placeholder

**Example from `Watchlist.jsx` (crypto quote fetch):**
```javascript
const fetchCryptoQuote = useCallback(async (symbol) => {
  try {
    const instrumentName = buildCryptoInstrumentName(symbol);
    const res = await fetch(`${CRYPTO_API_BASE}?instrument_name=${instrumentName}`);
    if (!res.ok) return null;
    const data = await res.json();
    // ... process data
  } catch (err) {
    console.error('Crypto quote fetch error:', symbol, err);
    return null;  // Fail gracefully; UI shows placeholder
  }
}, []);
```

**Common error scenarios:**
1. WebSocket connection limit exceeded → Banner displayed; user must refresh
2. API rate limit → Retry with exponential backoff (implicit in fetch loops)
3. Missing env var → Console error; feature disabled gracefully
4. Circular import → Build fails; caught before deploy

---

## Test Coverage Gaps

**Untested areas (critical):**
- **Sophia AI prompt caching:** Relies on manual verification that `cache_read_input_tokens > 0` in response (CLAUDE.md: "Verify caching is active")
- **WebSocket reconnection logic:** Complex state machine in `AlpacaStreamManager` untested; race conditions possible
- **Paper trading transaction logic:** Portfolio sync and position calculations not unit tested
- **Stripe webhook processing:** Payment reconciliation untested
- **Community bot logic:** Persona generation, like/reply aggregation untested (complex state in Redis)

**Risk:** High-impact bugs in real-time systems (WebSocket, trading) could cause silent failures or data corruption.

**Priority to add tests:**
1. **Alpaca stream manager** — Test connect/disconnect, symbol subscription, message parsing
2. **Paper trading portfolio** — Test position entry, exit, P&L calculation
3. **API endpoints** — Test request validation, error responses, CORS headers
4. **Sophia caching** — Test that cache_control header is set and cache is hit on consecutive requests

---

## Deployment Testing

**Pre-deploy validation:**
- `npm run build` — Bundler catches import errors, unused imports (ESLint warns)
- Git hooks: None explicitly configured (no pre-commit hook in repo)
- Vercel auto-deploys from `main` branch; no staging environment

**Post-deploy validation (manual):**
- Open production URL
- Login and navigate to key pages (Dashboard, Markets, Trade)
- Check browser console for errors
- Verify WebSocket connects (Network tab, filter for wss://)
- Test one trade execution (paper trading only)

---

## Continuous Integration

**Current:** No CI pipeline configured

**Absent:**
- No GitHub Actions workflow files
- No pre-commit hooks
- No automated test gate
- No code review enforcement

**How to add:**
1. Create `.github/workflows/test.yml` to run ESLint
2. Add test runner config (Jest or Vitest) once tests are written
3. Add pre-push hook to run linting (optional via husky)

---

*Testing analysis: 2026-03-10*
