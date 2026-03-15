-- Polymarket paper trading for Sentinel
-- Binary prediction markets: BTC strikes (weekly) + BTC 5-min up/down
-- Created: 2026-03-15

create table if not exists sentinel_polymarket_trades (
  id uuid default gen_random_uuid() primary key,
  -- Market identity
  market_id text not null,              -- Polymarket market ID
  condition_id text,                    -- On-chain condition ID
  question text not null,               -- "Will BTC be above $70,000 on March 21?"
  market_type text not null,            -- 'strike' | '5min' | 'custom'
  -- Position
  side text not null,                   -- 'YES' | 'NO'
  entry_price numeric not null,         -- Price paid per share (0.00 - 1.00)
  shares numeric not null,              -- Number of shares bought
  dollar_cost numeric not null,         -- Total cost (entry_price * shares)
  -- Resolution
  resolved boolean default false,
  outcome text,                         -- 'YES' | 'NO' (actual result)
  payout numeric,                       -- $ received (shares * 1.00 if won, 0 if lost)
  pnl numeric,                          -- payout - dollar_cost
  win boolean,
  -- Signal info
  confidence integer,
  setup text,                           -- 'BTC Momentum Strike' | 'BTC 5min Scalp' etc.
  reasons jsonb,
  btc_price_at_entry numeric,           -- BTC spot price when trade was placed
  -- Timestamps
  status text default 'open',           -- 'open' | 'resolved'
  opened_at timestamptz default now(),
  closes_at timestamptz,                -- When the market resolves
  resolved_at timestamptz,
  session_date date default current_date
);

-- Index for heartbeat queries
create index if not exists idx_poly_trades_status on sentinel_polymarket_trades(status);
create index if not exists idx_poly_trades_market on sentinel_polymarket_trades(market_id);
