# Roadmap: Sportsbook Bet History

## Overview

This roadmap delivers a complete bet history tab inside the existing sportsbook section. The work begins with schema and code quality prerequisites (the layer that makes history data trustworthy), then builds the display components that surface that data, and finishes with the filter controls and tab wiring that make the feature accessible. Each phase ships a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Verify schema correctness, extract shared payout utility, confirm cron resolution, lock design system
- [ ] **Phase 2: Bet History Display** - Build useBetHistory hook, BetHistorySummary stat strip, and BetHistoryTab table view
- [ ] **Phase 3: Filters and Tab Integration** - Add filter controls, column sorting, and wire the tab into SportsOddsPage

## Phase Details

### Phase 1: Foundation
**Goal**: The data layer and code foundation are correct before any UI is built — schema columns exist, RLS is enabled, payout math is deduplicated, and bet resolution runs reliably
**Depends on**: Nothing (first phase)
**Requirements**: INTG-02
**Success Criteria** (what must be TRUE):
  1. The paper_sports_bets table has all required columns: status, result_resolved_at, actual_payout, parlay_id (nullable), potential_payout — confirmed via Supabase dashboard or migration
  2. RLS is enabled on paper_sports_bets with a policy that restricts rows to the authenticated user's own bets — verified by querying with a second test account and receiving zero rows
  3. calcPayout exists in src/lib/sportsUtils.js and is imported by PaperBettingSlip.jsx and SportsOddsPage.jsx — no duplicate implementations remain
  4. The /api/settle-sports-bets cron is scheduled in vercel.json and confirmed to fire after major game windows — no bets can stay pending forever
**Plans**: TBD

Plans:
- [ ] 01-01: Schema audit and migration — verify/add all required columns, enable RLS, add composite index
- [ ] 01-02: Extract calcPayout to sportsUtils.js, confirm cron schedule, lock design tokens

### Phase 2: Bet History Display
**Goal**: Users can open a bet history view and see their complete bet log with correct P&L summary stats — every bet shows the right data in the right colors, and an empty state guides new users
**Depends on**: Phase 1
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, STAT-01, STAT-02
**Success Criteria** (what must be TRUE):
  1. User can view a table of all their bets with columns: date/time, matchup, sport, stake, odds/spread, payout, and result — rendered in reverse chronological order by default
  2. Won bets display in emerald text, lost bets in red, pending bets in muted gray — with no badge or pill elements wrapping any result value
  3. A stat strip above the table shows total wagered, total won, net P&L, and win rate — all computed from paper_sports_bets directly (not copied from bankroll table)
  4. A user with no bets sees an empty state with guidance to place their first bet — no blank table or error state
  5. All components use bg-[#0a0a0f], backdrop-blur-xl glass panels, border-white/10, and monospace for numeric values — visually indistinguishable from the rest of the dashboard
**Plans**: TBD

Plans:
- [ ] 02-01: Build useBetHistory hook — Supabase query, auth check, cancellable async, filter params
- [ ] 02-02: Build BetHistorySummary and BetHistoryTab — stat strip, table rows, result coloring, empty state

### Phase 3: Filters and Tab Integration
**Goal**: Users can narrow their bet history by result and sport, sort by any column, and access the feature from a tab on the sportsbook page
**Depends on**: Phase 2
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04, INTG-01
**Success Criteria** (what must be TRUE):
  1. User can click All / Win / Loss / Pending buttons to filter the bet list — the stat strip updates to reflect only the filtered bets
  2. User can select a sport filter (NFL / NBA / MLB / NHL) and see only bets from that sport — filters combine (sport + result simultaneously)
  3. User can click a column header (date, amount, result) to sort the table — clicking again reverses the sort direction
  4. All filter and sort operations apply without a server round-trip — the table updates instantly from the already-fetched dataset
  5. A "History" tab appears on the sportsbook page alongside the existing tabs — clicking it renders BetHistoryTab and the active tab state persists while the user stays on the page
**Plans**: TBD

Plans:
- [ ] 03-01: Add filter controls (result + sport) and column sort to BetHistoryTab
- [ ] 03-02: Add activeTab state and History tab to SportsOddsPage, wire BetHistoryTab render

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Bet History Display | 0/2 | Not started | - |
| 3. Filters and Tab Integration | 0/2 | Not started | - |
