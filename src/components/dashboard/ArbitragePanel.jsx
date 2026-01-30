import { useState, useEffect, useCallback } from 'react';
import { findArbitrageOpportunities } from '../../lib/arbScanner';

// Fallback mock data in case APIs fail
const FALLBACK_ARBS = [
  { id: 'fb-1', name: 'Bitcoin $100K by March', category: 'Crypto', polymarket: { side: 'YES', price: 42 }, kalshi: { side: 'NO', price: 55 }, spread: 3.0, sharpe: 1.8, foundAt: Date.now() },
  { id: 'fb-2', name: 'Fed Rate Cut March 2026', category: 'Economics', polymarket: { side: 'YES', price: 28 }, kalshi: { side: 'NO', price: 69 }, spread: 3.0, sharpe: 1.9, foundAt: Date.now() },
  { id: 'fb-3', name: 'Super Bowl Patriots Win', category: 'Sports', polymarket: { side: 'YES', price: 52 }, kalshi: { side: 'NO', price: 45 }, spread: 3.0, sharpe: 2.1, foundAt: Date.now() },
];

// Mock open bets
const MOCK_OPEN_BETS = [
  {
    id: 'bet-1',
    name: 'ETH $5K by April',
    polymarket: { side: 'YES', price: 38, amount: 50 },
    kalshi: { side: 'NO', price: 58, amount: 50 },
    totalInvested: 100,
    projectedProfit: 4.20,
    status: 'active',
    placedAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
  },
];

// Mock bet history
const MOCK_BET_HISTORY = [
  {
    id: 'hist-1',
    name: 'SPY $600 by Jan',
    totalInvested: 200,
    profit: 8.40,
    status: 'won',
    closedAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
  },
  {
    id: 'hist-2',
    name: 'AAPL $200 by Dec',
    totalInvested: 150,
    profit: -3.20,
    status: 'lost',
    closedAt: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
  },
];

