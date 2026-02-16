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

      const [acctRes, posRes] = await Promise.all([
        fetch('/api/account', { headers }),
        fetch('/api/positions', { headers }),
      ]);

      if (acctRes.status === 401) {
        const body = await acctRes.json().catch(() => ({}));
        if (body.error === 'not_connected') {
          setBrokerConnected(false);
          setAccount(null);
          setPositions([]);
          setLoading(false);
          return;
        }
      }

      if (acctRes.ok) {
        const acctData = await acctRes.json();
        setAccount(acctData);
        setBrokerConnected(true);
      }

      if (posRes.ok) {
        const posData = await posRes.json();
        const normalized = (Array.isArray(posData) ? posData : []).map((p) => ({
          symbol: p.symbol,
          qty: Number(p.qty),
          shares: Number(p.qty),
          avg_entry_price: Number(p.avg_entry_price),
          avgCost: Number(p.avg_entry_price),
          current_price: Number(p.current_price),
          currentPrice: Number(p.current_price),
          market_value: Number(p.market_value),
          marketValue: Number(p.market_value),
          unrealized_pl: Number(p.unrealized_pl),
          unrealized_plpc: Number(p.unrealized_plpc),
          cost_basis: Number(p.cost_basis),
          change_today: Number(p.change_today),
          side: p.side,
          asset_class: p.asset_class,
          asset_id: p.asset_id,
          exchange: p.exchange,
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
