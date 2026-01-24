import React, { useState, useEffect } from 'react';

// Mock data for the prototype
const mockStocks = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: 875.42, change: 4.82, changePercent: 0.55, aiScore: 94, signal: 'STRONG BUY', volume: '52.3M', marketCap: '2.16T' },
  { symbol: 'AAPL', name: 'Apple Inc', price: 189.84, change: -1.23, changePercent: -0.64, aiScore: 78, signal: 'HOLD', volume: '48.1M', marketCap: '2.94T' },
  { symbol: 'TSLA', name: 'Tesla Inc', price: 248.50, change: 12.34, changePercent: 5.23, aiScore: 87, signal: 'BUY', volume: '89.2M', marketCap: '791B' },
  { symbol: 'AMD', name: 'AMD Inc', price: 178.92, change: 3.45, changePercent: 1.97, aiScore: 91, signal: 'STRONG BUY', volume: '34.5M', marketCap: '289B' },
  { symbol: 'MSFT', name: 'Microsoft', price: 425.22, change: 2.11, changePercent: 0.50, aiScore: 82, signal: 'BUY', volume: '21.3M', marketCap: '3.16T' },
  { symbol: 'META', name: 'Meta Platforms', price: 505.75, change: -3.42, changePercent: -0.67, aiScore: 73, signal: 'HOLD', volume: '15.8M', marketCap: '1.29T' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', price: 175.98, change: 1.87, changePercent: 1.07, aiScore: 85, signal: 'BUY', volume: '18.9M', marketCap: '2.18T' },
  { symbol: 'AMZN', name: 'Amazon.com', price: 186.45, change: 4.21, changePercent: 2.31, aiScore: 88, signal: 'BUY', volume: '32.1M', marketCap: '1.94T' },
];

const mockPositions = [
  { symbol: 'NVDA', shares: 50, avgCost: 725.00, currentPrice: 875.42, totalValue: 43771, totalGain: 7521, gainPercent: 20.75 },
  { symbol: 'AAPL', shares: 100, avgCost: 175.50, currentPrice: 189.84, totalValue: 18984, totalGain: 1434, gainPercent: 8.17 },
  { symbol: 'TSLA', shares: 25, avgCost: 220.00, currentPrice: 248.50, totalValue: 6212.50, totalGain: 712.50, gainPercent: 12.95 },
  { symbol: 'AMD', shares: 75, avgCost: 155.00, currentPrice: 178.92, totalValue: 13419, totalGain: 1794, gainPercent: 15.44 },
];

const mockLeaderboard = [
  { rank: 1, username: 'AlphaTrader', avatar: '🏆', returns: 342.5, winRate: 78, followers: 12453, badge: 'LEGEND' },
  { rank: 2, username: 'QuantKing', avatar: '👑', returns: 289.2, winRate: 74, followers: 8921, badge: 'ELITE' },
  { rank: 3, username: 'MarketMaven', avatar: '🔥', returns: 245.8, winRate: 71, followers: 7234, badge: 'ELITE' },
  { rank: 4, username: 'TechBull', avatar: '🚀', returns: 198.4, winRate: 68, followers: 5678, badge: 'PRO' },
  { rank: 5, username: 'SwingMaster', avatar: '📈', returns: 175.2, winRate: 65, followers: 4521, badge: 'PRO' },
  { rank: 6, username: 'ValueHunter', avatar: '💎', returns: 156.7, winRate: 63, followers: 3892, badge: 'PRO' },
  { rank: 7, username: 'MomentumX', avatar: '⚡', returns: 143.2, winRate: 61, followers: 3245, badge: 'RISING' },
  { rank: 8, username: 'DayTraderPro', avatar: '🎯', returns: 128.9, winRate: 59, followers: 2876, badge: 'RISING' },
];

const mockAlerts = [
  { id: 1, type: 'ai', message: 'NVDA showing strong momentum breakout pattern', time: '2m ago', priority: 'high' },
  { id: 2, type: 'price', message: 'TSLA up 5% - approaching resistance at $255', time: '5m ago', priority: 'medium' },
  { id: 3, type: 'ai', message: 'AMD AI score upgraded to 91 - institutional buying detected', time: '12m ago', priority: 'high' },
  { id: 4, type: 'news', message: 'Fed minutes released - markets react positively', time: '18m ago', priority: 'low' },
];

