import { useState, useEffect } from 'react';

// Stratify Logo SVG
const StratifyLogo = () => (
  <svg viewBox="0 0 64 64" className="w-16 h-16">
    <ellipse cx="32" cy="32" rx="28" ry="16" stroke="#3b82f6" strokeWidth="1" fill="none" opacity="0.4" transform="rotate(-20 32 32)"/>
    <ellipse cx="32" cy="32" rx="26" ry="22" stroke="#60a5fa" strokeWidth="0.8" fill="none" opacity="0.5" transform="rotate(25 32 32)"/>
    <ellipse cx="32" cy="32" rx="22" ry="18" stroke="#93c5fd" strokeWidth="0.6" fill="none" opacity="0.3" transform="rotate(-45 32 32)"/>
    <circle cx="56" cy="22" r="2.5" fill="#60a5fa"/>
    <circle cx="8" cy="42" r="2.5" fill="#60a5fa"/>
    <circle cx="48" cy="54" r="2" fill="#3b82f6" opacity="0.7"/>
    <circle cx="14" cy="12" r="1.5" fill="#93c5fd" opacity="0.5"/>
    <text x="32" y="40" textAnchor="middle" fill="url(#logoGrad)" fontSize="28" fontWeight="600" fontFamily="system-ui">S</text>
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa"/>
        <stop offset="100%" stopColor="#3b82f6"/>
      </linearGradient>
    </defs>
  </svg>
);

// Section component
const Section = ({ label, title, children }) => (
  <div className="mb-10">
    <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">{label}</span>
    <h3 className="text-xl font-semibold text-white mt-2 mb-4">{title}</h3>
    {children}
  </div>
);

// Feature card
const FeatureCard = ({ icon, title, children }) => (
  <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 hover:border-blue-500/50 transition-colors">
    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3 text-blue-500">
      {icon}
    </div>
    <h4 className="text-base font-semibold text-white mb-2">{title}</h4>
    <p className="text-sm text-gray-400 leading-relaxed">{children}</p>
  </div>
);

// Step component
const Step = ({ number, title, description }) => (
  <div className="flex gap-4 mb-5">
    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {number}
    </div>
    <div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  </div>
);

// Stat card
const StatCard = ({ value, label }) => (
  <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 text-center">
    <div className="text-2xl font-bold text-blue-500">{value}</div>
    <div className="text-[10px] text-white/50 uppercase tracking-wide">{label}</div>
  </div>
);

