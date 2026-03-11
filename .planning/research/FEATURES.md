# Feature Research

**Domain:** Sportsbook bet history tracking — history storage, display, filtering, and P&L summary
**Researched:** 2026-03-10
**Confidence:** HIGH (core features), MEDIUM (differentiators)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any bet history system must have. Missing them makes the feature feel broken — users won't trust the data.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Reverse-chronological bet list | Universal default for any history view — users scan recent first | LOW | Standard DataTable pattern already exists in Stratify; reuse it |
| Date/time column | Every financial record shows when it happened | LOW | Store as ISO timestamp in Supabase; display in local time |
| Matchup column | Users identify bets by teams, not by IDs | LOW | "Chiefs vs Eagles" format — home @ away or neutral display |
| Bet amount (stake) column | Core financial data — what was risked | LOW | Monospace font, two decimal places, $ prefix |
| Odds/spread display | Users need to know what terms they bet at | LOW | Show as American odds (+150, -110) or point spread (+3.5) — match how they placed the bet |
| Result status (Win / Loss / Pending) | Users need to know outcome at a glance | LOW | Emerald for Win, red for Loss, gray/muted for Pending — matches Stratify color system exactly |
| Summary P&L stats header | Every trading/betting tool shows aggregate stats at the top | MEDIUM | Total wagered, total won, net P&L, win rate — four numbers, minimal layout |
| Filter by result | Users want to see only wins or only losses for review | LOW | Simple toggle/radio: All / Win / Loss / Pending |
| Filter by sport | NFL, NBA, MLB, NHL — users focus on sports they bet | LOW | Multi-select or tab group — four sports for v1 |
| Filter by date range | Standard for any financial history | MEDIUM | Preset ranges (Today, 7d, 30d, All Time) are simpler than a date picker for v1 |
| Automatic bet logging | Bets must appear in history without manual entry | MEDIUM | Write to Supabase at bet placement time; do not require user action |
| Automatic result resolution | Win/Loss must update automatically when game ends | HIGH | Requires a resolution mechanism — either a scheduled Vercel cron job or a Supabase function that checks game outcomes against an external scores API |
| Payout / return column | Users want to see what they received back, not just net | LOW | Payout = stake × odds multiplier for wins; 0 for losses |
| Sort by date, amount, result | Standard table sorting — users rearrange to find patterns | LOW | Click column header to sort; default is date desc |

### Differentiators (Competitive Advantage)

Features that go beyond what a basic history log provides and align with Stratify's trading-platform identity.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Win rate by sport breakdown | Shows users where they actually perform — makes history actionable, not just archival | MEDIUM | Aggregate query per sport; display as a small stat row or mini table below summary header |
| Net P&L trend indicator | A single arrow or delta vs prior period gives users momentum context without charts | LOW | Compare current 30d net vs prior 30d net — simple delta with up/down indicator |
| ROI percentage per sport | ROI = net profit / total wagered — the single most useful performance metric for bettors | LOW | Calculated client-side from filtered records; display alongside win rate |
| Streak tracking (current win/loss streak) | Traders care about streaks — maps well to Stratify's trading identity | MEDIUM | Computed from sorted results — count consecutive outcomes from most recent bet |
| Search/filter by team name | Users remember "I bet on the Lakers" not a date — team search is intuitive | LOW | Filter bet list client-side against team name strings in matchup field |
| Empty state with guidance | First-time users who haven't bet yet see a clear "place your first bet" prompt rather than a blank table | LOW | One sentence + link to bet placement — prevents confusion |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time result auto-push (WebSocket updates) | Seems exciting — bets resolve live | High complexity for little gain: bets resolve at game end, not tick-by-tick; WebSocket infra overhead is not justified for a paper betting history | Resolve results via a Vercel cron job that runs after game end windows (e.g., 11 PM ET nightly). Users check history — they don't need push. Matches the out-of-scope decision in PROJECT.md. |
| Parlay / multi-leg bet history display | Power users place parlays | Significant schema complexity (one bet = multiple legs); separate table or nested row pattern; edge cases multiply | Defer to v2. Document schema to support legs from day one so migration is clean, but don't render it in v1. |
| CSV / data export | Users want to analyze in spreadsheets | Adds a server endpoint, auth check, file generation, and download UI. For a paper/simulated system, low actual user demand. | Let users screenshot or copy values. Add export in v2 only if users request it. |
| Pagination with server-side cursor | "Correct" pattern for large datasets | Paper bet history for a single user grows slowly — hundreds of rows at most in v1. Server-side pagination adds round-trips and complexity. | Fetch all records for the user at once (client-side filter + sort). Add pagination only when row count actually becomes a UX problem. |
| Detailed odds line history / line movement | Advanced bettors care about CLV | Requires storing the opening line AND the line at bet placement — doubles odds data complexity. Out of scope for v1. | Store only the odds at bet placement time. Line movement is a v2+ differentiator. |
| Notifications / alerts on bet resolution | Feels engaging | Out of scope per PROJECT.md; adds notification infrastructure (email, push) that doesn't exist in Stratify; paper bets have no urgency | Users check history tab manually. Resolution is best-effort within ~24 hours via cron. |

