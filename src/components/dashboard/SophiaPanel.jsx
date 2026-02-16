import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Volume2, Trash2, Brain, ChevronDown, Rocket, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { useSophiaChat } from '../../hooks/useSophiaChat';
import { STRATEGIES } from '../strategies/FeaturedStrategies';

const STRATEGY_PRESETS = [
  { label: 'Growth Investing', prompt: 'Build me a Growth Investing strategy for $NVDA. Focus on revenue acceleration, earnings momentum, and technical breakouts. Backtest with $10,000.' },
  { label: 'Momentum Trading', prompt: 'Build me a Momentum Trading strategy for $TSLA. Use MACD, RSI, and relative strength. Backtest with $10,000.' },
  { label: 'Day Trading', prompt: 'Build me a Day Trading strategy for $SPY using VWAP and Opening Range Breakouts. Backtest on 5-min candles with $10,000.' },
  { label: 'RSI Bounce', prompt: 'Build a mean reversion RSI Bounce strategy for $AAPL. Buy when RSI(14) drops below 30, sell above 55. Backtest with $10,000.' },
  { label: 'MACD Crossover', prompt: 'Build a MACD Crossover strategy for $AMD on the daily chart. Backtest 6 months with $10,000.' },
  { label: 'Bollinger Squeeze', prompt: 'Build a Bollinger Band Squeeze breakout strategy for $META. Backtest 3 months with $10,000.' },
];

const PANEL_WIDTHS = { full: 480, half: 280, collapsed: 40 };

