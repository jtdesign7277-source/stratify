-- Run this in Supabase SQL editor if these columns are missing on public.profiles.
-- This enables persistent dashboard/session state across logins and browser restarts.

alter table public.profiles
  add column if not exists watchlist jsonb not null default '[]'::jsonb,
  add column if not exists strategies jsonb not null default '{"strategies":[],"savedStrategies":[],"deployedStrategies":[]}'::jsonb,
  add column if not exists paper_trading_balance numeric not null default 100000,
  add column if not exists user_state jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.profiles.user_state is
'Stores dashboard state JSON (theme, sidebarExpanded, activeTab, activeSection, rightPanelWidth, paperTradingBalance).';

-- Optional backfill for existing users that do not have dashboard state yet.
update public.profiles
set user_state = coalesce(user_state, '{}'::jsonb) || jsonb_build_object(
  'theme', coalesce(user_state->>'theme', 'dark'),
  'sidebarExpanded', coalesce((user_state->>'sidebarExpanded')::boolean, true),
  'activeTab', coalesce(user_state->>'activeTab', 'trade'),
  'activeSection', coalesce(user_state->>'activeSection', 'watchlist'),
  'rightPanelWidth', coalesce((user_state->>'rightPanelWidth')::int, 320),
  'paperTradingBalance', coalesce((user_state->>'paperTradingBalance')::numeric, paper_trading_balance, 100000)
)
where user_state is null
  or jsonb_typeof(user_state) <> 'object';
