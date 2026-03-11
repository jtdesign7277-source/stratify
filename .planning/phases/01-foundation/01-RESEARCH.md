# Phase 1: Foundation - Research

**Researched:** 2026-03-10
**Domain:** Supabase schema/RLS, payout utility extraction, Vercel cron scheduling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Surgical Mode:** Every change must be scoped to explicitly named files only. Do NOT modify any file, component, function, or style not explicitly listed.
- **Icon Rule:** Never wrap icons in background containers. Icons are always bare SVG with a color class only.
- **No Badge/Pill Styling:** Use plain colored text (`text-emerald-400`) not background spans.
- **Design System Colors:** Background `bg-[#0a0a0f]`, accent `#10b981` emerald only, positive `text-emerald-400`, negative `text-red-400`, muted `text-gray-400`, dimmed `text-gray-500`.
- **Typography:** Inter Variable, tickers `font-mono font-semibold`, prices `font-mono font-medium`, headers `font-semibold tracking-tight`, section labels `text-xs font-semibold tracking-widest text-gray-500 uppercase`.
- **Glass Card System:** Standard/Inset/Active/Floating variants as defined in CONTEXT.md (exact Tailwind class strings locked).
- **Motion System:** Spring presets snappy/smooth/button, hover lift `y: -2`, button press scale 1.02/0.96, tab indicator `layoutId="tab-indicator"`, stagger 0.04, page transitions opacity + y.
- **Trading Patterns:** PriceFlash, CountUp, GSAP draw-in, Lenis smooth scroll at root only.
- **Auth Protection:** Never touch Supabase auth logic when editing auth-adjacent pages.
- **Anti-Patterns:** No border-only cards, no flat bg-gray-900, no duration: 0.3, no icon-in-colored-box, no colored badge, no rounded-lg, no missing hover state, no single shadow, no missing backdrop-blur, no static tab indicator, no static numbers, no hard price update.

### Claude's Discretion

- Schema column names and types (guided by research findings)
- RLS policy implementation details
- calcPayout extraction approach (function signature, file location)
- Cron schedule verification method

### Deferred Ideas (OUT OF SCOPE)

