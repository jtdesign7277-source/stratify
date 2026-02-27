CREATE TABLE IF NOT EXISTS public.user_click_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (char_length(trim(content_type)) > 0),
  content_id TEXT NOT NULL CHECK (char_length(trim(content_id)) > 0),
  title TEXT,
  source TEXT,
  thumbnail_url TEXT,
  url TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_click_history_user_content_unique UNIQUE (user_id, content_type, content_id)
);
