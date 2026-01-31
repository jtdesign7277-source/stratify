import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_TABS = ['All', 'Momentum', 'Mean Reversion', 'Trend Following', 'Volatility'];

const RISK_STYLES = {
  Low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  High: 'bg-red-500/15 text-red-400 border-red-500/40',
};

const CATEGORY_STYLES = {
  Momentum: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
  'Mean Reversion': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  'Trend Following': 'bg-purple-500/15 text-purple-400 border-purple-500/40',
  Volatility: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
};

const TEMPLATES = [
  {
    id: 'rsi-oversold-bounce',
    name: 'RSI Oversold Bounce',
    description: 'Buys sharp pullbacks when RSI hits oversold and price reclaims short-term support.',
    category: 'Mean Reversion',
    risk: 'Medium',
    horizon: 'Swing',
    entry: 'RSI(14) below 30 and price closes back above 5-day SMA.',
    exit: 'RSI returns above 55 or price closes below 5-day SMA.',
    assets: 'Best for: TSLA, NVDA, AMD, liquid large caps',
    performance: { winRate: '58%', sharpe: '1.32', maxDrawdown: '-12.4%' },
    code: `def signal(df):
    rsi = ta.rsi(df.close, 14)
    sma = df.close.rolling(5).mean()
    entry = (rsi < 30) & (df.close > sma)
    exit = (rsi > 55) | (df.close < sma)
    return entry, exit`,
  },
  {
    id: 'macd-crossover',
    name: 'MACD Crossover',
    description: 'Captures momentum shifts when MACD crosses above its signal line.',
    category: 'Momentum',
    risk: 'Medium',
    horizon: 'Swing',
    entry: 'MACD crosses above signal with histogram expanding.',
    exit: 'MACD crosses below signal or price closes below 20 EMA.',
    assets: 'Best for: NVDA, AAPL, QQQ, trending equities',
    performance: { winRate: '54%', sharpe: '1.18', maxDrawdown: '-15.1%' },
    code: `def signal(df):
    macd, signal = ta.macd(df.close, 12, 26, 9)
    ema20 = ta.ema(df.close, 20)
    entry = ta.cross(macd, signal, above=True)
    exit = ta.cross(macd, signal, above=False) | (df.close < ema20)
    return entry, exit`,
  },
  {
    id: 'golden-cross',
    name: 'Golden Cross',
    description: 'Trend-following approach that rides sustained uptrends after a 50/200 SMA cross.',
    category: 'Trend Following',
    risk: 'Low',
    horizon: 'Swing',
    entry: '50 SMA crosses above 200 SMA with rising volume.',
    exit: '50 SMA crosses back below 200 SMA.',
    assets: 'Best for: SPY, QQQ, major indices, blue chips',
    performance: { winRate: '61%', sharpe: '1.45', maxDrawdown: '-9.8%' },
    code: `def signal(df):
    sma50 = df.close.rolling(50).mean()
    sma200 = df.close.rolling(200).mean()
    entry = ta.cross(sma50, sma200, above=True)
    exit = ta.cross(sma50, sma200, above=False)
    return entry, exit`,
  },
  {
    id: 'bollinger-squeeze',
    name: 'Bollinger Band Squeeze',
    description: 'Trades volatility expansion after prolonged consolidation.',
    category: 'Volatility',
    risk: 'High',
    horizon: 'Day',
    entry: 'Bandwidth at 6-month low and price closes above upper band.',
    exit: 'Price closes back inside bands or ATR stops.',
    assets: 'Best for: TSLA, COIN, high-beta names',
    performance: { winRate: '49%', sharpe: '1.07', maxDrawdown: '-18.6%' },
    code: `def signal(df):
    upper, mid, lower = ta.bbands(df.close, 20, 2)
    bandwidth = (upper - lower) / mid
    squeeze = bandwidth == bandwidth.rolling(120).min()
    entry = squeeze & (df.close > upper)
    exit = df.close < mid
    return entry, exit`,
  },
  {
    id: 'gap-fill',
    name: 'Gap Fill Strategy',
    description: 'Fades opening gaps that over-extend beyond key support or resistance.',
    category: 'Mean Reversion',
    risk: 'High',
    horizon: 'Day',
    entry: 'Open gaps +2% or more and price fails to hold the gap high.',
    exit: 'Target prior close or stop above gap high.',
    assets: 'Best for: earnings movers, liquid mid caps',
    performance: { winRate: '52%', sharpe: '0.96', maxDrawdown: '-20.2%' },
    code: `def signal(df):
    gap = (df.open - df.close.shift(1)) / df.close.shift(1)
    entry = (gap > 0.02) & (df.close < df.open)
    exit = df.close <= df.close.shift(1)
    return entry, exit`,
  },
  {
    id: 'volume-breakout',
    name: 'Volume Breakout',
    description: 'Buys breakouts with volume confirmation to avoid false moves.',
    category: 'Momentum',
    risk: 'Medium',
    horizon: 'Swing',
    entry: 'Close above 20-day high with volume > 1.8x average.',
    exit: 'Close back below 20-day breakout level.',
    assets: 'Best for: growth stocks, sector leaders',
    performance: { winRate: '57%', sharpe: '1.26', maxDrawdown: '-13.7%' },
    code: `def signal(df):
    high20 = df.close.rolling(20).max()
    vol_avg = df.volume.rolling(20).mean()
    entry = (df.close > high20.shift(1)) & (df.volume > 1.8 * vol_avg)
    exit = df.close < high20.shift(1)
    return entry, exit`,
  },
  {
    id: 'ma-ribbon',
    name: 'Moving Average Ribbon',
    description: 'Tracks trend strength using a ribbon of EMAs and scales into momentum.',
    category: 'Trend Following',
    risk: 'Low',
    horizon: 'Swing',
    entry: 'All EMAs (10-50) stacked bullish and price above 20 EMA.',
    exit: 'Ribbon flips bearish or price closes below 50 EMA.',
    assets: 'Best for: indices, large-cap trends',
    performance: { winRate: '63%', sharpe: '1.51', maxDrawdown: '-10.6%' },
    code: `def signal(df):
    emas = [ta.ema(df.close, n) for n in [10, 20, 30, 40, 50]]
    bullish = all(emas[i] > emas[i+1] for i in range(len(emas)-1))
    entry = bullish & (df.close > emas[1])
    exit = df.close < emas[-1]
    return entry, exit`,
  },
  {
    id: 'stochastic-pop',
    name: 'Stochastic Pop',
    description: 'Targets quick bursts when stochastic flips from oversold to bullish.',
    category: 'Momentum',
    risk: 'Medium',
    horizon: 'Scalping',
    entry: 'Stoch %K crosses above %D below 20 with rising volume.',
    exit: 'Stoch crosses down above 80 or 1.5x ATR target.',
    assets: 'Best for: SPY, QQQ, liquid ETFs',
    performance: { winRate: '55%', sharpe: '1.11', maxDrawdown: '-11.9%' },
    code: `def signal(df):
    k, d = ta.stoch(df.high, df.low, df.close, 14, 3)
    entry = ta.cross(k, d, above=True) & (k < 20)
    exit = ta.cross(k, d, above=False) | (k > 80)
    return entry, exit`,
  },
];

