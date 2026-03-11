# Architecture Research

**Domain:** Bet history tracking — sportsbook section within existing React + Supabase + Vercel app
**Researched:** 2026-03-10
**Confidence:** HIGH — based on direct codebase inspection, not inference

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SportsOddsPage.jsx                            │
│                                                                       │
│  ┌─────────────────┐   ┌──────────────┐   ┌───────────────────────┐  │
│  │  SportsBankroll  │   │ GamesPanel   │   │  BetHistoryTab (new)  │  │
│  │  (reads bankroll)│   │  + GameCard  │   │                       │  │
│  └────────┬────────┘   └──────┬───────┘   └──────────┬────────────┘  │
│           │                   │ onConfirmBet          │               │
│  ┌────────┴──────────────────────────┐    ┌──────────┴────────────┐  │
│  │       PaperBettingSlip            │    │  BetHistorySummary    │  │
│  │  (slip state, stake, place bets)  │    │  (new — stats row)    │  │
│  └────────────────────┬──────────────┘    └──────────┬────────────┘  │
│                       │ handlePlaceBets              │ useBetHistory  │
└───────────────────────┼──────────────────────────────┼───────────────┘
                        │                              │
                        ▼                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Supabase (client SDK, browser)                  │
│                                                                       │
│  supabase.from('paper_sports_bets').insert(...)   ← place bet        │
│  supabase.from('paper_sports_bets').select(...)   ← history fetch    │
│  supabase.from('paper_sports_bankroll').update()  ← debit stake      │
│  supabase.channel('bankroll').on(postgres_changes) ← realtime        │
└──────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Vercel Serverless                             │
│                                                                       │
│  /api/settle-sports-bets   ← called manually or via cron             │
│  /api/odds/events          ← The Odds API proxy                      │
│  /api/odds/sports          ← sports list proxy                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `SportsOddsPage` | Top-level page state: active sport, slip contents, toast, modal | All children via props |
| `SportsBankroll` | Displays balance, W/L record, ROI, streak. Realtime via Supabase channel | `paper_sports_bankroll` table |
| `GamesPanel` | Fetches and renders odds for a sport; delegates bet clicks to parent | `/api/odds/events`, parent `onConfirmBet` |
| `PaperBettingSlip` | Holds pending slip items, stake editing, calls `handlePlaceBets` | `paper_sports_bankroll` (balance check), `paper_sports_bets` (insert) |
| `BetHistoryTab` (**new**) | Renders reverse-chronological bet list with filter/sort controls | `useBetHistory` hook |
| `BetHistorySummary` (**new**) | Stat row: total wagered, total won, total lost, win rate | Derived from `useBetHistory` data |
| `useBetHistory` (**new**) | Custom hook: fetch, filter, sort, paginate bet records | `paper_sports_bets` table via Supabase client |

## Recommended Project Structure

```
src/
├── pages/
│   └── SportsOddsPage.jsx          # Existing — add "History" tab to NAV_SECTIONS or tab bar
├── components/
│   └── dashboard/
│       ├── SportsBankroll.jsx       # Existing — no changes needed
│       ├── PaperBettingSlip.jsx     # Existing — no changes needed
│       ├── BetHistoryTab.jsx        # New — history list + filters
│       └── BetHistorySummary.jsx    # New — stat strip at top of history tab
└── hooks/
    └── useBetHistory.js             # New — data fetching + filter/sort logic
```

### Structure Rationale

- **`BetHistoryTab` in `dashboard/`:** Matches where `SportsBankroll` and `PaperBettingSlip` live. All sportsbook components share this folder.
- **`useBetHistory` hook extracted:** Keeps fetch + filter logic out of JSX. Same pattern used by `SportsBankroll` (inline `useEffect`) but history has enough complexity (pagination, multi-filter) to warrant a hook.
- **No new API route needed:** The `paper_sports_bets` table already has RLS (or can rely on service key for client-side reads with `anon` key + RLS). Direct Supabase client queries from the browser are the established pattern in this codebase (see `SportsBankroll`, `PaperBettingSlip`, `SportsOddsPage.handlePlaceBets`).

