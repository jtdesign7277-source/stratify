import { fetchTwelveData } from './lib/twelvedata.js';

const STRATEGIES = new Set(['rsi', 'macd', 'bollinger', 'ema_crossover', 'breakout']);

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const daysBetween = (a, b) => Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000);

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

// ---------------------------------------------------------------------------
// Fetch OHLCV + indicator data from Twelve Data
// ---------------------------------------------------------------------------

const fetchOhlcv = async (symbol, interval, startDate) => {
  const payload = await fetchTwelveData('time_series', {
    symbol,
    interval,
    start_date: startDate,
    outputsize: 5000,
    order: 'ASC',
    dp: 4,
  });

  const values = Array.isArray(payload?.values) ? payload.values : [];
  return values
    .map((bar) => ({
      datetime: bar.datetime,
      open: toNumber(bar.open),
      high: toNumber(bar.high),
      low: toNumber(bar.low),
      close: toNumber(bar.close),
      volume: toNumber(bar.volume),
    }))
    .filter((bar) => bar.datetime && bar.close != null);
};

const fetchIndicator = async (endpoint, symbol, interval, startDate, extraParams = {}) => {
  const payload = await fetchTwelveData(endpoint.replace(/^\//, ''), {
    symbol,
    interval,
    start_date: startDate,
    outputsize: 5000,
    order: 'ASC',
    dp: 4,
    ...extraParams,
  });

  const values = Array.isArray(payload?.values) ? payload.values : [];
  const byDate = new Map();
  for (const row of values) {
    if (row.datetime) byDate.set(row.datetime, row);
  }
  return byDate;
};

const mergeIndicator = (bars, indicatorMap, fields) => {
  return bars.map((bar) => {
    const indicator = indicatorMap.get(bar.datetime) || {};
    const merged = { ...bar };
    for (const field of fields) {
      merged[field] = toNumber(indicator[field]);
    }
    return merged;
  });
};

// ---------------------------------------------------------------------------
// Strategy runners
// ---------------------------------------------------------------------------

const runRsi = async (symbol, interval, startDate, params) => {
  const period = params.rsiPeriod || 14;
  const entryThreshold = params.entryThreshold || 30;
  const exitThreshold = params.exitThreshold || 70;

  const bars = await fetchOhlcv(symbol, interval, startDate);
  const rsiMap = await fetchIndicator('rsi', symbol, interval, startDate, { time_period: period });
  const merged = mergeIndicator(bars, rsiMap, ['rsi']);

  return { bars: merged, shouldBuy, shouldSell };

  function shouldBuy(bar) {
    if (bar.rsi == null) return null;
    return bar.rsi < entryThreshold ? `RSI ${round(bar.rsi, 1)} < ${entryThreshold}` : null;
  }

  function shouldSell(bar) {
    if (bar.rsi == null) return null;
    return bar.rsi > exitThreshold ? `RSI ${round(bar.rsi, 1)} > ${exitThreshold}` : null;
  }
};

const runMacd = async (symbol, interval, startDate, params) => {
  const fastPeriod = params.fastPeriod || 12;
  const slowPeriod = params.slowPeriod || 26;
  const signalPeriod = params.signalPeriod || 9;

  const bars = await fetchOhlcv(symbol, interval, startDate);
  const macdMap = await fetchIndicator('macd', symbol, interval, startDate, {
    fast_period: fastPeriod,
    slow_period: slowPeriod,
    signal_period: signalPeriod,
  });
  const merged = mergeIndicator(bars, macdMap, ['macd', 'macd_signal', 'macd_hist']);

  let prevHist = null;

  return { bars: merged, shouldBuy, shouldSell };

  function shouldBuy(bar, index) {
    const hist = bar.macd_hist;
    if (hist == null) { prevHist = hist; return null; }
    const signal = (prevHist != null && prevHist <= 0 && hist > 0)
      ? `MACD histogram crossed above zero (${round(hist, 4)})`
      : null;
    prevHist = hist;
    return signal;
  }

  function shouldSell(bar, index) {
    const hist = bar.macd_hist;
    if (hist == null) return null;
    return hist < 0 ? `MACD histogram below zero (${round(hist, 4)})` : null;
  }
};

