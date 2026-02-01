import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Loader2, Copy, Check, RotateCcw, Zap, Search, X, Plus,
  TrendingUp, BarChart3, RefreshCcw, Rocket, Activity, Target,
  ChevronRight
} from 'lucide-react';

const API_BASE = 'https://atlas-api-production-5944.up.railway.app';

// Large searchable ticker database
const ALL_TICKERS = [
  // Mag 7 + Big Tech
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  
  // Indices & ETFs
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000' },
  { symbol: 'VOO', name: 'Vanguard S&P 500' },
  { symbol: 'VTI', name: 'Vanguard Total Stock' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF' },
  { symbol: 'ARKG', name: 'ARK Genomic ETF' },
  { symbol: 'SOXL', name: 'Direxion Semi Bull 3X' },
  { symbol: 'TQQQ', name: 'ProShares UltraPro QQQ' },
  { symbol: 'SQQQ', name: 'ProShares Short QQQ 3X' },
  { symbol: 'XLF', name: 'Financial Select SPDR' },
  { symbol: 'XLK', name: 'Technology Select SPDR' },
  { symbol: 'XLE', name: 'Energy Select SPDR' },
  { symbol: 'GLD', name: 'SPDR Gold Trust' },
  { symbol: 'SLV', name: 'iShares Silver Trust' },
  
  // Meme & Retail Favorites
  { symbol: 'GME', name: 'GameStop Corp.' },
  { symbol: 'AMC', name: 'AMC Entertainment' },
  { symbol: 'BB', name: 'BlackBerry Limited' },
  { symbol: 'NOK', name: 'Nokia Corporation' },
  { symbol: 'PLTR', name: 'Palantir Technologies' },
  { symbol: 'SOFI', name: 'SoFi Technologies' },
  { symbol: 'HOOD', name: 'Robinhood Markets' },
  { symbol: 'COIN', name: 'Coinbase Global' },
  { symbol: 'MSTR', name: 'MicroStrategy' },
  
  // EV & Auto
  { symbol: 'RIVN', name: 'Rivian Automotive' },
  { symbol: 'LCID', name: 'Lucid Group' },
  { symbol: 'NIO', name: 'NIO Inc.' },
  { symbol: 'XPEV', name: 'XPeng Inc.' },
  { symbol: 'LI', name: 'Li Auto Inc.' },
  { symbol: 'F', name: 'Ford Motor Company' },
  { symbol: 'GM', name: 'General Motors' },
  
  // Space & Defense
  { symbol: 'RKLB', name: 'Rocket Lab USA' },
  { symbol: 'ASTS', name: 'AST SpaceMobile' },
  { symbol: 'LUNR', name: 'Intuitive Machines' },
  { symbol: 'BA', name: 'Boeing Company' },
  { symbol: 'LMT', name: 'Lockheed Martin' },
  { symbol: 'RTX', name: 'RTX Corporation' },
  { symbol: 'NOC', name: 'Northrop Grumman' },
  
  // AI & Quantum
  { symbol: 'AI', name: 'C3.ai, Inc.' },
  { symbol: 'BBAI', name: 'BigBear.ai Holdings' },
  { symbol: 'SOUN', name: 'SoundHound AI' },
  { symbol: 'IONQ', name: 'IonQ, Inc.' },
  { symbol: 'RGTI', name: 'Rigetti Computing' },
  { symbol: 'QUBT', name: 'Quantum Computing' },
  { symbol: 'PATH', name: 'UiPath Inc.' },
  
  // Semiconductors
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'MU', name: 'Micron Technology' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.' },
  { symbol: 'MRVL', name: 'Marvell Technology' },
  { symbol: 'ASML', name: 'ASML Holding' },
  { symbol: 'SMCI', name: 'Super Micro Computer' },
  { symbol: 'ARM', name: 'Arm Holdings' },
  
  // Software & Cloud
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'CRM', name: 'Salesforce, Inc.' },
  { symbol: 'NOW', name: 'ServiceNow, Inc.' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'DDOG', name: 'Datadog, Inc.' },
  { symbol: 'NET', name: 'Cloudflare, Inc.' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings' },
  { symbol: 'ZS', name: 'Zscaler, Inc.' },
  { symbol: 'MDB', name: 'MongoDB, Inc.' },
  { symbol: 'SHOP', name: 'Shopify Inc.' },
  { symbol: 'PANW', name: 'Palo Alto Networks' },
  { symbol: 'ZM', name: 'Zoom Video' },
  
  // Healthcare & Biotech
  { symbol: 'HIMS', name: 'Hims & Hers Health' },
  { symbol: 'MRNA', name: 'Moderna, Inc.' },
  { symbol: 'BNTX', name: 'BioNTech SE' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'UNH', name: 'UnitedHealth Group' },
  { symbol: 'LLY', name: 'Eli Lilly' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  
  // Energy & Solar
  { symbol: 'ENPH', name: 'Enphase Energy' },
  { symbol: 'FSLR', name: 'First Solar, Inc.' },
  { symbol: 'PLUG', name: 'Plug Power Inc.' },
  { symbol: 'XOM', name: 'Exxon Mobil' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  
  // Consumer & Retail
  { symbol: 'ELF', name: 'e.l.f. Beauty' },
  { symbol: 'LULU', name: 'Lululemon Athletica' },
  { symbol: 'NKE', name: 'Nike, Inc.' },
  { symbol: 'SBUX', name: 'Starbucks Corporation' },
  { symbol: 'MCD', name: "McDonald's Corporation" },
  { symbol: 'COST', name: 'Costco Wholesale' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'TGT', name: 'Target Corporation' },
  
  // Streaming & Media
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'DIS', name: 'Walt Disney Company' },
  { symbol: 'SPOT', name: 'Spotify Technology' },
  { symbol: 'ROKU', name: 'Roku, Inc.' },
  
  // Social & Internet
  { symbol: 'SNAP', name: 'Snap Inc.' },
  { symbol: 'PINS', name: 'Pinterest, Inc.' },
  { symbol: 'RDDT', name: 'Reddit, Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies' },
  { symbol: 'LYFT', name: 'Lyft, Inc.' },
  { symbol: 'ABNB', name: 'Airbnb, Inc.' },
  { symbol: 'DASH', name: 'DoorDash, Inc.' },
  
  // Fintech & Payments
  { symbol: 'PYPL', name: 'PayPal Holdings' },
  { symbol: 'SQ', name: 'Block, Inc.' },
  { symbol: 'AFRM', name: 'Affirm Holdings' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  
  // Banks & Financial
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'BAC', name: 'Bank of America' },
  { symbol: 'WFC', name: 'Wells Fargo' },
  { symbol: 'GS', name: 'Goldman Sachs' },
  { symbol: 'MS', name: 'Morgan Stanley' },
  
  // Crypto
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'SHIB', name: 'Shiba Inu' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'NEAR', name: 'NEAR Protocol' },
  { symbol: 'APT', name: 'Aptos' },
  { symbol: 'SUI', name: 'Sui' },
  { symbol: 'PEPE', name: 'Pepe' },
  { symbol: 'WIF', name: 'dogwifhat' },
  { symbol: 'BONK', name: 'Bonk' },
  
  // Mining
  { symbol: 'MARA', name: 'Marathon Digital' },
  { symbol: 'RIOT', name: 'Riot Platforms' },
  { symbol: 'CLSK', name: 'CleanSpark Inc.' },
];

const STRATEGY_TYPES = [
  { id: 'momentum', name: 'Momentum', desc: 'MA crossover signals', icon: TrendingUp, color: 'text-blue-400' },
  { id: 'rsi', name: 'RSI', desc: 'Oversold/overbought', icon: BarChart3, color: 'text-purple-400' },
  { id: 'mean-reversion', name: 'Mean Rev', desc: 'Bounce back to mean', icon: RefreshCcw, color: 'text-cyan-400' },
  { id: 'breakout', name: 'Breakout', desc: 'Catch explosive moves', icon: Rocket, color: 'text-red-400' },
  { id: 'macd', name: 'MACD', desc: 'Signal line crossover', icon: Activity, color: 'text-yellow-400' },
  { id: 'scalp', name: 'Scalp', desc: 'Quick in-and-out', icon: Target, color: 'text-emerald-400' },
];

const TIMEFRAMES = [
  { id: '1m', label: '1', sub: 'Month' },
  { id: '3m', label: '3', sub: 'Months' },
  { id: '6m', label: '6', sub: 'Months' },
  { id: '9m', label: '9', sub: 'Months' },
  { id: '1y', label: '1', sub: 'Year' },
];

const GrokPanel = () => {
  // Ticker search state
  const [tickerSearch, setTickerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTickers, setSelectedTickers] = useState([]);
  
  // Form state
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyName, setStrategyName] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState('3m');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Search tickers
  useEffect(() => {
    if (!tickerSearch.trim()) {
      setSearchResults([]);
      return;
    }
    
    const query = tickerSearch.toLowerCase();
    const results = ALL_TICKERS.filter(t => 
      !selectedTickers.includes(t.symbol) &&
      (t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query))
    ).slice(0, 8);
    
    setSearchResults(results);
  }, [tickerSearch, selectedTickers]);

  // Add ticker
  const addTicker = (symbol) => {
    if (!selectedTickers.includes(symbol)) {
      setSelectedTickers(prev => [...prev, symbol]);
    }
    setTickerSearch('');
    setSearchResults([]);
  };

  // Remove ticker
  const removeTicker = (symbol) => {
    setSelectedTickers(prev => prev.filter(s => s !== symbol));
  };

  // Toggle strategy type
  const toggleStrategy = (id) => {
    setSelectedStrategy(prev => prev === id ? null : id);
  };

  // Generate strategy
  const handleGenerateStrategy = async () => {
    if (selectedTickers.length === 0 || !selectedStrategy) return;
    
    setIsGenerating(true);
    
    const strategyType = STRATEGY_TYPES.find(s => s.id === selectedStrategy);
    const timeframe = TIMEFRAMES.find(t => t.id === selectedTimeframe);
    const tickerList = selectedTickers.map(t => '$' + t).join(', ');
    
    const prompt = `Create a ${strategyType.name} trading strategy for ${tickerList}. 
Strategy name: ${strategyName || `${strategyType.name} Strategy`}
Backtest period: ${timeframe.label} ${timeframe.sub}

Include entry/exit conditions, risk management rules, and provide executable Python code for backtesting.`;

    setMessages(prev => [...prev, { 
      role: 'user', 
      content: `Generate ${strategyType.name} strategy for ${tickerList}` 
    }]);

    try {
      const response = await fetch(`${API_BASE}/api/atlas/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });

      if (!response.ok) throw new Error('Failed to generate');

      const data = await response.json();
      const fullContent = data.response || "I couldn't generate a strategy. Please try again.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }]);
      
      let currentIndex = 0;
      const typeInterval = setInterval(() => {
        currentIndex += 5;
        if (currentIndex >= fullContent.length) {
          clearInterval(typeInterval);
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: fullContent,
              isTyping: false
            };
            return newMessages;
          });
        } else {
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: fullContent.slice(0, currentIndex),
              isTyping: true
            };
            return newMessages;
          });
        }
      }, 8);

    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I couldn't connect to the server. Please try again.",
        isError: true
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Send chat message
  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/atlas/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      const fullContent = data.response || "I couldn't generate a response. Please try again.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }]);
      
      let currentIndex = 0;
      const typeInterval = setInterval(() => {
        currentIndex += 5;
        if (currentIndex >= fullContent.length) {
          clearInterval(typeInterval);
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: fullContent,
              isTyping: false
            };
            return newMessages;
          });
        } else {
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: fullContent.slice(0, currentIndex),
              isTyping: true
            };
            return newMessages;
          });
        }
      }, 8);

    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I couldn't connect to the server. Please try again.",
        isError: true
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Render message with code blocks
  const renderMessage = (content, messageIndex) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', language: match[1] || 'python', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', content });
    }

    return parts.map((part, i) => {
      if (part.type === 'code') {
        const codeKey = `${messageIndex}-${i}`;
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-gray-700">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a1628] border-b border-gray-700">
              <span className="text-xs text-gray-400 font-mono">{part.language}</span>
              <button
                onClick={() => copyCode(part.content, codeKey)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              >
                {copiedIndex === codeKey ? (
                  <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
                ) : (
                  <><Copy className="w-3 h-3" /><span>Copy</span></>
                )}
              </button>
            </div>
            <pre className="p-2 bg-[#060d18] overflow-x-auto">
              <code className="text-xs text-gray-300 font-mono">{part.content}</code>
            </pre>
          </div>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part.content}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#060d18] border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-orange-400" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Grok</h2>
            <p className="text-gray-500 text-xs">by xAI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Clear chat"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        
        <div className="p-4 space-y-5">
          
          {/* Ticker Search & Selection */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block">
              Select Ticker (search any symbol)
            </label>
            
            {/* Quick Ticker Tabs */}
            <div className="flex flex-wrap gap-2 mb-3">
              {['QQQ', 'SPY', 'TSLA', 'NVDA', 'BTC'].map(symbol => (
                <button
                  key={symbol}
                  onClick={() => !selectedTickers.includes(symbol) && addTicker(symbol)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedTickers.includes(symbol)
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                      : 'bg-[#0d1829] text-gray-300 border border-gray-700 hover:border-orange-500/50 hover:text-orange-400'
                  }`}
                >
                  ${symbol}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <div className="flex items-center gap-2 bg-[#0d1829] border border-gray-700 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                <input
                  type="text"
                  value={tickerSearch}
                  onChange={(e) => setTickerSearch(e.target.value)}
                  placeholder="Search ticker symbol..."
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
                />
                {tickerSearch && (
                  <button onClick={() => setTickerSearch('')} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#0d1829] border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {searchResults.map((ticker) => (
                    <div 
                      key={ticker.symbol}
                      onClick={() => addTicker(ticker.symbol)}
                      className="flex items-center justify-between px-3 py-2 hover:bg-orange-500/20 cursor-pointer transition-colors border-b border-gray-800/50 last:border-0"
                    >
                      <div>
                        <span className="text-white font-semibold text-sm">${ticker.symbol}</span>
                        <span className="text-gray-400 text-xs ml-2">{ticker.name}</span>
                      </div>
                      <Plus className="w-4 h-4 text-orange-400" strokeWidth={2} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Selected Tickers */}
            {selectedTickers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTickers.map(symbol => (
                  <div
                    key={symbol}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg text-sm font-medium"
                  >
                    <span>${symbol}</span>
                    <button
                      onClick={() => removeTicker(symbol)}
                      className="hover:text-orange-300"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {selectedTickers.length === 0 && (
              <p className="text-gray-500 text-xs">Search and select tickers to build your strategy</p>
            )}
          </div>

          {/* Strategy Type */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block">
              Strategy Type (click again to deselect)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STRATEGY_TYPES.map(strategy => {
                const Icon = strategy.icon;
                return (
                  <button
                    key={strategy.id}
                    onClick={() => toggleStrategy(strategy.id)}
                    className={`p-3 rounded-lg text-left transition-all ${
                      selectedStrategy === strategy.id
                        ? 'bg-orange-500/20 border border-orange-500/50'
                        : 'bg-[#0d1829] border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${strategy.color}`} strokeWidth={1.5} />
                      <span className="text-white text-sm font-medium">{strategy.name}</span>
                    </div>
                    <p className="text-gray-500 text-xs truncate">{strategy.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Backtest Timeframe */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block">Backtest Timeframe</label>
            <div className="flex gap-2">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setSelectedTimeframe(tf.id)}
                  className={`flex-1 py-2 rounded-lg text-center transition-all ${
                    selectedTimeframe === tf.id
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                      : 'bg-[#0d1829] text-gray-300 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-medium">{tf.label}</div>
                  <div className="text-xs text-gray-500">{tf.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Strategy Name */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block">Strategy Name</label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="Name your strategy..."
              className="w-full px-3 py-2.5 bg-[#0d1829] border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Grok Chat Section */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block">
              Grok Chat
            </label>
            
            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="bg-[#0a1628] border border-gray-700 rounded-lg mb-3 max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                <div className="p-3 space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] rounded-xl px-3 py-2 ${
                        msg.role === 'user'
                          ? 'bg-orange-600 text-white'
                          : msg.isError
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-[#0d1829] text-gray-200 border border-gray-800'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-700/50">
                            <Zap className="w-3.5 h-3.5 text-orange-400" strokeWidth={2} />
                            <span className="text-orange-400 text-xs font-medium">Grok</span>
                            {msg.isTyping && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse ml-auto" />}
                          </div>
                        )}
                        <div className="text-sm leading-relaxed">
                          {renderMessage(msg.content, i)}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isChatLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex justify-start">
                      <div className="bg-[#0d1829] border border-gray-800 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                          <span className="text-gray-400 text-sm">Grok is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            {/* Chat Input - 2x Taller */}
            <div className="flex items-end gap-2">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Ask Grok anything about trading strategies..."
                rows={3}
                className="flex-1 px-3 py-3 bg-[#0d1829] border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-orange-500"
                style={{ minHeight: '88px' }}
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isChatLoading}
                className={`p-3 rounded-lg transition-all self-stretch flex items-center justify-center ${
                  chatInput.trim() && !isChatLoading
                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isChatLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button - Fixed at bottom */}
      <div className="p-4 border-t border-gray-800 bg-[#0a1628] flex-shrink-0">
        <button
          onClick={handleGenerateStrategy}
          disabled={selectedTickers.length === 0 || !selectedStrategy || isGenerating}
          className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            selectedTickers.length > 0 && selectedStrategy && !isGenerating
              ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              Generate Strategy
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default GrokPanel;
