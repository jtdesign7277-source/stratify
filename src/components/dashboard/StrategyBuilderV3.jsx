import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Zap, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';

// ============== CONSTANTS ==============
const TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 189.72, change: 2.34 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 878.35, change: -1.2 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: 3.45 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 415.80, change: 0.89 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 141.25, change: -0.56 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.90, change: 1.23 },
  { symbol: 'META', name: 'Meta Platforms', price: 505.75, change: 2.1 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 502.45, change: 0.45 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 438.20, change: 0.78 },
  { symbol: 'BTC', name: 'Bitcoin', price: 43250.00, change: -2.1 },
  { symbol: 'ETH', name: 'Ethereum', price: 2280.50, change: 1.5 },
];

const INDICATORS = [
  { id: 'rsi', name: 'RSI' },
  { id: 'macd', name: 'MACD' },
  { id: 'bollinger', name: 'Bollinger Bands' },
  { id: 'ema', name: 'EMA Crossover' },
  { id: 'vwap', name: 'VWAP' },
  { id: 'stochastic', name: 'Stochastic' },
  { id: 'atr', name: 'ATR' },
];

const STRATEGY_TYPES = [
  { id: 'momentum', name: 'Momentum', icon: '🚀' },
  { id: 'mean-reversion', name: 'Mean Reversion', icon: '🔄' },
  { id: 'breakout', name: 'Breakout', icon: '💥' },
  { id: 'scalping', name: 'Scalping', icon: '⚡' },
  { id: 'swing', name: 'Swing', icon: '🌊' },
  { id: 'trend', name: 'Trend Following', icon: '📈' },
];

const TIMEFRAMES = [
  { id: '1m', label: '1m', backtest: '1 week' },
  { id: '5m', label: '5m', backtest: '1 week' },
  { id: '15m', label: '15m', backtest: '1 month' },
  { id: '1h', label: '1h', backtest: '3 months' },
  { id: '4h', label: '4h', backtest: '6 months' },
  { id: '1D', label: '1D', backtest: '1 year' },
];

const RISK_LEVELS = [
  { id: 'conservative', name: 'Conservative', percent: '1%' },
  { id: 'moderate', name: 'Moderate', percent: '2%' },
  { id: 'aggressive', name: 'Aggressive', percent: '5%' },
];

const POSITION_SIZES = ['5%', '10%', '25%', '50%'];

