-- ============================================================
-- TRADING MODE SEPARATION (PAPER VS LIVE)
-- ============================================================

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS trading_mode TEXT NOT NULL DEFAULT 'paper',
  ADD COLUMN IF NOT EXISTS paper_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS live_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS paper_account JSONB NOT NULL DEFAULT '{"equity":100000,"cash":100000,"buying_power":100000}'::jsonb,
  ADD COLUMN IF NOT EXISTS live_account JSONB NOT NULL DEFAULT '{"equity":0,"cash":0,"buying_power":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS paper_trade_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS live_trade_history JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_trading_mode_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_trading_mode_check
      CHECK (trading_mode IN ('paper', 'live'));
  END IF;
END $$;

UPDATE public.profiles
SET
  trading_mode = COALESCE(NULLIF(trading_mode, ''), 'paper'),
  paper_positions = COALESCE(paper_positions, '[]'::jsonb),
  live_positions = COALESCE(live_positions, '[]'::jsonb),
  paper_account = COALESCE(
    paper_account,
    '{"equity":100000,"cash":100000,"buying_power":100000}'::jsonb
  ),
  live_account = COALESCE(
    live_account,
    '{"equity":0,"cash":0,"buying_power":0}'::jsonb
  ),
  paper_trade_history = COALESCE(paper_trade_history, '[]'::jsonb),
  live_trade_history = COALESCE(live_trade_history, '[]'::jsonb);

CREATE INDEX IF NOT EXISTS idx_profiles_trading_mode ON public.profiles(trading_mode);

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['connected_brokers', 'broker_connections']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = target_table
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I
          ADD COLUMN IF NOT EXISTS paper_api_keys JSONB,
          ADD COLUMN IF NOT EXISTS live_api_keys JSONB,
          ADD COLUMN IF NOT EXISTS paper_api_key TEXT,
          ADD COLUMN IF NOT EXISTS paper_api_secret TEXT,
          ADD COLUMN IF NOT EXISTS live_api_key TEXT,
          ADD COLUMN IF NOT EXISTS live_api_secret TEXT',
        target_table
      );
    END IF;
  END LOOP;
END $$;
