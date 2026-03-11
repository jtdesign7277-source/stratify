# Project Research Summary

**Project:** Sportsbook Bet History Tracking
**Domain:** Paper/simulated sportsbook history, filtering, and P&L analytics within an existing React + Supabase trading platform
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

Bet history tracking for Stratify's paper sportsbook is a well-scoped, low-dependency addition to an already-working system. The `paper_sports_bets` table exists, bet placement already writes to it, and the `paper_sports_bankroll` table maintains running aggregates. The work is primarily: (1) a schema audit to add any missing columns before building UI, (2) a new `useBetHistory` hook and two new components (`BetHistoryTab`, `BetHistorySummary`), and (3) a tab integration inside `SportsOddsPage`. No new routes, no new sidebar entries, no new major dependencies — only `date-fns` needs to be added.

The recommended approach is to treat schema correctness as a hard prerequisite and build the UI layer only after it is locked. Four schema concerns must be resolved before any display code is written: the `parlay_id` nullable column (to prevent win/loss record corruption from the existing parlay toggle), the `result_resolved_at` timestamp, RLS policies on `paper_sports_bets`, and clarity on whether `actual_payout` is already stored. The existing settlement endpoint (`/api/settle-sports-bets`) handles bet resolution — the history feature does not need to build a new resolution mechanism, only to verify it runs on schedule.

The highest-risk item is result resolution: bets that stay `pending` forever make the entire history feature worthless. This is already partially handled by the existing Vercel cron + settle endpoint, but its schedule and reliability must be confirmed early. The second key risk is P&L stat divergence — the history summary must aggregate directly from `paper_sports_bets`, not copy from `paper_sports_bankroll`, to avoid permanent inconsistencies after edge cases (pushes, voids). Both risks are fully avoidable with upfront schema and data-flow decisions.

## Key Findings

### Recommended Stack

The entire feature is buildable with zero net new major dependencies. The project already has `@supabase/supabase-js`, React 19, TailwindCSS v4, and `lucide-react`. Only `date-fns@^4.1.0` is justified as a new install, solely for timestamp formatting and date-range boundary computation. All filter/sort logic should be pushed into Supabase query params (`.eq()`, `.gte()`, `.lte()`, `.order()`) rather than client-side array operations, to keep pagination correct as history grows.

**Core technologies:**
- `@supabase/supabase-js` (^2.95.3, already installed): Bet fetch, filter queries, and `postgres_changes` realtime for future live updates — anon key + RLS enforces user isolation
- React `useState` / `useMemo` (React 19, already installed): Filter state and derived stats in `BetHistoryTab`; hook pattern matches existing `SportsBankroll`
- TailwindCSS v4 (already installed): All table styling follows existing `DataTable.jsx` patterns — emerald/red/gray for win/loss/pending
- `date-fns@^4.1.0` (new install): Timestamp formatting and preset date-range boundary calculation — ESM-native, no CJS issues

**What not to install:**
- `@tanstack/react-table` — 47 KB for ~5 columns with client-side data; `useMemo` + native array sort is sufficient and matches the existing codebase pattern
- `moment.js` — deprecated; `date-fns` is the correct choice
- Any external UI component library — would break the Stratify dark terminal design system

### Expected Features

The competitor analysis confirms a clear opportunity: DraftKings and FanDuel both bury their history behind multiple navigation steps and provide no sport-level P&L breakdown. A dedicated tab with always-visible stats is already better than incumbents without building anything exotic.

**Must have (table stakes — P1):**
- Reverse-chronological bet list with columns: Date/time, Matchup, Sport, Stake, Odds, Payout, Result status
- Summary P&L header: Total wagered, Total won, Net P&L, Win rate — always visible above the table
- Result status coloring: emerald (Win), red (Loss), gray (Pending)
- Filter by result (All / Win / Loss / Pending) and by sport
- Sort by date (default desc), amount, result
- Auto-logged bets — bets written to Supabase at placement (already done)
- Result resolution via existing Vercel cron + settle endpoint
- Empty state with CTA linking to odds view

**Should have (competitive — P2):**
- Filter by date range with presets (Today / 7d / 30d / All Time)
- Win rate and ROI breakdown by sport
- Filter by team name (client-side string match on matchup field)
- Net P&L trend indicator vs prior period

