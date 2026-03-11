---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework in project |
| **Config file** | None — no automated tests |
| **Quick run command** | `npm run dev` (Vite dev server starts without errors) |
| **Full suite command** | `npm run dev` + manual Supabase dashboard checks |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run dev` — confirm no circular import warnings
- **After every plan wave:** Verify Vite dev server starts clean + manual Supabase checks
- **Before `/gsd:verify-work`:** All 4 success criteria verified
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INTG-02 | manual | Supabase dashboard: verify columns exist | N/A | ⬜ pending |
| 1-01-02 | 01 | 1 | INTG-02 | manual | Supabase dashboard: verify RLS policy | N/A | ⬜ pending |
| 1-02-01 | 02 | 1 | INTG-02 | manual | `npm run dev` — no import errors | N/A | ⬜ pending |
| 1-02-02 | 02 | 1 | INTG-02 | manual | Check vercel.json cron entries | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No automated test infrastructure exists in this project
- All Phase 1 verifications are manual (SQL dashboard + Vite console)
- `src/lib/sportsUtils.js` does not yet exist — created as part of Phase 1

*Existing infrastructure note: Manual verification is the correct approach for schema and import refactor tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema columns exist | INTG-02 | Database state, not testable in CI | Check Supabase dashboard → paper_sports_bets table → verify columns |
| RLS policy active | INTG-02 | Requires Supabase auth context | Query with second test account, expect zero rows |
| calcPayout deduplicated | INTG-02 | Import structure check | Search for `function calcPayout` — must appear only in sportsUtils.js |
| Cron scheduled | INTG-02 | Config verification | Read vercel.json, confirm settle-sports-bets entry |

---

## Validation Sign-Off

- [ ] All tasks have manual verify steps listed
- [ ] Sampling continuity: Vite dev server check after every commit
- [ ] Wave 0 gaps documented (no test framework — expected)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
