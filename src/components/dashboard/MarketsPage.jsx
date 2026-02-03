import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Globe, BarChart3, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { getQuotes, getTrending } from '../../services/marketData';

const MarketsPage = ({ themeClasses }) => {
  const [indices, setIndices] = useState([]);
  const [crypto, setCrypto] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const INDEX_SYMBOLS = ['^GSPC', '^DJI', '^IXIC', '^RUT'];
  const CRYPTO_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD'];

  const indexNames = {
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones',
    '^IXIC': 'NASDAQ',
    '^RUT': 'Russell 2000',
  };

  const cryptoNames = {
    'BTC-USD': 'Bitcoin',
    'ETH-USD': 'Ethereum',
    'SOL-USD': 'Solana',
    'XRP-USD': 'XRP',
    'DOGE-USD': 'Dogecoin',
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [indexData, cryptoData, trendingData] = await Promise.all([
        getQuotes(INDEX_SYMBOLS),
        getQuotes(CRYPTO_SYMBOLS),
        getTrending(),
      ]);

      setIndices(indexData.map(q => ({
        ...q,
        name: indexNames[q.symbol] || q.name || q.symbol,
        displaySymbol: q.symbol.replace('^', ''),
      })));

      setCrypto(cryptoData.map(q => ({
        ...q,
        name: cryptoNames[q.symbol] || q.name || q.symbol,
        displaySymbol: q.symbol.replace('-USD', ''),
      })));

      setTrending(trendingData.slice(0, 6));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const MarketCard = ({ title, data, icon: Icon, showSymbol = true }) => (
    <div className="bg-[#111118] border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
        <h3 className="text-white font-medium">{title}</h3>
      </div>
      <div className="space-y-3">
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No data available</p>
        ) : (
          data.map((item, idx) => {
            const change = item.change || 0;
            const changePercent = item.changePercent || 0;
            const isPositive = changePercent >= 0;

            return (
              <div
                key={item.symbol || item.name || idx}
                className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0"
              >
                <div>
                  <div className="text-white text-sm font-medium">
                    {showSymbol && item.displaySymbol ? `$${item.displaySymbol}` : item.name}
                  </div>
                  {showSymbol && item.name && (
                    <div className="text-gray-500 text-xs">{item.name}</div>
                  )}
                </div>
                <div className="text-right">
                  {item.price != null && (
                    <div className="text-white text-sm font-mono">
                      ${typeof item.price === 'number' ? item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.price}
                    </div>
                  )}
                  <div className={`text-xs font-medium flex items-center gap-1 justify-end ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{typeof changePercent === 'number' ? changePercent.toFixed(2) : changePercent}%
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Sector performance (calculated from ETFs)
  const sectors = [
    { name: 'Technology', symbol: 'XLK', change: 1.45 },
    { name: 'Healthcare', symbol: 'XLV', change: -0.32 },
    { name: 'Financials', symbol: 'XLF', change: 0.87 },
    { name: 'Energy', symbol: 'XLE', change: 2.13 },
    { name: 'Consumer', symbol: 'XLY', change: -0.54 },
    { name: 'Industrials', symbol: 'XLI', change: 0.23 },
  ].map(s => ({ ...s, changePercent: s.change }));

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0d12] p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Markets</h1>
          <p className="text-gray-400 text-sm">
            {loading ? 'Updating...' : lastUpdate ? `Last updated ${lastUpdate.toLocaleTimeString()}` : 'Real-time market overview'}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <MarketCard title="US Indices" data={indices} icon={Globe} showSymbol={false} />
        <MarketCard title="Cryptocurrency" data={crypto} icon={Activity} />
        <MarketCard title="Trending" data={trending} icon={BarChart3} />
      </div>

      {/* Sectors Row */}
      <div className="mt-4">
        <MarketCard title="Sectors" data={sectors} icon={BarChart3} showSymbol={false} />
      </div>
    </div>
  );
};

export default MarketsPage;