export default function NewsletterModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] animate-fadeIn">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Newsletter Content */}
        <div className="bg-[#303134] rounded-2xl overflow-hidden border border-[#21262d]">
          
          {/* Header */}
          <div className="bg-gradient-to-br from-[#0d1117] to-[#161b22] p-8 text-center border-b border-[#21262d]">
            <div className="flex justify-center mb-4">
              <StratifyLogo />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-1">Stratify</h1>
            <p className="text-gray-400 text-sm">Trade Smarter with AI-Powered Strategies</p>
            <span className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full mt-4">
              📈 January 2026 Edition
            </span>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto max-h-[60vh] p-6" style={{ scrollbarWidth: 'none' }}>
            
            {/* Intro */}
            <p className="text-gray-300 text-base leading-relaxed mb-8">
              Welcome to the <strong className="text-white">first edition</strong> of the Stratify newsletter! We're building something special — a platform that lets you describe trading strategies in plain English and watch AI transform them into executable, backtested algorithms. No coding required.
            </p>

            {/* Vision Section */}
            <Section label="The Vision" title="Trading Strategies in Plain English">
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                What if you could simply <em>describe</em> a trading strategy to an AI, and it builds it for you? That's exactly what Stratify does. Tell us what you want — RSI reversals, moving average crossovers, breakout patterns — and watch it come to life.
              </p>
              <div className="bg-blue-500/10 border-l-2 border-blue-500 rounded-r-lg p-4">
                <p className="text-gray-300 text-sm italic mb-2">
                  "Buy Tesla when RSI drops below 30 and sell when it goes above 70. Use a 2% position size with a 5% stop loss."
                </p>
                <span className="text-xs text-white/50">— That's all it takes. Plain English → Working Strategy.</span>
              </div>
            </Section>

            {/* Grok */}
            <Section label="Core Feature" title="🤖 Grok">
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                Our AI chatbot understands trading concepts and translates your ideas into real, executable code. It's like having a quantitative developer on call 24/7.
              </p>
              
              <Step number="1" title="Describe Your Strategy" description="Type what you want in natural language. No technical jargon needed." />
              <Step number="2" title="AI Generates the Code" description="Grok AI translates your idea into backtestable Python code instantly." />
              <Step number="3" title="Review & Customize" description="Adjust risk parameters, position sizing, and stop losses with simple controls." />
              <Step number="4" title="Backtest & Deploy" description="Test against historical data, then deploy to live markets with one click." />

              <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 font-mono text-xs mt-4">
                <span className="text-white/50"># Generated by Stratify AI</span><br/>
                <span className="text-red-400">class</span> <span className="text-purple-400">RSIStrategy</span>(Strategy):<br/>
                <span className="text-gray-400 ml-4">def</span> <span className="text-purple-400">on_bar</span>(self, bar):<br/>
                <span className="text-gray-300 ml-8">rsi = self.indicators.RSI(</span><span className="text-blue-400">14</span><span className="text-gray-300">)</span><br/>
                <span className="text-red-400 ml-8">if</span> <span className="text-gray-300">rsi &lt; </span><span className="text-blue-400">30</span><span className="text-gray-300">:</span><br/>
                <span className="text-gray-300 ml-12">self.buy(size=</span><span className="text-blue-400">0.02</span><span className="text-gray-300">)</span>
              </div>
            </Section>

            <div className="h-px bg-gradient-to-r from-transparent via-[#21262d] to-transparent my-8" />

            {/* Backtesting */}
            <Section label="Before You Risk Real Money" title="📊 Powerful Backtesting">
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                Every strategy gets tested against years of historical market data before you risk a single dollar. See exactly how your strategy would have performed.
              </p>
              
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatCard value="67%" label="Win Rate" />
                <StatCard value="2.1" label="Profit Factor" />
                <StatCard value="-8.2%" label="Max Drawdown" />
              </div>
            </Section>

            <div className="h-px bg-gradient-to-r from-transparent via-[#21262d] to-transparent my-8" />

            {/* Deployment */}
            <Section label="Go Live" title="🚀 One-Click Deployment">
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                When you're confident in your strategy, deploy it to live markets with a single click. Stratify connects directly to your broker via the Alpaca API.
              </p>
              
              <div className="grid gap-3">
                <FeatureCard
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  }
                  title="Real-Time Execution"
                >
                  Sub-millisecond order execution with direct market access. Your strategy runs 24/7.
                </FeatureCard>
                
                <FeatureCard
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                  }
                  title="Built-In Risk Controls"
                >
                  Automatic stop-losses, position limits, and daily loss caps protect your capital.
                </FeatureCard>
              </div>
            </Section>

            <div className="h-px bg-gradient-to-r from-transparent via-[#21262d] to-transparent my-8" />

            {/* Watchlist */}
            <Section label="Research Tools" title="👁️ Watchlist & TradingView Charts">
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Build your watchlist and analyze any stock with professional-grade TradingView charts — right inside Stratify.
              </p>
              
              <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                <p className="text-sm text-gray-300">
                  ✓ Real-time stock quotes & price alerts<br/>
                  ✓ Full TradingView charting with indicators<br/>
                  ✓ One-click chart access from your watchlist<br/>
                  ✓ Track P&L across all your strategies
                </p>
              </div>
            </Section>

            <div className="h-px bg-gradient-to-r from-transparent via-[#21262d] to-transparent my-8" />

            {/* Strategy Templates */}
            <Section label="Get Started Fast" title="📁 50+ Strategy Templates">
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Don't want to start from scratch? Browse our library of battle-tested strategies built by experienced traders.
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                  <div className="text-sm font-medium text-white">EMA Crossover</div>
                  <div className="text-xs text-white/50">8/21 EMA momentum</div>
                </div>
                <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                  <div className="text-sm font-medium text-white">RSI Reversal</div>
                  <div className="text-xs text-white/50">Mean reversion</div>
                </div>
                <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                  <div className="text-sm font-medium text-white">Breakout Hunter</div>
                  <div className="text-xs text-white/50">Resistance breaks</div>
                </div>
                <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                  <div className="text-sm font-medium text-white">Golden Cross</div>
                  <div className="text-xs text-white/50">50/200 MA trend</div>
                </div>
              </div>
            </Section>

            <div className="h-px bg-gradient-to-r from-transparent via-[#21262d] to-transparent my-8" />

            {/* Coming Next */}
            <Section label="On The Roadmap" title="🔮 What's Coming Next">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <h4 className="text-emerald-400 text-sm font-semibold mb-3">🚧 In Development</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>→ Real Alpaca API integration for live trading</li>
                  <li>→ User authentication & account management</li>
                  <li>→ Advanced backtesting engine with 10+ years of data</li>
                  <li>→ Mobile app for monitoring on the go</li>
                  <li>→ Social features — share & discover strategies</li>
                  <li>→ Crypto trading support (BTC, ETH, SOL & more)</li>
                </ul>
              </div>
            </Section>

          </div>

          {/* Footer */}
          <div className="bg-[#0d1117] border-t border-[#21262d] p-4 text-center">
            <p className="text-xs text-white/50">
              © 2026 Stratify. All rights reserved. This is not financial advice. Trading involves risk.
            </p>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
