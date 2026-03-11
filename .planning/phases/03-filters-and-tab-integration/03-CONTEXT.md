# Phase 3: Filters and Tab Integration - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning
**Source:** Carried from Phase 1/2 context (Stratify Build Skill)

<domain>
## Phase Boundary

Phase 3 adds filter controls (result + sport), column sorting, and wires the History tab into SportsOddsPage. After this phase, users can access bet history from the sportsbook and filter/sort their bets.

Phase 2 delivered: useBetHistory hook, BetHistorySummary stat strip, BetHistoryTab table component.

</domain>

<decisions>
## Implementation Decisions

### Surgical Mode (LOCKED)
- Only modify explicitly named files

### Design System (LOCKED)
- Background: `bg-[#0a0a0f]`
- Accent: `#10b981` emerald
- Positive: `text-emerald-400`, Negative: `text-red-400`, Pending: `text-gray-400`
- Prices/amounts: `font-mono font-medium`
- Import GLASS_CARD and DESIGN_COLORS from src/lib/sportsUtils.js

### No Badge/Pill Styling (LOCKED)
- Filter buttons must NOT use pill/badge styling
- Use plain text buttons or tab-style controls with layoutId indicator

### Tab Indicator (LOCKED)
- Use framer-motion layoutId="tab-indicator" for active tab slide
- Spring transition: stiffness 400, damping 30

### Motion (LOCKED)
- Spring presets for all transitions
- Dropdown entrance: initial opacity 0, y -8, scale 0.98
- Filter state changes should feel instant (no loading spinners)

### Client-Side Only (LOCKED)
- All filter/sort operations happen client-side from already-fetched data
- No server round-trips for filtering
- Stats must recompute when filters change

### Claude's Discretion
- Filter button layout (horizontal row vs dropdown)
- Sort indicator styling (arrow direction)
- How to wire tab into SportsOddsPage (activeTab state management)
- Whether filters live inside BetHistoryTab or as a sibling component

</decisions>

<specifics>
## Specific Ideas

- Filter buttons: All / Win / Loss / Pending as a horizontal row with layoutId indicator
- Sport filter: NFL / NBA / MLB / NHL as toggleable buttons
- Column sort: click header to sort, click again to reverse, small arrow indicator
- Tab integration: add "History" alongside existing sportsbook tabs
- Stat strip must recompute from filtered data (not all data)

</specifics>

<deferred>
## Deferred Ideas

- Date range filtering (v2)
- Team name search (v2)
- Win rate by sport breakdown (v2)

</deferred>

---
*Phase: 03-filters-and-tab-integration*
*Context gathered: 2026-03-11*