- UI component creation (Phase 2)
- Filter controls and tab integration (Phase 3)
- Motion/animation implementation (Phase 2–3)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTG-02 | Design matches Stratify system exactly: bg-[#0a0a0f], glass panels with backdrop-blur-xl, border-white/10, emerald/cyan accents, monospace for numbers, no badges/pills — plain colored text only | Design system is locked in CONTEXT.md; Phase 1 is pre-UI so this requirement is fulfilled by locking the design system constants (glass card classes, color tokens) as reusable references for Phase 2 components |
</phase_requirements>

---

## Summary

Phase 1 is a code hygiene and schema correctness phase — no new UI, no user-visible changes. Four concrete problems need to be resolved before Phase 2 can build a working bet history UI:

1. The `paper_sports_bets` table may be missing columns the UI and cron depend on. The cron (`settle-sports-bets.js`) currently writes `actual_payout` and `settled_at`. The success criteria also requires `result_resolved_at` (not `settled_at`), `parlay_id` (nullable), and confirmation that `potential_payout` and `status` exist. The `SportsOddsPage.jsx` INSERT already writes `potential_payout` and `status`, so those likely exist — but `result_resolved_at` and `parlay_id` are not written anywhere in code today, meaning they may not exist in the schema.

2. RLS is either absent or unverified on `paper_sports_bets`. The cron uses the service-role key (bypasses RLS by design), but browser queries must be restricted to `auth.uid() = user_id`. This is not currently confirmed in any migration file.

3. `calcPayout` is implemented identically in two files — `SportsOddsPage.jsx` (line 24–27) and `PaperBettingSlip.jsx` (line 8–11) — and needs to be extracted once to `src/lib/sportsUtils.js`.

4. `/api/settle-sports-bets` IS already scheduled in `vercel.json` at `*/5 * * * *` (every 5 minutes, all day). No change is needed here — only verification and documentation.

**Primary recommendation:** Write one SQL migration file covering the missing columns and RLS policy, extract `calcPayout` to `src/lib/sportsUtils.js`, update both calling files to import it, and document the cron schedule as confirmed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | Already installed | Schema migration via Supabase dashboard SQL editor or migration file | Already the project DB layer |
| `supabase` (CLI) | N/A for this project | Migrations are tracked as `.sql` files in `supabase/migrations/` | Project already uses this pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new | — | Phase 1 adds no new npm packages | — |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure for Phase 1

```
supabase/migrations/
└── 006_paper_sports_bets.sql     # Schema columns + RLS (new file)

src/lib/
└── sportsUtils.js                # New: exports calcPayout

src/pages/
└── SportsOddsPage.jsx            # Remove local calcPayout, import from sportsUtils

src/components/dashboard/
└── PaperBettingSlip.jsx          # Remove local calcPayout, import from sportsUtils
```

### Pattern 1: Supabase Migration File

**What:** Add missing columns with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and enable RLS with a user-scoped policy.
**When to use:** Whenever the schema needs columns that don't exist yet, without destructive changes to existing data.
**Example:**
```sql
-- supabase/migrations/006_paper_sports_bets.sql

-- Add missing columns (safe: IF NOT EXISTS prevents errors if already present)
ALTER TABLE paper_sports_bets
  ADD COLUMN IF NOT EXISTS result_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS parlay_id uuid,
  ADD COLUMN IF NOT EXISTS actual_payout numeric,
  ADD COLUMN IF NOT EXISTS potential_payout numeric;

-- Confirm status column exists (written by SportsOddsPage on INSERT)
-- This is likely already present; ADD COLUMN IF NOT EXISTS is safe regardless
ALTER TABLE paper_sports_bets
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Enable Row Level Security
ALTER TABLE paper_sports_bets ENABLE ROW LEVEL SECURITY;

-- Drop policy if re-running migration
DROP POLICY IF EXISTS "Users see own bets" ON paper_sports_bets;

-- Restrict reads and writes to the owning user
CREATE POLICY "Users see own bets"
  ON paper_sports_bets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Confidence:** HIGH — `ADD COLUMN IF NOT EXISTS` is idempotent and safe to run against a live table.

### Pattern 2: Shared Utility Extraction

**What:** Move the duplicated `calcPayout` function to `src/lib/sportsUtils.js` as a named export.
**When to use:** Any time the same pure function appears in two or more files.
**Example:**
```javascript
// src/lib/sportsUtils.js

/**
 * Calculate total payout (stake returned + winnings) from American odds.
 * @param {number} stake - Amount wagered
 * @param {number|string} odds - American odds (e.g. +150, -110)
 * @returns {number} Total payout including stake
 */
export function calcPayout(stake, odds) {
  const n = Number(odds);
  if (n > 0) return stake * (n / 100 + 1);
  return stake * (100 / Math.abs(n) + 1);
}
```

Then in both calling files:
```javascript
// Remove the local function definition, add at top of imports:
import { calcPayout } from '../../lib/sportsUtils';   // PaperBettingSlip
import { calcPayout } from '../lib/sportsUtils';       // SportsOddsPage
```

**Confidence:** HIGH — straightforward refactor, function signature is identical in both files.

### Pattern 3: Cron Schedule Verification

**What:** Confirm `/api/settle-sports-bets` fires after major game windows.
**Current state:** Already in `vercel.json` at `"*/5 * * * *"` — fires every 5 minutes, 24/7.
**Assessment:** This schedule is more aggressive than needed (major games typically end by midnight ET) but is fully sufficient. No change required. The task is documentation-only: confirm the entry exists and note the schedule covers all game windows.

### Anti-Patterns to Avoid

- **Running raw `ALTER TABLE` without `IF NOT EXISTS`:** Will error if column already exists and break migration re-runs.
- **Using `supabase.from('paper_sports_bets').select()` without RLS enabled:** Any authenticated user could query all bets. RLS must be enabled before Phase 2 reads bet history.
- **Duplicating `calcPayout` in a third location:** Once extracted to `sportsUtils.js`, the rule is: any future file needing payout math imports from there.
- **Touching the `settle-sports-bets.js` cron to rename `settled_at` to `result_resolved_at`:** The success criteria says `result_resolved_at` must exist as a column — but the cron currently writes to `settled_at`. The correct resolution is to add `result_resolved_at` as an alias column, OR update the cron to write `result_resolved_at` instead. This is a decision point (see Open Questions).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent schema changes | Custom migration scripts with existence checks | `ADD COLUMN IF NOT EXISTS` in SQL | Native Postgres syntax, handles re-runs safely |
| Row-level data isolation | Manual `WHERE user_id = $1` in every query | Supabase RLS policy | Policy enforced at DB layer — can't be bypassed by app bugs |
| American odds payout math | Another inline function | `calcPayout` from `sportsUtils.js` | Already correct, push/moneyline/spread all handled |

**Key insight:** RLS enforcement at the database layer is the correct security model — it cannot be accidentally bypassed by a missing `where` clause in the frontend, unlike application-layer filtering.

---

## Common Pitfalls

### Pitfall 1: Column Already Exists

**What goes wrong:** Running `ALTER TABLE paper_sports_bets ADD COLUMN status text` fails if `status` already exists.
**Why it happens:** `SportsOddsPage.jsx` already INSERTs `status: 'pending'`, which means the column likely exists. Running the migration without `IF NOT EXISTS` throws a Postgres error.
**How to avoid:** Use `ADD COLUMN IF NOT EXISTS` for every column in the migration.
**Warning signs:** Supabase SQL editor returns `ERROR: column "status" of relation "paper_sports_bets" already exists`.

### Pitfall 2: RLS Blocks the Cron

**What goes wrong:** After enabling RLS, the cron (`/api/settle-sports-bets`) stops updating bets.
**Why it happens:** The cron uses the service-role key (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS. This is safe and intentional.
**How to avoid:** No action needed — service role always bypasses RLS. Document this so future developers don't panic when they see `ENABLE ROW LEVEL SECURITY` and worry about the cron.
**Warning signs:** If cron were using the anon key, it would be blocked. Verify `createClient(supabaseUrl, supabaseKey)` in the cron uses `SUPABASE_SERVICE_ROLE_KEY`, not `VITE_SUPABASE_ANON_KEY`. (It does — confirmed in `settle-sports-bets.js` line 68.)

### Pitfall 3: Circular Import from sportsUtils.js

**What goes wrong:** A gray-screen crash in production if `sportsUtils.js` imports from a file that imports `sportsUtils.js`.
**Why it happens:** Per CLAUDE.md critical rule #3 — circular imports cause immediate crashes.
**How to avoid:** `src/lib/sportsUtils.js` must import nothing from the project (pure utility functions only). No importing from components, pages, or other lib files.
**Warning signs:** Vite console shows circular dependency warning during build.

### Pitfall 4: settled_at vs result_resolved_at Column Name Mismatch

**What goes wrong:** The success criteria requires `result_resolved_at` but the cron writes `settled_at`. If only `result_resolved_at` is added as a column and the cron is not updated, the column will always be NULL.
**Why it happens:** The success criteria and the cron were written independently.
**How to avoid:** Either (a) add `result_resolved_at` as a column AND update the cron to write it, OR (b) treat `settled_at` as the canonical column and document that it serves the same purpose as `result_resolved_at`. Option (a) is recommended — keeps the schema aligned with the success criteria verbatim.
**Warning signs:** `result_resolved_at` is always NULL in Supabase after bets are settled.

### Pitfall 5: paper_sports_bankroll Not Initialized for New Users

**What goes wrong:** `initNewUser.js` currently creates a `profiles` row but does NOT insert a `paper_sports_bankroll` row. If a new user visits the sportsbook, `SportsBankroll.jsx` gracefully falls back to `$100,000.00` — but when they place a bet, `SportsOddsPage.jsx` line 1127 checks `if (!bankroll || totalStake > Number(bankroll.balance))` and will block placement (bankroll is null). The bet insert never fires.
**Why it happens:** `initNewUser.js` predates the sportsbook feature and was not updated when `paper_sports_bankroll` was added.
**How to avoid:** The migration or a separate task must ensure a `paper_sports_bankroll` row with `balance: 100000` is upserted for the user when they first place a bet, OR `initNewUser.js` must be updated to create the row. The safest surgical approach: add an UPSERT to `initNewUser.js` in the same task that resolves this.
**Warning signs:** New user clicks "Place Paper Bet" and nothing happens (silent fail at the bankroll check).

---

## Code Examples

### Complete Migration File

```sql
-- supabase/migrations/006_paper_sports_bets.sql
-- Phase 1: Add missing columns and enable RLS

ALTER TABLE paper_sports_bets
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS result_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_payout numeric,
  ADD COLUMN IF NOT EXISTS potential_payout numeric,
  ADD COLUMN IF NOT EXISTS parlay_id uuid;

ALTER TABLE paper_sports_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own bets" ON paper_sports_bets;
CREATE POLICY "Users see own bets"
  ON paper_sports_bets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### sportsUtils.js

```javascript
// src/lib/sportsUtils.js
// Shared sports betting utilities — no project imports (circular import prevention)

/**
 * Calculate total payout (stake + winnings) from American odds.
 * Push returns stake. Loss returns 0 (caller's responsibility).
 * @param {number} stake
 * @param {number|string} odds - American odds (+150 or -110)
 * @returns {number}
 */
export function calcPayout(stake, odds) {
  const n = Number(odds);
  if (n > 0) return stake * (n / 100 + 1);
  return stake * (100 / Math.abs(n) + 1);
}
```

### Update cron to write result_resolved_at

In `api/settle-sports-bets.js`, update the `.update()` call:
```javascript
await supabase
  .from('paper_sports_bets')
  .update({
    status: result,
    actual_payout: actualPayout,
    result_resolved_at: new Date().toISOString(), // was: settled_at
    home_score: homeScore,
    away_score: awayScore,
  })
  .eq('id', bet.id);
```

### initNewUser.js bankroll upsert addition

```javascript
// Add after the profiles upsert in initNewUser.js
await supabase
  .from('paper_sports_bankroll')
  .upsert(
    { user_id: userId, balance: 100000 },
    { onConflict: 'user_id', ignoreDuplicates: true }
  );
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `calcPayout` per file | Single `src/lib/sportsUtils.js` export | Phase 1 | Consistent payout math across all bet surfaces |
| `settled_at` column in cron | `result_resolved_at` per success criteria | Phase 1 | Schema aligns with requirements; Phase 2 can query `result_resolved_at IS NOT NULL` to filter resolved bets |

**Deprecated/outdated:**
- Local `calcPayout` in `SportsOddsPage.jsx`: Remove after `sportsUtils.js` is imported.
- Local `calcPayout` in `PaperBettingSlip.jsx`: Remove after `sportsUtils.js` is imported.
- `settled_at` in the cron update: Replace with `result_resolved_at` to match success criteria.

---

## Open Questions

1. **Does `paper_sports_bets` already have `actual_payout`, `potential_payout`, and `status` columns?**
   - What we know: `SportsOddsPage.jsx` inserts `potential_payout` and `status` — so these columns almost certainly exist. The cron updates `actual_payout` — so this likely exists too.
   - What's unclear: No migration file documents the original `paper_sports_bets` schema. The table was created outside the tracked migrations.
   - Recommendation: Use `ADD COLUMN IF NOT EXISTS` for all columns (idempotent). The planner should instruct the implementer to verify column presence in Supabase dashboard before running the migration, but the migration itself is safe to run regardless.

2. **Should `settled_at` be kept alongside `result_resolved_at`, or replaced?**
   - What we know: The cron currently writes `settled_at`. The success criteria requires `result_resolved_at`. They are semantically identical.
   - What's unclear: Whether any other code reads `settled_at` (quick grep found no reads in `src/`).
   - Recommendation: Replace `settled_at` with `result_resolved_at` in the cron update call. Add `result_resolved_at` as the new column name. Do not add `settled_at` to the migration (it may already exist from the table's original creation — leave it in place, just stop writing to it).

3. **Should `parlay_id` be `uuid` or `text`?**
   - What we know: Parlay functionality exists in `PaperBettingSlip.jsx` (toggle) but parlays are not yet persisted as linked bets with a shared ID. The column needs to accommodate a future group ID.
   - Recommendation: `uuid` — consistent with Supabase conventions for ID columns. Nullable (no parlays in Phase 1).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files in project |
| Config file | None — Wave 0 gap |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-02 | Design system constants locked before Phase 2 UI work | manual | Verify glass card classes documented in RESEARCH.md | ❌ Wave 0 |

**Note:** Phase 1 is infrastructure-only (schema migration, utility extraction, cron verification). All verifications are database-state checks and code-structure inspections, not automated test suite items. The primary verification is: run the migration against Supabase, confirm columns exist via dashboard, confirm RLS policy appears in the Auth/Policies section, confirm `calcPayout` import resolves without circular dependency warning in Vite dev server.

### Sampling Rate

- **Per task commit:** Manual verification steps listed in each task's success criteria
- **Per wave merge:** Vite dev server `npm run dev` starts without errors; no circular import warnings
- **Phase gate:** All 4 success criteria verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No automated test infrastructure exists in this project — all Phase 1 verifications are manual (SQL dashboard + Vite console)
- [ ] `src/lib/sportsUtils.js` does not yet exist — created as part of Phase 1

*(No existing test infrastructure to leverage — manual verification is the correct approach for schema and import tasks.)*

---

## Sources

### Primary (HIGH confidence)

- Direct file reads: `api/settle-sports-bets.js` — confirmed columns written by cron, confirmed service-role key usage
- Direct file reads: `src/pages/SportsOddsPage.jsx` — confirmed `calcPayout` local definition at line 24, confirmed INSERT payload including `potential_payout` and `status`
- Direct file reads: `src/components/dashboard/PaperBettingSlip.jsx` — confirmed duplicate `calcPayout` at line 8
- Direct file reads: `vercel.json` — confirmed `/api/settle-sports-bets` scheduled at `*/5 * * * *`
- Direct file reads: `src/lib/initNewUser.js` — confirmed no `paper_sports_bankroll` upsert present
- Direct file reads: `supabase/migrations/` — confirmed no migration covers `paper_sports_bets` schema

### Secondary (MEDIUM confidence)

- Supabase RLS documentation pattern: `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING (auth.uid() = user_id)` is the standard Supabase pattern for user-scoped tables. Confidence HIGH based on established Supabase patterns.
- `ADD COLUMN IF NOT EXISTS` idempotency: Standard Postgres DDL behavior since Postgres 9.6.

### Tertiary (LOW confidence)

- Assumption that `actual_payout`, `potential_payout`, and `status` columns exist in the live Supabase `paper_sports_bets` table. Evidence is strong (code writes them) but the live schema was not directly inspected.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, existing patterns only
- Architecture: HIGH — migration and import refactor are deterministic
- Pitfalls: HIGH — sourced directly from reading the actual codebase files
- Schema column names: MEDIUM — inferred from INSERT/UPDATE call sites; live schema not inspected

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable foundation — no fast-moving external dependencies)