**Defer (v2+):**
- Parlay display — schema must support it from day one (nullable `parlay_id`), but rendering is deferred
- CSV export
- Streak tracking
- Closing line value (CLV) tracking

### Architecture Approach

`BetHistoryTab` lives inside `SportsOddsPage` as a tab (not a new route), toggled by an `activeTab` state variable. It is self-contained — the parent passes no props other than visibility. A `useBetHistory` hook owns all data fetching with filter params passed in; filters live as state in `BetHistoryTab` and are passed to the hook, which converts them to Supabase query modifiers. `BetHistorySummary` reads aggregate stats directly from `paper_sports_bankroll` (already populated by the placement flow) for running totals, and may supplement with a direct aggregate query from `paper_sports_bets` for filtered stats that need to reflect the current filter state.

**Major components:**
1. `useBetHistory` hook — all Supabase query logic, filter/sort/pagination params, cancellable async pattern; no JSX
2. `BetHistoryTab` — owns filter state, renders filter controls and table rows, composes hook; lives in `src/components/dashboard/`
3. `BetHistorySummary` — stat strip (wagered / won / net / win rate); reads from `paper_sports_bankroll` for aggregate stats; rendered at top of `BetHistoryTab`

**Build order (dependency-enforced):**
1. Schema audit and column additions
2. `useBetHistory` hook (pure data layer, testable without UI)
3. `BetHistorySummary` (reads existing `paper_sports_bankroll` — no hook dependency)
4. `BetHistoryTab` (composes hook + summary + table rows)
5. Tab integration in `SportsOddsPage`
6. Filter controls (added incrementally inside `BetHistoryTab`)

### Critical Pitfalls

1. **No result resolution path — bets stay pending forever.** The existing `/api/settle-sports-bets` endpoint handles this. Verify it is scheduled as a Vercel cron and runs reliably after game windows. Schema must have `status`, `result_resolved_at`, and `actual_payout` columns before any UI ships. Without resolution, the entire history feature is decorative.

2. **P&L stats diverge from bankroll table.** Do not read summary stats from `paper_sports_bankroll` for the history tab's filtered view — aggregate directly from `paper_sports_bets` using SQL aggregates (`COUNT(*) FILTER (WHERE status='won')`, `SUM(stake)`). The bankroll table is authoritative only for the live balance display in `SportsBankroll`.

3. **Missing RLS on `paper_sports_bets`.** Supabase tables have RLS disabled by default. Enable RLS and add `USING (auth.uid() = user_id)` in the same migration that creates/audits the table. Verify both the toggle is ON and the policy exists — either alone is insufficient. Test with a second user account in incognito.

4. **Parlay bets counted as independent rows corrupt win rate.** The parlay toggle in `PaperBettingSlip` exists and can place multi-leg bets. Without a nullable `parlay_id` column, each leg is an independent row and win rate becomes permanently wrong (e.g., 3-leg parlay loss shows as 2W-1L). Add the column in Phase 1 even if parlay rendering is deferred to v2.

5. **Payout math duplicated across three files.** `calcPayout` exists in both `PaperBettingSlip.jsx` and `SportsOddsPage.jsx`. A third copy in the history display will diverge. Extract to `src/lib/sportsUtils.js` before building history rows. History must display stored `potential_payout` (for pending) and `actual_payout` (for settled) — never recompute from odds on render.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Schema Audit and Data Foundation

**Rationale:** Every other phase depends on schema correctness. The pitfalls with highest recovery cost (parlay corruption, missing RLS, pending-forever bets) are all schema decisions. This phase has zero UI and is fast — most columns may already exist.

**Delivers:** Verified `paper_sports_bets` schema with all required columns; RLS enabled; `parlay_id` nullable column added; composite index `(user_id, created_at DESC)` confirmed or added; shared `calcPayout` extracted to `src/lib/sportsUtils.js`; Vercel cron schedule for `/api/settle-sports-bets` confirmed.

**Addresses:** Table stakes — auto-logged bets, result resolution, result status accuracy.

**Avoids:** Pitfalls 1 (no resolution path), 2 (stat divergence), 3 (missing RLS), 4 (parlay corruption), 5 (payout math duplication).