const runBollinger = async (symbol, interval, startDate, params) => {
  const period = params.bbPeriod || 20;
  const sd = params.bbStdDev || 2;

  const bars = await fetchOhlcv(symbol, interval, startDate);
  const bbMap = await fetchIndicator('bbands', symbol, interval, startDate, {
    time_period: period,
    sd,
  });
  const merged = mergeIndicator(bars, bbMap, ['lower_band', 'middle_band', 'upper_band']);

  return { bars: merged, shouldBuy, shouldSell };

  function shouldBuy(bar) {
    if (bar.lower_band == null) return null;
    return bar.close <= bar.lower_band
      ? `Price ${round(bar.close, 2)} at lower band ${round(bar.lower_band, 2)}`
      : null;
  }

  function shouldSell(bar) {
    if (bar.middle_band == null) return null;
    return bar.close >= bar.middle_band
      ? `Price ${round(bar.close, 2)} reached middle band ${round(bar.middle_band, 2)}`
      : null;
  }
};

const runEmaCrossover = async (symbol, interval, startDate, params) => {
  const shortPeriod = params.shortEmaPeriod || 9;
  const longPeriod = params.longEmaPeriod || 21;

  const bars = await fetchOhlcv(symbol, interval, startDate);
  const [shortMap, longMap] = await Promise.all([
    fetchIndicator('ema', symbol, interval, startDate, { time_period: shortPeriod }),
    fetchIndicator('ema', symbol, interval, startDate, { time_period: longPeriod }),
  ]);

  const merged = bars.map((bar) => {
    const shortRow = shortMap.get(bar.datetime) || {};
    const longRow = longMap.get(bar.datetime) || {};
    return {
      ...bar,
      ema_short: toNumber(shortRow.ema),
      ema_long: toNumber(longRow.ema),
    };
  });

  let prevShort = null;
  let prevLong = null;

  return { bars: merged, shouldBuy, shouldSell };

  function shouldBuy(bar) {
    const short = bar.ema_short;
    const long = bar.ema_long;
    if (short == null || long == null) { prevShort = short; prevLong = long; return null; }
    const signal = (prevShort != null && prevLong != null && prevShort <= prevLong && short > long)
      ? `EMA ${shortPeriod} (${round(short, 2)}) crossed above EMA ${longPeriod} (${round(long, 2)})`
      : null;
    prevShort = short;
    prevLong = long;
    return signal;
  }

  function shouldSell(bar) {
    const short = bar.ema_short;
    const long = bar.ema_long;
    if (short == null || long == null) return null;
    return short < long
      ? `EMA ${shortPeriod} (${round(short, 2)}) below EMA ${longPeriod} (${round(long, 2)})`
      : null;
  }
};

const runBreakout = async (symbol, interval, startDate, params) => {
  const lookback = params.breakoutPeriod || 20;

  const bars = await fetchOhlcv(symbol, interval, startDate);

  return { bars, shouldBuy, shouldSell };

  function shouldBuy(bar, index) {
    if (index < lookback) return null;
    let highest = -Infinity;
    for (let j = index - lookback; j < index; j++) {
      if (bars[j].high > highest) highest = bars[j].high;
    }
    return bar.close > highest
      ? `Price ${round(bar.close, 2)} broke above ${lookback}-day high ${round(highest, 2)}`
      : null;
  }

  function shouldSell(bar, index) {
    if (index < lookback) return null;
    let lowest = Infinity;
    for (let j = index - lookback; j < index; j++) {
      if (bars[j].low < lowest) lowest = bars[j].low;
    }
    return bar.close < lowest
      ? `Price ${round(bar.close, 2)} broke below ${lookback}-day low ${round(lowest, 2)}`
      : null;
  }
};

const STRATEGY_RUNNERS = {
  rsi: runRsi,
  macd: runMacd,
  bollinger: runBollinger,
  ema_crossover: runEmaCrossover,
  breakout: runBreakout,
};

// ---------------------------------------------------------------------------
// Core backtest engine
// ---------------------------------------------------------------------------

