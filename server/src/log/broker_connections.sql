CREATE TABLE IF NOT EXISTS public.broker_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker TEXT NOT NULL CHECK (broker IN ('alpaca', 'webull')),
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  is_paper BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker)
);

ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own broker connections"
  ON public.broker_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
