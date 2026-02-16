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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { broker, api_key, api_secret, is_paper } = req.body;

  if (!broker || !api_key || !api_secret) {
    return res.status(400).json({ error: 'Missing required fields: broker, api_key, api_secret' });
  }

  if (!['alpaca', 'webull'].includes(broker)) {
    return res.status(400).json({ error: 'Unsupported broker' });
  }

  // Test the connection before saving
  if (broker === 'alpaca') {
    const baseUrl = is_paper
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';

    try {
      const testResp = await fetch(`${baseUrl}/v2/account`, {
        headers: {
          'APCA-API-KEY-ID': api_key,
          'APCA-API-SECRET-KEY': api_secret,
        },
      });

      if (!testResp.ok) {
        const text = await testResp.text();
        return res.status(400).json({ error: `Alpaca connection failed: ${text}` });
      }

      const accountData = await testResp.json();

      // Save to Supabase
      const { error: upsertError } = await supabase
        .from('broker_connections')
        .upsert(
          {
            user_id: user.id,
            broker,
            api_key,
            api_secret,
            is_paper: is_paper || false,
          },
          { onConflict: 'user_id,broker' }
        );

      if (upsertError) {
        return res.status(500).json({ error: `Failed to save: ${upsertError.message}` });
      }

      return res.status(200).json({
        success: true,
        broker,
        account_id: accountData.account_number,
        status: accountData.status,
        equity: accountData.equity,
        is_paper,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: `${broker} connection not yet supported` });
}
