import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Brain Icon (thin line, matches left sidebar)
const BrainIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4.5C10 4.5 9 5.5 9 7c0-2-1.5-3-3-3s-2.5 1.5-2.5 3c0 1 .5 2 1 2.5-.5.5-1.5 1.5-1.5 3 0 2 1.5 3 3 3 .5 0 1-.1 1.5-.3 0 1.8 1.5 3.3 3.5 3.3" />
    <path d="M12 4.5c2 0 3 1 3 2.5 0-2 1.5-3 3-3s2.5 1.5 2.5 3c0 1-.5 2-1 2.5.5.5 1.5 1.5 1.5 3 0 2-1.5 3-3 3-.5 0-1-.1-1.5-.3 0 1.8-1.5 3.3-3.5 3.3" />
    <path d="M12 4.5v15" />
  </svg>
);

// Refresh Icon
const RefreshIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

// Send Icon
const SendIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

// Strategy templates
const strategyTemplates = [
  { id: 'momentum', name: 'Momentum', icon: '📈', desc: 'MA crossover trend following' },
  { id: 'rsi', name: 'RSI', icon: '📊', desc: 'Oversold/overbought reversals' },
  { id: 'meanrev', name: 'Mean Rev', icon: '🔄', desc: 'Bounce back to average' },
  { id: 'breakout', name: 'Breakout', icon: '💥', desc: 'Catch explosive moves' },
  { id: 'macd', name: 'MACD', icon: '⚡', desc: 'Signal line crossovers' },
  { id: 'scalp', name: 'Scalp', icon: '🎯', desc: 'Quick in-and-out trades' },
];

// Mag 7 + Indices
const stockTickers = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'SPY', 'QQQ', 'DIA'
];

// Crypto
const cryptoTickers = [
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'ADA', 'AVAX', 'DOT'
];

// Starter prompts for chat
const starterPrompts = [
  { label: 'RSI Reversal', prompt: 'Buy when RSI drops below 30, sell when it goes above 70' },
  { label: 'MA Crossover', prompt: 'Buy when 20-day MA crosses above 50-day MA, sell on cross below' },
  { label: 'Breakout', prompt: 'Buy when price breaks above 20-day high with volume spike' },
  { label: 'Mean Reversion', prompt: 'Buy when price is 2 standard deviations below 20-day mean' },
];

// Typewriter Streaming Component
const TypewriterStream = ({ strategyName, streamingText }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
        <span className="text-sm font-semibold text-white/90 tracking-wide">Generating: {strategyName}</span>
      </div>
      
      {/* Streaming Text Area */}
      <div className="flex-1 bg-gradient-to-br from-[#141424] via-[#0f1017] to-[#0b0b12] rounded-xl border border-white/10 p-3 overflow-auto shadow-[0_0_24px_rgba(59,130,246,0.12)] backdrop-blur-sm">
        <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">
          {streamingText}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-2 h-4 bg-emerald-400 ml-0.5"
          />
        </pre>
      </div>
      
      {/* Progress indicator */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 8, ease: 'linear' }}
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-300"
          />
        </div>
        <span className="text-[10px] text-gray-400">Building...</span>
      </div>
    </div>
  );
};

