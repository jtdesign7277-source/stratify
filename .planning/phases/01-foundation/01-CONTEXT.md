# Phase 1: Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** User-provided Stratify Website Build Skill document

<domain>
## Phase Boundary

Phase 1 delivers the data layer and code foundation before any UI is built: schema audit, RLS, payout utility extraction, cron confirmation, and design system lock.

</domain>

<decisions>
## Implementation Decisions

### Surgical Mode (LOCKED)
- Every change must be scoped to explicitly named files only
- Do NOT modify any file, component, function, or style not explicitly listed
- This prevents regressions from broad changes

### Icon Rule (LOCKED)
- Never wrap icons in background containers
- Icons are always bare SVG with a color class only
- WRONG: `<div className="bg-emerald-500/20 p-2 rounded-lg"><Icon /></div>`
- RIGHT: `<Icon className="text-emerald-400 w-5 h-5" />`

### No Badge/Pill Styling (LOCKED)
- WRONG: `<span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Active</span>`
- RIGHT: `<span className="text-emerald-400 text-sm font-medium">Active</span>`

### Design System Colors (LOCKED)
- Background: `bg-[#0a0a0f]` always
- Accent: `#10b981` emerald only
- Positive: `text-emerald-400`
- Negative: `text-red-400`
- Muted: `text-gray-400`
- Dimmed: `text-gray-500`

### Typography (LOCKED)
- Font: Inter Variable
- Tickers: `font-mono font-semibold`
- Prices: `font-mono font-medium`
- Headers: `font-semibold tracking-tight`
- Section labels: `text-xs font-semibold tracking-widest text-gray-500 uppercase`

### Glass Card System (LOCKED)
- Standard Card: `bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]`
- Inset Field: `bg-black/40 rounded-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04]`
- Active/Accent Card: `bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]`
- Floating Panel: `bg-white/[0.05] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)]`

### Motion System (LOCKED)
- Spring presets: snappy (stiffness: 400, damping: 30), smooth (200, 25), button (500, 30)
- Hover lift on cards: `whileHover={{ y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}`
- Button press: `whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}`
- Tab indicator: `layoutId="tab-indicator"` with spring transition
- Stagger children: 0.04 delay, spring entrance
- Page transitions: opacity + y with spring

### Trading Patterns (LOCKED)
- PriceFlash: green/red flash to white on price change
- CountUp for animated portfolio values
- GSAP chart draw-in for path animations
- Lenis smooth scroll at root level only

### Auth Protection (LOCKED)
- Never touch Supabase auth logic when editing auth-adjacent pages
- Only replace visual/JSX layout, keep all handlers and state

### Anti-Patterns (LOCKED — never do these)
- Border only on cards → must use layered box-shadow plus gradient bg
- Flat bg-gray-900 → must use gradient from-white/[0.04]
- duration: 0.3 transitions → must use spring physics
- Icon inside colored box → bare icon with color class
- Colored background badge → plain colored text
- rounded-lg → minimum rounded-2xl
- No hover state → hover lifts card
- Single shadow → layer 2-3 shadows
- No backdrop-blur → minimum backdrop-blur-xl
- Static active tab → layoutId sliding indicator
- Static numbers → CountUp animated rollup
- Hard price update → PriceFlash

### Claude's Discretion
- Schema column names and types (guided by research findings)
- RLS policy implementation details
- calcPayout extraction approach (function signature, file location)
- Cron schedule verification method

</decisions>

<specifics>
## Specific Ideas

- All numeric values in future UI must use `font-mono font-medium`
- Win/loss colors: emerald-400 for wins, red-400 for losses, gray-400 for pending
- The glass card system classes should be stored as reusable constants or documented for Phase 2 UI work
- Installed libraries available: framer-motion, gsap, lenis, react-countup, geist font

</specifics>

<deferred>
## Deferred Ideas

- UI component creation (Phase 2)
- Filter controls and tab integration (Phase 3)
- Motion/animation implementation (Phase 2-3)

</deferred>

---
*Phase: 01-foundation*
*Context gathered: 2026-03-10 via user-provided build skill document*
