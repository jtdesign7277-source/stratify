import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check if table exists
  const { data, error } = await supabase.from('sophia_alerts').select('id').limit(1);

  if (error && error.code === '42P01') {
    return res.status(200).json({
      exists: false,
      sql: `
-- Run this in Supabase SQL Editor:
CREATE TABLE sophia_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  severity TEXT NOT NULL DEFAULT '🔵',
  symbol TEXT NOT NULL DEFAULT 'Portfolio',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'info',
  account_equity NUMERIC,
  raw_response TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sophia_alerts_created ON sophia_alerts (created_at DESC);
CREATE INDEX idx_sophia_alerts_type ON sophia_alerts (alert_type);
CREATE INDEX idx_sophia_alerts_read ON sophia_alerts (read) WHERE read = false;

ALTER TABLE sophia_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON sophia_alerts FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON sophia_alerts FOR SELECT USING (true);
      `.trim(),
    });
  }

  return res.status(200).json({ exists: true, message: 'sophia_alerts table exists' });
}