---

## Feature Dependencies

```
[Supabase bets table]
    └──required by──> [Automatic bet logging on placement]
                          └──required by──> [Bet history list display]
                                               └──required by──> [Filter / sort controls]
                                               └──required by──> [Summary P&L header stats]

[Game result resolution mechanism (cron or external scores API)]
    └──required by──> [Win/Loss status on each row]
                          └──required by──> [Win rate by sport]
                          └──required by──> [ROI per sport]
                          └──required by──> [Streak tracking]

[Filter controls]
    └──enhances──> [Summary P&L header stats]
        (filtered view should update stats to reflect current filter)

[Search/filter by team]
    └──requires──> [Matchup stored as searchable string in Supabase]
        (not a foreign key to a teams table — plain text is sufficient and simpler)

[Win rate by sport]
    └──enhances──> [ROI per sport]
        (same aggregation query, different metric — build together)

[Streak tracking]
    └──requires──> [Sorted result list with timestamps]
        (needs chronological ordering to compute correctly)
```

### Dependency Notes

- **Supabase bets table is the root dependency.** Nothing else can be built until the schema is defined and the insert call is wired into bet placement.
- **Result resolution must be planned before building the history display.** If resolution is deferred, rows will show "Pending" forever — the history feature loses most of its value. The resolution mechanism (cron + scores API) is the highest-risk item.
- **Filtered stats require filter state to propagate.** The summary header must re-compute when filters change, so stats and list must share the same filtered dataset — not two separate queries.
- **Team search is client-side only.** No server-side search endpoint needed. Matchup strings like "Chiefs vs Eagles" are stored verbatim and filtered with `String.includes()` in the component.

---

## MVP Definition

### Launch With (v1)

Minimum to make the history feature useful and trustworthy.

- [ ] Supabase `bets` table with full schema (sport, teams, amount, odds, result, timestamps) — foundation for everything
- [ ] Auto-log bet to Supabase when user places a bet in the sportsbook — without this, history is empty
- [ ] Bet history tab inside the existing sportsbook section — table view, reverse-chronological, matches DataTable pattern
- [ ] Columns: Date/time, Matchup, Sport, Bet amount, Odds/spread, Payout, Result (Win/Loss/Pending)
- [ ] Summary P&L header: Total wagered, Total won, Net P&L, Win rate — four stats, always visible above the table
- [ ] Filter by result (All / Win / Loss / Pending) and filter by sport
- [ ] Sort by date (default desc), amount, result
- [ ] Result resolution mechanism: Vercel cron job that checks game outcomes and updates `result` field in Supabase
- [ ] Empty state for users with no bet history

### Add After Validation (v1.x)

Add once the core history is working and users are engaging with it.

- [ ] Win rate and ROI breakdown by sport — only useful once users have enough history to see a pattern (10+ bets)
- [ ] Filter by date range (preset windows: Today / 7d / 30d / All Time)
- [ ] Filter by team name (client-side search)
- [ ] Net P&L trend vs prior period (delta indicator)

### Future Consideration (v2+)

Defer until users explicitly request or product-market fit is established.

