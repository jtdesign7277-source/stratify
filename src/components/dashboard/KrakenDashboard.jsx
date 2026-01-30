import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// KRAKEN-STYLE DASHBOARD V2
// Exact Kraken layout with left sidebar + collapsible chart
// ============================================

// TradingView Advanced Chart Widget
const TradingViewChart = ({ symbol = 'BTCUSD', height = 400 }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol.includes(':') ? symbol : `BITSTAMP:${symbol}`,
      "interval": "D",
      "timezone": "America/New_York",
      "theme": "dark",
      "style": "3",
      "locale": "en",
      "backgroundColor": "rgba(6, 6, 12, 1)",
      "gridColor": "rgba(30, 30, 45, 0.3)",
      "hide_top_toolbar": false,
      "hide_legend": false,
      "allow_symbol_change": true,
      "save_image": false,
      "calendar": false,
      "hide_volume": true,
      "support_host": "https://www.tradingview.com"
    });
    
    containerRef.current.appendChild(script);
  }, [symbol]);
  
  return (
    <div ref={containerRef} className="tradingview-widget-container w-full h-full" />
  );
};

// Portfolio Growth Chart (Custom SVG with gradient)
const PortfolioGrowthChart = ({ data, height = 200 }) => {
  const width = 800;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Generate smooth portfolio growth data
  const portfolioData = data || Array.from({ length: 30 }, (_, i) => {
    const base = 10000;
    const growth = base * (1 + (i * 0.015) + Math.sin(i * 0.3) * 0.02);
    return { day: i + 1, value: growth };
  });
  
  const minVal = Math.min(...portfolioData.map(d => d.value)) * 0.98;
  const maxVal = Math.max(...portfolioData.map(d => d.value)) * 1.02;
  
  const points = portfolioData.map((d, i) => {
    const x = padding.left + (i / (portfolioData.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.value - minVal) / (maxVal - minVal)) * chartHeight;
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${padding.left + chartWidth},${padding.top + chartHeight}`;
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7B61FF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#5B8DEF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#5B8DEF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7B61FF" />
          <stop offset="100%" stopColor="#5B8DEF" />
        </linearGradient>
      </defs>
      
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <line
          key={i}
          x1={padding.left}
          y1={padding.top + chartHeight * pct}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight * pct}
          stroke="#1e1e2d"
          strokeWidth="1"
        />
      ))}
      
      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#portfolioGradient)" />
      
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Y-axis labels */}
      {[0, 0.5, 1].map((pct, i) => {
        const val = minVal + (maxVal - minVal) * (1 - pct);
        return (
          <text
            key={i}
            x={padding.left - 8}
            y={padding.top + chartHeight * pct + 4}
            fill="#6b6b80"
            fontSize="11"
            textAnchor="end"
            fontFamily="monospace"
          >
            ${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </text>
        );
      })}
    </svg>
  );
};

// Mini Sparkline
const Sparkline = ({ data, color = '#7B61FF', width = 60, height = 24 }) => {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// Left Sidebar Icons (Kraken style)
const SidebarIcon = ({ icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`relative w-full flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all ${
      active 
        ? 'bg-[#1e1e2d] text-white' 
        : 'text-[#6b6b80] hover:text-white hover:bg-[#12121a]'
    }`}
  >
    <div className="w-6 h-6 flex items-center justify-center">
      {icon}
    </div>
    <span className="text-[10px] font-medium">{label}</span>
    {badge && (
      <span className="absolute top-1 right-1 w-4 h-4 bg-purple-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
);

// Index Card Component (like Main, Futures, Earn)
const IndexCard = ({ title, value, change, icon, color = 'purple', onClick, active }) => {
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-500/50',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-500/50',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-500/50',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-500/50',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-500/50',
  };
  
  const iconColors = {
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
  };
  
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[140px] p-4 rounded-xl border bg-gradient-to-br transition-all ${colorClasses[color]} ${
        active ? 'ring-2 ring-purple-500/50' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-5 h-5 ${iconColors[color]}`}>{icon}</div>
        <span className="text-sm font-medium text-white">{title}</span>
      </div>
      {value && (
        <div className="text-xl font-bold text-white font-mono">{value}</div>
      )}
      {change !== undefined && (
        <div className={`text-xs font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change}%
        </div>
      )}
    </button>
  );
};

// Atlas AI Chat Component
const AtlasAIChat = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! I'm Atlas, your AI trading assistant. Ask me anything about strategies, market analysis, or building automated trades." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input.trim() }]);
    setInput('');
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm analyzing your request. In production, I connect to the AI backend for real strategy generation and market insights."
      }]);
    }, 1500);
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#1e1e2d] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-medium text-sm">Atlas AI</h3>
          <p className="text-[#6b6b80] text-xs">Trading Assistant</p>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs">Online</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'user' 
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                : 'bg-[#12121a] text-[#e0e0e6] border border-[#1e1e2d]'
            }`}>
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#12121a] border border-[#1e1e2d] rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-[#1e1e2d]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Atlas anything..."
            className="flex-1 bg-[#0a0a10] border border-[#1e1e2d] rounded-xl px-4 py-3 text-white text-sm placeholder-[#4a4a5a] focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          <button
            onClick={handleSend}
            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Strategy Builder Panel
const StrategyBuilderPanel = ({ themeClasses }) => {
  const [strategies, setStrategies] = useState([
    { id: 1, name: 'RSI Reversal', symbol: 'TSLA', status: 'draft', winRate: '67.3%' },
    { id: 2, name: 'MACD Crossover', symbol: 'NVDA', status: 'backtesting', winRate: '62.1%' },
    { id: 3, name: 'Bollinger Squeeze', symbol: 'AAPL', status: 'ready', winRate: '71.8%' },
  ]);
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#1e1e2d] flex items-center justify-between">
        <h3 className="text-white font-semibold">Strategy Builder</h3>
        <button className="px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-500/30 transition-colors">
          + New Strategy
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {strategies.map(s => (
          <div key={s.id} className="p-4 bg-[#0a0a10] rounded-xl border border-[#1e1e2d] hover:border-purple-500/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">{s.name}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                s.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                s.status === 'backtesting' ? 'bg-amber-500/20 text-amber-400' :
                'bg-emerald-500/20 text-emerald-400'
              }`}>{s.status}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[#6b6b80]">{s.symbol}</span>
              <span className="text-emerald-400">{s.winRate} win rate</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Arbitrage Panel
const ArbitragePanel = () => {
  const [arbs, setArbs] = useState([
    { id: 1, event: 'Super Bowl LVIII Winner', platform1: 'Polymarket', platform2: 'Kalshi', profit: '2.3%', expires: '2h 15m' },
    { id: 2, event: 'Fed Rate Decision March', platform1: 'Kalshi', platform2: 'PredictIt', profit: '1.8%', expires: '4h 30m' },
    { id: 3, event: 'BTC > $100K by Feb', platform1: 'Polymarket', platform2: 'Kalshi', profit: '3.1%', expires: '12h' },
  ]);
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#1e1e2d] flex items-center justify-between">
        <h3 className="text-white font-semibold">Arbitrage Scanner</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs">Live Scanning</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {arbs.map(arb => (
          <div key={arb.id} className="p-4 bg-[#0a0a10] rounded-xl border border-[#1e1e2d] hover:border-emerald-500/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium text-sm">{arb.event}</span>
              <span className="text-emerald-400 font-bold">+{arb.profit}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6b6b80]">{arb.platform1} ↔ {arb.platform2}</span>
              <span className="text-amber-400">Expires: {arb.expires}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Open Bets Panel
const OpenBetsPanel = () => {
  const [bets, setBets] = useState([
    { id: 1, event: 'TSLA > $300 by EOD', amount: 500, potential: 875, status: 'winning', change: '+12.4%' },
    { id: 2, event: 'Fed holds rates March', amount: 1000, potential: 1450, status: 'neutral', change: '+2.1%' },
    { id: 3, event: 'BTC hits $110K Feb', amount: 250, potential: 625, status: 'losing', change: '-8.3%' },
  ]);
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#1e1e2d] flex items-center justify-between">
        <h3 className="text-white font-semibold">Open Positions</h3>
        <span className="text-[#6b6b80] text-sm">{bets.length} active</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {bets.map(bet => (
          <div key={bet.id} className="p-4 bg-[#0a0a10] rounded-xl border border-[#1e1e2d]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium text-sm">{bet.event}</span>
              <span className={`font-medium ${
                bet.status === 'winning' ? 'text-emerald-400' :
                bet.status === 'losing' ? 'text-red-400' : 'text-[#6b6b80]'
              }`}>{bet.change}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6b6b80]">Risked: ${bet.amount}</span>
              <span className="text-purple-400">To win: ${bet.potential}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// History Panel
const HistoryPanel = () => {
  const [history, setHistory] = useState([
    { id: 1, event: 'Chiefs win Super Bowl', result: 'won', profit: '+$450', date: 'Jan 28' },
    { id: 2, event: 'AAPL > $200 Jan', result: 'lost', profit: '-$200', date: 'Jan 25' },
    { id: 3, event: 'ETH > $3500 Jan', result: 'won', profit: '+$320', date: 'Jan 22' },
    { id: 4, event: 'Fed cuts 25bp Jan', result: 'won', profit: '+$180', date: 'Jan 20' },
  ]);
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#1e1e2d] flex items-center justify-between">
        <h3 className="text-white font-semibold">Trade History</h3>
        <button className="text-purple-400 text-xs hover:underline">Export</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {history.map(h => (
          <div key={h.id} className="p-3 bg-[#0a0a10] rounded-xl border border-[#1e1e2d] flex items-center justify-between">
            <div>
              <span className="text-white text-sm">{h.event}</span>
              <p className="text-[#6b6b80] text-xs">{h.date}</p>
            </div>
            <span className={`font-mono font-medium ${h.result === 'won' ? 'text-emerald-400' : 'text-red-400'}`}>
              {h.profit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Kraken Dashboard Component
export default function KrakenDashboard({ setCurrentPage, alpacaData }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [chartCollapsed, setChartCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('growth');
  const [contentTab, setContentTab] = useState('strategies');
  
  // Portfolio stats
  const [portfolioStats, setPortfolioStats] = useState({
    totalValue: 127432.18,
    dayChange: 1823.45,
    dayChangePercent: 1.45,
    totalReturn: 27432.18,
    totalReturnPercent: 27.43,
  });
  
  // Market data
  const [marketData, setMarketData] = useState({
    BTC: { price: 97432.18, change: 1.91, sparkData: [94000, 95200, 94800, 96100, 95800, 97000, 97432] },
    ETH: { price: 3421.67, change: 2.68, sparkData: [3280, 3310, 3350, 3320, 3380, 3400, 3421] },
    SOL: { price: 198.45, change: -2.13, sparkData: [208, 205, 202, 199, 201, 197, 198] },
  });
  
  // Sidebar items
  const sidebarItems = [
    { id: 'dashboard', label: 'Home', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { id: 'strategies', label: 'Strategies', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
      </svg>
    ), badge: 3 },
    { id: 'arbitrage', label: 'Arb Scan', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    )},
    { id: 'portfolio', label: 'Portfolio', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    )},
    { id: 'markets', label: 'Markets', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M18 9l-5 5-4-4-3 3" />
      </svg>
    )},
    { id: 'history', label: 'History', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )},
    { id: 'settings', label: 'Settings', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    )},
  ];
  
  // Render content based on contentTab
  const renderContent = () => {
    switch (contentTab) {
      case 'strategies':
        return <StrategyBuilderPanel />;
      case 'arbitrage':
        return <ArbitragePanel />;
      case 'positions':
        return <OpenBetsPanel />;
      case 'history':
        return <HistoryPanel />;
      default:
        return <StrategyBuilderPanel />;
    }
  };
  
  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ backgroundColor: '#06060c' }}>
      
      {/* Left Sidebar - Kraken Style */}
      <div className="w-20 flex-shrink-0 flex flex-col border-r border-[#1e1e2d] bg-[#0a0a10]">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-[#1e1e2d]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
        </div>
        
        {/* Nav Icons */}
        <div className="flex-1 py-4 px-2 space-y-1">
          {sidebarItems.map(item => (
            <SidebarIcon
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
              badge={item.badge}
            />
          ))}
        </div>
        
        {/* User Avatar */}
        <div className="p-4 border-t border-[#1e1e2d]">
          <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-purple-500/50 transition-all">
            <span className="text-white font-medium">J</span>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header with Index Cards */}
        <header className="flex-shrink-0 border-b border-[#1e1e2d] bg-[#0a0a10]">
          {/* Top Bar */}
          <div className="h-14 px-6 flex items-center justify-between border-b border-[#1e1e2d]">
            <div className="flex items-center gap-4">
              <h1 className="text-white font-semibold text-lg">Dashboard</h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">PRO</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-[#6b6b80] hover:text-white hover:bg-[#1e1e2d] rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">Connected</span>
              </div>
            </div>
          </div>
          
          {/* Index Cards Row */}
          <div className="px-6 py-4 flex gap-4 overflow-x-auto">
            <IndexCard
              title="Portfolio"
              value={`$${portfolioStats.totalValue.toLocaleString()}`}
              change={portfolioStats.dayChangePercent}
              color="purple"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
            />
            <IndexCard
              title="Strategies"
              value="3 Live"
              color="blue"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z"/></svg>}
            />
            <IndexCard
              title="Arb Opps"
              value="7 Found"
              color="cyan"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>}
            />
            <IndexCard
              title="Open Bets"
              value="$1,750"
              change={4.2}
              color="emerald"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <IndexCard
              title="Today's P&L"
              value="+$823"
              change={6.8}
              color="amber"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
            />
          </div>
        </header>
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Center Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Chart Section (Collapsible) */}
            <div className={`flex-shrink-0 border-b border-[#1e1e2d] transition-all duration-300 ${chartCollapsed ? 'h-12' : 'h-[320px]'}`}>
              {/* Chart Header */}
              <div 
                className="h-12 px-6 flex items-center justify-between bg-[#0a0a10] cursor-pointer hover:bg-[#12121a] transition-colors"
                onClick={() => setChartCollapsed(!chartCollapsed)}
              >
                <div className="flex items-center gap-4">
                  <svg className={`w-4 h-4 text-[#6b6b80] transition-transform ${chartCollapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-white font-medium">Portfolio Growth</span>
                  <div className="flex gap-2">
                    {['1D', '1W', '1M', '3M', 'YTD', 'ALL'].map(period => (
                      <button
                        key={period}
                        onClick={(e) => e.stopPropagation()}
                        className={`px-2 py-1 text-xs rounded ${
                          period === '1M' ? 'bg-purple-500/20 text-purple-400' : 'text-[#6b6b80] hover:text-white'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-mono text-lg">${portfolioStats.totalValue.toLocaleString()}</span>
                  <span className={`text-sm font-medium ${portfolioStats.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {portfolioStats.dayChangePercent >= 0 ? '+' : ''}{portfolioStats.dayChangePercent}% today
                  </span>
                </div>
              </div>
              
              {/* Chart Content */}
              {!chartCollapsed && (
                <div className="h-[calc(100%-48px)] px-6 py-4">
                  <PortfolioGrowthChart height={240} />
                </div>
              )}
            </div>
            
            {/* Content Tabs */}
            <div className="h-12 px-6 flex items-center gap-1 border-b border-[#1e1e2d] bg-[#0a0a10]">
              {[
                { id: 'strategies', label: 'Strategies', badge: 3 },
                { id: 'arbitrage', label: 'Arb Scanner' },
                { id: 'positions', label: 'Open Positions', badge: 3 },
                { id: 'history', label: 'History' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setContentTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                    contentTab === tab.id
                      ? 'bg-[#1e1e2d] text-white'
                      : 'text-[#6b6b80] hover:text-white hover:bg-[#12121a]'
                  }`}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/30 text-purple-400 rounded-full">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Content Panel */}
            <div className="flex-1 overflow-hidden bg-[#06060c]">
              {renderContent()}
            </div>
          </div>
          
          {/* Right Panel - Atlas AI */}
          <div className="w-[340px] flex-shrink-0 border-l border-[#1e1e2d] bg-[#0a0a10]">
            <AtlasAIChat />
          </div>
        </div>
        
        {/* Bottom Status Bar */}
        <footer className="h-8 px-6 flex items-center justify-between border-t border-[#1e1e2d] bg-[#0a0a10]">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[#6b6b80]">Alpaca Paper</span>
            </div>
            <span className="text-[#3a3a4a]">•</span>
            <span className="text-[#6b6b80]">Latency: 8ms</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#6b6b80]">
            <span>v2.0.0</span>
            <span>© 2026 Stratify</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
