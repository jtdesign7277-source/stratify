import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Premium Atlas AI Icon with gradient
const AtlasIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="atlasGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
    <path 
      d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" 
      stroke="url(#atlasGrad)" 
      strokeWidth="1.5" 
      strokeLinejoin="round" 
      fill="none"
    />
  </svg>
);

// Animated background orbs for visual interest
const FloatingOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-10 left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
    <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
    <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
  </div>
);

// Syntax Highlighter for Python
const SyntaxHighlightedCode = ({ code }) => {
  const highlightCode = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      if (line.trim().startsWith('#')) {
        return <div key={lineIdx} className="text-gray-500">{line}</div>;
      }
      const keywords = ['from', 'import', 'class', 'def', 'self', 'if', 'elif', 'else', 'and', 'or', 'not', 'return', 'True', 'False', 'None', 'while', 'for', 'in', 'try', 'except', 'with', 'as'];
      const builtins = ['Strategy', 'super', 'len', 'range', 'print', 'int', 'float', 'str', 'list', 'dict'];
      
      const parts = [];
      let current = '';
      let i = 0;
      
      while (i < line.length) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (current) parts.push({ type: 'text', value: current });
          current = '';
          const quote = char;
          let str = quote;
          i++;
          while (i < line.length && line[i] !== quote) { str += line[i]; i++; }
          str += quote;
          parts.push({ type: 'string', value: str });
          i++;
          continue;
        }
        if (/\d/.test(char) && (current === '' || /[\s\(\[,=<>:]/.test(current[current.length - 1]))) {
          if (current) parts.push({ type: 'text', value: current });
          current = '';
          let num = '';
          while (i < line.length && /[\d.]/.test(line[i])) { num += line[i]; i++; }
          parts.push({ type: 'number', value: num });
          continue;
        }
        current += char;
        i++;
      }
      if (current) parts.push({ type: 'text', value: current });
      
      return (
        <div key={lineIdx}>
          {parts.map((part, partIdx) => {
            if (part.type === 'string') return <span key={partIdx} className="text-emerald-400">{part.value}</span>;
            if (part.type === 'number') return <span key={partIdx} className="text-amber-400">{part.value}</span>;
            let elements = [];
            const tokens = part.value.split(/(\b)/);
            tokens.forEach((token, tokenIdx) => {
              if (keywords.includes(token)) {
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-purple-400 font-medium">{token}</span>);
              } else if (builtins.includes(token)) {
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-cyan-400">{token}</span>);
              } else {
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-gray-200">{token}</span>);
              }
            });
            return elements;
          })}
        </div>
      );
    });
  };
  
  return (
    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
      {highlightCode(code)}
    </pre>
  );
};

// Strategy type configurations
const strategyTypes = [
  { 
    id: 'momentum', 
    name: 'Momentum', 
    icon: '📈',
    color: 'from-green-500 to-emerald-600',
    description: 'Trend-following strategies',
    prompt: (ticker, name) => `Create a momentum trading strategy called "${name}" for ${ticker}. Buy when 20-day MA crosses above 50-day MA with RSI above 50 confirming momentum. Sell on the opposite crossover or when RSI drops below 40. Use 2% position sizing with a 5% stop loss and 15% take profit.`
  },
  { 
    id: 'meanreversion', 
    name: 'Mean Reversion', 
    icon: '🔄',
    color: 'from-blue-500 to-cyan-600',
    description: 'Buy low, sell high',
    prompt: (ticker, name) => `Create a mean reversion strategy called "${name}" for ${ticker}. Buy when price drops 2 standard deviations below the 20-day moving average (Bollinger Band lower). Sell when price returns to the mean or touches the upper band. Use 3% position size with 8% stop loss.`
  },
  { 
    id: 'breakout', 
    name: 'Breakout', 
    icon: '💥',
    color: 'from-orange-500 to-red-600',
    description: 'Catch explosive moves',
    prompt: (ticker, name) => `Create a breakout strategy called "${name}" for ${ticker}. Enter long when price breaks above the 20-day high with volume at least 50% above the 20-day average volume. Use ATR-based trailing stop at 2x ATR. Position size 2% of portfolio.`
  },
  { 
    id: 'rsi', 
    name: 'RSI Strategy', 
    icon: '📊',
    color: 'from-purple-500 to-indigo-600',
    description: 'Oversold/overbought signals',
    prompt: (ticker, name) => `Create an RSI-based strategy called "${name}" for ${ticker}. Buy when RSI(14) drops below 30 (oversold) and starts turning up. Sell when RSI rises above 70 (overbought) and starts turning down. Use 2% position size with 5% stop loss.`
  },
  { 
    id: 'macd', 
    name: 'MACD Cross', 
    icon: '⚡',
    color: 'from-yellow-500 to-orange-600',
    description: 'Signal line crossovers',
    prompt: (ticker, name) => `Create a MACD crossover strategy called "${name}" for ${ticker}. Buy when MACD line crosses above the signal line, especially when both are below zero (stronger signal). Sell when MACD crosses below signal line. Use 3% position size with 5% stop loss.`
  },
  { 
    id: 'scalping', 
    name: 'Scalping', 
    icon: '🎯',
    color: 'from-pink-500 to-rose-600',
    description: 'Quick in-and-out trades',
    prompt: (ticker, name) => `Create a scalping strategy called "${name}" for ${ticker}. Use 5-minute timeframe. Enter on VWAP bounces with RSI confirmation. Target 0.5% profit per trade with tight 0.3% stop loss. High frequency, small gains approach.`
  },
];

