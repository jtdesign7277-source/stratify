import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChevronDown, Zap, ChevronRight, ChevronLeft } from 'lucide-react';

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
  { id: 'rsi', name: 'RSI', description: 'Relative Strength Index - momentum oscillator' },
  { id: 'macd', name: 'MACD', description: 'Moving Average Convergence Divergence' },
  { id: 'bollinger', name: 'Bollinger Bands', description: 'Volatility bands around SMA' },
  { id: 'ema', name: 'EMA Crossover', description: 'Exponential moving average crossovers' },
  { id: 'vwap', name: 'VWAP', description: 'Volume Weighted Average Price' },
  { id: 'stochastic', name: 'Stochastic', description: 'Momentum indicator comparing close to range' },
  { id: 'atr', name: 'ATR', description: 'Average True Range - volatility measure' },
];

const STRATEGY_TYPES = [
  { id: 'momentum', name: 'Momentum', icon: '🚀', description: 'Ride the trend' },
  { id: 'mean-reversion', name: 'Mean Reversion', icon: '🔄', description: 'Buy dips, sell rips' },
  { id: 'breakout', name: 'Breakout', icon: '💥', description: 'Trade range breaks' },
  { id: 'scalping', name: 'Scalping', icon: '⚡', description: 'Quick in-and-out' },
  { id: 'swing', name: 'Swing', icon: '🌊', description: 'Multi-day holds' },
  { id: 'trend', name: 'Trend Following', icon: '📈', description: 'Follow the flow' },
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
  { id: 'conservative', name: 'Conservative', percent: '1%', color: 'emerald' },
  { id: 'moderate', name: 'Moderate', percent: '2%', color: 'amber' },
  { id: 'aggressive', name: 'Aggressive', percent: '5%', color: 'red' },
];

const POSITION_SIZES = ['5%', '10%', '25%', '50%'];

const STEPS = [
  { id: 1, name: 'Asset', description: 'Choose what to trade' },
  { id: 2, name: 'Strategy', description: 'Pick your approach' },
  { id: 3, name: 'Timing', description: 'Set your timeframe' },
  { id: 4, name: 'Risk', description: 'Manage your exposure' },
  { id: 5, name: 'Review', description: 'Confirm and generate' },
];

