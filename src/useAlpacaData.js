import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001/api';

export function useAlpacaData() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStockData() {
      try {
        const response = await fetch(`${API_URL}/stocks/quotes`);
        if (!response.ok) {
          throw new Error('Failed to fetch stocks');
        }
        const data = await response.json();
        
        const formattedStocks = data.map(stock => ({
          symbol: stock.symbol,
          price: stock.price?.toFixed(2) || '0.00',
          change: '0.00',
        }));
        
        setStocks(formattedStocks);
        setLoading(false);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
        setLoading(false);
      }
    }

    fetchStockData();
    const interval = setInterval(fetchStockData, 5000);
    return () => clearInterval(interval);
  }, []);

  return { stocks, loading, error };
}