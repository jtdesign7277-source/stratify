# Phase 2: Bet History Display - Research

**Researched:** 2026-03-11
**Domain:** React data-fetch hook + table UI + stat aggregation over Supabase
**Confidence:** HIGH

## Summary

Phase 2 builds three new artifacts on top of the Phase 1 foundation: a `useBetHistory` hook that fetches from `paper_sports_bets`, a `BetHistorySummary` stat strip that computes aggregate P&L from those rows, and a `BetHistoryTab` table component that renders bets in reverse chronological order with win/loss/pending color coding.

All tooling required is already installed: `framer-motion` ^12, `react-countup` ^6.5, `@supabase/supabase-js` ^2.95, and `lucide-react` are in `package.json`. No new packages need to be added. The design tokens — `GLASS_CARD`, `DESIGN_COLORS`, and `calcPayout` — are exported from `src/lib/sportsUtils.js` as of Phase 1 and must be imported from there, never redefined.

The data layer decision is locked: fetch all bets for the authenticated user once on mount using the Supabase client directly (anon key, RLS-scoped), sort client-side by `created_at DESC`. No realtime subscription, no polling. The composite index `(user_id, created_at DESC)` added in migration 006 ensures the query is efficient.

**Primary recommendation:** Build `useBetHistory` as a standalone hook in `src/hooks/useBetHistory.js`, `BetHistorySummary` as `src/components/dashboard/BetHistorySummary.jsx`, and `BetHistoryTab` as `src/components/dashboard/BetHistoryTab.jsx`. Both components import design tokens from `sportsUtils.js` and receive bets/stats as props (no fetch inside UI components).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Surgical Mode:** Every change must be scoped to explicitly named files only. Do NOT modify any file not explicitly listed.
- **Design System:** Background `bg-[#0a0a0f]` always. Accent `#10b981` emerald only. Positive/Win: `text-emerald-400`. Negative/Loss: `text-red-400`. Pending: `text-gray-400`. Muted: `text-gray-500`. Prices/amounts: `font-mono font-medium`. Headers: `font-semibold tracking-tight`. Section labels: `text-xs font-semibold tracking-widest text-gray-500 uppercase`.
- **Glass Card System:** Import `GLASS_CARD` and `DESIGN_COLORS` from `src/lib/sportsUtils.js`. Standard Card: `bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06]` + layered shadows. Inset Field: `bg-black/40 rounded-xl` + inset shadows.
- **No Badge/Pill Styling:** Win/Loss/Pending must be plain colored text only. WRONG: `<span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Win</span>`. RIGHT: `<span className="text-emerald-400 text-sm font-medium">Win</span>`.
- **No Icon Boxes:** Icons are bare SVG with color class only — no background containers.
- **Motion System:** Spring presets: snappy (stiffness: 400, damping: 30). Hover lift on cards: `whileHover={{ y: -2 }}`. Staggered list entrance: staggerChildren 0.04. Page transitions: opacity + y with spring. Use `framer-motion` for all animations.
- **Data Layer:** Aggregate stats from `paper_sports_bets` directly — NOT from `paper_sports_bankroll`. Use Supabase client directly (no serverless wrapper for reads). On-demand fetch on component mount — no polling, no realtime subscription for history. Client-side filtering/sorting — fetch all user bets once.
- **Result Colors:** Win: `text-emerald-400`. Loss: `text-red-400`. Pending: `text-gray-400`. Plain text only — no badges, pills, or background highlights.

### Claude's Discretion
- Hook API design (params, return shape)
- Component file structure and naming
- Table column widths and responsive behavior
- Empty state copy and layout
- Stat strip layout (horizontal vs grid)
- Loading state design

