// api/sentinel/status.js — Public Sentinel status endpoint
// GET — returns everything needed for the Sentinel page
import { createClient } from '@supabase/supabase-js';
import redis from '../lib/redis.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
  );

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const SESSION_TIME_ZONE = 'America/New_York';

function getDateKeyInTimeZone(value = Date.now(), timeZone = SESSION_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

async function fetchCurrentPrices(symbols) {
    if (!symbols.length || !TD_KEY) return {};
    const prices = {};
    await Promise.all(
          symbols.map(async (sym) => {
                  try {
                            const cacheKey = `sentinel:price:${sym}`;
                            const cached = await redis.get(cacheKey).catch(() => null);
                            if (cached && cached.price) {
                                        prices[sym] = cached.price;
                                        return;
                            }
                            const res = await fetch(
                                                        `https://api.twelvedata.com/quote?symbol=${sym}&apikey=${TD_KEY}`
                                                    );
                                          const data = await res.json();
                                          console.log(`[sentinel/status] Price response for ${sym}:`, JSON.stringify(data));
                                          if (data && data.close) {
                                        prices[sym] = parseFloat(data.close);
                                        await redis.set(cacheKey, { price: prices[sym] }, { ex: 30 }).catch(() => {});
                            }
                  } catch (e) {
                            console.error(`[sentinel/status] Price fetch failed for ${sym}:`, e.message);
                  }
          })
        );
    return prices;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cacheKey = 'sentinel:status';

  try {
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) { return res.status(200).json(cached); }

      const today = getDateKeyInTimeZone();

      const [accountRes, sessionRes, recentSessionsRes, openTradesRes, closedTradesRes, allClosedPnlRes, memoryRes, polyOpenRes, polyClosedRes] = await Promise.all([
              supabase.from('sentinel_account').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single(),
              supabase.from('sentinel_sessions').select('*').eq('session_date', today).maybeSingle(),
              supabase.from('sentinel_sessions').select('*').order('session_date', { ascending: false }).limit(10),
              supabase.from('sentinel_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false }),
              supabase.from('sentinel_trades').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(100),
              supabase.from('sentinel_trades').select('pnl, win').eq('status', 'closed'),
              supabase.from('sentinel_memory').select('brain_summary, sessions_processed, suspended_conditions, latest_report, latest_report_date').eq('id', 1).single(),
              supabase.from('sentinel_polymarket_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false }),
              supabase.from('sentinel_polymarket_trades').select('*').eq('status', 'resolved').order('resolved_at', { ascending: false }).limit(50),
            ]);

      const openTrades = openTradesRes.data || [];
        const account = accountRes.data || {};

      // Fetch live prices for open positions
      const symbols = [...new Set(openTrades.map(t => t.symbol))];
        const currentPrices = await fetchCurrentPrices(symbols);

      // Enrich open trades with live P&L
      let totalUnrealizedPnl = 0;
        const enrichedTrades = openTrades.map(trade => {
                const currentPrice = currentPrices[trade.symbol] || null;
                let unrealizedPnl = null;
                if (currentPrice && trade.entry && trade.size) {
                          unrealizedPnl = trade.direction === 'LONG'
                            ? (currentPrice - trade.entry) * trade.size
                                      : (trade.entry - currentPrice) * trade.size;
                          unrealizedPnl = Math.round(unrealizedPnl * 100) / 100;
                          totalUnrealizedPnl += unrealizedPnl;
                }
                return {
                          ...trade,
                          current_price: currentPrice,
                          unrealized_pnl: unrealizedPnl,
                };
        });

      // Auto-reconcile account from actual trades (single source of truth)
      const allClosedTrades = allClosedPnlRes.data || [];
      const actualRealizedPnl = allClosedTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
      const actualClosedCount = allClosedTrades.length;
      const actualWins = allClosedTrades.filter(t => t.win).length;
      const actualLosses = actualClosedCount - actualWins;
      const actualWinRate = actualClosedCount > 0 ? Math.round((actualWins / actualClosedCount) * 10000) / 100 : 0;
      const expectedBalance = 2000000 + actualRealizedPnl;

      // If account is out of sync, fix it
      if (Math.abs((account.current_balance || 0) - expectedBalance) > 0.5 ||
          Math.abs((account.total_pnl || 0) - actualRealizedPnl) > 0.5) {
        await supabase.from('sentinel_account').update({
          total_pnl: Math.round(actualRealizedPnl * 100) / 100,
          current_balance: Math.round(expectedBalance * 100) / 100,
          closed_trades: actualClosedCount,
          wins: actualWins,
          losses: actualLosses,
          win_rate: actualWinRate,
          total_trades: actualClosedCount + openTrades.length,
          updated_at: new Date().toISOString(),
        }).eq('id', '00000000-0000-0000-0000-000000000001');
        account.total_pnl = Math.round(actualRealizedPnl * 100) / 100;
        account.current_balance = Math.round(expectedBalance * 100) / 100;
        account.closed_trades = actualClosedCount;
        account.wins = actualWins;
        account.losses = actualLosses;
        account.win_rate = actualWinRate;
        account.total_trades = actualClosedCount + openTrades.length;
      }

      const closedTrades = account.closed_trades || 0;
        const winRate = account.win_rate || 0;
        const unlocked = closedTrades >= 20 && winRate >= 65;

      const result = {
              account,
              liveBalance: (account.current_balance || 500000) + Math.round(totalUnrealizedPnl * 100) / 100,
              totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
              todaySession: sessionRes.data || null,
              recentSessions: recentSessionsRes.data || [],
              openTrades: enrichedTrades,
              recentClosedTrades: closedTradesRes.data || [],
              memory: memoryRes.data || {},
              currentPrices,
              polymarket: {
                openTrades: polyOpenRes.data || [],
                recentResolved: polyClosedRes.data || [],
              },
              unlockStatus: {
                        closedTrades,
                        winRate: +winRate.toFixed(1),
                        unlocked,
                        tradesNeeded: Math.max(0, 20 - closedTrades),
                        winRateNeeded: Math.max(0, 65 - winRate),
              },
      };

      await redis.set(cacheKey, result, { ex: 30 }).catch(() => {});
        return res.status(200).json(result);
  } catch (err) {
        console.error('[sentinel/status] Error:', err);
        return res.status(500).json({ error: err.message });
  }
}
