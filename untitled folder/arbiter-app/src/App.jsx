import { useState, useEffect } from 'react'

// Mock data for opportunities
const mockOpportunities = [
  {
    id: '1',
    event: 'Who Will Trump Pardon in 2026',
    outcome: 'Donald Trump',
    yesOn: 'kalshi',
    noOn: 'polymarket',
    grossSpread: 15.0,
    fees: 1,
    netProfit: 14.0,
    category: 'politics',
    volume24h: 125000,
    liquidity: 89000,
    resolvesIn: '7d',
  },
  {
    id: '2',
    event: 'Who Will Leave Trump Administration...',
    outcome: 'Karoline Leavitt',
    yesOn: 'polymarket',
    noOn: 'kalshi',
    grossSpread: 14.0,
    fees: 2,
    netProfit: 12.0,
    category: 'politics',
    volume24h: 98000,
    liquidity: 67000,
    resolvesIn: '30d',
  },
  {
    id: '3',
    event: 'Who Will Attend Taylor Swift and Tra...',
    outcome: 'Max Martin',
    yesOn: 'polymarket',
    noOn: 'kalshi',
    grossSpread: 8.0,
    fees: 2,
    netProfit: 6.0,
    category: 'entertainment',
    volume24h: 45000,
    liquidity: 32000,
    resolvesIn: '90d',
  },
  {
    id: '4',
    event: 'French Presidential Election 2027',
    outcome: 'Marine Le Pen',
    yesOn: 'polymarket',
    noOn: 'kalshi',
    grossSpread: 6.0,
    fees: 1,
    netProfit: 5.0,
    category: 'politics',
    volume24h: 234000,
    liquidity: 156000,
    resolvesIn: '1yr',
  },
  {
    id: '5',
    event: 'Bitcoin Price on March 31, 2026',
    outcome: 'Above $100,000',
    yesOn: 'kalshi',
    noOn: 'polymarket',
    grossSpread: 4.5,
    fees: 1,
    netProfit: 3.5,
    category: 'crypto',
    volume24h: 892000,
    liquidity: 445000,
    resolvesIn: '30d',
  },
  {
    id: '6',
    event: 'Super Bowl LX Champion',
    outcome: 'Kansas City Chiefs',
    yesOn: 'polymarket',
    noOn: 'kalshi',
    grossSpread: 3.2,
    fees: 1,
    netProfit: 2.2,
    category: 'sports',
    volume24h: 1200000,
    liquidity: 678000,
    resolvesIn: '7d',
  },
  {
    id: '7',
    event: 'Fed Interest Rate Decision - March',
    outcome: 'Rate Cut',
    yesOn: 'kalshi',
    noOn: 'polymarket',
    grossSpread: 2.8,
    fees: 1,
    netProfit: 1.8,
    category: 'finance',
    volume24h: 567000,
    liquidity: 234000,
    resolvesIn: '30d',
  },
  {
    id: '8',
    event: 'Ethereum Price End of Q2 2026',
    outcome: 'Above $5,000',
    yesOn: 'polymarket',
    noOn: 'kalshi',
    grossSpread: 2.1,
    fees: 1,
    netProfit: 1.1,
    category: 'crypto',
    volume24h: 345000,
    liquidity: 189000,
    resolvesIn: '90d',
  },
]

