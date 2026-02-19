import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Dashboard } from './components/dashboard';
import LandingPage from './components/dashboard/LandingPage';
import WhitePaperPage from './components/WhitePaperPage';
import SpaceBackground from './components/SpaceBackground';
import SignUpPage from './components/auth/SignUpPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useMarketData } from './store/StratifyProvider';
import { useAlpacaData } from './hooks/useAlpacaData';
import useSubscription from './hooks/useSubscription';
// XPill removed - was blocking Grok panel clicks
import LiveScoresPill from './components/shared/LiveScoresPill';
import BlueSkyFeed from "./components/dashboard/BlueSkyFeed";

// Cinematic Video Intro Component - "The Drop"
const VideoIntro = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out 0.5s before video ends
    const fadeTimer = setTimeout(() => setFadeOut(true), 5500);
    // Complete transition after video
    const completeTimer = setTimeout(() => onComplete(), 6200);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center transition-opacity duration-700 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <video
        autoPlay
        playsInline
        className="w-full h-full object-cover"
        onEnded={onComplete}
      >
        <source src="/intro.mp4" type="video/mp4" />
      </video>
      {/* STRATIFY text overlay - appears at end */}
      <div 
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-100' : 'opacity-0'}`}
      >
        <h1 className="text-6xl md:text-8xl font-bold tracking-widest text-white">
          STRATIFY
        </h1>
      </div>
      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 text-white/50 hover:text-white text-sm transition-colors"
      >
        Skip →
      </button>
    </div>
  );
};

