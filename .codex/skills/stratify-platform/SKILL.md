---
name: stratify-platform
description: Master reference for building premium, production-quality UI on Stratify. Enforces surgical mode, auth protection, icon/badge rules, design system, soft glass cards, motion, and trading patterns. Use for all Stratify dashboard, components, and UI work.
---

# Stratify Website Build Skill

The complete master reference for building premium, production-quality UI on Stratify. Every prompt, every component, every interaction follows these rules.

## 🔒 RULE #1 — SURGICAL MODE (Non-Negotiable)

Every single Codex or Claude CLI prompt must start with this:

```
SURGICAL MODE: Do NOT modify any file, component, function, or style 
that is not explicitly named below. If it is not listed, do not touch it. 
Only edit the exact things specified. Nothing else.
```

This prevents Codex from "improving" things that were already working. The #1 cause of regressions is broad prompts that don't protect untouched files.

## 🔒 RULE #2 — AUTH PROTECTION

Any prompt that touches login, signup, or auth pages must include:

```
CRITICAL AUTH RULE: The existing Supabase authentication is fully working. 
Do NOT touch, replace, or rewrite any auth logic, Supabase client calls, 
session handling, or protected route logic. Only replace the VISUAL/JSX 
layout. Keep every existing function, onSubmit handler, Supabase signIn 
call, error handling, and auth state logic exactly as it is.
```

## 🔒 RULE #3 — ICON RULE (Zero Tolerance)

Never wrap icons in background containers. Ever.

**WRONG:** `<div className="bg-emerald-500/20 p-2 rounded-lg"><Icon /></div>`  
**WRONG:** `<div className="w-8 h-8 rounded-full bg-blue-500/20"><Icon /></div>`

**RIGHT:** `<Icon className="text-emerald-400 w-5 h-5" />`

No boxes. No circles. No pill backgrounds. Icons are always bare SVG with a color class only.

## 🔒 RULE #4 — NO BADGE/PILL STYLING

**WRONG:** `<span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Active</span>`  
**RIGHT:** `<span className="text-emerald-400 text-sm font-medium">Active</span>`

## 🔒 RULE #5 — NATURAL SCROLL, NO VISIBLE SCROLLBARS

All scrollable content (news article list, article body, watchlist, War Room, calendar, etc.) uses **natural scrolling only** — trackpad/mouse wheel — with **no visible scrollbar**.

- Use `scrollbar-hide` (or equivalent: `-ms-overflow-style: none; scrollbar-width: none;` plus `::-webkit-scrollbar { display: none }`) on every scroll container.
- **Never** use `scrollbar-show` or visible scrollbars in news sections, article picker list, or article body. Users scroll naturally; the UI must not show a scrollbar.
- This is a core part of the Stratify build: clean, minimal chrome; scroll is functional but invisible.

---

## 📦 Installed Libraries

| Library | Import | Purpose |
|--------|--------|---------|
| framer-motion | `import { motion, AnimatePresence } from 'framer-motion'` | Spring physics, hover, page transitions |
| gsap | `import { gsap } from 'gsap'` | Chart animations, stagger, complex timelines |
| lenis | `import Lenis from 'lenis'` | Smooth scroll |
| react-countup | `import CountUp from 'react-countup'` | Animated numbers, prices, P&L |
| geist | `import 'geist/dist/mono.css'` | Variable font |

---

## 🎨 Design System

### Colors

- **Background:** `bg-[#0a0a0f]` always. All new panels, modals, drawers, and full-page views MUST use this same background (or the documented gradient) for consistency across the app.
- **Accent:** `#10b981` emerald only
- **Positive:** `text-emerald-400`
- **Negative:** `text-red-400`
- **Muted:** `text-gray-400`
- **Dimmed:** `text-gray-500`

### Typography

- **Font:** Inter Variable
- **Tickers:** `font-mono font-semibold`
- **Prices:** `font-mono font-medium`
- **Headers:** `font-semibold tracking-tight`
- **Section labels:** `text-xs font-semibold tracking-widest text-gray-500 uppercase`

### Variable Font Hover Effect

```jsx
<span style={{
  fontVariationSettings: isHovered ? '"wght" 650' : '"wght" 500',
  transition: 'font-variation-settings 200ms ease'
}}>
  $AAPL
</span>
```

---

## 🪟 Soft Glass Card System

### Standard Card

```jsx
className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:from-white/[0.06] hover:to-white/[0.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:border-white/[0.1]"
```

### Inset Field (inputs, search bars)

```jsx
className="bg-black/40 rounded-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04]"
```

### Active/Accent Card

```jsx
className="bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]"
```

### Floating Panel (modals, dropdowns)

```jsx
className="bg-white/[0.05] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)]"
```

---

## 🌊 Premium Motion System

### Spring Presets