// Arb Bet Slip Modal
const ArbBetSlipModal = ({ arb, onClose, onExecute }) => {
  const [betAmount, setBetAmount] = useState('');
  
  if (!arb) return null;
  
  const amount = parseFloat(betAmount) || 0;
  const HOUSE_FEE_PERCENT = 0.5;
  
  const yesPrice = arb.polymarket.price / 100;
  const noPrice = arb.kalshi.price / 100;
  const totalCost = yesPrice + noPrice;
  
  const yesAllocation = amount * (yesPrice / totalCost);
  const noAllocation = amount * (noPrice / totalCost);
  
  const grossPayout = amount / totalCost;
  const grossProfit = grossPayout - amount;
  const houseFee = amount * (HOUSE_FEE_PERCENT / 100);
  const netProfit = grossProfit - houseFee;
  const profitPercent = amount > 0 ? ((netProfit / amount) * 100).toFixed(1) : '0.0';
  
  const handleExecute = () => {
    if (amount > 0) {
      onExecute({
        ...arb,
        totalInvested: amount,
        projectedProfit: netProfit,
        polymarket: { ...arb.polymarket, amount: yesAllocation },
        kalshi: { ...arb.kalshi, amount: noAllocation },
      });
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#202124] border border-amber-500/50 rounded-xl w-[440px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#5f6368] bg-amber-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">🎯</span>
              <span className="text-sm font-medium text-white">Execute Arbitrage</span>
              <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded">+{arb.spread}% GUARANTEED</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="px-4 py-4 border-b border-[#5f6368]">
          <div className="text-white font-medium mb-2">{arb.name}</div>
          <div className="text-xs text-gray-400 mb-3">Sharpe: {arb.sharpe} • Category: {arb.category}</div>
          
          <div className="grid grid-cols-2 gap-3">
            <a 
              href={arb.polySlug ? `https://polymarket.com/event/${arb.polySlug}` : 'https://polymarket.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 hover:bg-emerald-500/20 transition-colors cursor-pointer block"
            >
              <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                <span>Polymarket</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </div>
              <div className="text-emerald-400 font-medium">{arb.polymarket.side} @ {arb.polymarket.price}¢</div>
              {amount > 0 && <div className="text-xs text-gray-400 mt-1">${yesAllocation.toFixed(2)}</div>}
            </a>
            <a 
              href={arb.kalshiTicker ? `https://kalshi.com/markets/${arb.kalshiTicker}` : 'https://kalshi.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 hover:bg-red-500/20 transition-colors cursor-pointer block"
            >
              <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                <span>Kalshi</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </div>
              <div className="text-red-400 font-medium">{arb.kalshi.side} @ {arb.kalshi.price}¢</div>
              {amount > 0 && <div className="text-xs text-gray-400 mt-1">${noAllocation.toFixed(2)}</div>}
            </a>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 text-center">Click each platform to place your bets →</p>
        </div>
        
        <div className="px-4 py-4">
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Investment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-3 bg-[#303134] border border-[#5f6368] rounded-lg text-white text-lg focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="flex gap-2 mb-4">
            {[50, 100, 250, 500].map(amt => (
              <button
                key={amt}
                onClick={() => setBetAmount(amt.toString())}
                className="flex-1 py-2 bg-[#303134] hover:bg-[#3c4043] border border-[#5f6368] rounded text-xs text-gray-300"
              >
                ${amt}
              </button>
            ))}
          </div>
          
          <div className="bg-[#303134] rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Investment</span>
                <span className="text-white">${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Guaranteed Payout</span>
                <span className="text-white">${grossPayout.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Stratify Fee (0.5%)</span>
                <span className="text-gray-500">-${houseFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-amber-500/30 pt-2">
                <span className="text-amber-400 font-medium">Net Profit</span>
                <span className="text-amber-400 font-semibold">+${netProfit.toFixed(2)} ({profitPercent}%)</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <a
                href={arb.polySlug ? `https://polymarket.com/event/${arb.polySlug}` : 'https://polymarket.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-all text-center text-sm"
              >
                Open Polymarket →
              </a>
              <a
                href={arb.kalshiTicker ? `https://kalshi.com/markets/${arb.kalshiTicker}` : 'https://kalshi.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all text-center text-sm"
              >
                Open Kalshi →
              </a>
            </div>
            <button
              onClick={handleExecute}
              disabled={!betAmount || parseFloat(betAmount) <= 0}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-lg transition-all disabled:opacity-30"
            >
              {amount > 0 ? `Track This Arb (+$${netProfit.toFixed(2)})` : 'Enter Amount to Track'}
            </button>
            <p className="text-[10px] text-gray-500 text-center">Place bets on both platforms, then track here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Modal
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  
  const categories = ['All', 'Crypto', 'Stocks', 'Economics', 'Politics', 'Sports', 'Entertainment'];
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#202124] border border-[#5f6368] rounded-xl w-[400px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#5f6368] flex items-center justify-between">
          <span className="text-sm font-medium text-white">Scanner Settings</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Minimum Sharpe Ratio</label>
            <input
              type="number"
              step="0.1"
              value={localSettings.minSharpe}
              onChange={(e) => setLocalSettings({ ...localSettings, minSharpe: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-[#303134] border border-[#5f6368] rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-600 mt-1">Higher = less risk, fewer opportunities</p>
          </div>
          
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Minimum Spread (%)</label>
            <input
              type="number"
              step="0.5"
              value={localSettings.minSpread}
              onChange={(e) => setLocalSettings({ ...localSettings, minSpread: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-[#303134] border border-[#5f6368] rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    if (cat === 'All') {
                      setLocalSettings({ ...localSettings, categories: ['All'] });
                    } else {
                      const current = localSettings.categories.filter(c => c !== 'All');
                      if (current.includes(cat)) {
                        setLocalSettings({ ...localSettings, categories: current.filter(c => c !== cat) });
                      } else {
                        setLocalSettings({ ...localSettings, categories: [...current, cat] });
                      }
                    }
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    localSettings.categories.includes(cat) || (cat === 'All' && localSettings.categories.includes('All'))
                      ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                      : 'bg-[#303134] text-gray-400 border border-[#5f6368] hover:border-gray-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <label className="text-xs text-gray-400">Auto-execute when found</label>
            <button
              onClick={() => setLocalSettings({ ...localSettings, autoExecute: !localSettings.autoExecute })}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.autoExecute ? 'bg-amber-500' : 'bg-[#3c4043]'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localSettings.autoExecute ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        
        <div className="px-4 py-3 border-t border-[#5f6368] flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-[#303134] text-gray-400 text-sm rounded-lg hover:bg-[#3c4043]">
            Cancel
          </button>
          <button 
            onClick={() => { onSave(localSettings); onClose(); }}
            className="flex-1 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400"
          >
            Save & Redeploy
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ArbitragePanel({ themeClasses, embedded = false }) {
  const [opportunities, setOpportunities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState('loading'); // 'live' | 'fallback' | 'loading'
  const [openBets, setOpenBets] = useState(MOCK_OPEN_BETS);
  const [betHistory, setBetHistory] = useState(MOCK_BET_HISTORY);
  const [selectedArb, setSelectedArb] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    minSharpe: 1.5,
    minSpread: 2.0,
    categories: ['All'],
    autoExecute: false,
  });
  const [isScanning, setIsScanning] = useState(true);
  // Section state for accordion views
  const [activeSection, setActiveSection] = useState('scanner'); // 'scanner' | 'openBets' | 'history' | null
  
  // Toggle section (accordion style - one open at a time)
  const toggleSection = (section) => {
    setActiveSection(prev => prev === section ? null : section);
  };
  
  // Fetch real arbitrage opportunities
  const fetchArbs = useCallback(async () => {
    try {
      setIsScanning(true);
      const arbs = await findArbitrageOpportunities();
      
      if (arbs && arbs.length > 0) {
        setOpportunities(arbs);
        setDataSource('live');
      } else {
        // Use fallback if no real arbs found
        setOpportunities(FALLBACK_ARBS);
        setDataSource('fallback');
      }
    } catch (error) {
      console.error('Failed to fetch arbs:', error);
      setOpportunities(FALLBACK_ARBS);
      setDataSource('fallback');
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsScanning(false), 1000);
    }
  }, []);

  // Initial fetch and refresh every 30 seconds
  useEffect(() => {
    fetchArbs();
    const interval = setInterval(fetchArbs, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchArbs]);
  
  // Scanning indicator animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        setIsScanning(prev => !prev);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);
  
  const handleExecuteBet = (bet) => {
    setOpenBets(prev => [...prev, { ...bet, id: `bet-${Date.now()}`, status: 'active', placedAt: Date.now() }]);
    setOpportunities(prev => prev.filter(o => o.id !== bet.id));
  };
  
  const formatTimeAgo = (timestamp) => {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  
  // Filter opportunities based on settings
  const filteredOpportunities = opportunities.filter(o => 
    o.sharpe >= settings.minSharpe && 
    o.spread >= settings.minSpread &&
    (settings.categories.includes('All') || settings.categories.includes(o.category))
  );
  
  return (
    <div className={`flex flex-col ${embedded ? '' : `border-t ${themeClasses.border}`} relative z-0`}>
      {/* Sub-sections with internal accordion - all 3 headers always visible */}
      <div 
        className={`h-8 flex-shrink-0 flex items-center justify-between px-3 cursor-pointer transition-colors ${activeSection === 'scanner' ? 'bg-amber-500/10' : 'hover:bg-[#252525]'}`}
        onClick={() => toggleSection('scanner')}
      >
        <div className="flex items-center gap-2">
          <svg 
            className={`w-4 h-4 text-gray-500 transition-transform ${activeSection === 'scanner' ? 'rotate-90' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`text-xs font-medium ${activeSection === 'scanner' ? 'text-amber-400' : 'text-gray-400'}`}>Opportunities</span>
          {isScanning && (
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {filteredOpportunities.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full">
              {filteredOpportunities.length}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
            className="p-0.5 hover:bg-amber-500/20 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-gray-500 hover:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Arbitrage Scanner Content */}
      {activeSection === 'scanner' && (
        <div className="max-h-64 overflow-y-auto bg-[#1a1a1a] scrollbar-hide">
          {/* Settings Summary */}
          <div className="px-3 py-1.5 border-b border-[#2a2a2a] text-[10px] text-gray-600 flex justify-between">
            <span>Sharpe ≥ {settings.minSharpe} • Spread ≥ {settings.minSpread}%</span>
            <span className={dataSource === 'live' ? 'text-emerald-500' : 'text-amber-500'}>
              {dataSource === 'live' ? '● LIVE' : dataSource === 'loading' ? '○ Loading...' : '○ Demo'}
            </span>
          </div>
          
          {filteredOpportunities.length === 0 ? (
            <div className="px-4 py-4 text-center">
              <div className="text-gray-500 text-xs">No arbitrage opportunities found</div>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {filteredOpportunities.map((arb) => (
                <div key={arb.id} className="px-3 py-2 hover:bg-amber-500/5 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-xs">{arb.name}</span>
                      <span className="text-[9px] text-gray-500 bg-[#2a2a2a] px-1 py-0.5 rounded">{arb.category}</span>
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">+{arb.spread}%</span>
                  </div>
                  
                  {/* Compact Leg Preview */}
                  <div className="flex items-center gap-1 mb-1.5">
                    <div className="flex-1 py-1 px-2 bg-[#202124] rounded text-[10px] flex justify-between">
                      <span className="text-gray-500">Poly</span>
                      <span className="text-emerald-400">{arb.polymarket.side} {arb.polymarket.price}¢</span>
                    </div>
                    <span className="text-gray-600 text-[10px]">+</span>
                    <div className="flex-1 py-1 px-2 bg-[#202124] rounded text-[10px] flex justify-between">
                      <span className="text-gray-500">Kalshi</span>
                      <span className="text-red-400">{arb.kalshi.side} {arb.kalshi.price}¢</span>
                    </div>
                    <button
                      onClick={() => setSelectedArb(arb)}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-400 text-[10px] font-medium rounded transition-all"
                    >
                      Execute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Open Bets Header */}
      <div 
        className={`h-10 flex-shrink-0 flex items-center justify-between px-3 border-t border-[#2a2a2a] cursor-pointer transition-colors ${activeSection === 'openBets' ? 'bg-emerald-500/10' : 'hover:bg-[#252525]'}`}
        onClick={() => toggleSection('openBets')}
      >
        <div className="flex items-center gap-2">
          <svg 
            className={`w-4 h-4 text-gray-500 transition-transform ${activeSection === 'openBets' ? 'rotate-90' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`text-xs font-medium ${activeSection === 'openBets' ? 'text-emerald-400' : 'text-gray-400'}`}>Open Bets</span>
        </div>
        {openBets.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded-full">
            {openBets.length}
          </span>
        )}
      </div>
      
      {/* Open Bets Content */}
      {activeSection === 'openBets' && (
        <div className="bg-[#1a1a1a] max-h-48 overflow-y-auto scrollbar-hide">
          {openBets.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">No open bets</div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {openBets.map((bet) => (
                <div 
                  key={bet.id} 
                  className="p-3 hover:bg-[#222] transition-colors cursor-pointer relative group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm">{bet.name}</span>
                    <span className="text-emerald-400 text-xs">+${bet.projectedProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Invested: ${bet.totalInvested}</span>
                    <span>{formatTimeAgo(bet.placedAt)}</span>
                  </div>
                  
                  {/* Hover Popup */}
                  <div className="absolute left-full top-0 ml-2 w-72 bg-[#202124] border border-amber-500/30 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                    <div className="px-3 py-2 border-b border-[#3c4043] bg-amber-500/10 rounded-t-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xs">🎯</span>
                        <span className="text-white text-xs font-medium">{bet.name}</span>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                          <div className="text-[9px] text-gray-500 mb-0.5">Polymarket</div>
                          <div className="text-emerald-400 text-xs font-medium">{bet.polymarket?.side} @ {bet.polymarket?.price}¢</div>
                          <div className="text-[10px] text-gray-400">${bet.polymarket?.amount?.toFixed(2)}</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                          <div className="text-[9px] text-gray-500 mb-0.5">Kalshi</div>
                          <div className="text-red-400 text-xs font-medium">{bet.kalshi?.side} @ {bet.kalshi?.price}¢</div>
                          <div className="text-[10px] text-gray-400">${bet.kalshi?.amount?.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-[#3c4043] space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500">Total Invested</span>
                          <span className="text-white">${bet.totalInvested?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-amber-400">Net Profit</span>
                          <span className="text-amber-400">+${bet.projectedProfit?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* History Header */}
      <div 
        className={`h-10 flex-shrink-0 flex items-center justify-between px-3 border-t border-[#2a2a2a] cursor-pointer transition-colors ${activeSection === 'history' ? 'bg-gray-500/10' : 'hover:bg-[#252525]'}`}
        onClick={() => toggleSection('history')}
      >
        <div className="flex items-center gap-2">
          <svg 
            className={`w-4 h-4 text-gray-500 transition-transform ${activeSection === 'history' ? 'rotate-90' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`text-xs font-medium ${activeSection === 'history' ? 'text-gray-300' : 'text-gray-500'}`}>History</span>
        </div>
        <span className="text-xs text-gray-600">{betHistory.length}</span>
      </div>
      
      {/* History Content */}
      {activeSection === 'history' && (
        <div className="bg-[#1a1a1a] max-h-48 overflow-y-auto scrollbar-hide">
          {betHistory.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">No bet history</div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {betHistory.map((bet) => (
                <div key={bet.id} className="p-3 hover:bg-[#222] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 text-sm">{bet.name}</span>
                    <span className={`text-xs ${bet.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bet.profit >= 0 ? '+' : ''}${bet.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Invested: ${bet.totalInvested}</span>
                    <span className={`${bet.status === 'won' ? 'text-emerald-500' : 'text-red-500'} uppercase text-[10px]`}>
                      {bet.status}
                    </span>
                    <span>{formatTimeAgo(bet.closedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Modals */}
      {selectedArb && (
        <ArbBetSlipModal arb={selectedArb} onClose={() => setSelectedArb(null)} onExecute={handleExecuteBet} />
      )}
      {showSettings && (
        <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
