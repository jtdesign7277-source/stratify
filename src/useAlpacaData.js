import { useState, useEffect, useCallback } from 'react';
import { getQuotes, getQuote, getSnapshots, getAlpacaBars, getTrending, getAlpacaAccount, getAlpacaPositions } from './services/marketData';

// Default watchlist symbols
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];

export function useAlpacaData() {
  const [stocks, setStocks] = useState([]);
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch account and positions from Alpaca
      const [accountData, positionsData, bars] = await Promise.all([
        getAlpacaAccount(),
        getAlpacaPositions(),
        getAlpacaBars()
      ]);
      
      if (accountData) {
        setAccount(accountData);
      }
      
      if (positionsData && positionsData.length > 0) {
        setPositions(positionsData);
      }
      
      if (bars && bars.length > 0) {
        setStocks(bars.map(bar => ({
          symbol: bar.symbol,
          price: bar.price?.toFixed(2) || '0.00',
          change: bar.change || '0.00',
          open: bar.open,
          high: bar.high,
          low: bar.low,
          volume: bar.volume,
        })));
      } else {
        // Fallback to Yahoo Finance quotes
        const quotes = await getQuotes(DEFAULT_SYMBOLS);
        setStocks(quotes.map(q => ({
          symbol: q.symbol,
          name: q.name,
          price: q.price?.toFixed(2) || '0.00',
          change: q.change?.toFixed(2) || '0.00',
          changePercent: q.changePercent?.toFixed(2) || '0.00',
          volume: q.volume,
          marketCap: q.marketCap,
        })));
      }
      
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  return { stocks, account, positions, loading, error, refetch: fetchData };
}

// Hook for watchlist with custom symbols
export function useWatchlist(symbols = DEFAULT_SYMBOLS) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWatchlist = useCallback(async () => {
    try {
      // Use Alpaca snapshots for real-time data with change %
      const snapshots = await getSnapshots(symbols);
      setStocks(snapshots.map(s => ({
        symbol: s.symbol,
        name: s.symbol, // Alpaca doesn't return name, use symbol
        price: s.price || 0,
        change: s.change || 0,
        changePercent: s.changePercent || 0,
        prevClose: s.prevClose,
        open: s.open,
        high: s.high,
        low: s.low,
        volume: s.volume,
      })));
      setError(null);
    } catch (err) {
      console.error('Watchlist fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  useEffect(() => {
    fetchWatchlist();
    const interval = setInterval(fetchWatchlist, 15000);
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  return { stocks, loading, error, refetch: fetchWatchlist };
}

// Hook for a single stock
export function useStock(symbol) {
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) return;

    const fetchStock = async () => {
      try {
        const quote = await getQuote(symbol);
        setStock(quote);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
    const interval = setInterval(fetchStock, 10000);
    return () => clearInterval(interval);
  }, [symbol]);

  return { stock, loading, error };
}

// Hook for trending stocks
export function useTrending() {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const data = await getTrending();
        setTrending(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
    const interval = setInterval(fetchTrending, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return { trending, loading, error };
}

// Hook for market overview (indices)
export function useMarketOverview() {
  const indices = ['^GSPC', '^DJI', '^IXIC', '^RUT']; // S&P 500, Dow, Nasdaq, Russell 2000
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const quotes = await getQuotes(indices);
        const nameMap = {
          '^GSPC': 'S&P 500',
          '^DJI': 'Dow Jones',
          '^IXIC': 'NASDAQ',
          '^RUT': 'Russell 2000',
        };
        setMarkets(quotes.map(q => ({
          ...q,
          name: nameMap[q.symbol] || q.symbol,
        })));
      } catch (err) {
        console.error('Market overview error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
    const interval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(interval);
  }, []);

  return { markets, loading };
}
