# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- React components: `PascalCase.jsx` (e.g., `TraderPage.jsx`, `AppErrorBoundary.jsx`)
- Utilities and services: `camelCase.js` (e.g., `alpacaStream.js`, `supabaseClient.js`)
- Hooks: `use*` prefix in `camelCase.js` (e.g., `useAlpacaStream.js`, `useTradingMode.js`)
- API routes: `kebab-case.js` (e.g., `sophia-insight.js`, `alpaca-keys.js`)
- Directories: `lowercase` or `camelCase` (e.g., `src/components/dashboard/`, `src/hooks/`)

**Functions:**
- Named exports and function declarations: `camelCase` (e.g., `normalizeStockSymbol`, `subscribeStocks`)
- React functional components: `PascalCase` (e.g., `export default function TraderPage()`)
- Utility/helper functions: `camelCase` (e.g., `formatCurrency`, `newsTimeAgo`)
- Private functions (within modules): `camelCase` with leading underscore optional (e.g., `normalizeStockSymbols`)
- Boolean predicates: `is*` or `has*` prefix (e.g., `isConnectionLimitError`, `isChunkLoadError`)
- Transform functions: `to*` or `from*` prefix (e.g., `toCryptoStreamSymbol`, `fromCryptoStreamSymbol`)

**Variables:**
- Regular variables: `camelCase` (e.g., `stockConnected`, `cryptoQuotes`, `listenerId`)
- Constants (module-level): `UPPER_SNAKE_CASE` (e.g., `RECONNECT_BASE_DELAY`, `STOCK_WS_URL`, `CONNECTION_LIMIT_COOLDOWN_MS`)
- Component props: `camelCase` (e.g., `onPinToTop`, `isLiveScoresOpen`, `paperTotalGainLoss`)
- Storage keys: `kebab-case` inside strings (e.g., `'stratify-trader-watchlist'`, `'watchlist_order'`)

**Types/Objects:**
- Class names: `PascalCase` (e.g., `AlpacaStreamManager`, `AppErrorBoundary`)
- Object properties: `camelCase` (e.g., `stockAuthenticated`, `cryptoConnected`, `listenersMap`)
- Enum-like objects: `UPPER_SNAKE_CASE` keys (e.g., `MARKET_PRIORITY = ['NASDAQ', 'NYSE']`)

## Code Style

**Formatting:**
- No Prettier config detected — ESLint is the primary linter
- 2-space indentation (observed in codebase)
- Semicolons: Used consistently at end of statements
- Quotes: Single quotes preferred in most code (e.g., `const url = '...'`)
- Line length: No strict limit observed, but generally under 120 characters

**Linting:**
- ESLint configured via `eslint.config.js` (flat config format)
- Browser globals enabled (`ecmaVersion: 2020`, ES module source type)
- React Hooks rules enforced (`reactHooks.configs.flat.recommended`)
- React Refresh plugin for Vite (`reactRefresh.configs.vite`)
- Unused variable rule: `varsIgnorePattern: '^[A-Z_]'` — ignores uppercase/underscore-prefixed unused vars
- All recommended rules from `@eslint/js` are active

## Import Organization

**Order:**
1. React/Third-party libraries (e.g., `import React`, `import { useState } from 'react'`)
2. Third-party UI/utility packages (e.g., `import { motion } from 'framer-motion'`, `import { DragDropContext } from '@hello-pangea/dnd'`)
3. Internal services/utilities (e.g., `import { subscribeStocks } from '../services/alpacaStream'`)
4. Internal components (e.g., `import TraderPage from './TraderPage'`)
5. Internal hooks (e.g., `import useTradingMode from '../../hooks/useTradingMode'`)
6. Internal data/constants (e.g., `import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20'`)
7. Local utilities/helpers (e.g., `import { formatCurrency } from '../../lib/twelvedata'`)

**Path Aliases:**
- No path aliases detected (`@/` or `~` patterns not used)
- Relative imports used throughout: `../`, `../../`, etc.

## Error Handling

**Patterns:**
- Try-catch blocks are standard for async operations and promise handling
- Error objects are consistently logged with context labels (e.g., `console.error('[Alpaca Stream] Status listener error:', error)`)
- Errors are wrapped with descriptive messages (e.g., `new Error('[supabase] ${operation} unavailable')`)
- Listener callbacks wrapped in try-catch to prevent one listener failure from affecting others
- Cleanup always performed in finally blocks or via unsubscribe functions
- Status/error propagation via shared callbacks or context (not thrown globally)

**Example from `src/services/alpacaStream.js` (line 113-120):**
```javascript
emitStatus() {
  const snapshot = this.getStatus();
  this.statusListeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (error) {
      console.error('[Alpaca Stream] Status listener error:', error);
    }
  });
}
```

## Logging

**Framework:** `console` object (browser native)

