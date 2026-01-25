import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { 
  Mic, MessageSquare, TrendingUp, Bot, Pause, Power, Play, Settings, 
  ChevronRight, BarChart3, Shield, Zap, Clock, Target, ArrowUpRight,
  ArrowDownRight, Activity, PieChart, LineChart, Wallet, Brain, Sparkles,
  Volume2, ChevronDown, Plus, Trash2, Edit3, Check, X, RefreshCw,
  Folder, File, Sun, User, Send, BookOpen, LayoutGrid, DollarSign,
  Minus, Square, Search, GitBranch, Bug, Blocks, Database, Container, Bell
} from 'lucide-react';

// ============================================
// ANIMATED CHART COMPONENTS
// ============================================

const AnimatedLineChart = ({ data, color = '#10b981', height = 80, animate = true }) => {
  const [pathLength, setPathLength] = useState(0);
  
  const points = data || [20, 40, 35, 50, 45, 60, 55, 70, 65, 80, 75, 90, 85, 95, 88];
  const width = 100;
  const h = height;
  const maxVal = Math.max(...points);
  const minVal = Math.min(...points);
  const range = maxVal - minVal || 1;
  
  const pathD = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = h - ((p - minVal) / range) * (h * 0.8) - h * 0.1;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {animate ? (
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
      ) : (
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      )}
      <path 
        d={`${pathD} L ${width} ${h} L 0 ${h} Z`} 
        fill={`url(#gradient-${color})`} 
        opacity="0.5"
      />
    </svg>
  );
};

const AnimatedBarChart = ({ animate = true }) => {
  const bars = [40, 65, 45, 80, 55, 70, 90, 60, 75, 85];
  
  return (
    <div className="flex items-end gap-1 h-16">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          className="flex-1 bg-gradient-to-t from-emerald-500/50 to-emerald-400/80 rounded-t"
          initial={animate ? { height: 0 } : { height: `${height}%` }}
          animate={{ height: `${height}%` }}
          transition={{ duration: 0.5, delay: i * 0.05 }}
        />
      ))}
    </div>
  );
};

const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-emerald-500/30 rounded-full"
        initial={{ 
          x: Math.random() * 100 + '%',
          y: '100%',
          opacity: 0 
        }}
        animate={{ 
          y: '-10%',
          opacity: [0, 1, 0]
        }}
        transition={{
          duration: Math.random() * 5 + 5,
          repeat: Infinity,
          delay: Math.random() * 5
        }}
      />
    ))}
  </div>
);

// ============================================
// LANDING PAGE COMPONENT (Dovetail style)
// ============================================

// 3D Globe Component
const Globe3D = () => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 400" className="w-full h-full max-w-md" style={{ filter: 'drop-shadow(0 0 20px rgba(16,185,129,0.1))' }}>
        <defs>
          <radialGradient id="globeGradient" cx="35%" cy="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
        </defs>
        
        {/* Outer circle */}
        <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        
        {/* Globe */}
        <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" opacity="0.5" />
        
        {/* Grid lines */}
        <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" fill="none">
          <circle cx="200" cy="200" r="140" />
          <circle cx="200" cy="200" r="105" />
          <circle cx="200" cy="200" r="70" />
          <line x1="60" y1="200" x2="340" y2="200" />
          <line x1="200" y1="60" x2="200" y2="340" />
          <path d="M 110 110 A 127.3 127.3 0 0 1 290 110" />
          <path d="M 110 290 A 127.3 127.3 0 0 1 290 290" />
        </g>
        
        {/* Data points - blue */}
        <motion.circle cx="200" cy="130" r="5" fill="#3b82f6" animate={{ r: [5, 7, 5] }} transition={{ duration: 2, repeat: Infinity }} />
        <motion.circle cx="240" cy="160" r="4" fill="#3b82f6" animate={{ r: [4, 6, 4] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }} />
        <motion.circle cx="180" cy="290" r="5" fill="#3b82f6" animate={{ r: [5, 7, 5] }} transition={{ duration: 2, repeat: Infinity, delay: 0.6 }} />
        
        {/* Data points - red/orange */}
        <motion.circle cx="160" cy="150" r="4" fill="#f97316" animate={{ r: [4, 6, 4] }} transition={{ duration: 2, repeat: Infinity, delay: 0.2 }} />
        <motion.circle cx="260" cy="220" r="5" fill="#ef4444" animate={{ r: [5, 7, 5] }} transition={{ duration: 2.3, repeat: Infinity, delay: 0.4 }} />
        
        {/* Data points - gray/neutral */}
        <circle cx="200" cy="160" r="3" fill="rgba(255,255,255,0.5)" />
        <circle cx="230" cy="270" r="3.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="140" cy="240" r="3" fill="rgba(255,255,255,0.5)" />
        
        {/* Dashed orbital lines */}
        <g stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3" fill="none">
          <path d="M 200 60 Q 280 130 280 200 Q 280 270 200 340" />
          <path d="M 200 60 Q 120 130 120 200 Q 120 270 200 340" />
        </g>
        
        {/* Center glow */}
        <circle cx="200" cy="200" r="20" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="2" opacity="0.6" />
      </svg>
    </div>
  );
};

// ============================================
// NEW LANDING PAGE (Slash-Inspired)
// ============================================

