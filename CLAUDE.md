# CLAUDE.md - Stratify Project Context

*Last updated: 2025-07-14*

## Project Overview

**Stratify** — AI-powered trading platform that translates natural language into executable trading strategies.

### Core Flow
1. User describes strategy in plain English
2. AI translates input into backtestable strategy logic
3. User reviews backtest results and deploys
4. Bot scans markets for matching setups
5. Bot executes trades automatically

---

## Tech Stack

| Layer | Tech | Location |
|-------|------|----------|
| Frontend | React + Vite + Tailwind | `/src/` |
| Backend | Node.js + Express | `/server/` ⚠️ **Railway deploys this** |
| Broker API | Alpaca | Keys in Railway dashboard |
| Python Backend | FastAPI | `/backend/` (not used in prod) |

---

## Key URLs

- **Local dev:** http://localhost:5173
- **Railway backend:** https://stratify-backend-production-3ebd.up.railway.app
- **GitHub:** github.com/jtdesign7277-source/stratify

---

## Project Structure

```
~/Desktop/Stratify/
├── src/                    # React frontend
│   ├── components/
│   │   └── dashboard/      # Dashboard components
│   ├── config.js           # API URL config
│   └── App.jsx             # Main app + landing page
├── server/                 # Node.js backend (RAILWAY DEPLOYS THIS)
│   └── src/index.js        # Express server + Alpaca endpoints
├── backend/                # Python/FastAPI (NOT in production)
├── .env.development        # Local API URL
├── .env.production         # Production API URL
└── CLAUDE.md               # This file
```

---

## Dashboard Components

| Component | File | Purpose |
|-----------|------|---------|
| Dashboard | `Dashboard.jsx` | Main layout, state management |
| Sidebar | `Sidebar.jsx` | VS Code-style nav (collapse/expand on hover) |
| TopMetricsBar | `TopMetricsBar.jsx` | P&L stats, search bar, theme toggle |
| DataTable | `DataTable.jsx` | Positions/orders/trades/balances |
| RightPanel | `RightPanel.jsx` | Portfolio chart, news |
| Watchlist | `Watchlist.jsx` | Tracked stocks with live quotes |
| SearchBar | `SearchBar.jsx` | Stock search (exact matches first) |
| StatusBar | `StatusBar.jsx` | Connection status |

---

## API Endpoints (Railway)

```
GET /api/health              # Health check
GET /api/public/search?q=    # Stock search (ranked by relevance)
GET /api/public/quote/:symbol # Real-time quote
GET /api/public/quotes?symbols= # Multiple quotes
```

---

## Environment Variables

**Frontend (.env.development / .env.production):**
- `VITE_API_URL` — Backend API URL

**Backend (Railway dashboard):**
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `PORT`

---

## Recent Changes (2025-07-14)

1. ✅ Search ranking — exact symbol matches first
2. ✅ Sidebar — VS Code style (hover to expand)
3. ✅ Watchlist — in sidebar, resizable height
4. ✅ GitHub → Railway auto-deploy connected
5. ✅ Removed Portfolio nav + Account N/A text

---

## TODO

- [ ] AI Builder section (core feature)
- [ ] Strategy backtesting engine
- [ ] Strategy deployment/execution
- [ ] User authentication
- [ ] Production launch (~1 month)

---

## Notes

- **Railway deploys `/server` (Node.js)**, not `/backend` (Python)
- Alpaca API keys are in Railway dashboard, not in code
- Frontend uses `VITE_API_URL` from env files