// Animated background component
const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
    <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
  </div>
);

// Landing Page Component
const LandingPage = ({ onEnter }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  return (
    <div 
      className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden relative"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      
      {/* Mouse follow glow */}
      <div 
        className="absolute w-96 h-96 rounded-full pointer-events-none transition-all duration-300 ease-out"
        style={{
          left: mousePos.x - 192,
          top: mousePos.y - 192,
          background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
        }}
      />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
            <span className="text-xl font-black text-black">S</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">Stratify</span>
        </div>
        <div className="flex items-center gap-8">
          <a href="#" className="text-gray-400 hover:text-white transition-colors">Features</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">About</a>
          <button 
            onClick={onEnter}
            className="px-5 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all"
          >
            Sign In
          </button>
        </div>
      </nav>
      
      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-8">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">AI-Powered Market Intelligence</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6 leading-none">
          <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            See The Market
          </span>
          <br />
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Before It Moves
          </span>
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
          The world's most advanced stock scanner powered by artificial intelligence. 
          Predict market movements, find opportunities, and trade with confidence.
        </p>
        
        <div className="flex gap-4">
          <button 
            onClick={onEnter}
            className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-bold text-lg text-black hover:shadow-lg hover:shadow-emerald-500/25 transition-all hover:scale-105"
          >
            Start Trading Free
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </button>
          <button className="px-8 py-4 border border-white/20 rounded-xl font-medium text-lg hover:bg-white/5 transition-all">
            Watch Demo
          </button>
        </div>
        
        {/* Stats */}
        <div className="flex gap-16 mt-20">
          {[
            { value: '$2.4B+', label: 'Trading Volume' },
            { value: '94.7%', label: 'AI Accuracy' },
            { value: '50K+', label: 'Active Traders' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Floating UI Preview */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8">
        <div className="bg-gradient-to-b from-gray-900/80 to-transparent backdrop-blur-sm rounded-t-2xl border border-white/10 border-b-0 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 h-8 bg-white/5 rounded-lg" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {['NVDA', 'AAPL', 'TSLA', 'AMD'].map((symbol, i) => (
              <div key={symbol} className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-sm font-bold">{symbol}</div>
                <div className={`text-lg font-mono ${i % 2 === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {i % 2 === 0 ? '+' : '-'}{(Math.random() * 5).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ setCurrentPage }) => {
  const [selectedStock, setSelectedStock] = useState(mockStocks[0]);
  const [scannerFilter, setScannerFilter] = useState('all');
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AnimatedBackground />
      
      {/* Top Bar */}
      <div className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
                <span className="text-sm font-black text-black">S</span>
              </div>
              <span className="text-xl font-bold">Stratify</span>
            </div>
            
            {/* Market Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">Market Open</span>
            </div>
            
            {/* Index Tickers */}
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">S&P 500</span>
                <span className="ml-2 text-emerald-400 font-mono">5,234.18 +0.45%</span>
              </div>
              <div>
                <span className="text-gray-500">NASDAQ</span>
                <span className="ml-2 text-emerald-400 font-mono">16,428.82 +0.62%</span>
              </div>
              <div>
                <span className="text-gray-500">DOW</span>
                <span className="ml-2 text-red-400 font-mono">39,127.14 -0.12%</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search stocks..."
                className="w-64 px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Notifications */}
            <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
            </button>
            
            {/* Profile */}
            <button 
              onClick={() => setCurrentPage('profile')}
              className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-sm"
            >
              JD
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-1 px-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'positions', label: 'My Positions', icon: '💼' },
            { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
            { id: 'profile', label: 'Profile', icon: '👤' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentPage(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab.id === 'dashboard' 
                  ? 'text-white border-emerald-400' 
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 p-6">
        <div className="grid grid-cols-12 gap-6">
          
          {/* Left Column - Scanner */}
          <div className="col-span-8">
            {/* AI Scanner Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">AI Stock Scanner</h2>
                <p className="text-gray-500">Real-time opportunities powered by machine learning</p>
              </div>
              <div className="flex gap-2">
                {['all', 'momentum', 'value', 'breakout'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setScannerFilter(filter)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      scannerFilter === filter
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-gray-400 border border-transparent hover:border-white/10'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Scanner Table */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Symbol</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Score</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Signal</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Volume</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mkt Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {mockStocks.map((stock, i) => (
                    <tr 
                      key={stock.symbol}
                      onClick={() => setSelectedStock(stock)}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${
                        selectedStock?.symbol === stock.symbol ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                      }`}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold text-sm">
                            {stock.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold">{stock.symbol}</div>
                            <div className="text-xs text-gray-500">{stock.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-medium">${stock.price.toFixed(2)}</td>
                      <td className={`px-4 py-4 text-right font-mono ${stock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                            stock.aiScore >= 90 ? 'bg-emerald-500/20 text-emerald-400' :
                            stock.aiScore >= 80 ? 'bg-cyan-500/20 text-cyan-400' :
                            stock.aiScore >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {stock.aiScore}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <span className={`px-3 py-1 rounded text-xs font-bold ${
                            stock.signal === 'STRONG BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            stock.signal === 'BUY' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                            stock.signal === 'HOLD' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {stock.signal}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-400 font-mono text-sm">{stock.volume}</td>
                      <td className="px-4 py-4 text-right text-gray-400 font-mono text-sm">{stock.marketCap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Right Column - Details and Alerts */}
          <div className="col-span-4 space-y-6">
            {/* Selected Stock Detail */}
            {selectedStock && (
              <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">{selectedStock.symbol}</h3>
                    <p className="text-gray-500">{selectedStock.name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                    selectedStock.signal === 'STRONG BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                    selectedStock.signal === 'BUY' ? 'bg-cyan-500/20 text-cyan-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedStock.signal}
                  </div>
                </div>
                
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-4xl font-bold font-mono">${selectedStock.price.toFixed(2)}</span>
                  <span className={`text-lg font-mono ${selectedStock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)} ({selectedStock.changePercent.toFixed(2)}%)
                  </span>
                </div>
                
                {/* AI Analysis */}
                <div className="bg-black/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🤖</span>
                    <span className="font-semibold">AI Analysis</span>
                    <span className="ml-auto text-emerald-400 font-bold">{selectedStock.aiScore}/100</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${selectedStock.aiScore}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400">
                    Strong momentum indicators with bullish volume profile. Technical patterns suggest continuation. 
                    Institutional accumulation detected over past 5 sessions.
                  </p>
                </div>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-bold transition-colors">
                    Buy
                  </button>
                  <button className="py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-bold transition-colors">
                    Watchlist
                  </button>
                </div>
              </div>
            )}
            
            {/* Live Alerts */}
            <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Live Alerts</h3>
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              <div className="space-y-3">
                {mockAlerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.priority === 'high' ? 'bg-emerald-500/10 border-emerald-500/30' :
                      alert.priority === 'medium' ? 'bg-cyan-500/10 border-cyan-500/30' :
                      'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">
                        {alert.type === 'ai' ? '🤖' : alert.type === 'price' ? '📈' : '📰'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Portfolio Summary Mini */}
            <div className="bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Portfolio Value</span>
                <span className="text-emerald-400 text-sm">+12.45% today</span>
              </div>
              <div className="text-3xl font-bold font-mono">$82,386.50</div>
              <div className="text-emerald-400 text-sm mt-1">+$9,461.00 all time</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Positions Page
const PositionsPage = ({ setCurrentPage }) => {
  const totalValue = mockPositions.reduce((sum, p) => sum + p.totalValue, 0);
  const totalGain = mockPositions.reduce((sum, p) => sum + p.totalGain, 0);
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AnimatedBackground />
      <NavBar currentPage="positions" setCurrentPage={setCurrentPage} />
      
      <div className="relative z-10 p-6">
        {/* Portfolio Header */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="col-span-2 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-6">
            <div className="text-gray-400 mb-1">Total Portfolio Value</div>
            <div className="text-5xl font-bold font-mono">${totalValue.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-emerald-400 font-mono">+${totalGain.toLocaleString()}</span>
              <span className="text-emerald-400">(+{((totalGain / (totalValue - totalGain)) * 100).toFixed(2)}%)</span>
              <span className="text-gray-500">all time</span>
            </div>
          </div>
          
          <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="text-gray-400 mb-1">Today's P&L</div>
            <div className="text-3xl font-bold font-mono text-emerald-400">+$1,234.56</div>
            <div className="text-emerald-400 text-sm mt-1">+1.52%</div>
          </div>
          
          <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="text-gray-400 mb-1">Buying Power</div>
            <div className="text-3xl font-bold font-mono">$24,500.00</div>
            <div className="text-gray-500 text-sm mt-1">Available to trade</div>
          </div>
        </div>
        
        {/* Positions Table */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-xl font-bold">Open Positions</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Symbol</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Shares</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Cost</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Current Price</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total Value</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total Gain/Loss</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockPositions.map((position) => (
                <tr key={position.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold">
                        {position.symbol.slice(0, 2)}
                      </div>
                      <span className="font-semibold">{position.symbol}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono">{position.shares}</td>
                  <td className="px-6 py-4 text-right font-mono text-gray-400">${position.avgCost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono">${position.currentPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono font-medium">${position.totalValue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className={position.totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      <div className="font-mono font-medium">
                        {position.totalGain >= 0 ? '+' : ''}${position.totalGain.toLocaleString()}
                      </div>
                      <div className="text-sm">
                        ({position.totalGain >= 0 ? '+' : ''}{position.gainPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded text-sm font-medium hover:bg-emerald-500/30 transition-colors">
                        Buy More
                      </button>
                      <button className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-sm font-medium hover:bg-red-500/30 transition-colors">
                        Sell
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Leaderboard Page
const LeaderboardPage = ({ setCurrentPage }) => {
  const [timeframe, setTimeframe] = useState('month');
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AnimatedBackground />
      <NavBar currentPage="leaderboard" setCurrentPage={setCurrentPage} />
      
      <div className="relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="text-gray-500">Top performing traders on Stratify</p>
          </div>
          <div className="flex gap-2">
            {['week', 'month', 'year', 'all'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeframe === tf
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Top 3 Podium */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[mockLeaderboard[1], mockLeaderboard[0], mockLeaderboard[2]].map((trader, i) => (
            <div 
              key={trader.username}
              className={`relative ${i === 1 ? 'transform -translate-y-4' : ''}`}
            >
              <div className={`bg-gradient-to-br ${
                i === 1 ? 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30' :
                i === 0 ? 'from-gray-400/20 to-gray-500/20 border-gray-400/30' :
                'from-orange-600/20 to-orange-700/20 border-orange-600/30'
              } backdrop-blur-sm border rounded-xl p-6 text-center`}>
                <div className="text-4xl mb-2">{trader.avatar}</div>
                <div className="text-2xl font-bold mb-1">#{trader.rank}</div>
                <div className="font-semibold text-lg">{trader.username}</div>
                <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-2 ${
                  trader.badge === 'LEGEND' ? 'bg-yellow-500/20 text-yellow-400' :
                  trader.badge === 'ELITE' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-cyan-500/20 text-cyan-400'
                }`}>
                  {trader.badge}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-2xl font-bold text-emerald-400">+{trader.returns}%</div>
                  <div className="text-gray-500 text-sm">returns</div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                    <div className="font-bold">{trader.winRate}%</div>
                    <div className="text-gray-500">Win Rate</div>
                  </div>
                  <div>
                    <div className="font-bold">{trader.followers.toLocaleString()}</div>
                    <div className="text-gray-500">Followers</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Full Leaderboard */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Rank</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Trader</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Returns</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Win Rate</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Followers</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {mockLeaderboard.map((trader) => (
                <tr key={trader.username} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`text-xl font-bold ${
                      trader.rank === 1 ? 'text-yellow-400' :
                      trader.rank === 2 ? 'text-gray-400' :
                      trader.rank === 3 ? 'text-orange-400' :
                      'text-gray-500'
                    }`}>
                      #{trader.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{trader.avatar}</div>
                      <div>
                        <div className="font-semibold">{trader.username}</div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          trader.badge === 'LEGEND' ? 'bg-yellow-500/20 text-yellow-400' :
                          trader.badge === 'ELITE' ? 'bg-purple-500/20 text-purple-400' :
                          trader.badge === 'PRO' ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {trader.badge}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-emerald-400 font-bold font-mono">+{trader.returns}%</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono">{trader.winRate}%</td>
                  <td className="px-6 py-4 text-right text-gray-400">{trader.followers.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors">
                      Follow
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Profile Page
const ProfilePage = ({ setCurrentPage, onSignOut }) => {
  const [darkMode, setDarkMode] = useState(true);
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AnimatedBackground />
      <NavBar currentPage="profile" setCurrentPage={setCurrentPage} />
      
      <div className="relative z-10 p-6 max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-3xl font-bold">
              JD
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">John Doe</h1>
              <p className="text-gray-400">@johndoe_trades</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm font-medium">PRO Member</span>
                <span className="text-gray-500">Member since Jan 2024</span>
              </div>
            </div>
            <button className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors">
              Edit Profile
            </button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-6 mt-6 pt-6 border-t border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">+156.4%</div>
              <div className="text-gray-500 text-sm">All-Time Returns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">68%</div>
              <div className="text-gray-500 text-sm">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">1,247</div>
              <div className="text-gray-500 text-sm">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">#127</div>
              <div className="text-gray-500 text-sm">Leaderboard Rank</div>
            </div>
          </div>
        </div>
        
        {/* Settings */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-xl font-bold">Settings</h2>
          </div>
          
          <div className="divide-y divide-white/10">
            {/* Theme Toggle */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  {darkMode ? '🌙' : '☀️'}
                </div>
                <div>
                  <div className="font-medium">Dark Mode</div>
                  <div className="text-sm text-gray-500">Toggle between dark and light theme</div>
                </div>
              </div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-emerald-500' : 'bg-gray-600'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transform transition-transform ${darkMode ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
            
            {/* Notifications */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">🔔</div>
                <div>
                  <div className="font-medium">Push Notifications</div>
                  <div className="text-sm text-gray-500">Get alerts for AI signals and price movements</div>
                </div>
              </div>
              <button className="w-14 h-8 rounded-full bg-emerald-500">
                <div className="w-6 h-6 bg-white rounded-full transform translate-x-7" />
              </button>
            </div>
            
            {/* Connected Accounts */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">🔗</div>
                <div>
                  <div className="font-medium">Connected Accounts</div>
                  <div className="text-sm text-gray-500">Alpaca Trading Account</div>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">Connected</span>
            </div>
            
            {/* Sign Out */}
            <div className="px-6 py-4">
              <button 
                onClick={onSignOut}
                className="w-full py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-medium hover:bg-red-500/30 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable NavBar component
const NavBar = ({ currentPage, setCurrentPage }) => (
  <div className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
            <span className="text-sm font-black text-black">S</span>
          </div>
          <span className="text-xl font-bold">Stratify</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">Market Open</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-white/5 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
        </button>
        <button 
          onClick={() => setCurrentPage('profile')}
          className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-sm"
        >
          JD
        </button>
      </div>
    </div>
    <div className="flex gap-1 px-6">
      {[
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'positions', label: 'My Positions', icon: '💼' },
        { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
        { id: 'profile', label: 'Profile', icon: '👤' },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setCurrentPage(tab.id)}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            currentPage === tab.id 
              ? 'text-white border-emerald-400' 
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          <span className="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

// Main App
export default function StratifyApp() {
  const [currentPage, setCurrentPage] = useState('landing');
  
  const handleEnter = () => setCurrentPage('dashboard');
  const handleSignOut = () => setCurrentPage('landing');
  
  switch (currentPage) {
    case 'landing':
      return <LandingPage onEnter={handleEnter} />;
    case 'dashboard':
      return <Dashboard setCurrentPage={setCurrentPage} />;
    case 'positions':
      return <PositionsPage setCurrentPage={setCurrentPage} />;
    case 'leaderboard':
      return <LeaderboardPage setCurrentPage={setCurrentPage} />;
    case 'profile':
      return <ProfilePage setCurrentPage={setCurrentPage} onSignOut={handleSignOut} />;
    default:
      return <Dashboard setCurrentPage={setCurrentPage} />;
  }
}
