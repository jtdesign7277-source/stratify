# Stratify - Complete Technical & Design Documentation

## 🌐 Live URL
**Production:** https://stratify-black.vercel.app

## 🛠️ Technology Stack

### Frontend Framework
- **React** v19.2.0 - Latest React with concurrent features
- **Vite** v7.2.4 - Next-generation frontend build tool

### Styling
- **Tailwind CSS** v4.1.18 - Utility-first CSS framework
- **PostCSS** v8.5.6 - CSS processing
- **Autoprefixer** v10.4.23 - Automatic vendor prefixes

### UI Libraries
- **Framer Motion** v12.29.0 - Animations and transitions
- **Lucide React** v0.563.0 - Icon library
- **Monaco Editor** v4.7.0 - Code editor (VS Code engine)

### Trading Integration
- **Alpaca Trade API** v3.1.3 - Stock trading API

### Deployment
- **Vercel** - Hosting and deployment
- **GitHub** - Version control (https://github.com/jtdesign7277-source/stratify.git)

---

## 🎨 Color Palette

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Background Dark | `#0D0D0D` | Main app background |
| Surface | `#1A1A1A` | Cards, panels |
| Surface Elevated | `#1E1E1E` | Headers, elevated elements |
| Border | `#2A2A2A` | Borders, dividers |

### Text Colors
| Name | Hex | Usage |
|------|-----|-------|
| Primary Text | `#F5F5F5` | Main text |
| Muted Text | `#6B6B6B` | Secondary text, labels |
| Placeholder | `#666666` | Input placeholders |

### Accent Colors
| Name | Hex | Usage |
|------|-----|-------|
| Purple Primary | `#8B5CF6` | Primary accent, gradients |
| Purple Light | `#A855F7` | Hover states |
| Blue Primary | `#3B82F6` | Secondary accent |
| Cyan Accent | `#22D3EE` | Tertiary accent |
| Indigo | `#6366F1` | Alternative accent |

### Status Colors
| Name | Hex | Usage |
|------|-----|-------|
| Success/Positive | `#34D399` (emerald-400) | Profits, success states, running |
| Error/Negative | `#F87171` (red-400) | Losses, errors, kill buttons |
| Warning | `#FBBF24` (yellow-400) | Pause, caution |
| Orange (Claude) | `#F97316` | AI/Claude branding |

### Gradient Combinations
```css
/* Primary Gradient */
background: linear-gradient(to right, #8B5CF6, #3B82F6);

/* Hero Text Gradient */
background: linear-gradient(to right, #A855F7, #3B82F6, #22D3EE);

/* Purple to Blue Glow */
background: radial-gradient(circle, rgba(139, 92, 246, 0.2), transparent);
```

---

## 📝 Typography

### Font Stack
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Monospace (Code/Numbers)
```css
font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
```

### Font Sizes
| Class | Size | Usage |
|-------|------|-------|
| `text-7xl` | 4.5rem (72px) | Hero headlines |
| `text-5xl` | 3rem (48px) | Section headlines |
| `text-2xl` | 1.5rem (24px) | Subheadlines |
| `text-xl` | 1.25rem (20px) | Large body |
| `text-sm` | 0.875rem (14px) | Body text, UI |
| `text-xs` | 0.75rem (12px) | Labels, captions |
| `text-[10px]` | 10px | Micro labels |

### Font Weights
- `font-bold` (700) - Headlines
- `font-semibold` (600) - Section titles, emphasis
- `font-medium` (500) - UI elements, buttons
- `font-normal` (400) - Body text

---

## 📐 Spacing & Layout

### Border Radius
| Class | Value | Usage |
|-------|-------|-------|
| `rounded-lg` | 0.5rem (8px) | Buttons, inputs |
| `rounded-xl` | 0.75rem (12px) | Cards |
| `rounded-2xl` | 1rem (16px) | Large cards |
| `rounded-3xl` | 1.5rem (24px) | Hero cards |
| `rounded-full` | 9999px | Pills, badges |

### Common Spacing
- `gap-2` (8px) - Tight spacing
- `gap-4` (16px) - Standard spacing
- `gap-6` (24px) - Comfortable spacing
- `gap-8` (32px) - Section spacing
- `p-3` / `p-4` - Card padding
- `px-4 py-2` - Button padding

---

## 🎬 Animations

### Keyframe Animations
```css
/* Pulse for live indicators */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Fade in for cards */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Grid movement (landing page) */
@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(80px, 80px); }
}

/* Floating orbs */
@keyframes float1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}
```

### Transition Defaults
```css
transition-colors /* Color changes */
transition-all duration-200 /* General transitions */
transition-transform duration-100 /* Micro-interactions */
```

---

## 🧩 Component Structure

### Main Layout
```
App
├── LandingPage (public)
│   ├── GridBackground (animated)
│   ├── Navigation
│   ├── Hero Section
│   ├── Feature Cards
│   ├── Strategy Templates
│   ├── Pricing
│   └── Footer
│
└── Dashboard (app)
    ├── TopMetricsBar
    │   ├── Daily P&L
    │   ├── Buying Power
    │   ├── Search Bar
    │   └── Net Liquidity
    │
    ├── Sidebar
    │   ├── Watchlist
    │   └── Saved Strategies
    │
    ├── DataTable (center)
    │   └── Strategy Cards
    │
    ├── TerminalPanel (bottom)
    │   └── Deployed Strategies
    │
    └── RightPanel
        └── AI Strategy Builder
```

---

## 📊 Data Display Patterns

### Currency Formatting
```javascript
new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
}).format(value);
```

### Positive/Negative Display
- Positive: `+$1,234.56` in `text-emerald-400`
- Negative: `-$1,234.56` in `text-red-400`
- Neutral: `$1,234.56` in `text-white`

### Percentage Display
- Win rates, changes: `67.3%`
- Always use `tabular-nums` for alignment

---

## 🔘 Button Styles

### Primary Button
```jsx
className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 
           text-white font-semibold rounded-lg 
           hover:from-purple-700 hover:to-blue-700 transition-all"
```

### Secondary Button
```jsx
className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg 
           text-white hover:bg-white/10 transition-colors"
```

### Ghost Button
```jsx
className="px-4 py-2 hover:bg-white/5 rounded-lg transition-colors"
```

### Danger Button (Kill)
```jsx
className="px-2 py-1 text-xs font-bold text-red-400 
           hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
```

### Warning Button (Pause)
```jsx
className="px-2 py-1 text-xs font-bold text-yellow-400 
           hover:text-yellow-300 hover:bg-yellow-500/10 rounded transition-colors"
```

---

## 📱 Responsive Behavior

- Desktop-first design
- Min-width approach for dashboard
- Grid columns collapse on smaller screens
- Sidebar collapsible

---

## 🔒 Mock Data Values

### Account
- Net Liquidity: `$125,840.00`
- Buying Power: `$251,680.00` (2x margin)
- Daily P&L: `+$1,247.83`

### Strategy Metrics
- Win Rate: `52-71%`
- Profit Factor: `1.65-2.67`
- Sharpe Ratio: `1.42-2.01`
- Max Drawdown: `9.8-18.7%`

---

## 📁 File Structure
```
/Stratify
├── src/
│   ├── App.jsx              # Main app + Landing page
│   ├── main.jsx             # Entry point
│   ├── index.css            # Global styles
│   ├── useAlpacaData.js     # Trading data hook
│   └── components/
│       └── dashboard/
│           ├── Dashboard.jsx
│           ├── TopMetricsBar.jsx
│           ├── Sidebar.jsx
│           ├── DataTable.jsx
│           ├── RightPanel.jsx
│           ├── TerminalPanel.jsx
│           ├── SearchBar.jsx
│           ├── StatusBar.jsx
│           ├── StockDetailView.jsx
│           ├── Watchlist.jsx
│           └── NewsletterModal.jsx
├── public/
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 🚀 Build & Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Deploy to Vercel
```bash
vercel --prod
```

---

*Last Updated: January 26, 2026*
