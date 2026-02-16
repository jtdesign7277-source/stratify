import { useState, useEffect, useCallback } from 'react';

const POLL_INTERVAL = 30000; // 30s refresh

export function useAlpacaData() {
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [acctRes, posRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/positions'),
      ]);

      if (acctRes.ok) {
        const acctData = await acctRes.json();
        setAccount(acctData);
      }

      if (posRes.ok) {
        const posData = await posRes.json();
        // Normalize Alpaca position format
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

  return { account, positions, loading, error, refresh: fetchData };
}
