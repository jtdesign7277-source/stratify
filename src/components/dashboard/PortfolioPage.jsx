import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, Plus, 
  RefreshCcw, Loader2, MoreHorizontal, Unlink
} from 'lucide-react';
import { getQuotes } from '../../services/marketData';
import BrokerConnectModal, { BrokerIcon } from './BrokerConnectModal';

const PortfolioPage = ({ themeClasses, alpacaData }) => {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [connectedBrokers, setConnectedBrokers] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [chartTab, setChartTab] = useState('value');

  // Mock data that syncs with TopMetricsBar
  const [mockData, setMockData] = useState({
    netLiq: 125840.00,
    buyingPower: 251680.00,
    dailyPnL: 1247.83
  });

  // Animate mock values
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

  // Demo holdings
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

  // Calculate portfolio metrics
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

  // Calculate total value across all connected accounts
  const totalConnectedValue = connectedBrokers.reduce((sum, b) => sum + (b.value || 0), 0) + portfolioData.totalValue;

  // Generate chart data points (mock)
  const chartPoints = useMemo(() => {
    const points = [];
    const baseValue = portfolioData.totalValue;
    for (let i = 0; i < 50; i++) {
      const variance = (Math.random() - 0.5) * baseValue * 0.1;
      points.push(baseValue + variance * (i / 50));
    }
    return points;
  }, [portfolioData.totalValue]);

  const timeframes = ['1W', '1M', '3M', '6M', '1Y', 'All'];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] overflow-auto">
      {/* Top Section - Total Value & Actions */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          {/* Left - Total Value */}
          <div>
            <div className="text-gray-400 text-sm mb-1">Total value</div>
            <div className="text-4xl font-bold text-white mb-2">
              {formatCurrency(totalConnectedValue)}
            </div>
            <div className={`flex items-center gap-2 text-sm ${portfolioData.todayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {portfolioData.todayChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{portfolioData.todayChange >= 0 ? '+' : ''}{formatCurrency(portfolioData.todayChange)}</span>
              <span className="text-gray-500">({portfolioData.todayChangePercent.toFixed(2)}%) today</span>
            </div>
          </div>

        </div>
      </div>

      {/* Chart Section */}
      <div className="px-6 pb-4">
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl overflow-hidden">
          {/* Chart Header */}
          <div className="flex items-center justify-end px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-1">
              {timeframes.map(tf => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    selectedTimeframe === tf
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Area */}
          <div className="h-64 px-4 py-4 relative">
            {/* SVG Chart with gradient */}
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Area fill */}
              <path
                d={`M 0 200 ${chartPoints.map((p, i) => {
                  const x = (i / (chartPoints.length - 1)) * 500;
                  const y = 200 - ((p / (portfolioData.totalValue * 1.1)) * 200);
                  return `L ${x} ${y}`;
                }).join(' ')} L 500 200 Z`}
                fill="url(#chartGradient)"
              />
              
              {/* Line */}
              <path
                d={`M ${chartPoints.map((p, i) => {
                  const x = (i / (chartPoints.length - 1)) * 500;
                  const y = 200 - ((p / (portfolioData.totalValue * 1.1)) * 200);
                  return `${i === 0 ? '' : 'L '}${x} ${y}`;
                }).join(' ')}`}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2"
              />
            </svg>

            {/* Chart value overlay */}
            <div className="absolute top-4 left-4">
              <div className="text-2xl font-bold text-white">{formatCurrency(portfolioData.totalValue)}</div>
              <div className={`text-sm ${portfolioData.todayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {portfolioData.todayChange >= 0 ? '+' : ''}{portfolioData.todayChangePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}
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
          {/* Alpaca Account (always show if connected or has data) */}
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

          {/* Other connected brokers */}
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

          {/* Connect a Broker Card */}
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

        {/* Holdings Table (if connected) */}
        {holdings.length > 0 && (
          <div className="mt-6 bg-[#0a1628] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-medium">Holdings</h3>
              <span className="text-gray-500 text-sm">{holdings.length} positions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-sm text-gray-500 border-b border-gray-800">
                    <th className="text-left px-4 py-3 font-medium">Asset</th>
                    <th className="text-right px-4 py-3 font-medium">Shares</th>
                    <th className="text-right px-4 py-3 font-medium">Avg Cost</th>
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-right px-4 py-3 font-medium">Value</th>
                    <th className="text-right px-4 py-3 font-medium">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => {
                    const priceData = prices[holding.symbol] || {};
                    const currentPrice = holding.currentPrice || priceData.price || holding.avgCost;
                    const value = holding.marketValue || (currentPrice * holding.shares);
                    const pl = holding.unrealizedPL || (value - (holding.avgCost * holding.shares));
                    const plPercent = holding.unrealizedPLPercent || (holding.avgCost > 0 ? ((currentPrice - holding.avgCost) / holding.avgCost) * 100 : 0);
                    const isPositive = pl >= 0;
                    
                    return (
                      <tr key={holding.symbol} className="border-b border-gray-800/50 hover:bg-[#0d1829] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">{holding.symbol}</div>
                          <div className="text-gray-500 text-sm">{holding.name}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-white">{holding.shares}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(holding.avgCost)}</td>
                        <td className="px-4 py-3 text-right text-white">{formatCurrency(currentPrice)}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(value)}</td>
                        <td className={`px-4 py-3 text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          <div>{isPositive ? '+' : ''}{formatCurrency(pl)}</div>
                          <div className="text-sm">{isPositive ? '+' : ''}{plPercent.toFixed(2)}%</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Broker Connect Modal */}
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
