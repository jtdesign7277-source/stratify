import { useState, useEffect, useRef } from 'react';

// ============================================
// KRAKEN-STYLE DASHBOARD
// Ultra-dark theme with cyan gradient charts
// ============================================

// TradingView Advanced Chart Widget
const TradingViewChart = ({ symbol = 'BTCUSD', height = 500 }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear previous widget
    containerRef.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol.includes(':') ? symbol : `NASDAQ:${symbol}`,
      "interval": "D",
      "timezone": "America/New_York",
      "theme": "dark",
      "style": "3", // Area chart style for that gradient fill look
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
    <div 
      ref={containerRef} 
      className="tradingview-widget-container w-full"
      style={{ height: `${height}px` }}
    />
  );
};

// Mini Sparkline Chart with Gradient
const SparklineChart = ({ data, color = '#00D9FF', width = 120, height = 40 }) => {
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const y = height - ((val - min) / (max - min)) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Atlas AI Chat Component (Kraken styled)
const AtlasAIChat = ({ themeClasses }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! I'm Atlas, your AI trading assistant. Ask me anything about strategies, market analysis, or building automated trades." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);
    
    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm analyzing your request. This is a demo response — in production, I'd connect to the AI backend for real strategy generation and market insights."
      }]);
    }, 1500);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1e1e2d] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">Atlas AI</h3>
          <p className="text-[#6b6b80] text-xs">Trading Assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs">Online</span>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'user' 
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white' 
                : 'bg-[#12121a] text-[#e0e0e6] border border-[#1e1e2d]'
            }`}>
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#12121a] text-[#e0e0e6] border border-[#1e1e2d] rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-[#1e1e2d]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Atlas anything..."
            className="flex-1 bg-[#0a0a10] border border-[#1e1e2d] rounded-xl px-4 py-3 text-white text-sm placeholder-[#4a4a5a] focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
          <button
            onClick={handleSend}
            className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl transition-all"
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

// Price Ticker Component
const PriceTicker = ({ symbol, price, change, changePercent, sparkData }) => {
  const isPositive = change >= 0;
  
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#0a0a10] rounded-xl border border-[#1e1e2d] hover:border-[#2a2a3d] transition-colors cursor-pointer">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">{symbol}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-white text-lg font-mono">${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
      {sparkData && (
        <SparklineChart 
          data={sparkData} 
          color={isPositive ? '#00D9FF' : '#ff4d6a'} 
          width={80} 
          height={32} 
        />
      )}
    </div>
  );
};

// Main Kraken Dashboard Component
export default function KrakenDashboard({ setCurrentPage, alpacaData }) {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
  const [marketData, setMarketData] = useState({
    BTC: { price: 97432.18, change: 1823.45, changePercent: 1.91, sparkData: [94000, 95200, 94800, 96100, 95800, 97000, 97432] },
    ETH: { price: 3421.67, change: 89.23, changePercent: 2.68, sparkData: [3280, 3310, 3350, 3320, 3380, 3400, 3421] },
    SOL: { price: 198.45, change: -4.32, changePercent: -2.13, sparkData: [208, 205, 202, 199, 201, 197, 198] },
  });
  
  // Simulate live price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(prev => ({
        BTC: {
          ...prev.BTC,
          price: prev.BTC.price + (Math.random() - 0.48) * 50,
          sparkData: [...prev.BTC.sparkData.slice(1), prev.BTC.price]
        },
        ETH: {
          ...prev.ETH,
          price: prev.ETH.price + (Math.random() - 0.48) * 5,
          sparkData: [...prev.ETH.sparkData.slice(1), prev.ETH.price]
        },
        SOL: {
          ...prev.SOL,
          price: prev.SOL.price + (Math.random() - 0.5) * 1,
          sparkData: [...prev.SOL.sparkData.slice(1), prev.SOL.price]
        },
      }));
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Kraken color palette
  const colors = {
    bg: '#06060c',           // Ultra-dark base
    surface: '#0a0a10',      // Slightly elevated surface
    surfaceHover: '#0f0f18', // Hover state
    border: '#1e1e2d',       // Subtle borders
    borderHover: '#2a2a3d',  // Hover borders
    text: '#e0e0e6',         // Primary text (good white shade)
    textMuted: '#6b6b80',    // Muted text
    cyan: '#00D9FF',         // Primary accent (Kraken cyan)
    purple: '#7B61FF',       // Secondary accent
    green: '#00E676',        // Positive
    red: '#ff4d6a',          // Negative
  };
  
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ backgroundColor: colors.bg }}>
      
      {/* Top Navigation Bar */}
      <header className="h-14 flex items-center justify-between px-6 border-b" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Stratify</span>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">PRO</span>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {['Dashboard', 'Strategies', 'Backtest', 'Portfolio', 'Markets'].map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                i === 0 
                  ? 'text-white bg-[#1e1e2d]' 
                  : 'text-[#6b6b80] hover:text-white hover:bg-[#12121a]'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
        
        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button className="p-2 text-[#6b6b80] hover:text-white hover:bg-[#1e1e2d] rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <button className="p-2 text-[#6b6b80] hover:text-white hover:bg-[#1e1e2d] rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center cursor-pointer">
            <span className="text-white text-sm font-medium">J</span>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Panel - Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Symbol Header & Stats */}
          <div className="px-6 py-4 border-b" style={{ borderColor: colors.border }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Symbol Selector */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center">
                    <span className="text-white font-bold">₿</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-semibold text-white">Bitcoin</h1>
                      <span className="text-[#6b6b80] text-lg">BTC/USD</span>
                    </div>
                  </div>
                </div>
                
                {/* Price */}
                <div className="flex items-baseline gap-3 ml-6">
                  <span className="text-3xl font-mono font-semibold text-white">
                    ${marketData.BTC.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-lg font-medium ${marketData.BTC.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {marketData.BTC.change >= 0 ? '+' : ''}{marketData.BTC.change.toFixed(2)} ({marketData.BTC.change >= 0 ? '+' : ''}{marketData.BTC.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-[#6b6b80] mb-1">24h High</p>
                  <p className="text-sm font-mono text-white">$98,234.00</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b80] mb-1">24h Low</p>
                  <p className="text-sm font-mono text-white">$95,123.45</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b80] mb-1">24h Volume</p>
                  <p className="text-sm font-mono text-white">$2.4B</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b80] mb-1">Market Cap</p>
                  <p className="text-sm font-mono text-white">$1.92T</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Chart Area - THE HERO */}
          <div className="flex-1 relative" style={{ backgroundColor: colors.bg }}>
            {/* TradingView Chart */}
            <TradingViewChart symbol="BITSTAMP:BTCUSD" height={600} />
            
            {/* Gradient Overlay for that Kraken look */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
              style={{
                background: 'linear-gradient(to top, rgba(0, 217, 255, 0.1) 0%, transparent 100%)'
              }}
            />
          </div>
          
          {/* Bottom Ticker Bar */}
          <div className="px-6 py-4 border-t" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">Quick Watch</span>
              <div className="flex-1 flex gap-3 overflow-x-auto">
                {Object.entries(marketData).map(([symbol, data]) => (
                  <div 
                    key={symbol}
                    onClick={() => setSelectedSymbol(`${symbol}USD`)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                      selectedSymbol === `${symbol}USD`
                        ? 'bg-[#1e1e2d] border-cyan-500/50'
                        : 'bg-[#0a0a10] border-[#1e1e2d] hover:border-[#2a2a3d]'
                    }`}
                  >
                    <span className="text-white font-medium">{symbol}</span>
                    <span className="text-white font-mono text-sm">${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`text-xs font-medium ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.change >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                    </span>
                    <SparklineChart 
                      data={data.sparkData} 
                      color={data.change >= 0 ? '#00D9FF' : '#ff4d6a'} 
                      width={50} 
                      height={20} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Atlas AI Chat */}
        <div 
          className="w-[360px] flex-shrink-0 border-l flex flex-col"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <AtlasAIChat />
        </div>
      </div>
      
      {/* Status Bar */}
      <footer className="h-8 flex items-center justify-between px-6 border-t text-xs" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#6b6b80]">Connected</span>
          </div>
          <span className="text-[#6b6b80]">•</span>
          <span className="text-[#6b6b80]">Alpaca Paper</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#6b6b80]">Latency: 12ms</span>
          <span className="text-[#6b6b80]">•</span>
          <span className="text-[#6b6b80]">© 2026 Stratify</span>
        </div>
      </footer>
    </div>
  );
}