### Deferred Ideas (OUT OF SCOPE)
- Filter controls (Phase 3)
- Tab integration into SportsOddsPage (Phase 3)
- Sort by column header (Phase 3)
- Date range filtering (v2)
- Win rate by sport breakdown (v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-01 | User can view bet history table with columns: date/time, matchup, sport, bet amount, odds/spread, payout, result | Schema audit confirms all columns are present in `paper_sports_bets`; payout available via `actual_payout` (resolved) or `potential_payout` (pending) |
| HIST-02 | Bet history displays in reverse chronological order by default | Composite index `(user_id, created_at DESC)` created in migration 006; client-side `.sort()` by `created_at` is safe since all bets are fetched at once |
| HIST-03 | Win results shown in emerald, losses in red, pending in muted gray — plain colored text, no badges or pills | Design tokens locked in CONTEXT.md; `status` column (`'pending'`/`'won'`/`'lost'`) is the gate for color selection |
| HIST-04 | Empty state shown when user has no bet history with guidance to place first bet | Hook returns empty array when no rows exist; component must branch on `bets.length === 0` and render empty state copy |
| STAT-01 | Summary P&L header shows total wagered, total won, net P&L, win rate above the history table | All four metrics are derivable from `paper_sports_bets` rows: `bet_amount` → total wagered; `actual_payout` on won rows → total won; net = total won − total wagered; win rate = won / (won + lost) |
| STAT-02 | Stats update dynamically to reflect current filter selections | Phase 3 adds filters; in Phase 2 stats are computed from the unfiltered full set — STAT-02 is satisfied by design because there are no filters yet; hook must return raw bets so Phase 3 can pass a filtered slice |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.95.3 | Fetch `paper_sports_bets` rows via anon key + RLS | Already installed; project standard for all DB reads |
| `framer-motion` | ^12.29.2 | Row entrance animation, hover lift | Already installed; locked motion system from CONTEXT.md |
| `react-countup` | ^6.5.3 | Animated stat values in BetHistorySummary | Already installed; used in SportsBankroll.jsx as established pattern |
| `lucide-react` | ^0.563.0 | Bare icons (no box containers) in empty state / table | Already installed; project icon standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/sportsUtils.js` | Phase 1 output | `calcPayout`, `GLASS_CARD`, `DESIGN_COLORS` | Always — never copy-paste these values |
| `src/lib/supabaseClient.js` | Project | Supabase browser client | All client-side Supabase queries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side fetch + sort | Supabase `.order('created_at', { ascending: false })` | Either works; both are fine — locked decision is "fetch all bets once, sort client-side" |
| CountUp animated numbers | Static formatted text | CountUp already installed and used in SportsBankroll — use it for consistency |
| framer-motion stagger | CSS animation | framer-motion is locked by CONTEXT.md |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 2:
```
src/
├── hooks/
│   └── useBetHistory.js              # Fetches paper_sports_bets, returns bets + loading + error
├── components/dashboard/
│   ├── BetHistorySummary.jsx         # Stat strip: total wagered, total won, net P&L, win rate
│   └── BetHistoryTab.jsx             # Table: reverse-chron rows + empty state
```

### Pattern 1: useBetHistory Hook Shape

**What:** A React hook that authenticates, fetches all user bets from Supabase on mount, returns bets array + loading/error state.

**When to use:** Mount once wherever BetHistoryTab and BetHistorySummary are rendered. Do not call it inside both components — call once in the parent and pass bets as props.

**Example:**
```javascript
// src/hooks/useBetHistory.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useBetHistory() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error: fetchError } = await supabase
        .from('paper_sports_bets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setBets(data ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { bets, loading, error };
}
```

### Pattern 2: Stats Aggregation (pure function, no hook)

**What:** Derive the four STAT-01 metrics from the raw bets array — total wagered, total won, net P&L, win rate. Must use `paper_sports_bets` rows directly (LOCKED decision: not from `paper_sports_bankroll`).

**Win rate denominator convention (OPEN in STATE.md):** Exclude pending bets. Win rate = won / (won + lost). This is the recommended approach documented in STATE.md.

**Example:**
```javascript
// Can be a standalone helper or defined inside BetHistorySummary
function computeStats(bets) {
  const settled = bets.filter(b => b.status !== 'pending');
  const won = settled.filter(b => b.status === 'won');
  const lost = settled.filter(b => b.status === 'lost');

  const totalWagered = bets.reduce((sum, b) => sum + Number(b.bet_amount ?? 0), 0);
  const totalWon = won.reduce((sum, b) => sum + Number(b.actual_payout ?? 0), 0);
  const netPnl = totalWon - won.reduce((sum, b) => sum + Number(b.bet_amount ?? 0), 0)
               - lost.reduce((sum, b) => sum + Number(b.bet_amount ?? 0), 0);
  const winRate = (won.length + lost.length) > 0
    ? (won.length / (won.length + lost.length)) * 100
    : 0;

  return { totalWagered, totalWon, netPnl, winRate };
}
```

NOTE: `netPnl` = (actual payouts on won bets minus their stakes) minus (stakes on lost bets). This is true P&L, not just payout. Verify `bet_amount` column name against schema — confirmed present from `paper_sports_bets` schema (see Architecture Patterns > Schema).

### Pattern 3: Result Color Selection

**What:** Map `status` column value to a Tailwind class. Plain text only — no background, no pill.

```javascript
const RESULT_COLOR = {
  won:     'text-emerald-400',
  lost:    'text-red-400',
  pending: 'text-gray-400',
};
const resultClass = RESULT_COLOR[bet.status] ?? 'text-gray-400';
const resultLabel = bet.status === 'won' ? 'Won' : bet.status === 'lost' ? 'Lost' : 'Pending';
```

### Pattern 4: Framer-Motion Staggered Row Entrance

**What:** Table rows animate in with staggered fade+slide. Matches locked spring preset.

```jsx
// Parent container
<motion.tbody
  variants={{ show: { transition: { staggerChildren: 0.04 } } }}
  initial="hidden"
  animate="show"
>
  {bets.map(bet => (
    <motion.tr
      key={bet.id}
      variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
    >
      ...
    </motion.tr>
  ))}
</motion.tbody>
```

### Pattern 5: Empty State

```jsx
// BetHistoryTab — empty state branch
{bets.length === 0 && !loading && (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <span className="mb-3 text-3xl opacity-40">📋</span>
    <p className="text-sm font-medium text-gray-400">No bets yet</p>
    <p className="mt-1 text-xs text-gray-500">Place your first paper bet to start tracking performance</p>
  </div>
)}
```

### Anti-Patterns to Avoid

- **Fetching inside BetHistorySummary and BetHistoryTab separately:** Both components receive bets as props from a single `useBetHistory` call in their parent. Two separate fetches double the Supabase requests and cause state divergence.
- **Copying `GLASS_CARD` class strings inline:** Always import from `sportsUtils.js`. If CONTEXT.md values change, there is one place to update.
- **Reading win rate from `paper_sports_bankroll`:** Locked decision — aggregate from `paper_sports_bets` rows only.
- **Rendering badges or pill elements for result status:** Win/Loss/Pending = plain colored text. No `rounded-full`, no background color, no `px-2 py-1` wrapper.
- **Using `setInterval` for data refresh:** Bet history is on-demand fetch only — no polling.
- **Importing anything from SportsOddsPage.jsx:** That file is 75KB+ and must not be touched in Phase 2 (Surgical Mode).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated number count-up | Custom CSS/JS counter | `react-countup` ^6.5.3 (installed) | Already used in SportsBankroll.jsx — consistency + handles edge cases |
| Glass card styles | Copy-pasted Tailwind strings | `GLASS_CARD.standard` from `sportsUtils.js` | Single source of truth; Phase 1 locked these values |
| Payout calculation | Local payout math | `calcPayout(stake, odds)` from `sportsUtils.js` | Single source; Phase 1 eliminated all local duplicates |
| Supabase auth guard in hook | Custom auth check | `supabase.auth.getSession()` + `cancelled` cleanup flag | Pattern from SportsBankroll.jsx and PaperBettingSlip.jsx — proven, handles unmount race |

**Key insight:** Every "utility" you'd build for this phase already exists in `sportsUtils.js` or in installed packages. The only new code is wiring them together.

---

## Common Pitfalls

### Pitfall 1: Wrong payout column for P&L calculation
**What goes wrong:** Using `potential_payout` for all bets, including resolved ones, inflates "total won" to show what could have been paid instead of what was actually paid.
**Why it happens:** Both `actual_payout` and `potential_payout` exist in the schema. `potential_payout` is set when a bet is placed; `actual_payout` is set when settled.
**How to avoid:** For won bets, use `actual_payout`. For pending bets, use `potential_payout` in display only (not in P&L totals). Lost bets have `actual_payout = 0` (stake is lost).
**Warning signs:** Win P&L showing the same as pending payout estimates — check which column is being summed.

### Pitfall 2: Win rate denominator includes pending bets
**What goes wrong:** Win rate shows artificially low because unresolved bets are counted as losses.
**Why it happens:** Simple `won / bets.length` formula without filtering out pending.
**How to avoid:** Filter to `status === 'won' || status === 'lost'` before computing the denominator. Win rate = `won.length / (won.length + lost.length)`.
**Warning signs:** Win rate showing 0% or very low when the user has placed bets but none have been settled yet.

### Pitfall 3: NetPnL computed as `totalWon - totalWagered` (wrong)
**What goes wrong:** Net P&L is inflated or deflated because `totalWon` includes the returned stake on winning bets, but `totalWagered` includes stakes on all bets.
**Why it happens:** Confusion between "payout" (stake + profit) and "profit" (payout - stake).
**How to avoid:** Net P&L = (sum of actual_payout on won bets) - (sum of bet_amount on won bets) - (sum of bet_amount on lost bets). Pending bets do not affect realized P&L.
**Warning signs:** Net P&L showing positive on a 1W/1L record with equal stakes.

### Pitfall 4: Circular import from sportsUtils.js
**What goes wrong:** Adding an import statement inside `sportsUtils.js` creates a circular dependency and causes a gray screen crash.
**Why it happens:** Phase 2 components might tempt you to add shared logic to sportsUtils.
**How to avoid:** `sportsUtils.js` has zero import statements by design — never add any. Put new shared logic elsewhere.
**Warning signs:** Any `import` line appearing in `sportsUtils.js`.

### Pitfall 5: Cancellation race condition in useBetHistory
**What goes wrong:** Component unmounts before the Supabase fetch resolves, then `setBets` is called on an unmounted component — React warning or stale state update.
**Why it happens:** Async `useEffect` without cleanup.
**How to avoid:** Use a `cancelled` flag in the `useEffect` closure, set to `true` in the cleanup function. Guard every state setter: `if (!cancelled) setState(...)`. This pattern is already established in `SportsBankroll.jsx` and `PaperBettingSlip.jsx`.

### Pitfall 6: Modifying SportsOddsPage.jsx in Phase 2
**What goes wrong:** Surgical Mode violation — Phase 2 does not integrate BetHistoryTab into the page navigation. That is Phase 3 (INTG-01 / FILT-*).
**Why it happens:** It feels natural to wire the tab in while building the component.
**How to avoid:** `BetHistoryTab` is a standalone component in Phase 2 — it is not imported by SportsOddsPage until Phase 3.

---

## Code Examples

Verified patterns from existing project code:

### Supabase Auth + Fetch Pattern (from SportsBankroll.jsx)
```javascript
// Source: src/components/dashboard/SportsBankroll.jsx lines 12-24
useEffect(() => {
  let cancelled = false;
  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id || cancelled) return;
    const { data } = await supabase
      .from('paper_sports_bankroll')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!cancelled) setRow(data);
  })();
  return () => { cancelled = true; };
}, []);
```

### CountUp in Stat Strip (from SportsBankroll.jsx)
```jsx
// Source: src/components/dashboard/SportsBankroll.jsx lines 67-79
<div className="mb-1 text-xs uppercase tracking-widest text-gray-500">PAPER BANKROLL</div>
<div className="text-2xl font-mono text-white">
  $
  <CountUp
    start={0}
    end={balance}
    duration={0.8}
    separator=","
    decimals={2}
    decimal="."
    useEasing
  />
