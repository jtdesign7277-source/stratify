-- Sentinel AI — Shared brain, paper trading, YOLO copy system
-- Created: 2026-03-14

-- Sentinel's own $500k paper account (one row, shared brain)
create table if not exists sentinel_account (
  id uuid default gen_random_uuid() primary key,
  starting_balance numeric default 500000,
  current_balance numeric default 500000,
  total_pnl numeric default 0,
  total_trades integer default 0,
  closed_trades integer default 0,
  wins integer default 0,
  losses integer default 0,
  win_rate numeric default 0,
  avg_r numeric default 0,
  expectancy numeric default 0,
  best_day_pnl numeric default 0,
  worst_day_pnl numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
insert into sentinel_account (id) values ('00000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- Sentinel's own trades (shared, not per-user)
create table if not exists sentinel_trades (
  id uuid default gen_random_uuid() primary key,
  symbol text not null,
  direction text not null, -- 'LONG' | 'SHORT'
  setup text,
  timeframe text,
  regime text,
  entry numeric not null,
  stop numeric not null,
  target numeric not null,
  size numeric, -- shares/units
  dollar_size numeric, -- $ allocated
  risk_r numeric default 1,
  reward_r numeric,
  confidence integer,
  reasons jsonb,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  exit_price numeric,
  result_r numeric, -- actual R result
  pnl numeric, -- actual $ P&L
  win boolean,
  status text default 'open', -- 'open' | 'closed' | 'stopped'
  session_date date default current_date
);

-- Per-session logs (one row per trading day)
create table if not exists sentinel_sessions (
  id uuid default gen_random_uuid() primary key,
  session_date date unique default current_date,
  trades_fired integer default 0,
  trades_closed integer default 0,
  wins integer default 0,
  losses integer default 0,
  gross_pnl numeric default 0,
  session_started_at timestamptz,
  session_ended_at timestamptz,
  -- Brain evolution fields
  claude_analysis text, -- raw Claude response
  adjustments_made jsonb, -- structured rule changes
  weekly_summary text, -- filled every Friday
  brain_version integer default 1
);

-- Brain memory (evolving rule weights, one row updated each session)
create table if not exists sentinel_memory (
  id integer primary key default 1,
  -- Setup performance weights (Claude updates these)
  setup_weights jsonb default '{}',
  -- Regime filters (what to avoid)
  regime_filters jsonb default '{}',
  -- Ticker performance
  ticker_weights jsonb default '{}',
  -- Timeframe performance
  timeframe_weights jsonb default '{}',
  -- Current confidence adjustments
  confidence_adjustments jsonb default '{}',
  -- Suspended conditions (e.g. "no BTC in volatile regime")
  suspended_conditions jsonb default '[]',
  -- Total sessions processed
  sessions_processed integer default 0,
  -- Plain English summary of current brain state
  brain_summary text default 'Sentinel is in early learning mode. Analyzing first sessions.',
  last_updated timestamptz default now()
);
insert into sentinel_memory (id) values (1) on conflict do nothing;

-- Per-user YOLO subscription settings
create table if not exists sentinel_user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  -- Stripe
  stripe_subscription_id text,
  subscription_status text default 'inactive', -- 'trialing' | 'active' | 'canceled' | 'inactive'
  trial_start timestamptz,
  trial_end timestamptz,
  subscribed_at timestamptz,
  canceled_at timestamptz,
  -- YOLO state
  yolo_active boolean default false,
  legal_disclaimer_accepted boolean default false,
  legal_disclaimer_accepted_at timestamptz,
  -- Risk/Reward card
  allocated_capital numeric default 5000,
  risk_preset text default 'Moderate', -- 'Safe'|'Moderate'|'Aggressive'|'YOLO'
  risk_per_trade_pct numeric default 2,
  max_daily_dd_pct numeric default 5,
  stop_loss_atr_mult numeric default 1.5,
  take_profit_rr numeric default 2,
  max_positions integer default 3,
  -- Copy state
  currently_copying boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table sentinel_user_settings enable row level security;
create policy "Users manage own settings" on sentinel_user_settings
  for all using (auth.uid() = user_id);

-- Notifications table (bell icon + Sentinel page panel)
create table if not exists sentinel_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null, -- 'trade_opened' | 'trade_closed' | 'brain_update' | 'yolo_unlocked' | 'session_summary'
  title text not null,
  body text not null,
  trade_id uuid references sentinel_trades(id),
  read boolean default false,
  created_at timestamptz default now()
);
alter table sentinel_notifications enable row level security;
create policy "Users see own notifications" on sentinel_notifications
  for all using (auth.uid() = user_id);

-- Copied trades (user's portfolio entries from YOLO)
create table if not exists sentinel_copied_trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  sentinel_trade_id uuid references sentinel_trades(id),
  symbol text not null,
  direction text not null,
  entry numeric not null,
  stop numeric not null,
  target numeric not null,
  size numeric,
  dollar_size numeric,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  exit_price numeric,
  result_r numeric,
  pnl numeric,
  win boolean,
  status text default 'open'
);
alter table sentinel_copied_trades enable row level security;
create policy "Users see own copied trades" on sentinel_copied_trades
  for all using (auth.uid() = user_id);