## Architectural Patterns

### Pattern 1: Direct Supabase Client Queries (established pattern)

**What:** React components and hooks query Supabase directly from the browser using the anon key. Auth is handled by checking `supabase.auth.getSession()` before any query.

**When to use:** All read/write operations on user-owned data (bets, bankroll). This is the pattern already used by `SportsBankroll`, `PaperBettingSlip`, and `SportsOddsPage`.

**Trade-offs:** Simple, no serverless function needed, automatically respects RLS policies. Exposes table structure via client SDK (acceptable for paper/simulated data with no financial risk).

**Example:**
```javascript
// useBetHistory.js
export function useBetHistory({ sport, status, dateRange, page, limit }) {
  const [bets, setBets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || cancelled) return;

      let query = supabase
        .from('paper_sports_bets')
        .select('*', { count: 'exact' })
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .range(page * limit, page * limit + limit - 1);

      if (sport) query = query.eq('sport', sport);
      if (status) query = query.eq('status', status);
      if (dateRange?.from) query = query.gte('created_at', dateRange.from);
      if (dateRange?.to) query = query.lte('created_at', dateRange.to);

      const { data, count } = await query;
      if (!cancelled) {
        setBets(data || []);
        setTotal(count || 0);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sport, status, dateRange, page, limit]);

  return { bets, total, loading };
}
```

### Pattern 2: Tab Integration Inside Existing Page

**What:** Add a "History" tab to the existing `SportsOddsPage` layout without adding a new route or page. The tab switches between the games view and the history view.

**When to use:** The PROJECT.md requirement specifies "inside sportsbook section as a tab/section, not a separate page." This avoids adding sidebar nav complexity and keeps sportsbook self-contained.

**Trade-offs:** History data is only fetched when user opens the tab (lazy). No additional routing. Slight increase in `SportsOddsPage` state — manageable given existing pattern.

**Example:**
```jsx
// Inside SportsOddsPage — add activeTab state
const [activeTab, setActiveTab] = useState('games'); // 'games' | 'history'

// Render tab bar above content
<div className="flex gap-2 border-b border-white/[0.06]">
  {['games', 'history'].map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={activeTab === tab ? 'text-white border-b-2 border-emerald-400' : 'text-gray-500'}
    >
      {tab === 'games' ? 'Lines' : 'My Bets'}
    </button>
  ))}
</div>

{activeTab === 'history' && <BetHistoryTab />}
```

### Pattern 3: Derived Summary Stats (no extra query)

**What:** `BetHistorySummary` computes stats (total wagered, win rate, total won/lost) from the data already returned by `useBetHistory` — not a separate aggregation query.

**When to use:** Stats panel above the history list. Data is already in memory. A separate aggregation query would add latency and a second fetch.

**Trade-offs:** Stats reflect only the currently loaded page subset if pagination is active. To compute stats across all bets, either fetch without pagination limit or read from `paper_sports_bankroll` which already aggregates `total_wagered`, `total_won`, `total_lost`, `wins`, `losses`. Use `paper_sports_bankroll` for aggregate stats — it is the authoritative source.

## Data Flow

### Bet Placement Flow (existing — do not change)

```
User clicks odds cell
    ↓
OddsCell.handleClick → onConfirmBet(betPayload)
    ↓
SportsOddsPage.setConfirmBet → renders confirmation modal OR adds to slip
    ↓
handlePlaceBets()
    ↓
supabase.from('paper_sports_bets').insert([...bets])      ← persists bets
supabase.from('paper_sports_bankroll').update({ balance }) ← debits bankroll
    ↓
Slip cleared, toast shown
```

### Bet History Fetch Flow (new)

