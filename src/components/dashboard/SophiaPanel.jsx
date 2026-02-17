import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Volume2,
  Trash2,
  Brain,
  Rocket,
  ChevronsRight,
  ChevronsLeft,
  Bookmark,
} from 'lucide-react';
import { useSophiaChat } from '../../hooks/useSophiaChat';
import BacktestWizard from './BacktestWizard';
import { tokenizeTickerText } from '../../lib/tickerStyling';
import { saveWarRoomIntel } from '../../lib/warRoomIntel';

const STRATEGY_PRESETS = [
  {
    label: 'Growth Investing',
    prompt:
      'Ticker: $AAPL | Chart: Daily candles | Timeframe: 12M lookback | Logic: Buy when price crosses above 50-day SMA with increasing revenue growth. Sell when price drops below 200-day SMA. | Backtest amount: $10,000',
  },
  {
    label: 'Momentum Trading',
    prompt:
      'Ticker: $TSLA | Chart: 1hr candles | Timeframe: 6M lookback | Logic: Buy when MACD crosses above signal line with RSI above 50. Sell when momentum fades below 20-day EMA. | Backtest amount: $10,000',
  },
  {
    label: 'Day Trading',
    prompt:
      'Ticker: $SPY | Chart: 5min candles | Timeframe: 1M lookback | Logic: Buy on VWAP bounce with volume spike >2x average. Sell at +0.5% or stop at -0.25%. | Backtest amount: $25,000',
  },
  {
    label: 'RSI Bounce',
    prompt:
      'Ticker: $NVDA | Chart: 15min candles | Timeframe: 3M lookback | Logic: Buy when RSI(14) drops below 30 (oversold). Sell when RSI(14) rises above 55. | Backtest amount: $5,000',
  },
  {
    label: 'MACD Crossover',
    prompt:
      'Ticker: $QQQ | Chart: 1hr candles | Timeframe: 6M lookback | Logic: Buy when MACD line crosses above signal line with histogram turning positive. Sell on bearish crossover. | Backtest amount: $10,000',
  },
  {
    label: 'Bollinger Squeeze',
    prompt:
      'Ticker: $AMZN | Chart: 30min candles | Timeframe: 3M lookback | Logic: Buy when price touches lower Bollinger Band with narrowing bandwidth. Sell at upper band or middle band breakdown. | Backtest amount: $10,000',
  },
];

const PANEL_WIDTHS = { full: 480, half: 280, collapsed: 40 };

const renderTickerText = (text, keyPrefix = 'ticker') =>
  tokenizeTickerText(text).map((token, index) =>
    token.type === 'ticker' ? (
      <span key={`${keyPrefix}-${index}`} className="text-emerald-400 font-semibold">
        {token.value}
      </span>
    ) : (
      <React.Fragment key={`${keyPrefix}-${index}`}>{token.value}</React.Fragment>
    )
  );