const NewLandingPage = ({ onEnter }) => {
  const [portfolioValue] = useState(2847392.45);
  const [todayChange] = useState(12847.32);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  
  // Animated counter for portfolio value
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = portfolioValue / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= portfolioValue) {
        setDisplayValue(portfolioValue);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [portfolioValue]);

  const features = [
    {
      title: 'AI Strategy Builder',
      description: 'Describe your trading strategy in plain English. Claude AI generates production-ready code instantly.',
      icon: '🤖',
    },
    {
      title: 'Live Backtesting',
      description: 'Test your strategies against years of historical data. Get win rates, profit factors, and drawdown analysis.',
      icon: '📊',
    },
    {
      title: 'Multi-Broker Support',
      description: 'Connect TD Ameritrade, Interactive Brokers, Webull, and more. Trade across all your accounts.',
      icon: '🔗',
    },
    {
      title: 'Real-Time Execution',
      description: 'Deploy strategies with one click. Monitor P&L live. Kill or pause anytime.',
      icon: '⚡',
    },
    {
      title: 'Strategy Marketplace',
      description: 'Browse community strategies. Clone, customize, and deploy proven winners.',
      icon: '🏪',
    },
    {
      title: 'Risk Management',
      description: 'Set stop losses, take profits, and position limits. Never lose more than you plan.',
      icon: '🛡️',
    },
  ];

  const transactions = [
    { symbol: 'TSLA', type: 'Long', amount: '+$2,847.32', status: 'Closed', time: '2m ago' },
    { symbol: 'SPY', type: 'Short', amount: '-$432.10', status: 'Closed', time: '15m ago' },
    { symbol: 'NVDA', type: 'Long', amount: '+$1,203.45', status: 'Active', time: '1h ago' },
    { symbol: 'AAPL', type: 'Long', amount: '+$567.89', status: 'Active', time: '2h ago' },
    { symbol: 'META', type: 'Short', amount: '+$892.00', status: 'Closed', time: '3h ago' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="text-xl font-bold tracking-tight">Stratify</span>
        </motion.div>
        
        <motion.div 
          className="flex items-center gap-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button className="text-gray-400 hover:text-white transition-colors p-2">
            <Bell className="w-5 h-5 stroke-1" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors text-sm">
            Log In
          </button>
          <button 
            onClick={onEnter}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            Get Started
          </button>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left - Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
                <span className="text-gray-400 italic font-light">A smarter way</span>
                <br />
                to trade
              </h1>
              <p className="text-xl text-gray-400 mb-8 max-w-lg">
                AI-powered strategies, real-time backtesting, and automated execution. All on one platform.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-sm">
                  <input 
                    type="email" 
                    placeholder="What's your email?"
                    className="w-full px-4 py-3 bg-[#1a1a1f] border border-white/10 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <button 
                  onClick={onEnter}
                  className="px-6 py-3 bg-white text-black font-semibold rounded-r-lg hover:bg-gray-100 transition-colors"
                >
                  Get Started
                </button>
              </div>
            </motion.div>

            {/* Right - Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              {/* Main Portfolio Card */}
              <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-gray-400 text-sm mb-1">Portfolio Value</div>
                    <div className="text-4xl font-bold text-white">
                      ${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-[#1a1a1f] rounded-lg text-sm text-gray-400">Balance</span>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">This Week</span>
                  </div>
                </div>
                
                {/* Chart */}
                <div className="h-40 mb-6 relative">
                  <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(245, 158, 11, 0.3)" />
                        <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      d="M 0 80 Q 50 70, 80 60 T 150 50 T 220 40 T 280 35 T 340 25 T 400 20"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, ease: "easeOut" }}
                    />
                    <motion.path
                      d="M 0 80 Q 50 70, 80 60 T 150 50 T 220 40 T 280 35 T 340 25 T 400 20 L 400 100 L 0 100 Z"
                      fill="url(#chartGradient)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1, delay: 1 }}
                    />
                  </svg>
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 pt-2 border-t border-white/5">
                    <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Today's P&L</span>
                  <span className="text-emerald-400 font-semibold">+${todayChange.toLocaleString()}</span>
                </div>
              </div>

              {/* Floating Transactions Card */}
              <motion.div 
                className="absolute -right-8 top-12 w-64 bg-[#12121a] rounded-xl border border-white/10 p-4 shadow-2xl"
                initial={{ opacity: 0, x: 30, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <div className="text-sm text-gray-400 mb-3">Recent Trades</div>
                <div className="space-y-2">
                  {transactions.slice(0, 4).map((tx, i) => (
                    <motion.div 
                      key={i}
                      className="flex items-center justify-between text-xs"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.1 }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${tx.type === 'Long' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-white font-medium">{tx.symbol}</span>
                        <span className="text-gray-500">{tx.type}</span>
                      </div>
                      <span className={tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}>
                        {tx.amount}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Floating Strategy Card */}
              <motion.div 
                className="absolute -left-8 bottom-8 bg-[#12121a] rounded-xl border border-emerald-500/30 p-4 shadow-2xl"
                initial={{ opacity: 0, x: -30, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-emerald-400">✓</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Strategy Deployed!</div>
                    <div className="text-xs text-gray-500">TSLA EMA Crossover running</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-8 bg-[#08080c]">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-4">Everything you need to trade smarter</h2>
            <p className="text-gray-400 text-lg">Professional-grade tools, zero complexity.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="bg-[#12121a] rounded-2xl border border-white/5 p-6 hover:border-white/20 transition-all cursor-pointer group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onHoverStart={() => setHoveredFeature(i)}
                onHoverEnd={() => setHoveredFeature(null)}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-emerald-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-20 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Build strategies with
                <br />
                <span className="text-emerald-400">natural language</span>
              </h2>
              <p className="text-gray-400 text-lg mb-8">
                Just describe what you want. Our AI understands trading logic and generates optimized, 
                backtested strategies in seconds.
              </p>
              
              <div className="space-y-4">
                {[
                  'Buy TSLA when 8 EMA crosses 21 EMA on weekly',
                  'Short SPY when RSI > 70, take profit at 2%',
                  'Scale into NVDA on dips, max 5% position size',
                ].map((example, i) => (
                  <motion.div 
                    key={i}
                    className="flex items-center gap-3 p-3 bg-[#12121a] rounded-lg border border-white/5"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span className="text-emerald-400">→</span>
                    <span className="text-gray-300 text-sm">{example}</span>
                  </motion.div>
                ))}
              </div>

              <button 
                onClick={onEnter}
                className="mt-8 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors"
              >
                Try the Demo →
              </button>
            </motion.div>

            {/* Code Preview */}
            <motion.div
              className="bg-[#12121a] rounded-2xl border border-white/10 overflow-hidden"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center h-10 bg-[#1a1a1f] border-b border-white/10 px-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <span className="ml-4 text-xs text-gray-500">strategy.ts</span>
              </div>
              <div className="p-6 font-mono text-sm">
                <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="text-gray-500">// AI-generated strategy</div>
                  <div className="text-purple-400">export const</div>
                  <div className="text-white ml-4">TeslaEMAStrategy = {'{'}</div>
                  <div className="text-blue-400 ml-8">symbol: <span className="text-emerald-400">'TSLA'</span>,</div>
                  <div className="text-blue-400 ml-8">timeframe: <span className="text-emerald-400">'1W'</span>,</div>
                  <div className="text-blue-400 ml-8">entry: <span className="text-yellow-400">EMA(8) crosses EMA(21)</span>,</div>
                  <div className="text-blue-400 ml-8">stopLoss: <span className="text-orange-400">1%</span>,</div>
                  <div className="text-blue-400 ml-8">takeProfit: <span className="text-emerald-400">3%</span>,</div>
                  <div className="text-white ml-4">{'}'}</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-8 bg-[#08080c]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '$2.4B+', label: 'Volume Traded' },
              { value: '50K+', label: 'Strategies Deployed' },
              { value: '67%', label: 'Avg Win Rate' },
              { value: '<50ms', label: 'Execution Speed' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6">Ready to trade smarter?</h2>
            <p className="text-gray-400 text-lg mb-8">
              Join thousands of traders using AI to build, test, and deploy profitable strategies.
            </p>
            <button 
              onClick={onEnter}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-lg rounded-lg transition-colors"
            >
              Start Trading Free →
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-gray-500 text-sm">© 2026 Stratify. All rights reserved.</div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const LandingPage = ({ onEnter }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [expandedFolders, setExpandedFolders] = useState({ momentum: true, meanReversion: false, scalping: false });
  const [runningStrategies, setRunningStrategies] = useState([
    { id: 'mom1', name: 'RSI Breakout', risk: 'Medium', startTime: Date.now() - 180000 },
    { id: 'mr1', name: 'Bollinger Bounce', risk: 'Medium', startTime: Date.now() - 420000 },
    { id: 'sc1', name: 'VWAP Scalper', risk: 'High', startTime: Date.now() - 60000 },
  ]);
  const [strategyPnL, setStrategyPnL] = useState({
    'mom1': 127.45,
    'mr1': -34.20,
    'sc1': 89.67,
  });

  // Demo animation states
  const [demoPhase, setDemoPhase] = useState(0); // 0: typing, 1: thinking, 2: code output, 3: strategy ready
  const [typedUserMessage, setTypedUserMessage] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [strategyReady, setStrategyReady] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState(0); // 0 or 1 to alternate
  const [brokerExpanded, setBrokerExpanded] = useState(false);

  // Strategy 1: EMA Crossover
  const strategies = [
    {
      prompt: "Buy TSLA when 8 EMA crosses above 21 EMA on weekly timeframe. Set 1% stop loss, 3% take profit. Repeat weekly.",
      name: "TSLA 8/21 EMA Weekly",
      stats: { winRate: "67.3%", profitFactor: "2.14", totalReturn: "+156.8%" },
      code: `// Tesla EMA Crossover Strategy
// Timeframe: Weekly | Risk: Medium

import { Strategy } from '@stratify/core';

export const TeslaEMACrossover = new Strategy({
  name: 'TSLA 8/21 EMA Weekly',
  symbol: 'TSLA',
  timeframe: '1W',
  
  indicators: {
    ema8: EMA(8),
    ema21: EMA(21),
  },
  
  entry: (data) => {
    return data.ema8 > data.ema21 && 
           data.prev.ema8 <= data.prev.ema21;
  },
  
  exit: {
    stopLoss: 0.01,    // 1%
    takeProfit: 0.03,  // 3%
  },
});`
    },
    {
      prompt: "When TSLA moves up $10, take reverse trade short. Max 1% loss. Take 50% profit at 3%, trail remaining 50% with 1% trailing stop.",
      name: "TSLA $10 Reversal Scalp",
      stats: { winRate: "58.2%", profitFactor: "1.87", totalReturn: "+89.4%" },
      code: `// Tesla $10 Move Reversal Strategy
// Type: Mean Reversion | Risk: High

import { Strategy } from '@stratify/core';

export const TeslaReversalScalp = new Strategy({
  name: 'TSLA $10 Reversal',
  symbol: 'TSLA',
  timeframe: '15m',
  
  trigger: {
    priceMove: 10,  // $10 move triggers
    direction: 'up',
    action: 'short', // Fade the move
  },
  
  exit: {
    stopLoss: 0.01,  // 1% max loss
    targets: [
      { size: 0.50, profit: 0.03 },  // 50% at 3%
      { size: 0.50, trailStop: 0.01 } // 50% trail
    ],
  },
});`
    }
  ];

  const userPrompt = strategies[currentStrategy].prompt;
  const generatedCode = strategies[currentStrategy].code;
  const strategyName = strategies[currentStrategy].name;
  const strategyStats = strategies[currentStrategy].stats;

  // Typing animation effect
  useEffect(() => {
    let timeout;
    
    if (demoPhase === 0) {
      // Type user message
      if (typedUserMessage.length < userPrompt.length) {
        timeout = setTimeout(() => {
          setTypedUserMessage(userPrompt.slice(0, typedUserMessage.length + 1));
        }, 50);
      } else {
        timeout = setTimeout(() => setDemoPhase(1), 1000);
      }
    } else if (demoPhase === 1) {
      // Thinking phase
      timeout = setTimeout(() => setDemoPhase(2), 2000);
    } else if (demoPhase === 2) {
      // Type code
      if (typedCode.length < generatedCode.length) {
        timeout = setTimeout(() => {
          setTypedCode(generatedCode.slice(0, typedCode.length + 3));
        }, 20);
      } else {
        timeout = setTimeout(() => {
          setDemoPhase(3);
          setStrategyReady(true);
        }, 800);
      }
    } else if (demoPhase === 3) {
      // Keep strategy visible longer, then reset and switch to next strategy
      timeout = setTimeout(() => {
        setDemoPhase(0);
        setTypedUserMessage('');
        setTypedCode('');
        setStrategyReady(false);
        setCurrentStrategy(prev => (prev + 1) % 2); // Alternate between 0 and 1
      }, 12000);
    }
    
    return () => clearTimeout(timeout);
  }, [demoPhase, typedUserMessage, typedCode, generatedCode]);

  const strategyFolders = {
    favorites: {
      name: 'Favorites',
      strategies: [
        { id: 'fav1', name: 'TSLA EMA Weekly', risk: 'Medium' },
        { id: 'fav2', name: 'SPY Iron Condor', risk: 'Low' },
      ]
    },
    momentum: {
      name: 'Momentum Strategies',
      strategies: [
        { id: 'mom1', name: 'RSI Breakout', risk: 'Medium' },
        { id: 'mom2', name: 'MACD Crossover', risk: 'Low' },
        { id: 'mom3', name: 'Volume Spike', risk: 'High' },
      ]
    },
    meanReversion: {
      name: 'Mean Reversion',
      strategies: [
        { id: 'mr1', name: 'Bollinger Bounce', risk: 'Medium' },
        { id: 'mr2', name: 'RSI Oversold', risk: 'Low' },
      ]
    },
    scalping: {
      name: 'Scalping',
      strategies: [
        { id: 'sc1', name: 'VWAP Scalper', risk: 'High' },
        { id: 'sc2', name: '1-Min Momentum', risk: 'High' },
      ]
    }
  };

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const deployStrategy = (strategy) => {
    if (runningStrategies.length >= 5) return;
    if (runningStrategies.find(s => s.id === strategy.id)) return;
    
    setRunningStrategies(prev => [...prev, { ...strategy, startTime: Date.now() }]);
    setStrategyPnL(prev => ({ ...prev, [strategy.id]: 0 }));
  };

  const stopStrategy = (strategyId) => {
    setRunningStrategies(prev => prev.filter(s => s.id !== strategyId));
  };

  const stopAllStrategies = () => {
    setRunningStrategies([]);
  };

  const pauseStrategy = (id) => {
    // Toggle pause state for individual strategy - visual indicator
    console.log(`Paused strategy: ${id}`);
  };

  // Simulate P&L updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStrategyPnL(prev => {
        const updated = { ...prev };
        runningStrategies.forEach(s => {
          const change = (Math.random() - 0.48) * 50;
          updated[s.id] = (updated[s.id] || 0) + change;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [runningStrategies]);

  const totalPnL = Object.values(strategyPnL).reduce((sum, pnl) => sum + pnl, 0);

  return (
    <div 
      className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/10">
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="text-lg font-semibold tracking-tight">Stratify</span>
        </motion.div>
        
        <motion.div 
          className="flex items-center gap-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button className="text-gray-400 hover:text-white transition-colors p-2">
            <Bell className="w-5 h-5 stroke-1" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors text-sm">
            Log In
          </button>
        </motion.div>
      </nav>

      {/* Main Content Grid */}
      <div className="relative z-10 h-screen flex flex-col">
        <div className="flex-1 flex">
          {/* Left Sidebar - Strategy Folders */}
          <div className="w-80 border-r border-white/10 flex flex-col bg-[#0d0d12]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-xs uppercase tracking-widest text-gray-500">My Strategies</div>
              <div className="text-xs text-gray-600 mt-1">{runningStrategies.length}/5 running</div>
            </div>
            
            {/* Folders */}
            <div className="flex-1 overflow-y-auto p-2">
              {Object.entries(strategyFolders).map(([key, folder]) => (
                <div key={key} className="mb-1">
                  {/* Folder Header */}
                  <div 
                    onClick={() => toggleFolder(key)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${expandedFolders[key] ? 'rotate-90' : ''}`} />
                    <Folder className="w-4 h-4 text-gray-400 stroke-1" />
                    <span className="text-sm text-gray-300">{folder.name}</span>
                    <span className="ml-auto text-xs text-gray-600">{folder.strategies.length}</span>
                  </div>
                  
                  {/* Strategies in folder */}
                  {expandedFolders[key] && (
                    <div className="ml-4 pl-4 border-l border-white/5">
                      {folder.strategies.map((strategy) => {
                        const isRunning = runningStrategies.find(s => s.id === strategy.id);
                        return (
                          <div 
                            key={strategy.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                          >
                            <File className="w-4 h-4 text-emerald-400/70 stroke-1" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-300 truncate">{strategy.name}</div>
                              <div className="text-xs text-gray-600">{strategy.risk} Risk</div>
                            </div>
                            {isRunning ? (
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              </div>
                            ) : (
                              <button 
                                onClick={() => deployStrategy(strategy)}
                                disabled={runningStrategies.length >= 5}
                                className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                Run
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center - Strategy Builder */}
          <div className="flex-1 flex flex-col border-r border-white/10">
            {/* Strategy Display Area */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
              <div className="relative w-full h-full max-w-2xl">
                {!strategyReady ? (
                  // Show code being generated
                  <motion.div 
                    className="w-full h-full bg-[#0d0d12] rounded-lg border border-white/10 overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {/* Code Editor Header */}
                    <div className="flex items-center h-8 bg-[#1a1a1f] border-b border-white/10 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                      </div>
                      <span className="ml-4 text-xs text-gray-500">tesla-ema-strategy.ts</span>
                    </div>
                    
                    {/* Code Content */}
                    <div className="p-4 font-mono text-xs overflow-auto h-[calc(100%-2rem)]">
                      {demoPhase >= 2 ? (
                        <pre className="text-gray-300 whitespace-pre-wrap">
                          {typedCode.split('\n').map((line, i) => (
                            <div key={i} className="flex">
                              <span className="text-gray-600 w-8 flex-shrink-0 select-none">{i + 1}</span>
                              <span className={
                                line.startsWith('//') ? 'text-gray-500' :
                                line.includes('import') || line.includes('export') || line.includes('new') ? 'text-purple-400' :
                                line.includes(':') && !line.includes('//') ? 'text-blue-400' :
                                line.includes('=>') ? 'text-yellow-400' :
                                'text-gray-300'
                              }>{line}</span>
                            </div>
                          ))}
                          {demoPhase === 2 && <span className="inline-block w-2 h-4 bg-white animate-pulse ml-0.5" />}
                        </pre>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          {demoPhase === 1 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-[#cc785c] rounded-full animate-pulse" />
                              <span>Claude is analyzing your strategy...</span>
                            </div>
                          ) : (
                            <span>Waiting for strategy prompt...</span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  // Strategy Ready - Show customization panel
                  <motion.div 
                    className="w-full h-full bg-[#0d0d12] rounded-lg border border-emerald-500/30 overflow-hidden"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between h-12 bg-[#1a1a1f] border-b border-white/10 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm font-medium text-white">Strategy Ready</span>
                      </div>
                      <span className="text-xs text-emerald-400">✓ Backtested</span>
                    </div>
                    
                    {/* Strategy Details */}
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">{strategyName}</h3>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-[#151518] rounded-lg p-3 border border-white/5">
                          <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                          <div className="text-lg font-bold text-emerald-400">{strategyStats.winRate}</div>
                        </div>
                        <div className="bg-[#151518] rounded-lg p-3 border border-white/5">
                          <div className="text-xs text-gray-500 mb-1">Profit Factor</div>
                          <div className="text-lg font-bold text-white">{strategyStats.profitFactor}</div>
                        </div>
                        <div className="bg-[#151518] rounded-lg p-3 border border-white/5">
                          <div className="text-xs text-gray-500 mb-1">Total Return</div>
                          <div className="text-lg font-bold text-emerald-400">{strategyStats.totalReturn}</div>
                        </div>
                      </div>
                      
                      {/* Customization Options */}
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Stop Loss</span>
                          <div className="flex items-center gap-2">
                            <input type="range" min="0.5" max="5" step="0.5" defaultValue="1" className="w-24 accent-[#cc785c]" />
                            <span className="text-sm text-white w-12">1.0%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Take Profit</span>
                          <div className="flex items-center gap-2">
                            <input type="range" min="1" max="10" step="0.5" defaultValue="3" className="w-24 accent-[#cc785c]" />
                            <span className="text-sm text-white w-12">3.0%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Position Size</span>
                          <div className="flex items-center gap-2">
                            <input type="range" min="5" max="100" step="5" defaultValue="25" className="w-24 accent-[#cc785c]" />
                            <span className="text-sm text-white w-12">25%</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-4">
                        <button className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5">
                          <Play className="w-3 h-3 stroke-1" />
                          Deploy
                        </button>
                        <button className="text-gray-400 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                          <Folder className="w-3 h-3 stroke-1" />
                          Save
                        </button>
                        <button className="text-gray-400 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                          <Edit3 className="w-3 h-3 stroke-1" />
                          Edit
                        </button>
                        <button className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors flex items-center gap-1.5">
                          <X className="w-3 h-3 stroke-1" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Terminal */}
            <div className="h-[220px] bg-[#0d0d12] border-t border-white/10 flex flex-col">
              {/* Terminal Header */}
              <div className="flex items-center h-9 bg-[#0d0d12] border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 px-4 h-full bg-[#0d0d12] border-r border-white/10 text-xs text-white">
                  <span className="text-emerald-400">●</span>
                  STRATEGIES
                </div>
                <div className="px-4 text-xs text-[#858585] ml-auto">
                  {runningStrategies.length} Active
                </div>
              </div>
              
              {/* Terminal Content */}
              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
                {runningStrategies.length === 0 ? (
                  <div className="text-[#858585] flex items-center gap-2">
                    <span className="text-gray-600">●</span>
                    <span>No strategies running. Deploy from sidebar to start.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {runningStrategies.map((strategy) => {
                      const pnl = strategyPnL[strategy.id] || 0;
                      const isPositive = pnl >= 0;
                      return (
                        <div key={strategy.id} className="flex items-center gap-3 py-1 border-b border-white/5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-gray-300 w-32 truncate">{strategy.name}</span>
                          <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}{pnl.toFixed(2)} USD
                          </span>
                          <span className="text-[#858585] text-[10px]">
                            {Math.floor((Date.now() - strategy.startTime) / 60000)}m running
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <button 
                              onClick={() => pauseStrategy(strategy.id)}
                              className="p-1 text-yellow-400 hover:bg-yellow-400/20 rounded"
                              title="Pause Strategy"
                            >
                              <Pause className="w-3 h-3 stroke-1" />
                            </button>
                            <button 
                              onClick={() => stopStrategy(strategy.id)}
                              className="p-1 text-red-400 hover:bg-red-400/20 rounded"
                              title="Kill Strategy"
                            >
                              <Power className="w-3 h-3 stroke-1" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Total P&L Bar */}
              {runningStrategies.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d12] border-t border-white/10 text-xs">
                  <span className="text-[#858585]">Total P&L:</span>
                  <span className={`font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USD
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Claude Chat */}
          <div className="w-96 border-l border-white/10 flex flex-col bg-[#0d0d12]">
            {/* Chat Tabs */}
            <div className="flex items-center border-b border-white/10">
              <div className="px-4 py-3 text-sm text-[#858585] hover:text-white cursor-pointer border-r border-white/10">
                CHAT
              </div>
              <div className="px-4 py-3 text-sm text-white border-b-2 border-[#cc785c]">
                CLAUDE CODE
              </div>
              <div className="ml-auto flex items-center gap-2 pr-3">
                <button className="p-1.5 text-[#858585] hover:text-white">
                  <Sparkles className="w-4 h-4 stroke-1" />
                </button>
                <button className="p-1.5 text-[#858585] hover:text-white">
                  <X className="w-4 h-4 stroke-1" />
                </button>
              </div>
            </div>

            {/* Past Conversations */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-sm text-white">
                Past Conversations
                <ChevronDown className="w-4 h-4 stroke-1" />
              </div>
              <button className="text-[#858585] hover:text-white">
                <Plus className="w-4 h-4 stroke-1" />
              </button>
            </div>

            {/* Chat Messages - Demo */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* User Message */}
              {typedUserMessage && (
                <motion.div 
                  className="flex justify-end"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="bg-[#1e1e24] rounded-lg p-3 max-w-[85%]">
                    <div className="text-xs text-gray-500 mb-1">You</div>
                    <p className="text-sm text-white">
                      {typedUserMessage}
                      {demoPhase === 0 && <span className="inline-block w-1.5 h-4 bg-white animate-pulse ml-0.5" />}
                    </p>
                  </div>
                </motion.div>
              )}
              
              {/* Claude Response */}
              {demoPhase >= 1 && (
                <motion.div 
                  className="flex justify-start"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="bg-[#151518] border border-white/10 rounded-lg p-3 max-w-[90%]">
                    <div className="flex items-center gap-2 text-xs text-[#cc785c] mb-2">
                      <span>✺</span>
                      <span>Claude</span>
                    </div>
                    {demoPhase === 1 ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-[#cc785c] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-[#cc785c] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-[#cc785c] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span>Generating strategy...</span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-300">
                        <p className="mb-2">I've created a <span className="text-emerald-400">TSLA 8/21 EMA Weekly</span> strategy based on your requirements:</p>
                        <ul className="text-xs text-gray-400 space-y-1 mb-2">
                          <li>• Entry: 8 EMA crosses above 21 EMA</li>
                          <li>• Timeframe: Weekly candles</li>
                          <li>• Stop Loss: 1%</li>
                          <li>• Take Profit: 3%</li>
                        </ul>
                        <p className="text-xs text-gray-500">The strategy is now ready for customization. See the preview panel for backtest results.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Chat Input - Shows typing animation */}
            <div className="p-3 pb-6 border-t border-white/10">
              <div className="bg-[#151518] border border-white/10 rounded-lg p-3">
                <div className="text-sm text-gray-400 min-h-[20px]">
                  {demoPhase === 0 && typedUserMessage.length === 0 ? (
                    <span className="text-[#858585]">Describe your trading strategy...</span>
                  ) : demoPhase === 0 ? (
                    <span className="flex items-center">
                      {typedUserMessage}
                      <span className="inline-block w-1.5 h-4 bg-white animate-pulse ml-0.5" />
                    </span>
                  ) : (
                    <span className="text-[#858585]">Ask Claude to modify the strategy...</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-xs text-[#858585]">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3 h-3 stroke-1" />
                      Auto backtest
                    </span>
                  </div>
                  <button className="w-7 h-7 bg-[#cc785c] rounded-full flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-white stroke-2" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Broker Integrations Bar */}
        <div className="h-12 bg-[#0a0a0f] border-t border-white/10 flex items-center px-8 relative overflow-hidden">
          {/* Connecting lines background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.3)" />
                <stop offset="50%" stopColor="rgba(139, 92, 246, 0.4)" />
                <stop offset="100%" stopColor="rgba(99, 102, 241, 0.3)" />
              </linearGradient>
            </defs>
            <path d="M 0 25 Q 200 15, 400 25 T 800 25 T 1200 25 T 1600 25 T 2000 25" stroke="url(#lineGradient)" strokeWidth="1" fill="none" />
          </svg>
          
          <div className="flex items-center gap-4 relative z-10 w-full">
            <button 
              onClick={() => setBrokerExpanded(!brokerExpanded)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${brokerExpanded ? 'rotate-90' : ''}`} />
              <div className="text-left">
                <div className="text-sm font-medium text-white">Connect Your Broker</div>
                <div className="text-xs text-gray-500">Sync your account for live trading</div>
              </div>
            </button>
            
            {/* Expanded broker icons */}
            <AnimatePresence>
              {brokerExpanded && (
                <motion.div 
                  className="flex items-center gap-8 ml-8"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {[
                    { name: 'TD Ameritrade', label: 'Ameritrade' },
                    { name: 'Interactive Brokers', label: 'InteractiveBrokers' },
                    { name: 'Webull', label: 'Webull' },
                    { name: 'MetaTrader 4', label: 'MetaTrader 4' },
                    { name: 'Tradovate', label: 'tradovate' },
                  ].map((broker, i) => (
                    <div 
                      key={broker.name}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      title={broker.name}
                    >
                      <svg className="w-6 h-6" viewBox="0 0 40 40" fill="none" stroke="#6366F1" strokeWidth="1">
                        {i === 0 && (
                          <>
                            <rect x="8" y="6" width="20" height="26" rx="2" />
                            <line x1="12" y1="12" x2="24" y2="12" />
                            <line x1="12" y1="17" x2="24" y2="17" />
                            <line x1="12" y1="22" x2="20" y2="22" />
                          </>
                        )}
                        {i === 1 && (
                          <>
                            <rect x="6" y="8" width="28" height="24" rx="2" />
                            <line x1="6" y1="14" x2="34" y2="14" />
                            <polyline points="12,26 18,20 24,24 30,18" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        )}
                        {i === 2 && (
                          <>
                            <path d="M8 16C8 12 12 8 20 8C26 8 30 11 31 14" strokeLinecap="round" />
                            <path d="M32 24C32 28 28 32 20 32C14 32 10 29 9 26" strokeLinecap="round" />
                            <polyline points="28,14 32,14 32,10" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="12,26 8,26 8,30" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        )}
                        {i === 3 && (
                          <>
                            <rect x="6" y="8" width="28" height="24" rx="2" />
                            <line x1="6" y1="14" x2="34" y2="14" />
                            <line x1="10" y1="28" x2="10" y2="20" strokeLinecap="round" />
                            <line x1="16" y1="28" x2="16" y2="18" strokeLinecap="round" />
                            <line x1="22" y1="28" x2="22" y2="22" strokeLinecap="round" />
                            <line x1="28" y1="28" x2="28" y2="17" strokeLinecap="round" />
                          </>
                        )}
                        {i === 4 && (
                          <>
                            <rect x="6" y="8" width="28" height="24" rx="2" />
                            <line x1="6" y1="14" x2="34" y2="14" />
                            <polyline points="10,24 16,20 22,26 30,18" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        )}
                      </svg>
                      <span className="text-xs font-medium text-white">{broker.label}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STRATEGY SCANNER PAGE (Dovetail Style)
// ============================================

const StrategyScannerPage = ({ setCurrentPage }) => {
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [priceData, setPriceData] = useState([]);
  
  const strategies = [
    { 
      name: 'Momentum Breakout', 
      status: 'Active', 
      returns: '+232.23%',
      score: '1.17x',
      assets: 45 
    },
    { 
      name: 'VWAP Scalper', 
      status: 'Paused', 
      returns: '+156.78%',
      score: '0.94x',
      assets: 28 
    },
    { 
      name: 'Crypto Mean Reversion', 
      status: 'Active', 
      returns: '+312.45%',
      score: '1.42x',
      assets: 12 
    },
  ];

  const metrics = [
    { label: 'Historical Returns', value: 78, color: '#10b981' },
    { label: 'Risk Score', value: 42, color: '#10b981' },
    { label: 'Win Rate', value: 67, color: '#f59e0b' },
    { label: 'Sharpe Ratio', value: 31, color: '#ef4444' },
  ];

  // Generate chart data
  useEffect(() => {
    const generateData = () => {
      let base = 100;
      const data = [];
      for (let i = 0; i < 50; i++) {
        base += (Math.random() - 0.45) * 5;
        data.push(base);
      }
      setPriceData(data);
    };
    generateData();
    const interval = setInterval(generateData, 3000);
    return () => clearInterval(interval);
  }, []);

  const generateChartPath = () => {
    if (priceData.length === 0) return { line: '', area: '' };
    const width = 400, height = 200, padding = 20;
    const minPrice = Math.min(...priceData) - 5;
    const maxPrice = Math.max(...priceData) + 5;
    
    const points = priceData.map((price, i) => {
      const x = padding + (i / (priceData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((price - minPrice) / (maxPrice - minPrice)) * (height - padding * 2);
      return { x, y };
    });
    
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;
    return { line: linePath, area: areaPath };
  };

  const chartPaths = generateChartPath();

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white overflow-hidden">
      {/* Grid Background */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <button 
          onClick={() => setCurrentPage('landing')}
          className="flex items-center gap-3"
        >
          <span className="text-lg font-semibold">Stratify</span>
        </button>
        
        <div className="flex items-center gap-8">
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Product</a>
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Resources</a>
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Enterprise</a>
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Customers</a>
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Log In</a>
          <button className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            Contact sales
          </button>
        </div>
      </nav>

      {/* Main Content - 3 Column Layout */}
      <div className="relative z-10 flex h-[calc(100vh-73px)]">
        
        {/* Left Sidebar - Strategy Cards */}
        <div className="w-72 p-6 border-r border-white/5 overflow-y-auto">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
            Active Strategies
          </div>
          
          <div className="space-y-3">
            {strategies.map((strategy, index) => (
              <motion.div
                key={index}
                onClick={() => setSelectedStrategy(index)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedStrategy === index 
                    ? 'bg-white/5 border-emerald-500/50' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{strategy.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    strategy.status === 'Active' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {strategy.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Returns</div>
                    <div className="text-xs font-medium text-emerald-400">{strategy.returns}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Score</div>
                    <div className="text-xs font-medium">{strategy.score}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Assets</div>
                    <div className="text-xs font-medium">{strategy.assets}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
              Performance
            </div>
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="text-[10px] text-gray-500 uppercase mb-1">Total P&L</div>
              <div className="text-2xl font-bold text-emerald-400">+$24,847</div>
              <div className="text-xs text-gray-500 mt-1">+18.4% this month</div>
            </div>
          </div>
        </div>

        {/* Center - Globe/Chart Visualization */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider absolute top-6 left-1/2 -translate-x-1/2">
            Portfolio Performance
          </div>
          
          {/* Globe Visualization */}
          <div className="relative">
            <svg width="400" height="400" className="opacity-90">
              {/* Outer rings */}
              <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <circle cx="200" cy="200" r="100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <circle cx="200" cy="200" r="60" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
              
              {/* Dotted orbit paths */}
              <circle cx="200" cy="200" r="120" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
              
              {/* Data points - animated */}
              <motion.circle 
                cx="200" cy="80" r="6" fill="#10b981"
                animate={{ 
                  cx: [200, 280, 200, 120, 200],
                  cy: [80, 200, 320, 200, 80]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.circle 
                cx="320" cy="200" r="8" fill="#f59e0b"
                animate={{ 
                  cx: [320, 200, 80, 200, 320],
                  cy: [200, 80, 200, 320, 200]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
              <motion.circle 
                cx="140" cy="260" r="5" fill="#3b82f6"
                animate={{ 
                  cx: [140, 260, 260, 140, 140],
                  cy: [260, 260, 140, 140, 260]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              <motion.circle 
                cx="260" cy="140" r="4" fill="#8b5cf6"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.circle 
                cx="160" cy="160" r="6" fill="#ef4444"
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              
              {/* Center glow */}
              <circle cx="200" cy="200" r="20" fill="rgba(16,185,129,0.2)" />
              <circle cx="200" cy="200" r="10" fill="rgba(16,185,129,0.4)" />
            </svg>
          </div>
        </div>

        {/* Right Sidebar - Metrics */}
        <div className="w-72 p-6 border-l border-white/5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
            Strategy Metrics
          </div>
          
          <div className="space-y-4">
            {metrics.map((metric, index) => (
              <div key={index} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">{metric.label}</span>
                  <span className="text-lg font-bold">{metric.value}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full rounded-full"
                    style={{ backgroundColor: metric.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            <button 
              onClick={() => setCurrentPage('stratify-scanner')}
              className="w-full py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Open Strategy Editor
            </button>
            <button className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
              Export Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// VS CODE IDE STRATEGY EDITOR PAGE
// ============================================

// ============================================
// VS CODE IDE STRATEGY EDITOR PAGE
// ============================================

// ============================================
// STRATIFY SCANNER PAGE (VS Code Clone - Page 3)
// ============================================

const StratifyScanner = ({ setCurrentPage }) => {
  const [activeTab, setActiveTab] = useState('momentum_breakout.py');
  const [collapsedFolders, setCollapsedFolders] = useState({ saved: false, active: false, templates: true });
  const [isRecording, setIsRecording] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [currentLine, setCurrentLine] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [priceData, setPriceData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(475.32);
  const [unrealizedPnl, setUnrealizedPnl] = useState(842.30);

  // Strategy data
  const strategies = {
    saved: [
      { name: 'momentum_breakout.py', active: true },
      { name: 'mean_reversion.py', active: false },
      { name: 'vwap_scalper.py', active: false },
    ],
    active: [
      { name: 'momentum_breakout.py', status: 'running' },
      { name: 'vwap_scalper.py', status: 'running' },
    ],
    templates: [
      { name: 'mean_reversion_template.py' },
      { name: 'breakout_template.py' },
      { name: 'scalping_template.py' },
    ]
  };

  // Code content with syntax highlighting
  const strategyCode = [
    { text: '# Momentum Breakout Strategy', className: 'text-[#6a6a6a] italic' },
    { text: '# Generated by STRATIFY AI', className: 'text-[#6a6a6a] italic' },
    { text: '', className: '' },
    { parts: [{ text: 'from', className: 'text-[#c586c0]' }, { text: ' stratify ', className: 'text-[#cccccc]' }, { text: 'import', className: 'text-[#c586c0]' }, { text: ' Strategy, Signal', className: 'text-[#cccccc]' }] },
    { parts: [{ text: 'from', className: 'text-[#c586c0]' }, { text: ' indicators ', className: 'text-[#cccccc]' }, { text: 'import', className: 'text-[#c586c0]' }, { text: ' RSI, VWAP, Volume', className: 'text-[#cccccc]' }] },
    { text: '', className: '' },
    { parts: [{ text: 'class', className: 'text-[#c586c0]' }, { text: ' ', className: '' }, { text: 'MomentumBreakout', className: 'text-[#dcdcaa]' }, { text: '(Strategy):', className: 'text-[#cccccc]' }] },
    { text: '    """Breakout strategy with volume confirmation"""', className: 'text-[#ce9178]' },
    { text: '', className: '' },
    { parts: [{ text: '    ', className: '' }, { text: 'def', className: 'text-[#c586c0]' }, { text: ' ', className: '' }, { text: 'setup', className: 'text-[#dcdcaa]' }, { text: '(self):', className: 'text-[#cccccc]' }] },
    { parts: [{ text: '        self.rsi_period = ', className: 'text-[#cccccc]' }, { text: '14', className: 'text-[#4ec9b0]' }] },
    { parts: [{ text: '        self.volume_threshold = ', className: 'text-[#cccccc]' }, { text: '1.5', className: 'text-[#4ec9b0]' }] },
    { parts: [{ text: '        self.risk_per_trade = ', className: 'text-[#cccccc]' }, { text: '0.02', className: 'text-[#4ec9b0]' }] },
    { text: '', className: '' },
    { parts: [{ text: '    ', className: '' }, { text: 'def', className: 'text-[#c586c0]' }, { text: ' ', className: '' }, { text: 'on_bar', className: 'text-[#dcdcaa]' }, { text: '(self, bar):', className: 'text-[#cccccc]' }] },
    { text: '        rsi = RSI(bar.close, self.rsi_period)', className: 'text-[#cccccc]' },
    { text: '        vol_ratio = bar.volume / bar.avg_volume', className: 'text-[#cccccc]' },
    { text: '', className: '' },
    { text: '        # Buy signal: RSI crosses 30 with volume', className: 'text-[#6a6a6a] italic' },
    { parts: [{ text: '        ', className: '' }, { text: 'if', className: 'text-[#c586c0]' }, { text: ' rsi.crossed_above(', className: 'text-[#cccccc]' }, { text: '30', className: 'text-[#4ec9b0]' }, { text: '):', className: 'text-[#cccccc]' }] },
  ];

  // Typing animation
  useEffect(() => {
    if (isTyping && currentLine < strategyCode.length - 1) {
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
      }, 150 + Math.random() * 200);
      return () => clearTimeout(timer);
    }
  }, [currentLine, isTyping, strategyCode.length]);

  // Generate price data
  useEffect(() => {
    const generateData = () => {
      let base = 475;
      const data = [];
      for (let i = 0; i < 50; i++) {
        base += (Math.random() - 0.48) * 2;
        data.push(base);
      }
      setPriceData(data);
      setCurrentPrice(base);
    };
    generateData();
    const interval = setInterval(generateData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update P&L
  useEffect(() => {
    const interval = setInterval(() => {
      setUnrealizedPnl(prev => prev + (Math.random() - 0.5) * 30);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const toggleFolder = (folder) => {
    setCollapsedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const renderCodeLine = (line, index) => {
    if (index > currentLine) return null;
    const isCursorLine = index === currentLine && isTyping;
    
    if (line.parts) {
      return (
        <div key={index} className={`whitespace-pre ${isCursorLine ? 'bg-[#37373d] -mx-4 px-4' : ''}`}>
          {line.parts.map((part, i) => (
            <span key={i} className={part.className}>{part.text}</span>
          ))}
          {isCursorLine && <span className="inline-block w-0.5 h-[18px] bg-[#cccccc] animate-pulse ml-0.5" />}
        </div>
      );
    }
    return (
      <div key={index} className={`whitespace-pre ${line.className} ${isCursorLine ? 'bg-[#37373d] -mx-4 px-4' : ''}`}>
        {line.text}
        {isCursorLine && <span className="inline-block w-0.5 h-[18px] bg-[#cccccc] animate-pulse ml-0.5" />}
      </div>
    );
  };

  const generateChartPath = () => {
    if (priceData.length === 0) return { line: '', area: '', dot: { x: 0, y: 0 } };
    const width = 280, height = 180, padding = 10;
    const minPrice = Math.min(...priceData) - 2;
    const maxPrice = Math.max(...priceData) + 2;
    
    const points = priceData.map((price, i) => {
      const x = padding + (i / (priceData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((price - minPrice) / (maxPrice - minPrice)) * (height - padding * 2);
      return { x, y };
    });
    
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;
    return { line: linePath, area: areaPath, dot: points[points.length - 1] || { x: 0, y: 0 } };
  };

  const chartPaths = generateChartPath();
  const totalPnl = unrealizedPnl + 405.20;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ fontFamily: "'JetBrains Mono', monospace", background: '#1e1e1e', color: '#cccccc' }}>
      {/* Title Bar */}
      <div className="h-8 bg-[#323233] border-b border-[#3c3c3c] flex items-center px-4 text-[13px] font-medium flex-shrink-0">
        <span className="text-white">STRATIFY — AI Strategy Scanner</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="w-10 h-8 flex items-center justify-center text-[#858585] hover:text-white">
            <Minus className="w-4 h-4" />
          </button>
          <button className="w-10 h-8 flex items-center justify-center text-[#858585] hover:text-white">
            <Square className="w-4 h-4" />
          </button>
          <button className="w-10 h-8 flex items-center justify-center text-[#858585] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-[#333333] flex flex-col items-center pt-1 border-r border-[#3c3c3c] flex-shrink-0">
          <button 
            className="w-12 h-12 flex items-center justify-center text-white relative"
            title="Explorer"
          >
            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-white" />
            <File className="w-6 h-6 stroke-1" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white" title="Search">
            <Search className="w-6 h-6 stroke-1" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white relative" title="Source Control">
            <GitBranch className="w-6 h-6 stroke-1" />
            <span className="absolute top-2 right-2 w-4 h-4 bg-[#007acc] rounded-full text-[10px] flex items-center justify-center text-white font-medium">16</span>
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white" title="Run and Debug">
            <Bug className="w-6 h-6 stroke-1" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white" title="Extensions">
            <Blocks className="w-6 h-6 stroke-1" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white relative" title="Database">
            <Database className="w-6 h-6 stroke-1" />
            <span className="absolute top-2 right-2 w-4 h-4 bg-[#007acc] rounded-full text-[10px] flex items-center justify-center text-white font-medium">1</span>
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white" title="Docker">
            <Container className="w-6 h-6 stroke-1" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white" title="Azure">
            <Zap className="w-6 h-6 stroke-1" />
          </button>
          <div className="flex-1" />
          <button className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white" title="Git">
            <GitBranch className="w-6 h-6 stroke-1" />
          </button>
          <button 
            onClick={() => setCurrentPage('scanner')}
            className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white mb-2" 
            title="Back to Dashboard"
          >
            <Settings className="w-6 h-6 stroke-1" />
          </button>
        </div>

        {/* Sidebar */}
        <div className="w-[220px] bg-[#252526] border-r border-[#3c3c3c] flex flex-col flex-shrink-0">
          <div className="h-[35px] flex items-center px-3 text-[11px] font-semibold uppercase tracking-wider text-[#858585] border-b border-[#3c3c3c]">
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* My Strategies Folder */}
            <div 
              className="flex items-center py-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#858585] cursor-pointer hover:bg-[#2a2d2e]"
              onClick={() => toggleFolder('saved')}
            >
              <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${collapsedFolders.saved ? '-rotate-90' : ''}`} />
              My Strategies
            </div>
            {!collapsedFolders.saved && strategies.saved.map((s, i) => (
              <div 
                key={i} 
                className={`flex items-center py-1 px-2 pl-7 text-[13px] cursor-pointer ${s.active ? 'bg-[#37373d]' : 'hover:bg-[#2a2d2e]'}`}
                onClick={() => setActiveTab(s.name)}
              >
                <File className="w-4 h-4 mr-1.5 text-[#dcdcaa]" />
                {s.name}
              </div>
            ))}

            {/* Active Strategies Folder */}
            <div 
              className="flex items-center py-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#858585] cursor-pointer hover:bg-[#2a2d2e]"
              onClick={() => toggleFolder('active')}
            >
              <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${collapsedFolders.active ? '-rotate-90' : ''}`} />
              Active Strategies
            </div>
            {!collapsedFolders.active && strategies.active.map((s, i) => (
              <div key={i} className="flex items-center py-1 px-2 pl-7 text-[13px] cursor-pointer hover:bg-[#2a2d2e]">
                <File className="w-4 h-4 mr-1.5 text-[#dcdcaa]" />
                {s.name}
                <span className={`ml-auto w-2 h-2 rounded-full ${s.status === 'running' ? 'bg-[#4ade80] shadow-[0_0_6px_#4ade80] animate-pulse' : 'bg-[#ce9178]'}`} />
              </div>
            ))}

            {/* Templates Folder */}
            <div 
              className="flex items-center py-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#858585] cursor-pointer hover:bg-[#2a2d2e]"
              onClick={() => toggleFolder('templates')}
            >
              <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${collapsedFolders.templates ? '-rotate-90' : ''}`} />
              Templates
            </div>
            {!collapsedFolders.templates && strategies.templates.map((s, i) => (
              <div key={i} className="flex items-center py-1 px-2 pl-7 text-[13px] cursor-pointer hover:bg-[#2a2d2e]">
                <File className="w-4 h-4 mr-1.5 text-[#dcdcaa]" />
                {s.name}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Title Bar */}
          <div className="h-[30px] bg-[#2d2d30] flex items-center justify-center text-[12px] text-[#858585] border-b border-[#3c3c3c] flex-shrink-0">
            <span className="text-[#4ec9b0] font-semibold">STRATIFY</span> — AI Strategy Scanner
          </div>

          {/* Tabs */}
          <div className="h-[35px] bg-[#2d2d30] flex items-end border-b border-[#3c3c3c] flex-shrink-0">
            <div className={`h-[35px] px-4 flex items-center bg-[#1e1e1e] border-r border-[#3c3c3c] text-[13px] cursor-pointer border-t border-t-[#007acc] -mt-px`}>
              <File className="w-3.5 h-3.5 mr-1.5 text-[#dcdcaa]" />
              momentum_breakout.py
              <span className="ml-2 opacity-0 hover:opacity-100">×</span>
            </div>
            <div className="h-[35px] px-4 flex items-center bg-[#252526] border-r border-[#3c3c3c] text-[13px] text-[#858585] cursor-pointer">
              <File className="w-3.5 h-3.5 mr-1.5 text-[#dcdcaa]" />
              vwap_scalper.py
              <span className="ml-2 opacity-0 hover:opacity-100">×</span>
            </div>
          </div>

          {/* Editor Layout */}
          <div className="flex-1 flex min-h-0">
            {/* Chart Panel */}
            <div className="w-[320px] bg-[#1e1e1e] border-r border-[#3c3c3c] flex flex-col flex-shrink-0">
              <div className="h-7 flex items-center px-3 bg-[#252526] border-b border-[#3c3c3c] text-[11px] font-semibold uppercase tracking-wider text-[#858585]">
                Live Chart
                <span className="ml-auto text-[#4ade80] font-mono">SPY +1.23%</span>
              </div>
              <div className="flex-1 p-4 relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 280 180" preserveAspectRatio="none">
                  <defs>
                    <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#2d2d30" strokeWidth="0.5"/>
                    </pattern>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)"/>
                  <path d={chartPaths.area} fill="url(#chartGradient)"/>
                  <motion.path 
                    d={chartPaths.line} 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="2"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1 }}
                  />
                  <motion.circle 
                    cx={chartPaths.dot.x} 
                    cy={chartPaths.dot.y} 
                    r="4" 
                    fill="#3b82f6"
                    animate={{ r: [4, 6, 4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </svg>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#007acc] text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">
                  ${currentPrice.toFixed(2)}
                </div>
              </div>
              <div className="flex justify-between px-2 py-1 text-[9px] text-[#6a6a6a] font-mono">
                <span>9:30</span><span>11:00</span><span>12:30</span><span>14:00</span><span>15:30</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#252526] border-t border-[#3c3c3c]">
                <div className="p-2 bg-[#2d2d30] rounded">
                  <div className="text-[9px] text-[#6a6a6a] uppercase tracking-wider mb-0.5">Day P&L</div>
                  <div className={`text-[14px] font-mono font-semibold ${totalPnl >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                  </div>
                </div>
                <div className="p-2 bg-[#2d2d30] rounded">
                  <div className="text-[9px] text-[#6a6a6a] uppercase tracking-wider mb-0.5">Win Rate</div>
                  <div className="text-[14px] font-mono font-semibold">67.3%</div>
                </div>
                <div className="p-2 bg-[#2d2d30] rounded">
                  <div className="text-[9px] text-[#6a6a6a] uppercase tracking-wider mb-0.5">Open Positions</div>
                  <div className="text-[14px] font-mono font-semibold">3</div>
                </div>
                <div className="p-2 bg-[#2d2d30] rounded">
                  <div className="text-[9px] text-[#6a6a6a] uppercase tracking-wider mb-0.5">Trades Today</div>
                  <div className="text-[14px] font-mono font-semibold">12</div>
                </div>
              </div>
            </div>

            {/* Editor Panel */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-[22px] flex items-center px-3 bg-[#1e1e1e] border-b border-[#3c3c3c] text-[12px] text-[#858585]">
                strategies <span className="mx-1.5">›</span> momentum_breakout.py
              </div>
              <div className="flex-1 flex overflow-hidden">
                {/* Line Numbers */}
                <div className="w-[50px] bg-[#1e1e1e] py-3 text-right font-mono text-[13px] leading-[1.6] text-[#6a6a6a] select-none flex-shrink-0">
                  {strategyCode.map((_, i) => (
                    <div key={i} className="pr-4">{i + 1}</div>
                  ))}
                </div>
                {/* Code Content */}
                <div className="flex-1 py-3 px-4 overflow-auto font-mono text-[13px] leading-[1.6]">
                  {strategyCode.map((line, i) => renderCodeLine(line, i))}
                </div>
                {/* Minimap */}
                <div className="w-[60px] bg-[#252526] opacity-70 flex-shrink-0" />
              </div>

              {/* Chat Input Area */}
              <div className="border-t border-[#3c3c3c] bg-[#252526] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6a6a6a] mb-2">
                  <Brain className="w-3.5 h-3.5 text-[#4ec9b0]" />
                  Describe your strategy — AI will code it
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="e.g., Buy when RSI crosses above 30 with volume spike..."
                    className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3.5 py-2.5 text-[13px] text-[#cccccc] placeholder-[#6a6a6a] outline-none focus:border-[#007acc] transition-colors"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && chatInput.trim()) {
                        setCurrentLine(0);
                        setIsTyping(true);
                        setChatInput('');
                      }
                    }}
                  />
                  <button 
                    onClick={() => setIsRecording(!isRecording)}
                    className={`w-10 h-10 rounded flex items-center justify-center transition-all ${isRecording ? 'bg-[#f87171] text-white animate-pulse' : 'bg-[#2d2d30] text-[#858585] hover:text-white hover:bg-[#37373d]'}`}
                    title="Voice input"
                  >
                    <Mic className="w-[18px] h-[18px]" />
                  </button>
                  <button 
                    className="w-10 h-10 bg-[#007acc] rounded flex items-center justify-center text-white hover:bg-[#0088e0] transition-colors"
                    title="Generate strategy"
                  >
                    <Send className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Terminal / P&L Panel */}
          <div className="h-[140px] bg-[#1e1e1e] border-t border-[#3c3c3c] flex flex-col flex-shrink-0">
            <div className="h-7 flex bg-[#252526] border-b border-[#3c3c3c]">
              <div className="px-4 flex items-center text-[11px] uppercase tracking-wide text-white bg-[#1e1e1e] border-r border-[#3c3c3c]">
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                P&L
              </div>
              <div className="px-4 flex items-center text-[11px] uppercase tracking-wide text-[#858585] border-r border-[#3c3c3c] cursor-pointer hover:text-white">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Orders
              </div>
              <div className="px-4 flex items-center text-[11px] uppercase tracking-wide text-[#858585] border-r border-[#3c3c3c] cursor-pointer hover:text-white">
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                History
              </div>
            </div>
            <div className="flex-1 flex gap-8 px-4 py-3 overflow-x-auto">
              <div className="flex flex-col gap-1">
                <div className="text-[9px] uppercase tracking-wider text-[#6a6a6a]">Unrealized P&L</div>
                <div className={`font-mono text-[18px] font-bold ${unrealizedPnl >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                </div>
                <div className="font-mono text-[11px] text-[#858585]">3 pending orders</div>
              </div>
              <div className="w-px bg-[#3c3c3c]" />
              <div className="flex flex-col gap-1">
                <div className="text-[9px] uppercase tracking-wider text-[#6a6a6a]">Realized P&L</div>
                <div className="font-mono text-[18px] font-bold text-[#4ade80]">+$405.20</div>
                <div className="font-mono text-[11px] text-[#858585]">9 closed today</div>
              </div>
              <div className="w-px bg-[#3c3c3c]" />
              <div className="flex flex-col gap-1">
                <div className="text-[9px] uppercase tracking-wider text-[#6a6a6a]">Total Balance</div>
                <div className="font-mono text-[18px] font-bold">$52,847.50</div>
                <div className="font-mono text-[11px] text-[#858585]">Win: 8 / Loss: 4</div>
              </div>
              <div className="w-px bg-[#3c3c3c]" />
              <div className="flex gap-4 flex-1">
                {positions.map((pos, i) => (
                  <div key={i} className="bg-[#252526] rounded px-3 py-2 min-w-[140px]">
                    <div className="text-[12px] font-semibold mb-0.5">{pos.symbol}</div>
                    <div className="text-[10px] text-[#6a6a6a]">{pos.shares} shares @ ${pos.entry.toFixed(2)}</div>
                    <div className={`font-mono text-[13px] font-semibold mt-1 ${pos.positive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                      {pos.positive ? '+' : ''}${pos.pnl.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-[22px] bg-[#007acc] flex items-center px-3 text-[11px] text-white flex-shrink-0">
        <div className="flex items-center gap-1 mr-4">
          <div className="w-3 h-3 rounded-full bg-white flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#007acc]" />
          </div>
          main
        </div>
        <div className="flex items-center gap-1 mr-4">
          <BarChart3 className="w-3.5 h-3.5" />
          Python 3.11
        </div>
        <div className="mr-4">UTF-8</div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
          Market Open — Live Trading
        </div>
      </div>
    </div>
  );
};

function App() {
  const [currentPage, setCurrentPage] = useState('landing');

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <NewLandingPage onEnter={() => setCurrentPage('dashboard')} />;
      case 'dashboard':
        return <LandingPage onEnter={() => setCurrentPage('scanner')} />;
      case 'scanner':
        return <StrategyScannerPage setCurrentPage={setCurrentPage} />;
      case 'stratify-scanner':
        return <StratifyScanner setCurrentPage={setCurrentPage} />;
      default:
        return <NewLandingPage onEnter={() => setCurrentPage('dashboard')} />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderPage()}
      </motion.div>
    </AnimatePresence>
  );
}

export default App;
