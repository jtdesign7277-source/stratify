-- Stratify Database Schema
-- Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  initialized BOOLEAN DEFAULT FALSE,
  trade_history JSONB DEFAULT '[]'::jsonb,
  portfolio_state JSONB DEFAULT '{}'::jsonb,
  portfolio_value NUMERIC DEFAULT 0,
  user_state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  crypto_default_coin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

-- ============================================================
-- WATCHLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Watchlist',
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_watchlists_user_id ON public.watchlists(user_id);

-- ============================================================
-- WATCHLIST ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  target_price NUMERIC,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(watchlist_id, symbol)
);

CREATE INDEX idx_watchlist_items_watchlist_id ON public.watchlist_items(watchlist_id);
CREATE INDEX idx_watchlist_items_symbol ON public.watchlist_items(symbol);

-- ============================================================
-- BROKER CONNECTIONS (User-specific broker API keys)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.broker_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker TEXT NOT NULL, -- 'alpaca', 'webull', etc.
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  is_paper BOOLEAN DEFAULT FALSE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker)
);

CREATE INDEX idx_broker_connections_user_id ON public.broker_connections(user_id);

-- ============================================================
-- CONNECTED BROKERS (Legacy/OAuth-based connections)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.connected_brokers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker TEXT NOT NULL, -- 'alpaca', 'tradier', etc.
  broker_account_id TEXT,
  access_token_encrypted TEXT, -- encrypted OAuth token
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active', -- 'active', 'disconnected', 'error'
  is_paper BOOLEAN DEFAULT FALSE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_connected_brokers_user_id ON public.connected_brokers(user_id);
CREATE UNIQUE INDEX idx_connected_brokers_unique ON public.connected_brokers(user_id, broker, broker_account_id);

-- ============================================================
-- POSITIONS (cached from broker)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.connected_brokers(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  avg_entry_price NUMERIC,
  current_price NUMERIC,
  market_value NUMERIC,
  cost_basis NUMERIC,
  unrealized_pl NUMERIC,
  unrealized_plpc NUMERIC, -- percent
  change_today NUMERIC, -- decimal (e.g., 0.0165 = 1.65%)
  side TEXT, -- 'long', 'short'
  asset_class TEXT DEFAULT 'us_equity',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_positions_user_id ON public.positions(user_id);
CREATE INDEX idx_positions_symbol ON public.positions(symbol);

-- ============================================================
-- TRADES (history from broker)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.connected_brokers(id) ON DELETE SET NULL,
  broker_order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'buy', 'sell'
  qty NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  total NUMERIC, -- qty * price
  commission NUMERIC DEFAULT 0,
  filled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'filled', -- 'filled', 'partially_filled', 'cancelled'
  order_type TEXT, -- 'market', 'limit', 'stop', 'stop_limit'
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_symbol ON public.trades(symbol);
CREATE INDEX idx_trades_filled_at ON public.trades(filled_at DESC);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  condition TEXT NOT NULL, -- 'above', 'below', 'percent_change'
  target_value NUMERIC NOT NULL,
  is_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  notification_method TEXT DEFAULT 'in_app', -- 'in_app', 'email', 'push'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_alerts_active ON public.alerts(is_active, is_triggered);

-- ============================================================
-- STRATEGIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT, -- 'momentum', 'value', 'income', 'growth', 'custom'
  rules JSONB DEFAULT '[]'::jsonb, -- strategy rules/criteria
  symbols TEXT[] DEFAULT '{}', -- tracked symbols
  is_active BOOLEAN DEFAULT TRUE,
  backtested_at TIMESTAMPTZ,
  backtest_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategies_user_id ON public.strategies(user_id);

-- ============================================================
-- ACCOUNT SNAPSHOTS (daily portfolio snapshots for P&L tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.connected_brokers(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  equity NUMERIC,
  cash NUMERIC,
  buying_power NUMERIC,
  portfolio_value NUMERIC,
  daily_pnl NUMERIC,
  total_pnl NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker_id, snapshot_date)
);

CREATE INDEX idx_account_snapshots_user_date ON public.account_snapshots(user_id, snapshot_date DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User Preferences: users can CRUD their own preferences
CREATE POLICY user_preferences_select ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_preferences_insert ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_preferences_update ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY user_preferences_delete ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

-- Broker Connections: users can CRUD their own broker connections
CREATE POLICY broker_connections_select ON public.broker_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY broker_connections_insert ON public.broker_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY broker_connections_update ON public.broker_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY broker_connections_delete ON public.broker_connections FOR DELETE USING (auth.uid() = user_id);

-- Watchlists: users can CRUD their own watchlists
CREATE POLICY watchlists_select ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY watchlists_insert ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY watchlists_update ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY watchlists_delete ON public.watchlists FOR DELETE USING (auth.uid() = user_id);

-- Watchlist Items: users can CRUD items in their own watchlists
CREATE POLICY watchlist_items_select ON public.watchlist_items FOR SELECT
  USING (watchlist_id IN (SELECT id FROM public.watchlists WHERE user_id = auth.uid()));
CREATE POLICY watchlist_items_insert ON public.watchlist_items FOR INSERT
  WITH CHECK (watchlist_id IN (SELECT id FROM public.watchlists WHERE user_id = auth.uid()));
CREATE POLICY watchlist_items_update ON public.watchlist_items FOR UPDATE
  USING (watchlist_id IN (SELECT id FROM public.watchlists WHERE user_id = auth.uid()));
CREATE POLICY watchlist_items_delete ON public.watchlist_items FOR DELETE
  USING (watchlist_id IN (SELECT id FROM public.watchlists WHERE user_id = auth.uid()));

-- Connected Brokers: users can CRUD their own broker connections
CREATE POLICY brokers_select ON public.connected_brokers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY brokers_insert ON public.connected_brokers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY brokers_update ON public.connected_brokers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY brokers_delete ON public.connected_brokers FOR DELETE USING (auth.uid() = user_id);

-- Positions: users can read their own positions
CREATE POLICY positions_select ON public.positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY positions_insert ON public.positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY positions_update ON public.positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY positions_delete ON public.positions FOR DELETE USING (auth.uid() = user_id);

-- Trades: users can read their own trades
CREATE POLICY trades_select ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY trades_insert ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Alerts: users can CRUD their own alerts
CREATE POLICY alerts_select ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY alerts_insert ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY alerts_update ON public.alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY alerts_delete ON public.alerts FOR DELETE USING (auth.uid() = user_id);

-- Strategies: users can CRUD their own strategies
CREATE POLICY strategies_select ON public.strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY strategies_insert ON public.strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY strategies_update ON public.strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY strategies_delete ON public.strategies FOR DELETE USING (auth.uid() = user_id);

-- Account Snapshots: users can read their own snapshots
CREATE POLICY snapshots_select ON public.account_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY snapshots_insert ON public.account_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  
  -- Create default watchlist
  INSERT INTO public.watchlists (user_id, name, is_default)
  VALUES (NEW.id, 'My Watchlist', TRUE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.watchlists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