- [ ] Parlay / multi-leg bet history — schema should be designed to support legs, but don't render in v1
- [ ] CSV export — add only if users ask for it
- [ ] Streak tracking — nice analytics feature, not core to utility
- [ ] Closing line value (CLV) tracking — advanced bettor feature, requires storing opening lines

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Supabase bets table + schema | HIGH | LOW | P1 |
| Auto-log bets on placement | HIGH | LOW | P1 |
| Bet history table display | HIGH | LOW | P1 |
| Summary P&L header stats | HIGH | LOW | P1 |
| Result resolution (cron + scores API) | HIGH | HIGH | P1 — risky, must plan early |
| Filter by result / sport | HIGH | LOW | P1 |
| Sort controls | MEDIUM | LOW | P1 |
| Empty state | MEDIUM | LOW | P1 |
| Filter by date range | MEDIUM | LOW | P2 |
| Win rate / ROI by sport | MEDIUM | LOW | P2 |
| Filter by team name | MEDIUM | LOW | P2 |
| Net P&L trend indicator | LOW | LOW | P2 |
| Streak tracking | LOW | MEDIUM | P3 |
| CSV export | LOW | MEDIUM | P3 |
| Parlay display | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — history feature is non-functional without these
- P2: Should have — adds analytical value, add once P1 is stable
- P3: Nice to have — defer to v2

---

## Competitor Feature Analysis

Major sportsbooks (DraftKings, FanDuel, BetMGM) have bet history but consistently frustrate users with gaps. This is an opportunity.

| Feature | DraftKings | FanDuel | Our Approach |
|---------|------------|---------|--------------|
| History access | Via "Account Statement" buried in account menu | "Transaction History" tab | Dedicated tab inside sportsbook section — immediately accessible |
| Date filtering | Monthly presets only | Monthly presets | Preset windows (Today / 7d / 30d / All Time) — simpler than a calendar |
| Sport filtering | Not available in native UI | Not available | Available — filter by NFL / NBA / MLB / NHL |
| Aggregate P&L | Year-to-date only, hidden in account settings | Lifetime total, requires navigation | Always visible at top of history view — no navigation required |
| CSV export | Not native — requires third-party Chrome extension | Partial — requires developer console tricks | Not in v1 (matches actual user need better than incumbents) |
| Result status | Win / Loss shown | Win / Loss shown | Win / Loss / Pending — pending is critical for paper bets before resolution |
| ROI / win rate | Not shown | Not shown | Win rate shown in summary header — differentiator vs incumbents |

**Key insight from competitor research:** DraftKings and FanDuel both bury their history and P&L behind multiple navigation steps. Users frequently turn to third-party tools (OddsJam, RotoTracker, Bet-Analytix) just to see their own data. Building a clear, immediately accessible history tab with visible P&L stats is already better than the incumbents — without building anything exotic.

---

## Sources

- [The Hidden Ways to Find Your All-Time Profits/Losses at a Sportsbook — Action Network](https://www.actionnetwork.com/education/the-hidden-ways-to-find-your-all-time-profits-losses-at-a-sportsbook)
- [How Do I Find My Betting History on My Sports Betting App? — Betting Hero](https://bettinghero.com/help/sportsbook-faq/general-sportsbook-info/how-do-i-view-my-betting-history-on-my-sports-betting-app/)
- [How to Download and Export Bet History on DraftKings — Sportsbook Scout](https://www.sportsbookscout.com/sports-betting-guides/download-export-bet-history-draftkings-sportsbook)
- [How to Track Your Sports Bets — Boyd's Bets](https://www.boydsbets.com/tracking-sports-bets/)
- [Top Bet Tracking Apps — BettorEdge](https://www.bettoredge.com/post/top-bet-tracking-apps)
- [Sports Betting Analytics — RG.org](https://rg.org/guides/statistics/sports-betting-analytics)
- [UX Best Practices Playbook 2025 — Shape Games](https://www.shapegames.com/news/ux-best-practices-playbook)
- [NFL Sports Betting UX 2025 — The Unit](https://theunit.dev/blog/nfl-sports-betting-ux-2025/)

---

*Feature research for: Sportsbook bet history tracking*
*Researched: 2026-03-10*
