# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- Components (React): `PascalCase.jsx` (e.g., `Watchlist.jsx`, `AppErrorBoundary.jsx`, `TraderPage.jsx`)
- Utilities/Hooks: `camelCase.js` (e.g., `twelvedata.js`, `supabaseClient.js`, `withTimeout.js`)
- Hooks specifically: `use[Name].js` (e.g., `useAlpacaStream.js`, `usePaperTrading.js`, `useSubscription.js`)
- API endpoints: `kebab-case.js` (e.g., `sophia-chat.js`, `create-checkout-session.js`, `market-summary.js`)

**Functions:**
- Named exports: `camelCase` (e.g., `normalizeSymbol`, `formatCurrency`, `fetchPortfolioInternal`)
- Arrow functions in const declarations: `const functionName = (...) => { }`
- React components: `PascalCase` (e.g., `function Watchlist({...})`, `export default function Dashboard({...})`)
- Utility helpers with underscores acceptable for clarity: `const is_chunk_load_error` or `isChunkLoadError` (both used interchangeably)

**Variables:**
- Local state: `camelCase` (e.g., `sharedState`, `stockQuotes`, `cryptoListeners`)
- Constants (upper scope): `SCREAMING_SNAKE_CASE` (e.g., `STOCK_WS_URL`, `DEFAULT_PORTFOLIO`, `RECONNECT_BASE_DELAY`)
- Boolean flags: `is[Name]` or `has[Name]` or `should[Name]` (e.g., `isMounted`, `hasError`, `shouldUsePaperTopBarMetrics`)
- Map/Set collections: descriptive plural nouns (e.g., `stockListeners`, `cryptoOrderbookListeners`, `statusListeners`)

**Types:**
- No TypeScript. JSDoc comments used sparingly for complex functions.

## Code Style

**Formatting:**
- Configured with `eslint.config.js` (flat config, ES2020+)
- No Prettier config file; formatting conventions enforced via ESLint
- Indentation: 2 spaces (inferred from existing files)
- Line length: No strict enforcer visible; reasonable limit ~120-140 characters observed

**Linting:**
- ESLint config: `eslint.config.js`
- Extends: `js.configs.recommended`, `react-hooks.configs.flat.recommended`, `react-refresh.configs.vite`
- Key rules:
  - `'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }]` — Allow uppercase or leading underscore in unused vars (for intentional ignores, React component props)
- React Hooks plugin enforces dependency rules (dependency array correctness)
- React Refresh plugin for fast refresh during development

**Import/Export:**
- ESM modules (`"type": "module"` in `package.json`)
- Imports at top of file, organized naturally but no enforced grouping beyond inline comments

## Import Organization

**Order (observed pattern):**
1. React imports (`import { useState, useEffect } from 'react'`)
2. Third-party libraries (`@supabase`, `framer-motion`, external packages)
3. Relative imports (`from '../lib/...'`, `from '../../data/...'`)
4. Utility functions, constants, data files

**Path Aliases:**
- Not configured; uses relative paths throughout (e.g., `../lib/twelvedata.js`, `../../services/alpacaStream.js`)
- Web APIs use direct paths: `/api/xray/*`, `/api/stocks`, `/api/watchlist/*`

**Example import structure (from `usePaperTrading.js`):**
```javascript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
// Followed by local constants and helper functions
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations: wraps `fetch()`, `response.json()`, API calls
- Inline `.catch()` chains for JSON parsing with fallbacks: `.json().catch(() => ({}))`
- Custom error classes for specific errors (e.g., `TimeoutError` extends `Error` in `withTimeout.js`)
- Console error logging with context prefix: `console.error('[cron/community-bot] failed:', error)`
- Graceful degradation: attempt fallback values on error (see `normalizePortfolio()` using `toNumber(value, fallback)`)

**Pattern from `withTimeout.js`:**
```javascript
export class TimeoutError extends Error {
  constructor(message, timeoutMs) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function withTimeout(promise, timeoutMs, message = 'Operation timed out') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(message, timeoutMs));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}
