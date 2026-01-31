import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, TrendingUp, DollarSign, Diamond, BarChart3, Zap, Rocket,
  Target, Shield, Clock, AlertTriangle, CheckCircle, ArrowRight,
  ChevronDown, ChevronUp
} from 'lucide-react';

const STRATEGIES = {
  'growth-investing': {
    id: 'growth-investing',
    name: 'Growth Investing',
    tagline: 'Stocks with high growth potential',
    description: 'Target high-growth companies using revenue acceleration, earnings momentum, and technical breakouts. Focus on companies disrupting industries with strong competitive advantages.',
    riskLevel: 'Medium-High',
    riskColor: '#f59e0b',
    icon: TrendingUp,
    timeframe: 'Weeks to Months',
    bestFor: ['$AAPL', '$NVDA', '$TSLA', '$AMZN', '$META', '$GOOGL', '$MSFT'],
    keyMetrics: {
      'Min Revenue Growth': '15% YoY',
      'Min Earnings Growth': '20% YoY',
      'Technical Requirement': 'Price > 20/50/200 SMA',
      'Volume Confirmation': '1.5x average'
    },
    entryRules: [
      'Revenue growth exceeds 15% year-over-year',
      'Earnings growth exceeds 20% year-over-year',
      'Price above all major moving averages (20, 50, 200 SMA)',
      'RSI between 50-70 (momentum without overbought)',
      'Volume surge 1.5x+ on breakout days'
    ],
    exitRules: [
      'Stop Loss: 2x ATR below entry',
      'Take Profit: 4x ATR above entry (2:1 R/R)',
      'RSI exceeds 80 (overbought)',
      'Price closes below 50 SMA'
    ],
    stats: { expectedReturn: '15-25%', maxDrawdown: '15-25%', winRate: '45-55%', avgHolding: '4-12 weeks' }
  },
  'dividend-investing': {
    id: 'dividend-investing',
    name: 'Dividend Investing',
    tagline: 'Companies with regular dividend payouts',
    description: 'Build a portfolio of high-quality dividend-paying stocks with sustainable yields, consistent growth history, and strong payout management. Focus on Dividend Aristocrats.',
    riskLevel: 'Low-Medium',
    riskColor: '#3b82f6',
    icon: DollarSign,
    timeframe: 'Months to Years',
    bestFor: ['$JNJ', '$PG', '$KO', '$PEP', '$VZ', '$O', '$ABBV', '$XOM'],
    keyMetrics: {
      'Dividend Yield': '2.5% - 8%',
      'Max Payout Ratio': '75%',
      'Min Growth Years': '5+ consecutive',
      'FCF Coverage': '25%+ margin'
    },
    entryRules: [
      'Dividend yield between 2.5% - 8% (avoid yield traps)',
      'Payout ratio below 75% (sustainable)',
      '5+ years of consecutive dividend increases',
      'Free cash flow covers dividend with 25%+ margin',
      'Price at or below 200 SMA or key support'
    ],
    exitRules: [
      'Dividend cut or freeze announced',
      'Payout ratio exceeds 90%',
      'Debt/Equity spikes above 2.0',
      'Stop Loss: 20% below entry'
    ],
    stats: { expectedReturn: '8-12%', maxDrawdown: '10-15%', winRate: '65-75%', avgHolding: '1-5 years' }
  },
  'value-investing': {
    id: 'value-investing',
    name: 'Value Investing',
    tagline: 'Undervalued stocks with strong fundamentals',
    description: 'Warren Buffett-inspired approach focusing on intrinsic value, margin of safety, and quality metrics. Buy wonderful companies at fair prices.',
    riskLevel: 'Medium',
    riskColor: '#06b6d4',
    icon: Diamond,
    timeframe: 'Months to Years',
    bestFor: ['$BRK.B', '$JPM', '$BAC', '$WFC', '$UNH', '$CVS'],
    keyMetrics: {
      'Max P/E Ratio': '15x',
      'Max P/B Ratio': '2.0x',
      'Min ROE': '15%',
      'Margin of Safety': '25%+'
    },
    entryRules: [
      'P/E ratio below 15 (or below sector average)',
      'P/B ratio below 2.0',
      'Return on Equity (ROE) above 15%',
      'Return on Invested Capital (ROIC) above 12%',
      'Price 25%+ below calculated intrinsic value'
    ],
    exitRules: [
      'Price reaches intrinsic value',
      'ROE drops below 10%',
      'Stop Loss: 15% below entry',
      'Better opportunity available'
    ],
    stats: { expectedReturn: '10-15%', maxDrawdown: '15-20%', winRate: '55-65%', avgHolding: '2-5 years' }
  },
  'index-fund-investing': {
    id: 'index-fund-investing',
    name: 'Index Fund Investing',
    tagline: 'Broad market index funds for diversification',
    description: 'Passive, disciplined approach using dollar-cost averaging and strategic rebalancing. Achieve market returns with minimal effort and costs.',
    riskLevel: 'Low',
    riskColor: '#22c55e',
    icon: BarChart3,
    timeframe: 'Years to Decades',
    bestFor: ['$SPY', '$VOO', '$VTI', '$QQQ', '$VXUS', '$BND'],
    keyMetrics: {
      'DCA Frequency': 'Weekly',
      'Rebalance Threshold': '5% drift',
      'Expense Ratio': '<0.10%',
      'Asset Classes': '4+'
    },
    entryRules: [
      'Dollar-cost average on fixed weekly schedule',
      'Invest regardless of market conditions',
      'Maintain target allocation across asset classes',
      '60% US Equity / 20% Intl / 15% Bonds / 5% Alts'
    ],
    exitRules: [
      'Rebalance when any class drifts 5%+',
      'Tax-loss harvest in taxable accounts',
      'No market timing - stay the course'
    ],
    stats: { expectedReturn: '7-10%', maxDrawdown: '20-35%', winRate: 'N/A', avgHolding: '10+ years' }
  },
  'day-trading': {
    id: 'day-trading',
    name: 'Day Trading',
    tagline: 'Buy/sell stocks within the same day',
    description: 'Capitalize on intraday price movements using VWAP, Opening Range Breakouts, and momentum scalping. Requires active monitoring and strict discipline.',
    riskLevel: 'High',
    riskColor: '#ef4444',
    icon: Zap,
    timeframe: 'Minutes to Hours',
    bestFor: ['$SPY', '$QQQ', '$TSLA', '$AMD', '$NVDA', '$AAPL'],
    keyMetrics: {
      'Min Volume': '1M+ daily',
      'Daily Range': '2%+ ATR',
      'Risk Per Trade': '1%',
      'Max Trades': '5/day'
    },
    entryRules: [
      'Opening Range Breakout above 15-min high with volume',
      'VWAP Trend: Long when price above VWAP',
      'Mean Reversion: Enter when 2%+ away from VWAP',
      'Volume surge 1.5x+ average on entry',
      'RSI between 55-70 for momentum'
    ],
    exitRules: [
      'Stop Loss: 0.75x ATR',
      'Take Profit: 1.5x ATR (2:1 R/R)',
      'Close all positions by 3:55 PM',
      'VWAP mean reversion: Exit at VWAP'
    ],
    stats: { expectedReturn: 'Variable', maxDrawdown: '10-30%', winRate: '40-50%', avgHolding: 'Hours' }
  },
  'momentum-trading': {
    id: 'momentum-trading',
    name: 'Momentum Trading',
    tagline: 'Ride trending stocks for quick gains',
    description: 'Follow strong price trends using MACD, RSI, and relative strength ranking. Buy high-momentum stocks and ride the wave until exhaustion signals appear.',
    riskLevel: 'High',
    riskColor: '#ef4444',
    icon: Rocket,
    timeframe: 'Days to Weeks',
    bestFor: ['$NVDA', '$TSLA', '$META', '$AMD', '$BTC', '$ETH', '$SOL'],
    keyMetrics: {
      'Min Momentum': '5%+ in 20d',
      'RSI Range': '55-75',
      'MACD': 'Bullish crossover',
      'Relative Strength': 'Top 20%'
    },
    entryRules: [
      '20-day momentum (ROC) exceeds 5%',
      'MACD line above Signal with positive histogram',
      'RSI between 55-75 (strong but not overbought)',
      'Price above 20 SMA > 50 SMA (trend aligned)',
      'Breakout to new 20-day high'
    ],
    exitRules: [
      'Stop Loss: 2x ATR below entry',
      'Take Profit: 4x ATR (2:1 R/R)',
      'RSI exceeds 80 (overbought)',
      'MACD bearish crossover'
    ],
    stats: { expectedReturn: '20-40%', maxDrawdown: '20-35%', winRate: '40-50%', avgHolding: '1-4 weeks' }
  }
};

