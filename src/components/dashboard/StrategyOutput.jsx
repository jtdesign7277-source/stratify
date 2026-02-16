import React, { useState, useEffect, useMemo } from 'react';
import { ChevronsLeft, Check, Target, AlertTriangle, Play, TrendingUp, BarChart3, Zap, Shield, DollarSign, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const CHECKLIST_ITEMS = [
  { id: 'entry-signal', label: 'Entry Signal Confirmed', icon: TrendingUp },
  { id: 'volume-check', label: 'Volume Above Average', icon: BarChart3 },
  { id: 'trend-alignment', label: 'Trend Alignment', icon: Zap },
  { id: 'risk-reward', label: 'Risk/Reward ≥ 2:1', icon: Target },
  { id: 'stop-loss-set', label: 'Stop Loss Defined', icon: Shield },
  { id: 'position-sized', label: 'Position Size OK', icon: DollarSign },
];

const FIELD_LABELS = ['Entry Signal', 'Volume', 'Trend', 'Risk/Reward', 'Stop Loss', '$ Allocation'];
const FIELD_KEYS = ['entry', 'volume', 'trend', 'riskReward', 'stopLoss', 'allocation'];
const SAVED_STRATEGIES_FALLBACK_KEY = 'stratify-saved-strategies-fallback';

const formatTickerWithDollar = (ticker) => {
  const clean = String(ticker || '').trim().replace(/^\$/, '').toUpperCase();
  return clean ? `$${clean}` : '';
};

function extractPerformanceData(strategy = {}) {
  const raw = String(strategy.raw || '');
  const findMetric = (pattern) => raw.match(pattern)?.[1]?.trim() || '';

  return {
    backtestValue: strategy.value || '',
    totalReturn: findMetric(/(?:total\s+return|return|roi)\s*[:\-]\s*([^\n]+)/i),
    netProfit: findMetric(/(?:net\s+profit|profit|p\/l)\s*[:\-]\s*([^\n]+)/i),
    winRate: findMetric(/(?:win\s+rate)\s*[:\-]\s*([^\n]+)/i),
  };
}

function parseMarkdown(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  return lines
    .map((line) => {
      // Horizontal rules
      if (/^[-*_]{3,}$/.test(line.trim())) {
        return '<hr class="border-[#1f1f1f] my-4" />';
      }
      // H2
      if (line.startsWith('## ')) {
        return `<h2 class="text-emerald-400 text-lg font-bold mt-6 mb-2">${line.slice(3)}</h2>`;
      }
      // H3
      if (line.startsWith('### ')) {
        return `<h3 class="text-emerald-400 text-base font-semibold mt-4 mb-1">${line.slice(4)}</h3>`;
      }
      // Code blocks (simple single-line)
      if (line.startsWith('```')) return '';
      // Bullet points
      if (/^\s*[-*]\s/.test(line)) {
        const content = line.replace(/^\s*[-*]\s/, '');
        return `<div class="flex gap-2 ml-2 my-0.5"><span class="text-zinc-500">•</span><span>${formatInline(content)}</span></div>`;
      }
      // Color coding
      let extraClass = '';
      const lower = line.toLowerCase();
      if (lower.includes('profit') || /\+\d/.test(line)) extraClass = ' text-emerald-400';
      else if (lower.includes('loss') || /(?<!\w)-\d/.test(line)) extraClass = ' text-red-400';
      // Empty line
      if (!line.trim()) return '<div class="h-2"></div>';
      return `<p class="my-0.5${extraClass}">${formatInline(line)}</p>`;
    })
    .join('');
}

function formatInline(text) {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-emerald-300 text-sm">$1</code>');
  return text;
}

export default function StrategyOutput({ strategy, onSave, onDeploy, onBack, onRetest }) {
  const s = strategy || {};
  const storageKey = `stratify-activation-${s.id || s.generatedAt || s.name || 'default'}`;
  const defaultFieldValues = useMemo(
    () => FIELD_KEYS.map((key) => (s?.[key] != null ? String(s[key]) : '')),
    [s.entry, s.volume, s.trend, s.riskReward, s.stopLoss, s.allocation],
  );

  // Key Trade Setups checkboxes
  const [checks, setChecks] = useState(Array(6).fill(false));
  const [fieldValues, setFieldValues] = useState(defaultFieldValues);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Activation fields
  const [size, setSize] = useState('');
  const [maxDay, setMaxDay] = useState('');
  const [stopPct, setStopPct] = useState('');
  const [takePct, setTakePct] = useState('');
  const [preChecks, setPreChecks] = useState(Array(6).fill(false));
  const [active, setActive] = useState(false);
  const [cardsCollapsed, setCardsCollapsed] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const fallbackChecks = Array(6).fill(false);
    const fallbackPreChecks = Array(6).fill(false);
    let nextFieldValues = defaultFieldValues;
    let nextChecks = fallbackChecks;
    let nextPreChecks = fallbackPreChecks;
    let nextActive = false;
    let nextSaved = false;
    let nextSize = '';
    let nextMaxDay = '';
    let nextStopPct = '';
    let nextTakePct = '';

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored) {
        if (Array.isArray(stored.fieldValues) && stored.fieldValues.length === FIELD_LABELS.length) {
          nextFieldValues = stored.fieldValues;
        } else if (stored.allocation) {
          nextFieldValues = [...defaultFieldValues];
          nextFieldValues[5] = String(stored.allocation);
        }
        if (stored.checks) nextChecks = stored.checks;
        if (stored.preChecks) nextPreChecks = stored.preChecks;
        if (stored.active) nextActive = stored.active;
        if (stored.saved) nextSaved = stored.saved;
        if (stored.size) nextSize = stored.size;
        if (stored.maxDay) nextMaxDay = stored.maxDay;
        if (stored.stopPct) nextStopPct = stored.stopPct;
        if (stored.takePct) nextTakePct = stored.takePct;
      }
    } catch {}

    if (!nextSaved) nextActive = false;

    setFieldValues(nextFieldValues);
    setChecks(nextChecks);
    setPreChecks(nextPreChecks);
    setActive(nextActive);
    setSaved(nextSaved);
    setSaveStatus(nextSaved ? 'saved' : 'idle');
    setSize(nextSize);
    setMaxDay(nextMaxDay);
    setStopPct(nextStopPct);
    setTakePct(nextTakePct);
    setEditing(null);
    setEditValue('');
  }, [storageKey, defaultFieldValues]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({
      checks,
      fieldValues,
      allocation: fieldValues[5],
      size,
      maxDay,
      stopPct,
      takePct,
      preChecks,
      active,
      saved,
    }));
  }, [checks, fieldValues, size, maxDay, stopPct, takePct, preChecks, active, saved, storageKey]);

  const allChecked = checks.every(Boolean);
  const allPreChecked = preChecks.every(Boolean);
  const checkedCount = checks.filter(Boolean).length;
  const activationLocked = !saved;
  const canActivate = saved && allPreChecked;

  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const toggleCheck = (i) => setChecks((p) => p.map((v, j) => (j === i ? !v : v)));
  const togglePre = (i) => setPreChecks((p) => p.map((v, j) => (j === i ? !v : v)));

  const startEdit = (i, val) => {
    setEditing(i);
    setEditValue(val || '');
  };
  const commitEdit = (i) => {
    setFieldValues((prev) => {
      const next = [...prev];
      next[i] = editValue.trim();
      return next;
    });
    setEditing(null);
    setEditValue('');
  };

  const fields = FIELD_LABELS.map((label, i) => ({
    label,
    value: fieldValues[i] || '',
  }));

  const renderedMarkdown = useMemo(() => parseMarkdown(s.raw), [s.raw]);
  const displayTicker = formatTickerWithDollar(s.ticker) || '—';
  const saveButtonLabel = saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save';

  const handleActivate = () => {
    if (!canActivate) return;
    setActive(true);
    onDeploy?.({
      symbol: s.ticker,
      size,
      maxDay,
      stopPct,
      takePct,
      status: 'active',
      runStatus: 'running',
    });
  };

  const handleSave = async () => {
    if (!allChecked) return;

    setSaveStatus('saving');
    const payload = {
      ...s,
      entry: fieldValues[0],
      volume: fieldValues[1],
      trend: fieldValues[2],
      riskReward: fieldValues[3],
      stopLoss: fieldValues[4],
      allocation: fieldValues[5],
      keyTradeSetups: {
        entry: fieldValues[0],
        volume: fieldValues[1],
        trend: fieldValues[2],
        riskReward: fieldValues[3],
        stopLoss: fieldValues[4],
        allocation: fieldValues[5],
      },
      checks,
      savedAt: Date.now(),
    };

    const performanceData = extractPerformanceData(s);
    const normalizedTicker = String(s.ticker || '').trim().replace(/^\$/, '').toUpperCase();
    const savedAtIso = new Date(payload.savedAt).toISOString();
    const localRecord = {
      ...payload,
      user_id: null,
      ticker: normalizedTicker,
      date: savedAtIso,
      status: 'saved',
      profit_return_data: performanceData,
      key_trade_setups: payload.keyTradeSetups,
    };

    try {
      const existing = JSON.parse(localStorage.getItem(SAVED_STRATEGIES_FALLBACK_KEY) || '[]');
      const next = Array.isArray(existing) ? existing : [];
      next.unshift(localRecord);
      localStorage.setItem(SAVED_STRATEGIES_FALLBACK_KEY, JSON.stringify(next.slice(0, 100)));
    } catch {}

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        localRecord.user_id = userId;

        const insertRequestedShape = await supabase
          .from('strategies')
          .insert({
            user_id: userId,
            name: payload.name || 'Sophia Strategy',
            ticker: normalizedTicker || null,
            date: savedAtIso,
            entry_signal: payload.entry || '',
            volume: payload.volume || '',
            trend: payload.trend || '',
            risk_reward: payload.riskReward || '',
            stop_loss: payload.stopLoss || '',
            allocation: payload.allocation || '',
            profit_return_data: performanceData,
            status: 'saved',
          });

        if (insertRequestedShape.error) {
          const insertFallback = await supabase
            .from('strategies')
            .insert({
              user_id: userId,
              name: payload.name || 'Sophia Strategy',
              description: payload.raw || null,
              type: 'custom',
              symbols: normalizedTicker ? [normalizedTicker] : [],
              is_active: false,
              rules: {
                date: savedAtIso,
                status: 'saved',
                key_trade_setups: payload.keyTradeSetups,
              },
              backtest_results: performanceData,
            });

          if (insertFallback.error) {
            throw insertFallback.error;
          }
        }
      }
    } catch (error) {
      console.warn('[StrategyOutput] Save to Supabase failed, local fallback kept:', error);
    }

    onSave?.(payload);
    setSaved(true);
    setSaveStatus('saved');
  };

  return (
    <div className="flex h-full text-zinc-300 text-sm overflow-hidden">
      {/* LEFT SIDE */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-zinc-500 hover:text-white transition text-lg">←</button>
            <h1 className="text-white text-xl font-bold">{s.name || 'Strategy'}</h1>
            {s.ticker && (
              <span className="text-xs font-mono px-2 py-0.5 border border-emerald-500/40 text-emerald-400 rounded">
                {displayTicker}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-zinc-500 text-xs">
            <span>{new Date().toLocaleDateString()}</span>
            <button className="hover:text-white transition">✏️</button>
          </div>
        </div>

        {/* Rendered markdown */}
        <div
          className="leading-relaxed text-zinc-300"
          dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
        />
      </div>

      {/* RIGHT SIDE */}
      {cardsCollapsed ? (
        <div className="w-[40px] flex-shrink-0 h-full bg-[#0b0b0b] border-l border-[#1f1f1f] flex flex-col items-center py-3">
          <button onClick={() => setCardsCollapsed(false)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Expand">
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="w-[420px] xl:w-[460px] flex-shrink-0 h-full border-l border-[#1f1f1f] bg-[#060d18] p-4">
          <div className="h-full flex flex-col gap-6">
            {/* Card 1: Key Trade Setups */}
            <div className="bg-[#0a1628] rounded-xl border border-gray-700/50 p-5">
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-xl border border-white/10 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="Fire">🔥</span>
                    <span className="text-white font-bold text-lg">KEY TRADE SETUPS IDENTIFIED</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{checkedCount}/6</span>
                    <button
                      onClick={handleSave}
                      disabled={!allChecked || saveStatus === 'saving'}
                      className={`rounded-lg px-4 py-1 border transition ${
                        saveStatus === 'saved'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-gray-600 text-white hover:bg-white/10'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {saveButtonLabel}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  {fields.map((f, i) => {
                    const isAllocation = i === 5;
                    const isEditing = editing === i;
                    const allocationValue = (f.value || '').replace(/^\s*\$/, '').trim();

                    return (
                      <div key={i} className="bg-black/30 rounded-lg p-4 min-h-[110px] flex items-start gap-3 border border-gray-700/50">
                        <input
                          type="checkbox"
                          checked={checks[i]}
                          onChange={() => toggleCheck(i)}
                          className="h-5 w-5 mt-1 rounded border-2 border-gray-500 bg-transparent accent-emerald-500 cursor-pointer shrink-0"
                          aria-label={`Toggle ${f.label}`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">{f.label}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAllocation) startEdit(i, f.value);
                              }}
                              className="text-gray-500 hover:text-gray-300 transition-colors"
                              aria-label={`Edit ${f.label}`}
                            >
                              <Pencil className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          </div>

                          {isAllocation ? (
                            <input
                              value={allocationValue}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setFieldValues((prev) => {
                                  const next = [...prev];
                                  next[i] = nextValue;
                                  return next;
                                });
                              }}
                              placeholder="Enter amount..."
                              className="mt-1 bg-transparent border border-amber-400/50 rounded px-2 py-1 text-white placeholder-gray-500 w-full focus:outline-none focus:border-amber-300"
                            />
                          ) : isEditing ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(i)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(i);
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              className="mt-1 w-full bg-transparent border border-white/30 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-300"
                            />
                          ) : (
                            <p className="text-white text-sm mt-1 whitespace-normal break-words leading-relaxed">
                              {f.value || '—'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    const params = fields.map((f) => `${f.label}: ${f.value || '—'}`).join('\n');
                    const prompt = `Retest this strategy with updated parameters:\n\nTicker: ${displayTicker === '—' ? '$UNKNOWN' : displayTicker}\nStrategy: ${s.name || 'Strategy'}\n${params}\n\nPlease regenerate the full backtest analysis with these parameters.`;
                    onRetest?.(prompt);
                  }}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <span aria-hidden="true">🔄</span>
                  Ask Sophia to Retest
                </button>
              </div>
            </div>

            {/* Card 2: Strategy Activation */}
            <div
              className="bg-[#0a1628] rounded-xl border border-gray-700/50 p-5 flex flex-col gap-4"
              style={{ opacity: activationLocked ? 0.45 : 1, pointerEvents: activationLocked ? 'none' : 'auto' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md border"
                    style={{
                      background: active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                      borderColor: active ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.16)',
                    }}
                  >
                    <Target className={`h-3.5 w-3.5 ${active ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white block">Strategy Activation</span>
                    <span className="text-xs text-amber-300">
                      {activationLocked ? 'Save strategy to unlock activation' : 'Check conditions to activate'}
                    </span>
                  </div>
                </div>
                <span
                  className="text-xs font-mono px-2 py-1 rounded border"
                  style={{
                    background: active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                    borderColor: active ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.12)',
                    color: active ? '#4ade80' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {active ? '● Live' : activationLocked ? 'Locked' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Symbol</label>
                    <div className="mt-1 rounded-md px-2 py-1.5 text-sm font-mono text-amber-400 border border-white/10 bg-white/5">
                      {displayTicker}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Size ($)</label>
                    <input
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder="10K"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Max/Day</label>
                    <input
                      value={maxDay}
                      onChange={(e) => setMaxDay(e.target.value)}
                      placeholder="10"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Stop Loss %</label>
                    <input
                      value={stopPct}
                      onChange={(e) => setStopPct(e.target.value)}
                      placeholder="2.0"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-red-400 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Take Profit %</label>
                    <input
                      value={takePct}
                      onChange={(e) => setTakePct(e.target.value)}
                      placeholder="4.0"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-emerald-400 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Pre-Trade Checklist</span>
                  <span className="text-xs text-white/40">{preChecks.filter(Boolean).length}/6</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CHECKLIST_ITEMS.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => togglePre(i)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition"
                      style={{
                        background: preChecks[i] ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)',
                        border: preChecks[i] ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        className="shrink-0 flex items-center justify-center rounded transition"
                        style={{
                          width: 14,
                          height: 14,
                          background: preChecks[i] ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                          border: preChecks[i] ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        {preChecks[i] && <Check className="h-2 w-2 text-emerald-400" />}
                      </div>
                      <span className="text-xs" style={{ color: preChecks[i] ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  {!saved ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-white/45">Save strategy to unlock</span>
                    </>
                  ) : !allPreChecked ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-white/45">Check all to activate</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Ready</span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleActivate}
                  disabled={!canActivate}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition"
                  style={{
                    background: canActivate ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                    border: canActivate ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    color: canActivate ? '#4ade80' : 'rgba(255,255,255,0.3)',
                    cursor: canActivate ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Play className="h-3 w-3" />
                  Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
