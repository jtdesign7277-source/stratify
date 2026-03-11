---
phase: 02-bet-history-display
plan: 01
subsystem: ui
tags: [react, supabase, hooks, sports-betting]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: paper_sports_bets table with RLS, stake/actual_payout columns, settle cron
provides:
  - useBetHistory hook — RLS-scoped fetch of all user bets sorted by created_at DESC
  - computeStats pure function — totalWagered, totalWon, netPnl, winRate from any bets array
affects: [02-bet-history-display plan 02, 03-filters-and-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [cancelled-flag cleanup in useEffect, pure stats function for reusable subset filtering]

key-files:
  created:
    - src/hooks/useBetHistory.js
  modified: []

key-decisions:
  - "Column is 'stake' not 'bet_amount' — verified against SportsOddsPage INSERT"
  - "Matchup is NOT a column — use home_team + away_team pair for display"
  - "totalWagered includes pending bets; netPnl and winRate exclude pending (realized P&L only)"
  - "computeStats accepts any subset array — supports future filter scenarios without API changes"

patterns-established:
  - "Pattern 1: cancelled-flag async cleanup — same pattern as SportsBankroll.jsx, prevents setState on unmounted component"
  - "Pattern 2: pure stats function separate from hook — enables BetHistoryTab to filter bets client-side then recompute stats"

requirements-completed: [HIST-01, HIST-02, STAT-01, STAT-02]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 2 Plan 01: useBetHistory Hook and computeStats Summary

**Supabase hook fetching user bets RLS-scoped sorted reverse-chronologically, plus pure computeStats deriving totalWagered/totalWon/netPnl/winRate with pending exclusion**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-11T02:30:00Z
- **Completed:** 2026-03-11T02:35:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Verified exact DB column names from SportsOddsPage INSERT and settle-sports-bets UPDATE — notably `stake` (not `bet_amount`) and `home_team`/`away_team` (no `matchup` column)
- Created `useBetHistory` hook with cancelled-flag cleanup, session check, and RLS-scoped query ordered DESC
- Created `computeStats` pure function with correct pending exclusion from winRate denominator and netPnl

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify column names (read-only)** - included in feat commit below
2. **Task 2: Create useBetHistory + computeStats** - `7620342` (feat)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified
- `src/hooks/useBetHistory.js` — Hook + computeStats, verified column names documented in header comment

## Decisions Made
- `stake` is the bet amount column (not `bet_amount`) — plan spec mentioned `bet_amount` but INSERT statement uses `stake`
- No `matchup` column exists — teams stored as `home_team` + `away_team` separately; BetHistoryTab must concatenate
- `totalWagered` sums ALL bets including pending per spec; pending excluded from `netPnl` and `winRate` only

## Deviations from Plan

None - plan executed exactly as written. The column name clarification (`stake` vs `bet_amount`) was an expected finding from the read-only Task 1 investigation, not a deviation.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useBetHistory` and `computeStats` ready to be consumed by Plan 02 (BetHistorySummary + BetHistoryTab components)
- Column name `home_team` + `away_team` documented for Plan 02 table headers
- `computeStats` accepts any subset — Plan 02 can pass full `bets` array; Plan 03 can pass filtered subset

---
*Phase: 02-bet-history-display*
*Completed: 2026-03-11*
