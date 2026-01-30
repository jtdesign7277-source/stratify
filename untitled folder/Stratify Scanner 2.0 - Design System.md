# Stratify Scanner 2.0 — Design System

Reference file: `Stratify Scanner 2.0.html`

---

## 🎨 Color Palette

### Backgrounds
| Name | Hex | Usage |
|------|-----|-------|
| `bg-dark` | `#0A0A0A` | Primary app background |
| `bg-warm` | `#1a0f0f` | Warm gradient top (subtle red tint) |
| `card-bg` | `rgba(255, 255, 255, 0.05)` | Card backgrounds |
| `card-border` | `rgba(255, 255, 255, 0.08)` | Card borders |

### Text
| Name | Hex | Usage |
|------|-----|-------|
| `text-1` | `#FFFFFF` | Primary text |
| `text-2` | `rgba(255, 255, 255, 0.6)` | Secondary text |
| `text-3` | `rgba(255, 255, 255, 0.35)` | Muted/tertiary text |

### Accent Colors
| Name | Hex | Usage |
|------|-----|-------|
| `green` | `#4ADE80` | Profit, positive, success, YES positions |
| `red` | `#F87171` | Loss, negative, NO positions |
| `blue` | `#60A5FA` | Kalshi platform, links, interactive |
| `orange` | `#FB923C` | Warnings, categories, highlights |
| `purple` | `#C084FC` | Polymarket platform, special |
| `yellow` | `#FACC15` | Alerts, attention |

### Platform Colors
| Platform | Color | Hex |
|----------|-------|-----|
| Polymarket | Purple | `#C084FC` |
| Kalshi | Blue | `#60A5FA` |

---

## 🔤 Typography

### Fonts
```css
/* Primary font - UI text */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Monospace - Numbers, prices, percentages */
font-family: 'JetBrains Mono', monospace;
```

### Font Weights
- `400` — Regular (body text)
- `500` — Medium (labels)
- `600` — Semibold (buttons, headers)
- `700` — Bold (values, titles)
- `800` — Extra Bold (hero numbers)

### Font Sizes
| Name | Size | Usage |
|------|------|-------|
| Hero Value | `48px` | Main stat (e.g., "3.09") |
| Section Title | `22px` | Section headers |
| Card Title | `17px` | Card headers |
| Body | `13-15px` | General text |
| Label | `11-12px` | Small labels, metadata |
| Micro | `10px` | Tab labels |

---

## 📐 Spacing & Layout

### Border Radius
| Size | Value | Usage |
|------|-------|-------|
| Small | `2px` | Chart bars |
| Medium | `16px` | Cards, buttons |
| Large | `24px` | Tab bar items |
| XL | `30px` | Floating tab bar |
| Phone | `44px` | Phone frame |

### Spacing Scale
```
4px   — Micro gaps
6px   — Icon gaps
8px   — Small gaps
10px  — Card gaps
12px  — Section spacing
14px  — Card padding (compact)
16px  — Card padding (standard)
20px  — Screen padding
28px  — Section margins
32px  — Large section gaps
```

### Card Styles
```css
.card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 16px;
}
```

---

## 🎯 Component Patterns

### Hero Card (Gradient)
```css
.hero-card {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 16px;
  padding: 20px;
}
```

### Metric Card (Small)
- Width: `100px` (fixed, horizontal scroll)
- Icon → Value → Label → Mini chart
- Each has accent color sparkline

### Opportunity Card
- Top: Category icon + name | Profit % (large, green)
- Middle: Two legs with platform color, market name, position, price
- Divider between legs
- Footer: Cost → Payout summary + arrow

### Floating Tab Bar
```css
.tab-bar {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 30, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 30px;
  padding: 6px;
}

.tab-item {
  padding: 10px 24px;
  border-radius: 24px;
}

.tab-item.active {
  background: rgba(255, 255, 255, 0.1);
}
```

---

## 📊 Chart Styles

### Sparkline (Line)
```svg
<path 
  d="M0 50 L20 45 L40 48 L60 35..." 
  stroke="#4ADE80" 
  stroke-width="2" 
  fill="none"
/>
<!-- Gradient fill below -->
<linearGradient>
  <stop offset="0%" stop-color="#4ADE80" stop-opacity="0.3"/>
  <stop offset="100%" stop-color="#4ADE80" stop-opacity="0"/>
</linearGradient>
<!-- End dot -->
<circle cx="end" cy="end" r="4" fill="#4ADE80"/>
```

### Bar Chart (Watchlist)
- Rounded bars (`rx="2"`)
- Mixed colors: green, blue, purple, orange, yellow
- Heights vary for visual interest
- Width: `6px` per bar, `4px` gap

---

## 🎭 Icons (Stroke Style)

All icons use:
```css
stroke="currentColor"
stroke-width="2"
fill="none"
```

### Key Icons
| Icon | Usage | SVG Path Hint |
|------|-------|---------------|
| ⚡ Lightning | Arbitrage, opportunity | `M13 2L3 14h9l-1 8 10-12h-9l1-8z` |
| 🔔 Bell | Notifications | `M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9` + `M13.73 21a2 2 0 0 1-3.46 0` |
| 📈 Trend Up | Progress, profit | `polyline points="23 6 13.5 15.5 8.5 10.5 1 18"` |
| 💰 Dollar | Volume, money | `M12 1v22` + S curve |
| 🏀 Clock/Timer | Sports category | Circle + clock hands |
| ₿ Bitcoin | Crypto category | Bitcoin symbol path |
| 📱 Grid | Dashboard, sources | Four squares |
| 👤 User | Profile | Head + shoulders |
| → Arrow | Navigate, expand | `polyline points="9 18 15 12 9 6"` |

### Notification Button
```css
.notification-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.notification-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  background: #F87171; /* red */
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  color: white;
  border: 2px solid #0A0A0A;
}
```

---

## 🌡️ Warm Gradient Background

The app has a subtle warm/red tint at the top:
```css
background: linear-gradient(180deg, 
  #1a0a0a 0%,    /* Warm dark red-tinted */
  #0d0606 30%,   /* Fading */
  #0A0A0A 100%   /* Pure dark */
);
```

---

## 📱 Mobile-First Principles

1. **No horizontal overflow** — Use horizontal scroll for metric cards
2. **Touch targets** — Minimum 44px tap areas
3. **Bottom nav** — Floating pill style, thumb-friendly
4. **Card-based UI** — Everything in rounded cards
5. **High contrast** — White text on dark, colored accents pop
6. **Monospace numbers** — JetBrains Mono for all financial data

---

## ✅ Do's and Don'ts

### Do ✅
- Use green for profit/positive
- Use monospace for all numbers
- Use subtle gradients on hero elements
- Add sparklines to metrics
- Use platform colors consistently (Purple=Poly, Blue=Kalshi)
- Include end-dots on chart lines
- Use `rgba()` for glass-like transparency

### Don't ❌
- No bright white backgrounds
- No serif fonts
- No sharp corners (always rounded)
- No pure black (`#000`) — use `#0A0A0A`
- No inline colors — use CSS variables
- No generic icons — use stroke-2 line icons

---

## 🗂️ Files

- `Stratify Scanner 2.0.html` — Reference implementation
- This document — Design system guide

---

*Last updated: January 2026*
