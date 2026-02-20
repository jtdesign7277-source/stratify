CREATE TABLE IF NOT EXISTS public.analytics_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT DEFAULT 'AAPL',
  interval TEXT DEFAULT '1day',
  indicators JSONB DEFAULT '["sma20","volume"]'::jsonb,
  drawings JSONB DEFAULT '[]'::jsonb,
  chart_type TEXT DEFAULT 'candlestick',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.analytics_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own analytics prefs"
  ON public.analytics_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
