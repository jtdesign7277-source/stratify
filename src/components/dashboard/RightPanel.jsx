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

// Typewriter Streaming Component
const TypewriterStream = ({ strategyName, streamingText }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-sm font-medium text-white">Generating: {strategyName}</span>
      </div>
      
      {/* Streaming Text Area */}
      <div className="flex-1 bg-[#0a1220] rounded-lg border border-blue-500/20 p-3 overflow-auto">
        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
          {streamingText}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-2 h-4 bg-blue-400 ml-0.5"
          />
        </pre>
      </div>
      
      {/* Progress indicator */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 bg-[#0a1628] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 8, ease: 'linear' }}
            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
          />
        </div>
        <span className="text-[10px] text-gray-500">Building...</span>
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
    <div className="flex-1 flex flex-col bg-[#0a1220] rounded-lg border border-blue-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-blue-500/20 flex-shrink-0">
        <span className="text-xs text-gray-400">{name}.py</span>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">✏️ Editing...</span>
          ) : (
            <button 
              onClick={handleClick}
              className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded hover:bg-blue-400/20"
            >
              Click to Edit
            </button>
          )}
          <button 
            onClick={() => navigator.clipboard.writeText(code)} 
            className="text-xs text-blue-400 hover:text-blue-300"
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
            className="w-full h-full p-3 text-xs text-gray-300 bg-[#0a1220] font-mono resize-none focus:outline-none"
            spellCheck={false}
          />
        ) : (
          <pre className="w-full h-full p-3 text-xs text-gray-300 font-mono overflow-auto cursor-text hover:bg-blue-500/5">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
};

