import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const limit = parseInt(req.query.limit) || 20;
    const { data, error } = await supabase
      .from('sophia_alerts')
      .select('*')
      .eq('alert_type', 'trump')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(200).json({ alerts: [] });
    return res.status(200).json({ alerts: data || [] });
  }

  if (req.method === 'POST') {
    const { alerts } = req.body || {};
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ error: 'No alerts provided' });
    }

    const rows = alerts.map((a) => ({
      severity: a.severity || '🟠',
      symbol: a.symbol || 'POTUS',
      title: a.title || a.headline || '',
      message: a.message || a.content || '',
      alert_type: 'trump',
      raw_response: a.source_url || a.source || '',
      read: false,
    }));

    const { data, error } = await supabase
      .from('sophia_alerts')
      .insert(rows)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ inserted: data?.length || 0 });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
