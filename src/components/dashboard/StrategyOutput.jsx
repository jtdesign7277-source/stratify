import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Save, Play, Copy, Check } from 'lucide-react';

const StrategyOutput = ({ strategy, onSave, onDeploy }) => {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!strategy) return null;

  const copyCode = () => {
    if (strategy.code) {
      navigator.clipboard.writeText(strategy.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">{strategy.name || 'Strategy Output'}</h2>
        {strategy.value && <p className="text-emerald-400 text-sm font-semibold mt-1">💰 {strategy.value}</p>}
        {strategy.ticker && <span className="text-amber-400 font-mono text-sm">${strategy.ticker}</span>}
      </div>

      {/* Key Trade Setups */}
      <div className="space-y-2">
        <h3 className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">🔥 Key Trade Setups</h3>
        {[
          { label: 'Entry Signal', value: strategy.entry },
          { label: 'Volume', value: strategy.volume },
          { label: 'Trend', value: strategy.trend },
          { label: 'Risk/Reward', value: strategy.riskReward },
          { label: 'Stop Loss', value: strategy.stopLoss },
        ].filter(f => f.value).map((field, i) => (
          <div key={i} className="flex justify-between items-start py-2 border-b border-[#1f1f1f]">
            <span className="text-gray-500 text-xs uppercase tracking-wide font-semibold w-28 shrink-0">{field.label}</span>
            <span className="text-white text-sm text-right">{field.value}</span>
          </div>
        ))}
      </div>

      {/* Python Code */}
      {strategy.code && (
        <div className="border border-[#1f1f1f] rounded-lg overflow-hidden">
          <button
            onClick={() => setCodeExpanded(!codeExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-[#0b0b0b] hover:bg-[#111] transition-colors"
          >
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Python Code</span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); copyCode(); }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {codeExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
          </button>
          {codeExpanded && (
            <pre className="p-3 bg-[#0b0b0b] overflow-x-auto text-xs text-gray-300 font-mono leading-relaxed max-h-[400px] overflow-y-auto">
              {strategy.code}
            </pre>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSave && onSave(strategy)}
          className="flex items-center gap-2 text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Strategy
        </button>
        <button
          onClick={() => onDeploy && onDeploy(strategy)}
          className="flex items-center gap-2 text-blue-400 text-sm font-semibold hover:text-blue-300 transition-colors"
        >
          <Play className="w-4 h-4" />
          Deploy
        </button>
      </div>
    </div>
  );
};

export default StrategyOutput;