// Editable Code Block - Click to edit
const EditableCodeBlock = ({ code, name, onCodeChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef(null);

  const handleClick = () => {
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-[#141424] via-[#0f1017] to-[#0b0b12] rounded-xl border border-white/10 overflow-hidden shadow-[0_0_24px_rgba(16,185,129,0.08)] backdrop-blur-sm">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-white/10 flex-shrink-0 bg-white/5">
        <span className="text-xs text-gray-300">{name}.py</span>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <span className="text-[10px] text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/30">✏️ Editing...</span>
          ) : (
            <button 
              onClick={handleClick}
              className="text-[10px] text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/30 hover:bg-emerald-400/20 transition-colors"
            >
              Click to Edit
            </button>
          )}
          <button 
            onClick={() => navigator.clipboard.writeText(code)} 
            className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
      
      {/* Code Area - Click to Edit */}
      <div className="flex-1 overflow-hidden" onClick={!isEditing ? handleClick : undefined}>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            className="w-full h-full p-3 text-xs text-gray-200 bg-transparent font-mono resize-none focus:outline-none"
            spellCheck={false}
          />
        ) : (
          <pre className="w-full h-full p-3 text-xs text-gray-200 font-mono overflow-auto cursor-text hover:bg-white/5 transition-colors">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
};

// Chat Message Component
const ChatMessage = ({ message, isUser, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-emerald-500/80 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.45)]">
          <BrainIcon className="w-3.5 h-3.5 text-white/90" />
        </div>
        <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-300">Thinking...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.25)] ${
        isUser ? 'bg-white/10 border border-white/10' : 'bg-emerald-500/80'
      }`}>
        {isUser ? (
          <span className="text-xs text-white/80">U</span>
        ) : (
          <BrainIcon className="w-3.5 h-3.5 text-white/90" />
        )}
      </div>
      <div className={`flex-1 max-w-[85%] rounded-xl p-3 border backdrop-blur-sm ${
        isUser 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white/5 border-white/10 shadow-[0_0_18px_rgba(16,185,129,0.08)]'
      }`}>
        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.strategy && (
          <div className="mt-2 p-2 bg-emerald-500/10 rounded border border-emerald-400/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Strategy Ready</span>
            </div>
            <p className="text-xs text-gray-300">{message.strategy.name} for ${message.strategy.ticker}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component
export default function RightPanel({ width, onStrategyGenerated, onSaveToSidebar }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('quick'); // quick | chat | results
  
  // Quick Build State
  const [selectedTicker, setSelectedTicker] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [strategyName, setStrategyName] = useState('');
  const [backtestTimeframe, setBacktestTimeframe] = useState('');
  
  // Backtest timeframe options
  const timeframeOptions = [
    { id: '1m', label: '1M', fullLabel: '1 Month', months: 1 },
    { id: '3m', label: '3M', fullLabel: '3 Months', months: 3 },
    { id: '6m', label: '6M', fullLabel: '6 Months', months: 6 },
    { id: '9m', label: '9M', fullLabel: '9 Months', months: 9 },
    { id: '1y', label: '1Y', fullLabel: '1 Year', months: 12 },
  ];
  
  // Chat State
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatTicker, setChatTicker] = useState('');
  const [chatStrategyName, setChatStrategyName] = useState('');
  const [chatTimeframe, setChatTimeframe] = useState('6m');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  const [editableCode, setEditableCode] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Handle ticker select (toggle)
  const handleTickerSelect = (ticker) => {
    if (selectedTicker === ticker) {
      setSelectedTicker('');
      setStrategyName('');
    } else {
      setSelectedTicker(ticker);
      if (selectedTemplate) {
        setStrategyName(`$${ticker} ${selectedTemplate.name}`);
      }
    }
  };

  // Handle template select (toggle)
  const handleTemplateSelect = (template) => {
    if (selectedTemplate?.id === template.id) {
      setSelectedTemplate(null);
      setStrategyName(selectedTicker ? '' : strategyName);
    } else {
      setSelectedTemplate(template);
      if (selectedTicker) {
        setStrategyName(`$${selectedTicker} ${template.name}`);
      }
    }
  };

  // Reset everything
  const handleReset = () => {
    setSelectedTicker('');
    setSelectedTemplate(null);
    setStrategyName('');
    setBacktestTimeframe('');
    setMessages([]);
    setChatInput('');
    setChatTicker('');
    setChatStrategyName('');
    setChatTimeframe('6m');
    setGeneratedStrategy(null);
    setEditableCode('');
    setStreamingText('');
    setResultMessage('');
    setActiveTab('quick');
  };

  // Generate from Quick Build
  const handleQuickGenerate = async () => {
    if (!selectedTicker || !selectedTemplate || !strategyName || !backtestTimeframe) return;
    
    const selectedTimeframeObj = timeframeOptions.find(tf => tf.id === backtestTimeframe);
    const timeframeLabel = selectedTimeframeObj?.fullLabel || '6 Months';
    
    const prompt = `Create a ${selectedTemplate.name} trading strategy called "${strategyName}" for $${selectedTicker}. ${selectedTemplate.desc}. Backtest period: ${timeframeLabel}.`;
    await generateStrategy(prompt, strategyName, selectedTicker, timeframeLabel);
  };

  // Handle chat submit
  const handleChatSubmit = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || !chatTicker.trim() || !chatStrategyName.trim()) return;

    const userMessage = chatInput.trim();
    const ticker = chatTicker.toUpperCase();
    const name = chatStrategyName;
    const selectedTimeframeObj = timeframeOptions.find(tf => tf.id === chatTimeframe);
    const timeframeLabel = selectedTimeframeObj?.fullLabel || '6 Months';

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsThinking(true);

    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'https://stratify-backend-production-3ebd.up.railway.app';
      const prompt = `Create a trading strategy called "${name}" for $${ticker}. ${userMessage}. Backtest period: ${timeframeLabel}.`;
      
      const response = await fetch(`${backendUrl}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, strategy_name: name })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      let code = data.code || '';
      let responseText = data.response || '';

      if (!code && responseText) {
        const match = responseText.match(/```(?:python)?\n([\s\S]*?)```/);
        if (match) code = match[1].trim();
      }

      if (!code) {
        code = generateDefaultCode(name, ticker);
      }

      const strategy = { 
        id: Date.now(), 
        name, 
        ticker, 
        code, 
        status: 'draft', 
        backtestPeriod: timeframeLabel 
      };

      // Add AI response to chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I've created your "${name}" strategy for $${ticker}. The strategy uses ${userMessage.toLowerCase().includes('rsi') ? 'RSI signals' : userMessage.toLowerCase().includes('ma') ? 'moving average crossovers' : 'your specified conditions'} with a ${timeframeLabel} backtest period.\n\nClick "View Results" to see the code and make any edits before saving.`,
        strategy: { name, ticker }
      }]);

      setGeneratedStrategy(strategy);
      setEditableCode(code);

    } catch (err) {
      console.error('Chat API Error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Sorry, I encountered an error generating your strategy. Please try again.`
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  // Handle starter prompt click
  const handleStarterPrompt = (prompt) => {
    setChatInput(prompt);
    chatInputRef.current?.focus();
  };

  // Core generate function with typewriter streaming
  const generateStrategy = async (prompt, name, ticker, timeframe = '6 Months') => {
    setIsGenerating(true);
    setStreamingText('');
    setActiveTab('results');
    
    // Simulate typewriter streaming while API runs
    const streamMessages = [
      `# Initializing strategy generator...\n`,
      `# Target: $${ticker}\n`,
      `# Strategy: ${name}\n`,
      `# Backtest: ${timeframe}\n\n`,
      `import alpaca_trade_api as tradeapi\n`,
      `import pandas as pd\n`,
      `import numpy as np\n\n`,
      `# Analyzing market patterns...\n`,
      `# Configuring entry/exit signals...\n`,
      `# Setting risk parameters...\n\n`,
      `class ${name.replace(/[^a-zA-Z0-9]/g, '')}:\n`,
      `    def __init__(self):\n`,
      `        self.symbol = '${ticker}'\n`,
      `        # Building strategy logic...\n`,
    ];
    
    let fullText = '';
    let streamIndex = 0;
    
    // Start streaming animation
    const streamInterval = setInterval(() => {
      if (streamIndex < streamMessages.length) {
        const message = streamMessages[streamIndex];
        let charIndex = 0;
        const charInterval = setInterval(() => {
          if (charIndex < message.length) {
            fullText += message[charIndex];
            setStreamingText(fullText);
            charIndex++;
          } else {
            clearInterval(charInterval);
          }
        }, 20);
        streamIndex++;
      }
    }, 400);
    
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'https://stratify-backend-production-3ebd.up.railway.app';
      const response = await fetch(`${backendUrl}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, strategy_name: name })
      });
      
      clearInterval(streamInterval);
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      
      let code = data.code || '';
      let responseText = data.response || '';
      
      if (!code && responseText) {
        const match = responseText.match(/```(?:python)?\n([\s\S]*?)```/);
        if (match) code = match[1].trim();
      }
      
      if (!code) {
        code = generateDefaultCode(name, ticker);
      }
      
      const strategy = { id: Date.now(), name, ticker: `$${ticker}`, code, status: 'draft', backtestPeriod: timeframe };
      setGeneratedStrategy(strategy);
      setEditableCode(code);
      setResultMessage(`Strategy "${name}" for $${ticker} - Review and edit before saving`);
      
    } catch (err) {
      console.error('API Error:', err);
      clearInterval(streamInterval);
      const code = generateDefaultCode(name, ticker);
      setGeneratedStrategy({ id: Date.now(), name, ticker: `$${ticker}`, code, status: 'draft' });
      setEditableCode(code);
      setResultMessage(`Strategy "${name}" for $${ticker} - Review and edit before saving`);
    } finally {
      setIsGenerating(false);
      setStreamingText('');
    }
  };

  // Generate default code
  const generateDefaultCode = (name, ticker) => {
    return `# ${name}
# Strategy for $${ticker}
# Edit this code before saving

import alpaca_trade_api as tradeapi
import pandas as pd
import numpy as np

class Strategy:
    def __init__(self):
        self.symbol = '${ticker}'
        self.position_size = 0.02  # 2% of portfolio
        
    def calculate_signals(self, df):
        # Add your logic here
        df['signal'] = 0
        return df
    
    def execute(self):
        # Fetch data and run strategy
        return 'HOLD'

if __name__ == "__main__":
    strategy = Strategy()
    print(strategy.execute())`;
  };

  // Handle code edit
  const handleCodeChange = (newCode) => {
    setEditableCode(newCode);
    if (generatedStrategy) {
      setGeneratedStrategy({ ...generatedStrategy, code: newCode });
    }
  };

  // Save and deploy strategy
  const handleSaveAndDeploy = () => {
    if (generatedStrategy && onStrategyGenerated) {
      const finalStrategy = { ...generatedStrategy, code: editableCode, status: 'deployed' };
      onStrategyGenerated(finalStrategy);
      setResultMessage(`Strategy "${generatedStrategy.name}" saved and deployed!`);
    }
  };

  // Save strategy only (to sidebar)
  const handleSaveOnly = () => {
    if (generatedStrategy && onSaveToSidebar) {
      const strategyToSave = { 
        ...generatedStrategy, 
        code: editableCode, 
        status: 'saved',
        id: generatedStrategy.id || `strategy-${Date.now()}`,
        metrics: generatedStrategy.metrics || { maxDrawdown: 12 }
      };
      onSaveToSidebar(strategyToSave);
      setResultMessage(`Strategy "${generatedStrategy.name}" saved!`);
    }
  };

  // Collapsed
  if (!expanded) {
    return (
      <div onClick={() => setExpanded(true)}
        className="w-12 flex flex-col items-center py-4 gap-3 bg-[#0d0d12] border-l border-white/10 cursor-pointer hover:bg-[#0f1624] transition-colors">
        <BrainIcon className="w-6 h-6 text-emerald-400" />
        <span className="text-[10px] text-gray-500 tracking-widest" style={{ writingMode: 'vertical-rl' }}>ATLAS AI</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#0d0d12] border-l border-white/10 h-full shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" style={{ width }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <BrainIcon className="w-6 h-6 text-emerald-400" />
          <span className="text-sm font-semibold text-white/90 tracking-wide">Atlas AI</span>
        </div>
        <div className="flex gap-1">
          <button onClick={handleReset} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Start Fresh">
            <RefreshIcon className="w-4 h-4 text-gray-300 hover:text-emerald-300" />
          </button>
          <button onClick={() => setExpanded(false)} className="p-1.5 hover:bg-white/10 rounded transition-colors">
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 flex-shrink-0 bg-white/5 backdrop-blur-md">
        {[
          { id: 'quick', label: 'Quick Build' },
          { id: 'chat', label: 'AI Chat' },
          { id: 'results', label: 'Results' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors relative ${
              activeTab === tab.id ? 'text-emerald-300' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
            )}
            {tab.id === 'results' && generatedStrategy && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {/* Quick Build Tab */}
          {activeTab === 'quick' && (
            <motion.div key="quick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 h-full flex flex-col overflow-y-auto">
              
              {/* Ticker Selection */}
              <div className="mb-4">
                <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-widest">Select Ticker</label>
                <div className="grid grid-cols-5 gap-2">
                  {stockTickers.map(t => (
                    <button key={t} onClick={() => handleTickerSelect(t)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                        selectedTicker === t 
                          ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 shadow-[0_0_16px_rgba(16,185,129,0.18)]' 
                          : 'bg-white/5 text-gray-300 border border-white/10 hover:border-emerald-400/40 hover:text-emerald-100'
                      }`}>
                      ${t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Crypto */}
              <div className="mb-4">
                <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-widest">Crypto</label>
                <div className="grid grid-cols-5 gap-2">
                  {cryptoTickers.slice(0, 10).map(t => (
                    <button key={t} onClick={() => handleTickerSelect(t)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                        selectedTicker === t 
                          ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 shadow-[0_0_16px_rgba(16,185,129,0.18)]' 
                          : 'bg-white/5 text-gray-300 border border-white/10 hover:border-emerald-400/40 hover:text-emerald-100'
                      }`}>
                      ${t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strategy Templates */}
              <div className="mb-4">
                <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-widest">Strategy Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {strategyTemplates.map(s => (
                    <button key={s.id} onClick={() => handleTemplateSelect(s)}
                      className={`p-3 rounded-xl text-left transition-all duration-200 hover:-translate-y-0.5 border ${
                        selectedTemplate?.id === s.id
                          ? 'bg-emerald-500/15 border-emerald-400/40 shadow-[0_0_18px_rgba(16,185,129,0.16)]'
                          : 'bg-white/5 border-white/10 hover:border-emerald-400/40'
                      }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span>{s.icon}</span>
                        <span className="text-xs font-semibold text-white/90">{s.name}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-1">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Strategy Name */}
              <div className="mb-4">
                <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-widest">Strategy Name</label>
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  placeholder="Name your strategy..."
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                />
              </div>

              {/* Backtest Timeframe */}
              <div className="mb-4">
                <label className="text-[11px] text-gray-400 mb-2 block uppercase tracking-widest">Backtest Timeframe</label>
                <div className="grid grid-cols-5 gap-2">
                  {timeframeOptions.map(tf => (
                    <button
                      key={tf.id}
                      onClick={() => setBacktestTimeframe(backtestTimeframe === tf.id ? '' : tf.id)}
                      className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                        backtestTimeframe === tf.id
                          ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 shadow-[0_0_14px_rgba(16,185,129,0.16)]'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:border-emerald-400/40 hover:text-emerald-100'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleQuickGenerate}
                disabled={!selectedTicker || !selectedTemplate || !strategyName || !backtestTimeframe}
                className={`mt-auto py-3 rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 flex-shrink-0 ${
                  selectedTicker && selectedTemplate && strategyName && backtestTimeframe
                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5'
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                }`}>
                Generate Strategy →
              </button>
            </motion.div>
          )}

          {/* AI Chat Tab - Claude-style layout */}
          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex flex-col">
              
              {/* Fixed Header - Config inputs */}
              <div className="p-4 border-b border-white/10 flex-shrink-0 space-y-3 bg-white/5 backdrop-blur-md">
                <div className="flex gap-2">
                  {/* Ticker */}
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 mb-1 block tracking-widest">TICKER</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-300 text-xs">$</span>
                      <input
                        type="text"
                        value={chatTicker}
                        onChange={(e) => setChatTicker(e.target.value.toUpperCase())}
                        placeholder="AAPL"
                        className="w-full pl-5 pr-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/90 placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                      />
                    </div>
                  </div>
                  {/* Strategy Name */}
                  <div className="flex-[2]">
                    <label className="text-[10px] text-gray-400 mb-1 block tracking-widest">NAME</label>
                    <input
                      type="text"
                      value={chatStrategyName}
                      onChange={(e) => setChatStrategyName(e.target.value)}
                      placeholder="My Strategy"
                      className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/90 placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                </div>
                {/* Timeframe row */}
                <div className="flex gap-2">
                  {timeframeOptions.map(tf => (
                    <button
                      key={tf.id}
                      onClick={() => setChatTimeframe(tf.id)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                        chatTimeframe === tf.id
                          ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.14)]'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:text-emerald-100 hover:border-emerald-400/40'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Chat Area */}
              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  // Empty state with starter prompts
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.18)] mb-3">
                      <BrainIcon className="w-6 h-6 text-emerald-300/80" />
                    </div>
                    <p className="text-sm text-gray-300 mb-1 font-medium">Describe your strategy</p>
                    <p className="text-xs text-gray-500 mb-4">Try a starter prompt:</p>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                      {starterPrompts.map((sp, i) => (
                        <button
                          key={i}
                          onClick={() => handleStarterPrompt(sp.prompt)}
                          className="p-3 text-left bg-white/5 border border-white/10 rounded-xl hover:border-emerald-400/40 hover:-translate-y-0.5 transition-all duration-200"
                        >
                          <span className="text-[10px] text-emerald-300 block mb-1 tracking-wide">{sp.label}</span>
                          <span className="text-[10px] text-gray-400 line-clamp-2">{sp.prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Chat messages
                  <div>
                    {messages.map((msg, i) => (
                      <ChatMessage key={i} message={msg} isUser={msg.role === 'user'} />
                    ))}
                    {isThinking && <ChatMessage isLoading />}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Fixed Footer - Input */}
              <div className="p-4 border-t border-white/10 flex-shrink-0 bg-white/5 backdrop-blur-md">
                {generatedStrategy && (
                  <button
                    onClick={() => setActiveTab('results')}
                    className="w-full mb-3 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs font-semibold border border-emerald-400/30 hover:bg-emerald-500/30 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    View Results →
                  </button>
                )}
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={chatTicker && chatStrategyName ? "Describe your strategy..." : "Enter ticker & name first..."}
                    disabled={!chatTicker || !chatStrategyName}
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || !chatTicker || !chatStrategyName || isThinking}
                    className={`px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      chatInput.trim() && chatTicker && chatStrategyName && !isThinking
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-[#0b0b12] shadow-[0_0_18px_rgba(16,185,129,0.25)] hover:-translate-y-0.5'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <SendIcon className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 h-full flex flex-col">
              
              {isGenerating ? (
                <TypewriterStream strategyName={strategyName || chatStrategyName} streamingText={streamingText} />
              ) : generatedStrategy ? (
                <div className="flex flex-col h-full">
                  {/* Status Message - Compact */}
                  <div className={`mb-3 p-3 rounded-xl flex-shrink-0 border backdrop-blur-sm ${generatedStrategy.status === 'deployed' ? 'bg-emerald-500/10 border-emerald-400/30' : 'bg-amber-500/10 border-amber-400/30'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${generatedStrategy.status === 'deployed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className={`text-xs font-semibold tracking-wide ${generatedStrategy.status === 'deployed' ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {generatedStrategy.status === 'deployed' ? 'Deployed ✓' : 'Click code to edit'}
                      </span>
                    </div>
                  </div>

                  {/* Editable Code - Fills remaining space */}
                  <EditableCodeBlock 
                    code={editableCode} 
                    name={generatedStrategy.name.replace(/\s+/g, '_').toLowerCase()} 
                    onCodeChange={handleCodeChange}
                  />

                  {/* Actions - Fixed at bottom */}
                  <div className="flex gap-2 mt-3 flex-shrink-0">
                    {generatedStrategy.status !== 'deployed' ? (
                      <>
                        <button onClick={handleSaveAndDeploy}
                          className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] text-sm font-semibold shadow-[0_0_20px_rgba(16,185,129,0.22)] hover:-translate-y-0.5 transition-all duration-200">
                          Save & Deploy
                        </button>
                        <button onClick={handleSaveOnly}
                          className="flex-1 py-2.5 rounded-lg bg-white/5 text-gray-200 text-sm font-semibold border border-white/10 hover:border-emerald-400/40 hover:-translate-y-0.5 transition-all duration-200">
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => navigator.clipboard.writeText(editableCode)}
                          className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-400 text-[#0b0b12] text-sm font-semibold shadow-[0_0_20px_rgba(16,185,129,0.22)] hover:-translate-y-0.5 transition-all duration-200">
                          Copy Code
                        </button>
                        <button onClick={handleReset}
                          className="flex-1 py-2.5 rounded-lg bg-white/5 text-gray-200 text-sm font-semibold border border-white/10 hover:border-emerald-400/40 hover:-translate-y-0.5 transition-all duration-200">
                          New Strategy
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <BrainIcon className="w-12 h-12 text-emerald-300/50 mb-3" />
                  <p className="text-sm text-gray-300 mb-1">No results yet</p>
                  <p className="text-xs text-gray-500">Build a strategy to see results here</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