```

**API error handling (from `api/sophia-chat.js`):**
```javascript
try {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Request failed');
  // process response
} catch (error) {
  console.error('[endpoint] error:', error);
  return res.status(status).json({ error: error?.message || 'Failed' });
}
```

## Logging

**Framework:** Native `console` object (no Winston, Bunyan, or external logger)

**Patterns:**
- `console.error()` for errors with context prefix in square brackets
- Format: `console.error('[area/module] message:', error)`
- Examples from codebase:
  - `console.error('[app/error-boundary] Unhandled render error:', error, errorInfo)`
  - `console.error('[xray/profile] error:', error)`
  - `console.error('[cron/community-bot] failed:', error?.message || error)`
- `console.warn()` for warnings (e.g., suppressed transient errors)
- `console.log()` for info (minimal use; mostly in data processing)

**When to log:**
- Errors in catch blocks (always)
- API fetch failures
- WebSocket connection state changes (implicit in stream manager)
- Authentication failures

## Comments

**When to comment:**
- Explain non-obvious logic (e.g., chunk load error suppression in `AppErrorBoundary`)
- Document state management synchronization (e.g., `useAlpacaStream` hook comments about singleton)
- Justify workarounds and edge cases

**JSDoc/TSDoc:**
- Minimal usage; single-line comments preferred
- No enforced documentation for simple functions
- Block comments for class methods (e.g., `class AlpacaStreamManager { constructor() { ... } }`)
- Example from `useAlpacaStream.js`:
```javascript
/**
 * Shared real-time Alpaca stream hook.
 * Uses a singleton stream manager so the app maintains only one stock + one crypto socket.
 */
export const useAlpacaStream = ({ stockSymbols = [], cryptoSymbols = [], enabled = true }) => {
  // ...
}
```

## Function Design

**Size:**
- Prefer small, focused functions (5–30 lines typical)
- Normalization/transformation helpers inline in module scope (e.g., `normalizeSymbol()`, `toNumber()`)
- Large components split across multiple files (e.g., X-Ray module with separate hooks)

**Parameters:**
- Destructured object params for hooks and components (e.g., `useAlpacaStream({ stockSymbols = [], cryptoSymbols = [] })`)
- Positional params for small utility functions (e.g., `normalizeSymbol(value)`, `toNumber(value, fallback)`)
- Default values used extensively for optional parameters

**Return Values:**
- Objects with predictable shape (e.g., `{ symbol, quote }` from stream callbacks)
- Null or undefined for missing data; no false/0 substitution for clarity
- Tuple-style returns avoided; prefer named object returns

## Module Design

**Exports:**
- Named exports for utilities: `export const normalizeSymbol = (...)`
- `export default` for single React components and API handlers
- Multiple named exports for hook modules (e.g., `export function useIncomeStatement(...)`, `export function useBalanceSheet(...)`)

**Barrel Files:**
- Used sparingly (e.g., `src/components/dashboard/index.js` re-exports dashboard components)
- Prefer direct imports where possible to avoid circular dependency issues

**Shared State Pattern (from `usePaperTrading.js`):**
- Singleton-like state with listener subscription model
- `sharedState` object with `listeners` Set; `notify()` broadcasts changes
- Hook subscribes/unsubscribes on mount/unmount
- Persists data across component remounts (critical for portfolio state)

## Specific Conventions by Layer

**Frontend Components (`src/components/`):**
- Export default component; accept props destructured
- Use `useState`, `useCallback`, `useEffect`, `useMemo` for state management
- Error boundaries wrapping top-level pages (CLAUDE.md: "Always Add Error Boundary to New Pages")

**Services (`src/services/`):**
- Singleton pattern for stream managers (e.g., `AlpacaStreamManager` in `alpacaStream.js`)
- Public API via exported functions: `subscribeStocks()`, `subscribeCrypto()`, `reconnectStocksStream()`
- Internal state managed in class; listeners notified via callbacks

**Hooks (`src/hooks/`):**
- Encapsulate subscription logic and state sync
- Return objects with `loading`, `error`, `data` shape
- Subscribe to services in `useEffect`; unsubscribe on cleanup

**API Handlers (`api/`):**
- Receive `(req, res)` from Vercel
- Set CORS headers explicitly
- Return JSON: `res.status(code).json({ data, error })`
- Status codes: 200 (success), 400 (bad request), 405 (method not allowed), 500 (server error)

**Utilities (`src/lib/`):**
- Pure functions; no side effects
- Normalization functions: `normalize*`, `to*` (e.g., `normalizeSymbol()`, `toNumber()`)
- Formatting functions: `format*` (e.g., `formatCurrency()`, `formatPercent()`)
- Transform fallback chains for robust data handling

---

*Convention analysis: 2026-03-10*
