import React, { useState, useEffect } from 'react';

// Mock portfolio data (will connect to real API later)
const portfolioData = {
  totalValue: 2847392.45,
  todayChange: 12847.32,
  todayChangePercent: 0.45,
  recentTrades: [
    { symbol: 'TSLA', type: 'Long', pnl: 2847.32, pnlPercent: 1.2, color: 'emerald' },
    { symbol: 'SPY', type: 'Short', pnl: -432.10, pnlPercent: -0.3, color: 'red' },
    { symbol: 'NVDA', type: 'Long', pnl: 1203.45, pnlPercent: 0.8, color: 'emerald' },
    { symbol: 'AAPL', type: 'Long', pnl: 567.89, pnlPercent: 0.4, color: 'emerald' },
  ],
  chartData: [
    2650000, 2680000, 2720000, 2695000, 2740000, 2760000, 2785000, 2810000, 2847392.45
  ]
};

// Landing Page Component
const LandingPage = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg" />
          <span className="text-xl font-bold">Stratify</span>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <button className="px-4 py-2 hover:bg-white/5 rounded-lg transition-colors">Log In</button>
          <button 
            onClick={onEnter}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-8 py-20">
        <div className="grid grid-cols-2 gap-12 items-center">
          {/* Left Column */}
          <div>
            <h1 className="text-6xl font-bold mb-6 leading-tight">
              A <span className="italic font-light">smarter way</span>
              <br />to trade
            </h1>
            <p className="text-xl text-gray-400 mb-8">
              AI-powered strategies, real-time backtesting, and automated execution. All on one platform.
            </p>
            
            {/* Email Signup */}
            <div className="flex gap-3 mb-4">
              <input 
                type="email"
                placeholder="What's your email?"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <button 
                onClick={onEnter}
                className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>

          {/* Right Column - Portfolio Card */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">Portfolio Value</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400">Live</span>
              </div>
            </div>
            
            <div className="text-5xl font-bold mb-2">
              ${portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            
            <div className="flex items-center gap-2 mb-6">
              <span className="text-emerald-400 font-mono">+${portfolioData.todayChange.toLocaleString()}</span>
              <span className="text-emerald-400">({portfolioData.todayChangePercent}%)</span>
            </div>

            {/* Mini Chart */}
            <div className="h-32 mb-6 relative">
              <svg className="w-full h-full" viewBox="0 0 400 128" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgb(251, 146, 60)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="rgb(251, 146, 60)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`M 0,${128 - (portfolioData.chartData[0] - 2600000) / 5000} ${portfolioData.chartData.map((val, i) => `L ${(i / (portfolioData.chartData.length - 1)) * 400},${128 - (val - 2600000) / 5000}`).join(' ')} L 400,128 L 0,128 Z`}
                  fill="url(#chartGradient)"
                />
                <path
                  d={`M 0,${128 - (portfolioData.chartData[0] - 2600000) / 5000} ${portfolioData.chartData.map((val, i) => `L ${(i / (portfolioData.chartData.length - 1)) * 400},${128 - (val - 2600000) / 5000}`).join(' ')}`}
                  fill="none"
                  stroke="rgb(251, 146, 60)"
                  strokeWidth="2"
                />
              </svg>
              
              {/* Time labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 pt-2">
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
                <span>SUN</span>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="space-y-2 mb-4">
              <div className="text-sm font-semibold text-gray-400 mb-3">Recent Trades</div>
              {portfolioData.recentTrades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${trade.color === 'emerald' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="font-semibold">{trade.symbol}</span>
                    <span className="text-sm text-gray-500">{trade.type}</span>
                  </div>
                  <span className={`font-mono font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${Math.abs(trade.pnl).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Strategy Alert */}
            <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-emerald-400">Strategy Deployed!</div>
                <div className="text-xs text-gray-400">TSLA EMA Crossover running</div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-32">
          <h2 className="text-4xl font-bold text-center mb-16">Everything you need to trade smarter</h2>
          <div className="text-lg text-gray-400 text-center mb-16">Professional-grade tools, zero complexity.</div>
          
          <div className="grid grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-8">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold mb-3">AI-Powered Strategies</h3>
              <p className="text-gray-400">Machine learning models that adapt to market conditions in real-time.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-8">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-3">Advanced Analytics</h3>
              <p className="text-gray-400">Deep insights into your portfolio performance and risk metrics.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-8">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-xl font-bold mb-3">Seamless Integration</h3>
              <p className="text-gray-400">Connect your favorite brokers and execute trades automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ setCurrentPage }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top Navigation with Back Button */}
      <nav className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            {/* Back Button */}
            <button 
              onClick={() => setCurrentPage('landing')}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group"
              title="Back to home"
            >
              <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-gray-400 group-hover:text-white transition-colors text-sm font-medium">Back</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg" />
              <span className="text-xl font-bold">Stratify</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">Live Trading</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-white/5 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
            </button>
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer">
              JD
            </div>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Portfolio Overview */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="col-span-2 bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="text-sm text-gray-400 mb-2">Total Portfolio Value</div>
              <div className="text-5xl font-bold mb-4">
                ${portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-emerald-400 font-mono text-xl">+${portfolioData.todayChange.toLocaleString()}</span>
                <span className="text-emerald-400">({portfolioData.todayChangePercent}%) today</span>
              </div>

              {/* Chart */}
              <div className="h-48 mb-4">
                <svg className="w-full h-full" viewBox="0 0 600 192" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="dashGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgb(251, 146, 60)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="rgb(251, 146, 60)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 0,${192 - (portfolioData.chartData[0] - 2600000) / 3000} ${portfolioData.chartData.map((val, i) => `L ${(i / (portfolioData.chartData.length - 1)) * 600},${192 - (val - 2600000) / 3000}`).join(' ')} L 600,192 L 0,192 Z`}
                    fill="url(#dashGradient)"
                  />
                  <path
                    d={`M 0,${192 - (portfolioData.chartData[0] - 2600000) / 3000} ${portfolioData.chartData.map((val, i) => `L ${(i / (portfolioData.chartData.length - 1)) * 600},${192 - (val - 2600000) / 3000}`).join(' ')}`}
                    fill="none"
                    stroke="rgb(251, 146, 60)"
                    strokeWidth="3"
                  />
                </svg>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>9:30 AM</span>
                <span>11:00 AM</span>
                <span>1:00 PM</span>
                <span>3:00 PM</span>
                <span>4:00 PM</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">Win Rate</div>
                <div className="text-3xl font-bold">73.4%</div>
                <div className="text-sm text-emerald-400 mt-1">↑ 2.1% this week</div>
              </div>

              <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">Active Strategies</div>
                <div className="text-3xl font-bold">8</div>
                <div className="text-sm text-gray-400 mt-1">2 pending approval</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">Recent Trades</h2>
            <div className="space-y-3">
              {portfolioData.recentTrades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${trade.color === 'emerald' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div>
                      <div className="font-semibold">{trade.symbol}</div>
                      <div className="text-sm text-gray-400">{trade.type} Position</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-semibold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.pnl >= 0 ? '+' : ''}${Math.abs(trade.pnl).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-400">{trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
export default function StratifyApp() {
  const [currentPage, setCurrentPage] = useState('landing');

  if (currentPage === 'landing') {
    return <LandingPage onEnter={() => setCurrentPage('dashboard')} />;
  }

  return <Dashboard setCurrentPage={setCurrentPage} />;
}
