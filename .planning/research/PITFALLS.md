# Pitfalls Research

**Domain:** Bet history tracking — paper/simulated sportsbook within an existing React + Supabase trading platform
**Researched:** 2026-03-10
**Confidence:** HIGH (derived from direct codebase inspection + domain patterns)

---

## Critical Pitfalls

### Pitfall 1: No Result Resolution Path — Bets Stay "Pending" Forever

**What goes wrong:**
`paper_sports_bets` rows are inserted with `status: 'pending'` on bet placement (confirmed in `SportsOddsPage.jsx:1146`). There is currently no mechanism that transitions bets to `won`, `lost`, or `push`. The history tab will show an ever-growing list of pending bets with no P&L meaning. Win/loss record in `SportsBankroll` will never change from its initial state.

**Why it happens:**
Bet placement is the easy part — it's a single `INSERT`. Result resolution requires a second trigger: either a scheduled job that checks game scores against stored bets, or a manual "settle" action. Teams defer this because it requires an external scores API or a game-result source that doesn't exist in the current stack.

**How to avoid:**
Decide the resolution strategy in Phase 1 (schema) before writing any history UI. Options in priority order:
1. **Manual admin settle** — add a `settled_at` timestamp column and a Vercel cron or manual trigger that calls a scores API (e.g. The Odds API `/scores` endpoint) and updates rows via a serverless function.
2. **Supabase Edge Function** on a schedule — queries scores and calls `.update({ status, actual_payout })` with RLS bypassed via service role.
3. **User-triggered settle** — a "Check results" button that hits a serverless function; acceptable for paper/simulated context.

The schema must include `status` (pending/won/lost/push), `result_resolved_at`, and `actual_payout` columns from the start, or history P&L will be permanently wrong.

**Warning signs:**
- `status` column only ever shows `'pending'` in Supabase table viewer after games have ended.
- `SportsBankroll.wins` and `SportsBankroll.losses` are both `0` after days of bets.
- P&L summary on history tab shows $0 won / $0 lost.

**Phase to address:** Schema design phase (before any history UI is built).

---

### Pitfall 2: P&L Stats Diverge from Bankroll Table

**What goes wrong:**
`SportsBankroll.jsx` derives wins/losses/balance from `paper_sports_bankroll`. The history tab needs to show total wagered, total won, total lost, and win rate computed from `paper_sports_bets`. If these are computed independently from different sources, the numbers will disagree — especially after any database migration, manual correction, or edge case (e.g., a push bet where stake is refunded).

The existing bet placement code in `SportsOddsPage.jsx:1147–1153` updates `balance` and `total_wagered` on `paper_sports_bankroll` but does not update `wins`, `losses`, or any won/paid columns. Those only change when a bet is settled.

**Why it happens:**
Stats are easy to compute from the history table directly (aggregate query), but there's a temptation to read from the `paper_sports_bankroll` summary table for speed. These two sources become inconsistent the moment any edge case occurs (push, void, partial resolution).

**How to avoid:**
Make the history tab's summary stats a direct aggregate over `paper_sports_bets` rows for the authenticated user:
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'won') AS wins,
  COUNT(*) FILTER (WHERE status = 'lost') AS losses,
  SUM(stake) AS total_wagered,
  SUM(actual_payout) FILTER (WHERE status = 'won') AS total_won