```jsx
const springSnappy = { type: 'spring', stiffness: 400, damping: 30 }
const springSmooth = { type: 'spring', stiffness: 200, damping: 25 }
const springButton = { type: 'spring', stiffness: 500, damping: 30 }
```

### Hover Lift (Cards)

```jsx
<motion.div
  whileHover={{ y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
>
```

### Button Press Physics

```jsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.96 }}
  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
>
```

### Hover Row (Watchlist)

```jsx
<motion.div
  whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
>
```

### Staggered List Entrance

```jsx
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } }
}
const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } }
}
```

### Page Transitions

```jsx
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  enter: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } }
}
```

### Tab Indicator Slide

```jsx
{active === tab && (
  <motion.div
    layoutId="tab-indicator"
    className="absolute inset-0 bg-white/10 rounded-lg"
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  />
)}
```

### Dropdown Entrance

```jsx
<motion.div
  initial={{ opacity: 0, y: -8, scale: 0.98 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.15 } }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
>
```

### Scroll Reveal

```jsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-50px' }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```

---

## 💹 Trading-Specific Patterns

### Price Flash

```jsx
function PriceFlash({ price, prevPrice }) {
  const direction = price > prevPrice ? 'up' : price < prevPrice ? 'down' : 'flat'
  return (
    <motion.span
      key={price}
      initial={{ color: direction === 'up' ? '#10b981' : direction === 'down' ? '#ef4444' : '#ffffff', scale: 1.05 }}
      animate={{ color: '#ffffff', scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="font-mono font-medium"
    >
      ${price.toFixed(2)}
    </motion.span>
  )
}
```

### Animated Portfolio Value

```jsx
<CountUp
  start={0}
  end={portfolioValue}
  duration={1.2}
  decimals={2}
  prefix="$"
  separator=","
  useEasing={true}
  key={ticker}
/>
```

### Chart Draw-In (GSAP)

```jsx
useEffect(() => {
  const path = chartRef.current.querySelector('path')
  const length = path.getTotalLength()
  path.style.strokeDasharray = length
  path.style.strokeDashoffset = length
  gsap.to(path, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out' })
}, [selectedTicker, selectedTimeframe])
```

### GSAP Staggered Card Entrance

```jsx
useEffect(() => {
  gsap.fromTo('.dashboard-card',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }
  )
}, [])
```

### Smooth Scroll (root level only)

```jsx
useEffect(() => {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  })
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf) }
  requestAnimationFrame(raf)
  return () => lenis.destroy()
}, [])
```

---

## 📋 Prompt Template

```
SURGICAL MODE: Do NOT modify any file, component, function, or style 
that is not explicitly named below. If it is not listed, do not touch it. 
Only edit the exact things specified. Nothing else.

In Stratify at http://localhost:5176, find ONLY [specific component/file].

[Numbered list of exact changes]

ONLY touch [file names]. Do not touch anything else.

Commit: "[type]: [description]"
```

---

## 🚫 Anti-Patterns

| Wrong | Right |
|-------|--------|
| Border only on cards | Layered box-shadow plus gradient bg |
| Flat `bg-gray-900` fill | `bg-gradient-to-br from-white/[0.04] to-white/[0.01]` |
| `duration: 0.3` transition | `type: spring stiffness: 400 damping: 30` |
| Icon inside colored box | Bare icon with color class only |
| Colored background badge | Plain colored text only |
| `rounded-lg` on cards | `rounded-2xl` minimum |
| No hover state | Hover lifts card toward user |
| Single shadow | Layer 2-3 shadows |
| No backdrop-blur | `backdrop-blur-xl` minimum |
| Static active tab | `layoutId` sliding indicator |
| Static numbers | CountUp animated rollup |
| Hard price update | PriceFlash green/red to white |

---

## 🏗️ Platform Architecture

| Layer | Tech | URL |
|-------|------|-----|
| Frontend | React + Vite + Tailwind | stratify-eight.vercel.app |
| Backend | Node.js | stratify-backend-production-3ebd.up.railway.app |
| Database/Auth | Supabase | Auth and user data |
| Cache | Upstash Redis | Cache-first all data |
| Market Data | Twelve Data Pro/quote plus WebSocket | |
| AI | Claude API | Strategy generation |
| Payments | Stripe | $19.99/mo |

**Never deploy from local. GitHub push triggers Vercel auto-deploy.**

---

## 🎨 Reference Platforms

| Platform | What to Study |
|----------|----------------|
| Robinhood | Variable font weight on hover, staggered list, price flash |
| Coinbase | Card lift on hover, animated portfolio total, tab indicator |
| Interactive Brokers | Chart draw-in, number rollup |
| NinjaTrader | Dense data table micro-interactions |
| Linear | Tab indicator slide, spring everything |
| Raycast | Floating panels, instant response feel |
| Apple visionOS | Frosted glass panels, soft extrusion |
