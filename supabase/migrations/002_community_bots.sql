-- ============================================================
-- COMMUNITY BOTS SUPPORT
-- ============================================================

ALTER TABLE IF EXISTS public.community_posts
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_community_posts_parent_post_id ON public.community_posts(parent_post_id);

-- Keep both reply parent columns aligned for compatibility.
CREATE OR REPLACE FUNCTION public.sync_community_parent_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_post_id IS NULL THEN
    NEW.parent_post_id = NEW.parent_id;
  END IF;

  IF NEW.parent_id IS NULL THEN
    NEW.parent_id = NEW.parent_post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_community_parent_ids ON public.community_posts;
CREATE TRIGGER trigger_sync_community_parent_ids
BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.sync_community_parent_ids();

-- Backfill cross-column parent references for existing rows.
UPDATE public.community_posts
SET parent_post_id = parent_id
WHERE parent_post_id IS NULL
  AND parent_id IS NOT NULL;

UPDATE public.community_posts
SET parent_id = parent_post_id
WHERE parent_id IS NULL
  AND parent_post_id IS NOT NULL;

-- Keep comments_count accurate regardless of which parent column is set.
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER AS $$
DECLARE
  target_parent_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_parent_id = COALESCE(NEW.parent_post_id, NEW.parent_id);
    IF target_parent_id IS NOT NULL THEN
      UPDATE public.community_posts
      SET comments_count = comments_count + 1
      WHERE id = target_parent_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    target_parent_id = COALESCE(OLD.parent_post_id, OLD.parent_id);
    IF target_parent_id IS NOT NULL THEN
      UPDATE public.community_posts
      SET comments_count = comments_count - 1
      WHERE id = target_parent_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_post_comments_count ON public.community_posts;
CREATE TRIGGER trigger_update_post_comments_count
AFTER INSERT OR DELETE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

-- Backfill author_name so legacy rows still display a stable name in threads.
UPDATE public.community_posts AS cp
SET author_name = COALESCE(p.display_name, cp.author_name, 'Trader')
FROM public.profiles AS p
WHERE cp.user_id = p.id
  AND cp.author_name IS NULL;