**Schema columns to verify/add:** `status` (pending/won/lost/push), `result_resolved_at` (timestamptz), `actual_payout` (numeric), `parlay_id` (uuid nullable), `settled_at` (timestamptz nullable). Confirm `potential_payout` is stored at placement.

### Phase 2: Data Layer — useBetHistory Hook

**Rationale:** Build and verify the data layer before any UI to avoid debugging data bugs through JSX. The hook is independently testable and fully decoupled from rendering concerns.

**Delivers:** `useBetHistory(filters)` hook returning `{ bets, total, loading }`. Filter params applied as Supabase query modifiers (not client-side). Cancellable async pattern with cleanup. Pagination via `.range()`. Auth session check before every query.

**Uses:** `@supabase/supabase-js`, direct browser client (anon key + RLS), `date-fns` for date boundary computation.

**Implements:** Pattern 1 from ARCHITECTURE.md — direct Supabase client queries.

**Avoids:** Anti-patterns from ARCHITECTURE.md — no client-side filtering of all rows, no polling, no separate stats aggregation query.

### Phase 3: History UI — BetHistorySummary and BetHistoryTab

**Rationale:** With the data layer proven, UI assembly is straightforward. Build summary stats first (reads from existing `paper_sports_bankroll`, no hook dependency), then the full tab that composes hook + summary + table rows.

**Delivers:** `BetHistorySummary` stat strip (Total wagered, Total won, Net P&L, Win rate). `BetHistoryTab` with reverse-chronological bet list, result coloring, empty state. Columns: Date/time, Matchup, Sport, Stake, Odds, Payout, Result.

**Uses:** TailwindCSS v4, `lucide-react` icons (`Trophy`, `X`, `ChevronDown`, `ChevronUp`), `date-fns` for timestamp display.

**Addresses:** All P1 table-stakes display features from FEATURES.md.

**Avoids:** UX pitfalls — row-level result coloring (not just status cell), `actual_payout` vs `potential_payout` label distinction, empty state with CTA.

### Phase 4: Filter Controls and Tab Integration

**Rationale:** Filter controls are additive to the existing `BetHistoryTab` and can be built incrementally. Tab integration into `SportsOddsPage` is the final wiring step — kept last so the full `BetHistoryTab` is complete before it is surfaced in the page.

**Delivers:** Filter controls for result (All/Win/Loss/Pending) and sport inside `BetHistoryTab`. Filter state lifted to parent or stored in URL query params to survive tab switches (Pitfall 6 prevention). `activeTab` state added to `SportsOddsPage` with tab bar UI. Conditional render of `BetHistoryTab` when `activeTab === 'history'`.

**Addresses:** P1 filter requirements; filter state persistence.

**Avoids:** Pitfall 6 (filter state not persisted on tab switch) — use URL params or lift state to `SportsOddsPage`.

### Phase 5: P2 Enhancements — Date Range, Sport Breakdown, Team Search

**Rationale:** These features add analytical value but require the core history to be stable and populated with real bets. Win rate and ROI by sport is only meaningful once users have 10+ bets. Build after P1 is validated.

**Delivers:** Date range preset filters (Today / 7d / 30d / All Time) using `date-fns` boundaries. Win rate + ROI stat row per sport. Client-side team name search (string match on matchup field). Net P&L delta vs prior period.

**Addresses:** P2 features from FEATURES.md differentiators section.

**Research flag:** Standard patterns — no additional research needed. All patterns are established in Phase 2–4.

### Phase Ordering Rationale

- Schema must be locked before any UI ships — pitfalls 1-4 are permanent if the schema is wrong at launch.
- The hook is built before JSX to enable isolated testing and to verify the Supabase query behavior (filters, pagination, auth) without visual noise.
- `BetHistorySummary` is separated from `BetHistoryTab` because it reads from a different source (`paper_sports_bankroll`) and can be built without the hook being complete.
- Filter integration is last because filters require the table to be rendering correctly first — adding filter controls to a broken table creates confounding debugging complexity.
- P2 enhancements are gated behind user validation because the differentiators (sport breakdown, ROI) only have value after users accumulate meaningful bet history.

### Research Flags

