---
phase: 01-foundation
plan: 01
subsystem: database
tags: [supabase, postgres, rls, migration, cron, sports-bets]

# Dependency graph
requires: []
provides:
  - "paper_sports_bets schema with status, result_resolved_at, actual_payout, potential_payout, parlay_id columns"
  - "RLS policy on paper_sports_bets: authenticated users see only their own rows"
  - "Composite index on (user_id, created_at DESC) for history queries"
  - "settle-sports-bets cron writes result_resolved_at (not settled_at) when resolving bets"
  - "New users receive paper_sports_bankroll row on initialization"
affects: [02-bet-history-ui, 03-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent SQL migrations using ADD COLUMN IF NOT EXISTS and DROP POLICY IF EXISTS"
    - "Bankroll upsert with ignoreDuplicates: true to avoid clobbering existing users"

key-files:
  created:
    - supabase/migrations/006_paper_sports_bets.sql
  modified:
    - api/settle-sports-bets.js
    - src/lib/initNewUser.js

key-decisions:
  - "Use result_resolved_at (not settled_at) as canonical column name for bet resolution timestamp"
  - "ignoreDuplicates: true on bankroll upsert ensures existing users are unaffected"
  - "Service-role key in settle-sports-bets cron bypasses RLS by design — intentional and correct"

patterns-established:
  - "Schema migration: ADD COLUMN IF NOT EXISTS for idempotent column additions"
  - "RLS policy: DROP POLICY IF EXISTS before CREATE POLICY for safe re-runs"

requirements-completed: [INTG-02]

# Metrics
duration: 1min
completed: 2026-03-11
---

# Phase 1 Plan 1: Paper Sports Bets Schema Foundation Summary

**Idempotent SQL migration adds 5 missing columns + RLS policy to paper_sports_bets, cron fixed to write result_resolved_at, new users auto-initialized with 100k bankroll**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-11T02:23:00Z
- **Completed:** 2026-03-11T02:23:58Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created migration 006 adding all 5 missing columns with ADD COLUMN IF NOT EXISTS (idempotent)
- Enabled RLS on paper_sports_bets with user-scoped policy (auth.uid() = user_id)
- Added composite index (user_id, created_at DESC) for Phase 2 history queries
- Fixed settle-sports-bets cron: `settled_at` → `result_resolved_at` (aligns with schema)
- initNewUser.js now upserts paper_sports_bankroll row so bet placement never silently fails

## Task Commits

Each task was committed atomically:

1. **Task 1: Create schema migration and enable RLS** - `deb665a` (feat)
2. **Task 2: Update cron to write result_resolved_at and add bankroll init** - `e472dd9` (feat)

**Plan metadata:** *(created with this summary commit)*

## Files Created/Modified
- `supabase/migrations/006_paper_sports_bets.sql` - Idempotent migration: 5 columns, RLS, composite index
- `api/settle-sports-bets.js` - Changed `settled_at` to `result_resolved_at` on bet resolution
- `src/lib/initNewUser.js` - Added paper_sports_bankroll upsert (balance 100000, ignoreDuplicates)

## Decisions Made
- `result_resolved_at` is the canonical column name (not `settled_at`) — this aligns the schema with what the cron was attempting to write
- `ignoreDuplicates: true` on bankroll upsert ensures existing users are untouched — only new users get initialized
- Service-role key in settle-sports-bets bypasses RLS intentionally (cron needs to settle all users' bets)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

After merging to main, run migration 006 against the Supabase project:

1. Go to Supabase dashboard > SQL Editor
2. Paste and run `supabase/migrations/006_paper_sports_bets.sql`
3. Verify: check paper_sports_bets columns include `result_resolved_at`, `potential_payout`, `parlay_id`
4. Verify: check RLS is enabled on paper_sports_bets (Table Editor > paper_sports_bets > RLS toggle = ON)

No new environment variables required.

## Next Phase Readiness
- Data layer is now correct and secure — Phase 2 can build BetHistoryTable reading from paper_sports_bets
- RLS guarantees users can only see their own rows (anon key is safe for client queries)
- Bankroll initialization means bet placement will never silently fail for new users
- Composite index makes Phase 2 history pagination queries efficient

---
*Phase: 01-foundation*
*Completed: 2026-03-11*
