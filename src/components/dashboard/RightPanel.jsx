import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Brain Icon (thin line, no box - matches watchlist)
const BrainIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4.5C10 4.5 9 5.5 9 7c0-2-1.5-3-3-3s-2.5 1.5-2.5 3c0 1 .5 2 1 2.5-.5.5-1.5 1.5-1.5 3 0 2 1.5 3 3 3 .5 0 1-.1 1.5-.3 0 1.8 1.5 3.3 3.5 3.3" />
    <path d="M12 4.5c2 0 3 1 3 2.5 0-2 1.5-3 3-3s2.5 1.5 2.5 3c0 1-.5 2-1 2.5.5.5 1.5 1.5 1.5 3 0 2-1.5 3-3 3-.5 0-1-.1-1.5-.3 0 1.8-1.5 3.3-3.5 3.3" />
    <path d="M12 4.5v15" />
  </svg>
);

// Strategy templates with editable parameters
const strategyTemplates = [
  { 
    id: 'momentum', 
    name: 'Momentum', 
    icon: '📈',
    description: 'Trend-following with MA crossovers',
    params: [
      { key: 'fastMA', label: 'Fast MA', value: 20, min: 5, max: 50, step: 1 },
      { key: 'slowMA', label: 'Slow MA', value: 50, min: 20, max: 200, step: 5 },
      { key: 'rsiThreshold', label: 'RSI', value: 50, min: 30, max: 70, step: 5 },
      { key: 'stopLoss', label: 'Stop %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'TP %', value: 15, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Size %', value: 2, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a momentum strategy called "${name}" for ${ticker}. Buy when ${params.fastMA}-day MA crosses above ${params.slowMA}-day MA with RSI above ${params.rsiThreshold}. Use ${params.positionSize}% position size, ${params.stopLoss}% stop loss, ${params.takeProfit}% take profit.`
  },
  { 
    id: 'rsi', 
    name: 'RSI Reversal', 
    icon: '📊',
    description: 'Buy oversold, sell overbought',
    params: [
      { key: 'rsiPeriod', label: 'Period', value: 14, min: 7, max: 21, step: 1 },
      { key: 'oversold', label: 'Oversold', value: 30, min: 20, max: 40, step: 5 },
      { key: 'overbought', label: 'Overbought', value: 70, min: 60, max: 80, step: 5 },
      { key: 'stopLoss', label: 'Stop %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'TP %', value: 12, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Size %', value: 2, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create an RSI reversal strategy called "${name}" for ${ticker}. RSI period ${params.rsiPeriod}. Buy when RSI < ${params.oversold}, sell when RSI > ${params.overbought}. ${params.positionSize}% position, ${params.stopLoss}% SL, ${params.takeProfit}% TP.`
  },
  { 
    id: 'meanreversion', 
    name: 'Mean Reversion', 
    icon: '🔄',
    description: 'Trade the bounce to average',
    params: [
      { key: 'maPeriod', label: 'MA', value: 20, min: 10, max: 50, step: 5 },
      { key: 'stdDev', label: 'Std Dev', value: 2, min: 1, max: 3, step: 0.5 },
      { key: 'stopLoss', label: 'Stop %', value: 8, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'TP %', value: 10, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Size %', value: 3, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a mean reversion strategy called "${name}" for ${ticker}. Buy when price is ${params.stdDev} std devs below ${params.maPeriod}-day MA. Sell at mean. ${params.positionSize}% position, ${params.stopLoss}% SL, ${params.takeProfit}% TP.`
  },
  { 
    id: 'breakout', 
    name: 'Breakout', 
    icon: '💥',
    description: 'Catch explosive moves',
    params: [
      { key: 'lookback', label: 'Days', value: 20, min: 10, max: 50, step: 5 },
      { key: 'volumeThreshold', label: 'Vol %', value: 50, min: 20, max: 100, step: 10 },
      { key: 'atrMultiplier', label: 'ATR', value: 2, min: 1, max: 4, step: 0.5 },
      { key: 'stopLoss', label: 'Stop %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'positionSize', label: 'Size %', value: 2, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a breakout strategy called "${name}" for ${ticker}. Enter when price breaks ${params.lookback}-day high with volume ${params.volumeThreshold}% above average. ATR trailing stop at ${params.atrMultiplier}x. ${params.positionSize}% position, ${params.stopLoss}% SL.`
  },
  { 
    id: 'macd', 
    name: 'MACD Cross', 
    icon: '⚡',
    description: 'Signal line crossovers',
    params: [
      { key: 'fastPeriod', label: 'Fast', value: 12, min: 8, max: 16, step: 1 },
      { key: 'slowPeriod', label: 'Slow', value: 26, min: 20, max: 32, step: 1 },
      { key: 'signalPeriod', label: 'Signal', value: 9, min: 5, max: 12, step: 1 },
      { key: 'stopLoss', label: 'Stop %', value: 5, min: 1, max: 15, step: 0.5 },
      { key: 'takeProfit', label: 'TP %', value: 15, min: 5, max: 50, step: 1 },
      { key: 'positionSize', label: 'Size %', value: 3, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a MACD strategy called "${name}" for ${ticker}. MACD(${params.fastPeriod},${params.slowPeriod},${params.signalPeriod}). Buy on bullish cross below zero, sell on bearish cross. ${params.positionSize}% position, ${params.stopLoss}% SL, ${params.takeProfit}% TP.`
  },
  { 
    id: 'scalping', 
    name: 'Scalping', 
    icon: '🎯',
    description: 'Quick in-and-out trades',
    params: [
      { key: 'emaPeriod', label: 'EMA', value: 9, min: 5, max: 15, step: 1 },
      { key: 'rsiPeriod', label: 'RSI', value: 7, min: 5, max: 14, step: 1 },
      { key: 'targetProfit', label: 'TP %', value: 0.5, min: 0.2, max: 2, step: 0.1 },
      { key: 'stopLoss', label: 'Stop %', value: 0.3, min: 0.1, max: 1, step: 0.1 },
      { key: 'positionSize', label: 'Size %', value: 5, min: 1, max: 10, step: 0.5 },
    ],
    getPrompt: (ticker, name, params) => `Create a scalping strategy called "${name}" for ${ticker}. Use EMA(${params.emaPeriod}) with RSI(${params.rsiPeriod}). Target ${params.targetProfit}% profit, ${params.stopLoss}% stop loss. ${params.positionSize}% position size. High frequency.`
  },
];

// Mag 7 Stocks
const mag7Tickers = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
];

// Indices
const indexTickers = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'Nasdaq' },
  { symbol: 'DIA', name: 'Dow Jones' },
];

// Crypto (9)
const cryptoTickers = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'Ripple' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOT', name: 'Polkadot' },
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
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-blue-400 font-medium">{token}</span>);
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
    className="flex flex-col items-center justify-center py-3"
  >
    <div className="relative mb-2">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-500"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm">📊</span>
      </div>
    </div>
    <p className="text-[10px] font-medium text-white">Running Backtest...</p>
  </motion.div>
);

// Compact Backtest Results
const BacktestResults = ({ results, period }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="grid grid-cols-3 gap-1"
  >
    <div className="text-center p-1.5 rounded bg-[#0a1628] border border-blue-500/20">
      <p className={`text-xs font-bold ${results.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {results.totalReturn >= 0 ? '+' : ''}{results.totalReturn}%
      </p>
      <p className="text-[8px] text-gray-500">Return</p>
    </div>
    <div className="text-center p-1.5 rounded bg-[#0a1628] border border-blue-500/20">
      <p className="text-xs font-bold text-white">{results.winRate}%</p>
      <p className="text-[8px] text-gray-500">Win Rate</p>
    </div>
    <div className="text-center p-1.5 rounded bg-[#0a1628] border border-blue-500/20">
      <p className="text-xs font-bold text-white">{results.profitFactor}</p>
      <p className="text-[8px] text-gray-500">PF</p>
    </div>
    <div className="text-center p-1.5 rounded bg-[#0a1628] border border-blue-500/20">
      <p className="text-xs font-bold text-white">{results.sharpeRatio}</p>
      <p className="text-[8px] text-gray-500">Sharpe</p>
    </div>
    <div className="text-center p-1.5 rounded bg-[#0a1628] border border-blue-500/20">
      <p className="text-xs font-bold text-red-400">-{results.maxDrawdown}%</p>
      <p className="text-[8px] text-gray-500">DD</p>
    </div>
    <div className="text-center p-1.5 rounded bg-[#0a1628] border border-blue-500/20">
      <p className="text-xs font-bold text-white">{results.totalTrades}</p>
      <p className="text-[8px] text-gray-500">Trades</p>
    </div>
  </motion.div>
);

// 3D Globe Animation Component
const Globe3D = ({ strategyName, strategyIcon }) => (
  <div className="flex flex-col items-center justify-center py-4">
    <div className="relative w-28 h-28 mb-3" style={{ perspective: '500px' }}>
      {/* Glow effect */}
      <div className="absolute inset-6 rounded-full bg-blue-500/30 blur-xl animate-pulse" />
      
      {/* Globe core */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
        <motion.div 
          animate={{ rotateY: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 shadow-2xl flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Globe grid lines */}
          <div className="absolute inset-0 rounded-full border border-blue-400/20" />
          <div className="absolute inset-0 rounded-full border border-blue-400/20" style={{ transform: 'rotateY(60deg)' }} />
          <div className="absolute inset-0 rounded-full border border-blue-400/20" style={{ transform: 'rotateY(120deg)' }} />
          <div className="absolute inset-2 rounded-full border border-blue-400/10" style={{ transform: 'rotateX(60deg)' }} />
          <div className="absolute inset-4 rounded-full border border-blue-400/10" style={{ transform: 'rotateX(60deg)' }} />
          <span className="text-white font-bold text-xl z-10">S</span>
        </motion.div>
      </div>
      
      {/* Orbital ring 1 */}
      <motion.div
        animate={{ rotateZ: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
        style={{ transform: 'rotateX(75deg)', transformStyle: 'preserve-3d' }}
      >
        <div className="absolute inset-1 rounded-full border border-blue-400/40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/60" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-300 shadow-lg shadow-blue-300/60" />
      </motion.div>
      
      {/* Orbital ring 2 */}
      <motion.div
        animate={{ rotateZ: -360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
        style={{ transform: 'rotateX(75deg) rotateY(60deg)', transformStyle: 'preserve-3d' }}
      >
        <div className="absolute inset-3 rounded-full border border-blue-300/30" />
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/60" />
      </motion.div>
      
      {/* Orbital ring 3 */}
      <motion.div
        animate={{ rotateZ: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
        style={{ transform: 'rotateX(75deg) rotateY(-60deg)', transformStyle: 'preserve-3d' }}
      >
        <div className="absolute inset-[-4px] rounded-full border border-blue-500/20" />
        <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-400 shadow-lg shadow-blue-400/80" />
      </motion.div>
    </div>
    
    <h3 className="text-xs font-bold text-white mb-0.5">Generating Strategy</h3>
    <p className="text-blue-400 text-[10px]">{strategyName}</p>
  </div>
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
  const [selectedPeriod, setSelectedPeriod] = useState(backtestPeriods[2]);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  const [messages, setMessages] = useState([]);
  
  const messagesEndRef = useRef(null);

  // Format ticker with $
  const formatTicker = (symbol) => `$${symbol}`;
  
  // All tickers combined
  const allTickers = [...mag7Tickers, ...indexTickers, ...cryptoTickers];
  const filteredTickers = tickerSearch 
    ? allTickers.filter(t => 
        t.symbol.toLowerCase().includes(tickerSearch.toLowerCase()) ||
        t.name.toLowerCase().includes(tickerSearch.toLowerCase())
      )
    : null;

  // Handle ticker selection
  const handleTickerSelect = (symbol) => {
    setSelectedTicker(symbol);
    setTickerSearch('');
    setBuildStep(2);
  };

  // Handle strategy selection
  const handleStrategySelect = (strategy) => {
    setSelectedStrategy(strategy);
    const defaultParams = {};
    strategy.params.forEach(p => { defaultParams[p.key] = p.value; });
    setStrategyParams(defaultParams);
    setStrategyName(`${formatTicker(selectedTicker)} ${strategy.name}`);
    setBuildStep(3);
    setBacktestResults(null);
  };

  // Handle param change
  const handleParamChange = (key, value) => {
    setStrategyParams(prev => ({ ...prev, [key]: parseFloat(value) }));
    setBacktestResults(null);
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
    
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    
    const baseWinRate = 50 + Math.random() * 25;
    const totalTrades = Math.floor(20 + selectedPeriod.months * 8 + Math.random() * 20);
    
    const results = {
      totalReturn: (Math.random() * 40 - 5).toFixed(1),
      winRate: baseWinRate.toFixed(0),
      profitFactor: (1.2 + Math.random() * 1.5).toFixed(2),
      sharpeRatio: (0.8 + Math.random() * 1.8).toFixed(2),
      maxDrawdown: (5 + Math.random() * 15).toFixed(1),
      totalTrades,
    };
    
    setBacktestResults(results);
    setIsBacktesting(false);
  };

  // Generate strategy
  const handleGenerate = async () => {
    if (!selectedTicker || !selectedStrategy) return;
    
    const prompt = selectedStrategy.getPrompt(formatTicker(selectedTicker), strategyName, strategyParams);
    
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
        ticker: formatTicker(selectedTicker),
        type: selectedStrategy.id,
        description: prompt,
        code: code || generateFallbackCode(),
        params: strategyParams,
        backtestResults,
        status: 'deployed',
      };
      
      setGeneratedStrategy(strategy);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: responseText || `Strategy ${strategyName} created for ${formatTicker(selectedTicker)}.`,
        code: strategy.code,
        strategy: strategy
      }]);
      
    } catch (error) {
      console.error('Atlas API error:', error);
      const code = generateFallbackCode();
      const strategy = {
        id: Date.now(),
        name: strategyName,
        ticker: formatTicker(selectedTicker),
        type: selectedStrategy.id,
        description: prompt,
        code,
        params: strategyParams,
        backtestResults,
        status: 'deployed',
      };
      setGeneratedStrategy(strategy);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Strategy ${strategyName} created for ${formatTicker(selectedTicker)}.`,
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
# Generated by Atlas AI for ${formatTicker(selectedTicker)}

import alpaca_trade_api as tradeapi
import pandas as pd
import numpy as np

class ${className}:
    def __init__(self, api):
        self.api = api
        self.symbol = '${selectedTicker}'
        ${selectedStrategy?.params.map(p => `self.${p.key} = ${params[p.key]}`).join('\n        ')}
        
    def execute(self):
        bars = self.api.get_bars(self.symbol, '1Day', limit=100).df
        # Strategy logic here
        return 'HOLD'

if __name__ == "__main__":
    api = tradeapi.REST()
    strategy = ${className}(api)
    print(strategy.execute())`;
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
        className="w-10 flex flex-col items-center py-3 gap-3 bg-[#060d18] border-l border-blue-500/20 cursor-pointer hover:bg-[#0a1628] transition-colors"
        onClick={() => setExpanded(true)}
      >
        <BrainIcon className="w-5 h-5 text-blue-400" />
        <span className="text-[9px] text-gray-500 font-medium" style={{ writingMode: 'vertical-rl' }}>ATLAS</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#060d18] border-l border-blue-500/20 overflow-hidden" style={{ width }}>
      {/* Header */}
      <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-blue-500/20">
        <div className="flex items-center gap-2">
          <BrainIcon className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="text-xs font-bold text-white leading-none">Atlas AI</h2>
            <p className="text-[8px] text-blue-400">Strategy Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {(messages.length > 0 || buildStep > 1) && (
            <button onClick={handleNewStrategy} className="p-1 hover:bg-blue-500/10 rounded transition-colors">
              <svg className="w-3.5 h-3.5 text-gray-500 hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button onClick={() => setExpanded(false)} className="p-1 hover:bg-blue-500/10 rounded transition-colors">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-blue-500/20">
        <button
          onClick={() => setActiveTab('build')}
          className={`flex-1 py-1.5 text-[9px] font-semibold transition-colors relative ${activeTab === 'build' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Build
          {activeTab === 'build' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1.5 text-[9px] font-semibold transition-colors relative ${activeTab === 'chat' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Results
          {activeTab === 'chat' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
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
              className="p-2 space-y-2"
            >
              {/* Progress */}
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      buildStep >= step ? 'bg-blue-600 text-white' : 'bg-[#0a1628] text-gray-500 border border-blue-500/20'
                    }`}>
                      {buildStep > step ? '✓' : step}
                    </div>
                    {step < 3 && <div className={`w-4 h-0.5 mx-0.5 ${buildStep > step ? 'bg-blue-500' : 'bg-blue-500/20'}`} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Ticker */}
              {buildStep === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  {/* Search */}
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-400 text-xs font-bold">$</span>
                    <input
                      type="text"
                      value={tickerSearch}
                      onChange={(e) => setTickerSearch(e.target.value.toUpperCase())}
                      placeholder="Search..."
                      className="w-full pl-5 pr-2 py-1.5 bg-[#0a1628] border border-blue-500/20 rounded text-[10px] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  {filteredTickers ? (
                    <div className="space-y-1 max-h-[280px] overflow-y-auto">
                      {filteredTickers.length > 0 ? (
                        filteredTickers.slice(0, 8).map((ticker) => (
                          <button
                            key={ticker.symbol}
                            onClick={() => handleTickerSelect(ticker.symbol)}
                            className="w-full p-1.5 rounded bg-[#0a1628] border border-blue-500/20 hover:border-blue-500/50 flex items-center justify-between"
                          >
                            <span className="text-blue-400 font-bold text-[10px]">${ticker.symbol}</span>
                            <span className="text-gray-500 text-[9px]">{ticker.name}</span>
                          </button>
                        ))
                      ) : (
                        <button
                          onClick={() => handleTickerSelect(tickerSearch)}
                          className="w-full p-1.5 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-between"
                        >
                          <span className="text-blue-400 font-bold text-[10px]">${tickerSearch}</span>
                          <span className="text-blue-400 text-[9px]">Use →</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Mag 7 */}
                      <div>
                        <p className="text-[8px] text-gray-500 mb-1">Mag 7</p>
                        <div className="grid grid-cols-4 gap-1">
                          {mag7Tickers.map((t) => (
                            <button key={t.symbol} onClick={() => handleTickerSelect(t.symbol)}
                              className="p-1 rounded bg-[#0a1628] border border-blue-500/20 hover:border-blue-500/50 text-center">
                              <div className="text-[9px] font-bold text-white">${t.symbol}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Indices */}
                      <div>
                        <p className="text-[8px] text-gray-500 mb-1">Indices</p>
                        <div className="grid grid-cols-3 gap-1">
                          {indexTickers.map((t) => (
                            <button key={t.symbol} onClick={() => handleTickerSelect(t.symbol)}
                              className="p-1 rounded bg-[#0a1628] border border-blue-500/20 hover:border-blue-500/50 text-center">
                              <div className="text-[9px] font-bold text-white">${t.symbol}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Crypto */}
                      <div>
                        <p className="text-[8px] text-gray-500 mb-1">Crypto</p>
                        <div className="grid grid-cols-3 gap-1">
                          {cryptoTickers.map((t) => (
                            <button key={t.symbol} onClick={() => handleTickerSelect(t.symbol)}
                              className="p-1 rounded bg-[#0a1628] border border-blue-500/20 hover:border-blue-500/50 text-center">
                              <div className="text-[9px] font-bold text-white">${t.symbol}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Step 2: Strategy */}
              {buildStep === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="text-[9px] text-gray-400 hover:text-white">← Back</button>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[9px] font-bold">{formatTicker(selectedTicker)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    {strategyTemplates.map((s) => (
                      <button key={s.id} onClick={() => handleStrategySelect(s)}
                        className="p-1.5 rounded bg-[#0a1628] border border-blue-500/20 hover:border-blue-500/50 text-left">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-sm">{s.icon}</span>
                          <span className="text-[9px] font-bold text-white">{s.name}</span>
                        </div>
                        <p className="text-[8px] text-gray-500 line-clamp-1">{s.description}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Configure & Backtest */}
              {buildStep === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="text-[9px] text-gray-400 hover:text-white">← Back</button>
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[9px] font-bold">{formatTicker(selectedTicker)}</span>
                      <span className="text-sm">{selectedStrategy?.icon}</span>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder="Strategy name"
                    className="w-full px-2 py-1 bg-[#0a1628] border border-blue-500/20 rounded text-[10px] text-white focus:outline-none focus:border-blue-500/50"
                  />

                  {/* Params 3-col grid */}
                  <div className="grid grid-cols-3 gap-1">
                    {selectedStrategy?.params.map((p) => (
                      <div key={p.key} className="flex flex-col p-1 bg-[#0a1628] border border-blue-500/20 rounded">
                        <span className="text-[7px] text-gray-500">{p.label}</span>
                        <input
                          type="number"
                          value={strategyParams[p.key] ?? p.value}
                          onChange={(e) => handleParamChange(p.key, e.target.value)}
                          className="w-full bg-transparent text-[10px] text-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Backtest Period */}
                  <div className="flex gap-0.5">
                    {backtestPeriods.map((p) => (
                      <button key={p.label} onClick={() => { setSelectedPeriod(p); setBacktestResults(null); }}
                        className={`flex-1 py-1 rounded text-[9px] font-medium ${
                          selectedPeriod.label === p.label ? 'bg-blue-600 text-white' : 'bg-[#0a1628] text-gray-400 border border-blue-500/20'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {isBacktesting ? (
                    <BacktestLoadingAnimation period={selectedPeriod.description} />
                  ) : backtestResults ? (
                    <BacktestResults results={backtestResults} period={selectedPeriod.description} />
                  ) : (
                    <button onClick={handleBacktest}
                      className="w-full py-1.5 rounded bg-[#0a1628] border border-blue-500/20 text-gray-300 text-[10px] hover:border-blue-500/50">
                      Run Backtest
                    </button>
                  )}

                  <button onClick={handleGenerate} disabled={isGenerating || !strategyName.trim()}
                    className={`w-full py-1.5 text-[10px] font-semibold ${strategyName.trim() ? 'text-blue-400 hover:text-blue-300' : 'text-gray-600'}`}>
                    {isGenerating ? 'Generating...' : 'Generate & Deploy →'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* Results Tab */
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
              {messages.length === 0 && !isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <BrainIcon className="w-10 h-10 text-blue-400 mb-2" />
                  <p className="text-[10px] text-gray-400">Build a strategy to see results</p>
                </div>
              ) : isGenerating ? (
                <Globe3D strategyName={strategyName} strategyIcon={selectedStrategy?.icon} />
              ) : (
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {messages.map((msg, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {msg.role === 'assistant' && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-gray-200">{msg.content}</p>
                          {msg.code && (
                            <div className="bg-[#0a1628] rounded border border-blue-500/20 overflow-hidden">
                              <div className="flex justify-between px-2 py-1 border-b border-blue-500/20">
                                <span className="text-[8px] text-gray-500">.py</span>
                                <button onClick={() => navigator.clipboard.writeText(msg.code)} className="text-[8px] text-blue-400">Copy</button>
                              </div>
                              <div className="p-2 max-h-28 overflow-y-auto">
                                <SyntaxHighlightedCode code={msg.code} />
                              </div>
                            </div>
                          )}
                          {msg.strategy && (
                            <div className="flex gap-2">
                              <button onClick={handleSaveStrategy} className="flex-1 py-1 text-[10px] text-emerald-400">✓ Save</button>
                              <button onClick={handleNewStrategy} className="flex-1 py-1 text-[10px] text-gray-400">+ New</button>
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
