# Dashboard Scroll Troubleshooting Runbook

Last updated: 2026-03-05

## Symptoms

- War Room, Calendar, or Trader news feed does not scroll with mouse wheel/trackpad.
- Scroll only works when pressing keyboard arrow keys.
- Localhost appears to show the "wrong UI" even after edits.

## Root Causes Found

1. Multiple Vite servers were running from different folders at the same time.
   - Example conflict:
     - `/Users/stratify/Desktop/stratify`
     - `/Users/stratify/iCloud Drive (Archive)/Documents/New project/stratify`
2. Local branch was behind `origin/main`, so localhost did not match live code.
3. Global Lenis smooth scroll intercepted nested panel scroll behavior inside dashboard tabs.
4. Critical scroll panes used hidden scrollbar styles, making scroll state harder to diagnose.

## Exact Fix Applied

### 1) Lenis dashboard safety in App root

File: `src/App.jsx`

- Added `allowNestedScroll: true` to Lenis config.
- Disabled Lenis entirely when `currentPage === 'dashboard'`.

This guarantees native scroll behavior for nested dashboard panes.

### 2) Explicit native scroll class

File: `src/index.css`

- Added `.scrollbar-show` class to force normal/native scroll behavior:
  - `-ms-overflow-style: auto`
  - `scrollbar-width: thin`
  - visible `::-webkit-scrollbar` track/thumb styles

### 3) Applied `.scrollbar-show` to affected panes

Files:

- `src/components/dashboard/WarRoom.jsx`
- `src/components/dashboard/EconomicsCalendarPage.jsx`
- `src/components/dashboard/TraderPage.jsx` (news list pane)

Changed key scroll containers from `scrollbar-hide` to `scrollbar-show`.

## Fast Recovery Steps (If It Happens Again)

### Step A: Kill all local Vite servers

```bash
lsof -nP -iTCP:5174 -sTCP:LISTEN || true
lsof -nP -iTCP:5175 -sTCP:LISTEN || true
lsof -nP -iTCP:5176 -sTCP:LISTEN || true
lsof -nP -iTCP:5177 -sTCP:LISTEN || true
lsof -nP -iTCP:5178 -sTCP:LISTEN || true

# Kill any listed PIDs
kill -9 <PID1> <PID2> <PID3> || true
```

### Step B: Verify each server PID path before trusting localhost

```bash
# For each PID from lsof:
lsof -a -p <PID> -d cwd -Fn | sed -n 's/^n//p'
```

Expected path for this repo:

`/Users/stratify/iCloud Drive (Archive)/Documents/New project/stratify`

### Step C: Sync local code with live branch

```bash
git fetch origin main
git rev-parse --short HEAD
git rev-parse --short origin/main
git pull --ff-only origin main
```

### Step D: Start one clean server only

```bash
npm run dev -- --host 127.0.0.1 --port 5176
```

### Step E: Hard refresh and retest

- Open: `http://127.0.0.1:5176/dashboard`
- Hard refresh: `Cmd+Shift+R`
- Test wheel/trackpad scrolling in:
  - Trader news feed
  - War Room
  - Calendar

## Verification Checklist

- `git status` is clean before testing.
- `HEAD` equals `origin/main` when comparing local vs live behavior.
- Only one Vite server process is running.
- Scroll works with wheel/trackpad, not just keyboard arrows.

## Prevention Rules

1. Never run multiple local dev servers for different Stratify folders at the same time.
2. Always `git pull --ff-only origin main` before debugging UI mismatch.
3. If nested scroll breaks, check Lenis config in `src/App.jsx` first.
4. Use `.scrollbar-show` for critical nested scroll panes where native behavior must be guaranteed.
