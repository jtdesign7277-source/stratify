import React from 'react';

const TickerTape = ({ text }) => {
  if (!text) return null;

  return (
    <div className="relative h-8 overflow-hidden border-b border-emerald-500/20 bg-[#0a0a0f]">
      <div className="ticker-tape-track">
        <div className="ticker-tape-content text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          <span>{text}</span>
          <span aria-hidden="true">{text}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0a0a0f] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0a0a0f] to-transparent" />
    </div>
  );
};

export default TickerTape;