// Main Component
export default function RightPanel({ width, onStrategyGenerated }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('quick'); // quick | custom | results
  
  // Quick Build State
  const [selectedTicker, setSelectedTicker] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [strategyName, setStrategyName] = useState('');
  
  // Custom AI State
  const [customTicker, setCustomTicker] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  const [editableCode, setEditableCode] = useState('');
  const [resultMessage, setResultMessage] = useState('');

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
    setCustomTicker('');
    setCustomName('');
    setCustomPrompt('');
    setGeneratedStrategy(null);
    setEditableCode('');
    setStreamingText('');
    setResultMessage('');
    setActiveTab('quick');
  };

  // Generate from Quick Build
  const handleQuickGenerate = async () => {
    if (!selectedTicker || !selectedTemplate || !strategyName) return;
    
    const prompt = `Create a ${selectedTemplate.name} trading strategy called "${strategyName}" for $${selectedTicker}. ${selectedTemplate.desc}.`;
    await generateStrategy(prompt, strategyName, selectedTicker);
  };

  // Generate from Custom AI
  const handleCustomGenerate = async () => {
    if (!customTicker || !customName || !customPrompt) return;
    
    const prompt = `Create a trading strategy called "${customName}" for $${customTicker}. ${customPrompt}`;
    await generateStrategy(prompt, customName, customTicker);
  };

  // Core generate function with typewriter streaming
  const generateStrategy = async (prompt, name, ticker) => {
    setIsGenerating(true);
    setStreamingText('');
    setActiveTab('results');
    
    // Simulate typewriter streaming while API runs
    const streamMessages = [
      `# Initializing strategy generator...\n`,
      `# Target: $${ticker}\n`,
      `# Strategy: ${name}\n\n`,
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
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
      
      const strategy = { id: Date.now(), name, ticker: `$${ticker}`, code, status: 'draft' };
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

  // Save strategy
  const handleSave = () => {
    if (generatedStrategy && onStrategyGenerated) {
      const finalStrategy = { ...generatedStrategy, code: editableCode, status: 'deployed' };
      onStrategyGenerated(finalStrategy);
      setResultMessage(`Strategy "${generatedStrategy.name}" saved and deployed!`);
    }
  };

  // Collapsed
  if (!expanded) {
    return (
      <div onClick={() => setExpanded(true)}
        className="w-12 flex flex-col items-center py-4 gap-3 bg-[#060d18] border-l border-blue-500/20 cursor-pointer hover:bg-[#0a1628]">
        <BrainIcon className="w-6 h-6 text-blue-400" />
        <span className="text-[10px] text-gray-500" style={{ writingMode: 'vertical-rl' }}>ATLAS AI</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#060d18] border-l border-blue-500/20 h-full" style={{ width }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-blue-500/20">
        <div className="flex items-center gap-2">
          <BrainIcon className="w-6 h-6 text-blue-400" />
          <span className="text-sm font-semibold text-white">Atlas AI</span>
        </div>
        <div className="flex gap-1">
          {/* Refresh Button - Always visible */}
          <button onClick={handleReset} className="p-1.5 hover:bg-blue-500/10 rounded" title="Start Fresh">
            <RefreshIcon className="w-4 h-4 text-gray-400 hover:text-blue-400" />
          </button>
          <button onClick={() => setExpanded(false)} className="p-1.5 hover:bg-blue-500/10 rounded">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-blue-500/20">
        {[
          { id: 'quick', label: 'Quick Build' },
          { id: 'custom', label: 'AI Chat' },
          { id: 'results', label: 'Results' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
              activeTab === tab.id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Quick Build Tab */}
          {activeTab === 'quick' && (
            <motion.div key="quick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3 h-full flex flex-col">
              
              {/* Ticker Selection */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Select Ticker (click again to deselect)</label>
                <div className="grid grid-cols-5 gap-1">
                  {stockTickers.map(t => (
                    <button key={t} onClick={() => handleTickerSelect(t)}
                      className={`py-1.5 rounded text-xs font-medium transition-all ${
                        selectedTicker === t 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-[#0a1628] text-gray-300 border border-blue-500/20 hover:border-blue-500/50'
                      }`}>
                      ${t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Crypto */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Crypto</label>
                <div className="grid grid-cols-5 gap-1">
                  {cryptoTickers.slice(0, 10).map(t => (
                    <button key={t} onClick={() => handleTickerSelect(t)}
                      className={`py-1.5 rounded text-xs font-medium transition-all ${
                        selectedTicker === t 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-[#0a1628] text-gray-300 border border-blue-500/20 hover:border-blue-500/50'
                      }`}>
                      ${t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strategy Templates */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Strategy Type (click again to deselect)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {strategyTemplates.map(s => (
                    <button key={s.id} onClick={() => handleTemplateSelect(s)}
                      className={`p-2 rounded text-left transition-all ${
                        selectedTemplate?.id === s.id
                          ? 'bg-blue-600/20 border-blue-500'
                          : 'bg-[#0a1628] border-blue-500/20 hover:border-blue-500/50'
                      } border`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span>{s.icon}</span>
                        <span className="text-xs font-medium text-white">{s.name}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 line-clamp-1">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Strategy Name */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Strategy Name</label>
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  placeholder="Name your strategy..."
                  className="w-full px-3 py-2 bg-[#0a1628] border border-blue-500/20 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleQuickGenerate}
                disabled={!selectedTicker || !selectedTemplate || !strategyName}
                className={`mt-auto py-2.5 rounded text-sm font-semibold transition-all ${
                  selectedTicker && selectedTemplate && strategyName
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-[#0a1628] text-gray-500 cursor-not-allowed'
                }`}>
                Generate Strategy →
              </button>
            </motion.div>
          )}

          {/* Custom AI Tab */}
          {activeTab === 'custom' && (
            <motion.div key="custom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3 h-full flex flex-col">
              
              {/* Ticker Input */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Ticker Symbol</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-medium">$</span>
                  <input
                    type="text"
                    value={customTicker}
                    onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full pl-7 pr-3 py-2 bg-[#0a1628] border border-blue-500/20 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Strategy Name */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Strategy Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Custom Strategy"
                  className="w-full px-3 py-2 bg-[#0a1628] border border-blue-500/20 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Chat/Describe */}
              <div className="flex-1 mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Describe Your Strategy</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Example: Buy when RSI drops below 30 and price is above the 200-day moving average. Sell when RSI goes above 70. Use a 5% stop loss..."
                  className="w-full h-full min-h-[140px] px-3 py-2 bg-[#0a1628] border border-blue-500/20 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleCustomGenerate}
                disabled={!customTicker || !customName || !customPrompt}
                className={`py-2.5 rounded text-sm font-semibold transition-all ${
                  customTicker && customName && customPrompt
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-[#0a1628] text-gray-500 cursor-not-allowed'
                }`}>
                Generate with AI →
              </button>
            </motion.div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3 h-full flex flex-col">
              
              {isGenerating ? (
                <TypewriterStream strategyName={strategyName || customName} streamingText={streamingText} />
              ) : generatedStrategy ? (
                <div className="flex flex-col h-full">
                  {/* Status Message - Compact */}
                  <div className={`mb-2 p-2 rounded-lg ${generatedStrategy.status === 'deployed' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'} border`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${generatedStrategy.status === 'deployed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className={`text-xs font-medium ${generatedStrategy.status === 'deployed' ? 'text-emerald-400' : 'text-amber-400'}`}>
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
                  <div className="flex gap-2 mt-2 flex-shrink-0">
                    {generatedStrategy.status !== 'deployed' ? (
                      <>
                        <button onClick={handleSave}
                          className="flex-1 py-2.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500">
                          Save & Deploy
                        </button>
                        <button onClick={handleReset}
                          className="flex-1 py-2.5 rounded bg-[#0a1628] text-gray-300 text-sm font-medium border border-blue-500/20 hover:border-blue-500/50">
                          Start Over
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => navigator.clipboard.writeText(editableCode)}
                          className="flex-1 py-2.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-500">
                          Copy Code
                        </button>
                        <button onClick={handleReset}
                          className="flex-1 py-2.5 rounded bg-[#0a1628] text-gray-300 text-sm font-medium border border-blue-500/20 hover:border-blue-500/50">
                          New Strategy
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <BrainIcon className="w-12 h-12 text-blue-400/50 mb-3" />
                  <p className="text-sm text-gray-400 mb-1">No results yet</p>
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