</div>
```

### Framer Motion Stagger (from PaperBettingSlip.jsx)
```jsx
// Source: src/components/dashboard/PaperBettingSlip.jsx lines 74-88
<motion.div
  variants={{ show: { transition: { staggerChildren: 0.04 } } }}
  initial="hidden"
  animate="show"
>
  <AnimatePresence initial={false}>
    {bets.map((b) => (
      <motion.div
        key={b.id}
        variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}
        initial="hidden"
        animate="show"
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
    ))}
  </AnimatePresence>
</motion.div>
```

### Glass Card Usage (from sportsUtils.js)
```javascript
// Source: src/lib/sportsUtils.js — import and use
import { GLASS_CARD, DESIGN_COLORS } from '../../lib/sportsUtils';

// Usage:
<div className={GLASS_CARD.standard}>...</div>
// GLASS_CARD.standard = 'bg-gradient-to-br from-white/[0.04] to-white/[0.01]
//   backdrop-blur-xl rounded-2xl border border-white/[0.06]
//   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]'
```

---

## Schema Reference

`paper_sports_bets` confirmed columns (from migration 006 + existing table):

| Column | Type | Source | Use in Phase 2 |
|--------|------|--------|----------------|
| `id` | uuid | original | Row key |
| `user_id` | uuid | original | RLS filter |
| `created_at` | timestamptz | original | Sort order (DESC) |
| `bet_amount` | numeric | original | Stake display + total wagered |
| `odds` | numeric | original | Odds display column |
| `status` | text | migration 006 | `'pending'`/`'won'`/`'lost'` — color gate |
| `result_resolved_at` | timestamptz | migration 006 | Optional: show settlement time |
| `actual_payout` | numeric | migration 006 | Payout for won bets in P&L |
| `potential_payout` | numeric | migration 006 | Payout display for pending bets |
| `parlay_id` | uuid | migration 006 | Phase 2 ignores (parlay display deferred) |

Additional columns likely present from original table creation (verify against Supabase): `matchup`, `sport`, `bet_type`, `spread`, `team`. These map to HIST-01 required table columns.

> **Note (OPEN QUESTION):** The research can confirm `bet_amount`, `odds`, `status`, `actual_payout`, and `potential_payout` from migration 006. The original table creation SQL was not available in the codebase — column names for `matchup`, `sport`, `team` should be verified in the Supabase Table Editor before building column headers. The cron `api/settle-sports-bets.js` and `PaperBettingSlip.jsx` INSERT calls are the canonical reference for the actual column set.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local `calcPayout` in each file | Single export from `sportsUtils.js` | Phase 1 (2026-03-11) | Import only — never define locally |
| No `paper_sports_bets` RLS | User-scoped RLS policy active | Phase 1 migration 006 | Anon key queries are safe for client-side fetch |
| No `actual_payout` column | Column exists with value set on settlement | Phase 1 migration 006 | P&L calculation is possible from client |

---

## Open Questions

1. **Full column list for `paper_sports_bets` original table creation**
   - What we know: Migration 006 adds `status`, `result_resolved_at`, `actual_payout`, `potential_payout`, `parlay_id`. The original CREATE TABLE is not in the migration files checked.
   - What's unclear: Exact column names for `matchup`, `sport`, `team`, `bet_type`, `spread` — the HIST-01 columns. These may use different names (e.g., `home_team` / `away_team` instead of `matchup`).
   - Recommendation: Before writing column headers, read `api/settle-sports-bets.js` and `SportsOddsPage.jsx` INSERT statements (in the Phase 2 plan, the planner should schedule a task to verify column names from the actual INSERT in SportsOddsPage before building the table header).

2. **Net P&L formula convention**
   - What we know: STATE.md says "exclude pending from win rate denominator" — same logic applies to P&L.
   - What's unclear: Whether `netPnl` should show only realized P&L (won − stake on won, minus stake on lost, ignoring pending stakes) or include pending stakes as negative.
   - Recommendation: Show realized P&L only (won payouts minus stakes on settled bets). Pending bets are excluded from net P&L until settled. This matches `SportsBankroll.jsx` behavior where P&L = `balance - INITIAL_BANKROLL`, which reflects settled outcomes.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None — Wave 0 must install vitest |
| Quick run command | `npx vitest run src/hooks/useBetHistory.test.js` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-01 | Table renders all 7 required columns | unit (component smoke) | manual-only — no DOM test framework | ❌ Wave 0 |
| HIST-02 | Bets sorted reverse-chronological | unit (pure sort logic) | `npx vitest run src/hooks/useBetHistory.test.js` | ❌ Wave 0 |
| HIST-03 | Win=emerald, Loss=red, Pending=gray text — no badge classes | unit (color mapping) | `npx vitest run src/hooks/useBetHistory.test.js` | ❌ Wave 0 |
| HIST-04 | Empty array → empty state rendered (not blank table) | unit (branch logic) | manual-only — no DOM test framework | ❌ Wave 0 |
| STAT-01 | computeStats returns correct 4 metrics from bet array | unit (pure function) | `npx vitest run src/hooks/useBetHistory.test.js` | ❌ Wave 0 |
| STAT-02 | Stats derived from bets array prop (not bankroll table) | unit (data source check) | `npx vitest run src/hooks/useBetHistory.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/hooks/useBetHistory.test.js` (pure logic tests only — no Supabase mocking required)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/useBetHistory.test.js` — covers HIST-02, HIST-03, STAT-01, STAT-02 (pure logic; mock Supabase client)
- [ ] `vitest` and `@testing-library/react` install: `npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom` — no test framework exists in project
- [ ] `vite.config.js` — add `test: { environment: 'jsdom' }` block for vitest

