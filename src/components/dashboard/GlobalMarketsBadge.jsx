import React from 'react';

const BADGES = [
  { market: 'New York', session: 'NYSE / NASDAQ' },
  { market: 'London', session: 'LSE' },
  { market: 'Tokyo', session: 'TSE' },
  { market: 'Sydney', session: 'ASX' },
];

export default function GlobalMarketsBadge() {
  return (
    <div className="mt-8 flex items-center justify-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-[#060d18]/55 px-3 py-1.5 backdrop-blur">
        <span className="text-[10px] uppercase tracking-[0.24em] text-blue-300/80">Global Markets</span>
        <div className="h-3 w-px bg-white/15" />
        <div className="flex items-center gap-1.5">
          {BADGES.map((item) => (
            <span
              key={item.market}
              className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300"
            >
              <span className="text-white/65">{item.market}</span>
              <span className="text-blue-200/85">{item.session}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
