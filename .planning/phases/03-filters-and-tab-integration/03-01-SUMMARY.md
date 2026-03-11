---
phase: 03-filters-and-tab-integration
plan: "01"
subsystem: ui
tags: [react, framer-motion, useMemo, useState, filter, sort]

# Dependency graph
requires:
  - phase: 02-bet-history-display
    provides: BetHistoryTab component and computeStats pure function from useBetHistory.js
provides:
  - Client-side result filter (All/Win/Loss/Pending) on BetHistoryTab
  - Client-side sport filter (All/NFL/NBA/MLB/NHL) on BetHistoryTab
  - Sortable column headers (Date/Stake/Result) with animated arrow indicators
  - Stats strip recomputes from filtered subset via computeStats(filteredBets)
affects: [03-filters-and-tab-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "filteredBets useMemo with composed result + sport filters and sort — zero server round-trips"
    - "layoutId sliding indicator (result-indicator, sport-indicator) for filter tab animation"
    - "SPRING constant locked to stiffness 400, damping 30 matching SportsOddsPage"

key-files:
  created: []
  modified:
    - src/components/dashboard/BetHistoryTab.jsx
    - src/pages/SportsOddsPage.jsx

key-decisions:
  - "Stats always derived from filteredBets (not bets) — statsProp ignored to enforce STAT-02"
  - "Two separate layoutId values (result-indicator, sport-indicator) to prevent framer-motion collision"
  - "Empty filtered state distinguished from empty data — shows different message with clear button"

patterns-established:
  - "Filter composition pattern: useMemo with multiple filter states + sort applied in sequence"
  - "SortableHeader pattern: onClick calls handleSort, toggles direction on second click of same key"

requirements-completed: [FILT-01, FILT-02, FILT-03, FILT-04]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 3 Plan 01: Filters and Tab Integration Summary

**Client-side result/sport filter buttons and sortable column headers added to BetHistoryTab with stats recomputing from the filtered subset via useMemo**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-11T11:25:08Z
- **Completed:** 2026-03-11T11:27:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `resultFilter` (All/Win/Loss/Pending) and `sportFilter` (All/NFL/NBA/MLB/NHL) state with animated tab-style buttons using framer-motion `layoutId` sliding indicator
- Added `filteredBets` useMemo composing both filters with multi-key sort (date/stake/result), direction toggles on same-key click
- Stats strip now receives `computeStats(filteredBets)` so all metrics reflect the filtered view (STAT-02 compliance)
- Date, Stake, and Result column headers are sortable with animated arrow indicators
- Differentiated empty state: "No bets yet" vs "No bets match your filters" with a clear-filters button

## Task Commits

Each task was committed atomically:

1. **Task 1: Add filter state, sort state, and derived filteredBets to BetHistoryTab** - `c30f90d` (feat)

**Plan metadata:** _(docs commit to follow)_

## Files Created/Modified
- `src/components/dashboard/BetHistoryTab.jsx` - Added filter/sort state, filteredBets useMemo, filter UI rows, sortable column headers, differentiated empty states
- `src/pages/SportsOddsPage.jsx` - Fixed pre-existing blocking issue: changed `import useBetHistory from` to `import { useBetHistory } from` (named export only)

## Decisions Made
- Stats always derived from `filteredBets` rather than raw `bets` to enforce STAT-02 — `statsProp` kept in signature for backward compatibility but ignored
- Two distinct `layoutId` values (`result-indicator`, `sport-indicator`) to prevent framer-motion shared layout animation collision (per RESEARCH.md Pitfall 2)
- Differentiated empty filtered state from truly empty data state so users understand filters are active

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed named-export import for useBetHistory in SportsOddsPage.jsx**
- **Found during:** Task 1 (build verification)
- **Issue:** SportsOddsPage.jsx used `import useBetHistory from '../hooks/useBetHistory'` (default import) but useBetHistory only has a named export. Build failed with "default is not exported" error.
- **Fix:** Changed to `import { useBetHistory } from '../hooks/useBetHistory'`
- **Files modified:** src/pages/SportsOddsPage.jsx
- **Verification:** `npx vite build` passes with zero errors
- **Committed in:** c30f90d (part of task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was required for build to pass. Pre-existing issue from phase 02 partial implementation in SportsOddsPage.jsx. No scope creep.

## Issues Encountered
- Pre-existing broken state in SportsOddsPage.jsx from phase 02's tab integration work — the `useBetHistory` import was using default import syntax but the hook only exports named exports. Fixed as Rule 3 blocking issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four FILT requirements satisfied (FILT-01 through FILT-04)
- Filter/sort logic is fully client-side with zero server round-trips
- Stats recompute from filtered subset — ready for any future filter additions
- SportsOddsPage Odds/History tab integration is functional (tab UI was already in place from phase 02 partial work)

---
*Phase: 03-filters-and-tab-integration*
*Completed: 2026-03-11*