const normalizeCitationLinks = (citations) => {
  if (!Array.isArray(citations)) return [];

  return citations
    .map((citation, index) => {
      if (typeof citation === 'string') {
        const url = citation.trim();
        if (!/^https?:\/\//i.test(url)) return null;
        return { url, title: `Source ${index + 1}` };
      }

      if (!citation || typeof citation !== 'object') return null;
      const url = String(citation.url || citation.href || citation.link || '').trim();
      if (!/^https?:\/\//i.test(url)) return null;
      const title = String(citation.title || citation.name || `Source ${index + 1}`).trim();
      return { url, title: title || `Source ${index + 1}` };
    })
    .filter(Boolean);
};

const clip = (value, length = 72) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
};

const buildWarRoomTitle = (message) => {
  const query = clip(message?.query || '', 80);
  if (query) return query;

  const body = String(message?.content || '')
    .replace(/^📡\s*War Room Intel:\s*/i, '')
    .trim();

  const firstLine = clip(body.split('\n').find((line) => line.trim()) || '', 80);
  return firstLine || 'War Room Intel';
};

const SophiaPanel = ({
  onStrategyGenerated,
  onCollapsedChange,
  onOpenWizard,
  wizardPrompt,
  onWizardPromptConsumed,
}) => {
  const {
    messages,
    sendMessage,
    isLoading,
    currentStrategy,
    clearChat,
    markMessageSavedToWarRoom,
  } = useSophiaChat();

  const [input, setInput] = useState('');
  const [presetValue, setPresetValue] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [panelState, setPanelState] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-sophia-panel-state');
      return saved && ['full', 'half', 'collapsed'].includes(saved) ? saved : 'full';
    } catch {
      return 'full';
    }
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('stratify-sophia-panel-state', panelState);
    } catch {}
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

  useEffect(() => {
    if (wizardPrompt && !isLoading) {
      sendMessage(wizardPrompt);
      onWizardPromptConsumed && onWizardPromptConsumed();
    }
  }, [wizardPrompt]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const cyclePanel = () =>
    setPanelState((prev) => (prev === 'full' ? 'half' : prev === 'half' ? 'collapsed' : 'full'));
  const expandPanel = () => setPanelState('full');

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
    setPresetValue('');
  };

  const handleSaveToWarRoom = (message) => {
    if (!message?.id) return;
    if (message.savedToWarRoom) return;

    const body = String(message.content || '').replace(/^📡\s*War Room Intel:\s*/i, '').trim();
    if (!body) return;

    const links = normalizeCitationLinks(message.citations || []);

    saveWarRoomIntel({
      id: String(message.id),
      title: buildWarRoomTitle(message),
      query: String(message.query || '').trim(),
      content: body,
      sources: links,
      sourceLabel: 'Claude Intel',
      createdAt: new Date().toISOString(),
    });

    markMessageSavedToWarRoom(message.id);
  };

  const handleSpeak = async () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.content);
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
      } else {
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const renderContent = (content) => {
    const parts = [];
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let last = 0;
    let match;

    while ((match = codeRegex.exec(content)) !== null) {
      if (match.index > last) parts.push({ type: 'text', content: content.slice(last, match.index) });
      parts.push({ type: 'code', content: match[2].trim() });
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push({ type: 'text', content: content.slice(last) });
    if (!parts.length) parts.push({ type: 'text', content });

    return parts.map((part, index) => {
      if (part.type === 'code') {
        return (
          <pre
            key={index}
            className="my-2 p-3 bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg text-xs text-gray-300 font-mono overflow-x-auto"
          >
            {part.content}
          </pre>
        );
      }

      const lines = part.content.split('\n');
      return (
        <div key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
          {lines.map((line, lineIndex) => {
            if (line.startsWith('## ')) {
              return (
                <h3 key={lineIndex} className="text-emerald-400 font-bold mt-2 mb-1 text-sm">
                  {renderTickerText(line.slice(3), `assistant-heading-${index}-${lineIndex}`)}
                </h3>
              );
            }

            if (line.startsWith('- **')) {
              const boldEnd = line.indexOf('**', 4);
              if (boldEnd > 0) {
                return (
                  <div key={lineIndex} className="ml-2">
                    <span className="text-white font-semibold">
                      {renderTickerText(line.slice(4, boldEnd), `assistant-bullet-label-${index}-${lineIndex}`)}
                    </span>
                    <span className="text-gray-300">
                      {renderTickerText(
                        line.slice(boldEnd + 2),
                        `assistant-bullet-value-${index}-${lineIndex}`
                      )}
                    </span>
                  </div>
                );
              }
            }

            if (line.startsWith('---')) {
              return <hr key={lineIndex} className="border-[#1f1f1f] my-2" />;
            }

            return (
              <div key={lineIndex}>
                {renderTickerText(
                  line.replace(/\*\*(.+?)\*\*/g, (_, text) => text),
                  `assistant-line-${index}-${lineIndex}`
                )}
              </div>
            );
          })}
        </div>
      );
    });
  };

  if (panelState === 'collapsed') {
    return (
      <div
        style={{ width: PANEL_WIDTHS.collapsed }}
        className="h-full bg-[#0b0b0b] border-l border-[#1f1f1f] flex flex-col items-center py-2"
      >
        <button
          onClick={expandPanel}
          className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
          title="Expand Sophia"
        >
          <ChevronsLeft className="w-4 h-4 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ width: PANEL_WIDTHS[panelState] }}
      className="h-full bg-[#0b0b0b] border-l border-[#1f1f1f] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-semibold text-sm">Sophia</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-1 text-gray-500 hover:text-white transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={cyclePanel}
            className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
            title="Resize"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {panelState === 'full' && (
        <div className="px-3 py-2 border-b border-[#1f1f1f] flex gap-2">
          <button
            onClick={() => setShowBuilder(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/[0.08] hover:border-emerald-500/40 transition-all"
          >
            <Rocket className="w-3.5 h-3.5" />
            Build Strategy
          </button>
          <select
            value={presetValue}
            onChange={(event) => {
              if (event.target.value) {
                setInput(event.target.value);
                inputRef.current?.focus();
              }
              setPresetValue('');
            }}
            className="flex-1 bg-[#111] border border-[#1f1f1f] rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Quick preset...</option>
            {STRATEGY_PRESETS.map((preset, index) => (
              <option key={index} value={preset.prompt}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showBuilder ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <BacktestWizard
            onSubmit={(prompt) => {
              setShowBuilder(false);
              sendMessage(prompt);
            }}
            onClose={() => setShowBuilder(false)}
            inline
          />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Brain className="w-10 h-10 text-emerald-400/30 mb-3" />
                <p className="text-gray-500 text-sm">
                  Ask Sophia to build a trading strategy, analyze a stock, or run a backtest.
                </p>
              </div>
            )}

            {messages.map((msg, index) => {
              const sourceLinks = normalizeCitationLinks(msg.citations);
              const showWarRoomSave =
                msg.role === 'assistant' &&
                msg.isWarRoom &&
                Boolean(String(msg.content || '').trim()) &&
                !/^📡\s*War Room Intel:\s*\n\nError:/i.test(String(msg.content || '').trim());

              return (
                <div key={msg.id || index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.role === 'assistant' && (
                      <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5 block">
                        Sophia
                      </span>
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
                        <span className="text-gray-400">{renderTickerText(msg.content, `user-${index}`)}</span>
                      )}
                    </div>

                    {showWarRoomSave ? (
                      <div className="mt-2 space-y-2">
                        <button
                          type="button"
                          onClick={() => handleSaveToWarRoom(msg)}
                          disabled={Boolean(msg.savedToWarRoom)}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                            msg.savedToWarRoom
                              ? 'border-amber-500/30 bg-amber-500/15 text-amber-300/70'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                          }`}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          {msg.savedToWarRoom ? 'Saved to War Room' : 'Save to War Room'}
                        </button>

                        {sourceLinks.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {sourceLinks.slice(0, 6).map((link, sourceIndex) => (
                              <a
                                key={`${msg.id || index}-source-${sourceIndex}`}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-400/70 hover:text-blue-300 underline decoration-blue-400/30"
                              >
                                {link.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 border-t border-[#1f1f1f]">
            <div className="flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  event.target.style.height = 'auto';
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Sophia anything..."
                rows={1}
                style={{ height: 'auto', overflow: input.length > 100 ? 'auto' : 'hidden' }}
                className="flex-1 bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 resize-none max-h-[200px]"
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
                disabled={isLoading || !input.trim()}
                className="p-2 text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SophiaPanel;
