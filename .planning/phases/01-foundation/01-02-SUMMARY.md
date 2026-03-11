---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [react, sports, utilities, design-tokens, tailwind]

# Dependency graph
requires: []
provides:
  - "src/lib/sportsUtils.js — canonical calcPayout export (single source of truth)"
  - "GLASS_CARD and DESIGN_COLORS design token exports for Phase 2 UI components"
  - "SportsOddsPage.jsx imports calcPayout from sportsUtils (no local definition)"
  - "PaperBettingSlip.jsx imports calcPayout from sportsUtils (no local definition)"
affects: [phase 02 sports UI components, any future file using payout math or glass card styles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared utility file with zero project imports to prevent circular dependency chains"
    - "Design token constants exported from a single file — import instead of copy-paste"

key-files:
  created:
    - src/lib/sportsUtils.js
  modified:
    - src/pages/SportsOddsPage.jsx
    - src/components/dashboard/PaperBettingSlip.jsx

key-decisions:
  - "calcPayout defined once in sportsUtils.js — both callers import, no local copies"
  - "sportsUtils.js has zero import statements to guarantee no circular dependency risk (CLAUDE.md rule #3)"
  - "GLASS_CARD and DESIGN_COLORS locked to CONTEXT.md values — Phase 2 components must import, not copy"

patterns-established:
  - "Pure utility pattern: sportsUtils.js has no imports, exports only pure functions and constants"
  - "Design token import pattern: GLASS_CARD.standard / GLASS_CARD.active / etc from sportsUtils"

requirements-completed: [INTG-02]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 1 Plan 2: sportsUtils.js Summary

**Single-source calcPayout extracted to src/lib/sportsUtils.js with locked GLASS_CARD and DESIGN_COLORS design tokens for Phase 2 reuse**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T02:23:00Z
- **Completed:** 2026-03-11T02:24:12Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 updated)

## Accomplishments
- Created `src/lib/sportsUtils.js` as a zero-import pure utility file
- Eliminated duplicated `calcPayout` — was defined locally in both SportsOddsPage.jsx and PaperBettingSlip.jsx
- Exported GLASS_CARD and DESIGN_COLORS constants with exact locked values from CONTEXT.md for Phase 2

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sportsUtils.js with calcPayout and design constants** - `de7ef24` (feat)
2. **Task 2: Replace local calcPayout in both calling files** - `c0d7446` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/lib/sportsUtils.js` - Canonical calcPayout, DESIGN_COLORS, GLASS_CARD exports — zero project imports
- `src/pages/SportsOddsPage.jsx` - Removed local calcPayout definition, added import from sportsUtils
- `src/components/dashboard/PaperBettingSlip.jsx` - Removed local calcPayout definition, added import from sportsUtils

## Decisions Made
- sportsUtils.js contains zero `import` statements — this is intentional to make it safe from circular dependency chains (CLAUDE.md rule #3 precedent)
- Design tokens locked to exact CONTEXT.md values — Phase 2 components must import from sportsUtils, not copy-paste the class strings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- calcPayout single source of truth is established — Phase 2 UI components will use it without risk of math divergence
- GLASS_CARD and DESIGN_COLORS are importable — Phase 2 components can use `GLASS_CARD.standard` etc. for consistent styling
- No blockers for Phase 2

---
*Phase: 01-foundation*
*Completed: 2026-03-11*

## Self-Check: PASSED

- src/lib/sportsUtils.js: FOUND
- src/pages/SportsOddsPage.jsx: FOUND (imports from sportsUtils, no local definition)
- src/components/dashboard/PaperBettingSlip.jsx: FOUND (imports from sportsUtils, no local definition)
- .planning/phases/01-foundation/01-02-SUMMARY.md: FOUND
- Commit de7ef24: FOUND
- Commit c0d7446: FOUND
