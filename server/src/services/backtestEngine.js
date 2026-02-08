// Pure-JS backtest engine for Alpaca bar data

const PERIOD_DAYS = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '2Y': 730,
};

const STRATEGY_DEFAULTS = {
  rsi: { stop: 0.03, take: 0.08, buyThreshold: 30, sellThreshold: 70 },
  sma: { stop: 0.04, take: 0.10 },
  macd: { stop: 0.03, take: 0.07 },
  bollinger: { stop: 0.05, take: 0.06 },
  breakout: { stop: 0.05, take: 0.12 },
  scalping: { stop: 0.01, take: 0.02 },
};

function toIso(date) {
  return date.toISOString();
}

function parsePercent(value, fallback) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return fallback;
  }
  const num = Number(value);
  if (num > 1) return num / 100;
  return num;
}

function calcSMA(values, period) {
  const out = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }
  return out;
}

function calcEMA(values, period) {
  const out = Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let sum = 0;
  let count = 0;
  let ema = null;

  for (let i = 0; i < values.length; i += 1) {
    const val = values[i];
    if (val === null || val === undefined || Number.isNaN(val)) {
      out[i] = null;
      continue;
    }

    count += 1;
    sum += val;

    if (count < period) {
      out[i] = null;
      continue;
    }

    if (count === period) {
      ema = sum / period;
      out[i] = ema;
      continue;
    }

    ema = (val - ema) * k + ema;
    out[i] = ema;
  }

  return out;
}

function calcRSI(values, period = 14) {
  const out = Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  let rs = avgLoss === 0 ? (avgGain === 0 ? 0 : Infinity) : avgGain / avgLoss;
  out[period] = 100 - (100 / (1 + rs));

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? (avgGain === 0 ? 0 : Infinity) : avgGain / avgLoss;
    out[i] = 100 - (100 / (1 + rs));
  }

  return out;
}

function calcBollinger(values, period = 20, multiplier = 2) {
  const middle = calcSMA(values, period);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i += 1) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      const diff = values[j] - middle[i];
      sumSq += diff * diff;
    }
    const variance = sumSq / period;
    const std = Math.sqrt(variance);
    upper[i] = middle[i] + multiplier * std;
    lower[i] = middle[i] - multiplier * std;
  }

  return { upper, middle, lower };
}

function calcVWAP(highs, lows, closes, volumes) {
  const out = Array(closes.length).fill(null);
  let cumulativePV = 0;
  let cumulativeVol = 0;
  for (let i = 0; i < closes.length; i += 1) {
    const typical = (highs[i] + lows[i] + closes[i]) / 3;
    const vol = volumes[i];
    cumulativePV += typical * vol;
    cumulativeVol += vol;
    out[i] = cumulativeVol === 0 ? null : cumulativePV / cumulativeVol;
  }
  return out;
}

function rollingMaxPrev(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period; i < values.length; i += 1) {
    let max = -Infinity;
    for (let j = i - period; j < i; j += 1) {
      if (values[j] > max) max = values[j];
    }
    out[i] = max;
  }
  return out;
}

function rollingMinPrev(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period; i < values.length; i += 1) {
    let min = Infinity;
    for (let j = i - period; j < i; j += 1) {
      if (values[j] < min) min = values[j];
    }
    out[i] = min;
  }
  return out;
}

function rollingAvgPrev(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period; i < values.length; i += 1) {
    let sum = 0;
    for (let j = i - period; j < i; j += 1) {
      sum += values[j];
    }
    out[i] = sum / period;
  }
  return out;
}

function crossedAbove(prevA, prevB, currA, currB) {
  return (
    prevA !== null &&
    prevB !== null &&
    currA !== null &&
    currB !== null &&
    prevA <= prevB &&
    currA > currB
  );
}

function crossedBelow(prevA, prevB, currA, currB) {
  return (
    prevA !== null &&
    prevB !== null &&
    currA !== null &&
    currB !== null &&
    prevA >= prevB &&
    currA < currB
  );
}

function crossedBelowValue(prev, curr, level) {
  return prev !== null && curr !== null && prev > level && curr <= level;
}

function crossedAboveValue(prev, curr, level) {
  return prev !== null && curr !== null && prev < level && curr >= level;
}

function normalizeStrategyKey(strategy) {
  const key = `${strategy?.indicator || ''} ${strategy?.type || ''}`.toLowerCase();
  if (key.includes('rsi')) return 'rsi';
  if (key.includes('momentum') || key.includes('sma')) return 'sma';
  if (key.includes('macd')) return 'macd';
  if (key.includes('bollinger') || key.includes('mean')) return 'bollinger';
  if (key.includes('breakout')) return 'breakout';
  if (key.includes('scalp')) return 'scalping';
  return 'rsi';
}

function emptySummary(startingCapital) {
  return {
    startingCapital,
    endingCapital: startingCapital,
    totalReturn: 0,
    totalReturnPercent: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    avgTradeReturnPercent: 0,
    profitFactor: 0,
  };
}

