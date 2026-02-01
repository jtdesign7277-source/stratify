import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Dashboard } from './components/dashboard';
import KrakenDashboard from './components/dashboard/KrakenDashboard';
import { useAlpacaData } from './useAlpacaData';

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
        muted
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

// Landing Page Component
const LandingPage = ({ onEnter }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-[#202124] text-white relative overflow-hidden">
      <GridBackground />

      {/* Mouse-following glow effect */}
      <div
        className="fixed pointer-events-none z-30 transition-opacity duration-300"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          width: '600px',
          height: '600px',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 25%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

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
            <div className="max-w-xl mx-auto mb-6">
              {/* Email Input and Join Waitlist Button */}
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2.5 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <button
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  Join Waitlist
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>

              {/* Waitlist Count */}
              <div className="text-center mb-4">
                <p className="text-gray-400 text-xs flex items-center justify-center gap-1.5">
                  <span className="text-sm">✨</span>
                  <span>Join 501+ traders already on the waitlist</span>
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 mb-4" />

              {/* Continue as Guest */}
              <div className="text-center">
                <button
                  onClick={onEnter}
                  className="w-full py-2.5 bg-transparent border border-white/20 rounded-lg text-white text-sm font-semibold hover:bg-white/5 transition-all flex items-center justify-center gap-2 mb-2"
                >
                  Continue as Guest
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <p className="text-gray-500 text-xs">Explore the full app without signing up</p>
              </div>
            </div>

            {/* Social Proof Stats */}
            <div className="flex items-center justify-center gap-16 mb-16">
              <div className="text-center">
                <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  <AnimatedCounter end={501} suffix="+" />
                </div>
                <div className="text-sm text-gray-400">Beta Waitlist</div>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div className="text-center">
                <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-baseline justify-center gap-1">
                  <span className="text-3xl">⚡</span>
                  <span>Instant</span>
                </div>
                <div className="text-sm text-gray-400">Strategy Deployment</div>
              </div>
            </div>

            {/* Trusted By Section */}
            <div className="mb-16">
              <p className="text-sm text-gray-500 mb-6">INTEGRATED WITH</p>
              <div className="flex items-center justify-center gap-12 flex-wrap">
                {/* Vertex AI */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" fill="#4285F4"/>
                    <circle cx="8" cy="10" r="1.5" fill="#fff"/>
                    <circle cx="12" cy="8" r="1.5" fill="#fff"/>
                    <circle cx="16" cy="10" r="1.5" fill="#fff"/>
                    <circle cx="10" cy="14" r="1.5" fill="#fff"/>
                    <circle cx="14" cy="14" r="1.5" fill="#fff"/>
                  </svg>
                  <span className="text-xl font-semibold text-gray-300">Vertex AI</span>
                </div>

                {/* Perplexity */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L14 8H20L15 12L17 18L12 14L7 18L9 12L4 8H10L12 2Z" fill="#20B8CD"/>
                    <path d="M12 6L13 9H16L13.5 11L14.5 14L12 12L9.5 14L10.5 11L8 9H11L12 6Z" fill="#0D9488"/>
                  </svg>
                  <span className="text-xl font-medium text-gray-300">perplexity</span>
                </div>

                {/* Gemini */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <span className="text-2xl font-medium bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Gemini</span>
                </div>

                {/* Polymarket */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L22 12L12 22L2 12L12 2Z" stroke="#fff" strokeWidth="2" fill="none"/>
                    <path d="M12 6L18 12L12 18L6 12L12 6Z" stroke="#fff" strokeWidth="1.5" fill="none"/>
                  </svg>
                  <span className="text-xl font-semibold text-gray-300">Polymarket</span>
                </div>

                {/* GOLDSKY */}
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <defs>
                      <linearGradient id="goldsky-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F59E0B"/>
                        <stop offset="100%" stopColor="#EF4444"/>
                      </linearGradient>
                    </defs>
                    <circle cx="12" cy="12" r="10" fill="url(#goldsky-grad)"/>
                    <circle cx="12" cy="12" r="6" fill="#0F172A"/>
                  </svg>
                  <span className="text-xl font-bold tracking-wider text-gray-300">GOLDSKY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Automate Your Trades Section */}
          <div className="mb-32 py-24">
            <div className="text-center">
              <h2 className="text-7xl font-bold mb-6 leading-tight">
                Automate Your Trades.<br />
                <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
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
            <div className="bg-[#202124] border border-white/10 rounded-2xl p-8 flex flex-col h-[500px] hover:border-white/20 transition-all">
              {/* Visual Element */}
              <div className="flex-1 flex items-center justify-center mb-6">
                <div className="relative w-full h-64">
                  {/* Comparison Table */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between py-3 px-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
                          <span className="text-purple-400 font-bold text-xs">S</span>
                        </div>
                        <span className="font-medium">Stratify</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-purple-400 font-medium">AI-Powered</span>
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
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-3">Atlas. Zero fees.</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Stratify is the only platform with Atlas AI-powered strategy building and no monthly fees. Build sophisticated algorithms with natural language.
                </p>
              </div>
            </div>

            {/* Real-time Execution Card */}
            <div className="bg-[#202124] border border-white/10 rounded-2xl p-8 flex flex-col h-[500px] hover:border-white/20 transition-all">
              {/* Visual Element */}
              <div className="flex-1 flex items-center justify-center mb-6">
                <div className="relative w-full h-64 flex flex-col items-center justify-center">
                  {/* Speed Metrics */}
                  <div className="text-center mb-8">
                    <div className="text-sm text-gray-400 mb-2">Execution latency</div>
                    <div className="text-6xl font-bold text-blue-400 mb-1">0.8<span className="text-3xl">ms</span></div>
                  </div>

                  {/* Comparison bars */}
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24">Stratify</span>
                      <div className="flex-1 h-2 bg-blue-500/20 rounded-full overflow-hidden">
                        <div className="h-full w-[8%] bg-blue-500 rounded-full"></div>
                      </div>
                      <span className="text-xs text-blue-400 w-12">0.8ms</span>
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
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-3">Sub-millisecond execution. Maximum edge.</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Our infrastructure delivers the fastest order execution with direct market access, ensuring you never miss an opportunity.
                </p>
              </div>
            </div>

            {/* Advanced Analytics Card */}
            <div className="bg-[#202124] border border-white/10 rounded-2xl p-8 flex flex-col h-[500px] hover:border-white/20 transition-all">
              {/* Visual Element */}
              <div className="flex-1 flex items-center justify-center mb-6">
                <div className="relative w-full h-64">
                  {/* Code-style data display */}
                  <div className="font-mono text-sm bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-lg p-6 border border-purple-500/10">
                    <div className="text-gray-500 mb-4">--data &#123;</div>
                    <div className="pl-6 space-y-2">
                      <div>
                        <span className="text-purple-400">'sharpe-ratio'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-blue-400"> 2.84</span>
                      </div>
                      <div>
                        <span className="text-purple-400">'max-drawdown'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-purple-300"> -8.2%</span>
                      </div>
                      <div>
                        <span className="text-purple-400">'win-rate'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-blue-400"> 67.3%</span>
                      </div>
                      <div>
                        <span className="text-purple-400">'profit-factor'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-indigo-400"> 1.92</span>
                      </div>
                      <div>
                        <span className="text-purple-400">'total-trades'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-blue-400"> 1,247</span>
                      </div>
                      <div>
                        <span className="text-purple-400">'avg-hold-time'</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-violet-400"> '4.2h'</span>
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
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-3">Access our API for algorithmic trading</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Deep performance analytics with institutional-grade metrics. Track Sharpe ratio, drawdown, and custom KPIs in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Strategy Templates Section */}
          <div className="mb-20 py-16">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-full mb-6">
                <span className="text-sm font-semibold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  READY-MADE STRATEGIES
                </span>
              </div>
              <h2 className="text-5xl font-bold mb-4">
                Jumpstart with<br />
                <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Proven Templates
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Skip the guesswork. Start with battle-tested strategies built by experienced traders and customize them to fit your style.
              </p>
            </div>

            {/* Strategy Cards */}
            <div className="grid grid-cols-3 gap-6">
              {/* EMA Crossover */}
              <div className="bg-[#202124] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all group">
                <div className="h-40 bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-50">
                    <svg viewBox="0 0 200 80" className="w-full h-full">
                      <path d="M0,60 Q30,55 50,40 T100,35 T150,50 T200,30" stroke="rgba(139,92,246,0.5)" strokeWidth="2" fill="none"/>
                      <path d="M0,50 Q30,60 50,55 T100,40 T150,35 T200,45" stroke="rgba(59,130,246,0.5)" strokeWidth="2" fill="none"/>
                    </svg>
                  </div>
                  <div className="relative z-10 text-center">
                    <div className="text-2xl font-bold text-white/80">8/21 EMA</div>
                    <div className="text-sm text-purple-400">Crossover</div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">Stocks</span>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">Crypto</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">EMA Crossover Strategy</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Classic momentum strategy using 8 and 21 period EMAs. Buy when fast crosses above slow, sell on reversal.
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>67% win rate</span>
                    <span>1.8 profit factor</span>
                  </div>
                </div>
              </div>

              {/* RSI Reversal */}
              <div className="bg-[#202124] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all group">
                <div className="h-40 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-50">
                    <svg viewBox="0 0 200 80" className="w-full h-full">
                      <line x1="0" y1="20" x2="200" y2="20" stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="4"/>
                      <line x1="0" y1="60" x2="200" y2="60" stroke="rgba(34,197,94,0.3)" strokeWidth="1" strokeDasharray="4"/>
                      <path d="M0,40 Q25,15 50,25 T100,65 T150,20 T200,40" stroke="rgba(99,102,241,0.6)" strokeWidth="2" fill="none"/>
                    </svg>
                  </div>
                  <div className="relative z-10 text-center">
                    <div className="text-2xl font-bold text-white/80">RSI</div>
                    <div className="text-sm text-blue-400">30/70 Levels</div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">Forex</span>
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">Futures</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">RSI Reversal Strategy</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Mean reversion strategy targeting oversold and overbought conditions with RSI confirmation signals.
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>62% win rate</span>
                    <span>2.1 profit factor</span>
                  </div>
                </div>
              </div>

              {/* Breakout */}
              <div className="bg-[#202124] border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all group">
                <div className="h-40 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-50">
                    <svg viewBox="0 0 200 80" className="w-full h-full">
                      <line x1="0" y1="45" x2="120" y2="45" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                      <path d="M0,50 L40,48 L80,52 L120,45 L140,20 L160,15 L200,10" stroke="rgba(139,92,246,0.6)" strokeWidth="2" fill="none"/>
                    </svg>
                  </div>
                  <div className="relative z-10 text-center">
                    <div className="text-2xl font-bold text-white/80">Break</div>
                    <div className="text-sm text-indigo-400">& Retest</div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">Stocks</span>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">Options</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Breakout Strategy</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Captures explosive moves when price breaks key resistance levels with volume confirmation.
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>58% win rate</span>
                    <span>2.4 profit factor</span>
                  </div>
                </div>
              </div>
            </div>

            {/* View All Button */}
            <div className="text-center mt-10">
              <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                View All 50+ Templates →
              </button>
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

          {/* Pricing Section */}
          <div className="py-24 border-t border-white/10" id="pricing">
            <h2 className="text-5xl font-bold text-center mb-4 leading-tight">
              Find arbitrage. Lock in profit.<br />
              <span className="text-purple-400">Guaranteed.</span>
            </h2>
            <p className="text-gray-400 text-center text-lg mb-16">Cross-platform arbitrage scanning for prediction markets & sportsbooks</p>

            <div className="grid grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Free Tier */}
              <div className="bg-[#202124] border border-white/10 rounded-2xl p-8">
                <div className="text-base text-gray-400 mb-2">Free</div>
                <div className="text-4xl font-bold mb-1">
                  $0<span className="text-lg text-gray-400">/month</span>
                </div>
                <div className="text-gray-400 text-sm mb-6 leading-relaxed">
                  See the opportunities.<br />
                  Execute manually.
                </div>
                <button className="w-full py-3 border border-white/30 rounded-full hover:bg-white/5 transition-colors mb-6">
                  Start Free
                </button>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">5 arb alerts per day</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Polymarket + Kalshi scanning</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Manual execution (links out)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Basic profit calculator</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Email support</span>
                  </li>
                </ul>
              </div>

              {/* Pro Tier */}
              <div className="bg-[#202124] border border-purple-500/30 rounded-2xl p-8">
                <div className="text-base text-purple-400 mb-2">Pro</div>
                <div className="text-4xl font-bold mb-1">
                  $29<span className="text-lg text-gray-400">/month</span>
                </div>
                <div className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Unlimited alerts.<br />
                  AI-powered strategies.
                </div>
                <button
                  onClick={onEnter}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-full transition-all mb-6"
                >
                  Get Pro
                </button>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Unlimited arb alerts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">All platforms (+ sportsbooks)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Atlas AI strategy builder</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Real-time scanning (30s refresh)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Priority support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Bet tracking & P&L history</span>
                  </li>
                </ul>
              </div>

              {/* Elite Tier */}
              <div className="relative bg-[#202124] border-2 border-amber-500/50 rounded-2xl p-8 shadow-2xl shadow-amber-500/20">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-2xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="text-base text-amber-400 mb-2">Elite</div>
                  <div className="text-4xl font-bold mb-1">
                    $99<span className="text-lg text-gray-400">/month</span>
                  </div>
                  <div className="text-gray-400 text-sm mb-6 leading-relaxed">
                    One-click execution.<br />
                    Maximum speed. Maximum edge.
                  </div>
                  <button
                    onClick={onEnter}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-full hover:from-amber-400 hover:to-amber-500 transition-all mb-6"
                  >
                    Get Elite 🚀
                  </button>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">⚡</span>
                      <span className="text-white font-semibold">1-CLICK EXECUTION - Both sides instantly</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">✓</span>
                      <span className="text-gray-300">Everything in Pro</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">✓</span>
                      <span className="text-gray-300">Auto-execute arbs instantly</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">✓</span>
                      <span className="text-gray-300">Live in-game arbitrage</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">✓</span>
                      <span className="text-gray-300">API access & webhooks</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">✓</span>
                      <span className="text-gray-300">Dedicated support + strategy calls</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-amber-400 mt-0.5">✓</span>
                      <span className="text-gray-300">Early access to new features</span>
                    </li>
                  </ul>
                </div>
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
    <div className="h-full bg-[#202124] flex flex-col">
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
      <div className="border-t border-white/10 px-6 py-4 bg-[#202124]">
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
    <div className="flex flex-col h-full bg-[#202124]">
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
      <div className="border-t border-[#2a2a2a] p-4 bg-[#202124]">
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
    <div className="min-h-screen bg-[#202124] text-white flex">
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
          <div className="bg-[#202124] border-b border-white/10 px-4 py-3 flex items-center">
            <span className="text-sm font-medium text-gray-400">tesla-ema-strategy.ts</span>
          </div>

          {/* Editor Content */}
          <div className="flex-1 bg-[#202124] relative overflow-hidden">
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

            <div className="border-t border-white/10 bg-[#202124]" style={{ height: `${strategiesHeight}px` }}>
              {/* Tabs */}
              <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 bg-[#1e1e1e]">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBottomTab('strategies')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      bottomTab === 'strategies'
                        ? 'bg-[#202124] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Active Strategies (3)
                  </button>
                  <button
                    onClick={() => setBottomTab('terminal')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      bottomTab === 'terminal'
                        ? 'bg-[#202124] text-white'
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
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#202124] rounded text-xs">
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
      <div className="relative z-10 w-[380px] border-l border-white/10 bg-[#202124]">
        <ClaudeCodeChat />
      </div>
    </div>
  );
};

// Main App Component
export default function StratifyApp() {
  const [showIntro, setShowIntro] = useState(true);
  const [currentPage, setCurrentPage] = useState('landing');
  const { stocks, loading, error } = useAlpacaData();

  // Show cinematic intro on first visit
  if (showIntro) {
    return <VideoIntro onComplete={() => setShowIntro(false)} />;
  }

  if (currentPage === 'landing') {
    return <LandingPage onEnter={() => setCurrentPage('dashboard')} />;
  }

  return <KrakenDashboard setCurrentPage={setCurrentPage} alpacaData={{ positions: stocks, account: { equity: 0, cash: 0, buying_power: 0 } }} />;
}
