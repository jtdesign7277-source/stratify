-- Sentinel Volatility Events — tracks rapid price moves and decisions
CREATE TABLE IF NOT EXISTS sentinel_volatility_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'rapid_drop',        -- rapid_drop, rapid_spike, flash_crash
  magnitude_pct NUMERIC(8,4) NOT NULL,                  -- % move (negative = drop)
  duration_minutes INTEGER NOT NULL,                     -- how fast the move happened
  price_at_detection NUMERIC(16,4) NOT NULL,
  price_before NUMERIC(16,4) NOT NULL,                   -- price N minutes ago
  atr_ratio NUMERIC(8,4),                                -- current ATR vs avg ATR
  volume_ratio NUMERIC(8,4),                             -- current vol vs avg vol

  -- Claude's analysis
  context_summary TEXT,                                  -- what led to this move
  decision TEXT NOT NULL DEFAULT 'hold',                 -- reduce, close, hold, short
  decision_confidence INTEGER DEFAULT 50,                -- 0-100
  reasoning TEXT,                                        -- Claude's reasoning

  -- What actually happened after
  price_30min_after NUMERIC(16,4),                       -- price 30min later
  price_1hr_after NUMERIC(16,4),                         -- price 1hr later
  price_4hr_after NUMERIC(16,4),                         -- price 4hr later
  outcome TEXT,                                          -- bounced, continued_down, sideways
  outcome_recorded_at TIMESTAMPTZ,
  decision_was_correct BOOLEAN,                          -- did the decision work out?

  -- Action taken
  action_taken TEXT,                                      -- what Sentinel actually did
  position_size_before NUMERIC(16,6),
  position_size_after NUMERIC(16,6),
  trade_id UUID REFERENCES sentinel_trades(id),

  detected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vol_events_symbol ON sentinel_volatility_events(symbol);
CREATE INDEX idx_vol_events_detected ON sentinel_volatility_events(detected_at DESC);
CREATE INDEX idx_vol_events_decision ON sentinel_volatility_events(decision);

-- Add volatility skills to sentinel_memory
ALTER TABLE sentinel_memory ADD COLUMN IF NOT EXISTS volatility_patterns JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sentinel_memory ADD COLUMN IF NOT EXISTS volatility_thresholds JSONB DEFAULT '{"rapid_drop_pct": -1.0, "rapid_spike_pct": 1.5, "lookback_minutes": 15, "min_confidence_to_act": 65}'::jsonb;
