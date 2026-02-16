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

      {/* RIGHT SIDE — full height, no scroll */}
      <div className="w-[320px] flex-shrink-0 flex flex-col gap-3 p-3 h-full overflow-hidden">
        {/* Card 1: Key Trade Setups — flex-1 to fill ~55% */}
        <div className="flex-[55] border border-[#1f1f1f] rounded-xl bg-[#0e0e0e] px-4 py-3 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>🔥</span>
              <span className="text-white font-semibold text-sm">KEY TRADE SETUPS</span>
            </div>
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${allChecked ? 'border-emerald-500/40 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
              {checkedCount}/6
            </span>
          </div>

          <div className="flex-1 space-y-2.5">
            {fields.map((f, i) => (
              <div key={i} onClick={() => toggleCheck(i)} className="flex items-start gap-2.5 cursor-pointer group">
                <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition ${
                  checks[i] ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 group-hover:border-zinc-400'
                }`}>
                  {checks[i] && <span className="text-black text-[10px] font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-500 text-xs font-medium">{f.label}</div>
                  <div className="text-zinc-200 text-sm leading-snug">{f.value || '—'}</div>
                </div>
              </div>
            ))}
            {/* $ Allocation */}
            <div className="flex items-start gap-2.5">
              <div onClick={() => toggleCheck(5)} className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition cursor-pointer ${
                checks[5] ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-zinc-400'
              }`}>
                {checks[5] && <span className="text-black text-[10px] font-bold">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-zinc-500 text-xs font-medium">$ Allocation</div>
                <input
                  type="text"
                  value={allocation}
                  onChange={(e) => setAllocation(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full bg-transparent border border-[#1f1f1f] rounded px-2 py-1 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none mt-1"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={() => onSave?.({ ...s, allocation, checks })} className="flex-1 py-2 border border-[#1f1f1f] rounded-lg text-zinc-300 hover:text-white hover:border-zinc-600 transition text-sm">
              Save
            </button>
            <button onClick={() => onRetest?.()} className="flex-1 py-2 border border-[#1f1f1f] rounded-lg text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 transition text-sm">
              Ask Sophia to Retest
            </button>
          </div>
        </div>

        {/* Card 2: Strategy Activation — flex-1 to fill ~45% */}
        <div className={`flex-[45] border border-[#1f1f1f] rounded-xl bg-[#0e0e0e] px-4 py-3 flex flex-col min-h-0 relative ${!allChecked ? 'opacity-40' : ''}`}>
          {!allChecked && (
            <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center z-10">
              <span className="text-zinc-500 text-sm">🔒 Complete all trade setups first</span>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-semibold text-sm">STRATEGY ACTIVATION</span>
            <span className={`text-xs px-2 py-0.5 rounded border ${active ? 'border-emerald-500/40 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
              {active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-zinc-500 text-xs mb-1">Symbol</div>
                <div className="text-amber-400 text-sm font-mono px-2 py-1.5 border border-[#1f1f1f] rounded bg-[#0b0b0b]">{s.ticker || '—'}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-xs mb-1">Size ($)</div>
                <input value={size} onChange={(e) => setSize(e.target.value)} disabled={!allChecked} placeholder="10,000"
                  className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
              </div>
              <div>
                <div className="text-zinc-500 text-xs mb-1">Max/Day</div>
                <input value={maxDay} onChange={(e) => setMaxDay(e.target.value)} disabled={!allChecked} placeholder="10"
                  className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-zinc-500 text-xs mb-1">Stop Loss %</div>
                <input value={stopPct} onChange={(e) => setStopPct(e.target.value)} disabled={!allChecked} placeholder="2.0"
                  className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-2 py-1.5 text-sm text-red-400 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
              </div>
              <div>
                <div className="text-zinc-500 text-xs mb-1">Take Profit %</div>
                <input value={takePct} onChange={(e) => setTakePct(e.target.value)} disabled={!allChecked} placeholder="4.0"
                  className="w-full bg-[#0b0b0b] border border-[#1f1f1f] rounded px-2 py-1.5 text-sm text-emerald-400 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50" />
              </div>
            </div>

            <div>
              <div className="text-zinc-500 text-xs mb-2 font-semibold">PRE-TRADE CHECKLIST</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {CHECKLIST_ITEMS.map((item, i) => (
                  <div key={i} onClick={() => allChecked && togglePre(i)} className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition ${
                      preChecks[i] ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
                    }`}>
                      {preChecks[i] && <span className="text-black text-[9px] font-bold">✓</span>}
                    </div>
                    <span className="text-zinc-400 text-xs">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleActivate}
            disabled={!allChecked || !allPreChecked}
            className={`w-full py-2.5 rounded-lg border text-sm font-medium transition mt-3 ${
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
