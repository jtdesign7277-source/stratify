// /src/components/dashboard/SentimentBadge.jsx
// Inline sentiment badge for watchlist ticker rows
// Shows sentiment score with color coding + tooltip

import React, { useState } from 'react';
import { getSentimentLabel, getSentimentColor } from '../../hooks/useMarketAux';

export default function SentimentBadge({ score, totalDocs, compact = false }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = getSentimentColor(score);
  const label = getSentimentLabel(score);

  if (score === null || score === undefined) {
    return (
      <span className="text-[10px] text-gray-600 font-mono">--</span>
    );
  }

  const displayScore = score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);

  if (compact) {
    // Ultra-compact: just the colored dot + number for tight watchlist rows
    return (
      <div
        className="relative flex items-center gap-1"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            score >= 0.2 ? 'bg-emerald-400' :
            score <= -0.2 ? 'bg-red-400' :
            'bg-gray-500'
          }`}
        />
        <span className={`text-[10px] font-mono ${colors.text}`}>
          {displayScore}
        </span>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                          px-2.5 py-1.5 rounded-lg bg-[#0d1b2a] border border-white/10
                          shadow-xl shadow-black/50 whitespace-nowrap pointer-events-none">
            <div className={`text-xs font-semibold ${colors.text}`}>{label}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {totalDocs || 0} articles analyzed
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
                            w-0 h-0 border-l-4 border-r-4 border-t-4
                            border-transparent border-t-white/10" />
          </div>
        )}
      </div>
    );
  }

  // Standard badge: pill-shaped with label
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                        text-[11px] font-medium ${colors.bg} ${colors.border} border
                        transition-all duration-200 cursor-default`}>
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            score >= 0.2 ? 'bg-emerald-400' :
            score <= -0.2 ? 'bg-red-400' :
            'bg-gray-500'
          }`}
        />
        <span className={`font-mono ${colors.text}`}>{displayScore}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                        px-3 py-2 rounded-lg bg-[#0d1b2a] border border-white/10
                        shadow-xl shadow-black/50 whitespace-nowrap pointer-events-none">
          <div className={`text-xs font-semibold ${colors.text}`}>{label}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Score: {displayScore} · {totalDocs || 0} articles
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
                          w-0 h-0 border-l-4 border-r-4 border-t-4
                          border-transparent border-t-white/10" />
        </div>
      )}
    </div>
  );
}