// ============== MAIN COMPONENT ==============
const StrategyBuilderV2 = ({ isOpen, onClose, onGenerate }) => {
  const [step, setStep] = useState(1);
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

  const backtestPeriod = useMemo(() => {
    const tf = TIMEFRAMES.find(t => t.id === timeframe);
    return tf?.backtest || '';
  }, [timeframe]);

  const filteredTickers = useMemo(() => {
    if (!tickerSearch) return TICKERS;
    return TICKERS.filter(t => 
      t.symbol.toLowerCase().includes(tickerSearch.toLowerCase()) ||
      t.name.toLowerCase().includes(tickerSearch.toLowerCase())
    );
  }, [tickerSearch]);

  const canProceed = () => {
    switch (step) {
      case 1: return ticker;
      case 2: return indicator && strategyType;
      case 3: return timeframe;
      case 4: return riskLevel && positionSize;
      case 5: return true;
      default: return false;
    }
  };

  const handleGenerate = () => {
    onGenerate?.({
      ticker, indicator, strategyType, timeframe, backtestPeriod,
      riskLevel, positionSize,
      stopLoss: stopLossEnabled ? stopLoss : null,
      takeProfit: takeProfitEnabled ? takeProfit : null,
      mode: isPaper ? 'paper' : 'live'
    });
    onClose?.();
  };

  const selectedTicker = TICKERS.find(t => t.symbol === ticker);
  const selectedIndicator = INDICATORS.find(i => i.id === indicator);
  const selectedStrategy = STRATEGY_TYPES.find(s => s.id === strategyType);
  const selectedTimeframe = TIMEFRAMES.find(t => t.id === timeframe);
  const selectedRisk = RISK_LEVELS.find(r => r.id === riskLevel);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-2xl bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#1f1f1f] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">Strategy Builder</h2>
                  <p className="text-white/50 text-sm">Step {step} of {STEPS.length}: {STEPS[step-1].name}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="px-6 py-3 border-b border-[#1f1f1f]">
              <div className="flex gap-2">
                {STEPS.map((s) => (
                  <div key={s.id} className="flex-1">
                    <div className={`h-1 rounded-full transition-colors ${
                      s.id <= step ? 'bg-emerald-500' : 'bg-gray-800'
                    }`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 min-h-[400px]">
              <AnimatePresence mode="wait">
                {/* Step 1: Asset */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="text-white text-xl font-semibold">What do you want to trade?</h3>
                    <div className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-2">
                      <Search className="w-5 h-5 text-white/50" />
                      <input
                        type="text"
                        value={tickerSearch}
                        onChange={(e) => setTickerSearch(e.target.value.toUpperCase())}
                        placeholder="Search ticker..."
                        className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {filteredTickers.map(t => (
                        <button
                          key={t.symbol}
                          onClick={() => setTicker(t.symbol)}
                          className={`p-3 rounded-xl text-left transition-all duration-200 hover:-translate-y-0.5 ${
                            ticker === t.symbol
                              ? 'bg-emerald-500/20 border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : 'bg-[#111111] border border-[#1f1f1f] hover:border-emerald-500/30 hover:bg-white/5'
                          }`}
                        >
                          <div className="text-white font-semibold">${t.symbol}</div>
                          <div className="text-white/50 text-xs truncate">{t.name}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Strategy */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-white text-xl font-semibold mb-4">Choose your indicator</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {INDICATORS.map(ind => (
                          <button
                            key={ind.id}
                            onClick={() => setIndicator(ind.id)}
                            className={`p-3 rounded-xl text-left transition-all duration-200 hover:-translate-y-0.5 ${
                              indicator === ind.id
                                ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
                                : 'bg-[#111111] border border-[#1f1f1f] hover:border-emerald-500/30'
                            }`}
                          >
                            <div className="text-white font-medium">{ind.name}</div>
                            <div className="text-white/50 text-xs">{ind.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-white text-xl font-semibold mb-4">Pick your strategy type</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {STRATEGY_TYPES.map(st => (
                          <button
                            key={st.id}
                            onClick={() => setStrategyType(st.id)}
                            className={`p-3 rounded-xl text-center transition-all duration-200 hover:-translate-y-0.5 ${
                              strategyType === st.id
                                ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
                                : 'bg-[#111111] border border-[#1f1f1f] hover:border-emerald-500/30'
                            }`}
                          >
                            <div className="text-2xl mb-1">{st.icon}</div>
                            <div className="text-white font-medium text-sm">{st.name}</div>
                            <div className="text-white/50 text-xs">{st.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Timing */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-white text-xl font-semibold">Select your timeframe</h3>
                    <div className="grid grid-cols-6 gap-2">
                      {TIMEFRAMES.map(tf => (
                        <button
                          key={tf.id}
                          onClick={() => setTimeframe(tf.id)}
                          className={`py-4 rounded-xl text-center transition-all duration-200 hover:-translate-y-0.5 ${
                            timeframe === tf.id
                              ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
                              : 'bg-[#111111] border border-[#1f1f1f] hover:border-emerald-500/30'
                          }`}
                        >
                          <div className="text-white font-semibold text-lg">{tf.label}</div>
                        </button>
                      ))}
                    </div>
                    {timeframe && (
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <div className="text-gray-400 text-sm">Backtest period (auto-calculated)</div>
                        <div className="text-white text-lg font-semibold">{backtestPeriod}</div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Risk */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-white text-xl font-semibold mb-4">Risk per trade</h3>
                      <div className="flex gap-2">
                        {RISK_LEVELS.map(risk => (
                          <button
                            key={risk.id}
                            onClick={() => setRiskLevel(risk.id)}
                            className={`flex-1 p-4 rounded-xl text-center transition-all duration-200 hover:-translate-y-0.5 ${
                              riskLevel === risk.id
                                ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
                                : 'bg-[#111111] border border-[#1f1f1f] hover:border-emerald-500/30'
                            }`}
                          >
                            <div className="text-white font-semibold">{risk.name}</div>
                            <div className="text-emerald-400 text-xl font-bold">{risk.percent}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-white text-xl font-semibold mb-4">Position size</h3>
                      <div className="flex gap-2">
                        {POSITION_SIZES.map(size => (
                          <button
                            key={size}
                            onClick={() => setPositionSize(size)}
                            className={`flex-1 py-3 rounded-xl text-center transition-all ${
                              positionSize === size
                                ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400'
                                : 'bg-[#111111] border border-[#1f1f1f] text-gray-300 hover:border-emerald-500/30'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={stopLossEnabled}
                            onChange={(e) => setStopLossEnabled(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            stopLossEnabled ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                          }`}>
                            {stopLossEnabled && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="text-white font-medium">Stop Loss</span>
                        </label>
                        {stopLossEnabled && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={stopLoss}
                              onChange={(e) => setStopLoss(e.target.value)}
                              className="w-20 px-2 py-1.5 bg-[#0b0b0b] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-white/50">%</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={takeProfitEnabled}
                            onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            takeProfitEnabled ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                          }`}>
                            {takeProfitEnabled && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="text-white font-medium">Take Profit</span>
                        </label>
                        {takeProfitEnabled && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={takeProfit}
                              onChange={(e) => setTakeProfit(e.target.value)}
                              className="w-20 px-2 py-1.5 bg-[#0b0b0b] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-white/50">%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Review */}
                {step === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="text-white text-xl font-semibold">Review your strategy</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <div className="text-white/50 text-xs uppercase tracking-wider">Ticker</div>
                        <div className="text-white font-semibold">${selectedTicker?.symbol}</div>
                        <div className="text-gray-400 text-sm">{selectedTicker?.name}</div>
                      </div>
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <div className="text-white/50 text-xs uppercase tracking-wider">Indicator</div>
                        <div className="text-white font-semibold">{selectedIndicator?.name}</div>
                      </div>
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <div className="text-white/50 text-xs uppercase tracking-wider">Strategy</div>
                        <div className="text-white font-semibold">{selectedStrategy?.icon} {selectedStrategy?.name}</div>
                      </div>
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <div className="text-white/50 text-xs uppercase tracking-wider">Timeframe</div>
                        <div className="text-white font-semibold">{selectedTimeframe?.label}</div>
                        <div className="text-gray-400 text-sm">Backtest: {backtestPeriod}</div>
                      </div>
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <div className="text-white/50 text-xs uppercase tracking-wider">Risk</div>
                        <div className="text-white font-semibold">{selectedRisk?.name} ({selectedRisk?.percent})</div>
                        <div className="text-gray-400 text-sm">Position: {positionSize}</div>
                      </div>
                      <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                        <div className="text-white/50 text-xs uppercase tracking-wider">Mode</div>
                        <div className={`font-semibold ${isPaper ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isPaper ? '📄 Paper Trading' : '💰 Live Trading'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setIsPaper(true)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          isPaper
                            ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/50'
                            : 'bg-[#111111] text-gray-400 border border-[#1f1f1f]'
                        }`}
                      >
                        📄 Paper
                      </button>
                      <button
                        onClick={() => setIsPaper(false)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          !isPaper
                            ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50'
                            : 'bg-[#111111] text-gray-400 border border-[#1f1f1f]'
                        }`}
                      >
                        💰 Live
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#1f1f1f] flex items-center justify-between">
              <button
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  step === 1
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              {step < 5 ? (
                <button
                  onClick={() => setStep(s => Math.min(5, s + 1))}
                  disabled={!canProceed()}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                    canProceed()
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : 'bg-gray-800 text-white/50 cursor-not-allowed'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  className="px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 transition-all"
                >
                  🟢 Generate Strategy
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StrategyBuilderV2;
