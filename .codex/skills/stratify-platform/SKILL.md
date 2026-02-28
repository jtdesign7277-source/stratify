---
name: stratify-platform
description: Build, refactor, and review Stratify platform features while enforcing cache-first market-data flows, tab preloading, terminal-pro dark UI patterns, Vercel serverless API architecture, and production delivery conventions. Use when work touches Stratify dashboard components, API routes, strategy builder behavior, market data streaming, deployment readiness, or AI search result rendering.
---

# Stratify Platform

Follow this skill for any Stratify product work.

## Quick Start

1. Read `references/platform-rules.md` first.
2. If the task changes UI/UX, read `references/design-system.md` before editing files.
3. If the task changes data fetching, API routes, tabs, or loading behavior, read `references/redis-caching.md` before editing files.
4. If the task includes both UI and data logic, read both reference files.

## Execution Workflow

1. Classify the task as `ui`, `data`, or `hybrid`.
2. Map affected files and integration points before coding.
3. Implement using Stratify hard rules (cache-first, no cold loads, error boundaries, Vercel-first APIs, Twelve Data `/quote`, `$` ticker formatting).
4. Add or update preloading for adjacent tabs when data is shown in tabbed views.
5. Ensure live data handoff uses cached snapshot first, then WebSocket updates.
6. Validate no secrets are hardcoded and env vars are used consistently.
7. Verify behavior with hard refresh and tab switching.

## Output Contract

When generating handoff prompts for Jeff:

- Output `🟢 CODEX PROMPT` for UI/visual implementation tasks.
- Output `🔵 CLAUDE CLI PROMPT` for code/logic implementation tasks.
- If task includes both, output both blocks in that order.
- Include Mission Control activity logging in all generated execution prompts by posting to `https://mission-control-seven-henna.vercel.app/api/activity` with `source`, `action`, `status`, and `duration`.

## References

- `references/platform-rules.md`: Canonical hard rules, architecture, delivery workflow, and search-result formatting.
- `references/design-system.md`: Terminal-pro visual system, UI patterns, and component quality bar.
- `references/redis-caching.md`: Cache-first fetch pattern, preloading behavior, and WebSocket handoff requirements.
