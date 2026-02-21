# Twelve Data Migration Plan

## ✅ Current Status
- Twelve Data WebSocket → Real-time crypto/stock prices (working)
- Watchlists, global markets (London/Tokyo/Sydney) all working
- TradingView charts working

## 🎯 Goal
- **ALL market data** → Twelve Data (shared keys for all users)
- **Order execution** → User-specific broker connections only
- **Remove** → Shared Alpaca keys

---

## 📋 Endpoints to Migrate

### ✅ Already Using Twelve Data
- `/api/crypto/twelve-data-price` → Crypto prices
- WebSocket streaming (twelveDataStream.js)

### 🔄 Need to Update (Currently Using Shared Alpaca)

#### **Priority 1: Quote/Price Data**
- `api/quote.js` → Replace with `api/quote-twelve.js` ✅ (created)
- `api/crypto/latest-price.js` → Deprecated (use twelve-data-price.js)
- `api/sophia-insight.js` → Update to use Twelve Data

#### **Priority 2: Options Data**
- `api/options/chain.js` → **Keep on Alpaca** (Twelve Data doesn't support options)
- `api/options/flow.js` → **Keep on Alpaca** (Twelve Data doesn't support options)
- **Note:** Options require shared Alpaca keys or disable feature

#### **Priority 3: Already User-Specific** (No changes needed)
- `api/orders.js` → Uses user broker keys ✅
- `api/crypto/order.js` → Uses user broker keys ✅
- `api/account.js` → Uses user broker keys ✅
- `api/positions.js` → Uses user broker keys ✅

---

## 🚀 Implementation Steps

### Step 1: Update Quote Endpoints
Replace references to `/api/quote` with `/api/quote-twelve` in frontend

### Step 2: Remove Deprecated Crypto Endpoint
Delete `api/crypto/latest-price.js` (already replaced)

### Step 3: Update Sophia
Change Sophia to use Twelve Data for price lookups

### Step 4: Options Decision
**Choose one:**
- A) Keep shared Alpaca keys ONLY for options data
- B) Disable options feature until user connects broker
- C) Find alternative options data provider

---

## 📊 Final Architecture

```
Market Data (Display):
├── Twelve Data (shared keys)
│   ├── Stocks (US + 75 global exchanges)
│   ├── Crypto (BTC, ETH, SOL, etc.)
│   ├── Forex
│   ├── Commodities
│   └── ETFs
│
└── Alpaca (shared keys) - OPTIONAL
    └── Options data only

Order Execution:
└── User-specific broker keys (broker_connections table)
    ├── Alpaca (paper/live)
    ├── Tradier
    └── Webull
```

---

## ⚙️ Environment Variables

### Required (Shared for all users):
- `TWELVE_DATA_API_KEY` → Market data
- `VITE_TWELVE_DATA_API_KEY` → Frontend WebSocket

### Optional (Options only):
- `ALPACA_API_KEY` → Options chain data
- `ALPACA_SECRET_KEY` → Options flow data

### User-Specific (Database):
- Stored in `broker_connections` table with RLS
- Used ONLY for order execution
