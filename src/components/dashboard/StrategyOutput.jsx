import React, { useState, useEffect, useMemo } from 'react';

const CHECKLIST_ITEMS = [
  'Entry Signal Confirmed',
  'Volume Above Average',
  'Trend Alignment',
  'Risk/Reward ≥ 2:1',
  'Stop Loss Defined',
  'Position Size OK',
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

      {/* RIGHT SIDE — sticky, no scroll */}
      <div className="w-[300px] flex-shrink-0 flex flex-col gap-2 p-3 h-full overflow-hidden">
        {/* Card 1: Key Trade Setups */}
        <div className="border border-[#1f1f1f] rounded-xl bg-[#0e0e0e] px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🔥</span>
              <span className="text-white font-semibold text-xs">KEY TRADE SETUPS</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${allChecked ? 'border-emerald-500/40 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
              {checkedCount}/6
            </span>
          </div>

          <div className="space-y-1">
            {fields.map((f, i) => (
              <div key={i} onClick={() => toggleCheck(i)} className="flex items-center gap-2 cursor-pointer group py-0.5">
                <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition ${
                  checks[i] ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 group-hover:border-zinc-400'
                }`}>
                  {checks[i] && <span className="text-black text-[8px] font-bold">✓</span>}
                </div>
                <span className="text-zinc-500 text-[10px] w-16 flex-shrink-0">{f.label}</span>
                <span className="text-zinc-200 text-[11px] truncate flex-1">{f.value || '—'}</span>
              </div>
            ))}
            {/* $ Allocation */}
            <div className="flex items-center gap-2 py-0.5">
              <div onClick={() => toggleCheck(5)} className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition cursor-pointer ${
                checks[5] ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-zinc-400'
              }`}>
                {checks[5] && <span className="text-black text-[8px] font-bold">✓</span>}
              </div>
              <span className="text-zinc-500 text-[10px] w-16 flex-shrink-0">$ Allocation</span>
              <input
                type="text"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                placeholder="$0"
                className="flex-1 bg-transparent border border-[#1f1f1f] rounded px-1.5 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <button onClick={() => onSave?.({ ...s, allocation, checks })} className="flex-1 py-1.5 border border-[#1f1f1f] rounded-lg text-zinc-300 hover:text-white hover:border-zinc-600 transition text-[11px]">
              Save
            </button>
            <button onClick={() => onRetest?.()} className="flex-1 py-1.5 border border-[#1f1f1f] rounded-lg text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 transition text-[11px]">
              Retest
            </button>
          </div>
        </div>

        {/* Card 2: Strategy Activation */}
        <div className={`border border-[#1f1f1f] rounded-xl bg-[#0e0e0e] px-3 py-2.5 relative ${!allChecked ? 'opacity-40' : ''}`}>
          {!allChecked && (
            <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center z-10">
              <span className="text-zinc-500 text-[11px]">🔒 Complete all trade setups</span>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-semibold text-xs">STRATEGY ACTIVATION</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${active ? 'border-emerald-500/40 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
              {active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <div>
              <div className="text-zinc-500 text-[9px] mb-0.5">Symbol</div>
              <div className="text-zinc-200 text-[11px] px-1.5 py-1 border border-[#1f1f1f] rounded bg-[#0b0b0b]">{s.ticker || '—'}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] mb-0.5">Size ($)</div>
              <input value={size} onChange={(e) => setSize(e.target.value)} disabled={!allChecked}
                className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] mb-0.5">Max/Day</div>
              <input value={maxDay} onChange={(e) => setMaxDay(e.target.value)} disabled={!allChecked}
                className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <div>
              <div className="text-zinc-500 text-[9px] mb-0.5">Stop Loss %</div>
              <input value={stopPct} onChange={(e) => setStopPct(e.target.value)} disabled={!allChecked}
                className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-1.5 py-1 text-[11px] text-red-400 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] mb-0.5">Take Profit %</div>
              <input value={takePct} onChange={(e) => setTakePct(e.target.value)} disabled={!allChecked}
                className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-1.5 py-1 text-[11px] text-emerald-400 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
            </div>
          </div>

          <div className="text-zinc-500 text-[9px] mb-1 font-semibold">PRE-TRADE CHECKLIST</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-2">
            {CHECKLIST_ITEMS.map((item, i) => (
              <div key={i} onClick={() => allChecked && togglePre(i)} className="flex items-center gap-1 cursor-pointer text-[10px]">
                <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition ${
                  preChecks[i] ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
                }`}>
                  {preChecks[i] && <span className="text-black text-[7px] font-bold">✓</span>}
                </div>
                <span className="text-zinc-400 truncate">{item}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleActivate}
            disabled={!allChecked || !allPreChecked}
            className={`w-full py-1.5 rounded-lg border text-[11px] font-medium transition ${
              allChecked && allPreChecked
                ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                : 'border-[#1f1f1f] text-zinc-600 cursor-not-allowed'
            }`}
          >
            Activate Strategy
          </button>
        </div>
      </div>
    </div>
  );
}
