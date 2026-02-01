import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, PieChart, DollarSign, Percent, RefreshCw, Loader2 } from 'lucide-react';
import { getQuotes } from '../../services/marketData';

const PortfolioPage = ({ themeClasses, alpacaData }) => {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Mock data that syncs with TopMetricsBar (same initial values)
  const [mockData, setMockData] = useState({
    netLiq: 125840.00,
    buyingPower: 251680.00,
    dailyPnL: 1247.83
  });

  // Animate mock values to stay in sync with TopMetricsBar animation pattern
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

  // Demo holdings (used when no real positions available)
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
  
  // Use real Alpaca positions or demo holdings
  const positions = alpacaData?.positions?.length > 0 ? alpacaData.positions : null;
  
  // Account values - use real data if available, otherwise mock
  const netLiquidity = hasRealData ? account.equity : mockData.netLiq;
  const buyingPower = hasRealData ? (account.buying_power ?? 0) : mockData.buyingPower;
  const dailyPnL = hasRealData ? (account.daily_pnl ?? 0) : mockData.dailyPnL;

  // Convert Alpaca positions to holdings format
  const holdings = useMemo(() => {
    if (positions) {
      return positions.map(pos => ({
        symbol: pos.symbol,
        name: pos.symbol, // Alpaca doesn't provide name, use symbol
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
      // Already have real-time data from Alpaca
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
    let todayChange = 0;

    const holdingsWithPrices = holdings.map(holding => {
      // If we have real Alpaca data
      if (holding.marketValue !== undefined) {
        holdingsValue += holding.marketValue;
        totalCost += holding.avgCost * holding.shares;
        todayChange += holding.unrealizedPL;
        
        return {
          ...holding,
          value: holding.marketValue,
          pl: holding.unrealizedPL,
          plPercent: holding.unrealizedPLPercent,
          dayPL: holding.unrealizedPL,
          priceChange: null,
          priceChangePercent: holding.unrealizedPLPercent,
        };
      }
      
      // Demo data with fetched prices
      const priceData = prices[holding.symbol] || {};
      const currentPrice = priceData.price || holding.avgCost;
      const value = currentPrice * holding.shares;
      const cost = holding.avgCost * holding.shares;
      const pl = value - cost;
      const plPercent = cost > 0 ? ((value - cost) / cost) * 100 : 0;
      const dayPL = (priceData.change || 0) * holding.shares;

      holdingsValue += value;
      totalCost += cost;
      todayChange += dayPL;

      return {
        ...holding,
        currentPrice,
        value,
        pl,
        plPercent,
        dayPL,
        priceChange: priceData.change,
        priceChangePercent: priceData.changePercent,
      };
    });

    // Calculate cash as the difference between NET LIQ and holdings value
    const cashBalance = netLiquidity - holdingsValue;
    const totalPL = holdingsValue - totalCost;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const todayChangePercent = netLiquidity > 0 ? (dailyPnL / netLiquidity) * 100 : 0;

    // Calculate allocation
    const allocation = [
      { 
        category: 'Stocks', 
        value: holdingsValue,
        color: 'bg-blue-500' 
      },
      { category: 'Cash', value: Math.max(0, cashBalance), color: 'bg-gray-500' },
    ].map(item => ({
      ...item,
      percent: netLiquidity > 0 ? (item.value / netLiquidity) * 100 : 0,
    }));

    return {
      holdings: holdingsWithPrices,
      totalValue: netLiquidity,
      totalPL,
      totalPLPercent,
      todayChange: dailyPnL,
      todayChangePercent,
      allocation,
      cashBalance: Math.max(0, cashBalance),
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Portfolio</h1>
          <p className="text-gray-400 text-sm">
            {loading ? 'Updating prices...' : lastUpdate ? `Last updated ${lastUpdate.toLocaleTimeString()}` : 'Track your investments'}
          </p>
        </div>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Wallet className="w-4 h-4" strokeWidth={1.5} />
            Total Value
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(portfolioData.totalValue)}
          </div>
          <div className={`flex items-center gap-1 text-sm mt-1 ${portfolioData.todayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioData.todayChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {portfolioData.todayChange >= 0 ? '+' : ''}{formatCurrency(portfolioData.todayChange)} ({portfolioData.todayChangePercent.toFixed(2)}%) today
          </div>
        </div>

        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <DollarSign className="w-4 h-4" strokeWidth={1.5} />
            Buying Power
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(buyingPower)}</div>
          <div className="text-sm text-gray-500 mt-1">Available for trading</div>
        </div>

        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Percent className="w-4 h-4" strokeWidth={1.5} />
            Total Return
          </div>
          <div className={`text-2xl font-bold ${portfolioData.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioData.totalPL >= 0 ? '+' : ''}{portfolioData.totalPLPercent.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {portfolioData.totalPL >= 0 ? '+' : ''}{formatCurrency(portfolioData.totalPL)} all time
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Holdings */}
        <div className="lg:col-span-2 bg-[#0a1628] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-white font-medium">Holdings</h3>
          </div>
          <div className="overflow-auto">
            {loading && Object.keys(prices).length === 0 && !positions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-800">
                    <th className="text-left px-4 py-2">Symbol</th>
                    <th className="text-right px-4 py-2">Shares</th>
                    <th className="text-right px-4 py-2">Avg Cost</th>
                    <th className="text-right px-4 py-2">Price</th>
                    <th className="text-right px-4 py-2">Value</th>
                    <th className="text-right px-4 py-2">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.holdings.map((holding) => {
                    const isPositive = holding.pl >= 0;
                    return (
                      <tr key={holding.symbol} className="border-b border-gray-800/50 hover:bg-[#0d1829]">
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">{holding.symbol}</div>
                          <div className="text-gray-500 text-xs">{holding.name}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-white">{holding.shares}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(holding.avgCost)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-white">{formatCurrency(holding.currentPrice)}</div>
                          {holding.priceChangePercent != null && (
                            <div className={`text-xs ${holding.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {holding.priceChangePercent >= 0 ? '+' : ''}{holding.priceChangePercent.toFixed(2)}%
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-white font-medium">
                          {formatCurrency(holding.value)}
                        </td>
                        <td className={`px-4 py-3 text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{formatCurrency(holding.pl)}
                          <div className="text-xs">{isPositive ? '+' : ''}{holding.plPercent.toFixed(1)}%</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Allocation */}
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium">Allocation</h3>
          </div>
          <div className="space-y-3">
            {portfolioData.allocation.map((item) => (
              <div key={item.category}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-300">{item.category}</span>
                  <span className="text-white font-medium">{item.percent.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.percent}%` }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatCurrency(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;
