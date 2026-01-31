import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// AI spark icon (outlined) - matches Kraken purple
const AtlasIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" stroke="#7B61FF" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
  </svg>
);

// Syntax Highlighter Component for Python code
const SyntaxHighlightedCode = ({ code, isTyping }) => {
  const highlightCode = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    
    return lines.map((line, lineIdx) => {
      if (line.trim().startsWith('#')) {
        return (
          <div key={lineIdx} className="text-[#6b6b80]">{line}</div>
        );
      }
      
      const keywords = ['from', 'import', 'class', 'def', 'self', 'if', 'elif', 'else', 'and', 'or', 'not', 'return', 'True', 'False', 'None'];
      const builtins = ['Strategy', 'super', 'len', 'range', 'print'];
      
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
          while (i < line.length && line[i] !== quote) {
            str += line[i];
            i++;
          }
          str += quote;
          parts.push({ type: 'string', value: str });
          i++;
          continue;
        }
        
        if (/\d/.test(char) && (current === '' || /[\s\(\[,=<>]/.test(current[current.length - 1]))) {
          if (current) parts.push({ type: 'text', value: current });
          current = '';
          let num = '';
          while (i < line.length && /[\d.]/.test(line[i])) {
            num += line[i];
            i++;
          }
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
            if (part.type === 'string') {
              return <span key={partIdx} className="text-emerald-400">{part.value}</span>;
            }
            if (part.type === 'number') {
              return <span key={partIdx} className="text-amber-400">{part.value}</span>;
            }
            
            let text = part.value;
            let elements = [];
            const tokens = text.split(/(\b)/);
            
            tokens.forEach((token, tokenIdx) => {
              if (keywords.includes(token)) {
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-purple-400">{token}</span>);
              } else if (builtins.includes(token)) {
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-cyan-400">{token}</span>);
              } else if (token.startsWith('self.')) {
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-purple-400">self</span>);
                elements.push(<span key={`${partIdx}-${tokenIdx}-dot`} className="text-white">{token.slice(4)}</span>);
              } else {
                elements.push(<span key={`${partIdx}-${tokenIdx}`} className="text-white">{token}</span>);
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
      {isTyping && <span className="animate-pulse text-purple-400 ml-0.5">▊</span>}
    </pre>
  );
};

// Popular tickers for quick selection
const popularTickers = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'Nasdaq' },
  { symbol: 'AMZN', name: 'Amazon' },
];

// Strategy templates
const strategyTemplates = [
  { 
    icon: '📈', 
    name: 'Momentum', 
    prompt: (ticker) => `Create a momentum strategy for ${ticker}. Buy when 20-day MA crosses above 50-day MA with RSI above 50. Sell when MA crosses below or RSI drops under 40. Use 2% position size.`
  },
  { 
    icon: '📊', 
    name: 'RSI Oversold', 
    prompt: (ticker) => `Build an RSI mean reversion strategy for ${ticker}. Enter long when RSI drops below 30, exit when RSI crosses above 70. Risk 2% per trade with 5% stop loss.`
  },
  { 
    icon: '🔄', 
    name: 'Mean Reversion', 
    prompt: (ticker) => `Create a Bollinger Band mean reversion strategy for ${ticker}. Buy when price touches lower band, sell at middle band. Use 20-period bands with 2 standard deviations.`
  },
  { 
    icon: '💹', 
    name: 'Breakout', 
    prompt: (ticker) => `Build a breakout strategy for ${ticker}. Enter when price breaks above 20-day high with volume 50% above average. Trail stop at 2 ATR.`
  },
  { 
    icon: '⚡', 
    name: 'MACD Cross', 
    prompt: (ticker) => `Create a MACD crossover strategy for ${ticker}. Buy when MACD crosses above signal line below zero, sell when MACD crosses below signal. 3% position size.`
  },
];

// Welcome State Component
const WelcomeState = ({ onTickerSelect, selectedTicker, onStrategySelect, onClearTicker }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full px-4 py-8"
    >
      {!selectedTicker ? (
        <>
          {/* Welcome Message */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <AtlasIcon className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Hey! I'm Atlas 👋</h3>
          <p className="text-sm text-[#8b8b9b] text-center mb-6 max-w-[250px]">
            Your AI trading strategist. Pick a ticker to get started.
          </p>
          
          {/* Ticker Chips */}
          <div className="w-full">
            <p className="text-xs text-[#6b6b80] mb-2 text-center">Popular Tickers</p>
            <div className="flex flex-wrap justify-center gap-2">
              {popularTickers.map((ticker) => (
                <motion.button
                  key={ticker.symbol}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onTickerSelect(ticker.symbol)}
                  className="px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#252540] border border-[#2a2a3d] hover:border-purple-500/50 rounded-full text-sm font-medium text-white transition-all"
                >
                  {ticker.symbol}
                </motion.button>
              ))}
            </div>
          </div>
          
          {/* Or type hint */}
          <p className="text-xs text-[#4a4a5a] mt-6">
            Or describe your strategy below ↓
          </p>
        </>
      ) : (
        <>
          {/* Ticker Selected - Show Strategies */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-2xl font-bold text-white">{selectedTicker}</span>
              <button 
                onClick={onClearTicker}
                className="p-1 hover:bg-[#2a2a3d] rounded-full transition-colors"
              >
                <svg className="w-4 h-4 text-[#6b6b80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-sm text-[#8b8b9b] text-center mb-4">
              Choose a strategy type
            </p>
            
            {/* Strategy Chips */}
            <div className="space-y-2">
              {strategyTemplates.map((strategy) => (
                <motion.button
                  key={strategy.name}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onStrategySelect(strategy.prompt(selectedTicker), `${selectedTicker} ${strategy.name}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#0f0f18] hover:bg-[#1a1a2e] border border-[#1e1e2d] hover:border-purple-500/30 rounded-xl transition-all text-left group"
                >
                  <span className="text-xl">{strategy.icon}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                      {strategy.name}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-[#4a4a5a] group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              ))}
            </div>
            
            {/* Custom option */}
            <p className="text-xs text-[#4a4a5a] mt-4 text-center">
              Or type a custom strategy below ↓
            </p>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default function RightPanel({ width, alpacaData, theme, themeClasses, onStrategyGenerated, onDemoStateChange, onStrategyAdded, editingStrategy, onClearEdit }) {
  const [expanded, setExpanded] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [demoActive, setDemoActive] = useState(false);
  const [displayedAtlasText, setDisplayedAtlasText] = useState('');
  const [displayedCode, setDisplayedCode] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [showUserMessage, setShowUserMessage] = useState(false);
  const [showAtlasResponse, setShowAtlasResponse] = useState(false);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  const [isTypingAtlas, setIsTypingAtlas] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const messagesEndRef = useRef(null);

  // Check if we should show welcome state
  const showWelcome = !showUserMessage && !showAtlasResponse && !isGenerating;
  
  const handleTickerSelect = (ticker) => {
    setSelectedTicker(ticker);
  };
  
  const handleClearTicker = () => {
    setSelectedTicker(null);
  };
  
  const handleStrategySelect = (prompt, name) => {
    setInputValue(prompt);
    setStrategyName(name);
    setSelectedTicker(null);
    // Auto-submit after a brief moment
    setTimeout(() => {
      handleSubmitWithValues(prompt, name);
    }, 100);
  };

  const extractStrategyDetails = (description) => {
    const upperWords = description.toUpperCase().match(/\b[A-Z]{2,5}\b/g) || [];
    const ignore = new Set(['RSI', 'MACD', 'SMA', 'EMA', 'ATR', 'VWAP', 'USD', 'BTC', 'ETH']);
    const symbol = upperWords.find(word => !ignore.has(word)) || 'SPY';
    const timeframeMatch = description.match(/\b(\d+)\s*(min|minute|minutes|hour|hours|day|days|week|weeks)\b/i);
    const timeframe = timeframeMatch ? `${timeframeMatch[1]} ${timeframeMatch[2]}` : 'daily';
    const stopLossMatch = description.match(/stop\s*loss[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
    const takeProfitMatch = description.match(/(?:take\s*profit|tp)[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
    const drawdownMatch = description.match(/max\s*drawdown[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
    const positionMatch = description.match(/(?:position\s*size|risk)[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%/i);

    return {
      symbol,
      timeframe,
      risk: {
        stopLoss: stopLossMatch ? parseFloat(stopLossMatch[1]) : 5,
        takeProfit: takeProfitMatch ? parseFloat(takeProfitMatch[1]) : 12,
        maxDrawdown: drawdownMatch ? parseFloat(drawdownMatch[1]) : 20,
        positionSize: positionMatch ? parseFloat(positionMatch[1]) : 2,
      },
    };
  };

  const generateStrategyCode = (description, name, riskOverrides) => {
    const hasRSI = /rsi/i.test(description);
    const hasMACD = /macd/i.test(description);
    const hasMA = /moving average|ma |sma|ema/i.test(description);
    const hasBollinger = /bollinger/i.test(description);
    const hasVolume = /volume/i.test(description);
    const hasATR = /atr/i.test(description);
    const positionSize = Number.isFinite(riskOverrides?.positionSize) ? riskOverrides.positionSize / 100 : 0.02;
    const stopLoss = Number.isFinite(riskOverrides?.stopLoss) ? riskOverrides.stopLoss / 100 : 0.05;
    const takeProfit = Number.isFinite(riskOverrides?.takeProfit) ? riskOverrides.takeProfit / 100 : 0.12;
    
    let code = `# ${name}\n# Generated by Stratify AI\n\nfrom stratify import Strategy\n\nclass ${name.replace(/[^a-zA-Z0-9]/g, '')}(Strategy):\n    def __init__(self):\n`;
    
    if (hasRSI) code += `        self.rsi_period = 14\n        self.oversold = 30\n        self.overbought = 70\n`;
    if (hasMACD) code += `        self.fast = 12\n        self.slow = 26\n        self.signal = 9\n`;
    if (hasMA) code += `        self.fast_period = 20\n        self.slow_period = 50\n`;
    if (hasBollinger) code += `        self.bb_period = 20\n        self.bb_std = 2.0\n`;
    
    code += `        self.position_size = ${positionSize.toFixed(4)}\n        self.stop_loss = ${stopLoss.toFixed(4)}\n        self.take_profit = ${takeProfit.toFixed(4)}\n\n    def on_bar(self, bar):\n`;
    
    if (hasRSI) {
      code += `        rsi = self.indicators.RSI(self.rsi_period)\n`;
      if (hasVolume) {
        code += `        avg_volume = self.indicators.SMA_volume(20)\n`;
        code += `        if rsi < self.oversold and bar.volume > avg_volume * 1.2:\n            self.buy(size=self.position_size)\n`;
      } else {
        code += `        if rsi < self.oversold:\n            self.buy(size=self.position_size)\n`;
      }
      code += `        elif rsi > self.overbought:\n            self.sell()\n`;
    } else if (hasMACD) {
      code += `        macd = self.indicators.MACD(self.fast, self.slow, self.signal)\n`;
      code += `        if macd['macd'] > macd['signal']:\n            self.buy(size=self.position_size)\n`;
      code += `        elif macd['macd'] < macd['signal']:\n            self.sell()\n`;
    } else if (hasMA) {
      code += `        fast_ma = self.indicators.SMA(self.fast_period)\n`;
      code += `        slow_ma = self.indicators.SMA(self.slow_period)\n`;
      if (hasVolume) {
        code += `        avg_volume = self.indicators.SMA_volume(20)\n`;
        code += `        if fast_ma > slow_ma and bar.volume > avg_volume * 1.2:\n            self.buy(size=self.position_size)\n`;
      } else {
        code += `        if fast_ma > slow_ma:\n            self.buy(size=self.position_size)\n`;
      }
      code += `        elif fast_ma < slow_ma:\n            self.sell()\n`;
    } else if (hasBollinger) {
      code += `        sma = self.indicators.SMA(self.bb_period)\n`;
      code += `        std = self.indicators.STDDEV(self.bb_period)\n`;
      code += `        upper = sma + (std * self.bb_std)\n        lower = sma - (std * self.bb_std)\n`;
      if (hasVolume) {
        code += `        avg_volume = self.indicators.SMA_volume(20)\n`;
        code += `        if bar.close < lower and bar.volume > avg_volume * 1.2:\n            self.buy(size=self.position_size)\n        elif bar.close > upper:\n            self.sell()\n`;
      } else {
        code += `        if bar.close < lower:\n            self.buy(size=self.position_size)\n        elif bar.close > upper:\n            self.sell()\n`;
      }
    } else {
      code += `        # Custom logic based on your description\n`;
      code += `        price = bar.close\n`;
      code += `        if self.should_buy(price):\n            self.buy(size=self.position_size)\n`;
      code += `        elif self.should_sell(price):\n            self.sell()\n`;
    }

    if (hasATR) {
      code += `\n        atr = self.indicators.ATR(14)\n        self.set_trailing_stop(atr * 2)\n`;
    }
    
    return code;
  };

  const generateMockAtlasResponse = (description, name) => {
    const details = extractStrategyDetails(description);
    const indicators = [];
    if (/rsi/i.test(description)) indicators.push('RSI mean reversion');
    if (/macd/i.test(description)) indicators.push('MACD momentum');
    if (/bollinger/i.test(description)) indicators.push('Bollinger band stretch');
    if (/sma|ema|moving average/i.test(description)) indicators.push('moving average trend filter');
    if (/volume/i.test(description)) indicators.push('volume confirmation');
    if (!indicators.length) indicators.push('price action triggers');

    const response = `Here's a ${name} blueprint for ${details.symbol} on the ${details.timeframe} timeframe.\n` +
      `Entry logic leans on ${indicators.join(', ')}, with exits layered by stop-loss and take-profit.\n` +
      `Risk defaults: ${details.risk.stopLoss}% SL, ${details.risk.takeProfit}% TP, ${details.risk.positionSize}% position size, ${details.risk.maxDrawdown}% max drawdown.`;

    return {
      response,
      code: generateStrategyCode(description, name, details.risk),
      risk: details.risk,
    };
  };
  
  // Handle submission with explicit values (for quick actions)
  const handleSubmitWithValues = async (promptValue, nameValue) => {
    const name = nameValue || `Strategy ${Date.now() % 10000}`;
    const userInput = promptValue;
    
    setDemoActive(false);
    setUserMessage(userInput);
    setShowUserMessage(true);
    setIsGenerating(true);
    setInputValue('');
    setStrategyName('');
    
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          strategy_name: name
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      let extractedCode = data.code;
      let responseText = data.response || '';
      
      if (!extractedCode && responseText) {
        const codeMatch = responseText.match(/```(?:python)?\n([\s\S]*?)```/);
        if (codeMatch) {
          extractedCode = codeMatch[1].trim();
          responseText = responseText.split('```')[0].trim();
        }
      }
      
      const placeholderResponse = /placeholder/i.test(responseText || '');
      const fallback = !responseText || placeholderResponse;

      const metrics = {
        winRate: (55 + Math.random() * 20).toFixed(1),
        profitFactor: (1.5 + Math.random() * 1.5).toFixed(2),
        sharpeRatio: (1.2 + Math.random() * 1.3).toFixed(2),
        maxDrawdown: (8 + Math.random() * 12).toFixed(1)
      };

      const fallbackPayload = fallback ? generateMockAtlasResponse(userInput, name) : null;
      const derivedRisk = fallbackPayload?.risk || extractStrategyDetails(userInput).risk;
      const strategy = {
        id: Date.now(),
        name: name,
        description: userInput,
        code: extractedCode || fallbackPayload?.code || generateStrategyCode(userInput, name, derivedRisk),
        status: 'draft',
        metrics: metrics,
        risk: derivedRisk
      };
      
      setGeneratedStrategy(strategy);
      setDisplayedAtlasText(
        fallback ? (fallbackPayload?.response || `I've created a ${name} based on your description:`) : responseText
      );
      setDisplayedCode(strategy.code);
      setShowAtlasResponse(true);
      setShowSaveButton(true);
      
    } catch (error) {
      console.error('Atlas API error:', error);
      const fallbackPayload = generateMockAtlasResponse(userInput, name);
      const code = fallbackPayload.code;
      const metrics = {
        winRate: (55 + Math.random() * 20).toFixed(1),
        profitFactor: (1.5 + Math.random() * 1.5).toFixed(2),
        sharpeRatio: (1.2 + Math.random() * 1.3).toFixed(2),
        maxDrawdown: (8 + Math.random() * 12).toFixed(1)
      };
      
      const strategy = {
        id: Date.now(),
        name: name,
        description: userInput,
        code: code,
        status: 'draft',
        metrics: metrics,
        risk: fallbackPayload.risk
      };
      
      setGeneratedStrategy(strategy);
      setDisplayedAtlasText(fallbackPayload.response);
      setDisplayedCode(code);
      setShowAtlasResponse(true);
      setShowSaveButton(true);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle user submission from input
  const handleSubmit = async () => {
    if (!inputValue.trim()) return;
    const name = strategyName.trim() || `Strategy ${Date.now() % 10000}`;
    handleSubmitWithValues(inputValue, name);
  };
  
  const handleAddStrategy = () => {
    if (generatedStrategy && onStrategyGenerated) {
      onStrategyGenerated(generatedStrategy);
      setShowSaveButton(false);
      setTimeout(() => {
        setShowUserMessage(false);
        setShowAtlasResponse(false);
        setDisplayedAtlasText('');
        setDisplayedCode('');
        setGeneratedStrategy(null);
        setSelectedTicker(null);
      }, 2000);
    }
  };

  // New chat function
  const handleNewChat = () => {
    setShowUserMessage(false);
    setShowAtlasResponse(false);
    setDisplayedAtlasText('');
    setDisplayedCode('');
    setGeneratedStrategy(null);
    setSelectedTicker(null);
    setInputValue('');
    setStrategyName('');
    setShowSaveButton(false);
    setUserMessage('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayedAtlasText, displayedCode, showAtlasResponse, showUserMessage]);

  useEffect(() => {
    if (editingStrategy) {
      setInputValue(editingStrategy.description || '');
      setShowUserMessage(false);
      setShowAtlasResponse(false);
      setShowSaveButton(false);
    }
  }, [editingStrategy]);

  if (!expanded) {
    return (
      <div 
        className={`w-12 flex flex-col items-center py-4 gap-4 ${themeClasses.surfaceElevated} cursor-pointer transition-all duration-200 hover:bg-[#2a2a3d]`}
        onClick={() => setExpanded(true)}
      >
        <div className="flex flex-col items-center gap-1">
          <AtlasIcon className="w-6 h-6" />
          <span className="text-[8px] text-gray-500">AI</span>
        </div>
        <div className="mt-auto">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex flex-col ${themeClasses.surfaceElevated} overflow-hidden transition-all duration-200`}
      style={{ width }}
    >
      {/* Header */}
      <div className="h-14 flex-shrink-0 flex items-center justify-between px-4 border-b border-[#1e1e2d] bg-[#0a0a10]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <AtlasIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">Atlas</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xs text-emerald-400">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* New Chat Button */}
          {!showWelcome && (
            <button 
              onClick={handleNewChat}
              className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors"
              title="New Chat"
            >
              <svg className="w-4 h-4 text-[#6b6b80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button 
            onClick={() => setExpanded(false)}
            className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-[#6b6b80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        
        {/* Welcome State */}
        {showWelcome && (
          <WelcomeState 
            onTickerSelect={handleTickerSelect}
            selectedTicker={selectedTicker}
            onStrategySelect={handleStrategySelect}
            onClearTicker={handleClearTicker}
          />
        )}

        {/* User Message Bubble */}
        <AnimatePresence>
          {showUserMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex justify-end mb-3"
            >
              <div className="max-w-[85%] bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-sm shadow-lg shadow-purple-500/20">
                {userMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generating indicator */}
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mb-3"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <AtlasIcon className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </motion.div>
        )}

        {/* Atlas Response */}
        <AnimatePresence>
          {showAtlasResponse && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-[#0a0a10] border border-[#1e1e2d] rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                  <AtlasIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-purple-400 text-sm font-semibold">Atlas</span>
              </div>
              
              {displayedAtlasText && (
                <div className="text-sm text-[#e0e0e6] mb-3">
                  {displayedAtlasText}
                </div>
              )}
              
              {displayedCode && (
                <div className="space-y-3">
                  <div className="bg-[#06060c] rounded-lg p-4 border border-[#1e1e2d]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                          <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                        </div>
                        <span className="text-xs text-[#6b6b80] ml-2">strategy.py</span>
                      </div>
                      <button 
                        onClick={() => navigator.clipboard.writeText(displayedCode)}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <SyntaxHighlightedCode code={displayedCode} isTyping={isTypingAtlas} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {showSaveButton && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="flex justify-end pt-2"
                      >
                        <button 
                          onClick={generatedStrategy ? handleAddStrategy : undefined}
                          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          Save Strategy
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`border-t ${themeClasses.border} p-3 ${themeClasses.surfaceElevated} relative`}>
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your trading strategy..."
            rows={3}
            className={`w-full px-3 py-2 ${themeClasses.surface} border ${themeClasses.border} focus:border-purple-500 rounded-lg text-sm ${themeClasses.text} placeholder-gray-600 focus:outline-none transition-colors resize-none`}
          />
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isGenerating}
            className={`absolute right-2 bottom-2 p-1.5 transition-all rounded ${
              isGenerating
                ? 'text-purple-400 animate-pulse'
                : inputValue.trim()
                ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/20'
                : 'text-gray-600 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-500">Strategy Name</span>
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                handleSubmit();
              }
            }}
            placeholder="e.g. RSI Momentum"
            className={`flex-1 px-2 py-1 ${themeClasses.surface} border ${themeClasses.border} focus:border-purple-500 rounded text-xs ${themeClasses.text} placeholder-gray-600 focus:outline-none transition-colors`}
          />
        </div>
      </div>
    </div>
  );
}
