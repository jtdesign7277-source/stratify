import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Zap } from 'lucide-react';

// ============== CONSTANTS ==============
const TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
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
  { id: 'momentum', name: 'Momentum' },
  { id: 'mean-reversion', name: 'Mean Reversion' },
  { id: 'breakout', name: 'Breakout' },
  { id: 'scalping', name: 'Scalping' },
  { id: 'swing', name: 'Swing' },
  { id: 'trend', name: 'Trend Following' },
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

// ============== DROPDOWN COMPONENT ==============
const Dropdown = ({ label, value, options, onChange, placeholder, searchable = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filteredOptions = useMemo(() => {
    if (!searchable || !search) return options;
    return options.filter(opt => 
      (opt.name || opt.symbol || opt.label || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search, searchable]);

  const displayValue = options.find(o => (o.id || o.symbol) === value);

  return (
    <div className="relative">
      <label className="text-gray-400 text-[10px] font-semibold mb-1.5 block tracking-widest uppercase">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-[#111118] border border-gray-800 rounded-lg text-left flex items-center justify-between hover:border-emerald-500/50 hover:bg-white/5 transition-all duration-200"
      >
        <span className={displayValue ? 'text-white' : 'text-gray-500'}>
          {displayValue ? (displayValue.name || displayValue.symbol || displayValue.label) : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#0d0d12] border border-gray-800 rounded-lg shadow-xl overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-gray-800">
              <div className="flex items-center gap-2 bg-[#111118] border border-gray-700 rounded-lg px-2 py-1.5">
                <Search className="w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map(opt => (
              <button
                key={opt.id || opt.symbol}
                onClick={() => { onChange(opt.id || opt.symbol); setIsOpen(false); setSearch(''); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-500/10 transition-colors flex items-center justify-between"
              >
                <span className="text-white">{opt.name || opt.symbol || opt.label}</span>
                {opt.symbol && <span className="text-gray-500 text-xs">${opt.symbol}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============== MAIN COMPONENT ==============
const StrategyBuilderV1 = ({ onGenerate }) => {
  const [ticker, setTicker] = useState('');
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

  const backtestPeriod = useMemo(() => {
    const tf = TIMEFRAMES.find(t => t.id === timeframe);
    return tf?.backtest || 'Select timeframe';
  }, [timeframe]);

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

  return (
    <div className="w-80 h-full bg-[#0d0d12] border-l border-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-emerald-400" />
        </div>
        <span className="text-white font-semibold">Strategy Builder</span>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Ticker */}
        <Dropdown
          label="Ticker"
          value={ticker}
          options={TICKERS}
          onChange={setTicker}
          placeholder="Select ticker..."
          searchable
        />

        {/* Indicator */}
        <Dropdown
          label="Indicator"
          value={indicator}
          options={INDICATORS}
          onChange={setIndicator}
          placeholder="Select indicator..."
        />

        {/* Strategy Type */}
        <Dropdown
          label="Strategy Type"
          value={strategyType}
          options={STRATEGY_TYPES}
          onChange={setStrategyType}
          placeholder="Select strategy..."
        />

        {/* Timeframe */}
        <div>
          <label className="text-gray-400 text-[10px] font-semibold mb-1.5 block tracking-widest uppercase">Timeframe</label>
          <div className="flex gap-1">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                  timeframe === tf.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'bg-[#111118] text-gray-300 border border-gray-800 hover:border-emerald-500/50 hover:bg-white/5'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Backtest Period (auto) */}
        <div>
          <label className="text-gray-400 text-[10px] font-semibold mb-1.5 block tracking-widest uppercase">Backtest Period</label>
          <div className="px-3 py-2 bg-[#111118] border border-gray-800 rounded-lg text-gray-400 text-sm">
            {backtestPeriod} <span className="text-gray-600">(auto)</span>
          </div>
        </div>

        {/* Risk Level */}
        <div>
          <label className="text-gray-400 text-[10px] font-semibold mb-1.5 block tracking-widest uppercase">Risk Level</label>
          <div className="space-y-1">
            {RISK_LEVELS.map(risk => (
              <label
                key={risk.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  riskLevel === risk.id
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : 'bg-[#111118] border border-gray-800 hover:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="riskLevel"
                  checked={riskLevel === risk.id}
                  onChange={() => setRiskLevel(risk.id)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  riskLevel === risk.id ? 'border-emerald-400' : 'border-gray-600'
                }`}>
                  {riskLevel === risk.id && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                </div>
                <span className="text-white text-sm flex-1">{risk.name}</span>
                <span className="text-gray-500 text-xs">{risk.percent}/trade</span>
              </label>
            ))}
          </div>
        </div>

        {/* Position Size */}
        <Dropdown
          label="Position Size"
          value={positionSize}
          options={POSITION_SIZES.map(p => ({ id: p, name: p }))}
          onChange={setPositionSize}
          placeholder="Select size..."
        />

        {/* Stop Loss */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stopLossEnabled}
              onChange={(e) => setStopLossEnabled(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              stopLossEnabled ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
            }`}>
              {stopLossEnabled && <span className="text-white text-xs">✓</span>}
            </div>
            <span className="text-gray-400 text-[10px] font-semibold tracking-widest uppercase">Stop Loss</span>
          </label>
          {stopLossEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-20 px-2 py-1.5 bg-[#111118] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              />
              <span className="text-gray-500 text-sm">%</span>
            </div>
          )}
        </div>

        {/* Take Profit */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={takeProfitEnabled}
              onChange={(e) => setTakeProfitEnabled(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              takeProfitEnabled ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
            }`}>
              {takeProfitEnabled && <span className="text-white text-xs">✓</span>}
            </div>
            <span className="text-gray-400 text-[10px] font-semibold tracking-widest uppercase">Take Profit</span>
          </label>
          {takeProfitEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-20 px-2 py-1.5 bg-[#111118] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              />
              <span className="text-gray-500 text-sm">%</span>
            </div>
          )}
        </div>

        {/* Paper/Live Toggle */}
        <div>
          <label className="text-gray-400 text-[10px] font-semibold mb-1.5 block tracking-widest uppercase">Mode</label>
          <div className="flex gap-1">
            <button
              onClick={() => setIsPaper(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isPaper
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-[#111118] text-gray-400 border border-gray-800 hover:border-gray-700'
              }`}
            >
              📄 Paper
            </button>
            <button
              onClick={() => setIsPaper(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                !isPaper
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-[#111118] text-gray-400 border border-gray-800 hover:border-gray-700'
              }`}
            >
              💰 Live
            </button>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleGenerate}
          disabled={!isValid}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isValid
              ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          🟢 Generate Strategy
        </button>
      </div>
    </div>
  );
};

export default StrategyBuilderV1;