const RiskBadge = ({ level, color }) => (
  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${color}20`, color }}>
    {level}
  </span>
);

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="bg-[#0a1628]/50 rounded-lg p-4 border border-white/5">
    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
      {Icon && <Icon size={14} strokeWidth={1.5} />}
      {label}
    </div>
    <div className="text-white font-semibold">{value}</div>
  </div>
);

const ExpandableSection = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-[#0a1628]/30 hover:bg-[#0a1628]/50 transition-colors">
        <div className="flex items-center gap-3">
          <Icon size={18} strokeWidth={1.5} className="text-blue-400" />
          <span className="font-medium text-white">{title}</span>
        </div>
        {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-4 bg-[#060d18]/50">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StrategyDetailModal = ({ strategyId, isOpen, onClose, onDeploy }) => {
  const strategy = STRATEGIES[strategyId];
  if (!strategy) return null;
  const IconComponent = strategy.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[800px] md:max-h-[85vh] bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col">
            <div className="flex items-start justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${strategy.riskColor}20` }}>
                  <IconComponent size={24} strokeWidth={1.5} style={{ color: strategy.riskColor }} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">{strategy.name}</h2>
                    <RiskBadge level={strategy.riskLevel} color={strategy.riskColor} />
                  </div>
                  <p className="text-gray-400 mt-1">{strategy.tagline}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <p className="text-gray-300 leading-relaxed">{strategy.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Expected Return" value={strategy.stats.expectedReturn} icon={TrendingUp} />
                <StatCard label="Max Drawdown" value={strategy.stats.maxDrawdown} icon={AlertTriangle} />
                <StatCard label="Win Rate" value={strategy.stats.winRate} icon={Target} />
                <StatCard label="Avg Holding" value={strategy.stats.avgHolding} icon={Clock} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Best For</h3>
                <div className="flex flex-wrap gap-2">
                  {strategy.bestFor.map((ticker) => (
                    <span key={ticker} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-mono">{ticker}</span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Key Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(strategy.keyMetrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between p-3 bg-[#060d18]/50 rounded-lg">
                      <span className="text-gray-400 text-sm">{key}</span>
                      <span className="text-white text-sm font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ExpandableSection title="Entry Rules" icon={CheckCircle} defaultOpen={true}>
                <ul className="space-y-2">
                  {strategy.entryRules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                      <span className="text-gray-300 text-sm">{rule}</span>
                    </li>
                  ))}
                </ul>
              </ExpandableSection>
              <ExpandableSection title="Exit Rules" icon={Shield}>
                <ul className="space-y-2">
                  {strategy.exitRules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                      </div>
                      <span className="text-gray-300 text-sm">{rule}</span>
                    </li>
                  ))}
                </ul>
              </ExpandableSection>
            </div>
            <div className="p-6 border-t border-white/10 bg-[#060d18]/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Clock size={14} strokeWidth={1.5} />
                  Timeframe: {strategy.timeframe}
                </div>
                <button onClick={() => { if (onDeploy) { onDeploy({ id: `template-${strategyId}-${Date.now()}`, name: strategy.name, description: strategy.tagline, type: strategy.name, riskLevel: strategy.riskLevel, isTemplate: true, status: "active", createdAt: new Date().toISOString() }); onClose(); } }} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
                  Use This Strategy
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const StrategyCard = ({ strategyId, onViewDetails }) => {
  const strategy = STRATEGIES[strategyId];
  if (!strategy) return null;
  const IconComponent = strategy.icon;

  return (
    <motion.div whileHover={{ y: -2 }} className="bg-[#0a1628] rounded-xl border border-white/10 p-6 hover:border-white/20 transition-all cursor-pointer" onClick={() => onViewDetails(strategyId)}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${strategy.riskColor}15` }}>
          <IconComponent size={20} strokeWidth={1.5} style={{ color: strategy.riskColor }} />
        </div>
        <RiskBadge level={strategy.riskLevel} color={strategy.riskColor} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{strategy.name}</h3>
      <p className="text-gray-400 text-sm mb-4">{strategy.tagline}</p>
      <button className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
        View Details
        <ArrowRight size={14} strokeWidth={1.5} />
      </button>
    </motion.div>
  );
};

const FeaturedStrategies = () => {
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const strategyIds = ['growth-investing', 'dividend-investing', 'value-investing', 'index-fund-investing', 'day-trading', 'momentum-trading'];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-emerald-400 font-semibold tracking-wide text-sm">FEATURED STRATEGIES</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/50 to-transparent" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategyIds.map((id) => (
          <StrategyCard key={id} strategyId={id} onViewDetails={setSelectedStrategy} />
        ))}
      </div>
      <StrategyDetailModal strategyId={selectedStrategy} isOpen={!!selectedStrategy} onClose={() => setSelectedStrategy(null)} />
    </div>
  );
};

export default FeaturedStrategies;
export { StrategyDetailModal, StrategyCard, STRATEGIES };