```
User opens "My Bets" tab
    ↓
BetHistoryTab mounts → useBetHistory() activates
    ↓
supabase.auth.getSession() → get user_id
    ↓
supabase.from('paper_sports_bets')
  .select('*', { count: 'exact' })
  .eq('user_id', ...)
  .order('created_at', { ascending: false })
  [+ optional .eq('sport'), .eq('status'), .gte/.lte('created_at')]
  .range(offset, offset + limit - 1)
    ↓
{ data: bets, count: total } → setState → render table rows
```

### Settlement Flow (existing — do not change)

```
/api/settle-sports-bets called (manual or cron)
    ↓
Fetch pending bets from paper_sports_bets where status='pending'
    ↓
Fetch scores from The Odds API
    ↓
Match game → determine result (won/lost/push)
    ↓
UPDATE paper_sports_bets SET status=result, actual_payout=..., settled_at=...
UPDATE paper_sports_bankroll SET balance=..., wins=..., losses=...
    ↓
Discord webhook notification
```

After settlement, history rows update automatically on next fetch (no realtime subscription needed for history — on-demand fetch on tab open is sufficient).

### Key Data Flows

1. **Stats strip:** Read from `paper_sports_bankroll` (already has `total_wagered`, `total_won`, `total_lost`, `wins`, `losses`, `win_rate`). Do not recompute from raw bets.
2. **Filter/sort:** Applied as Supabase query modifiers in `useBetHistory`, not client-side array filtering — keeps pagination correct.
3. **Realtime not needed for history:** Bets are settled by cron/manual trigger; history tab is a manual browsing surface. Simple refetch on tab focus is sufficient. Contrast with `SportsBankroll` which uses realtime because its balance changes during active use.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current approach (direct Supabase client) is fine. RLS ensures row-level isolation. |
| 1k-100k users | Supabase handles this without changes. Add index on `(user_id, created_at DESC)` and `(user_id, status)` to keep queries fast as history grows per user. |
| 100k+ users | Move aggregation (stats) to a materialized view or maintain counters in `paper_sports_bankroll` (already done). Avoid full-table scans on `paper_sports_bets`. |

### Scaling Priorities

1. **First bottleneck:** Long history per user slows unindexed queries. Add composite index `(user_id, created_at DESC)` when creating the table if not already present.
2. **Second bottleneck:** Stats recomputed on every history open. Already mitigated — use `paper_sports_bankroll` aggregates, not raw scan.

## Anti-Patterns

### Anti-Pattern 1: Polling for Bet Status Updates

**What people do:** `setInterval` fetching `/api/odds/events` or the bets table to detect when pending bets resolve.

