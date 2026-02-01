import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Loader2, Copy, Check, Zap, Search, X, Plus,
  TrendingUp, BarChart3, RefreshCcw, Rocket, Activity, Target,
  ChevronLeft, ChevronRight, RotateCcw
} from 'lucide-react';

const API_BASE = 'https://atlas-api-production-5944.up.railway.app';

const ALL_TICKERS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq ETF' },
  { symbol: 'DIA', name: 'Dow Jones ETF' },
  { symbol: 'AMD', name: 'AMD' },
  { symbol: 'INTC', name: 'Intel' },
  { symbol: 'PLTR', name: 'Palantir' },
  { symbol: 'SOFI', name: 'SoFi' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'SMCI', name: 'Super Micro' },
  { symbol: 'ARM', name: 'Arm Holdings' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'LINK', name: 'Chainlink' },
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

const GrokPanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [tickerSearch, setTickerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyName, setStrategyName] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!tickerSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const query = tickerSearch.toLowerCase();
    const results = ALL_TICKERS.filter(t => 
      !selectedTickers.includes(t.symbol) &&
      (t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query))
    ).slice(0, 5);
    setSearchResults(results);
  }, [tickerSearch, selectedTickers]);

  const addTicker = (symbol) => {
    if (!selectedTickers.includes(symbol)) {
      setSelectedTickers(prev => [...prev, symbol]);
    }
    setTickerSearch('');
    setSearchResults([]);
  };

  const removeTicker = (symbol) => {
    setSelectedTickers(prev => prev.filter(s => s !== symbol));
  };

  // Reset everything
  const handleReset = () => {
    setSelectedTickers([]);
    setSelectedStrategy(null);
    setStrategyName('');
    setSelectedTimeframe(null);
    setMessages([]);
    setChatInput('');
    setTickerSearch('');
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/atlas/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      const fullContent = data.response || "Couldn't respond.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }]);
      let idx = 0;
      const interval = setInterval(() => {
        idx += 10;
        if (idx >= fullContent.length) {
          clearInterval(interval);
          setMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = { role: 'assistant', content: fullContent, isTyping: false };
            return msgs;
          });
        } else {
          setMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = { role: 'assistant', content: fullContent.slice(0, idx), isTyping: true };
            return msgs;
          });
        }
      }, 5);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error.", isError: true }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderMessage = (content, msgIdx) => {
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let last = 0, match;
    while ((match = codeRegex.exec(content)) !== null) {
      if (match.index > last) parts.push({ type: 'text', content: content.slice(last, match.index) });
      parts.push({ type: 'code', lang: match[1] || 'python', content: match[2].trim() });
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push({ type: 'text', content: content.slice(last) });
    if (!parts.length) parts.push({ type: 'text', content });

    return parts.map((p, i) => {
      if (p.type === 'code') {
        const key = `${msgIdx}-${i}`;
        return (
          <div key={i} className="my-1 rounded border border-gray-700 overflow-hidden">
            <div className="flex justify-between px-2 py-0.5 bg-[#0a1628] border-b border-gray-700">
              <span className="text-[9px] text-gray-500 font-mono">{p.lang}</span>
              <button onClick={() => copyCode(p.content, key)} className="text-[9px] text-gray-500 hover:text-white flex items-center gap-0.5">
                {copiedIndex === key ? <Check className="w-2.5 h-2.5 text-emerald-400"/> : <Copy className="w-2.5 h-2.5"/>}
              </button>
            </div>
            <pre className="p-1.5 bg-[#060d18] overflow-x-auto text-[10px] text-gray-300 font-mono leading-tight">{p.content}</pre>
          </div>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{p.content}</span>;
    });
  };

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="w-10 h-full bg-[#060d18] border-l border-gray-800 flex flex-col items-center py-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <div className="mt-2 p-1 bg-emerald-500/20 rounded">
          <Zap className="w-4 h-4 text-emerald-400" strokeWidth={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 h-full bg-[#060d18] border-l border-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-emerald-500/20 rounded">
            <Zap className="w-4 h-4 text-emerald-400" strokeWidth={2} />
          </div>
          <span className="text-[#e5e5e5] font-medium text-sm">Grok</span>
          <span className="text-gray-600 text-[10px]">xAI</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleReset} 
            className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-500 hover:text-white"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button onClick={() => setIsCollapsed(true)} className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white">
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Content - fits page, no scroll */}
      <div className="flex-1 p-2.5 flex flex-col gap-2.5 overflow-hidden">
        
        {/* Ticker */}
        <div className="flex-shrink-0">
          <label className="text-gray-500 text-[10px] font-medium mb-1 block">TICKER</label>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {['QQQ', 'SPY', 'TSLA', 'NVDA', 'BTC'].map(s => (
              <button
                key={s}
                onClick={() => selectedTickers.includes(s) ? removeTicker(s) : addTicker(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  selectedTickers.includes(s)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-[#0d1829] text-[#e5e5e5] border border-gray-700 hover:border-emerald-500/30 hover:bg-[#0d1829]/80'
                }`}
              >
                ${s}
              </button>
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-1 bg-[#0d1829] border border-gray-700 rounded px-2 py-1 hover:border-gray-600 transition-colors">
              <Search className="w-3 h-3 text-gray-600" />
              <input
                type="text"
                value={tickerSearch}
                onChange={(e) => setTickerSearch(e.target.value)}
                placeholder="Search ticker..."
                className="flex-1 bg-transparent text-[#e5e5e5] placeholder-gray-600 text-[11px] outline-none"
              />
              {tickerSearch && <button onClick={() => setTickerSearch('')}><X className="w-3 h-3 text-gray-500 hover:text-white" /></button>}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-0.5 bg-[#0d1829] border border-gray-700 rounded z-50">
                {searchResults.map(t => (
                  <div key={t.symbol} onClick={() => addTicker(t.symbol)} className="flex items-center justify-between px-2 py-1 hover:bg-emerald-500/10 cursor-pointer text-[11px] transition-colors">
                    <span><span className="text-[#e5e5e5]">${t.symbol}</span> <span className="text-gray-500">{t.name}</span></span>
                    <Plus className="w-3 h-3 text-emerald-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedTickers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {selectedTickers.filter(s => !['QQQ', 'SPY', 'TSLA', 'NVDA', 'BTC'].includes(s)).map(s => (
                <span key={s} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded text-[10px]">
                  ${s}<button onClick={() => removeTicker(s)} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Strategy */}
        <div className="flex-shrink-0">
          <label className="text-gray-500 text-[10px] font-medium mb-1 block">STRATEGY</label>
          <div className="grid grid-cols-3 gap-1">
            {STRATEGY_TYPES.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStrategy(prev => prev === s.id ? null : s.id)}
                  className={`p-1.5 rounded text-center transition-all hover:bg-[#0d1829]/80 ${
                    selectedStrategy === s.id
                      ? 'bg-emerald-500/20 border border-emerald-500/50'
                      : 'bg-[#0d1829] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-3 h-3 mx-auto ${selectedStrategy === s.id ? 'text-emerald-400' : 'text-gray-500'}`} strokeWidth={1.5} />
                  <span className={`text-[9px] block mt-0.5 ${selectedStrategy === s.id ? 'text-emerald-400' : 'text-[#e5e5e5]'}`}>{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeframe */}
        <div className="flex-shrink-0">
          <label className="text-gray-500 text-[10px] font-medium mb-1 block">TIMEFRAME</label>
          <div className="flex gap-1">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.id}
                onClick={() => setSelectedTimeframe(prev => prev === tf.id ? null : tf.id)}
                className={`flex-1 py-1 rounded text-[11px] font-medium transition-all hover:bg-[#0d1829]/80 ${
                  selectedTimeframe === tf.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-[#0d1829] text-[#e5e5e5] border border-gray-700 hover:border-gray-600'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="flex-shrink-0">
          <label className="text-gray-500 text-[10px] font-medium mb-1 block">NAME</label>
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder="Strategy name..."
            className="w-full px-2 py-1 bg-[#0d1829] border border-gray-700 rounded text-[#e5e5e5] placeholder-gray-600 text-[11px] focus:outline-none focus:border-emerald-500 hover:border-gray-600 transition-colors"
          />
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <label className="text-gray-500 text-[10px] font-medium mb-1 block flex-shrink-0">GROK CHAT</label>
          
          {messages.length > 0 && (
            <div className="flex-1 bg-[#0a1628] border border-gray-700 rounded mb-1.5 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'none' }}>
              <div className="p-1.5 space-y-1.5">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[95%] rounded px-2 py-1 transition-all cursor-default ${
                      m.role === 'user' 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                        : 'bg-[#0d1829] text-[#e5e5e5] border border-gray-800 hover:bg-[#111d2e] hover:border-gray-700'
                    }`}>
                      {m.role === 'assistant' && (
                        <div className="flex items-center gap-1 mb-0.5 pb-0.5 border-b border-gray-700/50">
                          <Zap className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[9px]">Grok</span>
                          {m.isTyping && <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse ml-auto" />}
                        </div>
                      )}
                      <div className="text-[10px] leading-relaxed">{renderMessage(m.content, i)}</div>
                    </div>
                  </div>
                ))}
                {isChatLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex justify-start">
                    <div className="bg-[#0d1829] border border-gray-800 rounded px-2 py-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                      <span className="text-gray-500 text-[9px]">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          <div className="flex gap-1 flex-shrink-0">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
              placeholder="Ask Grok..."
              rows={2}
              className="flex-1 px-2 py-1.5 bg-[#0d1829] border border-gray-700 rounded text-[#e5e5e5] placeholder-gray-600 text-[11px] resize-none focus:outline-none focus:border-emerald-500 hover:border-gray-600 transition-colors"
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim() || isChatLoading}
              className={`px-2 rounded transition-all ${chatInput.trim() && !isChatLoading ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-800 text-gray-600 hover:bg-gray-700'}`}
            >
              {isChatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrokPanel;
