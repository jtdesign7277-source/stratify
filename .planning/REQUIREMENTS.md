# Requirements: Sportsbook Bet History

**Defined:** 2026-03-10
**Core Value:** Users can review their full bet history with exact details so they can track performance and learn from past bets

## v1 Requirements

### History Display

- [x] **HIST-01**: User can view bet history table with columns: date/time, matchup, sport, bet amount, odds/spread, payout, result
- [x] **HIST-02**: Bet history displays in reverse chronological order by default
- [x] **HIST-03**: Win results shown in emerald, losses in red, pending in muted gray — plain colored text, no badges or pills
- [x] **HIST-04**: Empty state shown when user has no bet history with guidance to place first bet

### Summary Stats

- [x] **STAT-01**: Summary P&L header shows total wagered, total won, net P&L, win rate above the history table
- [x] **STAT-02**: Stats update dynamically to reflect current filter selections

### Filtering & Sorting

- [ ] **FILT-01**: User can filter bets by result: All / Win / Loss / Pending
- [ ] **FILT-02**: User can filter bets by sport: NFL / NBA / MLB / NHL
- [ ] **FILT-03**: User can sort by date, amount, or result via column headers
- [ ] **FILT-04**: Filters and sorts apply client-side (no server round-trips needed)

### Integration

- [ ] **INTG-01**: Bet history accessible as a tab/section within the existing sportsbook page
- [x] **INTG-02**: Design matches Stratify system exactly: bg-[#0a0a0f], glass panels with backdrop-blur-xl, border-white/10, emerald/cyan accents, monospace for numbers, no badges/pills — plain colored text only

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
| HIST-01 | Phase 2 | Complete |
| HIST-02 | Phase 2 | Complete |
| HIST-03 | Phase 2 | Complete |
| HIST-04 | Phase 2 | Complete |
| STAT-01 | Phase 2 | Complete |
| STAT-02 | Phase 2 | Complete |
| FILT-01 | Phase 3 | Pending |
| FILT-02 | Phase 3 | Pending |
| FILT-03 | Phase 3 | Pending |
| FILT-04 | Phase 3 | Pending |
| INTG-01 | Phase 3 | Pending |
| INTG-02 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 — traceability mapped after roadmap creation*
