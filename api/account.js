import { supabase } from './lib/supabase.js';
import {
  getProfileForTrading,
  getTradingModeFromRequest,
  getUserFromToken,
  normalizeTradingMode,
  readModeDataFromProfile,
  resolveAlpacaCredentialsForMode,
  upsertModeProfileData,
} from './lib/tradingMode.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'not_connected', message: 'No broker connected' });

  const { data: profile, error: profileError } = await getProfileForTrading(user.id);
  if (profileError) return res.status(500).json({ error: profileError.message });

  const profileMode = normalizeTradingMode(profile?.trading_mode);
  const mode = getTradingModeFromRequest(req, profileMode);
  const { account: cachedAccount } = readModeDataFromProfile(profile, mode);

  if (mode === 'paper') {
    return res.status(200).json({
      ...cachedAccount,
      trading_mode: mode,
      mode,
      source: 'profile_cache',
    });
  }

  const { data: conn, error: connError } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'alpaca')
    .maybeSingle();

  if (connError) return res.status(500).json({ error: connError.message });

  const credentials = resolveAlpacaCredentialsForMode(conn, mode);
  if (!credentials.apiKey || !credentials.apiSecret) {
    const hasCachedLive = Number(cachedAccount?.equity || 0) > 0 || Number(cachedAccount?.portfolio_value || 0) > 0;
    if (hasCachedLive) {
      return res.status(200).json({
        ...cachedAccount,
        trading_mode: mode,
        mode,
        source: 'profile_cache',
      });
    }
    return res.status(401).json({
      error: 'not_connected',
      message: 'No Alpaca live broker connected',
      mode,
    });
  }

  try {
    const resp = await fetch(`${credentials.baseUrl}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': credentials.apiKey,
        'APCA-API-SECRET-KEY': credentials.apiSecret,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Alpaca error: ${text}`, mode });
    }

    const account = await resp.json();
    await upsertModeProfileData(user.id, mode, {
      account,
      tradingMode: mode,
    });

    return res.status(200).json({
      ...account,
      trading_mode: mode,
      mode,
      source: 'alpaca_live',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, mode });
  }
}