const SophiaPanel = ({ onStrategyGenerated, onCollapsedChange, onOpenWizard, wizardPrompt, onWizardPromptConsumed }) => {
  const { messages, sendMessage, isLoading, currentStrategy, clearChat } = useSophiaChat();
  const [input, setInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [panelState, setPanelState] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-sophia-panel-state');
      return saved && ['full', 'half', 'collapsed'].includes(saved) ? saved : 'full';
    } catch { return 'full'; }
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem('stratify-sophia-panel-state', panelState); } catch {}
  }, [panelState]);

  useEffect(() => {
    onCollapsedChange && onCollapsedChange(panelState === 'collapsed', panelState);
  }, [panelState, onCollapsedChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const strategyHandledRef = useRef(null);
  useEffect(() => {
    if (currentStrategy && onStrategyGenerated && currentStrategy !== strategyHandledRef.current) {
      strategyHandledRef.current = currentStrategy;
      onStrategyGenerated(currentStrategy);
    }
  }, [currentStrategy]);

  // Auto-send wizard prompt when received from BacktestWizard
  useEffect(() => {
    if (wizardPrompt && !isLoading) {
      sendMessage(wizardPrompt);
      onWizardPromptConsumed && onWizardPromptConsumed();
    }
  }, [wizardPrompt]);

  const cyclePanel = () => setPanelState(prev => prev === 'full' ? 'half' : prev === 'half' ? 'collapsed' : 'full');
  const expandPanel = () => setPanelState('full');

  const handleSend = () => {
    if (!input.trim() && !selectedPreset) return;
    const msg = selectedPreset || input.trim();
    sendMessage(msg);
    setInput('');
    setSelectedPreset('');
  };

  const handleQuickBuild = () => {
    if (!selectedPreset) return;
    sendMessage(selectedPreset);
    setSelectedPreset('');
  };

  const handleSpeak = async () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (!lastAssistant) return;
    setIsSpeaking(true);
    try {
      const res = await fetch('/api/sophia-speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lastAssistant.content.slice(0, 500) }),
      });
      const data = await res.json();
      if (data.audio_url) {
        const audio = new Audio(data.audio_url);
        audio.play();
        audio.onended = () => setIsSpeaking(false);
      } else { setIsSpeaking(false); }
    } catch { setIsSpeaking(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const renderContent = (content) => {
    const parts = [];
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let last = 0, match;
    while ((match = codeRegex.exec(content)) !== null) {
      if (match.index > last) parts.push({ type: 'text', content: content.slice(last, match.index) });
      parts.push({ type: 'code', content: match[2].trim() });
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push({ type: 'text', content: content.slice(last) });
    if (!parts.length) parts.push({ type: 'text', content });

    return parts.map((p, i) => {
      if (p.type === 'code') {
        return (
          <pre key={i} className="my-2 p-3 bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg text-xs text-gray-300 font-mono overflow-x-auto">
            {p.content}
          </pre>
        );
      }
      // Basic markdown rendering
      const lines = p.content.split('\n');
      return (
        <div key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
          {lines.map((line, li) => {
            if (line.startsWith('## ')) return <h3 key={li} className="text-emerald-400 font-bold mt-2 mb-1 text-sm">{line.slice(3)}</h3>;
            if (line.startsWith('- **')) {
              const boldEnd = line.indexOf('**', 4);
              if (boldEnd > 0) {
                return <div key={li} className="ml-2"><span className="text-white font-semibold">{line.slice(4, boldEnd)}</span><span className="text-gray-300">{line.slice(boldEnd + 2)}</span></div>;
              }
            }
            if (line.startsWith('---')) return <hr key={li} className="border-[#1f1f1f] my-2" />;
            return <div key={li}>{line.replace(/\*\*(.+?)\*\*/g, (_, t) => t)}</div>;
          })}
        </div>
      );
    });
  };

  if (panelState === 'collapsed') {
    return (
      <div style={{ width: PANEL_WIDTHS.collapsed }} className="h-full bg-[#0b0b0b] border-l border-[#1f1f1f] flex flex-col items-center py-2">
        <button onClick={expandPanel} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Expand Sophia">
          <ChevronsLeft className="w-4 h-4 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" />
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: PANEL_WIDTHS[panelState] }} className="h-full bg-[#0b0b0b] border-l border-[#1f1f1f] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-semibold text-sm">Sophia</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} className="p-1 text-gray-500 hover:text-white transition-colors" title="Clear chat">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={cyclePanel} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Resize">
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Build - only in full mode */}
      {panelState === 'full' && (
        <div className="px-3 py-2 border-b border-[#1f1f1f] flex gap-2">
          <button
            onClick={() => onOpenWizard && onOpenWizard()}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/[0.08] hover:border-emerald-500/40 transition-all"
          >
            <Rocket className="w-3.5 h-3.5" />
            Build Strategy
          </button>
          <select
            value={selectedPreset}
            onChange={(e) => { setSelectedPreset(e.target.value); if (e.target.value) sendMessage(e.target.value); setSelectedPreset(''); }}
            className="flex-1 bg-[#111] border border-[#1f1f1f] rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Quick preset...</option>
            {STRATEGY_PRESETS.map((p, i) => (
              <option key={i} value={p.prompt}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Brain className="w-10 h-10 text-emerald-400/30 mb-3" />
            <p className="text-gray-500 text-sm">Ask Sophia to build a trading strategy, analyze a stock, or run a backtest.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              {msg.role === 'assistant' && (
                <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5 block">Sophia</span>
              )}
              <div className={`text-sm ${msg.role === 'user' ? 'text-gray-300' : 'text-gray-200'}`}>
                {msg.role === 'assistant' && msg.content === '' && isLoading ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">Sophia is thinking...</span>
                  </div>
                ) : msg.role === 'assistant' ? (
                  renderContent(msg.content)
                ) : (
                  <span className="text-gray-400">{msg.content}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-3 py-2 border-t border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Sophia anything..."
            rows={1}
            className="flex-1 bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <button
            onClick={handleSpeak}
            disabled={isSpeaking || messages.length === 0}
            className="p-2 text-gray-500 hover:text-emerald-400 disabled:text-gray-700 transition-colors"
            title="Speak last response"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedPreset)}
            className="p-2 text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SophiaPanel;
