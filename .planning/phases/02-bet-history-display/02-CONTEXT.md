# Phase 2: Bet History Display - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning
**Source:** Carried from Phase 1 CONTEXT.md (Stratify Build Skill)

<domain>
## Phase Boundary

Phase 2 delivers the useBetHistory hook, BetHistorySummary stat strip, and BetHistoryTab table view. Users can see their complete bet log with correct P&L summary stats. Every bet shows the right data in the right colors, and an empty state guides new users.

Phase 1 delivered: schema migration (run in Supabase), RLS, calcPayout in sportsUtils.js, design tokens (GLASS_CARD, DESIGN_COLORS).

</domain>

<decisions>
## Implementation Decisions

### Surgical Mode (LOCKED)
- Every change must be scoped to explicitly named files only
- Do NOT modify any file not explicitly listed

### Design System (LOCKED — from Phase 1 CONTEXT.md)
- Background: `bg-[#0a0a0f]` always
- Accent: `#10b981` emerald only
- Positive/Win: `text-emerald-400`
- Negative/Loss: `text-red-400`
- Pending: `text-gray-400`
- Muted: `text-gray-500`
- Prices/amounts: `font-mono font-medium`
- Headers: `font-semibold tracking-tight`
- Section labels: `text-xs font-semibold tracking-widest text-gray-500 uppercase`

### Glass Card System (LOCKED)
- Import `GLASS_CARD` and `DESIGN_COLORS` from `src/lib/sportsUtils.js` (created in Phase 1)
- Standard Card: `bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06]` + layered shadows
- Inset Field: `bg-black/40 rounded-xl` + inset shadows

### No Badge/Pill Styling (LOCKED)
- Win/Loss/Pending must be plain colored text only
- WRONG: `<span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Win</span>`
- RIGHT: `<span className="text-emerald-400 text-sm font-medium">Win</span>`

### No Icon Boxes (LOCKED)
- Icons are bare SVG with color class only — no background containers

### Motion System (LOCKED)
- Spring presets: snappy (stiffness: 400, damping: 30)
- Hover lift on cards: `whileHover={{ y: -2 }}`
- Staggered list entrance: staggerChildren 0.04
- Page transitions: opacity + y with spring
- Use `framer-motion` for all animations

### Data Layer (LOCKED)
- Aggregate stats from `paper_sports_bets` directly — NOT from `paper_sports_bankroll`
- Use Supabase client directly (no serverless wrapper for reads)
- On-demand fetch on component mount — no polling, no realtime subscription for history
- Client-side filtering/sorting — fetch all user bets once

### Result Colors (LOCKED)
- Win: `text-emerald-400`
- Loss: `text-red-400`
- Pending: `text-gray-400`
- Plain text only — no badges, pills, or background highlights

### Claude's Discretion
- Hook API design (params, return shape)
- Component file structure and naming
- Table column widths and responsive behavior
- Empty state copy and layout
- Stat strip layout (horizontal vs grid)
- Loading state design

</decisions>

<specifics>
## Specific Ideas

- Use `calcPayout` from `src/lib/sportsUtils.js` for any payout calculations
- Import `GLASS_CARD` and `DESIGN_COLORS` constants from sportsUtils.js
- All numeric values (amounts, odds, percentages) must use `font-mono font-medium`
- CountUp for animated stat values (library already installed)
- Stagger row entrance with framer-motion
- Table rows should have subtle hover state: `whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}`

</specifics>

<deferred>
## Deferred Ideas

- Filter controls (Phase 3)
- Tab integration into SportsOddsPage (Phase 3)
- Sort by column header (Phase 3)
- Date range filtering (v2)
- Win rate by sport breakdown (v2)

</deferred>

---
*Phase: 02-bet-history-display*
*Context gathered: 2026-03-11 via Phase 1 build skill carryover*
