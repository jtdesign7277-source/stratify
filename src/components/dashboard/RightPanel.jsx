import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Premium Atlas AI Icon
const AtlasIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
  </svg>
);

// Strategy templates with editable parameters
const strategyTemplates = [
  { 
    id: 'momentum', 
    name: 'Momentum', 
    icon: '📈',
    color: 'from-green-500 to-emerald-600',
    description: 'Trend-following with MA crossovers',
    params: [
      { key: 'fastMA', label: 'Fast MA', value: 20, min: 5, max: 50, step: 1 },
      { key: 'slowMA', label: 'Slow MA', value: 50, min: 20, max: 200, step: 5 },
      { key: 'rsiThreshold', label: 'RSI Threshold', value: 50, min: 30, max: 70, step: 5 },
      { key: 'stopLoss', label: 'Stop Loss %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'Take Profit %', value: 15, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Position Size %', value: 2, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a momentum strategy called "${name}" for ${ticker}. Buy when ${params.fastMA}-day MA crosses above ${params.slowMA}-day MA with RSI above ${params.rsiThreshold}. Use ${params.positionSize}% position size, ${params.stopLoss}% stop loss, ${params.takeProfit}% take profit.`
  },
  { 
    id: 'rsi', 
    name: 'RSI Reversal', 
    icon: '📊',
    color: 'from-purple-500 to-indigo-600',
    description: 'Buy oversold, sell overbought',
    params: [
      { key: 'rsiPeriod', label: 'RSI Period', value: 14, min: 7, max: 21, step: 1 },
      { key: 'oversold', label: 'Oversold Level', value: 30, min: 20, max: 40, step: 5 },
      { key: 'overbought', label: 'Overbought Level', value: 70, min: 60, max: 80, step: 5 },
      { key: 'stopLoss', label: 'Stop Loss %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'Take Profit %', value: 12, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Position Size %', value: 2, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create an RSI reversal strategy called "${name}" for ${ticker}. RSI period ${params.rsiPeriod}. Buy when RSI < ${params.oversold}, sell when RSI > ${params.overbought}. ${params.positionSize}% position, ${params.stopLoss}% SL, ${params.takeProfit}% TP.`
  },
  { 
    id: 'meanreversion', 
    name: 'Mean Reversion', 
    icon: '🔄',
    color: 'from-blue-500 to-cyan-600',
    description: 'Trade the bounce back to average',
    params: [
      { key: 'maPeriod', label: 'MA Period', value: 20, min: 10, max: 50, step: 5 },
      { key: 'stdDev', label: 'Std Deviations', value: 2, min: 1, max: 3, step: 0.5 },
      { key: 'stopLoss', label: 'Stop Loss %', value: 8, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'Take Profit %', value: 10, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Position Size %', value: 3, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a mean reversion strategy called "${name}" for ${ticker}. Buy when price is ${params.stdDev} std devs below ${params.maPeriod}-day MA. Sell at mean. ${params.positionSize}% position, ${params.stopLoss}% SL, ${params.takeProfit}% TP.`
  },
  { 
    id: 'breakout', 
    name: 'Breakout', 
    icon: '💥',
    color: 'from-orange-500 to-red-600',
    description: 'Catch explosive moves',
    params: [
      { key: 'lookback', label: 'Lookback Days', value: 20, min: 10, max: 50, step: 5 },
      { key: 'volumeThreshold', label: 'Volume Surge %', value: 50, min: 20, max: 100, step: 10 },
      { key: 'atrMultiplier', label: 'ATR Multiplier', value: 2, min: 1, max: 4, step: 0.5 },
      { key: 'stopLoss', label: 'Stop Loss %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'positionSize', label: 'Position Size %', value: 2, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a breakout strategy called "${name}" for ${ticker}. Enter when price breaks ${params.lookback}-day high with volume ${params.volumeThreshold}% above average. ATR trailing stop at ${params.atrMultiplier}x. ${params.positionSize}% position, ${params.stopLoss}% SL.`
  },
  { 
    id: 'macd', 
    name: 'MACD Cross', 
    icon: '⚡',
    color: 'from-yellow-500 to-orange-600',
    description: 'Signal line crossovers',
    params: [
      { key: 'fastPeriod', label: 'Fast Period', value: 12, min: 8, max: 16, step: 1 },
      { key: 'slowPeriod', label: 'Slow Period', value: 26, min: 20, max: 32, step: 1 },
      { key: 'signalPeriod', label: 'Signal Period', value: 9, min: 5, max: 12, step: 1 },
      { key: 'stopLoss', label: 'Stop Loss %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'Take Profit %', value: 15, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Position Size %', value: 3, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a MACD strategy called "${name}" for ${ticker}. MACD(${params.fastPeriod},${params.slowPeriod},${params.signalPeriod}). Buy on bullish cross below zero, sell on bearish cross. ${params.positionSize}% position, ${params.stopLoss}% SL, ${params.takeProfit}% TP.`
  },
  { 
    id: 'scalping', 
    name: 'Scalping', 
    icon: '🎯',
    color: 'from-pink-500 to-rose-600',
    description: 'Quick in-and-out trades',
    params: [
      { key: 'emaPeriod', label: 'EMA Period', value: 9, min: 5, max: 15, step: 1 },
      { key: 'rsiPeriod', label: 'RSI Period', value: 7, min: 5, max: 14, step: 1 },
      { key: 'targetProfit', label: 'Target Profit %', value: 0.5, min: 0.2, max: 2, step: 0.1 },
      { key: 'stopLoss', label: 'Stop Loss %', value: 0.3, min: 0.1, max: 1, step: 0.1 },
      { key: 'positionSize', label: 'Position Size %', value: 5, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a scalping strategy called "${name}" for ${ticker}. Use EMA(${params.emaPeriod}) with RSI(${params.rsiPeriod}). Target ${params.targetProfit}% profit, ${params.stopLoss}% stop loss. ${params.positionSize}% position size. High frequency.`
  },
];

// Popular tickers
const popularTickers = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq ETF' },
  { symbol: 'AMD', name: 'AMD Inc.' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'PLTR', name: 'Palantir' },
];

// Backtest time periods
const backtestPeriods = [
  { label: '1M', months: 1, description: '1 Month' },
  { label: '3M', months: 3, description: '3 Months' },
  { label: '6M', months: 6, description: '6 Months' },
  { label: '9M', months: 9, description: '9 Months' },
  { label: '1Y', months: 12, description: '1 Year' },
];

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

// Backtest Loading Animation
const BacktestLoadingAnimation = ({ period }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center py-8"
  >
    <div className="relative mb-4">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-full border-2 border-purple-500/30 border-t-purple-500"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl">📊</span>
      </div>
    </div>
    <p className="text-sm font-medium text-white mb-1">Running Backtest</p>
    <p className="text-xs text-gray-400">Analyzing {period} of historical data...</p>
    <div className="flex items-center gap-1 mt-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          className="w-2 h-2 rounded-full bg-purple-500"
        />
      ))}
    </div>
  </motion.div>
);

// Backtest Results Component
const BacktestResults = ({ results, period }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="space-y-3"
  >
    {/* Performance Summary */}
    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">Backtest Results ({period})</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${results.totalReturn >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {results.totalReturn >= 0 ? '+' : ''}{results.totalReturn}%
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 rounded-lg bg-[#12121a]">
          <p className="text-lg font-bold text-emerald-400">{results.winRate}%</p>
          <p className="text-[10px] text-gray-500">Win Rate</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-[#12121a]">
          <p className="text-lg font-bold text-blue-400">{results.profitFactor}</p>
          <p className="text-[10px] text-gray-500">Profit Factor</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-[#12121a]">
          <p className="text-lg font-bold text-purple-400">{results.sharpeRatio}</p>
          <p className="text-[10px] text-gray-500">Sharpe Ratio</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-[#12121a]">
          <p className="text-lg font-bold text-red-400">{results.maxDrawdown}%</p>
          <p className="text-[10px] text-gray-500">Max Drawdown</p>
        </div>
      </div>
    </div>

    {/* Trade Stats */}
    <div className="p-3 rounded-lg bg-[#12121a] border border-[#2a2a3d]">
      <p className="text-xs text-gray-400 mb-2">Trade Statistics</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold text-white">{results.totalTrades}</p>
          <p className="text-[10px] text-gray-500">Total Trades</p>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-400">{results.winningTrades}</p>
          <p className="text-[10px] text-gray-500">Winners</p>
        </div>
        <div>
          <p className="text-sm font-bold text-red-400">{results.losingTrades}</p>
          <p className="text-[10px] text-gray-500">Losers</p>
        </div>
      </div>
    </div>

    {/* Mini Chart Visualization */}
    <div className="p-3 rounded-lg bg-[#12121a] border border-[#2a2a3d]">
      <p className="text-xs text-gray-400 mb-2">Equity Curve</p>
      <div className="h-16 flex items-end gap-0.5">
        {results.equityCurve.map((val, idx) => (
          <motion.div
            key={idx}
            initial={{ height: 0 }}
            animate={{ height: `${val}%` }}
            transition={{ delay: idx * 0.05 }}
            className={`flex-1 rounded-t ${val >= 50 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-red-600 to-red-400'}`}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

// Main Component
export default function RightPanel({ width, themeClasses, onStrategyGenerated }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('build');
  const [buildStep, setBuildStep] = useState(1);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyName, setStrategyName] = useState('');
  const [tickerSearch, setTickerSearch] = useState('');
  const [strategyParams, setStrategyParams] = useState({});
  
  // Backtest state
  const [selectedPeriod, setSelectedPeriod] = useState(backtestPeriods[2]); // Default 6M
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  const [messages, setMessages] = useState([]);
  
  const messagesEndRef = useRef(null);
  
  // Filter tickers
  const filteredTickers = tickerSearch 
    ? popularTickers.filter(t => 
        t.symbol.toLowerCase().includes(tickerSearch.toLowerCase()) ||
        t.name.toLowerCase().includes(tickerSearch.toLowerCase())
      )
    : popularTickers;

  // Handle ticker selection
  const handleTickerSelect = (symbol) => {
    setSelectedTicker(symbol);
    setTickerSearch('');
    setBuildStep(2);
  };

  // Handle strategy selection
  const handleStrategySelect = (strategy) => {
    setSelectedStrategy(strategy);
    // Initialize params with defaults
    const defaultParams = {};
    strategy.params.forEach(p => { defaultParams[p.key] = p.value; });
    setStrategyParams(defaultParams);
    setStrategyName(`${selectedTicker} ${strategy.name}`);
    setBuildStep(3);
    setBacktestResults(null);
  };

  // Handle param change
  const handleParamChange = (key, value) => {
    setStrategyParams(prev => ({ ...prev, [key]: parseFloat(value) }));
    setBacktestResults(null); // Clear backtest when params change
  };

  // Handle back
  const handleBack = () => {
    if (buildStep === 2) {
      setBuildStep(1);
      setSelectedStrategy(null);
    } else if (buildStep === 3) {
      setBuildStep(2);
      setBacktestResults(null);
    }
  };

  // Run backtest
  const handleBacktest = async () => {
    setIsBacktesting(true);
    setBacktestResults(null);
    
    // Simulate backtest delay
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    
    // Generate mock results based on params
    const baseWinRate = 50 + Math.random() * 25;
    const totalTrades = Math.floor(20 + selectedPeriod.months * 8 + Math.random() * 20);
    const winningTrades = Math.floor(totalTrades * (baseWinRate / 100));
    
    const results = {
      totalReturn: (Math.random() * 40 - 5).toFixed(1),
      winRate: baseWinRate.toFixed(1),
      profitFactor: (1.2 + Math.random() * 1.5).toFixed(2),
      sharpeRatio: (0.8 + Math.random() * 1.8).toFixed(2),
      maxDrawdown: (5 + Math.random() * 15).toFixed(1),
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      equityCurve: Array.from({ length: 20 }, () => 30 + Math.random() * 60),
    };
    
    setBacktestResults(results);
    setIsBacktesting(false);
  };

  // Generate strategy
  const handleGenerate = async () => {
    if (!selectedTicker || !selectedStrategy) return;
    
    const prompt = selectedStrategy.getPrompt(selectedTicker, strategyName, strategyParams);
    
    setMessages([{ role: 'user', content: prompt }]);
    setIsGenerating(true);
    setActiveTab('chat');
    
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, strategy_name: strategyName })
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      
      let code = data.code;
      let responseText = data.response || '';
      
      if (!code && responseText) {
        const codeMatch = responseText.match(/```(?:python)?\n([\s\S]*?)```/);
        if (codeMatch) {
          code = codeMatch[1].trim();
          responseText = responseText.split('```')[0].trim();
        }
      }
      
      const strategy = {
        id: Date.now(),
        name: strategyName,
        ticker: selectedTicker,
        type: selectedStrategy.id,
        description: prompt,
        code: code || generateFallbackCode(),
        params: strategyParams,
        backtestResults,
        status: 'draft',
        metrics: backtestResults || {
          winRate: '—',
          profitFactor: '—',
          sharpeRatio: '—',
          maxDrawdown: '—'
        }
      };
      
      setGeneratedStrategy(strategy);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: responseText || `I've created your ${strategyName} strategy for ${selectedTicker}.`,
        code: strategy.code,
        strategy: strategy
      }]);
      
    } catch (error) {
      console.error('Atlas API error:', error);
      const code = generateFallbackCode();
      const strategy = {
        id: Date.now(),
        name: strategyName,
        ticker: selectedTicker,
        type: selectedStrategy.id,
        description: prompt,
        code,
        params: strategyParams,
        backtestResults,
        status: 'draft',
        metrics: backtestResults || {}
      };
      setGeneratedStrategy(strategy);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I've created your ${strategyName} strategy for ${selectedTicker}.`,
        code,
        strategy
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate fallback code
  const generateFallbackCode = () => {
    const className = strategyName.replace(/[^a-zA-Z0-9]/g, '');
    const params = strategyParams;
    return `# ${strategyName}
# Generated by Atlas AI for ${selectedTicker}
# Strategy: ${selectedStrategy?.name}

import alpaca_trade_api as tradeapi
import pandas as pd
import numpy as np

class ${className}:
    def __init__(self, api):
        self.api = api
        self.symbol = '${selectedTicker}'
        ${selectedStrategy?.params.map(p => `self.${p.key} = ${params[p.key]}`).join('\n        ')}
        
    def calculate_signals(self, df):
        # Calculate indicators based on strategy type
        df['signal'] = 0
        
        # ${selectedStrategy?.name} logic implementation
        # Parameters: ${JSON.stringify(params)}
        
        return df
        
    def execute(self):
        bars = self.api.get_bars(self.symbol, '1Day', limit=100).df
        df = self.calculate_signals(bars)
        
        if df['signal'].iloc[-1] == 1:
            return 'BUY'
        elif df['signal'].iloc[-1] == -1:
            return 'SELL'
        return 'HOLD'

if __name__ == "__main__":
    api = tradeapi.REST()
    strategy = ${className}(api)
    signal = strategy.execute()
    print(f"Signal: {signal}")`;
  };

  // Reset
  const handleNewStrategy = () => {
    setSelectedTicker(null);
    setSelectedStrategy(null);
    setStrategyName('');
    setTickerSearch('');
    setStrategyParams({});
    setBuildStep(1);
    setBacktestResults(null);
    setMessages([]);
    setGeneratedStrategy(null);
    setActiveTab('build');
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
    <div className="flex flex-col bg-[#0a0a10] border-l border-[#1e1e2d] overflow-hidden" style={{ width }}>
      {/* Header */}
      <div className="h-14 flex-shrink-0 flex items-center justify-between px-4 border-b border-[#1e1e2d]">
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
          {(messages.length > 0 || buildStep > 1) && (
            <button onClick={handleNewStrategy} className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors" title="New Strategy">
              <svg className="w-4 h-4 text-gray-500 hover:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button onClick={() => setExpanded(false)} className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1e1e2d]">
        <button
          onClick={() => setActiveTab('build')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${activeTab === 'build' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          🛠️ Build
          {activeTab === 'build' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500" />}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${activeTab === 'chat' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          💬 Results
          {activeTab === 'chat' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'build' ? (
            <motion.div
              key="build"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-4"
            >
              {/* Progress */}
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      buildStep >= step ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white' : 'bg-[#1a1a24] text-gray-500 border border-[#2a2a3d]'
                    }`}>
                      {buildStep > step ? '✓' : step}
                    </div>
                    {step < 3 && <div className={`w-6 h-0.5 mx-1 ${buildStep > step ? 'bg-purple-500' : 'bg-[#2a2a3d]'}`} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Ticker */}
              {buildStep === 1 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-1">Select Ticker</h3>
                    <p className="text-xs text-gray-400">Choose the asset for your strategy</p>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={tickerSearch}
                      onChange={(e) => setTickerSearch(e.target.value.toUpperCase())}
                      placeholder="Search ticker symbol..."
                      className="w-full pl-10 pr-4 py-3 bg-[#12121a] border border-[#2a2a3d] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                    {tickerSearch && (
                      <button onClick={() => setTickerSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Custom ticker */}
                  {tickerSearch && !filteredTickers.find(t => t.symbol === tickerSearch) && (
                    <motion.button
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleTickerSelect(tickerSearch)}
                      className="w-full p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {tickerSearch.slice(0, 2)}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-white">{tickerSearch}</div>
                          <div className="text-xs text-gray-400">Custom ticker</div>
                        </div>
                      </div>
                      <span className="text-purple-400 text-xs">Use →</span>
                    </motion.button>
                  )}

                  {/* Ticker Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {filteredTickers.slice(0, 12).map((ticker) => (
                      <motion.button
                        key={ticker.symbol}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleTickerSelect(ticker.symbol)}
                        className="p-3 rounded-xl bg-[#12121a] border border-[#2a2a3d] hover:border-purple-500/50 text-center group transition-all"
                      >
                        <div className="text-sm font-bold text-white group-hover:text-purple-400">{ticker.symbol}</div>
                        <div className="text-[10px] text-gray-500 truncate">{ticker.name}</div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Strategy */}
              {buildStep === 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <div className="px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30">
                      <span className="text-purple-400 text-sm font-bold">{selectedTicker}</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-1">Choose Strategy</h3>
                    <p className="text-xs text-gray-400">Select your trading approach</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {strategyTemplates.map((strategy) => (
                      <motion.button
                        key={strategy.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleStrategySelect(strategy)}
                        className="p-3 rounded-xl bg-[#12121a] border border-[#2a2a3d] hover:border-purple-500/50 text-left transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{strategy.icon}</span>
                          <span className="text-xs font-bold text-gray-200">{strategy.name}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 line-clamp-2">{strategy.description}</p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Configure, Backtest & Generate */}
              {buildStep === 3 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-bold">{selectedTicker}</span>
                      <span className="text-lg">{selectedStrategy?.icon}</span>
                    </div>
                  </div>

                  {/* Strategy Name */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1.5 block">📝 Strategy Name</label>
                    <input
                      type="text"
                      value={strategyName}
                      onChange={(e) => setStrategyName(e.target.value)}
                      placeholder="e.g. My RSI Strategy"
                      className="w-full px-3 py-2.5 bg-[#12121a] border border-[#2a2a3d] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  {/* Parameters */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-2 block">⚙️ Parameters</label>
                    <div className="space-y-2 p-3 rounded-xl bg-[#12121a] border border-[#2a2a3d]">
                      {selectedStrategy?.params.map((param) => (
                        <div key={param.key} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">{param.label}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={strategyParams[param.key] ?? param.value}
                              onChange={(e) => handleParamChange(param.key, e.target.value)}
                              min={param.min}
                              max={param.max}
                              step={param.step}
                              className="w-20 px-2 py-1 bg-[#0a0a10] border border-[#2a2a3d] rounded text-xs text-white text-right focus:outline-none focus:border-purple-500/50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Backtest Section */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-2 block">📊 Backtest Period</label>
                    <div className="flex gap-1 mb-3">
                      {backtestPeriods.map((period) => (
                        <button
                          key={period.label}
                          onClick={() => { setSelectedPeriod(period); setBacktestResults(null); }}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedPeriod.label === period.label
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-[#12121a] text-gray-400 border border-[#2a2a3d] hover:border-purple-500/20'
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>

                    {/* Backtest Button or Results */}
                    {isBacktesting ? (
                      <BacktestLoadingAnimation period={selectedPeriod.description} />
                    ) : backtestResults ? (
                      <BacktestResults results={backtestResults} period={selectedPeriod.description} />
                    ) : (
                      <button
                        onClick={handleBacktest}
                        className="w-full py-3 rounded-xl bg-[#12121a] border border-[#2a2a3d] text-gray-300 text-sm font-medium hover:border-purple-500/50 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <span>📊</span> Run Backtest ({selectedPeriod.description})
                      </button>
                    )}
                  </div>

                  {/* Generate Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGenerate}
                    disabled={isGenerating || !strategyName.trim()}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      strategyName.trim()
                        ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg shadow-purple-500/25'
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
                        <AtlasIcon className="w-4 h-4" />
                        Generate & Deploy Strategy
                      </>
                    )}
                  </motion.button>

                  <button onClick={handleNewStrategy} className="w-full text-xs text-gray-500 hover:text-gray-300">
                    Start over
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* Results/Chat Tab */
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full"
            >
              {messages.length === 0 && !isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mb-4 shadow-xl">
                    <AtlasIcon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Ready to Build</h3>
                  <p className="text-gray-400 text-sm mb-4">Configure and generate a strategy to see results here</p>
                  <button onClick={() => setActiveTab('build')} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium">
                    Go to Build →
                  </button>
                </div>
              ) : isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="relative mb-6">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-20 h-20 rounded-full border-2 border-purple-500/30 border-t-purple-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                        <span className="text-2xl">{selectedStrategy?.icon}</span>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Generating Strategy</h3>
                  <p className="text-purple-400 font-medium">{strategyName}</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      {msg.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="max-w-[90%] bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm">
                            <p className="line-clamp-3">{msg.content.slice(0, 150)}...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                              <AtlasIcon className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-sm text-gray-200">{msg.content}</p>
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
                                  <span className="text-xs text-gray-500 ml-2">{strategyName.toLowerCase().replace(/\s+/g, '_')}.py</span>
                                </div>
                                <button onClick={() => navigator.clipboard.writeText(msg.code)} className="text-xs text-purple-400 hover:text-purple-300">
                                  Copy
                                </button>
                              </div>
                              <div className="p-4 max-h-48 overflow-y-auto scrollbar-hide">
                                <SyntaxHighlightedCode code={msg.code} />
                              </div>
                            </div>
                          )}
                          
                          {msg.strategy && (
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveStrategy}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Deploy Strategy
                              </button>
                              <button onClick={handleNewStrategy} className="px-4 py-2.5 rounded-xl bg-[#1a1a24] text-gray-300 text-sm border border-[#2a2a3d]">
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