// Animated grid background component with Dovetail-style design
const GridBackground = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }

        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }

        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.1); }
          66% { transform: translate(20px, -30px) scale(0.9); }
        }

        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); opacity: 0.4; }
          50% { transform: translate(15px, -25px); opacity: 0.6; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.25; }
        }

        .animated-grid {
          animation: gridMove 30s linear infinite;
        }

        .floating-orb-1 { animation: float1 20s ease-in-out infinite; }
        .floating-orb-2 { animation: float2 25s ease-in-out infinite; }
        .floating-orb-3 { animation: float3 15s ease-in-out infinite; }
        .pulse-glow { animation: pulse 4s ease-in-out infinite; }
      `}</style>

      {/* Main Grid - larger cells, more visible */}
      <div
        className="absolute inset-0 animated-grid"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          transform: `translateY(${scrollY * 0.2}px)`,
        }}
      />

      {/* Secondary larger grid for depth */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '240px 240px',
          transform: `translateY(${scrollY * 0.1}px)`,
        }}
      />

      {/* Floating Orb 1 - Top right, purple */}
      <div
        className="absolute floating-orb-1"
        style={{
          top: '10%',
          right: '15%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.05) 40%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}
      />

      {/* Floating Orb 2 - Bottom left, blue */}
      <div
        className="absolute floating-orb-2"
        style={{
          bottom: '20%',
          left: '10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 40%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
        }}
      />

      {/* Floating Orb 3 - Center, cyan accent */}
      <div
        className="absolute floating-orb-3"
        style={{
          top: '40%',
          left: '50%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.12) 0%, transparent 60%)',
          borderRadius: '50%',
          filter: 'blur(50px)',
          transform: 'translateX(-50%)',
        }}
      />

      {/* Subtle top glow */}
      <div
        className="absolute pulse-glow"
        style={{
          top: '-200px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Gradient fade at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-64"
        style={{
          background: 'linear-gradient(to top, rgba(10, 10, 15, 0.9) 0%, transparent 100%)',
        }}
      />
    </div>
  );
};

// Animated counter component
const AnimatedCounter = ({ end, duration = 2000, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);

      setCount(Math.floor(end * percentage));

      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
};


// Terminal Component - Active Strategies Dashboard
const Terminal = () => {
  const strategies = [
    { name: 'RSI Breakout', profit: 1766.50, duration: '362m running', active: true },
    { name: 'Bollinger Bounce', profit: 1979.26, duration: '366m running', active: true },
    { name: 'VWAP Scalper', profit: 2973.58, duration: '360m running', active: true },
  ];

  const totalPL = strategies.reduce((sum, s) => sum + s.profit, 0);

  return (
    <div className="h-full bg-[#0b0b0b] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
          <span className="text-sm font-bold tracking-wide">STRATEGIES</span>
        </div>
        <span className="text-sm text-gray-400 font-medium">3 Active</span>
      </div>

      {/* Strategy List */}
      <div className="flex-1 px-6 py-4">
        <div className="space-y-3">
          {strategies.map((strategy, i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-white/5 group">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-base font-medium min-w-[180px]">{strategy.name}</span>
                <span className="text-emerald-400 font-mono text-base font-semibold">
                  +{strategy.profit.toFixed(2)} USD
                </span>
                <span className="text-gray-500 text-sm ml-2">{strategy.duration}</span>
              </div>
              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 hover:bg-white/10 rounded transition-colors" title="View Analytics">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-red-500/10 rounded transition-colors" title="Stop Strategy">
                  <svg className="w-5 h-5 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer - Total P&L */}
      <div className="border-t border-white/10 px-6 py-4 bg-[#0b0b0b]">
        <div className="flex items-center justify-between">
          <span className="text-base text-gray-400">Total P&L:</span>
          <span className="text-emerald-400 font-mono text-xl font-bold">
            +{totalPL.toFixed(2)} USD
          </span>
        </div>
      </div>
    </div>
  );
};

// Claude Code Chat Component
const ClaudeCodeChat = () => {
  const [messages, setMessages] = useState([
    {
      type: 'user',
      content: 'Buy TSLA when 8 EMA crosses above 21 EMA on weekly timeframe. Set 1% stop loss, 3% take profit. Repeat weekly.'
    },
    {
      type: 'claude',
      content: "I've created a TSLA 8/21 EMA Weekly strategy based on your requirements:",
      details: [
        'Entry: 8 EMA crosses above 21 EMA',
        'Timeframe: Weekly candles',
        'Stop Loss: 1%',
        'Take Profit: 3%'
      ],
      footer: 'The strategy is now ready for customization. See the preview panel for backtest results.'
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages([...messages, { type: 'user', content: inputValue }]);
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0b0b]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#f97316" opacity="0.2"/>
            <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="#f97316"/>
          </svg>
          <span className="text-base font-medium text-gray-300">Claude Code</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-white/5 rounded transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-white/5 rounded transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Past Conversations */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-gray-300">Past Conversations</span>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <button className="p-1 hover:bg-white/10 rounded transition-colors">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx}>
            {msg.type === 'user' ? (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">You</div>
                <div className="text-gray-200 text-sm leading-relaxed">{msg.content}</div>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] border-2 border-[#f97316] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="#f97316"/>
                  </svg>
                  <span className="text-[#f97316] text-sm font-semibold">Claude</span>
                </div>
                <div className="text-gray-200 text-sm leading-relaxed mb-3">{msg.content}</div>
                {msg.details && (
                  <div className="space-y-2 mb-3 pl-3 border-l-2 border-[#f97316]/30">
                    {msg.details.map((detail, i) => (
                      <div key={i} className="text-gray-400 text-sm flex items-start gap-2">
                        <span className="text-[#f97316]">▸</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.footer && (
                  <div className="text-gray-500 text-xs border-t border-[#2a2a2a] pt-3 mt-3">
                    {msg.footer}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-[#2a2a2a] p-4 bg-[#0b0b0b]">
        <div className="mb-3">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs font-mono">⌘</kbd>
            <span>Esc to focus or unfocus Claude</span>
          </div>
        </div>
        <div className="relative mb-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Claude to modify the strategy..."
            className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-[#2a2a2a] focus:border-[#f97316] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-colors pr-20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button className="p-2 hover:bg-white/5 rounded transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button
              onClick={handleSend}
              className="p-2 bg-[#f97316] hover:bg-[#ea580c] rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Ask before edits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span>tesla-ema-strategy.ts</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component - Strategy Builder UI
const OldDashboard = ({ setCurrentPage }) => {
  const [expandedFolders, setExpandedFolders] = useState({ momentum: true });
  const [strategiesHeight, setStrategiesHeight] = useState(250);
  const [strategiesCollapsed, setStrategiesCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bottomTab, setBottomTab] = useState('strategies'); // 'strategies' or 'terminal'
  const [activeNav, setActiveNav] = useState('search'); // active navigation item
  const [navExpanded, setNavExpanded] = useState(false); // navigation sidebar hover state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // left sidebar collapse state
  const [sidebarWidth, setSidebarWidth] = useState(288); // left sidebar width (default 72 * 4 = 288px)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false); // sidebar resize state
  const [code, setCode] = useState(`import { Strategy, Indicator } from '@stratify/core';

