-- Migration 006: paper_sports_bets schema fixes + RLS
-- Idempotent: safe to run multiple times

-- Add missing columns
ALTER TABLE paper_sports_bets ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE paper_sports_bets ADD COLUMN IF NOT EXISTS result_resolved_at timestamptz;
ALTER TABLE paper_sports_bets ADD COLUMN IF NOT EXISTS actual_payout numeric;
ALTER TABLE paper_sports_bets ADD COLUMN IF NOT EXISTS potential_payout numeric;
ALTER TABLE paper_sports_bets ADD COLUMN IF NOT EXISTS parlay_id uuid;

-- Enable Row Level Security
ALTER TABLE paper_sports_bets ENABLE ROW LEVEL SECURITY;

-- Create user-scoped RLS policy (drop first for idempotency)
DROP POLICY IF EXISTS "Users see own bets" ON paper_sports_bets;
CREATE POLICY "Users see own bets" ON paper_sports_bets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Composite index for Phase 2 history queries (user + recency)
CREATE INDEX IF NOT EXISTS idx_paper_sports_bets_user_created
  ON paper_sports_bets (user_id, created_at DESC);