function App() {
  const [opportunities, setOpportunities] = useState(mockOpportunities)
  const [filters, setFilters] = useState({
    minProfit: 0,
    minVolume: 0,
    minLiquidity: 0,
    resolvesWithin: 'any',
    platform: 'any',
    search: '',
  })
  const [activeTab, setActiveTab] = useState('scanner')
  const [sortBy, setSortBy] = useState('netProfit')
  const [sortDir, setSortDir] = useState('desc')

  // Filter and sort opportunities
  const filteredOpps = opportunities
    .filter(opp => {
      if (filters.minProfit > 0 && opp.netProfit < filters.minProfit) return false
      if (filters.minVolume > 0 && opp.volume24h < filters.minVolume) return false
      if (filters.minLiquidity > 0 && opp.liquidity < filters.minLiquidity) return false
      if (filters.platform !== 'any' && opp.yesOn !== filters.platform) return false
      if (filters.search && !opp.event.toLowerCase().includes(filters.search.toLowerCase()) && 
          !opp.outcome.toLowerCase().includes(filters.search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(column)
      setSortDir('desc')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-gray-900">arbiter</span>
            </div>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {['Hub', 'Arbitrage', 'Sports', 'Finance', 'Crypto'].map(item => (
                <button
                  key={item}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    item === 'Arbitrage' 
                      ? 'text-gray-900 bg-gray-100' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-3">
              <a href="https://twitter.com" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors">
                <span>Jeff</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">Arbitrage Scanner</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Live
              </span>
              <span className="text-sm text-gray-400">Updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-4">
          {[
            { id: 'scanner', label: 'Arbitrage Scanner', icon: '↻' },
            { id: 'volume', label: 'Volume Dashboard', icon: '📊' },
            { id: 'differences', label: 'Market Differences', icon: '📈' },
            { id: 'whale', label: 'Whale Tracking', icon: '🐋' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Arbitrage Opportunities</h2>
          <p className="text-sm text-gray-500">Risk-free profit opportunities by buying YES and NO on different markets</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-4 gap-8 mb-6">
            {/* Min Net Profit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Min Net Profit</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={filters.minProfit}
                  onChange={(e) => setFilters({...filters, minProfit: parseFloat(e.target.value)})}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="w-16 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center font-mono">
                  {filters.minProfit.toFixed(1)}¢
                </div>
              </div>
            </div>

            {/* Min 24h Volume */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Min 24h Volume</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1000000"
                  step="10000"
                  value={filters.minVolume}
                  onChange={(e) => setFilters({...filters, minVolume: parseInt(e.target.value)})}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="w-20 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center font-mono">
                  ${filters.minVolume > 0 ? (filters.minVolume / 1000).toFixed(0) + 'k' : '0'}
                </div>
              </div>
            </div>

            {/* Min Liquidity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Min Liquidity</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="10000"
                  value={filters.minLiquidity}
                  onChange={(e) => setFilters({...filters, minLiquidity: parseInt(e.target.value)})}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="w-20 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center font-mono">
                  ${filters.minLiquidity > 0 ? (filters.minLiquidity / 1000).toFixed(0) + 'k' : '0'}
                </div>
              </div>
            </div>

            {/* Resolves Within */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Resolves Within</label>
              <div className="flex items-center gap-1">
                {['any', '7d', '30d', '90d', '1yr'].map(period => (
                  <button
                    key={period}
                    onClick={() => setFilters({...filters, resolvesWithin: period})}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      filters.resolvesWithin === period
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {period === 'any' ? 'Any' : period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Platform Filter + Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Buy YES on</span>
              {['any', 'kalshi', 'polymarket'].map(platform => (
                <button
                  key={platform}
                  onClick={() => setFilters({...filters, platform})}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    filters.platform === platform
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {platform === 'any' ? 'Any' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                </button>
              ))}
              <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Actionable Only
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{filteredOpps.length}</span> of <span className="font-semibold text-gray-900">{opportunities.length}</span> opportunities
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by event or outcome..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                  <button onClick={() => handleSort('event')} className="flex items-center gap-1 hover:text-gray-900">
                    Event
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </th>
                <th className="text-left px-4 py-4 text-sm font-medium text-gray-500">Outcome</th>
                <th className="text-left px-4 py-4 text-sm font-medium text-gray-500">Trade</th>
                <th className="text-right px-4 py-4 text-sm font-medium text-gray-500">
                  <button onClick={() => handleSort('grossSpread')} className="flex items-center gap-1 ml-auto hover:text-gray-900">
                    Gross Spread
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </th>
                <th className="text-right px-4 py-4 text-sm font-medium text-gray-500">Fees</th>
                <th className="text-right px-4 py-4 text-sm font-medium text-gray-500">
                  <button onClick={() => handleSort('netProfit')} className="flex items-center gap-1 ml-auto hover:text-gray-900">
                    Net Profit
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </th>
                <th className="text-center px-4 py-4 text-sm font-medium text-gray-500">Links</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpps.map((opp, index) => (
                <tr 
                  key={opp.id} 
                  className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                >
                  <td className="px-6 py-4">
                    <button className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-emerald-600 transition-colors">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {opp.event}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">
                      {opp.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">BUY YES</span>
                        <span className="text-xs text-gray-500">on</span>
                        <span className="text-xs font-semibold text-gray-700 uppercase">{opp.yesOn}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">BUY NO</span>
                        <span className="text-xs text-gray-500">on</span>
                        <span className="text-xs font-semibold text-gray-700 uppercase">{opp.noOn}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-mono text-gray-900">{opp.grossSpread.toFixed(1)}¢</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-mono text-gray-500">{opp.fees}¢</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-mono font-semibold text-emerald-600">+{opp.netProfit.toFixed(1)}¢</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <a 
                        href="#" 
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                        title="Open on Kalshi"
                      >
                        K
                      </a>
                      <a 
                        href="#" 
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                        title="Open on Polymarket"
                      >
                        P
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Data refreshes every 10 seconds • Not financial advice • <a href="#" className="text-emerald-600 hover:underline">Learn about arbitrage</a></p>
        </div>
      </main>
    </div>
  )
}

export default App
