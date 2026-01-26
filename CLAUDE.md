# CLAUDE.md - Stratify Project Context

## Project Overview

**Stratify** — AI-powered trading platform that translates natural language into executable trading strategies.

### Core Flow
1. User describes strategy in plain English
2. AI translates input into backtestable strategy logic
3. User reviews backtest results and deploys
4. Bot scans markets for matching setups
5. Bot executes trades automatically

## Tech Stack

- **Frontend:** React
- **Backend:** Railway (hosted)
- **Broker API:** Alpaca (paper + live trading)
- **AI:** *(TBD - likely Claude for NL → strategy translation)*

## Project Structure

```
~/Desktop/Stratify/
├── frontend/          # React app
├── backend/           # Railway-deployed API
└── CLAUDE.md          # This file
```

## API Keys & Secrets

⚠️ **Never commit secrets to git**

- Alpaca keys: *(location TBD — likely .env or Railway env vars)*
- Other API keys: *(add as needed)*

## Architecture Decisions

*(Document key decisions here as we build)*

- [ ] Auth strategy (Clerk? Supabase? Custom?)
- [ ] Database (Postgres? Supabase? PlanetScale?)
- [ ] Strategy DSL/format (JSON? Custom syntax?)
- [ ] Backtest engine (custom? backtrader? vectorbt?)
- [ ] Real-time data source (Alpaca? Polygon? Both?)

## Current Status

🚧 **In Development**

---

*Last updated: Session start*
