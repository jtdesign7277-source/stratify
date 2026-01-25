import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

// Animated grid background component
const GridBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
      }}
    />
  </div>
);

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

// Landing Page Component
const LandingPage = ({ onEnter }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative">
      <GridBackground />

      {/* Top Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">Stratify</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
          <button className="px-4 py-2 hover:bg-white/5 rounded-lg transition-colors">Log In</button>
          <button
            onClick={onEnter}
            className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all"
          >
            Get Started Free
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-20">
        <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-12">
            <h1 className="text-7xl font-bold mb-6 leading-tight">
              A <span className="italic font-light">smarter way</span>
              <br />
              to trade
            </h1>
            <p className="text-2xl text-gray-400 mb-8 max-w-3xl mx-auto">
              Unify strategies across technical analysis, sentiment, and fundamentals.
              Let AI surface the signals that matter.
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <button
                onClick={onEnter}
                className="px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-all shadow-2xl shadow-white/20"
              >
                Try Stratify Free
              </button>
              <button className="px-8 py-4 border border-white/20 rounded-lg hover:bg-white/5 transition-colors">
                Watch Demo
              </button>
            </div>

            {/* Social Proof Stats */}
            <div className="flex items-center justify-center gap-12 mb-16">
              <div>
                <div className="text-3xl font-bold text-white">
                  $<AnimatedCounter end={2847} />M
                </div>
                <div className="text-sm text-gray-400">Assets Under Management</div>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <div className="text-3xl font-bold text-white">
                  <AnimatedCounter end={150000} suffix="+" />
                </div>
                <div className="text-sm text-gray-400">Active Traders</div>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <div className="text-3xl font-bold text-white">
                  <AnimatedCounter end={98} suffix="%" />
                </div>
                <div className="text-sm text-gray-400">Uptime</div>
              </div>
            </div>

            {/* Trusted By Section */}
            <div className="mb-16">
              <p className="text-sm text-gray-500 mb-6">INTEGRATED WITH</p>
              <div className="flex items-center justify-center gap-12 flex-wrap">
                {/* Polymarket */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">P</span>
                  </div>
                  <span className="text-xl font-bold tracking-tight text-gray-300">Polymarket</span>
                </div>

                {/* Webull */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                    </svg>
                  </div>
                  <span className="text-xl font-bold text-gray-300">Webull</span>
                </div>

                {/* TradingView */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <span className="text-xl font-semibold text-gray-300">TradingView</span>
                </div>

                {/* Kalshi */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">K</span>
                  </div>
                  <span className="text-xl font-bold tracking-wide text-gray-300">Kalshi</span>
                </div>

                {/* Alpaca */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                  <span className="text-xl font-bold text-gray-300 tracking-wider">ALPACA</span>
                </div>
              </div>
            </div>
          </div>

          {/* Automate Your Trades Section */}
          <div className="mb-32 py-24">
            <div className="text-center">
              <h2 className="text-7xl font-bold mb-6 leading-tight">
                Automate Your Trades.<br />
                <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                  Maximize Your Edge.
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                The all-in-one platform for prediction market trading. Build strategies,<br />
                track performance, and execute trades automatically across Kalshi,<br />
                Polymarket, and more.
              </p>
            </div>
          </div>

          {/* Feature Preview Cards */}
          <div className="grid grid-cols-3 gap-6 mb-20" id="features">
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-bold mb-3">AI Strategy Builder</h3>
              <p className="text-gray-400 mb-4">Create sophisticated trading strategies with natural language. No coding required.</p>
              <div className="text-sm text-blue-400">Learn more →</div>
            </div>

            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Execution</h3>
              <p className="text-gray-400 mb-4">Sub-millisecond order routing with direct market access and smart order routing.</p>
              <div className="text-sm text-emerald-400">Learn more →</div>
            </div>

            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Advanced Analytics</h3>
              <p className="text-gray-400 mb-4">Deep insights with Sharpe ratio, max drawdown, and custom performance metrics.</p>
              <div className="text-sm text-purple-400">Learn more →</div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="mb-20" id="pricing">
            <h2 className="text-4xl font-bold text-center mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-center mb-12">Choose the plan that fits your trading style</p>

            <div className="grid grid-cols-3 gap-6">
              {/* Free Tier */}
              <div className="bg-gradient-to-br from-gray-900/50 to-gray-900/30 border border-white/10 rounded-2xl p-8">
                <div className="text-lg font-semibold mb-2">Free</div>
                <div className="text-4xl font-bold mb-4">$0<span className="text-lg text-gray-400">/mo</span></div>
                <div className="text-gray-400 mb-6">Perfect for getting started</div>
                <button className="w-full py-3 border border-white/20 rounded-lg hover:bg-white/5 transition-colors mb-6">
                  Start Free
                </button>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Paper trading</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>3 active strategies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Basic analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-600">✓</span>
                    <span className="text-gray-600">Real-time data</span>
                  </li>
                </ul>
              </div>

              {/* Pro Tier */}
              <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-2 border-blue-500/50 rounded-2xl p-8 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 rounded-full text-xs font-semibold">
                  MOST POPULAR
                </div>
                <div className="text-lg font-semibold mb-2">Pro</div>
                <div className="text-4xl font-bold mb-4">$49<span className="text-lg text-gray-400">/mo</span></div>
                <div className="text-gray-400 mb-6">For serious traders</div>
                <button
                  onClick={onEnter}
                  className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors mb-6"
                >
                  Start Pro Trial
                </button>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Everything in Free</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Unlimited strategies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Real-time execution</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Advanced analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Priority support</span>
                  </li>
                </ul>
              </div>

              {/* Enterprise Tier */}
              <div className="bg-gradient-to-br from-gray-900/50 to-gray-900/30 border border-white/10 rounded-2xl p-8">
                <div className="text-lg font-semibold mb-2">Enterprise</div>
                <div className="text-4xl font-bold mb-4">Custom</div>
                <div className="text-gray-400 mb-6">For institutions & teams</div>
                <button className="w-full py-3 border border-white/20 rounded-lg hover:bg-white/5 transition-colors mb-6">
                  Contact Sales
                </button>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Everything in Pro</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Dedicated infrastructure</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>Custom integrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>SLA & compliance</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>White-glove onboarding</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="text-center py-12 border-t border-white/10">
            <p className="text-sm text-gray-500 mb-6">TRUSTED & SECURE</p>
            <div className="flex items-center justify-center gap-12">
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Bank-level encryption</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">SEC registered</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">99.9% uptime SLA</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="h-full bg-[#0a0a0f] flex flex-col">
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
      <div className="border-t border-white/10 px-6 py-4 bg-[#0a0a0f]">
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
    <div className="flex flex-col h-full bg-[#0a0a0f]">
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
      <div className="border-t border-[#2a2a2a] p-4 bg-[#0a0a0f]">
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
const Dashboard = ({ setCurrentPage }) => {
  const [expandedFolders, setExpandedFolders] = useState({ momentum: true });
  const [strategiesHeight, setStrategiesHeight] = useState(250);
  const [strategiesCollapsed, setStrategiesCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bottomTab, setBottomTab] = useState('strategies'); // 'strategies' or 'terminal'
  const [activeNav, setActiveNav] = useState('search'); // active navigation item
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
      count: 2,
      strategies: []
    },
    momentum: {
      name: 'Momentum Strategies',
      count: 3,
      strategies: [
        { id: 1, name: 'RSI Breakout', risk: 'Medium Risk', active: true },
        { id: 2, name: 'MACD Crossover', risk: 'Low Risk', active: false },
        { id: 3, name: 'Volume Spike', risk: 'High Risk', active: false },
      ]
    },
    meanReversion: {
      name: 'Mean Reversion',
      count: 2,
      strategies: []
    },
    scalping: {
      name: 'Scalping',
      count: 2,
      strategies: []
    }
  };

  const activeStrategies = [
    { name: 'RSI Breakout', profit: 691.49, duration: '176m running', active: true },
    { name: 'Bollinger Bounce', profit: 480.51, duration: '180m running', active: true },
    { name: 'VWAP Scalper', profit: 773.76, duration: '174m running', active: true },
  ];

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
    if (newHeight >= 40 && newHeight <= containerHeight - 200) {
      setStrategiesHeight(newHeight);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      <GridBackground />

      {/* Edge Navigation Sidebar */}
      <div className="relative z-10 w-64 border-r border-white/5 bg-[#1a1a1f] flex flex-col py-6">
        <div className="flex-1 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-1 ${
                activeNav === item.id
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span className="text-base font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Left Sidebar - Strategy Tree */}
      <div className="relative z-10 w-72 border-r border-white/10 bg-[#0a0a0f] flex flex-col">
        <div className="p-4 border-b border-white/10">
          <button
            onClick={() => setCurrentPage('landing')}
            className="mb-4 text-xl font-bold hover:text-gray-300 transition-colors"
          >
            Stratify
          </button>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">My Strategies</div>
            <div className="text-sm text-gray-400">3/5 running</div>
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
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Code Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="bg-[#0a0a0f] border-b border-white/10 px-4 py-3 flex items-center">
            <span className="text-sm font-medium text-gray-400">tesla-ema-strategy.ts</span>
          </div>

          {/* Editor Content */}
          <div className="flex-1 bg-[#0a0a0f] relative overflow-hidden">
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

            <div className="border-t border-white/10 bg-[#0a0a0f]" style={{ height: `${strategiesHeight}px` }}>
              {/* Tabs */}
              <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 bg-[#1e1e1e]">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBottomTab('strategies')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      bottomTab === 'strategies'
                        ? 'bg-[#0a0a0f] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Active Strategies (3)
                  </button>
                  <button
                    onClick={() => setBottomTab('terminal')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      bottomTab === 'terminal'
                        ? 'bg-[#0a0a0f] text-white'
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
          <div className="border-t border-white/10 bg-[#1e1e1e] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStrategiesCollapsed(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Expand panel"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <span className="text-xs text-gray-400">Active Strategies (3) • Terminal</span>
            </div>
            <div className="flex items-center gap-2">
              {activeStrategies.map((strategy, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#0a0a0f] rounded text-xs">
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
      <div className="relative z-10 w-[380px] border-l border-white/10 bg-[#0a0a0f]">
        <ClaudeCodeChat />
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
