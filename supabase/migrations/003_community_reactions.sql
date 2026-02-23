-- ============================================================
-- COMMUNITY REACTIONS SUPPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(trim(emoji)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_reactions_post_user_emoji_key UNIQUE (post_id, user_id, emoji)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_reactions_post_user_emoji
  ON public.community_reactions(post_id, user_id, emoji);

CREATE INDEX IF NOT EXISTS idx_community_reactions_post_id
  ON public.community_reactions(post_id);

CREATE INDEX IF NOT EXISTS idx_community_reactions_user_id
  ON public.community_reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_community_reactions_post_emoji
  ON public.community_reactions(post_id, emoji);

ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_reactions'
      AND policyname = 'Reactions are viewable by everyone'
  ) THEN
    CREATE POLICY "Reactions are viewable by everyone"
      ON public.community_reactions
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_reactions'
      AND policyname = 'Users can react with their own account'
  ) THEN
    CREATE POLICY "Users can react with their own account"
      ON public.community_reactions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_reactions'
      AND policyname = 'Users can remove their own reactions'
  ) THEN
    CREATE POLICY "Users can remove their own reactions"
      ON public.community_reactions
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT ON public.community_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'community_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions;
  END IF;
END $$;
