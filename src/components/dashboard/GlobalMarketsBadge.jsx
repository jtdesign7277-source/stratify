import React from 'react';

export default function GlobalMarketsBadge() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-2">
      <p className="text-sm text-gray-500/90 tracking-[0.06em]">
        <span className="inline-flex items-center gap-1 text-gray-300">
          <span className="text-[18px] leading-none">🇺🇸</span>
          <span>NYSE</span>
        </span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="inline-flex items-center gap-1 text-gray-300">
          <span className="text-[18px] leading-none">🇬🇧</span>
          <span>London</span>
        </span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="inline-flex items-center gap-1 text-gray-300">
          <span className="text-[18px] leading-none">🇦🇺</span>
          <span>Australia</span>
        </span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="text-gray-300">₿ Crypto</span>
      </p>
      <p className="text-sm text-gray-400 tracking-[0.06em]">
        One interface. Real-time. All of them.
      </p>
    </div>
  );
}
