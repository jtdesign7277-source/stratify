---
name: soft-glass-ui
description: Apply soft glass and neumorphic design patterns to UI components, cards, widgets, and panels. Use this skill whenever the user mentions soft UI, neumorphism, soft glass, glassmorphism, widgets feeling flat, cards needing depth, panels needing character, components feeling lifeless, making UI feel premium/luxurious/easy on the eyes, or wants to add depth and dimension to any interface. Also trigger when styling Stratify dashboard cards, widget containers, data panels, or any component that needs to feel sculpted and tactile rather than flat. This skill applies to React/Tailwind, plain CSS, and any web UI context. Always use this skill when the user says things like "feels flat", "needs character", "too harsh", "softer", "premium feel", or "easy on the eyes".
---

# Soft Glass UI Design System

A design system for creating widgets, cards, and panels that feel sculpted, tactile, and premium - eliminating the flat, lifeless look of hard-bordered containers.

## Core Philosophy

Flat UI happens when cards rely solely on `border: 1px solid white/10` to define their edges. Soft Glass replaces hard borders with layered shadows, subtle gradients, and frosted transparency so elements feel like they grow from the page rather than sit on top of it.

The goal: every widget should feel like a physical object you could reach out and touch.

## The Three Techniques

### 1. Neumorphism (Soft Extrusion)

Elements appear gently pushed out from or pressed into the background surface. Created by pairing a dark shadow on one side with a subtle light shadow on the opposite side.

When to use: standalone cards, stat widgets, metric panels, buttons, toggles.

```css
/* Dark theme neumorphic card */
.card-raised {
  background: #0a0a0f;
  border-radius: 16px;
  border: none;
  box-shadow:
    8px 8px 16px rgba(0, 0, 0, 0.6),
    -4px -4px 12px rgba(255, 255, 255, 0.03);
}

/* Pressed/inset variant (for active states, input fields) */
.card-inset {
  background: #08080d;
  border-radius: 12px;
  box-shadow:
    inset 4px 4px 8px rgba(0, 0, 0, 0.5),
    inset -2px -2px 6px rgba(255, 255, 255, 0.02);
}
```

Tailwind approximation:

```jsx
<div className="bg-[#0a0a0f] rounded-2xl shadow-[8px_8px_16px_rgba(0,0,0,0.6),-4px_-4px_12px_rgba(255,255,255,0.03)]">
```

### 2. Glassmorphism (Frosted Glass)

Elements appear as frosted glass panels floating above a blurred background. Created with semi-transparent backgrounds + backdrop-blur.

When to use: overlays, modals, floating panels, navigation bars, tooltip cards.

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

Tailwind:

```jsx
<div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
```

### 3. Soft Glass (Combined - The Premium Look)

The best of both worlds: neumorphic depth + glass transparency. This is the premium, visionOS-inspired look.

When to use: primary dashboard widgets, data cards, trading panels - anything that needs to feel both substantial and elegant.

