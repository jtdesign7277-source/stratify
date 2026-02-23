-- Community Posts Table for Stratify
-- Run this in Supabase SQL Editor to create the community feature tables

-- Create community_posts table
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  parent_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  ticker_mentions TEXT[] DEFAULT '{}',
  post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post', 'pnl_share', 'strategy_share', 'alert_share', 'trade_share')),
  metadata JSONB DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward-compatible alters when table already exists
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_parent_id ON community_posts(parent_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_parent_post_id ON community_posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_post_type ON community_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_community_posts_ticker_mentions ON community_posts USING gin(ticker_mentions);

-- Create community_likes table (for tracking who liked what)
CREATE TABLE IF NOT EXISTS community_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Create index on community_likes
CREATE INDEX IF NOT EXISTS idx_community_likes_user_id ON community_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_post_id ON community_likes(post_id);

-- Create community-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-images', 'community-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for community-images
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'community-images');

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'community-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Row Level Security (RLS) policies
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read posts
CREATE POLICY "Posts are viewable by everyone"
ON community_posts FOR SELECT
TO public
USING (true);

-- Users can insert their own posts
CREATE POLICY "Users can insert their own posts"
ON community_posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts"
ON community_posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
ON community_posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Anyone can read likes
CREATE POLICY "Likes are viewable by everyone"
ON community_likes FOR SELECT
TO public
USING (true);

-- Users can like posts
CREATE POLICY "Users can like posts"
ON community_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can unlike posts
CREATE POLICY "Users can unlike posts"
ON community_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Function to update likes count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET likes = likes + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET likes = likes - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update likes count
DROP TRIGGER IF EXISTS trigger_update_post_likes_count ON community_likes;
CREATE TRIGGER trigger_update_post_likes_count
AFTER INSERT OR DELETE ON community_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Keep legacy parent_id and parent_post_id in sync for reply threads
CREATE OR REPLACE FUNCTION sync_community_parent_ids()
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

DROP TRIGGER IF EXISTS trigger_sync_community_parent_ids ON community_posts;
CREATE TRIGGER trigger_sync_community_parent_ids
BEFORE INSERT OR UPDATE ON community_posts
FOR EACH ROW EXECUTE FUNCTION sync_community_parent_ids();

-- Function to update comments count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
DECLARE
  target_parent_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_parent_id = COALESCE(NEW.parent_post_id, NEW.parent_id);
    IF target_parent_id IS NOT NULL THEN
      UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = target_parent_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    target_parent_id = COALESCE(OLD.parent_post_id, OLD.parent_id);
    IF target_parent_id IS NOT NULL THEN
      UPDATE community_posts SET comments_count = comments_count - 1 WHERE id = target_parent_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update comments count
DROP TRIGGER IF EXISTS trigger_update_post_comments_count ON community_posts;
CREATE TRIGGER trigger_update_post_comments_count
AFTER INSERT OR DELETE ON community_posts
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
