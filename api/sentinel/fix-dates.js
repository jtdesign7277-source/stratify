// api/sentinel/fix-dates.js — One-time migration to shift all UTC dates to ET dates
// DELETE THIS FILE after running once

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function shiftDateBack(dateStr) {
  // Add T12:00:00 so it parses as noon UTC (avoids timezone edge cases)
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret = req.headers['x-secret'];
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const log = [];

  try {
    // Fix sentinel_sessions
    const { data: sessions } = await supabase
      .from('sentinel_sessions')
      .select('id, session_date')
      .order('session_date', { ascending: false })
      .limit(30);

    for (const s of (sessions || [])) {
      const fixed = shiftDateBack(s.session_date);
      await supabase.from('sentinel_sessions').update({ session_date: fixed }).eq('id', s.id);
      log.push(`session ${s.session_date} → ${fixed}`);
    }

    // Fix sentinel_trades session_date
    const { data: trades } = await supabase
      .from('sentinel_trades')
      .select('id, session_date')
      .not('session_date', 'is', null)
      .limit(500);

    for (const t of (trades || [])) {
      if (!t.session_date) continue;
      const fixed = shiftDateBack(t.session_date);
      if (fixed !== t.session_date) {
        await supabase.from('sentinel_trades').update({ session_date: fixed }).eq('id', t.id);
      }
    }
    log.push(`Fixed ${trades?.length || 0} trade dates`);

    return res.status(200).json({ success: true, log });
  } catch (err) {
    return res.status(500).json({ error: err.message, log });
  }
}
