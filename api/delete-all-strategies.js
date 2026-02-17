import { createClient } from '@supabase/supabase-js';

const DELETE_WINDOW_END_ISO = '2026-02-18T00:00:00.000Z';
const REQUIRED_CONFIRMATION = 'DELETE_ALL_STRATEGIES';
const REQUIRED_RESET_HEADER = '2026-02-17-reset';

async function getUserFromToken(req, supabase) {
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

  const now = Date.now();
  if (now > new Date(DELETE_WINDOW_END_ISO).getTime()) {
    return res.status(410).json({
      error: 'Endpoint disabled',
      message: 'delete-all-strategies is disabled after the one-time reset window.',
    });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) {
    return res.status(500).json({ error: 'Supabase server credentials are not configured.' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const confirmation = String(req.body?.confirm || '').trim();
  const resetHeader = String(req.headers['x-stratify-reset'] || '').trim();
  if (confirmation !== REQUIRED_CONFIRMATION) {
    return res.status(400).json({
      error: 'Missing confirmation',
      message: `Send { "confirm": "${REQUIRED_CONFIRMATION}" } to execute deletion.`,
    });
  }
  if (resetHeader !== REQUIRED_RESET_HEADER) {
    return res.status(400).json({
      error: 'Missing reset header',
      message: 'This one-time endpoint requires the expected reset header value.',
    });
  }

  const user = await getUserFromToken(req, supabase);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { error: strategiesError } = await supabase
      .from('strategies')
      .delete()
      .eq('user_id', user.id);

    if (strategiesError) {
      return res.status(500).json({ error: strategiesError.message });
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        strategies: {
          strategies: [],
          savedStrategies: [],
          deployedStrategies: [],
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'All strategies for the current user were deleted.',
      userId: user.id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
