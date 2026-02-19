# Brain Dump

Last updated: 2026-02-19  
Compiled from:
- `/Users/stratify/Desktop/second-brain`
- `/Users/stratify/Desktop/Stratify-Memory`
- `/Users/stratify/Documents/New project/stratify`

## 1) Critical Operating Rules

- User timezone/location context: Boston, MA (ET). Always anchor market-time logic to ET.
- Market data rule: no polling for core market prices. Use Alpaca WebSocket streaming.
- Deployment rule: commit + push to GitHub main and let Vercel auto-deploy.
- Dashboard access model (current direction): auth + subscription gating is required for app access.
- Naming lock: assistant name is Sophia only; Atlas naming is retired.

## 2) Streaming Architecture (Most Important)

- The app must use a single shared Alpaca stream manager:
  - Stock socket: `wss://stream.data.alpaca.markets/v2/sip`
  - Crypto socket: `wss://stream.data.alpaca.markets/v1beta3/crypto/us`
- Root incident fixed on 2026-02-18:
  - Symptom: `connection limit exceeded`
  - Cause: duplicate concurrent connect attempts (race condition)
  - Permanent fix: connect locks (`stockConnectPromise`, `cryptoConnectPromise`) in `src/services/alpacaStream.js`
- Never open Alpaca WebSockets directly inside feature components.
- Related runbook: `docs/markets-websocket-runbook.md`

## 3) Current Product Direction (Converged View)

- Stratify is now positioned as an AI-first trading workspace:
  - War Room (intel/research)
  - Terminal (strategy workspace)
  - Trade/Markets/Portfolio execution context
  - Sophia as the core AI assistant
- Strategy workflow emphasis:
  - Sophia response -> Key Trade Setups -> user review/edit -> save -> activation flow.
- Market intel and social automation are recurring pillars (2-hour intel cadence, social engagement cadence).

## 4) Design System Priorities (Practical)

- Dark terminal-pro aesthetic.
- Emerald is primary positive/action accent; red for risk/negative; amber for alerts/highlights.
- Key Trade Setups card style is a hard requirement:
  - dark purple/indigo gradient
  - amber uppercase labels
  - white readable values
  - no truncation/ellipsis
  - edit affordances visible
- Sidebar readability + compact density are repeatedly prioritized.
- Visual stability matters more than novelty; avoid style drift across panels.

## 5) Source-of-Truth Tension (Old vs New)

The memory corpus contains two eras:

- Older planning docs (Jan 2026) describe prediction-market arbitrage focus with Atlas naming.
- Newer operational docs (Feb 2026) reflect the current Sophia-led stock/crypto strategy platform.

Working rule:
- Prefer newer Feb 2026 execution notes and current repo behavior over older aspirational plans.
- Preserve older plans as historical context, not implementation truth.

## 6) Confirmed Important Folders/Notes Reviewed

From `second-brain`:
- `critical-rules/stratify-development.md`
- `notes/2026-02-14.md`
- `notes/2026-02-15.md`
- `notes/2026-02-16.md`
- `market-intel/2026-02-14.md`
- `market-intel/2026-02-15.md`
- `market-intel/2026-02-16.md`
- `market-intel/2026-02-17.md`
- `notes/daily-x-video-posts/pipeline-plan.md`

From `Stratify-Memory`:
- `stratify-agent-brain.md`
- `stratify/CLAUDE.md`
- `stratify/untitled folder/STRATIFY_MASTER_PLAN.md`
- `stratify/untitled folder/STRATIFY_MASTER_PLAN_PART2.md`
- `stratify/untitled folder/information for website/STRATIFY_STACK.md`
- `stratify/untitled folder/Stratify-Design-Reference/STRATIFY-DESIGN-GUIDE.md`
- `stratify/public/newsletters/newsletter-15-02-2026.md`
- `stratify/public/sophia-recaps/sophia-recap-15-02-2026.txt`

## 7) Priority Memory Snapshot (Actionable)

- Keep one shared stock socket + one shared crypto socket app-wide.
- Preserve Key Trade Setups UX consistency everywhere it appears.
- Maintain Sophia-first naming and flows (legacy naming appears in older docs).
- Keep deployment hygiene strict: GitHub main -> Vercel.
- Treat ET and market calendar correctness as mandatory for all market-time decisions.

## 8) Open Follow-Ups (Optional)

- Build one canonical "current truth" doc that supersedes stale January planning docs.
- Add automated health check for duplicate stream connections and expose status in Markets diagnostics.
- Consolidate design tokens in one shared file so card styles do not drift across pages.
