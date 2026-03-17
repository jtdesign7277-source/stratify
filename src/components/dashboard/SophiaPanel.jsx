import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  Volume2,
  Trash2,
  Rocket,
  ChevronsRight,
  ChevronsLeft,
  Bookmark,
  Zap,
} from 'lucide-react';
import { useSophiaChat } from '../../hooks/useSophiaChat';
import BacktestWizard from './BacktestWizard';
import SophiaMark from './SophiaMark';
import { tokenizeTickerText } from '../../lib/tickerStyling';
import { saveWarRoomIntel } from '../../lib/warRoomIntel';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useTwelveDataWS } from '../xray/hooks/useTwelveDataWS';

// Live portfolio card — renders positions with real-time WS prices
function PortfolioCard({ data }) {
  const { prices: livePrices, subscribe, unsubscribe } = useTwelveDataWS();

  React.useEffect(() => {
    if (!data?.positions) return;
    data.positions.forEach(p => subscribe(p.symbol));
    return () => data.positions.forEach(p => unsubscribe(p.symbol));
  }, [data?.positions?.map(p => p.symbol).join(',')]);

  if (!data) return null;
  const { cash, totalValue, totalPnl, totalPnlPct, positions } = data;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] font-mono font-bold tracking-widest text-gray-400 uppercase">Portfolio</span>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-gray-500">${totalValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-[10px] ml-1 opacity-70">({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct?.toFixed(2)}%)</span>
          </span>
        </div>
      </div>

      {/* Positions */}
      {positions?.length > 0 ? positions.map(pos => {
        const livePrice = livePrices[pos.symbol.toUpperCase()]?.price || pos.current_price;
        const liveValue = pos.qty * livePrice;
        const livePnl = liveValue - (pos.qty * pos.avg_cost);
        const livePnlPct = pos.avg_cost > 0 ? (livePnl / (pos.qty * pos.avg_cost)) * 100 : 0;
        const isWin = livePnl >= 0;
        const ticker = pos.symbol.replace('/USD', '').replace('USD', '');
        return (
          <div key={pos.symbol} className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.05] last:border-0">
            <div className="flex flex-col">
              <span className="text-white font-mono font-semibold text-sm">${ticker}</span>
              <span className="text-gray-500 text-[10px] font-mono">{pos.qty} {pos.qty < 1 ? 'units' : 'shares'} · avg ${pos.avg_cost?.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-white font-mono font-semibold text-sm">${liveValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`text-[11px] font-mono ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                {livePnl >= 0 ? '+' : ''}${Math.abs(livePnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({livePnlPct >= 0 ? '+' : ''}{livePnlPct?.toFixed(2)}%)
              </span>
            </div>
          </div>
        );
      }) : (
        <div className="px-3 py-3 text-[11px] text-gray-600 font-mono">No open positions</div>
      )}

      {/* Cash row */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-t border-white/[0.06]">
        <span className="text-gray-500 text-[11px] font-mono">Cash</span>
        <span className="text-gray-300 font-mono text-[11px]">${cash?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}

function SentinelCard({ data }) {
  if (!data) return null;
  const { balance, totalPnl, winRate, totalTrades, openTrades, todaySession } = data;
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-white/[0.01] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/10">
        <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-500 uppercase">Sentinel Bot</span>
        <span className={`text-[11px] font-mono ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} all-time
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
        {[
          { label: 'Balance', value: `$${(balance/1000000).toFixed(2)}M` },
          { label: 'Win Rate', value: `${winRate?.toFixed(1)}%` },
          { label: 'Trades', value: totalTrades },
        ].map(s => (
          <div key={s.label} className="px-3 py-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</div>
            <div className="text-white font-mono text-sm font-semibold mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>
      {openTrades?.length > 0 && (
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Open Now</div>
          {openTrades.slice(0, 3).map(t => (
            <div key={t.id} className="flex items-center justify-between py-1">
              <span className="text-white font-mono text-[11px]">{t.direction} ${t.symbol?.replace('/USD','')}</span>
              <span className="text-gray-400 font-mono text-[11px]">@ ${t.entry?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {todaySession && (
        <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">Today</span>
          <span className={`text-[11px] font-mono ${todaySession.gross_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {todaySession.gross_pnl >= 0 ? '+' : ''}${todaySession.gross_pnl?.toFixed(2)} · {todaySession.trades_fired} trades
          </span>
        </div>
      )}
    </div>
  );
}

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

const PANEL_STATE_STORAGE_KEY = 'stratify-sophia-panel-state';
const STRATEGY_MODE_STORAGE_KEY = 'stratify-sophia-strategy-mode';
const PANEL_WIDTHS = { large: 430, small: 320, closed: 40 };
const PANEL_STATE_CYCLE = { closed: 'small', small: 'closed', large: 'closed' };
const normalizePanelState = (value) => {
  if (['closed', 'small', 'large'].includes(value)) return value;
  if (value === 'collapsed') return 'closed';
  if (value === 'half') return 'small';
  if (value === 'full') return 'large';
  return 'large';
};
const TRUMP_ALERT_POLL_MS = 60000;
const TRUMP_LAST_SEEN_KEY = 'stratify-trump-last-seen';
const ALERT_SEVERITY_TEXT = { '🔴': 'text-red-400', '🟠': 'text-orange-400', '🟡': 'text-yellow-400', '🔵': 'text-blue-400' };
const ALERT_SEVERITY_BORDER = { '🔴': 'border-l-2 border-red-500', '🟠': 'border-l-2 border-orange-500' };

const formatRelativeTime = (ts) => {
  const t = new Date(ts || '').getTime(); if (!Number.isFinite(t)) return 'just now';
  const m = Math.floor(Math.max(0, Date.now() - t) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
};
const extractSourceUrl = (a) => {
  for (const v of [a?.source_url, a?.raw_response, a?.url]) {
    const s = String(v || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    const m = s.match(/https?:\/\/[^\s)]+/i);
    if (m?.[0]) return m[0];
  }
  return '';
};

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
  onLoadingChange,
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
  const [activeTab, setActiveTab] = useState('sophia');
  const [trumpAlerts, setTrumpAlerts] = useState([]);
  const [trumpLoading, setTrumpLoading] = useState(true);
  const [trumpError, setTrumpError] = useState('');
  const [lastSeenCount, setLastSeenCount] = useState(() => {
    try { return Math.max(0, parseInt(localStorage.getItem(TRUMP_LAST_SEEN_KEY) || '0', 10) || 0); } catch { return 0; }
  });
  const [panelState, setPanelState] = useState(() => {
    try {
      const saved = localStorage.getItem(PANEL_STATE_STORAGE_KEY);
      return normalizePanelState(saved);
    } catch {
      return 'large';
    }
  });
  const [strategyMode, setStrategyMode] = useState(() => {
    try {
      return localStorage.getItem(STRATEGY_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Trading Mode + YOLO state
  const { user, session } = useAuth();
  const [tradingMode, setTradingMode] = useState(false);
  const [yoloActive, setYoloActive] = useState(false);
  const [yoloLoading, setYoloLoading] = useState(false);
  const [sentinelMode, setSentinelMode] = useState(false);
  const [tradeInput, setTradeInput] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);
  const [tradeMessages, setTradeMessages] = useState([
    { role: 'assistant', content: '⚡ Trading Mode active. I can see your real portfolio, P&L, and positions. Enable Sentinel toggle to also ask about the trading bot.' }
  ]);

  // Load YOLO state from Supabase on mount
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('sentinel_user_settings').select('yolo_active').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setYoloActive(data.yolo_active || false); })
      .catch(() => {});
  }, [user?.id]);

  const toggleYolo = useCallback(async () => {
    if (!user?.id || yoloLoading) return;
    setYoloLoading(true);
    const next = !yoloActive;
    try {
      await supabase.from('sentinel_user_settings').upsert({
        user_id: user.id, yolo_active: next, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      setYoloActive(next);
    } catch {}
    setYoloLoading(false);
  }, [user?.id, yoloActive, yoloLoading]);

  const sendTradeMessage = useCallback(async (text) => {
    if (!text.trim() || tradeLoading) return;
    const userMsg = { role: 'user', content: text.trim() };
    setTradeMessages(prev => [...prev, userMsg]);
    setTradeInput('');
    setTradeLoading(true);
    setTradeResult(null);

    try {
      // Use token from auth context — no async call needed
      const token = session?.access_token;

      if (!token) {
        setTradeMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Please sign in to use Trading Mode.' }]);
        setTradeLoading(false);
        return;
      }

      const resp = await fetch('/api/sophia-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text.trim(), includeSentinel: sentinelMode }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        setTradeMessages(prev => [...prev, { role: 'assistant', content: `❌ ${errData.error || `Server error ${resp.status}`}` }]);
        setTradeLoading(false);
        return;
      }

      const data = await resp.json();

      if (data.action === 'portfolio') {
        setTradeMessages(prev => [...prev, { role: 'assistant', type: 'portfolio', data: data.portfolio, content: '' }]);
      } else if (data.action === 'sentinel') {
        setTradeMessages(prev => [...prev, { role: 'assistant', type: 'sentinel', data: data.sentinel, content: '' }]);
      } else {
        const reply = data.reply || data.error || 'Done.';
        setTradeMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      }
      if (data.order) setTradeResult(data.order);
    } catch (err) {
      setTradeMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    }
    setTradeLoading(false);
  }, [tradeLoading, session, sentinelMode]);

  const messagesEndRef = useRef(null);
  const tradeMessagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const unreadTrumpAlerts = Math.max(0, trumpAlerts.length - lastSeenCount);
  const hasUnreadTrumpAlerts = unreadTrumpAlerts > 0;
  const updateTrumpLastSeen = useCallback((c) => { const n = Math.max(0, c || 0); setLastSeenCount(n); try { localStorage.setItem(TRUMP_LAST_SEEN_KEY, String(n)); } catch {} }, []);
  const fetchTrumpAlerts = useCallback(async () => {
    try { const r = await fetch('/api/trump-alerts'); const d = await r.json(); setTrumpAlerts(Array.isArray(d?.alerts) ? d.alerts : []); setTrumpError(''); }
    catch { setTrumpError('Failed to load.'); } finally { setTrumpLoading(false); }
  }, []);
  const handleTabSelect = (tab) => { setActiveTab(tab); if (tab === 'trump') updateTrumpLastSeen(trumpAlerts.length); };

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_STATE_STORAGE_KEY, panelState);
    } catch {}
  }, [panelState]);

  useEffect(() => {
    tradeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tradeMessages]);

  useEffect(() => {
    try {
      localStorage.setItem(STRATEGY_MODE_STORAGE_KEY, strategyMode ? 'true' : 'false');
    } catch {}
  }, [strategyMode]);

  useEffect(() => {
    onCollapsedChange && onCollapsedChange(panelState === 'closed', panelState);
  }, [panelState, onCollapsedChange]);

  useEffect(() => { fetchTrumpAlerts(); const id = setInterval(fetchTrumpAlerts, TRUMP_ALERT_POLL_MS); return () => clearInterval(id); }, [fetchTrumpAlerts]);
  useEffect(() => { if (activeTab === 'trump' && trumpAlerts.length > lastSeenCount) updateTrumpLastSeen(trumpAlerts.length); }, [activeTab, trumpAlerts.length, lastSeenCount, updateTrumpLastSeen]);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

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
      // Expand the panel and switch to sophia tab so the user sees the response
      setPanelState((prev) => (prev === 'closed' ? 'small' : prev));
      setActiveTab('sophia');
      sendMessage(wizardPrompt, { strategyMode: true });
      onWizardPromptConsumed && onWizardPromptConsumed();
    }
  }, [wizardPrompt]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const cyclePanel = () => setPanelState((prev) => PANEL_STATE_CYCLE[prev] || 'closed');

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim(), { strategyMode });
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

  // Same background as main dashboard (linear-canvas) so panel feels like one page
  const panelStyle = {
    background: '#111111',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
  };

  if (panelState === 'closed') {
    return (
      <div
        style={{ width: PANEL_WIDTHS.closed, ...panelStyle }}
        className="h-full flex flex-col items-center pt-10 pb-2"
      >
        <button
          onClick={cyclePanel}
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
      style={{ width: PANEL_WIDTHS[panelState], ...panelStyle }}
      className="h-full flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between pl-4 pr-3 py-2 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <SophiaMark className="w-4 h-4" />
          <span className="text-white font-semibold text-sm">Sophia</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
        </div>
        <div className="flex items-center gap-2">
          {/* YOLO toggle */}
          <button
            onClick={toggleYolo}
            disabled={yoloLoading || !user?.id}
            title={yoloActive ? 'YOLO ON — copying Sentinel trades to your account' : 'YOLO OFF — enable to copy Sentinel trades'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider transition-all duration-200 border ${
              yoloActive
                ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : 'bg-white/[0.04] text-zinc-500 border-white/[0.08] hover:text-zinc-300'
            }`}
          >
            {yoloLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
            YOLO
          </button>
          {/* Trading Mode toggle */}
          <button
            onClick={() => { setTradingMode(v => !v); if (!tradingMode) setActiveTab('trade'); else setActiveTab('sophia'); }}
            title={tradingMode ? 'Trading Mode ON — click to disable' : 'Enable Trading Mode'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider transition-all duration-200 border ${
              tradingMode
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'bg-white/[0.04] text-zinc-500 border-white/[0.08] hover:text-zinc-300'
            }`}
          >
            ⚡ Trade
          </button>
          <button onClick={clearChat} className="p-1 text-gray-500 hover:text-white transition-colors" title="Clear chat">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={cyclePanel} className="p-1 text-emerald-300/70 hover:text-emerald-300 transition-colors" title="Resize">
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Strategy checkbox row — no tabs */}
      <div className="flex items-center justify-end gap-2 pl-4 pr-6 py-1.5 border-b border-[#1f1f1f]">
        {activeTab === 'sophia' && (
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <input
              type="checkbox"
              checked={strategyMode}
              onChange={(event) => setStrategyMode(event.target.checked)}
              className="h-3.5 w-3.5 rounded border border-zinc-600 bg-[#0b0b0b] accent-emerald-400"
            />
            Strategy
          </label>
        )}
      </div>

      {/* Trump Intel Feed */}
      {activeTab === 'trump' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {trumpLoading && <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>}
          {!trumpLoading && trumpError && <p className="text-xs text-red-400 text-center py-4">{trumpError}</p>}
          {!trumpLoading && !trumpError && trumpAlerts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">🇺🇸 No intel yet</p>
              <p className="text-zinc-600 text-xs mt-1">Scans at 7am, 10am, 2pm, 6pm ET</p>
            </div>
          )}
          {!trumpLoading && trumpAlerts.map((alert) => {
            const sev = alert.severity || '🔵';
            const url = extractSourceUrl(alert);
            return (
              <div key={alert.id} className={`rounded-lg border border-white/10 bg-black/30 p-3 ${ALERT_SEVERITY_BORDER[sev] || ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-sm shrink-0 mt-0.5">{sev}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100 leading-tight">{alert.title}</p>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{alert.message}</p>
                      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-[10px] text-zinc-600 hover:text-zinc-400 truncate max-w-full">{(() => { try { return new URL(url).hostname; } catch { return 'source'; } })()}</a>}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600 whitespace-nowrap shrink-0">{formatRelativeTime(alert.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ⚡ TRADING MODE PANEL */}
      {activeTab === 'trade' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Status bar — YOLO + Sentinel toggle */}
          <div className="px-4 py-2 flex items-center justify-between border-b border-[#1f1f1f]">
            <div className={`text-[10px] font-mono flex items-center gap-1.5 ${yoloActive ? 'text-red-400' : 'text-zinc-600'}`}>
              <Zap className="w-3 h-3" />
              {yoloActive ? 'YOLO ON — copying trades' : 'YOLO OFF'}
            </div>
            <button
              onClick={() => setSentinelMode(v => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider transition-all duration-200 border ${
                sentinelMode
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-white/[0.03] text-zinc-600 border-white/[0.08] hover:text-zinc-400'
              }`}
              title={sentinelMode ? 'Sentinel context ON — Sophia knows bot status' : 'Enable to ask about Sentinel bot'}
            >
              🤖 Sentinel
            </button>
          </div>

          {/* Trade conversation */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tradeMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed bg-amber-500/20 text-amber-100 border border-amber-500/20">
                    {msg.content}
                  </div>
                ) : msg.type === 'portfolio' ? (
                  <div className="w-full"><PortfolioCard data={msg.data} /></div>
                ) : msg.type === 'sentinel' ? (
                  <div className="w-full"><SentinelCard data={msg.data} /></div>
                ) : msg.content ? (
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed bg-white/[0.05] text-zinc-200 border border-white/[0.06]">
                    {msg.content}
                  </div>
                ) : null}
              </div>
            ))}
            {tradeLoading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.05] border border-white/[0.06] rounded-2xl px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                </div>
              </div>
            )}
            {tradeResult && (
              <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl p-3 text-xs font-mono">
                <div className="text-emerald-400 font-bold mb-1">✓ Order Executed</div>
                <div className="text-zinc-300">{tradeResult.side?.toUpperCase()} {tradeResult.qty} {tradeResult.symbol} @ ${tradeResult.price?.toFixed(2)}</div>
              </div>
            )}
            <div ref={tradeMessagesEndRef} />
          </div>

          {/* Quick commands */}
          <div className="px-3 pb-1 flex gap-1 flex-wrap">
            {[
              'What\'s my P&L?',
              'Show my positions',
              'What am I holding?',
              ...(sentinelMode ? ['Sentinel P&L', 'Sentinel open trades'] : [])
            ].map(cmd => (
              <button key={cmd} onClick={() => sendTradeMessage(cmd)}
                className="px-2 py-0.5 rounded-full text-[10px] text-zinc-500 border border-white/[0.06] hover:text-amber-400 hover:border-amber-500/30 transition-all">
                {cmd}
              </button>
            ))}
          </div>

          {/* Trade input */}
          <div className="px-3 pb-3 pt-1">
            <div className="flex items-center gap-2 bg-black/40 rounded-xl border border-white/[0.06] px-3 py-2">
              <input
                value={tradeInput}
                onChange={e => setTradeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTradeMessage(tradeInput); } }}
                placeholder="Try: buy 10 AAPL, sell TSLA, show portfolio"
                className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-600 outline-none"
              />
              <button onClick={() => sendTradeMessage(tradeInput)} disabled={tradeLoading || !tradeInput.trim()}
                className="text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sophia' && panelState === 'large' && (
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

      {activeTab === 'sophia' && showBuilder ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <BacktestWizard
            onSubmit={(prompt) => {
              setShowBuilder(false);
              sendMessage(prompt, { strategyMode: true });
            }}
            onClose={() => setShowBuilder(false)}
            inline
          />
        </div>
      ) : activeTab === 'sophia' ? (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
            {strategyMode && (
              <div className="sticky top-0 z-10 -mt-1 pb-1">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Strategy Mode On
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <SophiaMark className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-gray-500 text-sm">
                  Ask Sophia any market question. Enable Strategy checkbox for structured strategy responses.
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
              const isUser = msg.role === 'user';

              return (
                <div key={msg.id || index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`w-full rounded-[18px] px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.25)] ${
                        isUser
                          ? 'bg-[#0a84ff] border border-[#5cb3ff]/40 text-white rounded-br-md'
                          : 'bg-[#1c1c1f]/95 border border-white/10 text-gray-100 rounded-bl-md'
                      }`}
                    >
                      <div className="text-sm">
                        {!isUser && msg.content === '' && isLoading ? (
                          <div className="flex items-center gap-2 text-gray-300">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-xs">Sophia is thinking...</span>
                          </div>
                        ) : !isUser ? (
                          renderContent(msg.content)
                        ) : (
                          <span className="text-white">{renderTickerText(msg.content, `user-${index}`)}</span>
                        )}
                      </div>
                    </div>

                    {showWarRoomSave ? (
                      <div className="mt-2 w-full space-y-2">
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
      ) : null}
    </div>
  );
};

export default SophiaPanel;