const backtest = (bars, shouldBuy, shouldSell, stopLossPct, positionSize) => {
  const trades = [];
  let position = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (bar.close == null) continue;

    if (!position) {
      const buyReason = shouldBuy(bar, i);
      if (buyReason) {
        const shares = Math.floor(positionSize / bar.close);
        if (shares > 0) {
          position = {
            entryDate: bar.datetime,
            entryPrice: bar.close,
            entryReason: buyReason,
            shares,
          };
        }
      }
      continue;
    }

    // Check stop loss
    const drawdown = (bar.low - position.entryPrice) / position.entryPrice;
    if (drawdown <= -stopLossPct) {
      const exitPrice = round(position.entryPrice * (1 - stopLossPct), 4);
      const profit = round((exitPrice - position.entryPrice) * position.shares, 2);
      const returnPct = round(((exitPrice - position.entryPrice) / position.entryPrice) * 100, 2);
      trades.push({
        type: 'long',
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        entryReason: position.entryReason,
        exitDate: bar.datetime,
        exitPrice,
        exitReason: `Stop loss triggered (-${round(stopLossPct * 100, 1)}%)`,
        shares: position.shares,
        profit,
        returnPct,
        holdingDays: daysBetween(position.entryDate, bar.datetime),
      });
      position = null;
      continue;
    }

    // Check sell signal
    const sellReason = shouldSell(bar, i);
    if (sellReason) {
      const profit = round((bar.close - position.entryPrice) * position.shares, 2);
      const returnPct = round(((bar.close - position.entryPrice) / position.entryPrice) * 100, 2);
      trades.push({
        type: 'long',
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        entryReason: position.entryReason,
        exitDate: bar.datetime,
        exitPrice: bar.close,
        exitReason: sellReason,
        shares: position.shares,
        profit,
        returnPct,
        holdingDays: daysBetween(position.entryDate, bar.datetime),
      });
      position = null;
    }
  }

  // Close open position at last bar
  if (position && bars.length > 0) {
    const lastBar = bars[bars.length - 1];
    const profit = round((lastBar.close - position.entryPrice) * position.shares, 2);
    const returnPct = round(((lastBar.close - position.entryPrice) / position.entryPrice) * 100, 2);
    trades.push({
      type: 'long',
      entryDate: position.entryDate,
      entryPrice: position.entryPrice,
      entryReason: position.entryReason,
      exitDate: lastBar.datetime,
      exitPrice: lastBar.close,
      exitReason: 'Position closed at end of period',
      shares: position.shares,
      profit,
      returnPct,
      holdingDays: daysBetween(position.entryDate, lastBar.datetime),
    });
  }

  return trades;
};

// ---------------------------------------------------------------------------
// Compute summary statistics
// ---------------------------------------------------------------------------

const computeStats = (trades) => {
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0, winners: 0, losers: 0, winRate: 0,
      totalProfit: 0, avgWin: 0, avgLoss: 0, riskReward: 0,
      maxDrawdown: 0, avgHoldingDays: 0,
    };
  }

  const winners = trades.filter((t) => t.profit > 0);
  const losers = trades.filter((t) => t.profit <= 0);
  const totalProfit = round(trades.reduce((sum, t) => sum + t.profit, 0), 2);
  const winRate = round((winners.length / totalTrades) * 100, 1);
  const avgWin = winners.length > 0
    ? round(winners.reduce((sum, t) => sum + t.profit, 0) / winners.length, 2)
    : 0;
  const avgLoss = losers.length > 0
    ? round(losers.reduce((sum, t) => sum + t.profit, 0) / losers.length, 2)
    : 0;
  const riskReward = avgLoss !== 0 ? round(Math.abs(avgWin / avgLoss), 2) : avgWin > 0 ? Infinity : 0;
  const avgHoldingDays = round(trades.reduce((sum, t) => sum + t.holdingDays, 0) / totalTrades, 1);

  // Max drawdown from cumulative P&L
  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  for (const trade of trades) {
    cumulative += trade.profit;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    totalTrades,
    winners: winners.length,
    losers: losers.length,
    winRate,
    totalProfit,
    avgWin,
    avgLoss,
    riskReward,
    maxDrawdown: round(maxDrawdown, 2),
    avgHoldingDays,
  };
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const symbol = String(body.symbol || '').trim().toUpperCase();
    const strategy = String(body.strategy || '').trim().toLowerCase();
    const months = clamp(Number(body.months) || 3, 1, 12);
    const interval = String(body.interval || '1day').trim();
    const params = body.params || {};
    const stopLossPct = (Number(params.stopLoss) || 3) / 100;
    const positionSize = Number(params.positionSize) || 25000;

    if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
    if (!STRATEGIES.has(strategy)) {
      return res.status(400).json({
        error: `Invalid strategy. Must be one of: ${[...STRATEGIES].join(', ')}`,
      });
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    const runner = STRATEGY_RUNNERS[strategy];
    const { bars, shouldBuy, shouldSell } = await runner(symbol, interval, startDateStr, params);

    if (bars.length === 0) {
      return res.status(400).json({ error: `No data returned for ${symbol}` });
    }

    const trades = backtest(bars, shouldBuy, shouldSell, stopLossPct, positionSize);
    const stats = computeStats(trades);

    return res.status(200).json({
      symbol,
      strategy,
      period: {
        months,
        startDate: startDateStr,
        endDate: bars[bars.length - 1].datetime,
        totalBars: bars.length,
      },
      trades,
      stats,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error?.message || 'Backtest failed' });
  }
}
