// src/hooks/usePaperTrading.js
// React hook for paper trading — drop into any Stratify component
// Handles trade execution, portfolio fetching, and trade history

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient'; // Your existing Supabase client

const API_BASE = import.meta.env.VITE_API_URL || '';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

export function usePaperTrading() {
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trading, setTrading] = useState(false);
  const [error, setError] = useState(null);

  // ---- Fetch Portfolio ----
  const fetchPortfolio = useCallback(async () => {
    try {
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/paper-portfolio`, { headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch portfolio');
      setPortfolio(data);
    } catch (err) {
      setError(err.message);
      console.error('Portfolio fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Execute Trade ----
  const executeTrade = useCallback(async (symbol, side, quantity) => {
    try {
      setTrading(true);
      setError(null);
      const headers = await getAuthHeaders();

      const res = await fetch(`${API_BASE}/api/paper-trade`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          side,
          quantity: parseFloat(quantity),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Trade failed');
      }

      // Refresh portfolio after trade
      await fetchPortfolio();
      await fetchTrades();

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setTrading(false);
    }
  }, [fetchPortfolio]);

  // ---- Buy shorthand ----
  const buy = useCallback((symbol, quantity) => {
    return executeTrade(symbol, 'buy', quantity);
  }, [executeTrade]);

  // ---- Sell shorthand ----
  const sell = useCallback((symbol, quantity) => {
    return executeTrade(symbol, 'sell', quantity);
  }, [executeTrade]);

  // ---- Sell entire position ----
  const closePosition = useCallback(async (symbol) => {
    if (!portfolio) throw new Error('Portfolio not loaded');
    const position = portfolio.positions.find(
      p => p.symbol === symbol.toUpperCase()
    );
    if (!position) throw new Error(`No position in ${symbol}`);
    return executeTrade(symbol, 'sell', position.quantity);
  }, [portfolio, executeTrade]);

  // ---- Fetch Trade History ----
  const fetchTrades = useCallback(async (options = {}) => {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', options.limit);
      if (options.offset) params.set('offset', options.offset);
      if (options.symbol) params.set('symbol', options.symbol);

      const res = await fetch(
        `${API_BASE}/api/paper-history?${params.toString()}`,
        { headers }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch trades');
      setTrades(data.trades);
      return data;
    } catch (err) {
      console.error('Trade history error:', err);
    }
  }, []);

  // ---- Load on mount ----
  useEffect(() => {
    fetchPortfolio();
    fetchTrades({ limit: 20 });
  }, [fetchPortfolio, fetchTrades]);

  return {
    // State
    portfolio,
    trades,
    loading,
    trading, // true while a trade is being executed
    error,

    // Actions
    buy,           // buy('AAPL', 10)
    sell,          // sell('AAPL', 5)
    closePosition, // closePosition('AAPL') — sells all shares
    executeTrade,  // executeTrade('AAPL', 'buy', 10)
    fetchPortfolio,
    fetchTrades,
  };
}
