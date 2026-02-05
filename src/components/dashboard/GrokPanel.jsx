import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, Copy, Check, Zap, Search, X, Plus, Brain,
  TrendingUp, BarChart3, RefreshCcw, Rocket, Activity, Target,
  ChevronsLeft, ChevronsRight, RotateCcw, Save, Play
} from 'lucide-react';

const GROK_LOADING_STEPS = ['Analyzing', 'Building', 'Testing'];

// Premium loading overlay component
const GrokLoadingOverlay = ({ isVisible }) => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isVisible) { setActiveStep(0); return; }
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % GROK_LOADING_STEPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isVisible]);

  const particles = [
    { top: '18%', left: '20%', size: '6px', delay: '0s', duration: '9s' },
    { top: '28%', left: '72%', size: '4px', delay: '1s', duration: '8s' },
    { top: '42%', left: '35%', size: '5px', delay: '2s', duration: '10s' },
    { top: '55%', left: '62%', size: '3px', delay: '0.5s', duration: '7.5s' },
    { top: '68%', left: '28%', size: '4px', delay: '1.5s', duration: '9.5s' },
    { top: '74%', left: '78%', size: '5px', delay: '2.5s', duration: '11s' },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-lg bg-[#0a0a0f]"
        >
          <style>{`
            @keyframes grokPulse {
              0%, 100% { opacity: 0.35; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.03); }
            }
            @keyframes grokDrift {
              0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.35; }
              50% { transform: translate3d(10px, -12px, 0); opacity: 0.7; }
            }
            @keyframes grokGrid {
              0%, 100% { background-position: 0 0, 40px 40px; opacity: 0.2; }
              50% { background-position: 30px -20px, -20px 30px; opacity: 0.35; }
            }
          `}</style>

          {/* Subtle neural network background */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(16,185,129,0.18), transparent 45%), radial-gradient(circle at 80% 30%, rgba(16,185,129,0.12), transparent 45%), radial-gradient(circle at 55% 80%, rgba(16,185,129,0.1), transparent 50%)',
                animation: 'grokPulse 12s ease-in-out infinite',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(120deg, rgba(16,185,129,0.08) 0%, transparent 60%), linear-gradient(300deg, rgba(16,185,129,0.06) 0%, transparent 60%)',
                animation: 'grokGrid 14s ease-in-out infinite',
              }}
            />
            {particles.map((p, idx) => (
              <div
                key={idx}
                className="absolute rounded-full bg-emerald-400/40 blur-sm"
                style={{
                  top: p.top,
                  left: p.left,
                  width: p.size,
                  height: p.size,
                  animation: `grokDrift ${p.duration} ease-in-out infinite`,
                  animationDelay: p.delay,
                }}
              />
            ))}
          </div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="relative z-10 flex flex-col items-center text-center px-6"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-3 flex items-center justify-center"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.25)]">
                <Brain className="w-5 h-5 text-emerald-300" strokeWidth={1.6} />
              </div>
            </motion.div>

            <h3 className="text-lg text-[#f2f2f5] font-semibold tracking-wide">
              Grok is building your strategy...
            </h3>

            <div className="mt-3 flex items-center gap-1 text-[11px] uppercase tracking-[0.2em]">
              {GROK_LOADING_STEPS.map((step, idx) => (
                <div key={step} className="flex items-center">
                  <div className="relative px-2 py-1">
                    <span className={idx === activeStep ? 'text-emerald-300' : 'text-gray-500'}>
                      {step}
                    </span>
                    {idx === activeStep && (
                      <motion.span
                        layoutId="grok-step-highlight"
                        className="absolute -bottom-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                      />
                    )}
                  </div>
                  {idx < GROK_LOADING_STEPS.length - 1 && (
                    <span className="text-gray-600 text-[10px] mx-1">{'>'}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Animated progress dots */}
            <div className="mt-4 flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <motion.span
                  key={idx}
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.9, 1.15, 0.9] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: idx * 0.15 }}
                  className="w-2 h-2 rounded-full bg-emerald-400/90"
                />
              ))}
            </div>
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0f]/30 to-[#0a0a0f]/80" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';

const ALL_TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000' },
  { symbol: 'VOO', name: 'Vanguard S&P 500' },
  { symbol: 'VTI', name: 'Vanguard Total Market' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.' },
  { symbol: 'MU', name: 'Micron Technology' },
  { symbol: 'SMCI', name: 'Super Micro Computer' },
  { symbol: 'ARM', name: 'Arm Holdings' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor' },
  { symbol: 'ASML', name: 'ASML Holding' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'BAC', name: 'Bank of America' },
  { symbol: 'GS', name: 'Goldman Sachs' },
  { symbol: 'MS', name: 'Morgan Stanley' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard' },
  { symbol: 'PYPL', name: 'PayPal Holdings' },
  { symbol: 'SQ', name: 'Block Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global' },
  { symbol: 'SOFI', name: 'SoFi Technologies' },
  { symbol: 'PLTR', name: 'Palantir Technologies' },
  { symbol: 'AI', name: 'C3.ai Inc.' },
  { symbol: 'PATH', name: 'UiPath Inc.' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'DDOG', name: 'Datadog Inc.' },
  { symbol: 'NET', name: 'Cloudflare Inc.' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings' },
  { symbol: 'ZS', name: 'Zscaler Inc.' },
  { symbol: 'RIVN', name: 'Rivian Automotive' },
  { symbol: 'LCID', name: 'Lucid Group' },
  { symbol: 'NIO', name: 'NIO Inc.' },
  { symbol: 'F', name: 'Ford Motor' },
  { symbol: 'GM', name: 'General Motors' },
  { symbol: 'GME', name: 'GameStop Corp.' },
  { symbol: 'AMC', name: 'AMC Entertainment' },
  { symbol: 'BB', name: 'BlackBerry' },
  { symbol: 'RKLB', name: 'Rocket Lab' },
  { symbol: 'ASTS', name: 'AST SpaceMobile' },
  { symbol: 'LUNR', name: 'Intuitive Machines' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'UNH', name: 'UnitedHealth Group' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'MRNA', name: 'Moderna Inc.' },
  { symbol: 'LLY', name: 'Eli Lilly' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale' },
  { symbol: 'HD', name: 'Home Depot' },
  { symbol: 'DIS', name: 'Walt Disney' },
  { symbol: 'BA', name: 'Boeing Company' },
  { symbol: 'XOM', name: 'Exxon Mobil' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'ELF', name: 'e.l.f. Beauty' },
  { symbol: 'ULTA', name: 'Ulta Beauty' },
];

const STRATEGY_TYPES = [
  { id: 'momentum', name: 'Momentum', icon: TrendingUp },
  { id: 'rsi', name: 'RSI', icon: BarChart3 },
  { id: 'mean-rev', name: 'Mean Rev', icon: RefreshCcw },
  { id: 'breakout', name: 'Breakout', icon: Rocket },
  { id: 'macd', name: 'MACD', icon: Activity },
  { id: 'scalp', name: 'Scalp', icon: Target },
];

const TIMEFRAMES = [
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
];

const CHART_TIMEFRAMES = [
  { id: '5min', label: '5m' },
  { id: '15min', label: '15m' },
  { id: '30min', label: '30m' },
  { id: '1hr', label: '1H' },
  { id: '4hr', label: '4H' },
];

const parseStrategyResponse = (content) => {
  const codeMatch = content.match(/```python\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : '';
  let summary = content.split('```')[0].trim();
  const parsed = { ticker: '', entry: '', exit: '', stopLoss: '', positionSize: '', description: summary };
  const tickerMatch = summary.match(/Ticker[s]?:\s*([^\n]+)/i);
  const entryMatch = summary.match(/Entry[^:]*:\s*([^\n]+)/i);
  const exitMatch = summary.match(/Exit[^:]*:\s*([^\n]+)/i);
  const stopMatch = summary.match(/Stop[^:]*:\s*([^\n]+)/i);
  const positionMatch = summary.match(/Position[^:]*:\s*([^\n]+)/i);
  if (tickerMatch) parsed.ticker = tickerMatch[1].trim();
  if (entryMatch) parsed.entry = entryMatch[1].trim();
  if (exitMatch) parsed.exit = exitMatch[1].trim();
  if (stopMatch) parsed.stopLoss = stopMatch[1].trim();
  if (positionMatch) parsed.positionSize = positionMatch[1].trim();
  return { summary: parsed, code, raw: content };
};

const GrokPanel = ({ onSaveStrategy, onDeployStrategy }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [tickerSearch, setTickerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyName, setStrategyName] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState(null);
  const [selectedChartTimeframe, setSelectedChartTimeframe] = useState(null);
  const [selectedQuickStrategy, setSelectedQuickStrategy] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [tabs, setTabs] = useState([{ id: 'chat', name: 'Builder', content: '', isTyping: false }]);
  const [activeTab, setActiveTab] = useState('chat');
  const [strategyCounter, setStrategyCounter] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('strategy');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [chatInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tabs]);

  useEffect(() => {
    if (!tickerSearch.trim()) { setSearchResults([]); return; }
    const query = tickerSearch.toLowerCase();
    const localResults = ALL_TICKERS.filter(t => !selectedTickers.includes(t.symbol) && (t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query))).slice(0, 5);
    setSearchResults(localResults);
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        let apiResults = [];
        try {
          const response = await fetch('/api/stock/search?q=' + encodeURIComponent(tickerSearch));
          if (response.ok) { const data = await response.json(); if (data.results) { apiResults = data.results.slice(0, 8).map(r => ({ symbol: r.symbol, name: r.shortname || r.longname || r.name || r.symbol, exchange: r.exchDisp || r.exchange || '' })); } }
        } catch (e) {}
        if (apiResults.length === 0) {
          const yahooUrl = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(tickerSearch) + '&quotesCount=8&newsCount=0';
          const response = await fetch(yahooUrl);
          const data = await response.json();
          if (data.quotes) { apiResults = data.quotes.filter(q => (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'CRYPTOCURRENCY')).slice(0, 8).map(q => ({ symbol: q.symbol, name: q.shortname || q.longname || q.symbol, exchange: q.exchDisp || q.exchange || '' })); }
        }
        const filteredResults = apiResults.filter(r => !selectedTickers.includes(r.symbol));
        const apiSymbols = new Set(filteredResults.map(r => r.symbol));
        const mergedResults = [...filteredResults, ...localResults.filter(r => !apiSymbols.has(r.symbol))].slice(0, 8);
        if (mergedResults.length > 0) { setSearchResults(mergedResults); }
      } catch (err) { console.error('Ticker search error:', err); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [tickerSearch, selectedTickers]);

  const addTicker = (symbol) => { if (!selectedTickers.includes(symbol)) { const newTickers = [...selectedTickers, symbol]; setSelectedTickers(newTickers); updateStrategyNameWithTickers(newTickers); } setTickerSearch(''); setSearchResults([]); };
  const removeTicker = (symbol) => { const newTickers = selectedTickers.filter(s => s !== symbol); setSelectedTickers(newTickers); updateStrategyNameWithTickers(newTickers); };
  const getTickerPrefix = (tickers) => { if (!tickers || tickers.length === 0) return ''; if (tickers.length === 1) return '$' + tickers[0] + ' - '; if (tickers.length === 2) return '$' + tickers[0] + '/$' + tickers[1] + ' - '; return '$' + tickers[0] + '+ - '; };
  const updateStrategyNameWithTickers = (tickers, strategyType = null) => { const prefix = getTickerPrefix(tickers); const currentName = strategyName; const dashIndex = currentName.indexOf(' - '); const existingSuffix = dashIndex > -1 ? currentName.slice(dashIndex + 3) : ''; if (strategyType) { setStrategyName(prefix + strategyType); } else if (existingSuffix) { setStrategyName(prefix + existingSuffix); } else if (prefix) { setStrategyName(prefix); } };
  const handleReset = () => { setSelectedTickers([]); setSelectedStrategy(null); setStrategyName(''); setSelectedTimeframe(null); setMessages([]); setChatInput(''); setTickerSearch(''); setTabs([{ id: 'chat', name: 'Builder', content: '', isTyping: false }]); setActiveTab('chat'); setStrategyCounter(0); setActiveSubTab('strategy'); setSelectedQuickStrategy(null); };
  const closeTab = (tabId) => { if (tabId === 'chat') return; setTabs(prev => prev.filter(t => t.id !== tabId)); if (activeTab === tabId) { setActiveTab('chat'); } };

  const handleSave = () => { const activeTabData = tabs.find(t => t.id === activeTab); if (!activeTabData || activeTab === 'chat') return; const strategyToSave = { id: activeTabData.id, name: activeTabData.name, code: activeTabData.parsed?.code || '', content: activeTabData.content, summary: activeTabData.parsed?.summary || {}, tickers: activeTabData.tickers || [], strategyType: activeTabData.strategyType, timeframe: activeTabData.timeframe, deployed: false, savedAt: Date.now() }; onSaveStrategy && onSaveStrategy(strategyToSave); setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, saved: true } : t)); };
  const handleSaveAndDeploy = () => { const activeTabData = tabs.find(t => t.id === activeTab); if (!activeTabData || activeTab === 'chat') return; const strategyToSave = { id: activeTabData.id, name: activeTabData.name, code: activeTabData.parsed?.code || '', content: activeTabData.content, summary: activeTabData.parsed?.summary || {}, tickers: activeTabData.tickers || [], strategyType: activeTabData.strategyType, timeframe: activeTabData.timeframe, deployed: true, runStatus: 'running', savedAt: Date.now(), deployedAt: Date.now() }; onDeployStrategy && onDeployStrategy(strategyToSave); setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, saved: true, deployed: true } : t)); };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const isStrategyRequest = selectedTickers.length > 0 || selectedStrategy || selectedTimeframe;
    if (isStrategyRequest) {
      const newCounter = strategyCounter + 1;
      setStrategyCounter(newCounter);
      const tabName = strategyName.trim() || 'Strategy ' + newCounter;
      const tabId = 'strategy-' + Date.now();
      setTabs(prev => [...prev, { id: tabId, name: tabName, content: '', parsed: null, isTyping: true, tickers: [...selectedTickers], strategyType: selectedStrategy, timeframe: selectedTimeframe }]);
      setActiveTab(tabId);
      setActiveSubTab('strategy');
      setIsChatLoading(true);
      let contextMsg = userMsg + '\n\nGenerate a trading strategy with the following format:\n1. First provide a brief summary with these fields:\n   - Ticker(s): [symbols]\n   - Entry Condition: [when to enter]\n   - Exit Condition: [when to exit]\n   - Stop Loss: [stop loss rule]\n   - Position Size: [position sizing]\n\n2. Then provide the Python code using Alpaca API.';
      if (selectedTickers.length > 0) { contextMsg += '\n\nTickers: ' + selectedTickers.join(', '); }
      if (selectedStrategy) { const strat = STRATEGY_TYPES.find(s => s.id === selectedStrategy); contextMsg += '\nStrategy type: ' + (strat?.name || selectedStrategy); }
      if (selectedTimeframe) { const tf = TIMEFRAMES.find(t => t.id === selectedTimeframe); contextMsg += '\nTimeframe: ' + (tf?.label || selectedTimeframe); }
      try {
        const response = await fetch(API_BASE + '/api/v1/chat/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: contextMsg }) });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const fullContent = data.response || "Couldn't respond.";
        let idx = 0;
        const interval = setInterval(() => { idx += 10; if (idx >= fullContent.length) { clearInterval(interval); const parsed = parseStrategyResponse(fullContent); setTabs(prev => prev.map(t => t.id === tabId ? { ...t, content: fullContent, parsed, isTyping: false } : t)); } else { setTabs(prev => prev.map(t => t.id === tabId ? { ...t, content: fullContent.slice(0, idx), isTyping: true } : t)); } }, 5);
      } catch (e) { setTabs(prev => prev.map(t => t.id === tabId ? { ...t, content: "Error generating strategy.", isTyping: false } : t)); }
      finally { setIsChatLoading(false); setStrategyName(''); setSelectedQuickStrategy(null); }
    } else {
      setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setIsChatLoading(true);
      try {
        const response = await fetch(API_BASE + '/api/v1/chat/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg }) });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const fullContent = data.response || "Couldn't respond.";
        setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }]);
        let idx = 0;
        const interval = setInterval(() => { idx += 10; if (idx >= fullContent.length) { clearInterval(interval); setMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { role: 'assistant', content: fullContent, isTyping: false }; return msgs; }); } else { setMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { role: 'assistant', content: fullContent.slice(0, idx), isTyping: true }; return msgs; }); } }, 5);
      } catch (e) { setMessages(prev => [...prev, { role: 'assistant', content: "Error.", isError: true }]); }
      finally { setIsChatLoading(false); }
    }
  };

  const handleStrategyModify = async () => {
    const activeTabData = tabs.find(t => t.id === activeTab);
    if (!chatInput.trim() || isChatLoading || !activeTabData) return;
    const modifyRequest = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);
    const contextMsg = 'Current strategy:\n' + activeTabData.content + '\n\nModification request: ' + modifyRequest + '\n\nProvide the updated strategy in the same format (summary fields + Python code).';
    try {
      const response = await fetch(API_BASE + '/api/v1/chat/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: contextMsg }) });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      const fullContent = data.response || "Couldn't respond.";
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, content: '', parsed: null, isTyping: true } : t));
      let idx = 0;
      const interval = setInterval(() => { idx += 10; if (idx >= fullContent.length) { clearInterval(interval); const parsed = parseStrategyResponse(fullContent); setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, content: fullContent, parsed, isTyping: false } : t)); } else { setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, content: fullContent.slice(0, idx), isTyping: true } : t)); } }, 5);
    } catch (e) { setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, content: "Error modifying strategy.", isTyping: false } : t)); }
    finally { setIsChatLoading(false); }
  };

  const copyCode = (code, index) => { navigator.clipboard.writeText(code); setCopiedIndex(index); setTimeout(() => setCopiedIndex(null), 2000); };

  const renderCode = (code, key) => (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex justify-between items-center px-3 py-1.5 bg-[#0d0d12] border-b border-gray-700">
        <span className="text-sm text-gray-400 font-mono">python</span>
        <button onClick={() => copyCode(code, key)} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
          {copiedIndex === key ? <><Check className="w-3.5 h-3.5 text-emerald-400"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy</>}
        </button>
      </div>
      <pre className="p-3 bg-[#0a0a0e] overflow-x-auto text-sm text-gray-300 font-mono leading-relaxed">{code}</pre>
    </div>
  );

  const renderContent = (content, msgIdx) => {
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let last = 0, match;
    while ((match = codeRegex.exec(content)) !== null) { if (match.index > last) parts.push({ type: 'text', content: content.slice(last, match.index) }); parts.push({ type: 'code', lang: match[1] || 'python', content: match[2].trim() }); last = match.index + match[0].length; }
    if (last < content.length) parts.push({ type: 'text', content: content.slice(last) });
    if (!parts.length) parts.push({ type: 'text', content });
    return parts.map((p, i) => { if (p.type === 'code') { return <div key={i} className="my-2">{renderCode(p.content, msgIdx + '-' + i)}</div>; } return <span key={i} className="whitespace-pre-wrap">{p.content}</span>; });
  };

  const renderStrategySummary = (tab) => {
    const parsed = tab.parsed?.summary;
    if (!parsed) return <div className="text-gray-400 text-sm">Parsing strategy...</div>;
    return (
      <div className="space-y-3">
        {parsed.ticker && <div><label className="text-gray-400 text-sm font-medium">Ticker(s)</label><div className="text-[#e5e5e5] text-base mt-0.5">{parsed.ticker}</div></div>}
        {parsed.entry && <div><label className="text-gray-400 text-sm font-medium">Entry Condition</label><div className="text-[#e5e5e5] text-base mt-0.5">{parsed.entry}</div></div>}
        {parsed.exit && <div><label className="text-gray-400 text-sm font-medium">Exit Condition</label><div className="text-[#e5e5e5] text-base mt-0.5">{parsed.exit}</div></div>}
        {parsed.stopLoss && <div><label className="text-gray-400 text-sm font-medium">Stop Loss</label><div className="text-[#e5e5e5] text-base mt-0.5">{parsed.stopLoss}</div></div>}
        {parsed.positionSize && <div><label className="text-gray-400 text-sm font-medium">Position Size</label><div className="text-[#e5e5e5] text-base mt-0.5">{parsed.positionSize}</div></div>}
        {!parsed.ticker && !parsed.entry && parsed.description && <div className="text-[#e5e5e5] text-base whitespace-pre-wrap">{parsed.description}</div>}
      </div>
    );
  };

  const activeTabData = tabs.find(t => t.id === activeTab);
  const isStrategyTab = activeTab !== 'chat' && activeTabData;

  if (isCollapsed) {
    return (
      <div className="w-10 h-full bg-[#0d0d12] border-l border-gray-800 flex flex-col items-center py-2">
        <button onClick={() => setIsCollapsed(false)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none"><ChevronsLeft className="w-4 h-4 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" /></button>
        <div className="mt-2 p-1 bg-emerald-500/20 rounded"><Zap className="w-4 h-4 text-emerald-400" strokeWidth={2} /></div>
      </div>
    );
  }

  // Show loading overlay when generating a strategy (not during regular chat)
  const isGenerating = activeTab !== 'chat' && (isChatLoading || activeTabData?.isTyping);

  return (
    <div className="w-96 h-full bg-[#0d0d12] border-l border-gray-800 flex flex-col overflow-hidden relative">
      {/* Premium loading overlay */}
      <GrokLoadingOverlay isVisible={isGenerating} />
      
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={handleReset} className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-500 hover:text-white" title="Reset"><RotateCcw className="w-4 h-4" strokeWidth={1.5} /></button>
          <button onClick={() => setIsCollapsed(true)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none"><ChevronsRight className="w-4 h-4 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" /></button>
        </div>
      </div>

      <div className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="flex-shrink-0 space-y-2 overflow-y-auto">
            <div>
              <label className="text-gray-300 text-xs font-semibold mb-1.5 block">TICKER</label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {['QQQ', 'SPY', 'TSLA', 'NVDA', 'BTC'].map(s => (
                  <button
                    key={s}
                    onClick={() => selectedTickers.includes(s) ? removeTicker(s) : addTicker(s)}
                    className={'px-2 py-0.5 rounded-lg text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ' + (selectedTickers.includes(s) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-[#111118] text-[#e5e5e5] border border-gray-700 hover:border-emerald-500/50 hover:bg-white/5')}
                  >
                    ${s}
                  </button>
                ))}
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 bg-[#111118] border border-gray-700 rounded-lg px-2 py-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-white/5">
                  {isSearching ? <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" /> : <Search className="w-4 h-4 text-gray-500" />}
                  <input type="text" value={tickerSearch} onChange={(e) => setTickerSearch(e.target.value.toUpperCase())} placeholder="Search any stock..." className="flex-1 bg-transparent text-[#e5e5e5] placeholder-gray-500 text-sm outline-none" />
                  {tickerSearch && <button onClick={() => setTickerSearch('')}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button>}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#0d0d12] border border-gray-700 rounded-lg z-50 overflow-hidden shadow-xl">
                    {searchResults.map(t => (
                      <div key={t.symbol} onClick={() => addTicker(t.symbol)} className="flex items-center justify-between px-2 py-1.5 hover:bg-emerald-500/10 cursor-pointer text-sm transition-colors border-b border-gray-800/50 last:border-0">
                        <div className="flex items-center gap-2 min-w-0"><span className="text-[#e5e5e5] font-semibold">${t.symbol}</span><span className="text-gray-500 truncate">{t.name}</span></div>
                        <div className="flex items-center gap-2 flex-shrink-0">{t.exchange && <span className="text-[10px] text-gray-600">{t.exchange}</span>}<Plus className="w-4 h-4 text-emerald-400" /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-gray-300 text-xs font-semibold mb-1.5 block">QUICK STRATEGIES</label>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: 'golden-cross', name: 'Golden Cross', icon: TrendingUp, prompt: 'Create a Golden Cross strategy using SMA 50/200 crossover. Buy when SMA50 crosses above SMA200, sell when it crosses below.' },
                  { id: 'rsi-reversal', name: 'RSI Reversal', icon: BarChart3, prompt: 'Create an RSI reversal strategy. Buy when RSI drops below 30 (oversold), sell when RSI rises above 70 (overbought).' },
                  { id: 'vwap-bounce', name: 'VWAP Bounce', icon: Activity, prompt: 'Create a VWAP bounce strategy. Buy when price touches VWAP from above and bounces, with stop loss below VWAP.' },
                  { id: 'breakout-hunter', name: 'Breakout Hunter', icon: Rocket, prompt: 'Create a breakout strategy. Buy when price breaks above recent resistance with volume confirmation, stop loss at breakout level.' },
                ].map(template => {
                  const Icon = template.icon;
                  const isSelected = selectedQuickStrategy === template.name;
                  return (
                    <button key={template.id} onClick={() => { setSelectedQuickStrategy(template.name); const ticker = selectedTickers[0] || ''; setStrategyName(ticker ? '$' + ticker + ' - ' + template.name : template.name); const tickerContext = selectedTickers.length > 0 ? ' for ' + selectedTickers.join(', ') : ''; setChatInput(template.prompt + tickerContext); }} className={'flex items-center gap-2 p-2 rounded-lg transition-all duration-200 hover:-translate-y-0.5 text-left ' + (isSelected ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-[#111118] border border-gray-800 hover:border-emerald-500/50 hover:bg-white/5')}>
                      <Icon className={'w-4 h-4 flex-shrink-0 text-emerald-400'} strokeWidth={1.5} />
                      <span className={'text-xs ' + (isSelected ? 'text-emerald-400' : 'text-[#e5e5e5]')}>{template.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-gray-300 text-xs font-semibold mb-1.5 block">STRATEGY</label>
              <div className="grid grid-cols-3 gap-1">
                {STRATEGY_TYPES.map(s => { const Icon = s.icon; return (
                  <button key={s.id} onClick={() => setSelectedStrategy(prev => prev === s.id ? null : s.id)} className={'p-1.5 rounded-lg text-center transition-all duration-200 hover:-translate-y-0.5 ' + (selectedStrategy === s.id ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-[#111118] border border-gray-800 hover:border-emerald-500/50 hover:bg-white/5')}>
                    <Icon className={'w-4 h-4 mx-auto ' + (selectedStrategy === s.id ? 'text-emerald-400' : 'text-gray-500')} strokeWidth={1.5} />
                    <span className={'text-xs block mt-1 ' + (selectedStrategy === s.id ? 'text-emerald-400' : 'text-[#e5e5e5]')}>{s.name}</span>
                  </button>
                ); })}
              </div>
            </div>
            <div>
              <label className="text-gray-300 text-xs font-semibold mb-1.5 block">TIMEFRAME</label>
              <div className="flex gap-1">
                {TIMEFRAMES.map(tf => (
                  <button key={tf.id} onClick={() => setSelectedTimeframe(prev => prev === tf.id ? null : tf.id)} className={'flex-1 py-1 rounded-lg text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ' + (selectedTimeframe === tf.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-[#111118] text-[#e5e5e5] border border-gray-800 hover:border-emerald-500/50 hover:bg-white/5')}>{tf.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-300 text-xs font-semibold mb-1.5 block">CHART</label>
              <div className="flex gap-1">
                {CHART_TIMEFRAMES.map(tf => (
                  <button key={tf.id} onClick={() => setSelectedChartTimeframe(prev => prev === tf.id ? null : tf.id)} className={'flex-1 py-1 rounded-lg text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ' + (selectedChartTimeframe === tf.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-[#111118] text-[#e5e5e5] border border-gray-800 hover:border-emerald-500/50 hover:bg-white/5')}>{tf.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-300 text-xs font-semibold mb-1.5 block">NAME</label>
              <input type="text" value={strategyName} onChange={(e) => setStrategyName(e.target.value)} placeholder="Strategy name..." className="w-full px-2 py-1.5 bg-[#111118] border border-gray-700 rounded-lg text-[#e5e5e5] placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 hover:border-emerald-500/50 hover:bg-white/5 transition-colors" />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'chat' && <label className="text-gray-300 text-xs font-semibold mb-1.5 block flex-shrink-0">GROK CHAT</label>}
          <div className="flex-1 flex flex-col bg-[#0d0d12] border border-gray-700 rounded-lg overflow-hidden">
            {isStrategyTab && (
              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-700 flex-shrink-0">
                <button onClick={() => setActiveSubTab('strategy')} className={'px-2 py-0.5 rounded text-xs font-medium transition-all ' + (activeSubTab === 'strategy' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-[#e5e5e5]')}>Strategy</button>
                <button onClick={() => setActiveSubTab('code')} className={'px-2 py-0.5 rounded text-xs font-medium transition-all ' + (activeSubTab === 'code' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-[#e5e5e5]')}>Code</button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="px-2 py-1.5 space-y-2">
                {activeTab === 'chat' ? (
                  <>
                    {messages.map((m, i) => (
                      <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={'max-w-[90%] rounded-lg px-2 py-1.5 ' + (m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-[#111118] text-[#e5e5e5]')}>
                          {m.role === 'assistant' && m.isTyping && <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /></div>}
                          <div className="text-sm leading-relaxed">{renderContent(m.content, i)}</div>
                        </div>
                      </div>
                    ))}
                    {isChatLoading && messages[messages.length - 1]?.role === 'user' && <div className="flex justify-start"><div className="bg-[#111118] rounded-lg px-2 py-1.5 flex items-center gap-2"><Loader2 className="w-4 h-4 text-emerald-400 animate-spin" /><span className="text-gray-500 text-sm">Thinking...</span></div></div>}
                  </>
                ) : (
                  <>
                    {activeTabData?.isTyping ? <div className="py-8 flex items-center justify-center"><Loader2 className="w-5 h-5 text-emerald-400 animate-spin" /><span className="text-gray-500 text-sm ml-2">Generating strategy...</span></div>
                    : activeTabData?.content ? <div className="text-[#e5e5e5]">{activeSubTab === 'strategy' ? renderStrategySummary(activeTabData) : (activeTabData.parsed?.code ? renderCode(activeTabData.parsed.code, activeTab) : <div className="text-gray-500 text-sm">No code found</div>)}</div>
                    : <div className="py-8 flex items-center justify-center text-gray-500 text-sm">No content</div>}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            {isStrategyTab && !activeTabData?.isTyping && activeTabData?.content && (
              <div className="flex gap-2 px-2 py-1.5 border-t border-gray-700 flex-shrink-0">
                <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium bg-[#111118] text-gray-300 border border-gray-600 hover:border-gray-500 hover:text-white transition-colors"><Save className="w-4 h-4" />Save</button>
                <button onClick={handleSaveAndDeploy} className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"><Play className="w-4 h-4" />Save & Deploy</button>
              </div>
            )}
            <div className="flex gap-2 p-2 border-t border-gray-700 flex-shrink-0">
              <textarea ref={inputRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); activeTab === 'chat' ? handleChatSend() : handleStrategyModify(); } }} placeholder={activeTab === 'chat' ? "Ask Grok..." : "Ask Grok to modify this strategy..."} className="flex-1 px-2 py-1.5 bg-[#111118] border border-gray-700 rounded-lg text-[#e5e5e5] placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-emerald-500/50 hover:border-emerald-500/50 hover:bg-white/5 transition-colors overflow-hidden" style={{ minHeight: '52px', maxHeight: '120px' }} />
              <button onClick={activeTab === 'chat' ? handleChatSend : handleStrategyModify} disabled={!chatInput.trim() || isChatLoading} className={'px-2 self-end rounded-lg transition-all h-9 ' + (chatInput.trim() && !isChatLoading ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-800 text-gray-600')}>{isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrokPanel;
