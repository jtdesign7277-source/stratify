# Stack Research

**Domain:** Bet history tracking — filter/sort table with Supabase persistence within existing React app
**Researched:** 2026-03-10
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

Already in the project — no new installs required for persistence or realtime.

| Technology | Version (installed) | Purpose | Why Recommended |
|------------|---------------------|---------|-----------------|
| `@supabase/supabase-js` | `^2.95.3` (already installed) | Bet storage, query, realtime updates | Already in use for auth and paper trading. The `postgres_changes` Realtime channel means bet status updates (pending → win/loss) propagate live without polling, satisfying the no-`setInterval` constraint. |
| React `useState` / `useMemo` | React 19 (already installed) | Client-side filter/sort state | The bet history dataset is small per user (hundreds of rows at most). All filtering and sorting can be done client-side in `useMemo` — no server-side query machinery needed. |
| TailwindCSS v4 | `^4.1.18` (already installed) | Styling the history table | Already in the project. The existing DataTable uses plain Tailwind utility classes — bet history follows the same pattern. No additional UI library needed. |

### Supporting Libraries

One new install is justified. Everything else should be sourced from what's already in the repo.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | `^4.1.0` | Format bet timestamps, compute date-range filter boundaries | Use for `format(date, 'MMM d, yyyy HH:mm')` on created_at values and for computing "last 7 days / last 30 days" filter boundaries. v4 is the current stable release with first-class timezone support. Do NOT use `new Date().toLocaleDateString()` for formatting — inconsistent across locales. |
| `@tanstack/react-table` | `^8.21.3` | Headless sort/filter/pagination logic | Use ONLY if the team decides to extract a reusable shared table component from DataTable. For a single-use bet history list, plain `useMemo` sort+filter is simpler and has no new dependency. See "What NOT to Use" below. |
| `lucide-react` | `^0.563.0` (already installed) | Icons: filter, sort arrows, win/loss indicators | Already installed. Use `Trophy`, `X`, `ChevronUp`, `ChevronDown`, `Filter`, `Calendar` icons. Do not add a separate icon library. |

### Development Tools

No new dev tools needed. The existing Vite + Tailwind v4 + `@vitejs/plugin-react` setup covers everything.

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase Dashboard SQL editor | Write and test RLS policies and migrations | Use the Supabase web dashboard to run `CREATE TABLE` and `CREATE POLICY` statements. No local migration tooling (Supabase CLI) is needed for a single-table addition. |
| Supabase Table Editor | Verify inserted rows and RLS behavior | Use during development to manually inspect bet records and confirm user isolation is working before wiring the frontend. |

## Installation

