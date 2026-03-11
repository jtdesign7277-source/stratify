# Requirements: Sportsbook Bet History

**Defined:** 2026-03-10
**Core Value:** Users can review their full bet history with exact details so they can track performance and learn from past bets

## v1 Requirements

### History Display

- [ ] **HIST-01**: User can view bet history table with columns: date/time, matchup, sport, bet amount, odds/spread, payout, result
- [ ] **HIST-02**: Bet history displays in reverse chronological order by default
- [ ] **HIST-03**: Win results shown in emerald, losses in red, pending in muted gray — plain colored text, no badges or pills
- [ ] **HIST-04**: Empty state shown when user has no bet history with guidance to place first bet

### Summary Stats

- [ ] **STAT-01**: Summary P&L header shows total wagered, total won, net P&L, win rate above the history table
- [ ] **STAT-02**: Stats update dynamically to reflect current filter selections

### Filtering & Sorting

- [ ] **FILT-01**: User can filter bets by result: All / Win / Loss / Pending
- [ ] **FILT-02**: User can filter bets by sport: NFL / NBA / MLB / NHL
- [ ] **FILT-03**: User can sort by date, amount, or result via column headers
- [ ] **FILT-04**: Filters and sorts apply client-side (no server round-trips needed)

### Integration

- [ ] **INTG-01**: Bet history accessible as a tab/section within the existing sportsbook page
- [ ] **INTG-02**: Design matches Stratify system exactly: bg-[#0a0a0f], glass panels with backdrop-blur-xl, border-white/10, emerald/cyan accents, monospace for numbers, no badges/pills — plain colored text only

## v2 Requirements

### Enhanced Filtering

- **EFLT-01**: User can filter by date range with preset windows (Today / 7d / 30d / All Time)
- **EFLT-02**: User can search/filter by team name

### Analytics

- **ANLT-01**: Win rate and ROI breakdown by sport
- **ANLT-02**: Net P&L trend indicator vs prior period
- **ANLT-03**: Current win/loss streak display

### Code Quality

- **QUAL-01**: Extract duplicated calcPayout to shared utility
- **QUAL-02**: Aggregate stats from paper_sports_bets directly (not bankroll table)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real money betting | Paper/simulated only — no regulatory complexity |
| Parlay / multi-leg display | High schema complexity — defer to v2+, but schema should accommodate |
| CSV / data export | Low demand for paper betting — add if users request |
| Real-time WebSocket bet updates | Bets resolve at game end, not tick-by-tick — cron is sufficient |
| Push notifications for results | Out of scope per PROJECT.md — users check history manually |
| Server-side pagination | Paper bet volume too low to justify — client-side fetch sufficient |
| Line movement / CLV tracking | Advanced feature requiring opening line storage — defer to v2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIST-01 | — | Pending |
| HIST-02 | — | Pending |
| HIST-03 | — | Pending |
| HIST-04 | — | Pending |
| STAT-01 | — | Pending |
| STAT-02 | — | Pending |
| FILT-01 | — | Pending |
| FILT-02 | — | Pending |
| FILT-03 | — | Pending |
| FILT-04 | — | Pending |
| INTG-01 | — | Pending |
| INTG-02 | — | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 0
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