async function fetchAlpacaBars(symbol, timeframe, startIso, endIso) {
  const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(
    symbol
  )}/bars?timeframe=${encodeURIComponent(timeframe)}&start=${encodeURIComponent(
    startIso
  )}&end=${encodeURIComponent(endIso)}&limit=10000&feed=iex`;

  const headers = {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY':
      process.env.ALPACA_API_SECRET || process.env.ALPACA_SECRET_KEY,
  };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca bars error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.bars || [];
}

export async function runBacktest(strategy = {}) {
  const startingCapital = 100000;
  const ticker = strategy?.ticker;
  const timeframe = strategy?.timeframe || '1Day';
  const period = strategy?.period || '1Y';
  const params = strategy?.params || {};

  const days = PERIOD_DAYS[period] || 365;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const metadata = {
    ticker,
    timeframe,
    period,
    start: toIso(startDate),
    end: toIso(endDate),
    type: strategy?.type || null,
    indicator: strategy?.indicator || null,
    generatedAt: toIso(new Date()),
  };

  if (!ticker) {
    return {
      summary: emptySummary(startingCapital),
      equityCurve: [],
      trades: [],
      indicators: {},
      metadata: { ...metadata, error: 'Missing ticker' },
    };
  }

  let bars;
  try {
    bars = await fetchAlpacaBars(ticker, timeframe, metadata.start, metadata.end);
  } catch (err) {
    return {
      summary: emptySummary(startingCapital),
      equityCurve: [],
      trades: [],
      indicators: {},
      metadata: { ...metadata, error: err.message },
    };
  }

  if (!bars.length) {
    return {
      summary: emptySummary(startingCapital),
      equityCurve: [],
      trades: [],
      indicators: {},
      metadata: { ...metadata, bars: 0 },
    };
  }

  const timestamps = bars.map((b) => b.t);
  const opens = bars.map((b) => Number(b.o));
  const highs = bars.map((b) => Number(b.h));
  const lows = bars.map((b) => Number(b.l));
  const closes = bars.map((b) => Number(b.c));
  const volumes = bars.map((b) => Number(b.v));

  const rsi14 = calcRSI(closes, 14);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);
  const ema9 = calcEMA(closes, 9);
  const ema12 = calcEMA(closes, 12);
  const ema21 = calcEMA(closes, 21);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12.map((val, i) =>
    val !== null && ema26[i] !== null ? val - ema26[i] : null
  );
  const macdSignal = calcEMA(macd, 9);
  const bollinger = calcBollinger(closes, 20, 2);
  const vwap = calcVWAP(highs, lows, closes, volumes);

  const high20 = rollingMaxPrev(highs, 20);
  const low10 = rollingMinPrev(lows, 10);
  const avgVolume20 = rollingAvgPrev(volumes, 20);

  const indicators = {
    timestamps,
    close: closes,
    rsi14,
    sma20,
    sma50,
    sma200,
    ema9,
    ema12,
    ema21,
    ema26,
    macd,
    macdSignal,
    bollinger,
    vwap,
    high20,
    low10,
    avgVolume20,
  };

  const strategyKey = normalizeStrategyKey(strategy);
  const defaults = STRATEGY_DEFAULTS[strategyKey] || STRATEGY_DEFAULTS.rsi;

  const buyThreshold = Number(params.buyThreshold ?? defaults.buyThreshold ?? 30);
  const sellThreshold = Number(params.sellThreshold ?? defaults.sellThreshold ?? 70);
  const stopLoss = parsePercent(params.stopLossPercent, defaults.stop);
  const takeProfit = parsePercent(params.takeProfitPercent, defaults.take);
  const positionSizePercent = Number(params.positionSizePercent ?? 10);

  let cash = startingCapital;
  let position = null;
  const trades = [];
  const equityCurve = [];

  let peakEquity = startingCapital;
  let maxDrawdown = 0;

  for (let i = 0; i < bars.length; i += 1) {
    const price = closes[i];
    const high = highs[i];
    const low = lows[i];

    let entrySignal = false;
    let exitSignal = false;

    if (i > 0) {
      if (strategyKey === 'rsi') {
        entrySignal = crossedBelowValue(rsi14[i - 1], rsi14[i], buyThreshold);
        exitSignal = crossedAboveValue(rsi14[i - 1], rsi14[i], sellThreshold);
      } else if (strategyKey === 'sma') {
        entrySignal = crossedAbove(sma20[i - 1], sma50[i - 1], sma20[i], sma50[i]);
        exitSignal = crossedBelow(sma20[i - 1], sma50[i - 1], sma20[i], sma50[i]);
      } else if (strategyKey === 'macd') {
        entrySignal =
          crossedAbove(macd[i - 1], macdSignal[i - 1], macd[i], macdSignal[i]) &&
          macd[i] !== null &&
          macd[i] < 0;
        exitSignal = crossedBelow(macd[i - 1], macdSignal[i - 1], macd[i], macdSignal[i]);
      } else if (strategyKey === 'bollinger') {
        entrySignal =
          bollinger.lower[i] !== null && low <= bollinger.lower[i];
        exitSignal =
          (bollinger.upper[i] !== null && high >= bollinger.upper[i]) ||
          (bollinger.middle[i] !== null && price >= bollinger.middle[i]);
      } else if (strategyKey === 'breakout') {
        entrySignal =
          high20[i] !== null &&
          avgVolume20[i] !== null &&
          price > high20[i] &&
          volumes[i] > 1.5 * avgVolume20[i];
        exitSignal = low10[i] !== null && price < low10[i];
      } else if (strategyKey === 'scalping') {
        entrySignal = crossedAbove(ema9[i - 1], ema21[i - 1], ema9[i], ema21[i]);
        exitSignal = crossedBelow(ema9[i - 1], ema21[i - 1], ema9[i], ema21[i]);
      }
    }

    if (position) {
      let exitPrice = null;
      let exitReason = null;

      if (low <= position.stopPrice) {
        exitPrice = position.stopPrice;
        exitReason = 'stop';
      } else if (high >= position.takePrice) {
        exitPrice = position.takePrice;
        exitReason = 'take';
      } else if (exitSignal) {
        exitPrice = price;
        exitReason = 'signal';
      }

      if (exitPrice !== null) {
        cash += position.shares * exitPrice;
        const pnl = (exitPrice - position.entryPrice) * position.shares;
        const pnlPercent = (exitPrice - position.entryPrice) / position.entryPrice * 100;
        trades.push({
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          exitTime: timestamps[i],
          exitPrice,
          shares: position.shares,
          pnl,
          pnlPercent,
          durationBars: i - position.entryIndex,
          reason: exitReason,
        });
        position = null;
      }
    }

    if (!position && entrySignal) {
      const allocation = (cash * positionSizePercent) / 100;
      if (allocation > 0 && price > 0) {
        const shares = allocation / price;
        cash -= allocation;
        position = {
          entryTime: timestamps[i],
          entryIndex: i,
          entryPrice: price,
          shares,
          stopPrice: price * (1 - stopLoss),
          takePrice: price * (1 + takeProfit),
        };
      }
    }

    const equity = cash + (position ? position.shares * price : 0);
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = peakEquity - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    const drawdownPercent = peakEquity === 0 ? 0 : (drawdown / peakEquity) * 100;

    equityCurve.push({
      t: timestamps[i],
      equity,
      drawdown,
      drawdownPercent,
    });
  }

  if (position) {
    const lastIndex = bars.length - 1;
    const exitPrice = closes[lastIndex];
    cash += position.shares * exitPrice;
    const pnl = (exitPrice - position.entryPrice) * position.shares;
    const pnlPercent = (exitPrice - position.entryPrice) / position.entryPrice * 100;
    trades.push({
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      exitTime: timestamps[lastIndex],
      exitPrice,
      shares: position.shares,
      pnl,
      pnlPercent,
      durationBars: lastIndex - position.entryIndex,
      reason: 'end',
    });

    const equity = cash;
    const peak = equityCurve.length ? Math.max(...equityCurve.map((e) => e.equity), equity) : equity;
    const drawdown = peak - equity;
    const drawdownPercent = peak === 0 ? 0 : (drawdown / peak) * 100;
    if (equityCurve.length) {
      equityCurve[lastIndex] = {
        t: timestamps[lastIndex],
        equity,
        drawdown,
        drawdownPercent,
      };
    }
  }

  const endingCapital = equityCurve.length
    ? equityCurve[equityCurve.length - 1].equity
    : startingCapital;

  if (!trades.length) {
    return {
      summary: emptySummary(startingCapital),
      equityCurve,
      trades,
      indicators,
      metadata: { ...metadata, bars: bars.length, strategyKey },
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const totalReturn = endingCapital - startingCapital;
  const totalReturnPercent = (totalReturn / startingCapital) * 100;
  const maxDrawdownPercent = peakEquity === 0 ? 0 : (maxDrawdown / peakEquity) * 100;
  const avgTradeReturnPercent =
    trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length;
  const sumWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const sumLosses = losses.reduce((sum, t) => sum + Math.abs(t.pnl), 0);

  const summary = {
    startingCapital,
    endingCapital,
    totalReturn,
    totalReturnPercent,
    maxDrawdown,
    maxDrawdownPercent,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    avgTradeReturnPercent,
    profitFactor: sumLosses === 0 ? (sumWins > 0 ? Infinity : 0) : sumWins / sumLosses,
  };

  return {
    summary,
    equityCurve,
    trades,
    indicators,
    metadata: { ...metadata, bars: bars.length, strategyKey },
  };
}