/**
 * TSLA 8/21 EMA Weekly Crossover Strategy
 * Entry: 8 EMA crosses above 21 EMA on weekly timeframe
 * Stop Loss: 1% | Take Profit: 3%
 */
export class TeslaEMAStrategy extends Strategy {
  private ema8: Indicator;
  private ema21: Indicator;

  constructor() {
    super({
      symbol: 'TSLA',
      timeframe: '1w',
      stopLoss: 0.01,
      takeProfit: 0.03
    });

    this.ema8 = this.addIndicator('EMA', { period: 8 });
    this.ema21 = this.addIndicator('EMA', { period: 21 });
  }

  async onBar(bar: Bar): Promise<void> {
    const ema8Value = this.ema8.getValue();
    const ema21Value = this.ema21.getValue();

    // Entry signal: 8 EMA crosses above 21 EMA
    if (this.crossedAbove(ema8Value, ema21Value)) {
      await this.buy({
        quantity: this.calculatePositionSize(),
        stopLoss: bar.close * (1 - this.config.stopLoss),
        takeProfit: bar.close * (1 + this.config.takeProfit)
      });
    }

    // Exit signal: 8 EMA crosses below 21 EMA
    if (this.crossedBelow(ema8Value, ema21Value)) {
      await this.closePosition();
    }
  }

  private crossedAbove(fast: number, slow: number): boolean {
    const prevFast = this.ema8.getValue(-1);
    const prevSlow = this.ema21.getValue(-1);
    return prevFast <= prevSlow && fast > slow;
  }

  private crossedBelow(fast: number, slow: number): boolean {
    const prevFast = this.ema8.getValue(-1);
    const prevSlow = this.ema21.getValue(-1);
    return prevFast >= prevSlow && fast < slow;
  }

