# Phase 3: Filters and Tab Integration - Research

**Researched:** 2026-03-11
**Domain:** React client-side filtering, framer-motion tab indicators, SportsOddsPage tab integration
**Confidence:** HIGH

## Summary

Phase 3 is entirely a React UI layer built on top of the already-complete Phase 2 data layer. No new API calls, no schema changes, no server round-trips. All work is client-side: filter/sort logic lives in JS, stats recompute from filtered arrays via the already-verified `computeStats` pure function, and framer-motion provides the animated tab indicator.

The integration point is `SportsOddsPage.jsx`. The page currently has no top-level view-switching tabs — it has only internal detail tabs (`DETAIL_TABS`) and a book selector. Adding a "History" tab means introducing a new `activeView` state (`'odds' | 'history'`) at the `SportsOddsPage` component level, then conditionally rendering either the existing odds UI or `BetHistoryTab` with filters.

The filter and sort logic requires no new libraries — plain `useMemo` over the `bets` array from `useBetHistory` covers all requirements. The framer-motion `layoutId` tab indicator pattern is already used in this file (`layoutId="book-tab"`, `layoutId="detail-tab"`), so the implementation follows an established local pattern.

**Primary recommendation:** Add `activeView` state to `SportsOddsPage`, introduce a two-tab strip ("Odds" | "History") using the `layoutId="tab-indicator"` framer-motion pattern, and move filter/sort state into `BetHistoryTab` or a thin wrapper component that owns it. All stat recomputation goes through the existing `computeStats` function.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Surgical Mode (LOCKED):** Only modify explicitly named files
- **Design System (LOCKED):** Background `bg-[#0a0a0f]`, accent `#10b981` emerald, positive `text-emerald-400`, negative `text-red-400`, pending `text-gray-400`, prices/amounts `font-mono font-medium`. Import `GLASS_CARD` and `DESIGN_COLORS` from `src/lib/sportsUtils.js`.
- **No Badge/Pill Styling (LOCKED):** Filter buttons must NOT use pill/badge styling. Use plain text buttons or tab-style controls with layoutId indicator.
- **Tab Indicator (LOCKED):** Use `framer-motion` `layoutId="tab-indicator"` for active tab slide. Spring transition: stiffness 400, damping 30.
- **Motion (LOCKED):** Spring presets for all transitions. Dropdown entrance: initial opacity 0, y -8, scale 0.98. Filter state changes should feel instant (no loading spinners).
- **Client-Side Only (LOCKED):** All filter/sort operations happen client-side from already-fetched data. No server round-trips for filtering. Stats must recompute when filters change.

### Claude's Discretion
- Filter button layout (horizontal row vs dropdown)
- Sort indicator styling (arrow direction)
- How to wire tab into SportsOddsPage (activeTab state management)
- Whether filters live inside BetHistoryTab or as a sibling component

