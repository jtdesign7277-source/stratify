import { useState } from 'react';

const TICKERS = ['TSLA', 'NVDA', 'QQQ', 'AAPL', 'AMZN', 'MSFT', 'META', 'GOOG', 'SPY', 'AMD'];

const CHART_INTERVALS = [
  { label: '1 Min', value: '1m' },
  { label: '5 Min', value: '5m' },
  { label: '15 Min', value: '15m' },
  { label: '30 Min', value: '30m' },
  { label: '1 Hour', value: '1H' },
  { label: '4 Hour', value: '4H' },
  { label: 'Daily', value: '1D' },
];

const TIMEFRAMES = [
  { label: '1 Week', value: '1W' },
  { label: '2 Weeks', value: '2W' },
  { label: '1 Month', value: '1M' },
  { label: '3 Months', value: '3M' },
  { label: '6 Months', value: '6M' },
];

const STRATEGIES = [
  { name: 'Momentum Trend', desc: 'Buy when price crosses above 20 EMA and RSI(14) > 50. Sell when price drops below 20 EMA or RSI < 40.', icon: '📈' },
  { name: 'RSI Bounce', desc: 'Buy when RSI(14) drops below 30 (oversold). Sell when RSI(14) rises above 55.', icon: '🔄' },
  { name: 'MACD Crossover', desc: 'Buy when MACD line crosses above signal line below zero. Sell when MACD crosses below signal.', icon: '⚡' },
  { name: 'Bollinger Squeeze', desc: 'Buy when price breaks above upper Bollinger Band after a squeeze. Sell at middle band or 2% trailing stop.', icon: '🎯' },
  { name: 'VWAP Reversion', desc: 'Buy when price drops 1.5% below VWAP with increasing volume. Sell when price returns to VWAP.', icon: '🌊' },
];

const STEPS = ['ticker', 'interval', 'timeframe', 'strategy', 'amount', 'review'];
const STEP_LABELS = ['Ticker', 'Chart', 'Lookback', 'Strategy', 'Amount', 'Review'];