```css
.soft-glass {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.01) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

Tailwind:

```jsx
<div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)] [box-shadow:0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]">
```

## Stratify-Specific Tokens

For Stratify's dark theme (`bg-[#0a0a0f]`), use these calibrated values:

| Token | Value | Usage |
|-------|-------|-------|
| `--card-bg` | `rgba(255, 255, 255, 0.03)` | Card fill |
| `--card-bg-hover` | `rgba(255, 255, 255, 0.05)` | Card hover state |
| `--card-border` | `rgba(255, 255, 255, 0.06)` | Subtle perimeter |
| `--card-glow` | `rgba(16, 185, 129, 0.08)` | Emerald accent glow |
| `--shadow-soft` | `0 8px 32px rgba(0,0,0,0.4)` | Primary depth shadow |
| `--shadow-lift` | `0 2px 8px rgba(0,0,0,0.2)` | Close contact shadow |
| `--highlight-top` | `inset 0 1px 0 rgba(255,255,255,0.05)` | Top edge light catch |
| `--blur` | `blur(20px)` | Backdrop frost |
| `--radius` | `16px` | Standard card radius |
| `--radius-sm` | `12px` | Inner elements |
| `--radius-lg` | `24px` | Hero/feature cards |

## Component Recipes

### Dashboard Stat Card

```jsx
<div className="
  bg-gradient-to-br from-white/[0.04] to-white/[0.01]
  backdrop-blur-xl
  rounded-2xl
  border border-white/[0.06]
  shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]
  p-6
  transition-all duration-300
  hover:from-white/[0.06] hover:to-white/[0.02]
  hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3)]
  hover:border-white/[0.1]
">
  <div className="text-sm text-gray-400 mb-1">Portfolio Value</div>
  <div className="text-3xl font-bold font-mono text-white">$2,847,392.45</div>
  <div className="text-emerald-400 text-sm mt-1">+$12,847.32 (0.45%)</div>
</div>
```

### Hover Scale & Hover Lift (Micro-interaction)

Use on every card, tab, and panel so the element grows slightly and rises on hover (lifts off the page). Framer Motion:

```jsx
<motion.div
  whileHover={{ scale: 1.03, y: -2 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
>
  {/* card / tab / panel content */}
</motion.div>
```

- **Hover scale** — element grows slightly (e.g. 1.03).
- **Hover lift** — grows + rises (y: -2).
- **Micro-interaction** — the broader term for small responsive animations like this.

### Inset Data Field (for inputs, search bars, code blocks)

```jsx
<div className="
  bg-black/40
  rounded-xl
  shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)]
  border border-white/[0.04]
  px-4 py-3
">
  <input className="bg-transparent w-full text-white outline-none font-mono" />
</div>
```

### Floating Action Panel (modals, dropdowns, command palette)

```jsx
<div className="
  bg-white/[0.05]
  backdrop-blur-2xl
  rounded-2xl
  border border-white/[0.08]
  shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)]
  p-6
">
```

### Accent Glow Card (for highlighted/active items)

```jsx
<div className="
  bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02]
  backdrop-blur-xl
  rounded-2xl
  border border-emerald-500/20
  shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]
  p-6
">
```

## Rules

1. Never use only `border` to define a card. Every card needs at least a shadow for depth.
2. Layer shadows. Use 2-3 shadow values: a large soft shadow for depth, a small tight shadow for contact, and optionally an inset highlight for the top edge catching light.
3. Gradients over flat fills. Use `linear-gradient` or `bg-gradient-to-br` with subtle opacity differences (0.04 to 0.01) instead of a single flat `bg-white/5`.
4. Hover states must change depth. On hover, increase shadow spread and slightly brighten the background. The card should feel like it lifts toward you.
5. Border opacity stays low. Never go above `white/[0.1]` for resting state borders. They should whisper, not shout.
6. Backdrop blur is non-negotiable. Always add `backdrop-blur-xl` or higher. It's what makes the glass effect work.
7. Inner content inherits softness. Nested elements inside soft glass cards should use the inset style for inputs, or slightly more transparent glass for sub-sections.
8. Transitions on everything. Always add `transition-all duration-300` so depth changes feel smooth, not jarring.
9. **Hover scale & hover lift (micro-interaction).** Every card, tab, and panel should respond to hover with a slight grow + rise so it feels like it lifts off the page. In Framer Motion: `whileHover={{ scale: 1.03, y: -2 }}` with `transition={{ type: 'spring', stiffness: 400, damping: 30 }}`. This is the standard Stratify hover lift — apply to all interactive cards, tabs, and panels.

## Anti-Patterns (What Makes Things Look Flat)

| Flat Pattern | Soft Glass Fix |
|-------------|---------------|
| `border: 1px solid white/10` only | Add layered box-shadow + gradient bg |
| `bg-gray-900/50` flat fill | `bg-gradient-to-br from-white/[0.04] to-white/[0.01]` |
| No hover state | Hover lifts card: brighter bg + deeper shadow |
| Hard `rounded-lg` (8px) | Softer `rounded-2xl` (16px) or `rounded-3xl` |
| No backdrop-blur | Always `backdrop-blur-xl` minimum |
| Single shadow | Layer 2-3 shadows at different distances |
| Same style for all cards | Vary: raised for stats, inset for inputs, glass for panels |
| No inset top highlight | Add `inset 0 1px 0 rgba(255,255,255,0.05)` |

## Reference Inspirations

These products nail the soft glass aesthetic:
- Apple visionOS - frosted panels with subtle depth
- Linear - clean cards with soft shadows, no hard borders
- Arc Browser - glass panels with layered transparency
- Obsidian - dark theme with gentle depth cues
- Raycast - floating panels with premium glass feel