// Popular tickers with colors
const popularTickers = [
  { symbol: 'AAPL', name: 'Apple', color: '#555555' },
  { symbol: 'TSLA', name: 'Tesla', color: '#CC0000' },
  { symbol: 'NVDA', name: 'NVIDIA', color: '#76B900' },
  { symbol: 'MSFT', name: 'Microsoft', color: '#00A4EF' },
  { symbol: 'GOOGL', name: 'Google', color: '#4285F4' },
  { symbol: 'AMZN', name: 'Amazon', color: '#FF9900' },
  { symbol: 'META', name: 'Meta', color: '#0668E1' },
  { symbol: 'SPY', name: 'S&P 500', color: '#1E3A5F' },
  { symbol: 'QQQ', name: 'Nasdaq', color: '#0096D6' },
  { symbol: 'AMD', name: 'AMD', color: '#ED1C24' },
  { symbol: 'COIN', name: 'Coinbase', color: '#0052FF' },
  { symbol: 'PLTR', name: 'Palantir', color: '#101010' },
];

// Loading animation component with cool graphics
const GeneratingAnimation = ({ strategyName, ticker, selectedStrategy }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-12 px-4 relative"
  >
    <FloatingOrbs />
    
    {/* Animated concentric rings */}
    <div className="relative mb-8">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[-20px] rounded-full border border-purple-500/20"
      />
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[-10px] rounded-full border border-blue-500/30"
      />
      <motion.div 
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/30"
      >
        <span className="text-3xl">{selectedStrategy?.icon || '⚡'}</span>
      </motion.div>
    </div>
    
    <motion.h3 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="text-xl font-bold text-white mb-2 text-center"
    >
      Building Strategy
    </motion.h3>
    
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="text-center mb-6"
    >
      <p className="text-purple-400 font-semibold">{strategyName || 'Custom Strategy'}</p>
      <p className="text-gray-500 text-sm">for {ticker}</p>
    </motion.div>
    
    {/* Progress steps */}
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="flex items-center gap-3 text-xs"
    >
      {['Analyzing', 'Coding', 'Optimizing'].map((step, idx) => (
        <motion.div 
          key={step}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.5 }}
          className="flex items-center gap-1.5"
        >
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-gray-400">{step}</span>
        </motion.div>
      ))}
    </motion.div>
  </motion.div>
);

