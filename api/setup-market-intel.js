import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase config' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Try creating the table via raw SQL using the pg_net extension or rpc
  // Since we can't run DDL via PostgREST, we'll use supabase.rpc if available
  // Fallback: just try inserting a test row — if table doesn't exist, we'll know

  const { data, error } = await supabase
    .from('market_intel_reports')
    .select('id')
    .limit(1);

  if (error && error.code === '42P01') {
    // Table doesn't exist — user needs to create it manually
    return res.status(200).json({
      exists: false,
      message: 'Table does not exist. Run this SQL in Supabase dashboard:',
      sql: `CREATE TABLE IF NOT EXISTS public.market_intel_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  headline TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.market_intel_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market intel" ON public.market_intel_reports
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert market intel" ON public.market_intel_reports
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_market_intel_created ON public.market_intel_reports(created_at DESC);`
    });
  }

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ exists: true, rowCount: data.length });
}
