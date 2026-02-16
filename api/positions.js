import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'not_connected', message: 'No broker connected' });

  const { data: conn, error: connError } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'alpaca')
    .maybeSingle();

  if (connError) return res.status(500).json({ error: connError.message });
  if (!conn) return res.status(401).json({ error: 'not_connected', message: 'No Alpaca broker connected' });

  const baseUrl = conn.is_paper
    ? 'https://paper-api.alpaca.markets'
    : 'https://api.alpaca.markets';

  try {
    const resp = await fetch(`${baseUrl}/v2/positions`, {
      headers: {
        'APCA-API-KEY-ID': conn.api_key,
        'APCA-API-SECRET-KEY': conn.api_secret,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Alpaca error: ${text}` });
    }

    const positions = await resp.json();
    res.status(200).json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
