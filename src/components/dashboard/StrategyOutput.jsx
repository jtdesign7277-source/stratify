import React, { useState, useEffect, useMemo } from 'react';
import { ChevronsRight, ChevronsLeft, Check, Flame, Target, AlertTriangle, Play, TrendingUp, BarChart3, Zap, Shield, DollarSign } from 'lucide-react';

const CHECKLIST_ITEMS = [
  { id: 'entry-signal', label: 'Entry Signal Confirmed', icon: TrendingUp },
  { id: 'volume-check', label: 'Volume Above Average', icon: BarChart3 },
  { id: 'trend-alignment', label: 'Trend Alignment', icon: Zap },
  { id: 'risk-reward', label: 'Risk/Reward ≥ 2:1', icon: Target },
  { id: 'stop-loss-set', label: 'Stop Loss Defined', icon: Shield },
  { id: 'position-sized', label: 'Position Size OK', icon: DollarSign },
];

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
  const storageKey = `stratify-activation-${s.name || 'default'}`;

  // Key Trade Setups checkboxes
  const [checks, setChecks] = useState([false, false, false, false, false, false]);
  const [allocation, setAllocation] = useState('');

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
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved) {
        if (saved.checks) setChecks(saved.checks);
        if (saved.allocation) setAllocation(saved.allocation);
        if (saved.size) setSize(saved.size);
        if (saved.maxDay) setMaxDay(saved.maxDay);
        if (saved.stopPct) setStopPct(saved.stopPct);
        if (saved.takePct) setTakePct(saved.takePct);
        if (saved.preChecks) setPreChecks(saved.preChecks);
        if (saved.active) setActive(saved.active);
      }
    } catch {}
  }, [storageKey]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ checks, allocation, size, maxDay, stopPct, takePct, preChecks, active }));
  }, [checks, allocation, size, maxDay, stopPct, takePct, preChecks, active, storageKey]);

  const allChecked = checks.every(Boolean);
  const allPreChecked = preChecks.every(Boolean);
  const checkedCount = checks.filter(Boolean).length;

  const toggleCheck = (i) => setChecks((p) => p.map((v, j) => (j === i ? !v : v)));
  const togglePre = (i) => setPreChecks((p) => p.map((v, j) => (j === i ? !v : v)));

  const fields = [
    { label: 'Entry Signal', value: s.entry },
    { label: 'Volume', value: s.volume },
    { label: 'Trend', value: s.trend },
    { label: 'Risk/Reward', value: s.riskReward },
    { label: 'Stop Loss', value: s.stopLoss },
  ];

  const renderedMarkdown = useMemo(() => parseMarkdown(s.raw), [s.raw]);

  const handleActivate = () => {
    setActive(true);
    onDeploy?.({ symbol: s.ticker, size, maxDay, stopPct, takePct });
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
                {s.ticker}
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

      {/* RIGHT SIDE — unified container, Second Brain style */}
      {cardsCollapsed ? (
        <div className="w-[40px] flex-shrink-0 h-full bg-[#0b0b0b] border-l border-[#1f1f1f] flex flex-col items-center py-3">
          <button onClick={() => setCardsCollapsed(false)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Expand">
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>
      ) : (
      <div className="w-[320px] flex-shrink-0 h-full border-l border-[#1f1f1f] flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(16,16,28,0.95) 0%, rgba(11,11,20,0.98) 100%)' }}>

        {/* ── TOP HALF: Key Trade Setups ── */}
        <div className="flex-1 flex flex-col min-h-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider">Key Trade Setups Identified</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono" style={{ color: allChecked ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                {checkedCount}/6
              </span>
              <button onClick={() => onSave?.({ ...s, allocation, checks })}
                className="rounded px-2 py-0.5 text-[10px] font-bold transition"
                style={{
                  background: allChecked ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                  border: allChecked ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: allChecked ? '#4ade80' : 'rgba(255,255,255,0.4)',
                }}>
                Save
              </button>
              <button onClick={() => setCardsCollapsed(true)} className="p-0.5 text-emerald-400 hover:text-emerald-300 transition-colors" title="Collapse">
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3x2 Grid of checklist items */}
          <div className="grid grid-cols-2 flex-1 min-h-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {fields.map((f, i) => (
              <div key={i} onClick={() => toggleCheck(i)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer transition"
                style={{
                  background: checks[i] ? 'rgba(74,222,128,0.04)' : 'rgba(11,11,20,0.95)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                }}>
                <div className="shrink-0 flex items-center justify-center rounded-md transition"
                  style={{
                    width: 20, height: 20,
                    background: checks[i] ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                    border: checks[i] ? '1.5px solid rgba(74,222,128,0.5)' : '1.5px solid rgba(255,255,255,0.12)',
                    boxShadow: checks[i] ? '0 0 8px rgba(74,222,128,0.2)' : 'none',
                  }}>
                  {checks[i] && <Check className="h-2.5 w-2.5 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      color: checks[i] ? '#4ade80' : 'rgba(255,255,255,0.45)',
                      textShadow: checks[i] ? '0 0 6px rgba(74,222,128,0.3)' : 'none',
                    }}>
                    {f.label}
                  </div>
                  {i < 5 ? (
                    <span className="text-[10px] truncate block"
                      style={{
                        color: !f.value || f.value === '—' ? 'rgba(255,255,255,0.2)' : checks[i] ? '#4ade80' : 'rgba(255,255,255,0.7)',
                        textShadow: checks[i] ? '0 0 6px rgba(74,222,128,0.25)' : 'none',
                      }}>
                      {f.value || '—'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-amber-400">$</span>
                      <input
                        type="text"
                        value={allocation}
                        onChange={(e) => { e.stopPropagation(); setAllocation(e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Amount..."
                        className="flex-1 rounded px-1 py-0 text-[10px] text-white focus:outline-none w-full"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(251,191,36,0.3)' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Retest button */}
          <div className="flex-shrink-0 px-3 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => {
              const params = fields.map(f => `${f.label}: ${f.value || '—'}`).join('\n');
              const alloc = allocation ? `$ Allocation: ${allocation}` : '';
              const prompt = `Retest this strategy with updated parameters:\n\nTicker: $${s.ticker || 'UNKNOWN'}\nStrategy: ${s.name || 'Strategy'}\n${params}${alloc ? '\n' + alloc : ''}\n\nPlease regenerate the full backtest analysis with these parameters.`;
              onRetest?.(prompt);
            }} className="w-full py-1 rounded text-[10px] font-medium transition"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              🔄 Ask Sophia to Retest
            </button>
          </div>
        </div>

        {/* ── BOTTOM HALF: Strategy Activation ── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Activation Header */}
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded"
                style={{
                  background: active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                <Target className={`h-3 w-3 ${active ? 'text-emerald-400' : 'text-zinc-500'}`} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-white/90 block">Strategy Activation</span>
                <span className="text-[9px] block" style={{ color: 'rgba(255,255,255,0.4)' }}>Check conditions to activate</span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                border: active ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#4ade80' : 'rgba(255,255,255,0.4)',
              }}>
              {active ? '● Live' : 'Inactive'}
            </span>
          </div>

          {/* Settings grid */}
          <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[8px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Symbol</label>
                <div className="mt-0.5 rounded px-1.5 py-1 text-[11px] font-mono text-amber-400"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {s.ticker || '—'}
                </div>
              </div>
              <div>
                <label className="text-[8px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Size ($)</label>
                <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="10K"
                  className="mt-0.5 w-full rounded px-1.5 py-1 text-[11px] text-zinc-100 focus:outline-none disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              <div>
                <label className="text-[8px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Max/Day</label>
                <input value={maxDay} onChange={(e) => setMaxDay(e.target.value)} placeholder="10"
                  className="mt-0.5 w-full rounded px-1.5 py-1 text-[11px] text-zinc-100 focus:outline-none disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <div>
                <label className="text-[8px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Stop Loss %</label>
                <input value={stopPct} onChange={(e) => setStopPct(e.target.value)} placeholder="2.0"
                  className="mt-0.5 w-full rounded px-1.5 py-1 text-[11px] text-red-400 focus:outline-none disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              <div>
                <label className="text-[8px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Take Profit %</label>
                <input value={takePct} onChange={(e) => setTakePct(e.target.value)} placeholder="4.0"
                  className="mt-0.5 w-full rounded px-1.5 py-1 text-[11px] text-emerald-400 focus:outline-none disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
            </div>
          </div>

          {/* Pre-Trade Checklist */}
          <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Pre-Trade Checklist</span>
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{preChecks.filter(Boolean).length}/6</span>
            </div>
            <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
              {CHECKLIST_ITEMS.map((item, i) => (
                <button key={item.id} onClick={() => togglePre(i)}
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-left transition"
                  style={{
                    background: preChecks[i] ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.02)',
                    border: preChecks[i] ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <div className="shrink-0 flex items-center justify-center rounded transition"
                    style={{
                      width: 14, height: 14,
                      background: preChecks[i] ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                      border: preChecks[i] ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.12)',
                    }}>
                    {preChecks[i] && <Check className="h-2 w-2 text-emerald-400" />}
                  </div>
                  <span className="text-[10px]" style={{ color: preChecks[i] ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Activate button bar */}
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[10px]">
              {!allPreChecked ? (
                <>
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Check all to activate</span>
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
              disabled={!allPreChecked}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-medium transition"
              style={{
                background: allPreChecked ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                border: allPreChecked ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
                color: allPreChecked ? '#4ade80' : 'rgba(255,255,255,0.3)',
                cursor: allPreChecked ? 'pointer' : 'not-allowed',
              }}>
              <Play className="h-3 w-3" />
              Activate
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
