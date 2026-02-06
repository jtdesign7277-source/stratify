import React, { useState, useRef } from 'react';
import { 
  Share2, Download, Twitter, Copy, Check, TrendingUp, 
  TrendingDown, Zap, Trophy, Flame, Target, ChevronRight,
  X, Sparkles
} from 'lucide-react';

// Mini sparkline for the card
const CardSparkline = ({ data, color = '#10b981', height = 60 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon 
        points={`0,100 ${points} 100,100`} 
        fill="url(#sparkGrad)"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Stat cell component for dense data display
const StatCell = ({ label, value }) => (
  <div className="rounded-lg bg-[#303134] border border-[#5f6368]/60 px-2.5 py-2">
    <div className="text-[10px] text-[#9AA0A6] uppercase tracking-wider">{label}</div>
    <div className="text-[12px] text-[#E8EAED] font-semibold mt-1">{value}</div>
  </div>
);

// The actual share card that gets rendered/exported
const ShareCardContent = ({ data, variant = 'default' }) => {
  const isPositive = data.pnl >= 0;
  const pnlColor = isPositive ? '#00C853' : '#F44336';
  const glowColor = isPositive ? 'rgba(0, 200, 83, 0.45)' : 'rgba(244, 67, 54, 0.45)';
  const avgPerTrade = data.trades ? data.pnl / data.trades : 0;
  const range = Math.max(...data.chartData) - Math.min(...data.chartData);

  const formatCurrency = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(value).toLocaleString()}`;
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toLocaleString();
  };

  return (
    <div
      className="relative w-[420px] h-[520px] rounded-2xl overflow-hidden border border-[#5f6368]/70"
      style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif", backgroundColor: '#202124' }}
    >
      <style>{`
        @keyframes pnlGlow {
          0%, 100% { box-shadow: 0 0 0 1px #5f6368, 0 0 14px ${glowColor}; }
          50% { box-shadow: 0 0 0 1px #5f6368, 0 0 24px ${glowColor}; }
        }
      `}</style>
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ animation: 'pnlGlow 3.8s ease-in-out infinite' }} />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />

      <div className="relative h-full flex flex-col p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#303134] border border-[#5f6368]/60 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#00C853]" />
            </div>
            <div>
              <div className="text-[#E8EAED] font-semibold leading-tight">Stratify</div>
              <div className="text-[10px] text-[#9AA0A6] uppercase tracking-widest">Share Card</div>
            </div>
          </div>
          {data.badge && (
            <div className="px-2.5 py-1 rounded-full bg-[#303134] text-[10px] font-semibold text-[#E8EAED] uppercase tracking-wider flex items-center gap-1 border border-[#5f6368]/60">
              {data.badge === 'superbowl' && <Trophy className="w-3 h-3" />}
              {data.badge === 'streak' && <Flame className="w-3 h-3" />}
              {data.badge === 'whale' && <Sparkles className="w-3 h-3" />}
              {data.badgeText}
            </div>
          )}
        </div>

        {/* Strategy info */}
        <div className="mt-4">
          <span className="text-xs text-[#9AA0A6] tracking-wider">{data.ticker}</span>
          <h2 className="text-2xl font-bold text-[#E8EAED] leading-tight mt-1">{data.strategyName}</h2>
          <p className="text-xs text-[#9AA0A6] mt-1">{data.timeframe}</p>
        </div>

        {/* Main numbers */}
        <div className="mt-4 grid grid-cols-[1.25fr_1fr] gap-3 items-start">
          <div>
            <div className="text-[10px] text-[#9AA0A6] uppercase tracking-wider mb-2">Total Return</div>
            <div className="text-5xl font-bold tracking-tight" style={{ color: pnlColor }}>
              {isPositive ? '+' : ''}{data.pnlPercent}%
            </div>
            <div className="text-sm text-[#9AA0A6] mt-2">
              {isPositive ? '+' : '-'}${Math.abs(data.pnl).toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <StatCell label="Win rate" value={`${data.winRate}%`} />
            <StatCell label="Trades" value={formatNumber(data.trades)} />
            <StatCell label="Sharpe" value={data.sharpe ?? '—'} />
            <StatCell label="Avg/Trade" value={formatCurrency(avgPerTrade)} />
          </div>
        </div>

        {/* Dense stats row */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCell label="Max DD" value={data.maxDrawdown ? `-${data.maxDrawdown}%` : '—'} />
          <StatCell label="Profit Factor" value={data.profitFactor ?? '—'} />
          <StatCell label="Best Trade" value={formatCurrency(data.bestTrade)} />
          <StatCell label="Worst Trade" value={formatCurrency(data.worstTrade)} />
          <StatCell label="Avg Hold" value={data.avgHoldTime ?? '—'} />
          <StatCell label="Volume" value={formatNumber(data.volume)} />
        </div>

        {/* Chart */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[#9AA0A6] uppercase tracking-widest mb-2">
            <span>Equity Curve</span>
            <span>Range {range.toFixed(1)}</span>
          </div>
          <div className="h-20 bg-[#303134] border border-[#5f6368]/60 rounded-xl px-2 py-1">
            <CardSparkline data={data.chartData} color={pnlColor} height={80} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-[#5f6368]/50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#303134] border border-[#5f6368]/60 flex items-center justify-center text-[10px] font-bold text-[#E8EAED]">
              {data.username?.charAt(0).toUpperCase() || 'S'}
            </div>
            <span className="text-xs text-[#9AA0A6] truncate">@{data.username || 'trader'}</span>
          </div>
          <span className="text-[10px] text-[#9AA0A6]">stratify.app</span>
        </div>
      </div>
    </div>
  );
};

// Share modal component
const PnLShareCard = ({ isOpen, onClose, strategyData }) => {
  const [variant, setVariant] = useState('default');
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);
  
  if (!isOpen) return null;
  
  const data = strategyData || {
    ticker: 'NVDA',
    strategyName: 'NVDA Momentum',
    timeframe: 'Feb 1 - Feb 9, 2026',
    pnl: 1843.40,
    pnlPercent: 12.4,
    winRate: 67,
    trades: 84,
    sharpe: 2.1,
    maxDrawdown: 4.2,
    profitFactor: 2.8,
    bestTrade: 423,
    worstTrade: -187,
    avgHoldTime: '2h 14m',
    volume: 847250,
    chartData: [100, 102, 98, 105, 108, 104, 112, 115, 118, 120, 117, 124],
    username: 'trader_mike',
    badge: 'superbowl',
    badgeText: 'Super Bowl'
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://stratify.app/share/${data.ticker.toLowerCase()}-${Date.now()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = async () => {
    // In production, use html2canvas or similar
    alert('Downloading card as image...');
  };
  
  const handleShareTwitter = () => {
    const text = `Just hit ${data.pnlPercent > 0 ? '+' : ''}${data.pnlPercent}% on my ${data.strategyName} strategy 🚀\n\nBuilt with @StratifyApp\n\n#Trading #AlgoTrading #SuperBowl`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };
  
  const variants = [
    { id: 'default', name: 'Classic', color: 'from-emerald-500 to-cyan-500' },
    { id: 'fire', name: 'Fire', color: 'from-orange-500 to-red-500' },
    { id: 'superbowl', name: 'Super Bowl', color: 'from-emerald-400 to-green-500' },
    { id: 'whale', name: 'Whale', color: 'from-blue-500 to-purple-500' },
  ];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[#202124] border border-[#5f6368] rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[#303134] transition-colors"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
        
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            Share Your Gains
          </h2>
          <p className="text-sm text-white/50 mt-1">Show off your strategy performance</p>
        </div>
        
        <div className="flex gap-6">
          {/* Card preview */}
          <div ref={cardRef} className="flex-shrink-0">
            <ShareCardContent data={data} variant={variant} />
          </div>
          
          {/* Controls */}
          <div className="flex-1 space-y-6">
            {/* Variant selector */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-3 block">Card Style</label>
              <div className="grid grid-cols-2 gap-2">
                {variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVariant(v.id)}
                    className={`p-3 rounded-xl border transition-all ${
                      variant === v.id 
                        ? 'border-emerald-500 bg-emerald-500/10' 
                        : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className={`w-full h-2 rounded-full bg-gradient-to-r ${v.color} mb-2`} />
                    <span className="text-xs text-white/70">{v.name}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Share options */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-3 block">Share To</label>
              <div className="space-y-2">
                <button 
                  onClick={handleShareTwitter}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 hover:bg-[#1DA1F2]/20 transition-colors"
                >
                  <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                  <span className="text-sm text-white/80">Share on X / Twitter</span>
                  <ChevronRight className="w-4 h-4 text-white/40 ml-auto" />
                </button>
                
                <button 
                  onClick={handleDownload}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-colors"
                >
                  <Download className="w-5 h-5 text-white/60" />
                  <span className="text-sm text-white/80">Download Image</span>
                  <ChevronRight className="w-4 h-4 text-white/40 ml-auto" />
                </button>
                
                <button 
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-colors"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-white/60" />
                  )}
                  <span className="text-sm text-white/80">
                    {copied ? 'Link Copied!' : 'Copy Share Link'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/40 ml-auto" />
                </button>
              </div>
            </div>
            
            {/* Pro tip */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-white/80 font-medium">Super Bowl Challenge</p>
                  <p className="text-xs text-white/50 mt-1">
                    Share your card with #StratifySuperBowl to enter the $10K prize pool!
                  </p>
                </div>
              </div>
            </div>
            
            {/* Referral code */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Your Referral Code</p>
                  <p className="text-lg font-mono text-white mt-1">MIKE-2026</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">Earnings</p>
                  <p className="text-lg font-semibold text-emerald-400">$127.50</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Demo wrapper to show the component
const ShareCardDemo = () => {
  const [isOpen, setIsOpen] = useState(true);
  
  const sampleStrategy = {
    ticker: 'NVDA',
    strategyName: 'NVDA Momentum',
    timeframe: 'Feb 1 - Feb 9, 2026',
    pnl: 1843.40,
    pnlPercent: 12.4,
    winRate: 67,
    trades: 84,
    sharpe: 2.1,
    maxDrawdown: 4.2,
    profitFactor: 2.8,
    bestTrade: 423,
    worstTrade: -187,
    avgHoldTime: '2h 14m',
    volume: 847250,
    chartData: [100, 102, 98, 105, 108, 104, 112, 115, 118, 120, 117, 124],
    username: 'trader_mike',
    badge: 'superbowl',
    badgeText: 'Super Bowl'
  };
  
  return (
    <div className="min-h-screen bg-[#060d18] p-8">
      {/* Trigger button for demo */}
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors flex items-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share P&L Card
      </button>
      
      {/* The modal */}
      <PnLShareCard 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        strategyData={sampleStrategy}
      />
    </div>
  );
};

export { PnLShareCard, ShareCardContent };
export default ShareCardDemo;