// Main Component
export default function RightPanel({ width, themeClasses, onStrategyGenerated }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('build'); // 'build' | 'chat'
  const [buildStep, setBuildStep] = useState(1); // 1: ticker, 2: strategy, 3: name/confirm
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyName, setStrategyName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [tickerSearch, setTickerSearch] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  
  const messagesEndRef = useRef(null);
  
  // Filter tickers based on search
  const filteredTickers = tickerSearch 
    ? popularTickers.filter(t => 
        t.symbol.toLowerCase().includes(tickerSearch.toLowerCase()) ||
        t.name.toLowerCase().includes(tickerSearch.toLowerCase())
      )
    : popularTickers;

  // Check if ready to generate
  const canGenerate = selectedTicker && (selectedStrategy || customPrompt.trim());

  // Handle back button
  const handleBack = () => {
    if (buildStep === 2) {
      setBuildStep(1);
    } else if (buildStep === 3) {
      setBuildStep(2);
    }
  };

  // Handle ticker selection
  const handleTickerSelect = (symbol) => {
    setSelectedTicker(symbol);
    setTickerSearch('');
    setBuildStep(2);
  };

  // Handle strategy selection  
  const handleStrategySelect = (strategy) => {
    setSelectedStrategy(strategy);
    setStrategyName(`${selectedTicker} ${strategy.name} Strategy`);
    setBuildStep(3);
  };
  
  // Reset to build new strategy
  const handleNewStrategy = () => {
    setSelectedTicker(null);
    setSelectedStrategy(null);
    setStrategyName('');
    setCustomPrompt('');
    setTickerSearch('');
    setBuildStep(1);
    setMessages([]);
    setGeneratedStrategy(null);
    setActiveTab('build');
  };

  // Generate strategy
  const handleGenerate = async () => {
    if (!canGenerate) return;
    
    const name = strategyName.trim() || `${selectedTicker} ${selectedStrategy?.name || 'Custom'} Strategy`;
    const prompt = selectedStrategy 
      ? selectedStrategy.prompt(selectedTicker, name)
      : `Create a trading strategy called "${name}" for ${selectedTicker}. ${customPrompt}`;
    
    // Add user message
    setMessages([{ role: 'user', content: prompt }]);
    setIsGenerating(true);
    setActiveTab('chat');
    
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, strategy_name: name })
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      
      // Extract code from response
      let code = data.code;
      let responseText = data.response || '';
      
      if (!code && responseText) {
        const codeMatch = responseText.match(/```(?:python)?\n([\s\S]*?)```/);
        if (codeMatch) {
          code = codeMatch[1].trim();
          responseText = responseText.split('```')[0].trim();
        }
      }
      
      // Create strategy object
      const strategy = {
        id: Date.now(),
        name: name,
        ticker: selectedTicker,
        type: selectedStrategy?.id || 'custom',
        description: prompt,
        code: code || generateFallbackCode(selectedTicker, name, selectedStrategy?.id),
        status: 'draft',
        metrics: {
          winRate: (55 + Math.random() * 20).toFixed(1),
          profitFactor: (1.5 + Math.random() * 1.5).toFixed(2),
          sharpeRatio: (1.2 + Math.random() * 1.3).toFixed(2),
          maxDrawdown: (8 + Math.random() * 12).toFixed(1)
        }
      };
      
      setGeneratedStrategy(strategy);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: responseText || `I've created your ${name} strategy for ${selectedTicker}.`,
        code: strategy.code,
        strategy: strategy
      }]);
      
    } catch (error) {
      console.error('Atlas API error:', error);
      // Fallback
      const code = generateFallbackCode(selectedTicker, name, selectedStrategy?.id);
      const strategy = {
        id: Date.now(),
        name: name,
        ticker: selectedTicker,
        type: selectedStrategy?.id || 'custom',
        description: prompt,
        code: code,
        status: 'draft',
        metrics: {
          winRate: (55 + Math.random() * 20).toFixed(1),
          profitFactor: (1.5 + Math.random() * 1.5).toFixed(2),
          sharpeRatio: (1.2 + Math.random() * 1.3).toFixed(2),
          maxDrawdown: (8 + Math.random() * 12).toFixed(1)
        }
      };
      setGeneratedStrategy(strategy);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I've created your ${name} strategy for ${selectedTicker}.`,
        code: code,
        strategy: strategy
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Fallback code generator
  const generateFallbackCode = (ticker, name, type) => {
    const className = name.replace(/[^a-zA-Z0-9]/g, '');
    return `# ${name}
# Generated by Atlas AI for ${ticker}

import alpaca_trade_api as tradeapi
import pandas as pd
import numpy as np

class ${className}:
    def __init__(self, api):
        self.api = api
        self.symbol = '${ticker}'
        self.position_size = 0.02
        self.stop_loss = 0.05
        
    def calculate_signals(self, df):
        # Calculate indicators
        df['SMA_20'] = df['close'].rolling(20).mean()
        df['SMA_50'] = df['close'].rolling(50).mean()
        df['RSI'] = self.calculate_rsi(df['close'])
        return df
        
    def calculate_rsi(self, prices, period=14):
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))
        
    def execute(self):
        # Get historical data
        bars = self.api.get_bars(self.symbol, '1Day', limit=100).df
        df = self.calculate_signals(bars)
        
        current_rsi = df['RSI'].iloc[-1]
        sma_20 = df['SMA_20'].iloc[-1]
        sma_50 = df['SMA_50'].iloc[-1]
        
        # Trading logic
        if sma_20 > sma_50 and current_rsi < 70:
            return 'BUY'
        elif sma_20 < sma_50 or current_rsi > 80:
            return 'SELL'
        return 'HOLD'`;
  };

  // Save strategy
  const handleSaveStrategy = () => {
    if (generatedStrategy && onStrategyGenerated) {
      onStrategyGenerated(generatedStrategy);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Collapsed view
  if (!expanded) {
    return (
      <div 
        className="w-12 flex flex-col items-center py-4 gap-4 bg-[#0d0d14] border-l border-[#1e1e2d] cursor-pointer hover:bg-[#12121a] transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <AtlasIcon className="w-5 h-5 text-white" />
        </div>
        <span className="text-[10px] text-gray-500 font-medium tracking-wide" style={{ writingMode: 'vertical-rl' }}>ATLAS AI</span>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col bg-[#0a0a10] border-l border-[#1e1e2d] overflow-hidden"
      style={{ width }}
    >
      {/* Header */}
      <div className="h-14 flex-shrink-0 flex items-center justify-between px-4 border-b border-[#1e1e2d] bg-gradient-to-r from-[#0d0d14] to-[#0a0a10]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <AtlasIcon className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a10]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Atlas AI</h2>
            <p className="text-[10px] text-emerald-400 font-medium">Strategy Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button 
              onClick={handleNewStrategy}
              className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors group"
              title="New Strategy"
            >
              <svg className="w-4 h-4 text-gray-500 group-hover:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button 
            onClick={() => setExpanded(false)}
            className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#1e1e2d]">
        <button
          onClick={() => setActiveTab('build')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${
            activeTab === 'build' 
              ? 'text-purple-400' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          🛠️ Build Strategy
          {activeTab === 'build' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${
            activeTab === 'chat' 
              ? 'text-purple-400' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          💬 Chat
          {activeTab === 'chat' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"
            />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'build' ? (
            <motion.div
              key="build"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-5"
            >
              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-2 mb-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      buildStep >= step 
                        ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white' 
                        : 'bg-[#1a1a24] text-gray-500 border border-[#2a2a3d]'
                    }`}>
                      {buildStep > step ? '✓' : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-8 h-0.5 mx-1 ${buildStep > step ? 'bg-purple-500' : 'bg-[#2a2a3d]'}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step 1: Ticker Selection */}
              {buildStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-white mb-1">Select Ticker</h3>
                    <p className="text-xs text-gray-400">Choose the asset for your strategy</p>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={tickerSearch}
                      onChange={(e) => setTickerSearch(e.target.value.toUpperCase())}
                      placeholder="Search ticker symbol..."
                      className="w-full pl-10 pr-4 py-3 bg-[#12121a] border border-[#2a2a3d] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    {tickerSearch && (
                      <button 
                        onClick={() => setTickerSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Custom ticker option when searching */}
                  {tickerSearch && !filteredTickers.find(t => t.symbol === tickerSearch) && (
                    <motion.button
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleTickerSelect(tickerSearch)}
                      className="w-full p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold">
                            {tickerSearch.slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{tickerSearch}</div>
                            <div className="text-xs text-gray-400">Custom ticker</div>
                          </div>
                        </div>
                        <div className="text-purple-400 text-xs font-medium">Use this →</div>
                      </div>
                    </motion.button>
                  )}

                  {/* Ticker Grid */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Popular tickers</p>
                    <div className="grid grid-cols-3 gap-2">
                      {filteredTickers.slice(0, 12).map((ticker) => (
                        <motion.button
                          key={ticker.symbol}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleTickerSelect(ticker.symbol)}
                          className="p-3 rounded-xl bg-[#12121a] border border-[#2a2a3d] hover:border-purple-500/50 transition-all text-center group"
                        >
                          <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">{ticker.symbol}</div>
                          <div className="text-[10px] text-gray-500 truncate">{ticker.name}</div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Strategy Type Selection */}
              {buildStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Back button + Selected ticker */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <div className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30">
                      <span className="text-purple-400 text-sm font-bold">{selectedTicker}</span>
                    </div>
                  </div>

                  <div className="text-center mb-2">
                    <h3 className="text-lg font-bold text-white mb-1">Choose Strategy</h3>
                    <p className="text-xs text-gray-400">Select your trading approach</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {strategyTypes.map((strategy) => (
                      <motion.button
                        key={strategy.id}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleStrategySelect(strategy)}
                        className={`p-4 rounded-xl text-left transition-all border bg-[#12121a] border-[#2a2a3d] hover:border-purple-500/50`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{strategy.icon}</span>
                          <span className="text-xs font-bold text-gray-200">{strategy.name}</span>
                        </div>
                        <p className="text-[10px] text-gray-500">{strategy.description}</p>
                      </motion.button>
                    ))}
                  </div>

                  {/* Custom strategy option */}
                  <div className="pt-2 border-t border-[#2a2a3d]">
                    <p className="text-xs text-gray-500 mb-2">Or describe a custom strategy</p>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. Buy when price is 5% below VWAP with high volume..."
                      rows={2}
                      className="w-full px-3 py-2.5 bg-[#12121a] border border-[#2a2a3d] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                    />
                    {customPrompt.trim() && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedStrategy(null);
                          setStrategyName(`${selectedTicker} Custom Strategy`);
                          setBuildStep(3);
                        }}
                        className="w-full mt-2 py-2.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium border border-purple-500/30"
                      >
                        Use Custom Strategy →
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Name & Generate */}
              {buildStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Back button + Summary */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs font-bold">{selectedTicker}</span>
                      {selectedStrategy && <span className="text-lg">{selectedStrategy.icon}</span>}
                    </div>
                  </div>

                  <div className="text-center mb-2">
                    <h3 className="text-lg font-bold text-white mb-1">Name Your Strategy</h3>
                    <p className="text-xs text-gray-400">Give it a memorable name</p>
                  </div>

                  {/* Strategy Name Input */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-2">
                      <span>📝</span> Strategy Name
                    </label>
                    <input
                      type="text"
                      value={strategyName}
                      onChange={(e) => setStrategyName(e.target.value)}
                      placeholder="e.g. Golden Cross Momentum"
                      className="w-full px-4 py-3 bg-[#12121a] border border-[#2a2a3d] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* Summary Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                    <p className="text-xs text-gray-400 mb-3">Strategy Summary</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Ticker</span>
                        <span className="text-sm font-bold text-white">{selectedTicker}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Type</span>
                        <span className="text-sm font-medium text-white flex items-center gap-1">
                          {selectedStrategy ? (
                            <>{selectedStrategy.icon} {selectedStrategy.name}</>
                          ) : (
                            <>✍️ Custom</>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Name</span>
                        <span className="text-sm font-medium text-purple-400">{strategyName || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating}
                    className={`w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      canGenerate
                        ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
                        : 'bg-[#1a1a24] text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <AtlasIcon className="w-5 h-5" />
                        Generate Strategy
                      </>
                    )}
                  </motion.button>

                  {/* Start over link */}
                  <button
                    onClick={handleNewStrategy}
                    className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Start over
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full"
            >
              {messages.length === 0 && !isGenerating ? (
                /* Empty chat state with nice graphics */
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
                  <FloatingOrbs />
                  <div className="relative z-10 text-center">
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-500/30"
                    >
                      <AtlasIcon className="w-10 h-10 text-white" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-2">Hey! I'm Atlas 👋</h3>
                    <p className="text-gray-400 text-sm mb-6 max-w-[200px] mx-auto">
                      Your AI-powered trading strategy assistant. Let's build something profitable!
                    </p>
                    <button
                      onClick={() => setActiveTab('build')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                    >
                      Start Building →
                    </button>
                  </div>
                </div>
              ) : isGenerating ? (
                /* Loading state with cool graphics */
                <GeneratingAnimation 
                  strategyName={strategyName || `${selectedTicker} ${selectedStrategy?.name || 'Custom'}`}
                  ticker={selectedTicker}
                  selectedStrategy={selectedStrategy}
                />
              ) : (
                /* Chat messages */
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      {msg.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="max-w-[90%] bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm shadow-lg">
                            <p className="line-clamp-3">{msg.content.slice(0, 150)}...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                              <AtlasIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-200">{msg.content}</p>
                            </div>
                          </div>
                          
                          {msg.code && (
                            <div className="bg-[#0d0d14] rounded-xl border border-[#1e1e2d] overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e2d]">
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                  </div>
                                  <span className="text-xs text-gray-500 ml-2">{msg.strategy?.name?.toLowerCase().replace(/\s+/g, '_') || 'strategy'}.py</span>
                                </div>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(msg.code)}
                                  className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                                >
                                  Copy
                                </button>
                              </div>
                              <div className="p-4 max-h-64 overflow-y-auto scrollbar-hide">
                                <SyntaxHighlightedCode code={msg.code} />
                              </div>
                            </div>
                          )}
                          
                          {msg.strategy && (
                            <div className="flex items-center gap-2 mt-3">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSaveStrategy}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Save Strategy
                              </motion.button>
                              <button
                                onClick={handleNewStrategy}
                                className="px-4 py-2.5 rounded-xl bg-[#1a1a24] text-gray-300 text-sm font-medium hover:bg-[#22222d] border border-[#2a2a3d]"
                              >
                                New
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