**Note:** HIST-01 (column rendering) and HIST-04 (empty state rendering) require DOM testing. Without `@testing-library/react`, these are manual-only. The pure logic tests (sort order, color mapping, stat computation) can be unit-tested without DOM setup and are higher priority.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/sportsUtils.js` — confirmed `calcPayout`, `GLASS_CARD`, `DESIGN_COLORS` exports
- `src/components/dashboard/SportsBankroll.jsx` — confirmed auth+fetch pattern, CountUp usage
- `src/components/dashboard/PaperBettingSlip.jsx` — confirmed framer-motion stagger pattern
- `supabase/migrations/006_paper_sports_bets.sql` — confirmed schema columns added in Phase 1
- `package.json` — confirmed installed versions: framer-motion ^12.29.2, react-countup ^6.5.3, @supabase/supabase-js ^2.95.3, lucide-react ^0.563.0
- `.planning/phases/01-foundation/01-01-SUMMARY.md` — confirmed Phase 1 deliverables
- `.planning/phases/01-foundation/01-02-SUMMARY.md` — confirmed sportsUtils.js design token export
- `.planning/STATE.md` — confirmed open question re: win rate denominator convention

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — requirements scope and traceability
- `.planning/phases/02-bet-history-display/02-CONTEXT.md` — locked decisions and discretion areas

### Tertiary (LOW confidence)
- Original `paper_sports_bets` CREATE TABLE SQL not found in migrations — column names for matchup/sport/team/bet_type are inferred from context but not directly verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed installed with exact versions from package.json
- Architecture: HIGH — patterns directly sourced from existing project files (SportsBankroll, PaperBettingSlip)
- Pitfalls: HIGH — derived from project-specific decisions in CONTEXT.md and STATE.md
- Schema: MEDIUM — migration 006 columns confirmed HIGH; original table columns inferred from context

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (stable domain; schema changes would invalidate)