Phases needing no additional research (standard patterns, well-documented):
- **Phase 1:** Supabase schema migration via dashboard SQL editor, RLS policy syntax, and composite index creation are thoroughly documented.
- **Phase 2:** `useBetHistory` follows the exact `useEffect` + cancellable async pattern already used in `SportsBankroll`. Supabase filter query params are stable API.
- **Phase 3:** Tailwind table layout and result row coloring follows existing `DataTable.jsx` — no novel patterns.
- **Phase 4:** Tab state management with `useState` and URL query params is standard React.
- **Phase 5:** `date-fns` date arithmetic and client-side string filtering are straightforward.

No phases require a `/gsd:research-phase` call. All patterns are verified against the existing codebase or against HIGH-confidence official documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in use in the project; `date-fns` v4 is stable ESM-native release; no speculative choices |
| Features | HIGH (core), MEDIUM (differentiators) | Core features derived from direct competitor analysis and established sportsbook UX patterns; differentiator priority based on bettor research but not validated against actual Stratify users |
| Architecture | HIGH | Based on direct codebase inspection of `SportsOddsPage.jsx`, `SportsBankroll.jsx`, `PaperBettingSlip.jsx`, and `api/settle-sports-bets.js` — not inference |
| Pitfalls | HIGH | Derived from direct code inspection; parlay corruption and payout duplication are confirmed live issues in the codebase, not hypothetical risks |

**Overall confidence:** HIGH

### Gaps to Address

- **Vercel cron schedule for `/api/settle-sports-bets`:** Research confirmed the endpoint exists and works, but its actual cron schedule in `vercel.json` was not verified. Confirm before Phase 1 closes that the cron fires reliably after major game windows (Sunday night NFL, weeknight NBA). If not scheduled, schedule it before the history feature ships — otherwise bets never resolve.

- **`actual_payout` column presence:** Research identified that `actual_payout` should be stored by the settlement endpoint. Direct confirmation of its presence in the live `paper_sports_bets` schema should be the first act of Phase 1 — determines whether a migration is needed or just a column addition.

- **`paper_sports_bankroll` row initialization for new users:** `initNewUser.js` may or may not create the bankroll row. If it doesn't, `BetHistorySummary` will crash or show stale fallback values. Verify and fix in Phase 1 if needed.

- **Win rate denominator convention:** Research recommends excluding pending bets from the win rate denominator (3W 2L 10P = 60%, not 20%). This must be a conscious decision locked in Phase 1 — it affects both `BetHistorySummary` and the `paper_sports_bankroll.win_rate` column if it pre-computes this value.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/pages/SportsOddsPage.jsx` — confirmed bet placement flow, `paper_sports_bets` insert, bankroll debit
- Direct codebase inspection: `src/components/dashboard/SportsBankroll.jsx` — confirmed realtime channel pattern, `paper_sports_bankroll` columns
- Direct codebase inspection: `src/components/dashboard/PaperBettingSlip.jsx` — confirmed `calcPayout` duplication, parlay toggle
- Direct codebase inspection: `api/settle-sports-bets.js` — confirmed `paper_sports_bets` schema columns, settlement logic, Discord webhook
- Direct codebase inspection: `api/paper-history.js` — confirmed server-side pagination and auth pattern for history endpoints
- [Supabase Realtime: Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — `postgres_changes` channel API
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.uid())` policy pattern
- [date-fns npm](https://www.npmjs.com/package/date-fns) — v4.1.0 confirmed, ESM-native
- `package.json` in project root — confirmed installed versions of all dependencies

### Secondary (MEDIUM confidence)

- [Action Network: Finding All-Time Profits at Sportsbooks](https://www.actionnetwork.com/education/the-hidden-ways-to-find-your-all-time-profits-losses-at-a-sportsbook) — competitor UX gaps analysis
- [Boyd's Bets: How to Track Sports Bets](https://www.boydsbets.com/tracking-sports-bets/) — bettor workflow patterns
- [Shape Games: UX Best Practices Playbook 2025](https://www.shapegames.com/news/ux-best-practices-playbook) — sportsbook UX conventions
- [BettorEdge: Top Bet Tracking Apps](https://www.bettoredge.com/post/top-bet-tracking-apps) — third-party tracker feature sets

### Tertiary (LOW confidence)

- General sportsbook UX conventions for win rate denominator and streak display — consistent across multiple sources but not formally specified

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
