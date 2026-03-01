import React, { useId } from 'react';

export default function SophiaMark({ className = '', size = 16, ...props }) {
  const gradientId = useId().replace(/:/g, '');
  const topId = `sophia-sol-top-${gradientId}`;
  const midId = `sophia-sol-mid-${gradientId}`;
  const bottomId = `sophia-sol-bottom-${gradientId}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id={topId} x1="12" y1="18" x2="86" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
        <linearGradient id={midId} x1="12" y1="44" x2="86" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14F195" />
          <stop offset="1" stopColor="#86F9E7" />
        </linearGradient>
        <linearGradient id={bottomId} x1="12" y1="70" x2="86" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>

      <path d="M24 18H86L74 30H12L24 18Z" fill={`url(#${topId})`} />
      <path d="M12 44H74L86 56H24L12 44Z" fill={`url(#${midId})`} />
      <path d="M24 70H86L74 82H12L24 70Z" fill={`url(#${bottomId})`} />
    </svg>
  );
}
