# Order Ticket - How It Works

## 🎯 Two Separate Systems

### 1️⃣ **PRICE DISPLAY** (What You See)
**Powered by:** Twelve Data (hardwired shared keys)  
**Works for:** Everyone, no broker connection needed  

**What it does:**
- Shows current market price (e.g., "BTC = $50,234.56")
- Calculates estimated cost (e.g., "2 × $50,234.56 = $100,469.12")
- Updates in real-time via WebSocket
- Works for stocks, crypto, forex, commodities (75 exchanges)

**Source:** `TWELVE_DATA_API_KEY` environment variable (same for all users)

---

### 2️⃣ **ORDER EXECUTION** (When You Click "Buy")
**Powered by:** User's broker connection  
**Works for:** Only users who connected their broker  

**What it does:**
- Submits order to broker API (Alpaca, Tradier, Webull, etc.)
- Uses **user's personal API keys** from `broker_connections` table
- Executes trade on **user's paper/live account**
- Updates buying power, positions, P&L

**Source:** User connects broker in Portfolio → Keys stored in database with RLS

---

## 📊 Simple Example Flow

### Scenario: User wants to buy 2 BTC

```
1. User opens order ticket
   ↓
   [Twelve Data WebSocket] → "BTC = $50,000"
   ↓
   Order ticket shows: "Market Price: $50,000" ✅
   (No broker connection needed)

2. User types: "2" in quantity field
   ↓
   [Frontend calculation] → 2 × $50,000 = $100,000
   ↓
   Order ticket shows: "Estimated Cost: $100,000" ✅
   (Still no broker connection needed)

3. User clicks "Buy" button
   ↓
   [Check database] → Does user have broker connected?
   
   ❌ NO BROKER:
      Shows error: "Please connect your Alpaca paper account in Portfolio"
      Order rejected, nothing happens
   
   ✅ BROKER CONNECTED:
      Fetches user's keys from broker_connections table
      Submits order to Alpaca API using user's keys
      Order executes on user's paper account
      Success! ✅
```

---

## 🔑 Key Points

**✅ Prices work WITHOUT connecting broker**
- Everyone can see prices
- Everyone can calculate estimated costs
- Powered by Twelve Data shared keys

**⚠️ Trading REQUIRES connecting broker**
- User must go to Portfolio → Connect Broker
- Enter their own Alpaca paper API keys
- Keys stored securely in database with RLS
- Orders execute on THEIR account, not shared

**🚫 No shared trading keys**
- We removed all shared Alpaca keys for trading
- Only Twelve Data shared keys remain (display only)
- Each user trades on their own account

---

## 🛠️ Technical Implementation

### Price Display (Twelve Data)
```
WebSocket: wss://ws.twelvedata.com/v1/quotes/price
API Key: TWELVE_DATA_API_KEY (shared, everyone)
REST Fallback: /api/crypto/twelve-data-price
```

### Order Execution (User Keys)
```
Endpoint: /api/orders or /api/crypto/order
Auth: Bearer token → user ID → broker_connections table
Broker API: Uses user's personal keys from database
```

---

## 📱 User Experience

### First-Time User (No Broker)
1. Opens Stratify → Sees all prices ✅
2. Opens order ticket → Sees market price ✅
3. Clicks "Buy" → Error: "Connect broker first" ⚠️
4. Goes to Portfolio → Connects Alpaca paper account
5. Returns to order ticket → Clicks "Buy" → Order executes ✅

### Returning User (Broker Connected)
1. Opens Stratify → Sees all prices ✅
2. Opens order ticket → Sees market price ✅
3. Clicks "Buy" → Order executes immediately ✅

---

## ✅ Summary

**Display = Twelve Data (hardwired for everyone)**  
**Trading = User broker keys (individual accounts)**

That's it! Simple, clean, secure.
