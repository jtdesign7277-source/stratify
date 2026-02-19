import React from 'react';

export default function GlobalMarketsBadge() {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-2">
      <p className="text-sm text-gray-500/90 tracking-[0.06em]">
        <span className="text-gray-300">🇺🇸 NYSE/NASDAQ</span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="text-gray-300">🇬🇧 London Stock Exchange</span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="text-gray-300">₿ Crypto</span>
      </p>
      <p className="text-sm text-gray-400 tracking-[0.06em]">
        One interface. Real-time. All of them.
      </p>
    </div>
  );
}
