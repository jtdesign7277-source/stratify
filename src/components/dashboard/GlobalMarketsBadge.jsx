import React from 'react';

export default function GlobalMarketsBadge() {
  return (
    <div className="mt-8 flex items-center justify-center">
      <p className="text-sm text-gray-500/90 tracking-[0.06em]">
        <span className="text-gray-300">🇺🇸 NYSE/NASDAQ</span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="text-gray-300">🇬🇧 London Stock Exchange</span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="text-gray-300">₿ Crypto</span>
      </p>
    </div>
  );
}
