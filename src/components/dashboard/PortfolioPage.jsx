import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, Plus, 
  RefreshCcw, Loader2, MoreHorizontal, Unlink
} from 'lucide-react';
import { getQuotes } from '../../services/marketData';
import BrokerConnectModal, { BrokerIcon } from './BrokerConnectModal';
import PortfolioChart from './PortfolioChart';

const PortfolioPage = ({ themeClasses, alpacaData }) => {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [connectedBrokers, setConnectedBrokers] = useState([]);

  const [mockData, setMockData] = useState({
    netLiq: 125840.00,
    buyingPower: 251680.00,
    dailyPnL: 1247.83
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMockData(prev => ({
        netLiq: prev.netLiq + (Math.random() - 0.45) * 100,
        buyingPower: prev.buyingPower + (Math.random() - 0.5) * 50,
        dailyPnL: prev.dailyPnL + (Math.random() - 0.45) * 50
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const demoHoldings = [
    { symbol: 'AAPL', name: 'Apple Inc.', shares: 150, avgCost: 178.50 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', shares: 45, avgCost: 485.00 },
    { symbol: 'MSFT', name: 'Microsoft', shares: 75, avgCost: 378.25 },
    { symbol: 'GOOGL', name: 'Alphabet', shares: 100, avgCost: 141.00 },
    { symbol: 'TSLA', name: 'Tesla Inc.', shares: 60, avgCost: 195.00 },
    { symbol: 'META', name: 'Meta Platforms', shares: 35, avgCost: 485.00 },
  ];

  const account = alpacaData?.account || {};
  const hasRealData = account.equity && account.equity > 0;
  const positions = alpacaData?.positions?.length > 0 ? alpacaData.positions : null;
  
  const netLiquidity = hasRealData ? account.equity : mockData.netLiq;
  const buyingPower = hasRealData ? (account.buying_power ?? 0) : mockData.buyingPower;
  const dailyPnL = hasRealData ? (account.daily_pnl ?? 0) : mockData.dailyPnL;

  const holdings = useMemo(() => {
    if (positions) {
      return positions.map(pos => ({
        symbol: pos.symbol,
        name: pos.symbol,
        shares: parseFloat(pos.qty) || 0,
        avgCost: parseFloat(pos.avg_entry_price) || 0,
        currentPrice: parseFloat(pos.current_price) || 0,
        unrealizedPL: parseFloat(pos.unrealized_pl) || 0,
        unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100 || 0,
        marketValue: parseFloat(pos.market_value) || 0,
      }));
    }
    return demoHoldings;
  }, [positions]);

  const fetchPrices = async () => {
    if (positions) {
      setLoading(false);
      setLastUpdate(new Date());
      return;
    }
    setLoading(true);
    try {
      const symbols = holdings.map(h => h.symbol);
      const quotes = await getQuotes(symbols);
      const priceMap = {};
      quotes.forEach(q => {
        if (q && q.symbol) {
          priceMap[q.symbol] = {
            price: q.price || 0,
            change: q.change || 0,
            changePercent: q.changePercent || 0,
          };
        }
      });
      setPrices(priceMap);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [positions]);

  const portfolioData = useMemo(() => {
    let holdingsValue = 0;
    let totalCost = 0;
    holdings.forEach(holding => {
      if (holding.marketValue !== undefined) {
        holdingsValue += holding.marketValue;
        totalCost += holding.avgCost * holding.shares;
      } else {
        const priceData = prices[holding.symbol] || {};
        const currentPrice = priceData.price || holding.avgCost;
        holdingsValue += currentPrice * holding.shares;
        totalCost += holding.avgCost * holding.shares;
      }
    });
    const totalPL = holdingsValue - totalCost;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const todayChangePercent = netLiquidity > 0 ? (dailyPnL / netLiquidity) * 100 : 0;
    return {
      totalValue: netLiquidity,
      totalPL,
      totalPLPercent,
      todayChange: dailyPnL,
      todayChangePercent,
    };
  }, [holdings, prices, netLiquidity, dailyPnL]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(value);
  };

  const handleBrokerConnect = (broker) => {
    setConnectedBrokers(prev => [...prev, broker]);
    setShowBrokerModal(false);
  };

  const handleDisconnectBroker = (brokerId) => {
    setConnectedBrokers(prev => prev.filter(b => b.id !== brokerId));
  };

  const totalConnectedValue = connectedBrokers.reduce((sum, b) => sum + (b.value || 0), 0) + portfolioData.totalValue;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] overflow-auto">
      <div className="px-6 pt-6 pb-4">
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl overflow-hidden p-4">
          <PortfolioChart initialValue={totalConnectedValue} />
        </div>
      </div>

      <div className="px-6 pb-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Connected Accounts</h2>
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(hasRealData || true) && (
            <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <BrokerIcon broker="alpaca" className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Alpaca</div>
                    <div className="text-gray-500 text-sm flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      Connected
                    </div>
                  </div>
                </div>
                <button className="p-1 text-gray-500 hover:text-white transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total value</span>
                  <span className="text-white font-medium">{formatCurrency(portfolioData.totalValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Available balance</span>
                  <span className="text-white font-medium">{formatCurrency(buyingPower)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Today's P&L</span>
                  <span className={`font-medium ${portfolioData.todayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {portfolioData.todayChange >= 0 ? '+' : ''}{formatCurrency(portfolioData.todayChange)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {connectedBrokers.map(broker => (
            <div key={broker.id} className="bg-[#0a1628] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                    <BrokerIcon broker={broker.id} className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="text-white font-medium">{broker.name}</div>
                    <div className="text-gray-500 text-sm flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      Connected
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDisconnectBroker(broker.id)}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                  title="Disconnect"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total value</span>
                  <span className="text-white font-medium">{formatCurrency(broker.value || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Available balance</span>
                  <span className="text-white font-medium">{formatCurrency(broker.available || 0)}</span>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowBrokerModal(true)}
            className="bg-[#0a1628] border border-dashed border-gray-700 rounded-xl p-4 hover:border-purple-500/50 hover:bg-[#0a1628]/80 transition-all flex flex-col items-center justify-center min-h-[160px] group"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-3 group-hover:bg-purple-500/30 transition-colors">
              <Plus className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-white font-medium mb-1">Connect a Broker</div>
            <div className="text-gray-500 text-sm text-center">Link your accounts for unified tracking</div>
          </button>
        </div>
      </div>

      <BrokerConnectModal
        isOpen={showBrokerModal}
        onClose={() => setShowBrokerModal(false)}
        onConnect={handleBrokerConnect}
        connectedBrokers={connectedBrokers}
      />
    </div>
  );
};

export default PortfolioPage;