```bash
# New dependency — date formatting only
npm install date-fns@^4.1.0

# Everything else is already installed
# @supabase/supabase-js — already present
# lucide-react — already present
# framer-motion — already present (for any transition on tab switch)
# @tanstack/react-table — DO NOT install unless extracting a shared table component
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `useMemo` client-side filter/sort | `@tanstack/react-table` | Only if the project needs a reusable headless table abstraction shared across multiple features (bet history, trade history, order book). For a single-purpose list, the dependency overhead is not justified. |
| `date-fns` | `dayjs` | If the project already had `dayjs` installed. Neither is installed — `date-fns` is preferred because it is tree-shaken at the function level (imports only what you use), while `dayjs` requires plugin registration for timezone and range utilities. |
| `date-fns` | Native `Intl.DateTimeFormat` | For simple display-only formatting with no date arithmetic. If you only need to format timestamps and never compute ranges, skip `date-fns` entirely and use `Intl.DateTimeFormat` which is already available in the browser. |
| Supabase Realtime (`postgres_changes`) | `setInterval` + fetch | Never. Polling is explicitly banned in CLAUDE.md. Use Supabase Realtime for live bet status updates. |
| Supabase client direct from `src/lib/supabaseClient.js` | Vercel serverless endpoint | Only add a serverless function if the bet query requires secrets not safe to expose client-side. Supabase RLS enforces user isolation so the client can query directly with the anon key. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `setInterval` + fetch for status updates | Explicitly banned in CLAUDE.md. Creates race conditions and wastes API credits. | Supabase Realtime `postgres_changes` channel, subscribing to `UPDATE` events on the `bets` table filtered to the current user. |
| `@tanstack/react-table` for this feature alone | 47 KB added dependency for a feature that has ~5 columns and client-side data. Adds learning overhead with no tangible benefit over `useMemo` + native array sort. | `useMemo` with `Array.prototype.sort` and `Array.prototype.filter` — matches existing DataTable pattern in the codebase. |
| `moment.js` | 67 KB even with tree-shaking attempts; effectively deprecated in favor of `date-fns` and `dayjs`. | `date-fns` v4 |
| A separate UI component library (MUI DataGrid, AG Grid) | Breaks the Stratify terminal-pro design system. These components bring their own theming that conflicts with `bg-[#0a0a0f]` and `border-white/10` styles. | Hand-rolled table using Tailwind utility classes, following the existing DataTable.jsx pattern. |
| Supabase service role key on the frontend | The service role key bypasses RLS entirely — any user could read any other user's bets. | Anon key + RLS policy: `USING ((select auth.uid()) = user_id)` |

## Stack Patterns by Variant

**If bet volume grows to thousands of rows per user:**
- Add server-side pagination to the Supabase query: `.range(offset, offset + pageSize - 1)`
- The `useRealtime` subscription stays the same — just append new rows to the local state rather than re-fetching the full list
- Do NOT add `@tanstack/react-table` server-side pagination for this — it is simpler to implement directly

**If bet resolution becomes automated (cron or webhook):**
- The Vercel serverless function that resolves bets should use the Supabase service role key (server-side only, never exposed to the browser)
- Use `supabase.from('bets').update({ result: 'win', payout: X }).eq('id', betId)` — the Realtime subscription on the frontend picks up the UPDATE automatically

**If date range filter needs preset buttons ("Last 7 days", "This month"):**
- Use `date-fns` `subDays(new Date(), 7)` and `startOfMonth(new Date())` to compute filter boundaries client-side
- Pass start/end dates as filter state, apply in `useMemo` with `isAfter` / `isBefore`

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `date-fns@^4.1.0` | React 19, Vite 7, ESM | date-fns v4 is ESM-native. The project's `"type": "module"` in package.json is compatible. No CJS interop issues. |
| `@supabase/supabase-js@^2.95.3` | Supabase Realtime v2 API | The `supabase.channel().on('postgres_changes', ...)` API is stable in v2. Must enable Replication for the `bets` table in the Supabase dashboard (Realtime → Tables) before subscriptions fire. |
| `@tanstack/react-table@^8.21.3` | React 19 | Compatible if added later. v8 is headless and framework-agnostic; works with React 19 without any special configuration. |

## Sources

- `package.json` in project root — confirmed installed versions of supabase-js, lucide-react, framer-motion, react, tailwindcss
- [Supabase Realtime: Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — confirmed `postgres_changes` channel API (HIGH confidence)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — confirmed `(select auth.uid())` wrapper pattern for row-level policies (HIGH confidence)
- [TanStack Table v8 Docs](https://tanstack.com/table/v8/docs/guide/column-filtering) — confirmed current version 8.21.3, filter/sort API (HIGH confidence)
- [@tanstack/react-table npm](https://www.npmjs.com/package/@tanstack/react-table) — version 8.21.3 confirmed (HIGH confidence)
- [date-fns npm](https://www.npmjs.com/package/date-fns) — version 4.1.0 confirmed, ESM-native, timezone support in v4 (HIGH confidence)
- [@supabase/supabase-js npm releases](https://github.com/supabase/supabase-js/releases) — v2.x is current major, project is on 2.95.3 (HIGH confidence)

---
*Stack research for: Bet history tracking within existing React+Supabase app*
*Researched: 2026-03-10*
