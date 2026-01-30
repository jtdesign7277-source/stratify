# Stratify Design Guide

## 🚨 CURRENT STANDARD: Kraken Style (Jan 2026)

All new Stratify development follows the Kraken design system.

---

## Color Palette

### Primary Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#06060c` | Page background |
| `bg-surface` | `#0a0a10` | Cards, panels |
| `bg-elevated` | `#12121a` | Hover states, elevated surfaces |
| `border` | `#1e1e2d` | All borders |
| `border-hover` | `#2a2a3d` | Border hover states |

### Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#e0e0e6` | Primary text |
| `text-muted` | `#6b6b80` | Secondary text, labels |

### Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `purple` | `#7B61FF` | Primary accent, gradients |
| `blue` | `#5B8DEF` | Secondary accent, links |
| `cyan` | `#00D9FF` | Highlights, charts |
| `emerald` | `#00E676` | Positive values, success |
| `red` | `#ff4d6a` | Negative values, errors |
| `amber` | `#F59E0B` | Warnings, P&L |

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  [Main Content]                    │ [Atlas]  │
│  Icons      │  ┌─────────────────────────────┐   │  AI      │
│  Hover to   │  │ Index Cards Row             │   │  Chat    │
│  expand     │  │ Portfolio|Strategies|Arb... │   │          │
│             │  ├─────────────────────────────┤   │          │
│             │  │ Collapsible Chart           │   │          │
│             │  │ (Purple/Blue gradient)      │   │          │
│             │  ├─────────────────────────────┤   │          │
│             │  │ Tabs: Strategies|Arb|Deploy │   │          │
│             │  ├─────────────────────────────┤   │          │
│             │  │ Content Area                │   │          │
│             │  │ (DataTable, Panels, etc.)   │   │          │
│             │  └─────────────────────────────┘   │          │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Styling

### Index Cards
```jsx
<div className="flex-1 min-w-[140px] p-4 rounded-xl border 
  bg-gradient-to-br from-purple-500/20 to-purple-600/10 
  border-purple-500/30 hover:border-purple-500/50">
```

### Buttons
```jsx
// Primary
<button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 
  text-white rounded-lg hover:from-purple-500 hover:to-blue-500">

// Secondary
<button className="px-4 py-2 bg-[#1e1e2d] text-white rounded-lg 
  hover:bg-[#2a2a3d]">

// Ghost
<button className="px-4 py-2 text-[#6b6b80] hover:text-white 
  hover:bg-[#12121a] rounded-lg">
```

### Status Badges
```jsx
// Connected
<div className="flex items-center gap-2 px-3 py-1.5 
  bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
  <span className="text-emerald-400 text-sm">Connected</span>
</div>
```

### Tabs
```jsx
// Active
<button className="px-4 py-2 bg-[#1e1e2d] text-white rounded-lg">

// Inactive
<button className="px-4 py-2 text-[#6b6b80] hover:text-white 
  hover:bg-[#12121a] rounded-lg">
```

---

## Chart Styling

### Portfolio Growth Chart
- Line gradient: `#7B61FF` → `#5B8DEF`
- Area fill: Same gradient with 40% → 0% opacity
- Grid lines: `#1e1e2d`
- Axis labels: `#6b6b80`, monospace font

### Sparklines
- Positive: `#00D9FF` (cyan)
- Negative: `#ff4d6a` (red)
- Area fill: Same color at 30% opacity

---

## Typography

### Font Stack
- Headers: System sans-serif, `font-semibold`
- Body: System sans-serif
- Numbers/Data: `font-mono tabular-nums`

### Sizes
- Page title: `text-lg font-semibold`
- Card title: `text-sm font-medium`
- Card value: `text-xl font-bold font-mono`
- Labels: `text-xs text-[#6b6b80]`

---

## Spacing

- Card padding: `p-4`
- Section gaps: `gap-4`
- Border radius: `rounded-xl` (12px) for cards, `rounded-lg` (8px) for buttons

---

## Key Files

| File | Purpose |
|------|---------|
| `KrakenDashboard.jsx` | Main dashboard layout |
| `Sidebar.jsx` | Left navigation |
| `RightPanel.jsx` | Atlas AI chat |
| `DataTable.jsx` | Strategy list |
| `ArbitragePanel.jsx` | Arb scanner |
| `TerminalPanel.jsx` | Deployed strategies |
| `SettingsPage.jsx` | Settings overlay |

---

## Links

- **Live:** https://stratify-black.vercel.app
- **GitHub:** github.com/jtdesign7277-source/stratify
- **Reference:** Kraken.com (crypto exchange UI)

---

*Last updated: January 30, 2026*
