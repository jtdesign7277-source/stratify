/**
 * Premium Metrics Example 4
 * Animated statistics with visual flair
 */

import { useState, useEffect } from 'react';

// Animated counter hook
function useAnimatedCounter(target, duration = 1000) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const startValue = count;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (target - startValue) * eased;
      
      setCount(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [target]);
  
  return count;
}

// Single metric card with animation
export function MetricCard({ label, value, suffix = '', prefix = '', trend, icon }) {
  const animatedValue = useAnimatedCounter(parseFloat(value), 800);
  const isPositive = trend > 0;
  
  return (
    <div className="group relative bg-gradient-to-br from-[#18191b] to-[#0f1011] border border-[#2a2b2e] rounded-2xl p-5 hover:border-[#3c4043] transition-all duration-300">
      {/* Glow on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              {icon}
            </div>
          )}
        </div>
        
        {/* Value */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-3xl font-bold text-white tabular-nums">
            {prefix}{animatedValue.toFixed(1)}{suffix}
          </span>
        </div>
        
        {/* Trend */}
        {trend !== undefined && (
          <div className={`inline-flex items-center gap-1 text-xs font-medium ${
            isPositive ? 'text-emerald-400' : 'text-red-400'
          }`}>
            <svg className={`w-3 h-3 ${!isPositive && 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span>{isPositive ? '+' : ''}{trend}% vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Horizontal metrics bar
export function MetricsBar({ metrics }) {
  return (
    <div className="relative bg-gradient-to-r from-[#18191b] to-[#1e1f22] border border-[#2a2b2e] rounded-2xl p-1 overflow-hidden">
      {/* Background gradient animation */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 animate-gradient-x" />
      
      <div className="relative grid grid-cols-4 divide-x divide-[#2a2b2e]">
        {metrics.map((metric, index) => (
          <div key={index} className="px-6 py-4 text-center group">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{metric.label}</div>
            <div className={`text-2xl font-bold tabular-nums ${
              metric.highlight 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400' 
                : 'text-white'
            }`}>
              {metric.value}
            </div>
            {metric.subtext && (
              <div className="text-xs text-gray-600 mt-1">{metric.subtext}</div>
            )}
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes gradient-x {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        .animate-gradient-x {
          animation: gradient-x 8s ease infinite;
        }
      `}</style>
    </div>
  );
}

// Ring progress indicator
export function RingProgress({ value, max = 100, label, color = 'blue' }) {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const colors = {
    blue: { stroke: '#3b82f6', glow: 'rgba(59,130,246,0.3)' },
    emerald: { stroke: '#10b981', glow: 'rgba(16,185,129,0.3)' },
    purple: { stroke: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
    amber: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  };
  
  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Glow */}
      <div 
        className="absolute w-28 h-28 rounded-full blur-xl opacity-30"
        style={{ backgroundColor: colors[color].glow }}
      />
      
      <svg className="w-32 h-32 transform -rotate-90">
        {/* Background track */}
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke="#2a2b2e"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke={colors[color].stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white">{value}%</span>
        {label && <span className="text-xs text-gray-500">{label}</span>}
      </div>
    </div>
  );
}

// Strategy performance summary
export function PerformanceSummary({ strategy }) {
  const metrics = [
    { label: 'Win Rate', value: `${strategy.winRate}%`, color: parseFloat(strategy.winRate) > 50 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Profit Factor', value: strategy.profitFactor, color: parseFloat(strategy.profitFactor) > 1.5 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Sharpe Ratio', value: strategy.sharpeRatio, color: parseFloat(strategy.sharpeRatio) > 1.5 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Max Drawdown', value: `${strategy.maxDrawdown}%`, color: parseFloat(strategy.maxDrawdown) < 15 ? 'text-emerald-400' : 'text-red-400' },
  ];
  
  return (
    <div className="bg-gradient-to-br from-[#18191b] to-[#0f1011] border border-[#2a2b2e] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#2a2b2e]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h4 className="text-white font-semibold">Performance Metrics</h4>
            <p className="text-xs text-gray-500">Backtested over 252 trading days</p>
          </div>
        </div>
      </div>
      
      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px bg-[#2a2b2e]">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-[#18191b] p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{metric.label}</div>
            <div className={`text-xl font-bold ${metric.color}`}>{metric.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
