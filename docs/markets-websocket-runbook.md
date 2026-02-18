# Markets WebSocket Runbook

Last updated: 2026-02-18  
Primary fix commit: `e36240e`

## Incident
Markets page showed `connection limit exceeded` and one or more cards stayed in `Connecting...`.

## Root Cause
Duplicate Alpaca socket connection attempts were opened by race conditions in the shared stream manager.

Even with a singleton manager, concurrent reconnect/mount calls can overlap without an in-flight lock and create multiple socket sessions.

## Required Architecture
- Exactly one stock stream connection:
  - `wss://stream.data.alpaca.markets/v2/sip`
- Exactly one crypto stream connection:
  - `wss://stream.data.alpaca.markets/v1beta3/crypto/us`
- All components subscribe via:
  - `src/services/alpacaStream.js` (singleton)
  - `src/hooks/useAlpacaStream.js`
- No direct Alpaca `new WebSocket` in dashboard components.

## Mandatory Guardrails in `src/services/alpacaStream.js`
- `stockConnectPromise` lock in `connectStockWs()`
- `cryptoConnectPromise` lock in `connectCryptoWs()`
- If lock exists, return it immediately
- Clear lock in `.finally(...)`

## Quick Verification Steps
1. Open app with `Terminal`, `Trade`, and `Markets` pages used in same session.
2. Confirm no red `connection limit exceeded` banner in Markets.
3. Confirm ETFs/Stocks and Crypto both move off `Connecting...`.
4. Run:
   - `rg -n "stream\\.data\\.alpaca|new WebSocket\\(" src`
   - Only `src/services/alpacaStream.js` should contain Alpaca stream socket URLs.

## Related Layout Note
Markets 4-column order is intentionally:
1. ETFs & Indices
2. Trending
3. Sectors
4. Crypto

If Crypto appears in another position, check `src/components/dashboard/MarketsPage.jsx` card order.
