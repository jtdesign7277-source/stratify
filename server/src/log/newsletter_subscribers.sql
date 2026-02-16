-- Newsletter Subscribers table
-- Run this in the Supabase SQL editor for the Stratify project

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'newsletter_page'
);

-- Enable RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (signup from frontend)
CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (admin) can read
CREATE POLICY "Admins can read subscribers"
  ON public.newsletter_subscribers
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON public.newsletter_subscribers (email);
