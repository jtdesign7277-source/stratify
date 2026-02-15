import { supabase } from './supabaseClient';

const MAG7_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
];

export async function initNewUser(userId) {
  if (!userId) {
    throw new Error('initNewUser requires a userId');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, initialized')
    .eq('id', userId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    throw profileError;
  }

  if (profile?.initialized === true) {
    return { initialized: false, skipped: true };
  }

  const defaults = {
    id: userId,
    watchlist: MAG7_WATCHLIST.map((item) => ({ ...item })),
    portfolio_value: 0,
    paper_trading_balance: 100000,
    strategies: [],
    initialized: true,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(defaults, { onConflict: 'id' });

  if (upsertError) {
    throw upsertError;
  }

  return { initialized: true, skipped: false };
}

export default initNewUser;
