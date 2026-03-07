import React from 'react';

// Candle palette options (id, name, up color, down color)
export const CANDLE_PALETTES = [
  { id: 'classic', name: 'Classic', up: '#089981', down: '#f23645' },
  { id: 'ocean', name: 'Ocean', up: '#00C2FF', down: '#FF6B9D' },
  { id: 'forest', name: 'Forest', up: '#22c55e', down: '#f97316' },
];

export const CHART_DISPLAY_OPTIONS = [
  { id: 'solid', name: 'Solid candles', Icon: SolidCandleIcon },
  { id: 'hollow', name: 'Hollow candles', Icon: HollowCandleIcon },
  { id: 'line', name: 'Line chart', Icon: LineChartIcon },
];

// Solid: one filled + one outline candle
function SolidCandleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="2" x2="4" y2="5" />
      <rect x="3" y="5" width="2" height="5" rx="0.25" fill="currentColor" stroke="currentColor" />
      <line x1="4" y1="10" x2="4" y2="12" />
      <line x1="10" y1="3" x2="10" y2="5" />
      <rect x="9" y="5" width="2" height="4" rx="0.25" fill="none" stroke="currentColor" />
      <line x1="10" y1="9" x2="10" y2="12" />
    </svg>
  );
}

// Hollow: both candles outline only
function HollowCandleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="2" x2="4" y2="5" />
      <rect x="3" y="5" width="2" height="5" rx="0.25" fill="none" stroke="currentColor" />
      <line x1="4" y1="10" x2="4" y2="12" />
      <line x1="10" y1="3" x2="10" y2="5" />
      <rect x="9" y="5" width="2" height="4" rx="0.25" fill="none" stroke="currentColor" />
      <line x1="10" y1="9" x2="10" y2="12" />
    </svg>
  );
}

// Line: trending line
function LineChartIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 11l2.5-2.5 2 1.5 2.5-3 4.5 4" />
    </svg>
  );
}