  private calculatePositionSize(): number {
    const accountBalance = this.getAccountBalance();
    const riskAmount = accountBalance * 0.02; // Risk 2% per trade
    return riskAmount / (this.config.stopLoss * this.getLastPrice());
  }
}
`);

  const strategyFolders = {
    favorites: {
      name: 'Favorites',
      count: 0,
      strategies: []
    },
    momentum: {
      name: 'Momentum Strategies',
      count: 0,
      strategies: []
    },
    meanReversion: {
      name: 'Mean Reversion',
      count: 0,
      strategies: []
    },
    scalping: {
      name: 'Scalping',
      count: 0,
      strategies: []
    }
  };

  const activeStrategies = [];

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const containerHeight = window.innerHeight - 60;
    const newHeight = containerHeight - e.clientY;
    if (newHeight >= 150 && newHeight <= containerHeight - 200) {
      setStrategiesHeight(newHeight);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Sidebar resize handlers
  const handleSidebarMouseDown = (e) => {
    setIsResizingSidebar(true);
    e.preventDefault();
  };

  const handleSidebarMouseMove = (e) => {
    if (!isResizingSidebar) return;
    const newWidth = e.clientX - 64; // Subtract nav sidebar width (64px)
    if (newWidth >= 200 && newWidth <= 500) {
      setSidebarWidth(newWidth);
    }
  };

  const handleSidebarMouseUp = () => {
    setIsResizingSidebar(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleSidebarMouseMove);
      document.addEventListener('mouseup', handleSidebarMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleSidebarMouseMove);
        document.removeEventListener('mouseup', handleSidebarMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizingSidebar, sidebarWidth]);

  const navItems = [
    { id: 'home', label: 'Home', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 1.5l-7 6V14a1 1 0 001 1h4V9h4v6h4a1 1 0 001-1V7.5l-7-6z"/>
      </svg>
    )},
    { id: 'chat', label: 'Chat', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1zm-3 7H5V8h6v1zm0-2H5V6h6v1z"/>
      </svg>
    )},
    { id: 'search', label: 'Search', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
      </svg>
    )},
    { id: 'dashboards', label: 'Dashboards', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M14 1H2a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V2a1 1 0 00-1-1zM6 13H3V3h3v10zm4 0H7V8h3v5zm4 0h-3V5h3v8z"/>
      </svg>
    )},
    { id: 'channels', label: 'Channels', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M14.5 2h-13A.5.5 0 001 2.5v11a.5.5 0 00.5.5h13a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5zM5 12H3V4h2v8zm4 0H7V6h2v6zm4 0h-2V3h2v9z"/>
      </svg>
    )},
    { id: 'projects', label: 'Projects', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M14.5 1.5h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM7 12H3V8h4v4zm0-5H3V3h4v4zm6 5H8V8h5v4zm0-5H8V3h5v4z"/>
      </svg>
    )},
    { id: 'agents', label: 'Agents', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M9.504.43a1.516 1.516 0 00-1.423-.23l-5.5 2.02a1.517 1.517 0 00-.896 1.933l2.146 5.508a1.517 1.517 0 001.922.904l5.51-2.022a1.517 1.517 0 00.904-1.932l-2.15-5.509a1.517 1.517 0 00-.513-.672zm.647 8.832l-4.148 1.522L4.4 6.504l4.147-1.522 1.604 4.28zM7.05 11.958l4.158-1.528a1 1 0 00.58-1.28l-.004-.011-2.15-5.51a1 1 0 00-1.32-.537l-.01.004-4.157 1.528a1 1 0 00-.58 1.281l.004.01 2.15 5.51a1 1 0 001.329.533z"/>
      </svg>
    )},
    { id: 'docs', label: 'Docs', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M13.5 1h-10l-.5.5v13l.5.5h10l.5-.5v-13l-.5-.5zM11 13H5v-1h6v1zm0-2H5v-1h6v1zm0-2H5V8h6v1zm0-2H5V6h6v1zm0-2H5V4h6v1z"/>
      </svg>
    )},
    { id: 'new', label: 'New', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 3.5a.5.5 0 01.5.5v3.5H12a.5.5 0 010 1H8.5V12a.5.5 0 01-1 0V8.5H4a.5.5 0 010-1h3.5V4a.5.5 0 01.5-.5z"/>
      </svg>
    )}
  ];

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex">
      <GridBackground />

      {/* Edge Navigation Sidebar */}
      <div
        className={`relative z-10 border-r border-white/5 bg-[#1a1a1f] flex flex-col py-6 transition-all duration-200 ${
          navExpanded ? 'w-64' : 'w-16'
        }`}
        onMouseEnter={() => setNavExpanded(true)}
        onMouseLeave={() => setNavExpanded(false)}
      >
        <div className="flex-1 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all mb-1 ${
                activeNav === item.id
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              } ${!navExpanded ? 'justify-center' : ''}`}
              title={!navExpanded ? item.label : ''}
            >
              {item.icon}
              <span className={`text-base font-medium whitespace-nowrap transition-all duration-200 ${
                navExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Left Sidebar - Strategy Tree */}
      {!sidebarCollapsed ? (
        <div className="relative z-10 border-r border-white/5 bg-[#1a1a1f] flex flex-col" style={{ width: `${sidebarWidth}px` }}>
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentPage('landing')}
                className="text-xl font-bold hover:text-gray-300 transition-colors"
              >
                Stratify
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title="Collapse sidebar"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">My Strategies</div>
              <div className="text-sm text-gray-400">{activeStrategies.length}/5 running</div>
            </div>
          </div>

        <div className="flex-1 overflow-y-auto p-3">
          {Object.entries(strategyFolders).map(([key, folder]) => (
            <div key={key} className="mb-2">
              <button
                onClick={() => toggleFolder(key)}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedFolders[key] ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="flex-1 text-left text-sm">{folder.name}</span>
                <span className="text-xs text-gray-500">{folder.count}</span>
              </button>

              {expandedFolders[key] && folder.strategies.length > 0 && (
                <div className="ml-6 mt-1 space-y-1">
                  {folder.strategies.map(strategy => (
                    <button
                      key={strategy.id}
                      onClick={() => setSelectedStrategy(strategy)}
                      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {strategy.name}
                          {strategy.active && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                        </div>
                        <div className="text-xs text-gray-500">{strategy.risk}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500/50 transition-colors group"
          style={{ zIndex: 50 }}
        >
          <div className="absolute top-0 right-0 w-1 h-full group-hover:w-1 bg-transparent group-hover:bg-blue-500/30" />
        </div>
      </div>
      ) : (
        /* Collapsed Sidebar */
        <div className="relative z-10 w-12 border-r border-white/5 bg-[#1a1a1f] flex flex-col items-center py-4">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="p-2 hover:bg-white/10 rounded transition-colors mb-4"
            title="Expand sidebar"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Code Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="bg-[#0b0b0b] border-b border-white/10 px-4 py-3 flex items-center">
            <span className="text-sm font-medium text-gray-400">tesla-ema-strategy.ts</span>
          </div>

          {/* Editor Content */}
          <div className="flex-1 bg-[#0b0b0b] relative overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                fontSize: 14,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                suggest: {
                  showKeywords: true,
                  showSnippets: true,
                },
                quickSuggestions: {
                  other: true,
                  comments: false,
                  strings: false,
                },
              }}
            />
          </div>
        </div>

        {/* Bottom Panel - Strategies & Terminal (Resizable & Collapsible) */}
        {!strategiesCollapsed ? (
          <>
            {/* Draggable Divider */}
            <div
              onMouseDown={handleMouseDown}
              className={`h-1 bg-white/5 hover:bg-blue-500/30 transition-colors ${isDragging ? 'bg-blue-500/50' : ''} cursor-ns-resize`}
            />

            <div className="border-t border-white/10 bg-[#0b0b0b]" style={{ height: `${strategiesHeight}px` }}>
              {/* Tabs */}
              <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 bg-[#0b0b0b]">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBottomTab('strategies')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      bottomTab === 'strategies'
                        ? 'bg-[#0b0b0b] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Active Strategies ({activeStrategies.length})
                  </button>
                  <button
                    onClick={() => setBottomTab('terminal')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      bottomTab === 'terminal'
                        ? 'bg-[#0b0b0b] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Terminal
                  </button>
                </div>
                <button
                  onClick={() => setStrategiesCollapsed(true)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Collapse panel"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              {bottomTab === 'strategies' ? (
                <div className="p-6 overflow-y-auto" style={{ height: 'calc(100% - 36px)' }}>
                  <div className="space-y-2">
                    {activeStrategies.map((strategy, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 bg-[#151518] border border-white/10 rounded-lg hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                          <div>
                            <div className="text-sm font-semibold text-white">{strategy.name}</div>
                            <div className="text-xs text-gray-500">{strategy.duration}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-emerald-400">+${strategy.profit.toFixed(2)} USD</span>
                          <button className="p-1.5 hover:bg-white/10 rounded transition-colors opacity-0 group-hover:opacity-100">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
                          <button className="p-1.5 hover:bg-red-500/10 rounded transition-colors text-red-400 opacity-0 group-hover:opacity-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ height: 'calc(100% - 36px)' }}>
                  <Terminal />
                </div>
              )}
            </div>
          </>
        ) : (
          /* Collapsed Footer Bar */
          <div className="border-t border-white/10 bg-[#0b0b0b] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setStrategiesCollapsed(false);
                  // Reset height to a reasonable size if it's too small
                  if (strategiesHeight < 150) {
                    setStrategiesHeight(250);
                  }
                }}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Expand panel"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <span className="text-xs text-gray-400">Active Strategies ({activeStrategies.length}) • Terminal</span>
            </div>
            <div className="flex items-center gap-2">
              {activeStrategies.map((strategy, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#0b0b0b] rounded text-xs">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <span className="text-gray-400">{strategy.name}</span>
                  <span className="text-emerald-400 font-mono">+${strategy.profit.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Claude Code Chat */}
      <div className="relative z-10 w-[380px] border-l border-white/10 bg-[#0b0b0b]">
        <ClaudeCodeChat />
      </div>
    </div>
  );
};

const PRO_CHECKOUT_PRICE_ID =
  import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1T0jBTRdPxQfs9UeRln3Uj68';

function StratifyAppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const { isProUser, loading: subscriptionLoading } = useSubscription();

  const resolveInitialPage = () => {
    if (typeof window === 'undefined') return 'landing';

    const path = window.location.pathname.toLowerCase();
    if (path === '/whitepaper') return 'whitepaper';
    if (path === '/auth') return 'auth';

    return 'landing';
  };

  const [currentPage, setCurrentPage] = useState(resolveInitialPage);
  const [isSocialFeedOpen, setIsSocialFeedOpen] = useState(false);
  const [hasSocialFeedUnread, setHasSocialFeedUnread] = useState(false);
  const [isLiveScoresOpen, setIsLiveScoresOpen] = useState(false);
  const [hasLiveScoresUnread, setHasLiveScoresUnread] = useState(false);
  const [isCheckoutRedirecting, setIsCheckoutRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const checkoutAttemptedRef = useRef(false);

  const marketData = useMarketData();
  const alpaca = useAlpacaData();

  // Use real Alpaca data when broker is connected
  const hasAlpacaData = alpaca.account && !alpaca.error && alpaca.brokerConnected;

  const derivedPositions = hasAlpacaData ? alpaca.positions : [];

  const account = hasAlpacaData
    ? {
        equity: Number(alpaca.account.equity) || 0,
        cash: Number(alpaca.account.cash) || 0,
        buying_power: Number(alpaca.account.buying_power) || 0,
        daily_pnl: Number(alpaca.account.equity) - Number(alpaca.account.last_equity) || 0,
        unrealized_pl: Number(alpaca.account.equity) - Number(alpaca.account.last_equity) || 0,
        realized_pl: 0,
        last_equity: Number(alpaca.account.last_equity) || 0,
        portfolio_value: Number(alpaca.account.portfolio_value) || 0,
      }
    : {
        equity: 0,
        cash: 0,
        buying_power: 0,
        daily_pnl: 0,
        unrealized_pl: 0,
        realized_pl: 0,
      };

  const navigateToPage = (page) => {
    setCurrentPage(page);

    if (typeof window === 'undefined') return;

    const nextPath = page === 'whitepaper' ? '/whitepaper' : page === 'auth' ? '/auth' : '/';

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ page }, '', nextPath);
    }
  };

  const openAuth = () => {
    navigateToPage('auth');
  };

  const startCheckout = useCallback(async () => {
    if (!user?.id || !user?.email) {
      setCheckoutError('Please sign in again to continue with Stripe checkout.');
      return;
    }

    if (!PRO_CHECKOUT_PRICE_ID) {
      setCheckoutError('Missing Stripe price configuration.');
      return;
    }

    setCheckoutError('');
    setIsCheckoutRedirecting(true);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: PRO_CHECKOUT_PRICE_ID,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to start checkout.');
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      throw new Error('Stripe checkout URL missing.');
    } catch (error) {
      setCheckoutError(error?.message || 'Unable to redirect to Stripe checkout.');
      setIsCheckoutRedirecting(false);
    }
  }, [user?.email, user?.id]);

  const mainContent =
    currentPage === 'whitepaper' ? (
      <WhitePaperPage
        onBackHome={() => navigateToPage(isAuthenticated ? 'dashboard' : 'landing')}
        onGetStarted={() => navigateToPage('auth')}
      />
    ) : !isAuthenticated ? (
      currentPage === 'auth' ? (
        <SignUpPage
          onSuccess={() => navigateToPage('dashboard')}
          onBackToLanding={() => navigateToPage('landing')}
        />
      ) : (
        <LandingPage
          onEnter={() => navigateToPage('auth')}
          onSignUp={() => navigateToPage('auth')}
          isAuthenticated={isAuthenticated}
        />
      )
    ) : !isProUser ? (
      <div className="min-h-screen bg-transparent text-white flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0a1220] p-8 text-center shadow-[0_0_40px_rgba(0,0,0,0.4)]">
          <h1 className="text-2xl font-semibold">Complete Your Stratify Subscription</h1>
          <p className="mt-3 text-sm text-white/70">
            Access to War Room, Terminal, Trade, Portfolio, and all dashboard tools requires an active
            subscription at $9.99/month.
          </p>
          <button
            type="button"
            onClick={() => {
              checkoutAttemptedRef.current = true;
              startCheckout();
            }}
            disabled={isCheckoutRedirecting}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCheckoutRedirecting ? 'Redirecting to Stripe...' : 'Continue to Stripe Checkout ($9.99/mo)'}
          </button>
          {checkoutError ? (
            <p className="mt-3 text-xs text-red-300">{checkoutError}</p>
          ) : null}
        </div>
      </div>
    ) : (
      <Dashboard
        setCurrentPage={navigateToPage}
        isSocialFeedOpen={isSocialFeedOpen}
        onToggleSocialFeed={() => setIsSocialFeedOpen((prev) => !prev)}
        socialFeedUnread={hasSocialFeedUnread}
        isLiveScoresOpen={isLiveScoresOpen}
        onToggleLiveScores={() => setIsLiveScoresOpen((prev) => !prev)}
        liveScoresUnread={hasLiveScoresUnread}
        alpacaData={{
          positions: derivedPositions,
          account,
        }}
      />
    );

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();

      if (path === '/whitepaper') {
        setCurrentPage('whitepaper');
        return;
      }

      if (path === '/auth') {
        setCurrentPage(isAuthenticated ? 'dashboard' : 'auth');
        return;
      }

      setCurrentPage(isAuthenticated ? 'dashboard' : 'landing');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      checkoutAttemptedRef.current = false;
      if (currentPage === 'dashboard') {
        openAuth();
      }
      return;
    }

    if (currentPage === 'landing' || currentPage === 'auth') {
      navigateToPage('dashboard');
    }
  }, [currentPage, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || currentPage === 'whitepaper') {
      checkoutAttemptedRef.current = false;
      return;
    }

    if (subscriptionLoading || isProUser) {
      if (isProUser) {
        setCheckoutError('');
        setIsCheckoutRedirecting(false);
      }
      checkoutAttemptedRef.current = false;
      return;
    }

    if (checkoutAttemptedRef.current) {
      return;
    }

    checkoutAttemptedRef.current = true;
    startCheckout();
  }, [currentPage, isAuthenticated, isProUser, startCheckout, subscriptionLoading]);

  const isInternalAppPage =
    isAuthenticated && currentPage !== 'whitepaper' && currentPage !== 'landing' && currentPage !== 'auth';
  const backgroundVariant = isInternalAppPage ? 'app' : 'marketing';

  if (loading || (isAuthenticated && subscriptionLoading)) {
    return (
      <div className="relative min-h-screen">
        <SpaceBackground variant={backgroundVariant} />
        <div className="relative z-10 min-h-screen bg-transparent text-white flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-[#1e1e2d] bg-[#0b0b12]/90 px-6 py-4 text-sm text-gray-300">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400/80 border-t-transparent" />
            Checking your session...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <SpaceBackground variant={backgroundVariant} />
      <div className="relative z-10 min-h-screen">
        {mainContent}
        <LiveScoresPill
          isOpen={isLiveScoresOpen}
          onOpenChange={setIsLiveScoresOpen}
          onUnreadChange={setHasLiveScoresUnread}
        />
        <BlueSkyFeed
          isOpen={isSocialFeedOpen}
          onClose={() => setIsSocialFeedOpen(false)}
        />
      </div>
    </div>
  );
}

export default function StratifyApp() {
  return (
    <AuthProvider>
      <StratifyAppContent />
    </AuthProvider>
  );
}