export default function StrategyTemplates({ onSelectTemplate }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return TEMPLATES.filter((template) => {
      if (activeCategory !== 'All' && template.category !== activeCategory) return false;
      if (!normalized) return true;
      const haystack = [
        template.name,
        template.description,
        template.category,
        template.risk,
        template.horizon,
        template.assets,
        template.entry,
        template.exit,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [activeCategory, query]);

  const handleSelectTemplate = (template) => {
    const config = {
      id: template.id,
      name: template.name,
      category: template.category,
      risk: template.risk,
      horizon: template.horizon,
      description: template.description,
      entry: template.entry,
      exit: template.exit,
      assets: template.assets,
      performance: template.performance,
      code: template.code,
    };
    onSelectTemplate?.(config);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-2xl p-6 shadow-[0_0_30px_rgba(8,10,20,0.6)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">Strategy Templates Library</h2>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Curated
            </span>
          </div>
          <p className="text-sm text-[#7a7a93] mt-1">
            Premium-ready strategies built for rapid deployment and backtesting.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#7a7a93]">
          <div className="px-3 py-2 rounded-lg bg-[#11111b] border border-[#1e1e2d]">
            {filteredTemplates.length} templates
          </div>
          <div className="px-3 py-2 rounded-lg bg-[#11111b] border border-[#1e1e2d]">
            Updated weekly
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                activeCategory === tab
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#11111b] text-[#8a8aa3] border-[#1e1e2d] hover:border-[#2c2c40]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates..."
            className="w-full bg-[#11111b] border border-[#1e1e2d] rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-[#5f5f78] focus:border-cyan-500/60 focus:outline-none"
          />
          <svg
            className="w-4 h-4 text-[#5f5f78] absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" strokeWidth="1.5" />
            <path strokeLinecap="round" strokeWidth="1.5" d="M20 20l-3.5-3.5" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredTemplates.map((template, index) => {
          const isExpanded = expandedId === template.id;
          return (
            <motion.div
              key={template.id}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`border rounded-xl bg-[#0c0c14] p-4 hover:border-cyan-500/40 transition-all cursor-pointer ${
                isExpanded ? 'border-cyan-500/50 shadow-[0_0_24px_rgba(6,182,212,0.12)]' : 'border-[#1e1e2d]'
              }`}
              onClick={() => setExpandedId(isExpanded ? null : template.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-white font-semibold text-lg mb-1">{template.name}</h3>
                  <p className="text-sm text-[#7b7b93]">{template.description}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <span className={`px-2 py-1 rounded-full border text-[10px] font-medium ${CATEGORY_STYLES[template.category]}`}>
                    {template.category}
                  </span>
                  <span className={`px-2 py-1 rounded-full border text-[10px] font-medium ${RISK_STYLES[template.risk]}`}>
                    {template.risk} risk
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-lg p-2">
                  <div className="text-[#6d6d86] uppercase tracking-wide text-[10px]">Horizon</div>
                  <div className="text-white font-medium mt-1">{template.horizon}</div>
                </div>
                <div className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-lg p-2">
                  <div className="text-[#6d6d86] uppercase tracking-wide text-[10px]">Win Rate</div>
                  <div className="text-emerald-400 font-semibold mt-1">{template.performance.winRate}</div>
                </div>
                <div className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-lg p-2">
                  <div className="text-[#6d6d86] uppercase tracking-wide text-[10px]">Sharpe</div>
                  <div className="text-cyan-400 font-semibold mt-1">{template.performance.sharpe}</div>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key={`${template.id}-details`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-4 space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-[#0a0a0f] border border-emerald-500/20 rounded-lg p-3">
                        <div className="text-[11px] uppercase tracking-wide text-emerald-300 mb-2">Entry</div>
                        <p className="text-[#cfd0e6]">{template.entry}</p>
                      </div>
                      <div className="bg-[#0a0a0f] border border-red-500/20 rounded-lg p-3">
                        <div className="text-[11px] uppercase tracking-wide text-red-300 mb-2">Exit</div>
                        <p className="text-[#cfd0e6]">{template.exit}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-lg p-3">
                        <div className="text-[#6d6d86] uppercase tracking-wide text-[10px]">Best For</div>
                        <p className="text-white mt-1">{template.assets}</p>
                      </div>
                      <div className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-lg p-3">
                        <div className="text-[#6d6d86] uppercase tracking-wide text-[10px]">Max Drawdown</div>
                        <p className="text-red-400 font-semibold mt-1">{template.performance.maxDrawdown}</p>
                      </div>
                      <div className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-lg p-3">
                        <div className="text-[#6d6d86] uppercase tracking-wide text-[10px]">Template ID</div>
                        <p className="text-cyan-300 font-mono mt-1">{template.id}</p>
                      </div>
                    </div>

                    <div className="bg-[#0a0a0f] border border-[#1e1e2d] rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#12121a] border-b border-[#1e1e2d]">
                        <span className="text-[11px] text-[#8a8aa3]">strategy.py</span>
                        <span className="text-[11px] text-cyan-400">Logic preview</span>
                      </div>
                      <pre className="text-xs text-[#c7c7e2] px-4 py-3 whitespace-pre-wrap font-mono">
                        {template.code}
                      </pre>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelectTemplate(template);
                        }}
                        className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                      >
                        Use Template
                      </button>
                      <button
                        onClick={(event) => event.stopPropagation()}
                        className="px-4 py-2 rounded-lg bg-[#141422] text-white border border-[#1e1e2d] text-sm font-medium hover:border-[#2b2b40] transition-colors"
                      >
                        Preview Backtest
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
