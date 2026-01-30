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
    
    // Split into lines for processing
    const lines = text.split('\n');
    
    return lines.map((line, lineIdx) => {
      // Check if it's a comment
      if (line.trim().startsWith('#')) {
        return (
          <div key={lineIdx} className="text-[#6b6b80]">{line}</div>
        );
      }
      
      // Tokenize the line
      let result = [];
      let remaining = line;
      let keyIdx = 0;
      
      // Keywords
      const keywords = ['from', 'import', 'class', 'def', 'self', 'if', 'elif', 'else', 'and', 'or', 'not', 'return', 'True', 'False', 'None'];
      const builtins = ['Strategy', 'super', 'len', 'range', 'print'];
      
      // Process the line character by character for better highlighting
      const parts = [];
      let current = '';
      let i = 0;
      
      while (i < line.length) {
        const char = line[i];
        
        // Check for strings
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
        
        // Check for numbers
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
      
      // Now highlight keywords in text parts
      return (
        <div key={lineIdx}>
          {parts.map((part, partIdx) => {
            if (part.type === 'string') {
              return <span key={partIdx} className="text-emerald-400">{part.value}</span>;
            }
            if (part.type === 'number') {
              return <span key={partIdx} className="text-amber-400">{part.value}</span>;
            }
            
            // Process text for keywords
            let text = part.value;
            let elements = [];
            
            // Split by word boundaries but keep delimiters
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

// Standard Mouse Arrow Cursor Component
const AnimatedCursor = ({ phase, target = 'submit' }) => {
  const isSubmit = target === 'submit' && (phase === 'cursor-submit' || phase === 'clicking-submit');
  const isAdd = target === 'add' && (phase === 'cursor-add' || phase === 'clicking-add');
  
  if (!isSubmit && !isAdd) return null;
  
  const isMoving = phase === 'cursor-submit' || phase === 'cursor-add';
  const isClicking = phase === 'clicking-submit' || phase === 'clicking-add';
  
  const duration = target === 'submit' ? 'duration-[2000ms]' : 'duration-[1500ms]';
  
  return (
    <div 
      className={`absolute z-50 pointer-events-none transition-all ${
        isMoving ? `${duration} ease-in-out` : 'duration-150'
      }`}
      style={{
        top: isMoving ? '-30px' : '4px',
        left: isMoving ? '20%' : '50%',
        transform: isClicking ? 'scale(0.9)' : 'scale(1)',
      }}
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none"
        className={`drop-shadow-xl transition-transform duration-100 ${isClicking ? 'translate-y-0.5' : ''}`}
      >
        {/* Standard mouse arrow cursor */}
        <path 
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
          fill="white"
          stroke="#000"
          strokeWidth="1.5"
        />
      </svg>
      {/* Click ripple effect */}
      {isClicking && (
        <div className={`absolute top-2 left-1 w-4 h-4 rounded-full animate-ping ${
          target === 'add' ? 'bg-emerald-400/60' : 'bg-blue-400/60'
        }`} />
      )}
    </div>
  );
};

// 5 Demo Strategies
const demoStrategies = [
  {
    userMessage: "Buy TSLA when RSI drops below 30 and sell when it goes above 70. Use 2% position size with a 5% stop loss.",
    atlasResponse: "I've created an RSI Reversal Strategy based on your description:",
    code: `# RSI Reversal Strategy
# Generated by Stratify AI

from stratify import Strategy

class RSIStrategy(Strategy):
    def __init__(self):
        self.rsi_period = 14
        self.oversold = 30
        self.overbought = 70
        self.position_size = 0.02
        self.stop_loss = 0.05

    def on_bar(self, bar):
        rsi = self.indicators.RSI(self.rsi_period)

        if rsi < self.oversold:
            self.buy(size=self.position_size)
        elif rsi > self.overbought:
            self.sell()`,
    name: 'RSI Reversal Strategy',
    metrics: { winRate: '67.3', profitFactor: '1.92', sharpeRatio: '1.84', maxDrawdown: '12.4' }
  },
  {
    userMessage: "Create a golden cross strategy for AAPL. Buy when 50-day MA crosses above 200-day MA, sell on death cross. Risk 3% per trade.",
    atlasResponse: "I've built a Golden Cross Strategy for moving average crossovers:",
    code: `# Golden Cross Strategy
# Generated by Stratify AI

from stratify import Strategy

class GoldenCross(Strategy):
    def __init__(self):
        self.fast_period = 50
        self.slow_period = 200
        self.position_size = 0.03

    def on_bar(self, bar):
        fast_ma = self.indicators.SMA(self.fast_period)
        slow_ma = self.indicators.SMA(self.slow_period)
        prev_fast = self.indicators.SMA(self.fast_period, 1)
        prev_slow = self.indicators.SMA(self.slow_period, 1)

        if prev_fast < prev_slow and fast_ma > slow_ma:
            self.buy(size=self.position_size)
        elif prev_fast > prev_slow and fast_ma < slow_ma:
            self.sell()`,
    name: 'Golden Cross Strategy',
    metrics: { winRate: '58.2', profitFactor: '2.14', sharpeRatio: '1.56', maxDrawdown: '18.7' }
  },
  {
    userMessage: "Build a breakout strategy for NVDA. Enter long when price breaks above the 20-day high with volume 50% above average. Trail stop at 2 ATR.",
    atlasResponse: "I've created a Volume Breakout Strategy with ATR trailing stops:",
    code: `# Volume Breakout Strategy
# Generated by Stratify AI

from stratify import Strategy

class VolumeBreakout(Strategy):
    def __init__(self):
        self.lookback = 20
        self.volume_threshold = 1.5
        self.atr_multiplier = 2.0

    def on_bar(self, bar):
        high_20 = self.indicators.highest(self.lookback)
        avg_volume = self.indicators.SMA_volume(self.lookback)
        atr = self.indicators.ATR(14)

        if bar.close > high_20 and bar.volume > avg_volume * self.volume_threshold:
            self.buy()
            self.set_trailing_stop(atr * self.atr_multiplier)

        if self.position:
            self.update_trailing_stop(atr * self.atr_multiplier)`,
    name: 'Volume Breakout Strategy',
    metrics: { winRate: '52.8', profitFactor: '2.67', sharpeRatio: '2.01', maxDrawdown: '15.3' }
  },
  {
    userMessage: "MACD momentum strategy for SPY. Buy when MACD crosses above signal line and both are below zero. Sell when MACD crosses below signal. 5% position size.",
    atlasResponse: "I've built a MACD Momentum Strategy optimized for trend reversals:",
    code: `# MACD Momentum Strategy
# Generated by Stratify AI

from stratify import Strategy

class MACDMomentum(Strategy):
    def __init__(self):
        self.fast = 12
        self.slow = 26
        self.signal = 9
        self.position_size = 0.05

    def on_bar(self, bar):
        macd = self.indicators.MACD(self.fast, self.slow, self.signal)
        macd_line = macd['macd']
        signal_line = macd['signal']
        prev_macd = macd['prev_macd']
        prev_signal = macd['prev_signal']

        if prev_macd < prev_signal and macd_line > signal_line:
            if macd_line < 0:
                self.buy(size=self.position_size)
        elif prev_macd > prev_signal and macd_line < signal_line:
            self.sell()`,
    name: 'MACD Momentum Strategy',
    metrics: { winRate: '61.5', profitFactor: '1.78', sharpeRatio: '1.42', maxDrawdown: '14.1' }
  },
  {
    userMessage: "Mean reversion for QQQ. Buy when price drops 2 standard deviations below 20-day mean. Sell at the mean. Max 4% risk per trade with 8% stop loss.",
    atlasResponse: "I've created a Mean Reversion Strategy using Bollinger Band logic:",
    code: `# Mean Reversion Strategy
# Generated by Stratify AI

from stratify import Strategy

class MeanReversion(Strategy):
    def __init__(self):
        self.period = 20
        self.std_dev = 2.0
        self.position_size = 0.04
        self.stop_loss = 0.08

    def on_bar(self, bar):
        sma = self.indicators.SMA(self.period)
        std = self.indicators.STDDEV(self.period)
        lower_band = sma - (std * self.std_dev)

        if bar.close < lower_band and not self.position:
            self.buy(size=self.position_size)
            self.set_stop_loss(self.stop_loss)

        if self.position and bar.close >= sma:
            self.sell()`,
    name: 'Mean Reversion Strategy',
    metrics: { winRate: '71.2', profitFactor: '1.65', sharpeRatio: '1.93', maxDrawdown: '9.8' }
  }
];

export default function RightPanel({ width, alpacaData, theme, themeClasses, onStrategyGenerated, onDemoStateChange, onStrategyAdded, editingStrategy, onClearEdit }) {
  const [expanded, setExpanded] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [demoPhase, setDemoPhase] = useState('idle');
  const [demoActive, setDemoActive] = useState(true); // Demo enabled for showcase
  const [displayedUserText, setDisplayedUserText] = useState('');
  const [displayedAtlasText, setDisplayedAtlasText] = useState('');
  const [displayedCode, setDisplayedCode] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [showUserMessage, setShowUserMessage] = useState(false);
  const [showAtlasResponse, setShowAtlasResponse] = useState(false);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [strategyIndex, setStrategyIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  const [isTypingUser, setIsTypingUser] = useState(false);
  const [isTypingAtlas, setIsTypingAtlas] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Typing speeds (ms per character) - slower for natural feel
  const USER_TYPING_SPEED = 45; // Human typing speed
  const ATLAS_TEXT_SPEED = 25;  // Atlas intro text
  const ATLAS_CODE_SPEED = 15;  // Code typing (faster)

  const currentDemo = demoStrategies[strategyIndex];
  const currentStrategy = {
    id: Date.now() + strategyIndex,
    name: currentDemo.name,
    description: currentDemo.userMessage,
    code: currentDemo.code,
    status: 'draft',
    metrics: currentDemo.metrics
  };
  
  // Stop demo when user starts typing
  const handleUserInput = (value) => {
    if (demoActive && value.length > 0) {
      setDemoActive(false);
      setDemoPhase('idle');
    }
    setInputValue(value);
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

  // Generate strategy code from description
  const generateStrategyCode = (description, name, riskOverrides) => {
    // Extract potential indicators from description
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

    const response = `Here’s a ${name} blueprint for ${details.symbol} on the ${details.timeframe} timeframe.\n` +
      `Entry logic leans on ${indicators.join(', ')}, with exits layered by stop-loss and take-profit.\n` +
      `Risk defaults: ${details.risk.stopLoss}% SL, ${details.risk.takeProfit}% TP, ${details.risk.positionSize}% position size, ${details.risk.maxDrawdown}% max drawdown.`;

    return {
      response,
      code: generateStrategyCode(description, name, details.risk),
      risk: details.risk,
    };
  };
  
  // Handle user submission
  const handleSubmit = async () => {
    if (!inputValue.trim()) return;
    
    const name = strategyName.trim() || `Strategy ${Date.now() % 10000}`;
    const userInput = inputValue;
    
    // Stop demo
    setDemoActive(false);
    setDemoPhase('idle');
    
    // Show user message
    setUserMessage(userInput);
    setShowUserMessage(true);
    setIsGenerating(true);
    
    // Clear inputs immediately
    setInputValue('');
    setStrategyName('');
    
    try {
      // Call Atlas AI backend
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/v1/chat/`, {
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
      
      // Extract code from markdown response if not provided separately
      let extractedCode = data.code;
      let responseText = data.response || '';
      
      if (!extractedCode && responseText) {
        // Extract code block from markdown (```python ... ``` or ``` ... ```)
        const codeMatch = responseText.match(/```(?:python)?\n([\s\S]*?)```/);
        if (codeMatch) {
          extractedCode = codeMatch[1].trim();
          // Get text before the code block as the response
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
      setShowAddButton(true);
      
    } catch (error) {
      console.error('Atlas API error:', error);
      // Fallback to local generation if API fails
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
      setShowAddButton(true);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Add generated strategy to Strategy Builder
  const handleAddStrategy = () => {
    if (generatedStrategy && onStrategyGenerated) {
      onStrategyGenerated(generatedStrategy);
      setShowAddButton(false);
      // Show confirmation briefly
      setTimeout(() => {
        // Reset for next strategy
        setShowUserMessage(false);
        setShowAtlasResponse(false);
        setDisplayedAtlasText('');
        setDisplayedCode('');
        setGeneratedStrategy(null);
      }, 2000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayedAtlasText, displayedCode, showAtlasResponse, showUserMessage, demoPhase]);

  // Handle editing an existing strategy
  useEffect(() => {
    if (editingStrategy) {
      setInputValue(editingStrategy.description || '');
      setDemoPhase('idle'); // Stop any demo
      setShowUserMessage(false);
      setShowAtlasResponse(false);
      setShowAddButton(false);
    }
  }, [editingStrategy]);

  // Start demo (only if demoActive) - with initial delay
  useEffect(() => {
    if (!demoActive) return;
    const timeout = setTimeout(() => {
      setDemoPhase('typing-user');
      setIsTypingUser(true);
      if (onDemoStateChange) onDemoStateChange('thinking');
    }, 3000); // 3 second initial delay
    return () => clearTimeout(timeout);
  }, [demoActive]);

  // Typewriter for user input (demo only) - SLOWER, more natural
  useEffect(() => {
    if (!demoActive || demoPhase !== 'typing-user') return;
    const message = currentDemo.userMessage;
    let index = 0;
    
    // Variable typing speed for natural feel
    const getTypingDelay = () => {
      const base = USER_TYPING_SPEED;
      // Pause longer at punctuation
      const lastChar = message[index - 1];
      if (['.', ',', '!', '?'].includes(lastChar)) return base + 150;
      if (lastChar === ' ') return base + 30;
      // Random variation
      return base + Math.random() * 30;
    };
    
    const typeNextChar = () => {
      if (index <= message.length) {
        setInputValue(message.slice(0, index));
        setDisplayedUserText(message.slice(0, index));
        index++;
        setTimeout(typeNextChar, getTypingDelay());
      } else {
        setIsTypingUser(false);
        // Pause before "sending"
        setTimeout(() => setDemoPhase('cursor-submit'), 1200);
      }
    };
    
    typeNextChar();
  }, [demoPhase, strategyIndex, demoActive]);

  // Cursor to submit - natural pause
  useEffect(() => {
    if (demoPhase !== 'cursor-submit') return;
    const clickTimeout = setTimeout(() => {
      setDemoPhase('clicking-submit');
      setTimeout(() => {
        setUserMessage(inputValue);
        setShowUserMessage(true);
        setInputValue('');
        setDisplayedUserText('');
        // Brief pause before Atlas starts responding
        setTimeout(() => {
          setShowAtlasResponse(true);
          setDemoPhase('typing-atlas');
          setIsTypingAtlas(true);
        }, 800);
      }, 400);
    }, 1500);
    return () => clearTimeout(clickTimeout);
  }, [demoPhase, inputValue]);

  // Typewriter for Atlas response - with syntax highlighting
  useEffect(() => {
    if (demoPhase !== 'typing-atlas') return;
    const atlasResponse = currentDemo.atlasResponse;
    const code = currentDemo.code;
    let textIndex = 0;
    let codeIndex = 0;
    let typingCode = false;

    const typeNext = () => {
      if (!typingCode && textIndex <= atlasResponse.length) {
        setDisplayedAtlasText(atlasResponse.slice(0, textIndex));
        textIndex++;
        setTimeout(typeNext, ATLAS_TEXT_SPEED + Math.random() * 15);
      } else if (!typingCode) {
        typingCode = true;
        // Small pause before code starts
        setTimeout(typeNext, 400);
      } else if (codeIndex <= code.length) {
        setDisplayedCode(code.slice(0, codeIndex));
        codeIndex++;
        // Faster for code, but pause at newlines
        const nextChar = code[codeIndex];
        const delay = nextChar === '\n' ? ATLAS_CODE_SPEED + 80 : ATLAS_CODE_SPEED;
        setTimeout(typeNext, delay);
      } else {
        setIsTypingAtlas(false);
        // Show Save button after typing completes
        setTimeout(() => {
          setShowSaveButton(true);
        }, 600);
      }
    };
    
    typeNext();
  }, [demoPhase, strategyIndex]);

  // Auto-rotate to next demo after Save button is shown
  useEffect(() => {
    if (!showSaveButton || !demoActive) return;
    
    // Wait 8 seconds showing the complete response, then rotate
    const rotateTimeout = setTimeout(() => {
      resetDemo();
    }, 8000);
    
    return () => clearTimeout(rotateTimeout);
  }, [showSaveButton, demoActive]);

  // Reset for next cycle
  const resetDemo = () => {
    setDemoPhase('idle');
    setInputValue('');
    setDisplayedUserText('');
    setUserMessage('');
    setShowUserMessage(false);
    setDisplayedAtlasText('');
    setDisplayedCode('');
    setShowAtlasResponse(false);
    setShowSaveButton(false);
    setIsTypingUser(false);
    setIsTypingAtlas(false);
    if (onDemoStateChange) onDemoStateChange('idle');
    
    // Move to next strategy
    setStrategyIndex(prev => (prev + 1) % demoStrategies.length);
    
    // Start next demo after pause
    setTimeout(() => {
      setDemoPhase('typing-user');
      setIsTypingUser(true);
      if (onDemoStateChange) onDemoStateChange('thinking');
    }, 3000);
  };

  // Expose resetDemo via window for Dashboard to call
  useEffect(() => {
    window.resetRightPanelDemo = resetDemo;
    return () => { delete window.resetRightPanelDemo; };
  }, [strategyIndex]);

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
        <button 
          onClick={() => setExpanded(false)}
          className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-[#6b6b80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        
        {/* User Message Bubble */}
        <AnimatePresence>
          {showUserMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex justify-end"
            >
              <div className="max-w-[85%] bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-sm shadow-lg shadow-purple-500/20">
                {userMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                {isTypingAtlas && (
                  <span className="text-[#6b6b80] text-xs">typing...</span>
                )}
              </div>
              
              {displayedAtlasText && (
                <div className="text-sm text-[#e0e0e6] mb-3">
                  {displayedAtlasText}
                  {isTypingAtlas && !displayedCode && <span className="animate-pulse text-purple-400 ml-0.5">▊</span>}
                </div>
              )}
              
              {displayedCode && (
                <div className="space-y-3">
                  {/* Code Block with Syntax Highlighting */}
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
                      <button className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                        Copy
                      </button>
                    </div>
                    <div className="overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <SyntaxHighlightedCode code={displayedCode} isTyping={isTypingAtlas} />
                    </div>
                  </div>

                  {/* Save Button - appears after typing completes */}
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
            onChange={(e) => handleUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your trading strategy..."
            rows={3}
            className={`w-full px-3 py-2 ${themeClasses.surface} border ${themeClasses.border} focus:border-blue-500 rounded-lg text-sm ${themeClasses.text} placeholder-gray-600 focus:outline-none transition-colors resize-none`}
            readOnly={demoActive && (demoPhase === 'typing-user' || demoPhase === 'cursor-submit')}
          />
          <div className="relative">
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isGenerating}
              className={`absolute right-2 bottom-2 p-1.5 transition-all rounded ${
                isGenerating
                  ? 'text-blue-400 animate-pulse'
                  : demoPhase === 'clicking-submit'
                  ? 'text-blue-300 scale-90'
                  : inputValue.trim()
                  ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20'
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
            {demoActive && (demoPhase === 'cursor-submit' || demoPhase === 'clicking-submit') && (
              <AnimatedCursor phase={demoPhase} target="submit" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-500">Strategy Name</span>
          <input
            type="text"
            value={strategyName}
            onChange={(e) => { setStrategyName(e.target.value); if (demoActive) setDemoActive(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                handleSubmit();
              }
            }}
            placeholder="e.g. RSI Momentum"
            className={`flex-1 px-2 py-1 ${themeClasses.surface} border ${themeClasses.border} focus:border-blue-500 rounded text-xs ${themeClasses.text} placeholder-gray-600 focus:outline-none transition-colors`}
            readOnly={demoActive && (demoPhase === 'typing-user' || demoPhase === 'cursor-submit')}
          />
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
