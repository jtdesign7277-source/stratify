# Testing Patterns

**Analysis Date:** 2026-03-10

## Test Framework

**Runner:** Not detected

**Assertion Library:** Not detected

**Status:** No testing framework configured in this codebase. Jest, Vitest, Mocha, or similar test runners are not present in `package.json` or project root. Testing infrastructure is not implemented.

**Run Commands:** Not applicable — no test scripts defined in `package.json`

## Test File Organization

**Location:** Not applicable — no test files found

**Naming:** Not applicable

**Structure:** Not applicable

## Test Structure

**Suite Organization:** Not applicable

**Patterns:** Not applicable

## Mocking

**Framework:** Not applicable

**Patterns:** Not applicable

**What to Mock:** Not applicable

**What NOT to Mock:** Not applicable

## Fixtures and Factories

**Test Data:** Not applicable

**Location:** Not applicable

## Coverage

**Requirements:** None enforced

**View Coverage:** Not applicable

## Test Types

**Unit Tests:** Not present

**Integration Tests:** Not present

**E2E Tests:** Not present

## Manual Testing Observed Patterns

### Error Boundary Testing
The codebase includes comprehensive error handling patterns that appear to be manually tested:

**AppErrorBoundary (`src/components/shared/AppErrorBoundary.jsx`):**
- Tests for chunk-load errors (transient failures during code-splitting)
- Distinguishes recoverable vs. fatal errors
- Pattern shows deliberate testing of error states before deployment

**Pattern from `src/components/shared/AppErrorBoundary.jsx` (lines 32-39):**
```javascript
static getDerivedStateFromError(error) {
  // Dynamic-import chunk misses can happen transiently during navigation/deploy swaps.
  // Let the app continue rendering instead of flashing the full crash UI.
  if (isChunkLoadError(error)) {
    return { hasError: false, error: null };
  }
  return { hasError: true, error };
}
```

### Stream/WebSocket Connection Testing
Stream managers appear to have been tested for connection resilience:

**AlpacaStreamManager (`src/services/alpacaStream.js`):**
- Connection lock mechanisms prevent duplicate connects: `this.stockConnectPromise`
- Exponential backoff retry with cooldown: `CONNECTION_LIMIT_COOLDOWN_MS = 30000`
- Handles "connection limit exceeded" errors (commit `e36240e` references this as a critical incident)
- Listener isolation — each listener wrapped in try-catch to prevent cascade failures

### Development Debugging
Console logging patterns suggest manual/local testing:

**Logging by Context:**
```javascript
console.error('[Alpaca Stream] Status listener error:', error);
console.warn('[TradeHistorySync] Save error:', error.message);
console.error('[Stock WS] Close error:', error);
```

These labels allow filtering logs during manual testing.

## QA Indicators (No Automated Tests)

1. **Version Control as QA Record:**
   - Commit messages indicate testing before fixes (e.g., `fix: disable dead Railway WebSocket connection`)
   - Incident runbook in CLAUDE.md references `commit e36240e` as fix for "connection limit exceeded" — suggests manual reproduction and verification

2. **Error Handling as Test-Driven Design:**
   - Transient chunk-load errors handled gracefully (lines 32-39 of AppErrorBoundary)
   - Connection state machines prevent known failure modes (AlpacaStreamManager connect locks)
   - Listener isolation prevents cascading failures

3. **Type Safety via JSDoc:**
   - Minimal JSDoc present, but used in complex utility modules (e.g., `src/utils/apiCache.js`)
   - Suggests some type validation during development

## Recommended Testing Infrastructure

**To add testing to this codebase:**

1. **Framework Choice:**
   - Vitest recommended (optimized for Vite projects)
   - Jest alternative (broader ecosystem support)

2. **Priority Test Areas:**
   - `src/services/alpacaStream.js` — Critical singleton, connection state machine
   - `src/hooks/useAlpacaStream.js` — Hook subscription/unsubscription patterns
   - `src/lib/supabaseClient.js` — Graceful degradation when env vars missing
   - `src/components/shared/AppErrorBoundary.jsx` — Error boundary resilience
   - API routes in `api/` — Response validation, error handling

3. **Test Pattern Examples:**

**Example Unit Test Structure (if Vitest added):**
```javascript
// src/services/alpacaStream.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import manager from './alpacaStream.js';

describe('AlpacaStreamManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manager.teardownStockSocket();
    manager.teardownCryptoSocket();
  });

  it('should not allow concurrent stock connects', async () => {
    const promise1 = manager.connectStockWs();
    const promise2 = manager.connectStockWs();

    expect(promise1).toBe(promise2); // Same promise instance
  });

  it('should emit status on listener subscription', (done) => {
    const unsubscribe = manager.subscribeStatus((status) => {
      expect(status).toHaveProperty('stockConnected');
      unsubscribe();
      done();
    });
  });
});
```

**Example Component Test (if Vitest + React Testing Library added):**
```javascript
// src/components/shared/AppErrorBoundary.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppErrorBoundary from './AppErrorBoundary.jsx';

describe('AppErrorBoundary', () => {
  it('should suppress chunk-load errors and render children', () => {
    const ThrowChunkError = () => {
      throw new Error('Failed to fetch dynamically imported module');
    };

    const { rerender } = render(
      <AppErrorBoundary>
        <ThrowChunkError />
      </AppErrorBoundary>
    );

    // Should not show crash screen for transient chunk errors
    expect(screen.queryByText(/Application Error/)).not.toBeInTheDocument();
  });

  it('should show crash screen for fatal errors', () => {
    const ThrowFatalError = () => {
      throw new Error('Fatal runtime error');
    };

    render(
      <AppErrorBoundary>
        <ThrowFatalError />
      </AppErrorBoundary>
    );

    expect(screen.getByText(/Application Error/)).toBeInTheDocument();
  });
});
```

---

*Testing analysis: 2026-03-10*
