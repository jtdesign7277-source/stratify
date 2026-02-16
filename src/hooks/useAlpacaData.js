import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const POLL_INTERVAL = 30000; // 30s refresh

export function useAlpacaData() {
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [brokerConnected, setBrokerConnected] = useState(null); // null = unknown, true/false

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const fetchData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setBrokerConnected(false);
        setLoading(false);
        return;
      }

      // Try Alpaca first, then Webull
      let acctRes = await fetch('/api/account', { headers });
      let posRes = await fetch('/api/positions', { headers });
      let broker = 'alpaca';

      // If Alpaca not connected, try Webull
      if (acctRes.status === 401) {
        const body = await acctRes.json().catch(() => ({}));
        if (body.error === 'not_connected') {
          acctRes = await fetch('/api/webull-account', { headers });
          posRes = await fetch('/api/webull-positions', { headers });
          broker = 'webull';

          if (acctRes.status === 401) {
            const wbBody = await acctRes.json().catch(() => ({}));
            if (wbBody.error === 'not_connected') {
              setBrokerConnected(false);
              setAccount(null);
              setPositions([]);
              setLoading(false);
              return;
            }
          }
        }
      }

      if (acctRes.ok) {
        const acctData = await acctRes.json();
        setAccount({ ...acctData, broker });
        setBrokerConnected(true);
      }

      if (posRes.ok) {
        const posData = await posRes.json();
        const normalized = (Array.isArray(posData) ? posData : []).map((p) => ({
          symbol: p.symbol,
          qty: Number(p.qty || p.shares || 0),
          shares: Number(p.qty || p.shares || 0),
          avg_entry_price: Number(p.avg_entry_price || p.avgCost || 0),
          avgCost: Number(p.avg_entry_price || p.avgCost || 0),
          current_price: Number(p.current_price || p.currentPrice || 0),
          currentPrice: Number(p.current_price || p.currentPrice || 0),
          market_value: Number(p.market_value || p.marketValue || 0),
          marketValue: Number(p.market_value || p.marketValue || 0),
          unrealized_pl: Number(p.unrealized_pl || 0),
          unrealized_plpc: Number(p.unrealized_plpc || 0),
          cost_basis: Number(p.cost_basis || 0),
          change_today: Number(p.change_today || 0),
          side: p.side || 'long',
          asset_class: p.asset_class || 'us_equity',
          asset_id: p.asset_id,
          exchange: p.exchange,
          broker: p.broker || broker,
        }));
        setPositions(normalized);
      }

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { account, positions, loading, error, brokerConnected, refresh: fetchData };
}
