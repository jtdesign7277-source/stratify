-- ============================================================
-- COMMUNITY BOT ENGAGEMENT FIELDS
-- ============================================================

ALTER TABLE IF EXISTS public.community_posts
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flair TEXT,
  ADD COLUMN IF NOT EXISTS pnl_ticker TEXT,
  ADD COLUMN IF NOT EXISTS pnl_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS pnl_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS mentioned_tickers TEXT[],
  ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_handle TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT;

CREATE INDEX IF NOT EXISTS idx_community_posts_reply_to ON public.community_posts(reply_to);
CREATE INDEX IF NOT EXISTS idx_community_posts_is_bot_created_at ON public.community_posts(is_bot, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_mentioned_tickers ON public.community_posts USING gin(mentioned_tickers);

-- Backfill compatibility fields from existing schema.
UPDATE public.community_posts
SET user_handle = COALESCE(user_handle, author_name)
WHERE user_handle IS NULL;

UPDATE public.community_posts
SET mentioned_tickers = COALESCE(mentioned_tickers, ticker_mentions)
WHERE mentioned_tickers IS NULL
  AND ticker_mentions IS NOT NULL;

UPDATE public.community_posts
SET reply_to = COALESCE(reply_to, parent_post_id, parent_id)
WHERE reply_to IS NULL
  AND COALESCE(parent_post_id, parent_id) IS NOT NULL;

UPDATE public.community_posts
SET like_count = COALESCE(like_count, likes, 0)
WHERE like_count IS NULL OR like_count <> COALESCE(likes, like_count, 0);

-- Keep all reply-link columns aligned for compatibility.
CREATE OR REPLACE FUNCTION public.sync_community_parent_ids()
RETURNS TRIGGER AS $$
DECLARE
  target_parent UUID;
BEGIN
  target_parent := COALESCE(NEW.reply_to, NEW.parent_post_id, NEW.parent_id);

  IF NEW.parent_post_id IS NULL THEN
    NEW.parent_post_id = target_parent;
  END IF;

  IF NEW.parent_id IS NULL THEN
    NEW.parent_id = target_parent;
  END IF;

  IF NEW.reply_to IS NULL THEN
    NEW.reply_to = target_parent;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_community_parent_ids ON public.community_posts;
CREATE TRIGGER trigger_sync_community_parent_ids
BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.sync_community_parent_ids();

-- Keep both likes counters synchronized when likes are inserted/removed.
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET likes = COALESCE(likes, 0) + 1,
        like_count = COALESCE(like_count, COALESCE(likes, 0)) + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET likes = GREATEST(COALESCE(likes, 0) - 1, 0),
        like_count = GREATEST(COALESCE(like_count, COALESCE(likes, 0)) - 1, 0)
    WHERE id = OLD.post_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_post_likes_count ON public.community_likes;
CREATE TRIGGER trigger_update_post_likes_count
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();