function Pill({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border text-[13px] font-medium transition ${
        selected
          ? 'border-emerald-500 bg-emerald-500/[0.12] text-emerald-400 font-bold'
          : 'border-[#2a2a2a] bg-[#141414] text-white/40 hover:border-[#3a3a3a] hover:text-white/70'
      }`}
    >
      {children}
    </button>
  );
}

export default function BacktestWizard({ onSubmit, onClose, inline }) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    ticker: '',
    interval: '',
    timeframe: '',
    strategy: null,
    amount: '',
  });

  const currentKey = STEPS[step];
  const canProceed =
    (currentKey === 'ticker' && config.ticker !== '') ||
    (currentKey === 'interval' && config.interval !== '') ||
    (currentKey === 'timeframe' && config.timeframe !== '') ||
    (currentKey === 'strategy' && config.strategy !== null) ||
    (currentKey === 'amount' && Number(config.amount) >= 100) ||
    currentKey === 'review';

  const handleNext = () => { if (step < STEPS.length - 1 && canProceed) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const selectedStrategy = config.strategy !== null ? STRATEGIES[config.strategy] : null;
  const intervalLabel = CHART_INTERVALS.find((c) => c.value === config.interval)?.label ?? config.interval;
  const timeframeLabel = TIMEFRAMES.find((t) => t.value === config.timeframe)?.label ?? config.timeframe;

  const handleSubmit = () => {
    const prompt = `Ticker: $${config.ticker}\nChart: ${intervalLabel} candles\nTimeframe: ${timeframeLabel} lookback\nLogic: ${selectedStrategy?.desc ?? 'Custom'}\nBacktest amount: $${Number(config.amount).toLocaleString()}`;
    onSubmit(prompt);
    if (onClose) onClose();
  };

  const Wrapper = inline ? 'div' : 'div';
  const wrapperClass = inline
    ? 'flex flex-col h-full overflow-hidden'
    : 'flex-1 flex items-center justify-center bg-[#0a0a0a]';
  const innerClass = inline
    ? 'flex flex-col h-full overflow-hidden'
    : 'w-full max-w-[460px] rounded-2xl border border-emerald-500/[0.15] bg-gradient-to-b from-[#111111] to-[#0a0a0a] shadow-2xl shadow-black/60 overflow-hidden';

  return (
    <div className={wrapperClass}>
      <div className={innerClass}>
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-[#1f1f1f]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400 uppercase">Backtest Builder</span>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.05] transition text-white/30 hover:text-white/60">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <h2 className="text-lg font-bold text-white mt-1">Build Your Strategy</h2>

          {/* Step indicator */}
          <div className="flex gap-1 mt-4">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                <div className={`h-[3px] w-full rounded-full transition-colors ${i <= step ? 'bg-emerald-400' : 'bg-[#1f1f1f]'}`} />
                <span className={`text-[9px] font-medium uppercase tracking-wide transition-colors ${
                  i <= step ? 'text-emerald-400' : 'text-white/20'
                } ${i === step ? 'font-bold' : ''}`}>
                  {STEP_LABELS[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className={`px-6 py-5 ${inline ? 'flex-1 overflow-y-auto' : 'min-h-[260px]'}`}>
          {/* Ticker */}
          {currentKey === 'ticker' && (
            <div>
              <p className="text-[13px] text-white/30 mb-3">Select a ticker to backtest</p>
              <div className="flex flex-wrap gap-2">
                {TICKERS.map((t) => (
                  <Pill key={t} selected={config.ticker === t} onClick={() => setConfig({ ...config, ticker: t })}>${t}</Pill>
                ))}
              </div>
            </div>
          )}

          {/* Interval */}
          {currentKey === 'interval' && (
            <div>
              <p className="text-[13px] text-white/30 mb-3">Choose chart interval</p>
              <div className="flex flex-wrap gap-2">
                {CHART_INTERVALS.map((ci) => (
                  <Pill key={ci.value} selected={config.interval === ci.value} onClick={() => setConfig({ ...config, interval: ci.value })}>{ci.label}</Pill>
                ))}
              </div>
            </div>
          )}

          {/* Timeframe */}
          {currentKey === 'timeframe' && (
            <div>
              <p className="text-[13px] text-white/30 mb-3">How far back to test?</p>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAMES.map((tf) => (
                  <Pill key={tf.value} selected={config.timeframe === tf.value} onClick={() => setConfig({ ...config, timeframe: tf.value })}>{tf.label}</Pill>
                ))}
              </div>
            </div>
          )}

          {/* Strategy */}
          {currentKey === 'strategy' && (
            <div>
              <p className="text-[13px] text-white/30 mb-3">Pick a trading strategy</p>
              <div className="flex flex-col gap-2">
                {STRATEGIES.map((s, i) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setConfig({ ...config, strategy: i })}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      config.strategy === i
                        ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
                        : 'border-[#1f1f1f] bg-[#0e0e0e] hover:border-[#2a2a2a]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{s.icon}</span>
                      <span className={`text-[13px] font-bold ${config.strategy === i ? 'text-emerald-400' : 'text-white'}`}>{s.name}</span>
                    </div>
                    <p className="text-[11px] text-white/30 leading-relaxed ml-7">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount */}
          {currentKey === 'amount' && (
            <div>
              <p className="text-[13px] text-white/30 mb-3">Enter backtest amount</p>
              <div className="flex items-center rounded-xl border border-[#2a2a2a] bg-[#111111] px-4 mb-3">
                <span className="text-emerald-400 text-xl font-bold mr-1">$</span>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  placeholder="10,000"
                  value={config.amount}
                  onChange={(e) => setConfig({ ...config, amount: e.target.value })}
                  className="flex-1 bg-transparent border-0 outline-none text-white text-xl font-bold py-3 placeholder:text-white/20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[1000, 5000, 10000, 25000, 50000].map((v) => (
                  <Pill key={v} selected={Number(config.amount) === v} onClick={() => setConfig({ ...config, amount: String(v) })}>${v.toLocaleString()}</Pill>
                ))}
              </div>
              <p className="text-[11px] text-white/20 mt-3">Min $100 · Max $100,000</p>
            </div>
          )}

          {/* Review */}
          {currentKey === 'review' && (
            <div>
              <p className="text-[13px] text-white/30 mb-3">Review your backtest configuration</p>
              {[
                { label: 'Ticker', value: `$${config.ticker}`, stepIdx: 0 },
                { label: 'Chart', value: intervalLabel, stepIdx: 1 },
                { label: 'Lookback', value: timeframeLabel, stepIdx: 2 },
                { label: 'Strategy', value: selectedStrategy?.name ?? '', stepIdx: 3 },
                { label: 'Amount', value: `$${Number(config.amount).toLocaleString()}`, stepIdx: 4 },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-[#1f1f1f]">
                  <div>
                    <span className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">{row.label}</span>
                    <div className="text-sm font-bold text-white mt-0.5">{row.value}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(row.stepIdx)}
                    className="px-3 py-1 rounded-lg border border-[#2a2a2a] bg-[#141414] text-emerald-400 text-[11px] font-semibold hover:bg-[#1a1a1a] transition"
                  >
                    Edit
                  </button>
                </div>
              ))}
              {selectedStrategy && (
                <div className="mt-3 px-3 py-2.5 rounded-lg border border-emerald-500/[0.15] bg-emerald-500/[0.05]">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">Strategy Logic</span>
                  <p className="text-[12px] text-white/40 leading-relaxed mt-1">{selectedStrategy.desc}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[#1f1f1f] flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 rounded-xl border border-[#2a2a2a] text-white/40 text-sm font-semibold hover:bg-white/[0.03] transition"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={currentKey === 'review' ? handleSubmit : handleNext}
            disabled={!canProceed}
            className={`py-3 rounded-xl text-sm font-bold transition ${
              step === 0 ? 'flex-1' : 'flex-[2]'
            } ${
              currentKey === 'review' && canProceed
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                : canProceed
                  ? 'bg-emerald-500/[0.15] text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-[#141414] text-white/20 cursor-not-allowed'
            }`}
          >
            {currentKey === 'review' ? '🚀 Run Backtest' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