**Why it's wrong:** Violates the project's "No polling" rule (CLAUDE.md critical rule #1). Causes redundant database reads. Settlement is a background operation — users don't need instant notification in the history tab.

**Do this instead:** Fetch history on tab open. Let settlement happen via cron/manual trigger. If realtime notification is wanted later, use a Supabase `postgres_changes` subscription scoped to `user_id` — same pattern as `SportsBankroll`.

### Anti-Pattern 2: Client-Side Filtering of All Bets

**What people do:** Fetch all bets for the user (`select *` with no pagination), then use `Array.filter()` + `Array.sort()` in React for the filter controls.

**Why it's wrong:** As bet history grows (hundreds of rows per user), the payload becomes large and the initial load slow. Breaks pagination correctness.

**Do this instead:** Push all filter and sort logic into the Supabase query (`.eq()`, `.gte()`, `.lte()`, `.order()`). Paginate with `.range()`. Only the current page's rows cross the wire.

### Anti-Pattern 3: Separate Stats Aggregation Query

**What people do:** Run a second `SELECT COUNT(*), SUM(stake)...` query to compute the summary stats.

**Why it's wrong:** `paper_sports_bankroll` already maintains `wins`, `losses`, `total_wagered`, `total_won`, `total_lost`. A second query duplicates work and can drift from the authoritative source.

**Do this instead:** Read stats from `paper_sports_bankroll`. It is updated atomically on every bet placement and settlement.

### Anti-Pattern 4: New Top-Level Page for History

**What people do:** Add a new sidebar route (`/dashboard/bet-history`) for the history view.

**Why it's wrong:** PROJECT.md constraint: "Must live inside existing sportsbook section as a tab/section, not a separate page." Adding a route adds sidebar nav complexity and breaks the sportsbook's self-contained pattern.

**Do this instead:** Tab inside `SportsOddsPage`. Use local `activeTab` state.

## Integration Points

### Supabase Tables (existing)

| Table | Integration Pattern | Notes |
|-------|---------------------|-------|
| `paper_sports_bets` | Browser Supabase client, `.select()` with filters | Has columns: `user_id`, `sport`, `league`, `game_id`, `home_team`, `away_team`, `bet_type`, `selection`, `line`, `odds`, `stake`, `potential_payout`, `book`, `status`, `actual_payout`, `home_score`, `away_score`, `settled_at`, `created_at` |
| `paper_sports_bankroll` | Browser Supabase client, `.select()` for stats; `SportsBankroll` already subscribes via realtime | Has columns: `balance`, `wins`, `losses`, `total_pushes`, `total_wagered`, `total_won`, `total_lost`, `current_streak`, `biggest_win` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `SportsOddsPage` ↔ `BetHistoryTab` | Props: none required — tab manages its own fetch | Keep tab self-contained; parent only controls visibility |
| `BetHistoryTab` ↔ `useBetHistory` | Hook return: `{ bets, total, loading }` | Filter state lives in `BetHistoryTab`, passed as params to hook |
| `BetHistorySummary` ↔ stats source | Reads from `paper_sports_bankroll` directly | Do not read from `useBetHistory` data; use authoritative bankroll row |
| `BetHistoryTab` ↔ `DataTable` | Optional reuse — `DataTable.jsx` is designed for positions/orders; bet history has different columns. A bespoke table component inside `BetHistoryTab` is simpler than adapting `DataTable`. | |

## Build Order (Roadmap Implications)

Dependencies flow in this order:

1. **Verify/create `paper_sports_bets` table schema** — the table already exists (confirmed in `settle-sports-bets.js` and `SportsOddsPage.handlePlaceBets`). Confirm columns match what history needs. Add any missing columns (`actual_payout`, `settled_at` appear in settlement code and should already be present). Add index `(user_id, created_at DESC)` if not present.

2. **`useBetHistory` hook** — pure data layer, no UI. Can be built and tested independently.

3. **`BetHistorySummary` component** — reads from `paper_sports_bankroll`, which already exists and is populated. Simple stat display.

4. **`BetHistoryTab` component** — composes `useBetHistory`, `BetHistorySummary`, and table rows. Requires hook (step 2) and summary (step 3).

5. **Tab integration in `SportsOddsPage`** — add `activeTab` state, tab bar UI, and conditionally render `BetHistoryTab`. Requires all above.

6. **Filter controls** — date range, sport, status filters passed as params to `useBetHistory`. Can be added incrementally inside `BetHistoryTab`.

## Sources

- Direct inspection of `/src/pages/SportsOddsPage.jsx` (bet placement flow, table write)
- Direct inspection of `/src/components/dashboard/SportsBankroll.jsx` (realtime pattern, bankroll columns)
- Direct inspection of `/src/components/dashboard/PaperBettingSlip.jsx` (slip UI pattern)
- Direct inspection of `/api/settle-sports-bets.js` (confirms `paper_sports_bets` schema and `paper_sports_bankroll` columns)
- Direct inspection of `/api/paper-history.js` (existing stock trade history pattern — pagination, auth, Supabase service role)
- `.planning/PROJECT.md` (constraints: tab not page, no polling, design system)
- `CLAUDE.md` (design system, no-polling rule, error boundary rule)

---
*Architecture research for: Sportsbook bet history tracking within existing Stratify React + Supabase + Vercel app*
*Researched: 2026-03-10*