### Deferred Ideas (OUT OF SCOPE)
- Date range filtering (v2)
- Team name search (v2)
- Win rate by sport breakdown (v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-01 | User can filter bets by result: All / Win / Loss / Pending | Client-side `filter()` on `bets` array by `status` field; `computeStats` rerun on filtered array |
| FILT-02 | User can filter bets by sport: NFL / NBA / MLB / NHL | Client-side `filter()` on `bets` array by `sport` field; composed with result filter via `useMemo` |
| FILT-03 | User can sort by date, amount, or result via column headers | `useMemo` sort on `created_at`, `stake`, `status` fields; toggle direction on second click |
| FILT-04 | Filters and sorts apply client-side (no server round-trips) | Confirmed: `useBetHistory` fetches all bets once, filter/sort applied in JS |
| INTG-01 | Bet history accessible as a tab/section within the existing sportsbook page | Add `activeView` state to `SportsOddsPage`; render `BetHistoryTab` when `activeView === 'history'` |
</phase_requirements>

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useMemo` | Built-in | Derived filtered/sorted arrays | Zero-cost memoization, re-derives only when deps change |
| React `useState` | Built-in | Filter state, sort state, activeView | Local UI state — no global store needed |
| framer-motion | Already installed (used throughout) | `layoutId` animated tab indicator, spring transitions | Already the project animation standard |
| `computeStats` (from useBetHistory.js) | Phase 2 deliverable | Recompute stats from any subset array | Pure function designed for this exact use case |
| `GLASS_CARD`, `DESIGN_COLORS` (sportsUtils.js) | Phase 1 deliverable | Design tokens | Locked by CONTEXT.md |

### No New Dependencies

Phase 3 requires zero new npm installs. All needed tools are already present.

---

## Architecture Patterns

### Recommended Project Structure (files touched)

```
src/
├── pages/
│   └── SportsOddsPage.jsx        # Add activeView state + tab strip (INTG-01)
├── components/dashboard/
│   └── BetHistoryTab.jsx         # Add filter row, sport filter, sort headers (FILT-01..04)
└── hooks/
    └── useBetHistory.js          # NO CHANGES — already correct
```

`BetHistorySummary.jsx` and `sportsUtils.js` are NOT modified — they already work correctly.

### Pattern 1: View-Switch Tab Strip in SportsOddsPage (INTG-01)

**What:** Add `activeView` state (`'odds' | 'history'`) at the top of `SportsOddsPage`. Render a two-button tab strip near the top of the scrollable column (above the odds header or just below `SportsBankroll`). Conditionally render either the full odds UI or `<BetHistoryView />`.

**When to use:** Single state variable, no router change — history stays scoped inside SportsOddsPage.

**Tab strip pattern (matches existing `book-tab` pattern in this file):**

```jsx
// Source: SportsOddsPage.jsx existing pattern (layoutId="book-tab", lines 1217-1228)
const [activeView, setActiveView] = useState('odds');

// Tab strip
<div className="flex items-center gap-1 bg-[#0f1117] rounded-xl p-0.5 border border-[#1e2028]">
  {['odds', 'history'].map((view) => (
    <motion.button
      key={view}
      onClick={() => setActiveView(view)}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      className={`relative px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        activeView === view ? 'text-white' : 'text-gray-500 hover:text-gray-400'
      }`}
    >
      {activeView === view && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.08]"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{view === 'odds' ? 'Odds' : 'History'}</span>
    </motion.button>
  ))}
</div>
```

**Conditional render (replaces the large odds block):**

```jsx
<AnimatePresence mode="wait">
  {activeView === 'history' ? (
    <motion.div key="history" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <BetHistoryView />
    </motion.div>
  ) : (
    <motion.div key="odds" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      {/* existing odds UI */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 2: Filter + Sort State Inside BetHistoryTab (FILT-01..04)

**What:** Add filter state (`resultFilter`, `sportFilter`, `sortKey`, `sortDir`) as `useState` inside `BetHistoryTab`. Derive `filteredBets` via `useMemo`. Pass `computeStats(filteredBets)` to `BetHistorySummary`.

**When to use:** Filters are purely display concerns of the history tab — co-locating state is simplest.

```jsx
// Inside BetHistoryTab.jsx
const [resultFilter, setResultFilter] = useState('all');   // 'all' | 'won' | 'lost' | 'pending'
const [sportFilter, setSportFilter] = useState('all');     // 'all' | 'NFL' | 'NBA' | 'MLB' | 'NHL'
const [sortKey, setSortKey] = useState('date');            // 'date' | 'stake' | 'result'
const [sortDir, setSortDir] = useState('desc');            // 'asc' | 'desc'

const filteredBets = useMemo(() => {
  let out = bets;
  if (resultFilter !== 'all') out = out.filter((b) => b.status === resultFilter);
  if (sportFilter !== 'all') out = out.filter((b) =>
    b.sport?.toUpperCase() === sportFilter || b.league?.toUpperCase() === sportFilter
  );
  // Sort
  out = [...out].sort((a, b) => {
    let av, bv;
    if (sortKey === 'date') { av = a.created_at; bv = b.created_at; }
    else if (sortKey === 'stake') { av = Number(a.stake); bv = Number(b.stake); }
    else if (sortKey === 'result') { av = a.status; bv = b.status; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return out;
}, [bets, resultFilter, sportFilter, sortKey, sortDir]);

const stats = computeStats(filteredBets);  // replaces existing stats derivation
```

### Pattern 3: Result Filter Row (FILT-01)

**What:** Horizontal row of plain-text buttons (All / Win / Loss / Pending) with `layoutId="result-indicator"` sliding underline/background.

```jsx
// No pill/badge. Tab-style with layoutId per CONTEXT.md LOCKED rule.
const RESULT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'won', label: 'Win' },
  { key: 'lost', label: 'Loss' },
  { key: 'pending', label: 'Pending' },
];

<div className="flex items-center gap-1">
  {RESULT_FILTERS.map(({ key, label }) => (
    <motion.button
      key={key}
      onClick={() => setResultFilter(key)}
      className={`relative px-3 py-1.5 text-xs font-semibold transition-colors rounded-lg ${
        resultFilter === key ? 'text-white' : 'text-gray-500 hover:text-gray-400'
      }`}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {resultFilter === key && (
        <motion.div
          layoutId="result-indicator"
          className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.08]"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </motion.button>
  ))}
</div>
```

### Pattern 4: Sport Filter Row (FILT-02)

**What:** Same tab-style pattern for NFL / NBA / MLB / NHL. Uses `layoutId="sport-indicator"` (different ID from result-indicator to avoid shared animation). Can be shown as "All sports" + sport keys.

**Sport value mapping:** The `sport` column in `paper_sports_bets` comes from `SportsOddsPage` payload. Looking at `NAV_SECTIONS`, the sport key is the full Odds API key (e.g. `basketball_nba`). The `sport` field in the INSERT is `bet.sport` from the payload. From `addBetToSlip` callback, `sport: payload.sport` — which is set in `GamesPanel`. Filter by checking if `b.sport` includes the league abbreviation or comparing `b.league` field.

**Safe approach:** filter on `b.league` field (which holds e.g. `'NBA'`, `'NFL'`) since that is the explicit league name stored in the INSERT. If `b.league` is null, fall back to sport string matching.

```jsx
const SPORT_FILTERS = ['all', 'NFL', 'NBA', 'MLB', 'NHL'];

if (sportFilter !== 'all') {
  out = out.filter((b) =>
    (b.league ?? b.sport ?? '').toUpperCase().includes(sportFilter)
  );
}
```

### Pattern 5: Sortable Column Headers (FILT-03)

**What:** Column headers for Date, Stake, Result become clickable. Clicking same column reverses direction. A small arrow indicator (up/down) shows current sort column and direction. Non-sortable columns (Matchup, Sport, Odds, Payout) remain plain headers.

```jsx
function SortableHeader({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.sortKey;
  return (
    <th
      onClick={() => onSort(col.sortKey)}
      className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:text-gray-300 transition-colors select-none"
    >
      <span className="flex items-center gap-1">
        {col.label}
        {active && (
          <motion.span
            key={sortDir}
            initial={{ opacity: 0, y: sortDir === 'asc' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="text-emerald-400"
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </motion.span>
        )}
      </span>
    </th>
  );
}

// onSort handler
function handleSort(key) {
  if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  else { setSortKey(key); setSortDir('desc'); }
}
```

### Anti-Patterns to Avoid

- **Do not re-fetch from Supabase when filters change.** `useBetHistory` fetches once on mount. All filter/sort is `useMemo` over the already-fetched `bets` array.
- **Do not use pill/badge styling for filter buttons.** Locked by CONTEXT.md. Use tab-style with `layoutId` sliding indicator.
- **Do not add a loading spinner when filters change.** Client-side filter is synchronous — zero delay. Spinners are banned for this operation per CONTEXT.md.
- **Do not use separate `layoutId` values for result and sport indicators if they might animate across each other.** Use distinct IDs (`"result-indicator"`, `"sport-indicator"`) to keep each group independent.
- **Do not render BetHistoryTab outside the scrollable column.** The right sidebar (Sharp Money, Line Moves) should remain visible when on the odds view but not shown on the history view — history takes the full main column.
- **Do not modify useBetHistory.js** — it is already correct and complete.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stats from filtered bets | Custom stats loop | `computeStats(filteredBets)` | Already pure, already tested, handles edge cases |
| Animated tab indicator | CSS transitions or JS offset calculation | `framer-motion layoutId` | Already used in same file — battle-tested, zero additional code |
| Sort stability | Custom stable sort | Spread + `.sort()` | V8 Array.prototype.sort is stable since Node 11 / Chrome 70 — no polyfill needed |

---

## Common Pitfalls

### Pitfall 1: Sport Field Value Mismatch
**What goes wrong:** The filter checks `b.sport === 'NBA'` but `b.sport` is `'basketball_nba'` (the Odds API sport key).
**Why it happens:** The INSERT in `SportsOddsPage` sets `sport: bet.sport` where `bet.sport` comes from `addBetToSlip` which receives `payload.sport`. The payload sport value comes from `GamesPanel`/`GameDetailView` which use the full Odds API key (`basketball_nba`, `ice_hockey_nhl`, etc.).
**How to avoid:** Filter using `b.league` field first (which is the human-readable league name like `'NBA'`), with `.toUpperCase().includes(sportFilter)` as fallback. Verify actual stored values before hardcoding equality checks.
**Warning signs:** Sport filter shows zero results even when bets exist for that sport.

### Pitfall 2: layoutId Collision With Existing Indicators
**What goes wrong:** Using `layoutId="tab-indicator"` for the result filter row causes framer-motion to animate the same element shared with the SportsOddsPage view-switch tabs.
**Why it happens:** `layoutId` is shared across the entire React tree within the same `LayoutGroup`.
**How to avoid:** Use distinct `layoutId` values: `"view-tab-indicator"` for the Odds/History toggle, `"result-indicator"` for All/Win/Loss/Pending, `"sport-indicator"` for sport filter. Per CONTEXT.md, the locked name `"tab-indicator"` refers to the Odds/History toggle.
**Warning signs:** Clicking a result filter causes the page-level tab indicator to animate.

### Pitfall 3: Mutating the Bets Array Before Sort
**What goes wrong:** `.sort()` mutates the source array in-place, causing `bets` from the hook to be permanently re-ordered.
**Why it happens:** `bets` is a React state array — mutating it directly can cause stale renders or corrupted filter state.
**How to avoid:** Always spread before sort: `[...out].sort(...)`. The code example above already does this.

### Pitfall 4: Stats Showing Total Instead of Filtered
**What goes wrong:** `BetHistorySummary` shows stats for all bets even when a filter is active.
**Why it happens:** The existing `BetHistoryTab` derives stats from `statsProp ?? computeStats(bets)` where `bets` is the full prop. After adding filters, `computeStats` must receive `filteredBets`, not the raw `bets` prop.
**How to avoid:** Remove the `stats` prop computation fallback (`statsProp ?? computeStats(bets)`). Instead, always compute `computeStats(filteredBets)` inside the component after deriving `filteredBets`. Remove the `stats` prop from `BetHistoryTab`'s public interface (or keep it as optional override but never pass it from the parent — let the component own it internally).

### Pitfall 5: Surgical Mode Violations
**What goes wrong:** Extra files get modified that weren't explicitly named, or new files are created unnecessarily.
**Why it happens:** It feels "cleaner" to extract filter logic into a new component.
**How to avoid:** All filter/sort state and UI goes inside `BetHistoryTab.jsx`. Tab strip goes into `SportsOddsPage.jsx`. Those are the only two files that change.

---

## Code Examples

### Stats-from-filtered pattern (STAT-02 compliance)

```jsx
// Inside BetHistoryTab.jsx — after computing filteredBets via useMemo
// Source: useBetHistory.js — computeStats is designed for any subset (verified in hook comments)
const stats = computeStats(filteredBets);

// Pass to summary strip
<BetHistorySummary stats={stats} />
```

### Filter composition (both result + sport active simultaneously)

```jsx
// useMemo — filters compose; both active simultaneously (FILT-01 + FILT-02)
const filteredBets = useMemo(() => {
  let out = bets;
  if (resultFilter !== 'all') {
    out = out.filter((b) => b.status === resultFilter);
  }
  if (sportFilter !== 'all') {
    out = out.filter((b) =>
      (b.league ?? '').toUpperCase().includes(sportFilter) ||
      (b.sport ?? '').toUpperCase().includes(sportFilter)
    );
  }
  out = [...out].sort((a, b) => {
    let av, bv;
    if (sortKey === 'date') { av = a.created_at ?? ''; bv = b.created_at ?? ''; }
    else if (sortKey === 'stake') { av = Number(a.stake ?? 0); bv = Number(b.stake ?? 0); }
    else { av = a.status ?? ''; bv = b.status ?? ''; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return out;
}, [bets, resultFilter, sportFilter, sortKey, sortDir]);
```

---

## Existing Patterns Reference (from SportsOddsPage.jsx)

The `layoutId` tab indicator is already used twice in this file:
- `layoutId="book-tab"` — book selector (DraftKings / FanDuel / BetMGM), lines 1217-1222
- `layoutId="detail-tab"` — game detail view tab (Live SGP / Featured / etc.), lines 525-527

Both use `SPRING = { type: 'spring', stiffness: 400, damping: 30 }` — the same spring spec locked in CONTEXT.md.

The conditional main-panel rendering already uses `AnimatePresence mode="wait"` with `key` prop switching — the history tab follows the same structure.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found |
| Config file | None — Wave 0 task required |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILT-01 | Result filter narrows bets array and recomputes stats | unit | N/A — no test framework | ❌ Wave 0 |
| FILT-02 | Sport filter narrows bets and composes with result filter | unit | N/A | ❌ Wave 0 |
| FILT-03 | Sort by date/stake/result; second click reverses direction | unit | N/A | ❌ Wave 0 |
| FILT-04 | No fetch calls triggered on filter change | unit | N/A | ❌ Wave 0 |
| INTG-01 | History tab renders BetHistoryTab; Odds tab renders odds UI | manual | Visual verification in browser | N/A |

**Note:** This project has no test infrastructure. All FILT requirements can be manually verified by:
1. Opening the sportsbook page
2. Clicking History tab — confirms INTG-01
3. Placing test bets with different sports/results, then filtering — confirms FILT-01 and FILT-02
4. Clicking column headers — confirms FILT-03 and FILT-04 (observe no network requests in DevTools)

### Wave 0 Gaps

No automated test infrastructure exists. Given the manual-verification nature of this project and the absence of any test config, this phase does not require Wave 0 test setup. All verification is visual/manual per the existing project pattern.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-column filter inputs | Tab-style button strip with slide indicator | Project standard (CONTEXT.md) | Cleaner UI, no pills |
| CSS keyframe tab transitions | framer-motion layoutId spring | Already in use | Smooth shared-element animation |
| Server-side filter+sort | Client-side useMemo | Architecture decision (FILT-04) | Zero latency, works offline |

---

## Open Questions

1. **Sport field actual stored values**
   - What we know: INSERT sets `sport: bet.sport` where `bet.sport` = the full Odds API key like `basketball_nba`; `league: bet.league` is also stored
   - What's unclear: The exact `league` values stored — they come from `GamesPanel` via `payload.league`. `GamesPanel` is not visible in the read portion but receives `sportKey` (the Odds API key). The league field likely holds the human-readable name (NBA, NFL, etc.).
   - Recommendation: Before implementing sport filter equality check, add a `console.log(bets[0])` to confirm actual stored `sport` and `league` values. The filter logic above handles both cases safely.

2. **Where the History tab should appear in the layout**
   - What we know: `SportsOddsPage` return starts with `SportsBankroll`, then the odds header. The right sticky slip panel is always visible.
   - What's unclear: Whether the Odds/History tab strip should appear above the header (replacing the full main column), or just in the main column below `SportsBankroll`.
   - Recommendation: Place the tab strip immediately after `SportsBankroll` and before the odds header. When `activeView === 'history'`, skip the odds header/stat cards/left nav/right sidebar and render only `BetHistoryTab` in the main column (full width, no right sidebar needed).

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/pages/SportsOddsPage.jsx` — existing tab patterns, layout structure, `SPRING` constant, `layoutId` usage
- Direct code inspection: `src/components/dashboard/BetHistoryTab.jsx` — current props interface, existing `computeStats` usage
- Direct code inspection: `src/hooks/useBetHistory.js` — `computeStats` is pure and designed for any subset array (stated in file comments)
- Direct code inspection: `src/lib/sportsUtils.js` — `GLASS_CARD`, `DESIGN_COLORS` exports, zero-import rule
- Direct code inspection: `.planning/phases/03-filters-and-tab-integration/03-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- React docs (training knowledge): `useMemo` with array dependencies, no external verification needed — React API is stable
- framer-motion `layoutId` — behavior verified from existing usage in the codebase itself

### Tertiary (LOW confidence)
- Sport/league field actual stored values — inferred from INSERT code path, not directly observed from data

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — patterns copied directly from existing file patterns in SportsOddsPage
- Filter/sort logic: HIGH — standard JS array operations, verified `computeStats` is designed for subsets
- Sport field values: LOW — inferred from code path, needs runtime verification
- Pitfalls: HIGH — identified from direct code inspection

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable — no external dependencies, all internal code)
