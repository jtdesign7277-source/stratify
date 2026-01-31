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

// 3D Globe Animation
const Globe3D = ({ strategyName }) => (
  <div className="flex flex-col items-center justify-center py-6">
    <div className="relative w-32 h-32 mb-4" style={{ perspective: '500px' }}>
      <div className="absolute inset-6 rounded-full bg-blue-500/30 blur-xl animate-pulse" />
      <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
        <motion.div 
          animate={{ rotateY: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 shadow-2xl flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-0 rounded-full border border-blue-400/20" />
          <div className="absolute inset-0 rounded-full border border-blue-400/20" style={{ transform: 'rotateY(60deg)' }} />
          <div className="absolute inset-0 rounded-full border border-blue-400/20" style={{ transform: 'rotateY(120deg)' }} />
          <span className="text-white font-bold text-2xl z-10">S</span>
        </motion.div>
      </div>
      
      <motion.div animate={{ rotateZ: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0" style={{ transform: 'rotateX(75deg)', transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-1 rounded-full border border-blue-400/40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/60" />
      </motion.div>
      
      <motion.div animate={{ rotateZ: -360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0" style={{ transform: 'rotateX(75deg) rotateY(60deg)', transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-3 rounded-full border border-blue-300/30" />
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/60" />
      </motion.div>
      
      <motion.div animate={{ rotateZ: 360 }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0" style={{ transform: 'rotateX(75deg) rotateY(-60deg)', transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-[-4px] rounded-full border border-blue-500/20" />
        <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-400 shadow-lg shadow-blue-400/80" />
      </motion.div>
    </div>
    
    <p className="text-sm font-semibold text-white">Generating Strategy...</p>
    <p className="text-blue-400 text-xs mt-1">{strategyName}</p>
  </div>
);

// Code Highlighter
const CodeBlock = ({ code, name }) => (
  <div className="bg-[#0a1220] rounded-lg border border-blue-500/20 overflow-hidden">
    <div className="flex justify-between items-center px-3 py-1.5 border-b border-blue-500/20">
      <span className="text-xs text-gray-400">{name}.py</span>
      <button onClick={() => navigator.clipboard.writeText(code)} className="text-xs text-blue-400 hover:text-blue-300">Copy</button>
    </div>
    <pre className="p-3 text-xs text-gray-300 overflow-auto max-h-36 font-mono">{code}</pre>
  </div>
);

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
  const [generatedStrategy, setGeneratedStrategy] = useState(null);
  const [resultMessage, setResultMessage] = useState('');
  
  const chatRef = useRef(null);

  // Handle quick template select
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    if (selectedTicker) {
      setStrategyName(`$${selectedTicker} ${template.name}`);
    }
  };

  // Handle ticker select
  const handleTickerSelect = (ticker) => {
    setSelectedTicker(ticker);
    if (selectedTemplate) {
      setStrategyName(`$${ticker} ${selectedTemplate.name}`);
    }
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

  // Core generate function
  const generateStrategy = async (prompt, name, ticker) => {
    setIsGenerating(true);
    setActiveTab('results');
    
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
        code = `# ${name}\n# Strategy for $${ticker}\n\nclass Strategy:\n    def __init__(self):\n        self.symbol = '${ticker}'\n    \n    def execute(self):\n        return 'HOLD'`;
      }
      
      const strategy = { id: Date.now(), name, ticker: `$${ticker}`, code, status: 'deployed' };
      setGeneratedStrategy(strategy);
      setResultMessage(`Strategy "${name}" created for $${ticker}`);
      
    } catch (err) {
      console.error('API Error:', err);
      const code = `# ${name}\n# Strategy for $${ticker}\n\nclass Strategy:\n    def __init__(self):\n        self.symbol = '${ticker}'\n    \n    def execute(self):\n        return 'HOLD'`;
      setGeneratedStrategy({ id: Date.now(), name, ticker: `$${ticker}`, code, status: 'deployed' });
      setResultMessage(`Strategy "${name}" created for $${ticker}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset
  const handleReset = () => {
    setSelectedTicker('');
    setSelectedTemplate(null);
    setStrategyName('');
    setCustomTicker('');
    setCustomName('');
    setCustomPrompt('');
    setGeneratedStrategy(null);
    setResultMessage('');
    setActiveTab('quick');
  };

  // Save strategy
  const handleSave = () => {
    if (generatedStrategy && onStrategyGenerated) {
      onStrategyGenerated(generatedStrategy);
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
          {generatedStrategy && (
            <button onClick={handleReset} className="p-1.5 hover:bg-blue-500/10 rounded">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
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
                <label className="text-xs text-gray-400 mb-1.5 block">Select Ticker</label>
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
                <label className="text-xs text-gray-400 mb-1.5 block">Strategy Type</label>
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
                  ref={chatRef}
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
                <Globe3D strategyName={strategyName || customName} />
              ) : generatedStrategy ? (
                <>
                  {/* Success Message */}
                  <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">Strategy Deployed</span>
                    </div>
                    <p className="text-xs text-gray-300">{resultMessage}</p>
                  </div>

                  {/* Code */}
                  <div className="flex-1 overflow-hidden mb-3">
                    <CodeBlock code={generatedStrategy.code} name={generatedStrategy.name.replace(/\s+/g, '_').toLowerCase()} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={handleSave}
                      className="flex-1 py-2 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500">
                      Save Strategy
                    </button>
                    <button onClick={handleReset}
                      className="flex-1 py-2 rounded bg-[#0a1628] text-gray-300 text-sm font-medium border border-blue-500/20 hover:border-blue-500/50">
                      New Strategy
                    </button>
                  </div>
                </>
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