// ============== MINI CHART COMPONENT ==============
const MiniChart = ({ data, positive }) => {
  const points = data || [40, 45, 42, 55, 48, 60, 58, 65, 62, 70, 68, 75];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  
  const pathData = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 100 - ((p - min) / range) * 100;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={pathData + ` L 100 100 L 0 100 Z`}
        fill={`url(#gradient-${positive ? 'up' : 'down'})`}
      />
      <path
        d={pathData}
        fill="none"
        stroke={positive ? '#10b981' : '#ef4444'}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

// ============== DROPDOWN COMPONENT ==============
const Dropdown = ({ label, value, options, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const displayValue = options.find(o => (o.id || o.symbol) === value);

  return (
    <div className="relative">
      <label className="text-gray-400 text-[10px] font-semibold mb-1 block tracking-widest uppercase">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-[#111111] border border-[#1f1f1f] rounded-lg text-left flex items-center justify-between hover:border-emerald-500/50 transition-all text-sm"
      >
        <span className={displayValue ? 'text-white' : 'text-white/50'}>
          {displayValue ? (displayValue.name || displayValue.icon + ' ' + displayValue.name || displayValue.label) : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-white/50" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#0b0b0b] border border-[#1f1f1f] rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-40 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.id || opt.symbol}
                onClick={() => { onChange(opt.id || opt.symbol); setIsOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-emerald-500/10 transition-colors"
              >
                {opt.icon && <span className="mr-2">{opt.icon}</span>}
                {opt.name || opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============== MAIN COMPONENT ==============
const StrategyBuilderV3 = ({ onGenerate }) => {
  const [ticker, setTicker] = useState('');
  const [tickerSearch, setTickerSearch] = useState('');
  const [indicator, setIndicator] = useState('');
  const [strategyType, setStrategyType] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [riskLevel, setRiskLevel] = useState('moderate');
  const [positionSize, setPositionSize] = useState('10%');
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState('2');
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfit, setTakeProfit] = useState('5');
  const [isPaper, setIsPaper] = useState(true);

  const selectedTicker = TICKERS.find(t => t.symbol === ticker);
  const selectedIndicator = INDICATORS.find(i => i.id === indicator);
  const selectedStrategy = STRATEGY_TYPES.find(s => s.id === strategyType);
  const selectedTimeframe = TIMEFRAMES.find(t => t.id === timeframe);
  const selectedRisk = RISK_LEVELS.find(r => r.id === riskLevel);

  const backtestPeriod = selectedTimeframe?.backtest || '';

  const filteredTickers = useMemo(() => {
    if (!tickerSearch) return TICKERS;
    return TICKERS.filter(t => 
      t.symbol.toLowerCase().includes(tickerSearch.toLowerCase()) ||
      t.name.toLowerCase().includes(tickerSearch.toLowerCase())
    );
  }, [tickerSearch]);

  const handleGenerate = () => {
    onGenerate?.({
      ticker, indicator, strategyType, timeframe, backtestPeriod,
      riskLevel, positionSize,
      stopLoss: stopLossEnabled ? stopLoss : null,
      takeProfit: takeProfitEnabled ? takeProfit : null,
      mode: isPaper ? 'paper' : 'live'
    });
  };

  const isValid = ticker && indicator && strategyType && timeframe;

  // Calculate mock strategy metrics
  const mockMetrics = useMemo(() => {
    if (!isValid) return null;
    const riskPercent = selectedRisk?.percent === '1%' ? 1 : selectedRisk?.percent === '2%' ? 2 : 5;
    return {
      winRate: 58 + Math.floor(Math.random() * 15),
      avgReturn: (riskPercent * 1.5 + Math.random() * 2).toFixed(1),
      sharpe: (1.2 + Math.random() * 0.8).toFixed(2),
      maxDrawdown: (riskPercent * 2 + Math.random() * 3).toFixed(1),
      trades: Math.floor(Math.random() * 100 + 50),
    };
  }, [isValid, selectedRisk]);

  return (
    <div className="flex h-full bg-[#0b0b0b]">
      {/* Left Panel - Form */}
      <div className="w-80 border-r border-[#1f1f1f] flex flex-col overflow-hidden bg-[#0b0b0b]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1f1f1f] flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-white font-semibold">Strategy Builder</span>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Ticker Search */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold mb-1 block tracking-widest uppercase">Ticker</label>
            <div className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-lg px-2 py-1.5 mb-1">
              <Search className="w-4 h-4 text-white/50" />
              <input
                type="text"
                value={tickerSearch}
                onChange={(e) => setTickerSearch(e.target.value.toUpperCase())}
                placeholder="Search..."
                className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {filteredTickers.slice(0, 8).map(t => (
                <button
                  key={t.symbol}
                  onClick={() => { setTicker(t.symbol); setTickerSearch(''); }}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                    ticker === t.symbol
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#111111] text-gray-300 border border-[#1f1f1f] hover:border-emerald-500/30'
                  }`}
                >
                  ${t.symbol}
                </button>
              ))}
            </div>
          </div>

          <Dropdown label="Indicator" value={indicator} options={INDICATORS} onChange={setIndicator} placeholder="Select..." />
          <Dropdown label="Strategy Type" value={strategyType} options={STRATEGY_TYPES} onChange={setStrategyType} placeholder="Select..." />

          {/* Timeframe */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold mb-1 block tracking-widest uppercase">Timeframe</label>
            <div className="flex gap-1">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    timeframe === tf.id
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#111111] text-gray-300 border border-[#1f1f1f] hover:border-emerald-500/30'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold mb-1 block tracking-widest uppercase">Risk Level</label>
            <div className="flex gap-1">
              {RISK_LEVELS.map(risk => (
                <button
                  key={risk.id}
                  onClick={() => setRiskLevel(risk.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                    riskLevel === risk.id
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#111111] text-gray-300 border border-[#1f1f1f] hover:border-emerald-500/30'
                  }`}
                >
                  {risk.percent}
                </button>
              ))}
            </div>
          </div>

          {/* Position Size */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold mb-1 block tracking-widest uppercase">Position Size</label>
            <div className="flex gap-1">
              {POSITION_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setPositionSize(size)}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                    positionSize === size
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#111111] text-gray-300 border border-[#1f1f1f] hover:border-emerald-500/30'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Stop Loss & Take Profit */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-[#111111] border border-[#1f1f1f] rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={stopLossEnabled}
                  onChange={(e) => setStopLossEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  stopLossEnabled ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                }`}>
                  {stopLossEnabled && <span className="text-white text-[10px]">✓</span>}
                </div>
                <span className="text-gray-400">SL {stopLoss}%</span>
              </label>
            </div>
            <div className="p-2 bg-[#111111] border border-[#1f1f1f] rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={takeProfitEnabled}
                  onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  takeProfitEnabled ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                }`}>
                  {takeProfitEnabled && <span className="text-white text-[10px]">✓</span>}
                </div>
                <span className="text-gray-400">TP {takeProfit}%</span>
              </label>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setIsPaper(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                isPaper
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-[#111111] text-gray-400 border border-[#1f1f1f]'
              }`}
            >
              📄 Paper
            </button>
            <button
              onClick={() => setIsPaper(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                !isPaper
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-[#111111] text-gray-400 border border-[#1f1f1f]'
              }`}
            >
              💰 Live
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-[#1f1f1f]">
          <button
            onClick={handleGenerate}
            disabled={!isValid}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              isValid
                ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5'
                : 'bg-gray-800 text-white/50 cursor-not-allowed'
            }`}
          >
            🟢 Generate Strategy
          </button>
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Ticker Card */}
        {selectedTicker ? (
          <div className="mb-6 p-6 bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-white/50 text-sm">{selectedTicker.name}</div>
                <div className="text-white text-3xl font-bold">${selectedTicker.symbol}</div>
              </div>
              <div className="text-right">
                <div className="text-white text-2xl font-semibold">${selectedTicker.price.toLocaleString()}</div>
                <div className={`flex items-center gap-1 justify-end ${selectedTicker.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTicker.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{selectedTicker.change >= 0 ? '+' : ''}{selectedTicker.change}%</span>
                </div>
              </div>
            </div>
            <MiniChart positive={selectedTicker.change >= 0} />
          </div>
        ) : (
          <div className="mb-6 p-12 bg-[#0b0b0b] border border-[#1f1f1f] border-dashed rounded-2xl flex items-center justify-center">
            <div className="text-white/50 text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <div>Select a ticker to see preview</div>
            </div>
          </div>
        )}

        {/* Strategy Summary */}
        {isValid ? (
          <>
            <h3 className="text-white text-lg font-semibold mb-4">Strategy Preview</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Strategy</div>
                <div className="text-white font-semibold">
                  {selectedStrategy?.icon} {selectedStrategy?.name}
                </div>
              </div>
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Indicator</div>
                <div className="text-white font-semibold">{selectedIndicator?.name}</div>
              </div>
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Timeframe</div>
                <div className="text-white font-semibold">{selectedTimeframe?.label}</div>
              </div>
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Backtest</div>
                <div className="text-white font-semibold">{backtestPeriod}</div>
              </div>
            </div>

            {/* Mock Backtest Results */}
            <h3 className="text-white text-lg font-semibold mb-4">Estimated Performance</h3>
            <div className="grid grid-cols-5 gap-3">
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl text-center">
                <div className="text-emerald-400 text-2xl font-bold">{mockMetrics?.winRate}%</div>
                <div className="text-white/50 text-xs">Win Rate</div>
              </div>
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl text-center">
                <div className="text-emerald-400 text-2xl font-bold">+{mockMetrics?.avgReturn}%</div>
                <div className="text-white/50 text-xs">Avg Return</div>
              </div>
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl text-center">
                <div className="text-cyan-400 text-2xl font-bold">{mockMetrics?.sharpe}</div>
                <div className="text-white/50 text-xs">Sharpe</div>
              </div>
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl text-center">
                <div className="text-red-400 text-2xl font-bold">-{mockMetrics?.maxDrawdown}%</div>
                <div className="text-white/50 text-xs">Max DD</div>
              </div>
              <div className="p-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl text-center">
                <div className="text-white text-2xl font-bold">{mockMetrics?.trades}</div>
                <div className="text-white/50 text-xs">Trades</div>
              </div>
            </div>

            {/* Equity Curve Placeholder */}
            <div className="mt-6 p-6 bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl">
              <div className="text-white/50 text-sm mb-4">Simulated Equity Curve</div>
              <div className="h-32">
                <MiniChart positive data={[100, 102, 101, 105, 103, 108, 110, 109, 115, 113, 120, 118, 125]} />
              </div>
            </div>
          </>
        ) : (
          <div className="p-12 bg-[#0b0b0b] border border-[#1f1f1f] border-dashed rounded-2xl flex items-center justify-center">
            <div className="text-white/50 text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <div>Complete the form to see strategy preview</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyBuilderV3;