**Patterns:**
- Log level prefix in brackets (e.g., `[Alpaca Stream]`, `[Stock WS]`, `[app/error-boundary]`, `[TradeHistorySync]`)
- Log levels observed: `console.error()`, `console.warn()`, `console.log()` (less common)
- Errors always include context: `console.error('[Context] Description:', error)`
- Warnings for non-critical failures: `console.warn('[PortfolioSync] Save error:', error.message)`
- Development warnings distinguished with context (e.g., `console.warn('[App] Chunk load error detected...')`)
- No structured logging (JSON format) — all logs are plain text with context labels

**Examples:**
- `console.error('[Alpaca Stream] Status listener error:', error)` — line 117 in alpacaStream.js
- `console.warn('[TradeHistorySync] Save error:', error.message)` — line 158 in useTradeHistory.js
- `console.warn('[App] Chunk load error detected. Reloading once...')` — line 39 in main.jsx

## Comments

**When to Comment:**
- Block comments (`/** */`) used for module-level documentation and complex algorithms
- Inline comments rare but used for non-obvious intent
- Comments on constants explain purpose/configuration (e.g., `const RECONNECT_BASE_DELAY = 2000;` for exponential backoff)
- Complex conditional logic may have explanatory comment (e.g., "Dynamic-import chunk misses can happen transiently...")

**JSDoc/TSDoc:**
- Basic JSDoc used for utility functions (e.g., `api/lib/apiCache.js`)
- Format: `@param`, `@returns`, `@type` annotations
- Type annotations: `@type {Map<string, Promise<Response>>}` for complex types
- Not universal across codebase — mostly in shared utility files
- Minimal usage in React components (type inference via JSX props)

**Example from `src/utils/apiCache.js` (lines 26-34):**
```javascript
/**
 * Fetch with request deduplication and optional cache.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function cachedFetch(url, options) { ... }
```

## Function Design

**Size:** Functions tend to be medium-sized (20-100 lines typical)
- Utility functions: 5-20 lines (e.g., `normalizeStockSymbol`)
- Service methods: 20-50 lines (e.g., `subscribeStocks`)
- Component render functions: 50-200+ lines (larger due to JSX + event handlers)
- Complex event handlers sometimes extracted to separate named functions

**Parameters:**
- Named parameters preferred over positional when > 2 arguments
- Destructuring common for React component props: `export default function TraderPage({ onPinToTop, isLiveScoresOpen, ... })`
- Default parameters used: `const normalizeStockSymbols = (symbols = []) => ...`
- Optional parameters in objects: `{ enabled = true }` for hook options

**Return Values:**
- Explicit returns for all code paths
- Promise-based async functions (no callbacks except for subscriptions)
- Unsubscribe patterns return cleanup functions: `return () => { this.statusListeners.delete(id); }`
- Early returns used to reduce nesting: `if (!enabled) { setStockConnected(false); return; }`
- Null vs undefined: Both used, but null used for "no data", undefined for "not set"

## Module Design

**Exports:**
- Default exports for main components (e.g., `export default function TraderPage()`)
- Named exports for utilities and services (e.g., `export const subscribeStocks = ...`)
- Singleton managers export named functions wrapping internal state (e.g., `alpacaStream.js` exports named functions that call `manager.*`)
- Services often export both named functions and a default singleton instance

**Example from `src/services/alpacaStream.js` (lines 872-881):**
```javascript
export const subscribeStocks = (symbols, callback) => manager.subscribeStocks(symbols, callback);
export const subscribeCrypto = (symbols, callback) => manager.subscribeCrypto(symbols, callback);
export const subscribeCryptoOrderbooks = (symbols, callback) => manager.subscribeCryptoOrderbooks(symbols, callback);
export const subscribeAlpacaStatus = (callback) => manager.subscribeStatus(callback);
export const reconnectStocksStream = () => manager.reconnectStock();
export const reconnectCryptoStream = () => manager.reconnectCrypto();
export const getAlpacaStreamStatus = () => manager.getStatus();
export default manager;
```

**Barrel Files:**
- Not observed as a primary pattern in this codebase
- Direct imports from specific files preferred (e.g., `import { subscribeStocks } from '../services/alpacaStream'`)

## React-Specific Conventions

**Hooks:**
- `useState`: Standard state management
- `useEffect`: Side effects with dependency arrays always specified
- `useCallback`: Memoized callbacks for event handlers passed to children
- `useMemo`: Computed values dependent on props/state changes
- `useRef`: DOM references and mutable instance variables (not state)
- `useLayoutEffect`: Rarely used (not observed in sampled code)

**Component Structure:**
- Imports at top
- Constants/helpers defined before component
- Component function definition
- JSX with motion/framer-motion for animations
- Event handlers as arrow functions or wrapped with `useCallback`

**Props:**
- All props explicitly destructured in function signature
- Default values provided in destructure: `isLiveScoresOpen = false`
- Callbacks prefixed with `on*` (e.g., `onPinToTop`, `onToggleLiveScores`)
- Render-dependent props named with present-tense adjectives (e.g., `isOpen`, `disabled`, `loading`)

**Error Boundaries:**
- Every top-level page component must be wrapped in `<ErrorBoundary>` or `<AppErrorBoundary>`
- Required pattern to prevent full-app gray screen crashes from import errors
- Class component pattern, not hook-based

---

*Convention analysis: 2026-03-10*
