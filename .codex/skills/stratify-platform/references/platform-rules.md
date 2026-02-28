# Stratify Platform Rules

## Hard Rules

1. Use cache-first data loading with Upstash Redis for all fetch flows.
2. Preload adjacent tab data in the background on page entry.
3. Avoid cold loads and tab-click spinners.
4. Never deploy from local; deploy only through GitHub-triggered Vercel/Railway flows or platform dashboards.
5. Keep the terminal-pro dark visual system consistent.
6. Wrap new pages/components with React Error Boundaries.
7. Use Twelve Data `/quote` endpoint for prices; do not use `/quotes`.
8. Prefer WebSocket streaming for real-time updates; avoid polling for live quote updates.
9. Format displayed tickers with a `$` prefix (`$AAPL`, `$BTC`, `$NVDA`).
10. Prefer Vercel serverless API routes when choosing between Vercel and Railway for API surface.

## Canonical Data Flow

```text
User opens page/tab
  -> Read Redis cache
     -> Cache hit: render instantly
     -> Cache miss: fetch API, write Redis, render
  -> Connect WebSocket
     -> Replace snapshot values with live updates
```

Apply this flow on every market-data-backed experience.

## Architecture Pointers

- Frontend: React + Vite + TailwindCSS
- Backend/API: Vercel serverless functions first; Railway used where already required
- Auth and user data: Supabase
- Cache: Upstash Redis
- Market data: Twelve Data REST + WebSocket
- AI generation: Claude API with prompt caching
- Billing: Stripe

## Component Placement

- Dashboard UI components: `src/components/dashboard/`
- Route-level pages: `src/pages/`
- Vercel serverless APIs: `api/`

## Default Ticker Sets

- Mag 7: `AAPL`, `MSFT`, `GOOGL`, `AMZN`, `NVDA`, `META`, `TSLA`
- Indices: `SPY`, `QQQ`, `DIA`
- Crypto: `BTC`, `ETH`, `SOL`, `XRP`, `DOGE`, `LINK`, `ADA`, `AVAX`, `DOT`

## Strategy Templates

Use these as default strategy-builder templates:

- Momentum
- RSI
- Mean Reversion
- Breakout
- MACD
- Scalping

## Delivery Workflow

For generated implementation prompts:

1. UI/visual work: emit a clearly labeled `🟢 CODEX PROMPT` block.
2. Logic/code work: emit a clearly labeled `🔵 CLAUDE CLI PROMPT` block.
3. Hybrid work: emit both blocks in the order above.
4. Include Mission Control activity logging call:

```bash
curl -X POST https://mission-control-seven-henna.vercel.app/api/activity \
  -H 'Content-Type: application/json' \
  -d '{"source":"codex","action":"task-name","status":"success","duration":12.3}'
```

## Deployment Checklist

Before marking a task deploy-ready:

- Confirm error boundaries wrap new surfaces.
- Confirm Redis cache-first behavior for new fetches.
- Confirm no hardcoded API keys.
- Confirm hard refresh behavior is stable.
- Confirm code is ready for GitHub push-based deployment.

## AI Search Result Rendering

Format AI search results as structured, readable sections:

1. Use clear section headers such as `Index Futures`, `Key Premarket Movers`, and `Macro Data`.
2. Use bullet points with one scannable fact per bullet.
3. Add inline source tags per claim (`[wsj]`, `[cnbc]`, `[nasdaq]`).
4. Bold key terms:
   - Company names
   - Index names
   - Economic indicators
5. Avoid raw text dumps; parse and group by topic.
