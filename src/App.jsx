import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

// Animated grid background component with subtle light effect
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
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }

        @keyframes gradientShift {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes lightPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.08;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.12;
          }
        }

        .animated-grid {
          animation: gridMove 20s linear infinite;
        }

        .gradient-shift {
          animation: gradientShift 8s ease-in-out infinite;
        }

        .light-pulse {
          animation: lightPulse 6s ease-in-out infinite;
        }
      `}</style>

      {/* Animated Grid lines */}
      <div
        className="absolute inset-0 animated-grid"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: `translateY(${scrollY * 0.3}px)`,
        }}
      />

      {/* Secondary grid layer for depth */}
      <div
        className="absolute inset-0 gradient-shift"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          transform: `translateY(${scrollY * 0.15}px)`,
        }}
      />

      {/* Animated radial light effects */}
      <div className="absolute inset-0 light-pulse" style={{
        background: `radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)`,
        transformOrigin: '50% 20%',
      }} />

      <div className="absolute inset-0" style={{
        background: `radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)`,
        animation: 'lightPulse 8s ease-in-out infinite 2s',
        transformOrigin: '80% 80%',
      }} />

      {/* Moving gradient overlay */}
      <div
        className="absolute inset-0 gradient-shift"
        style={{
          background: `
            linear-gradient(180deg,
              transparent 0%,
              rgba(59, 130, 246, 0.02) 50%,
              transparent 100%
            )
          `,
          transform: `translateY(${scrollY * 0.5}px)`,
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
            <p className="text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
              Unify strategies across technical analysis, sentiment, and fundamentals.
              Let AI surface the signals that matter.
            </p>

            {/* Waitlist Section */}
            <div className="max-w-2xl mx-auto mb-8">
              {/* Email Input and Join Waitlist Button */}
              <div className="flex items-center gap-4 mb-6">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-6 py-4 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <button
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  Join Waitlist
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>

              {/* Waitlist Count */}
              <div className="text-center mb-8">
                <p className="text-gray-400 text-base flex items-center justify-center gap-2">
                  <span className="text-xl">✨</span>
                  <span>Join 501+ traders already on the waitlist</span>
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 mb-8" />

              {/* Continue as Guest */}
              <div className="text-center">
                <button
                  onClick={onEnter}
                  className="w-full py-4 bg-transparent border border-white/20 rounded-xl text-white font-semibold hover:bg-white/5 transition-all flex items-center justify-center gap-2 mb-3"
                >
                  Continue as Guest
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <p className="text-gray-500 text-sm">Explore the full app without signing up</p>
              </div>
            </div>

            {/* Social Proof Stats */}
            <div className="flex items-center justify-center gap-12 mb-16">
              <div>
                <div className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                  $<AnimatedCounter end={2847} />M
                </div>
                <div className="text-sm text-gray-400">Assets Under Management</div>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
                  <AnimatedCounter end={150000} suffix="+" />
                </div>
                <div className="text-sm text-gray-400">Active Traders</div>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <div className="text-5xl font-bold bg-gradient-to-r from-pink-400 to-rose-500 bg-clip-text text-transparent">
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
                <span className="text-xl font-bold tracking-tight text-gray-300 opacity-60 hover:opacity-100 transition-opacity">Polymarket</span>

                {/* Webull */}
                <span className="text-xl font-bold text-gray-300 opacity-60 hover:opacity-100 transition-opacity">Webull</span>

                {/* TradingView */}
                <span className="text-xl font-semibold text-gray-300 opacity-60 hover:opacity-100 transition-opacity">TradingView</span>

                {/* Kalshi */}
                <span className="text-xl font-bold tracking-wide text-gray-300 opacity-60 hover:opacity-100 transition-opacity">Kalshi</span>

                {/* Alpaca */}
                <span className="text-xl font-bold text-gray-300 tracking-wider opacity-60 hover:opacity-100 transition-opacity">ALPACA</span>
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
            {/* AI Strategy Builder Card */}
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-8 flex flex-col h-[500px] hover:border-white/20 transition-all">
              {/* Visual Element */}
              <div className="flex-1 flex items-center justify-center mb-6">
                <div className="relative w-full h-64">
                  {/* Comparison Table */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between py-3 px-4 bg-[#0f3d3d]/30 rounded-lg border border-cyan-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-cyan-500/20 rounded flex items-center justify-center">
                          <span className="text-cyan-400 font-bold text-xs">S</span>
                        </div>
                        <span className="font-medium">Stratify</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-cyan-400 font-medium">AI-Powered</span>
                        <span className="text-white font-medium">$0.00</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-3 px-4 rounded-lg">
                      <span className="text-gray-500">TradingView</span>
                      <span className="text-gray-500">$14.95</span>
                    </div>
                    <div className="flex items-center justify-between py-3 px-4 rounded-lg">
                      <span className="text-gray-500">MetaTrader</span>
                      <span className="text-gray-500">$19.99</span>
                    </div>
                    <div className="flex items-center justify-between py-3 px-4 rounded-lg">
                      <span className="text-gray-500">NinjaTrader</span>
                      <span className="text-gray-500">$60+</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclosure */}
              <button className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-4 hover:text-gray-400 transition-colors">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" fill="none" strokeWidth="1"/>
                  <path d="M8 4v4M8 10h.01"/>
                </svg>
                Disclosure
              </button>

              {/* Content */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-3">AI strategy builder. Zero fees.</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Stratify is the only platform with AI-powered strategy building and no monthly fees. Build sophisticated algorithms with natural language.
                </p>
              </div>

              {/* CTA */}
              <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1">
                Learn more →
              </button>
            </div>

            {/* Real-time Execution Card */}
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-8 flex flex-col h-[500px] hover:border-white/20 transition-all">
              {/* Visual Element */}
              <div className="flex-1 flex items-center justify-center mb-6">
                <div className="relative w-full h-64 flex flex-col items-center justify-center">
                  {/* Speed Metrics */}
                  <div className="text-center mb-8">
                    <div className="text-sm text-gray-400 mb-2">Execution latency</div>
                    <div className="text-6xl font-bold text-emerald-400 mb-1">0.8<span className="text-3xl">ms</span></div>
                  </div>

                  {/* Comparison bars */}
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24">Stratify</span>
                      <div className="flex-1 h-2 bg-emerald-500/20 rounded-full overflow-hidden">
                        <div className="h-full w-[8%] bg-emerald-500 rounded-full"></div>
                      </div>
                      <span className="text-xs text-emerald-400 w-12">0.8ms</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24">Industry Avg</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full w-[45%] bg-gray-500 rounded-full"></div>
                      </div>
                      <span className="text-xs text-gray-500 w-12">4.5ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclosure */}
              <button className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-4 hover:text-gray-400 transition-colors">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" fill="none" strokeWidth="1"/>
                  <path d="M8 4v4M8 10h.01"/>
                </svg>
                Disclosure
              </button>

              {/* Content */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-3">Sub-millisecond execution. Maximum edge.</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Our infrastructure delivers the fastest order execution with direct market access, ensuring you never miss an opportunity.
                </p>
              </div>

              {/* CTA */}
              <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1">
                Learn more →
              </button>
            </div>

            {/* Advanced Analytics Card */}
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-8 flex flex-col h-[500px] hover:border-white/20 transition-all">
              {/* Visual Element */}
              <div className="flex-1 flex items-center justify-center mb-6">
                <div className="relative w-full h-64">
                  {/* Code-style data display */}
                  <div className="font-mono text-sm bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-lg p-6 border border-cyan-500/10">
                    <div className="text-gray-500 mb-4">--data &#123;</div>
                    <div className="pl-6 space-y-2">
                      <div>
                        <span className="text-cyan-400">'sharpe-ratio'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-emerald-400"> 2.84</span>
                      </div>
                      <div>
                        <span className="text-cyan-400">'max-drawdown'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-yellow-400"> -8.2%</span>
                      </div>
                      <div>
                        <span className="text-cyan-400">'win-rate'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-emerald-400"> 67.3%</span>
                      </div>
                      <div>
                        <span className="text-cyan-400">'profit-factor'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-purple-400"> 1.92</span>
                      </div>
                      <div>
                        <span className="text-cyan-400">'total-trades'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-blue-400"> 1,247</span>
                      </div>
                      <div>
                        <span className="text-cyan-400">'avg-hold-time'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-pink-400"> '4.2h'</span>
                      </div>
                    </div>
                    <div className="text-gray-500 mt-4">&#125;</div>
                  </div>
                </div>
              </div>

              {/* Disclosure */}
              <button className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-4 hover:text-gray-400 transition-colors">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" fill="none" strokeWidth="1"/>
                  <path d="M8 4v4M8 10h.01"/>
                </svg>
                Disclosure
              </button>

              {/* Content */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-3">Access our API for algorithmic trading</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Deep performance analytics with institutional-grade metrics. Track Sharpe ratio, drawdown, and custom KPIs in real-time.
                </p>
              </div>

              {/* CTA */}
              <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1">
                Learn more →
              </button>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="mb-20" id="pricing">
            <h2 className="text-5xl font-bold text-center mb-4 leading-tight">
              Transparent pricing with<br />
              features tailored to your business
            </h2>

            <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto mt-16">
              {/* Free Tier */}
              <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-10">
                <div className="text-base text-gray-400 mb-2">Free</div>
                <div className="text-5xl font-bold mb-1">
                  $0<span className="text-lg text-gray-400">/month</span>
                </div>
                <div className="text-gray-400 text-sm mb-8 leading-relaxed">
                  Full-featured banking essentials with<br />
                  no strings attached.
                </div>
                <button className="w-full py-3 border border-white/30 rounded-full hover:bg-white/5 transition-colors mb-8">
                  Start for Free
                </button>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Hundreds of millions in FDIC insurance</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Same-day ACH transfers — $1</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Domestic wire transfers — $6</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Outgoing Fednow/RTP — $5</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Unlimited virtual cards</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">International wire transfers — $25</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Foreign transaction fee (card) — 1% (min $0.4)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">USDC on/off ramp — volume based</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">USDT on/off ramp — volume based</span>
                  </li>
                </ul>
              </div>

              {/* Pro Tier */}
              <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-10">
                <div className="text-base text-gray-400 mb-2">Pro</div>
                <div className="text-5xl font-bold mb-1">
                  $25<span className="text-lg text-gray-400">/month</span>
                </div>
                <div className="text-gray-400 text-sm mb-8 leading-relaxed">
                  Scale your business with advanced<br />
                  industry-specific capabilities.
                </div>
                <button
                  onClick={onEnter}
                  className="w-full py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition-colors mb-8"
                >
                  Get Started
                </button>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Hundreds of millions in FDIC insurance</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Same-day ACH transfers — $0</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Domestic wire transfers — $0</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Outgoing Fednow/RTP — $0</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Unlimited virtual cards</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">International wire transfers — $25</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Foreign transaction fee (card) — 1% (min $0.4)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">USDC on/off ramp — volume based</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">USDT on/off ramp — volume based</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Crypto Strategy Section */}
          <div className="mb-20 py-24 border-t border-white/10">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 gap-16 items-center">
                {/* Left Content */}
                <div>
                  <div className="inline-block px-4 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-full mb-6">
                    <span className="text-sm font-semibold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                      CRYPTO TRADING
                    </span>
                  </div>
                  <h2 className="text-5xl font-bold mb-6 leading-tight">
                    Master Crypto Markets with
                    <br />
                    <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      AI-Powered Strategies
                    </span>
                  </h2>
                  <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                    Deploy sophisticated trading algorithms across Bitcoin, Ethereum, and altcoins.
                    Automate your crypto portfolio with real-time execution, risk management,
                    and advanced technical indicators.
                  </p>

                  {/* Feature List */}
                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Lightning-Fast Execution</h3>
                        <p className="text-gray-400 text-sm">Execute trades in milliseconds across multiple exchanges with direct API integration</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Multi-Chain Support</h3>
                        <p className="text-gray-400 text-sm">Trade on Ethereum, Solana, BSC, and major CEXs from a unified interface</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Advanced Risk Controls</h3>
                        <p className="text-gray-400 text-sm">Automated stop-loss, take-profit, and position sizing to protect your capital</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={onEnter}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
                  >
                    Start Trading Crypto
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </div>

                {/* Right Content - Visual/Stats */}
                <div className="relative">
                  {/* Glowing background effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-3xl blur-3xl" />

                  {/* Stats Card */}
                  <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] border border-white/10 rounded-3xl p-8">
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-6">
                        <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
                          $2.4B+
                        </div>
                        <div className="text-sm text-gray-400">Crypto Volume Traded</div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-6">
                        <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                          15+
                        </div>
                        <div className="text-sm text-gray-400">Exchanges Integrated</div>
                      </div>
                    </div>

                    {/* Supported Coins */}
                    <div className="space-y-4">
                      <div className="text-sm text-gray-500 uppercase tracking-wide">Supported Assets</div>
                      <div className="flex flex-wrap gap-3">
                        {['BTC', 'ETH', 'SOL', 'BNB', 'MATIC', 'AVAX', 'DOT', 'LINK'].map((coin) => (
                          <div key={coin} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:border-purple-500/50 transition-colors">
                            <span className="text-sm font-semibold text-gray-300">{coin}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
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
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
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
