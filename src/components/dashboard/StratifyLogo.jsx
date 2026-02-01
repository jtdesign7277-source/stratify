import React from 'react';

const StratifyLogo = ({ size = 32, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 120 120" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="stratifyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6"/>
        <stop offset="50%" stopColor="#8b5cf6"/>
        <stop offset="100%" stopColor="#22d3ee"/>
      </linearGradient>
    </defs>
    {/* Circle background */}
    <circle cx="60" cy="60" r="48" stroke="url(#stratifyGrad)" strokeWidth="1" fill="none" opacity="0.3"/>
    {/* Custom thin S path */}
    <path 
      d="M72 38C72 38 68 32 58 32C48 32 42 38 42 46C42 54 50 56 60 58C70 60 78 64 78 74C78 84 70 90 58 90C46 90 40 82 40 82" 
      stroke="url(#stratifyGrad)" 
      strokeWidth="3" 
      strokeLinecap="round" 
      fill="none"
    />
    {/* Orbit dot */}
    <circle cx="95" cy="45" r="3" fill="#22d3ee"/>
  </svg>
);

export default StratifyLogo;
