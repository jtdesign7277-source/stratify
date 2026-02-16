CREATE TABLE IF NOT EXISTS public.sophia_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  strategy_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sophia_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own conversations" ON public.sophia_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.sophia_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sophia_conversations_user ON public.sophia_conversations(user_id, created_at DESC);
