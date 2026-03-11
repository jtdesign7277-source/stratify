# Sportsbook Bet History

## What This Is

A bet history and tracking system within the existing Stratify sportsbook section. Users place simulated (paper) bets on major US sports (NFL, NBA, MLB, NHL), and every bet — win, loss, or pending — is logged to Supabase with full details. Users can browse, filter, and sort their complete betting history, and see summary P&L stats (total wagered, total won/lost, win rate) at a glance.

## Core Value

Users can review their full bet history with exact details (teams, amount, odds, date/time, result) so they can track performance and learn from past bets.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Sportsbook section exists with bet placement flow — existing
- ✓ Supabase database and auth — existing
- ✓ Dark theme design system (bg-[#0a0a0f], emerald/cyan accents, glass panels, terminal-pro) — existing
- ✓ Dashboard layout with sidebar navigation — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Supabase table to store bet records (teams, amount, odds/spread, date/time, result, sport/league)
- [ ] Bet history tab/section within the sportsbook page
- [ ] Table/list view of all bets in reverse chronological order
- [ ] Each row shows: date/time, teams (matchup), bet amount, odds/spread, result (win/loss/pending)
- [ ] Summary P&L stats at top: total wagered, total won, total lost, win rate
- [ ] Filter by date range, sport, win/loss result, team
- [ ] Sort by date, amount, or result
- [ ] Bets are logged automatically when placed and updated when resolved
- [ ] Design matches Stratify system exactly: glass panels, backdrop-blur-xl, border-white/10, no badges/pills, plain colored text

### Out of Scope

- Real money betting or payment integration — this is paper/simulated only
- Bet sharing or social features — personal history only
- Push notifications for bet results — users check history manually
- Mobile app — web only
- Parlay or exotic bet types for v1 — straight bets only

## Context

- Stratify is an AI-powered trading platform; the sportsbook is a section within the existing dashboard
- Paper trading pattern already exists (paper positions, paper P&L) — bet history follows similar approach
- Supabase is already used for user data, auth, and persistence
- Existing DataTable component pattern for positions/orders/trades can be adapted for bet history rows
- Design system is strictly enforced: bg-[#0a0a0f], emerald (#10b981) for wins/positive, red for losses, cyan accents, glass panels with backdrop-blur-xl, border-white/10, monospace for numbers, no badge/pill styling

## Constraints

- **Design**: Must match existing Stratify terminal-pro dark theme exactly — see CLAUDE.md design system section
- **Tech stack**: React + Vite + TailwindCSS frontend, Supabase for storage, Vercel serverless for any API endpoints
- **Integration**: Must live inside existing sportsbook section as a tab/section, not a separate page
- **No polling**: Use Supabase realtime or on-demand fetch — no setInterval polling for bet updates

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for storage | Already in use, supports RLS and realtime | — Pending |
| Paper/simulated bets only | Matches paper trading pattern, no regulatory complexity | — Pending |
| Table view (not cards) | Consistent with existing DataTable pattern for trades | — Pending |
| Inside sportsbook (not new page) | Keeps sportsbook self-contained, reduces nav complexity | — Pending |

---
*Last updated: 2026-03-10 after initialization*