FROM paper_sports_bets
WHERE user_id = $1;
```
The `paper_sports_bankroll` table is the source of truth for the live bankroll balance only. Summary stats for the history tab come from aggregating `paper_sports_bets` directly, so they are always in sync by definition.

**Warning signs:**
- Bankroll card shows "W: 3 L: 2" but history summary shows "W: 4 L: 1".
- Total wagered in the history tab doesn't match `total_wagered` in `paper_sports_bankroll`.
- Win rate shown at the top of the history tab differs from `SportsBankroll` win rate.

**Phase to address:** Schema + API design phase. Lock down which table owns which stat before building any UI that reads stats.

---

### Pitfall 3: Missing Row-Level Security Lets Users Query Each Other's Bet History

**What goes wrong:**
`paper_sports_bets` is inserted with a `user_id` column but if RLS is not enabled (or the policy is misconfigured), a simple `.from('paper_sports_bets').select('*')` from the browser client returns all users' bets. This is a data privacy failure even in a paper/simulated context because it exposes betting behavior, stake sizes, and betting patterns of all users.

**Why it happens:**
Supabase tables created via the dashboard have RLS disabled by default. The `paper_sports_bankroll` table already follows the pattern `.eq('user_id', session.user.id)` in queries, but that is client-side filtering — it does not prevent a modified client from dropping the `.eq()` filter.

**How to avoid:**
Enable RLS on both `paper_sports_bets` and `paper_sports_bankroll` with a policy:
```sql
CREATE POLICY "Users can only access their own bets"
ON paper_sports_bets
FOR ALL
USING (auth.uid() = user_id);
```
Verify in the Supabase dashboard that RLS is ON (not just that a policy exists). Test with a second user account in incognito to confirm cross-user queries return empty.

**Warning signs:**
- Supabase dashboard shows RLS as "Disabled" on the table row.
- A `.from('paper_sports_bets').select('*')` without `.eq('user_id', ...)` returns all rows.
- The history tab briefly shows another user's bets during development.

**Phase to address:** Schema phase. Add RLS policies in the same migration that creates the table — never as an afterthought.

---

### Pitfall 4: Payout Math Duplicated and Diverges Between Placement and History Display

**What goes wrong:**
`calcPayout(stake, odds)` is defined twice: once in `PaperBettingSlip.jsx` and again in `SportsOddsPage.jsx`. If the history display introduces a third copy (or uses a different formula), displayed payout in the history view will not match what was shown at placement time, creating user confusion ("I was shown $150 payout but history shows $148").

The schema already stores `potential_payout` as a computed value at placement time, which is good — but this only matters if history reads `potential_payout` from the DB rather than recomputing it from `odds` and `stake`. Teams frequently forget the stored value is there and recompute on render.

**Why it happens:**
Developers building the history view see `odds` and `stake` columns and naturally compute payout inline, not realizing a stored `potential_payout` exists.

**How to avoid:**
- Add `actual_payout` (the payout actually received after settlement) to the schema alongside `potential_payout`.
- History rows display `actual_payout` for settled bets and `potential_payout` for pending.
- Never recompute payout in the history display — always read from the stored column.
- Extract `calcPayout` into a shared utility (`src/lib/sportsUtils.js`) immediately. Kill the two existing duplicates.

**Warning signs:**
- Payout figures in history tab are slightly different from the "Payout:" line shown in `PaperBettingSlip` at placement time.
- Three or more files contain a `calcPayout` or `computePayout` function.
- American odds edge cases (`-110`, `+100`, `+101`) show different results across components.

**Phase to address:** Phase that implements history display. Extract shared utility before wiring up the table rows.

---

### Pitfall 5: Parlay Bets Stored as Individual Rows Without a Parlay Link

**What goes wrong:**
The current `handlePlaceBets` in `SportsOddsPage.jsx` calls `supabase.from('paper_sports_bets').insert(betsToInsert)` which inserts every slip item as a separate independent row — even when the parlay toggle is on. There is no `parlay_id` or `is_parlay` column in the schema. A parlay is only a win if ALL legs hit; if legs are stored independently and settled individually, a 3-leg parlay where 2 legs win and 1 loses will be incorrectly counted as "2 wins, 1 loss" instead of "1 parlay loss."

**Why it happens:**
Parlay support is partially built in `PaperBettingSlip` (the toggle exists) but the database schema wasn't designed to express parlay relationships. This is a place where UI complexity got ahead of data model design.

**Why this matters for v1 scope:** The PROJECT.md states "Parlay or exotic bet types for v1 — straight bets only" is out of scope. This pitfall exists in the codebase today and will silently corrupt win/loss records if the parlay toggle is used. Even if parlay history display is deferred, the schema needs a `parlay_id` (nullable UUID) column so parlay bets placed today don't corrupt future counts.

**How to avoid:**
- Add nullable `parlay_id` column to `paper_sports_bets`.
- When parlay mode is active, generate one UUID and stamp all slip items with the same `parlay_id`.
- History query groups by `parlay_id IS NULL` (straight bets) vs grouped parlay legs.
- Win rate calculation must exclude individual parlay legs and count each parlay as one record.

**Warning signs:**
- Win rate is inflated: a user with 3 parlay losses shows as 6W-3L instead of 0W-3L.
- `paper_sports_bets` has no `parlay_id` or `is_parlay` column after the schema is created.
- The slip's parlay toggle places bets with no linking metadata in the inserted rows.

**Phase to address:** Schema phase. Add the column even if parlay result logic is deferred.

---

### Pitfall 6: Filter/Sort State Not Persisted Causes Context-Switching Frustration

**What goes wrong:**
Users navigate away from the history tab (e.g., check live odds to compare), then return and find all filters reset to defaults. In a bet history with 50+ entries across multiple sports, having to re-apply "NBA, last 30 days, losses only" on every visit degrades the experience severely.

**Why it happens:**
Filter state is held in local `useState` in the history component. Unmounting (tab switch) destroys it. This is standard React behavior that developers don't account for because during development there's rarely enough data to feel the pain.

**How to avoid:**
- Store filter state in the URL query string (`?sport=nba&result=loss&range=30d`) using React Router search params or a simple `URLSearchParams` pattern. This is consistent with how the existing `SportsOddsPage` uses navigation keys like `basketball_nba`.
- Alternatively, lift filter state to the parent `SportsOddsPage` component so it survives tab switches without URL involvement.
- Sort state (column + direction) can live in `sessionStorage` — cheaper than URL but survives tab switches.

**Warning signs:**
- Filters reset every time the user clicks away and returns to history.
- Every QA session starts with "I had to set filters again."
- The `useEffect` that loads bets fires on every mount because filter deps reset.

**Phase to address:** History UI phase, before the filter controls are built.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Computing P&L stats from `paper_sports_bankroll` summary table instead of aggregating `paper_sports_bets` | Simpler query, no aggregation | Numbers diverge from history after any settle edge case | Never — always aggregate from the source rows |
| Leaving `calcPayout` duplicated across files | No refactor work needed | Payout rounding diverges silently between slip and history | Never — extract to `src/lib/sportsUtils.js` immediately |
| No `parlay_id` column in v1 schema | Simpler schema | Win/loss records permanently corrupted if parlay toggle is ever used | Never — nullable column costs nothing |
| Using `.select('*')` without RLS on `paper_sports_bets` | No RLS setup time | Any user can query all users' bets | Never |
| Skipping `result_resolved_at` timestamp on settle | One less column | Cannot show users "results last updated X min ago" or debug stale settlements | MVP acceptable only if manual settle is the only path |
| Hardcoding `pending` filter in history query to hide unfilled bets | Prevents empty states | Hides data bugs — bets that should be settled appear normal | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Realtime on `paper_sports_bets` | Subscribing to ALL events for all users; forgetting the `filter` param | Always pass `filter: 'user_id=eq.{userId}'` in `postgres_changes` config — same pattern used in `SportsBankroll.jsx:38` |
| Supabase `.from().select()` with filters | Client-side `.eq()` as the only protection | Enforce at the DB level with RLS policies; client filter is UX-only |
| Supabase aggregate queries | Running `COUNT(*)` and `SUM()` in React via JS array reduce on a full table fetch | Use a Supabase RPC (Postgres function) or a view for aggregates — never fetch all rows just to compute stats in the browser |
| `paper_sports_bankroll` upsert on new user | Missing row causes silent failures in `PaperBettingSlip` (bankroll shows $100,000 fallback) | Initialize the bankroll row in the same flow used to init other paper accounts — see `src/lib/initNewUser.js` |
| DateFilter with Supabase `.gte()` / `.lte()` | Comparing date strings to UTC timestamps causes off-by-one errors at midnight | Store `placed_at` as UTC timestamptz; filter with `.gte(startOfDayUTC).lte(endOfDayUTC)` — never compare date-only strings |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all bets then filtering in React | History tab hangs on initial load as data grows | Apply sport/result/date filters as Supabase query params (`.eq()`, `.gte()`, `.in()`) before fetching | ~500+ bets per user |
| Re-fetching full history on every tab focus | Noticeable delay switching between odds and history tabs | Cache with a stale-while-revalidate pattern (`useRef` for last fetch time, skip if < 30s old) or use Supabase Realtime `INSERT` events to append new rows | Any user with >20 bets and frequent tab switching |
| Rendering all history rows without virtualization | Scroll jank / memory growth | Use windowed rendering (react-window or native `overflow-y: auto` with `content-visibility: auto`) for lists > 100 rows | ~200+ rows in the DOM |
| Running aggregation queries on every render | Multiple extra Supabase round-trips per history view | Compute summary stats in one aggregation query on load; update incrementally when a bet status changes | Visible immediately in network tab even at 10 bets |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS disabled on `paper_sports_bets` | Any authenticated user can read all users' bets via browser console | Enable RLS + `USING (auth.uid() = user_id)` policy before the table is used in production |
| `user_id` set client-side and trusted | User spoofs another user's `user_id` in the insert payload | Set `user_id` via `auth.uid()` in a Supabase RLS policy (`WITH CHECK (auth.uid() = user_id)`) — the client value is ignored if policy enforces the authenticated UID |
| Bankroll update without checking current balance server-side | Race condition: user opens two tabs, places bets simultaneously, overdrafts paper bankroll | Use a Postgres function (RPC) to atomically check balance and deduct stake in a single transaction |
| Exposing all bet fields in `.select('*')` | Overfetching — potential for future sensitive fields to leak | Select only the columns the UI actually needs |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Pending bets with no "expected resolution" context | Users don't know if a bet is pending because the game hasn't started, is in progress, or is a data bug | Show game status alongside bet status — "PENDING · Game starts 7:30 PM ET" vs "PENDING · In progress" vs "PENDING · Game ended — awaiting settlement" |
| Win/loss coloring only on the `status` column | Users scan for P&L at a glance; if only one cell is colored, they miss wins/losses | Color the entire row (subtle background tint) — emerald for wins, red for losses, gray for pending. Consistent with how `DataTable.jsx` handles positive/negative trade rows |
| Showing `potential_payout` for won bets | A won bet's actual payout may differ from potential if there was a line change or push leg | Show `actual_payout` for settled bets, `potential_payout` for pending — label them differently ("Payout" vs "Potential") |
| Infinite scroll on a sortable/filterable table | Filter change triggers a new Supabase query, but the user is mid-scroll — page resets to top confusingly | Use paginated "Load more" with an explicit reset on filter change, or full pagination with page numbers |
| Empty state with no CTA | New users see a blank history tab with no direction | Empty state should explain what the tab is for and link directly to the odds view: "No bets yet. Browse live odds to place your first paper bet." |

---

## "Looks Done But Isn't" Checklist

- [ ] **Bet status display:** History shows statuses — but verify bets ever actually transition from `pending`. Query `paper_sports_bets` in the Supabase dashboard after a game ends and confirm `status` changed.
- [ ] **Win rate calculation:** Displayed win rate — but verify it excludes pending bets from the denominator (a 3W 2L 10P user should show 60%, not 20%).
- [ ] **RLS enforcement:** Table has a policy in Supabase — but verify RLS is actually **enabled** on the table (policies exist independently of the RLS toggle; both must be set).
- [ ] **Bankroll row exists for all users:** `SportsBankroll` shows $100,000 fallback when the row is missing — verify every user has a `paper_sports_bankroll` row (check `initNewUser.js` covers it).
- [ ] **Filter persistence:** Filters work — but verify they survive a tab switch within the sportsbook and a full page refresh.
- [ ] **Parlay bets:** History renders — but verify parlay bets are grouped visually and not counted as N individual bets in the win rate.
- [ ] **Payout accuracy:** History shows payouts — but verify won bet `actual_payout` matches the bankroll debit amount in `paper_sports_bankroll`.
- [ ] **Date filter timezone:** Filter "last 7 days" works in your local timezone — but verify it works correctly for users in UTC-8 vs UTC+5:30 (compare `placed_at` timestamps in Supabase against filter range).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bets stuck as pending, win/loss never recorded | HIGH | Write a one-time Vercel serverless function to backfill results from scores API; requires matching stored `game_id` to score API game IDs — risky if IDs don't align |
| P&L stats diverged from bankroll table | MEDIUM | Write a reconciliation script: recalculate balance from sum of bet outcomes, compare to `paper_sports_bankroll.balance`, update the delta; test on a single user first |
| RLS not set and cross-user data visible | LOW (for paper context) | Enable RLS + policy in Supabase dashboard immediately; existing data is unaffected |
| `calcPayout` divergence causing history payout mismatch | MEDIUM | `potential_payout` is already stored at placement time — update history display to read from DB column instead of recomputing; no data migration needed |
| Parlay bets counted as individual wins/losses | HIGH | Requires schema migration to add `parlay_id`, then a backfill script to group existing multi-bet placements by `created_at` timestamp proximity — fragile |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| No result resolution path | Phase 1: Schema design | Confirm schema has `status`, `result_resolved_at`, `actual_payout` columns before any UI work starts |
| P&L stats diverge from bankroll | Phase 1: Schema design + Phase 2: History UI data layer | History summary stats query runs against `paper_sports_bets` aggregate, not `paper_sports_bankroll` |
| Missing RLS | Phase 1: Schema design | Supabase dashboard shows RLS: Enabled on `paper_sports_bets`; cross-user query test returns empty |
| Payout math duplicated | Phase 2: History UI | Only one `calcPayout` exists in codebase (in `src/lib/sportsUtils.js`); history rows read `potential_payout` / `actual_payout` from DB |
| Parlay bets without linking | Phase 1: Schema design | `paper_sports_bets` has nullable `parlay_id` UUID column from day one |
| Filter state not persisted | Phase 2: History UI | Filters survive tab switch; filters survive page refresh if URL-based |
| Performance: full table fetch | Phase 2: History UI | Network tab shows filtered Supabase query (URL contains `sport=eq.*` params), not a full `select=*` |

---

## Sources

- Direct codebase inspection: `src/pages/SportsOddsPage.jsx`, `src/components/dashboard/PaperBettingSlip.jsx`, `src/components/dashboard/SportsBankroll.jsx`, `src/store/hooks/useTradeHistory.js`
- Existing Supabase table patterns: `paper_sports_bankroll`, `paper_sports_bets` (confirmed in source)
- Existing RLS patterns: `src/lib/supabaseClient.js` browser client — no service role in frontend
- Supabase RLS documentation: Row-level security policies require both RLS enabled AND a permissive policy; enabling one without the other blocks or allows all rows
- American odds payout formula: `odds > 0 → stake * (odds/100 + 1)`, `odds < 0 → stake * (100/|odds| + 1)` — confirmed against existing `calcPayout` implementations in codebase
- Paper trading precedent: `src/store/hooks/useTradeHistory.js` — localStorage + Supabase sync pattern for history persistence

---
*Pitfalls research for: Sportsbook bet history tracking (paper/simulated)*
*Researched: 2026-03-10*
