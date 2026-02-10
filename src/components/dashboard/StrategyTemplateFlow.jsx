import { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   STRATIFY — Strategy Template Detail Flow
   Templates Gallery → Click Card → Backtest Detail View
   ═══════════════════════════════════════════════════════════════ */

// ── Icons (thin pencil-line, strokeWidth 1.5) ──────────────────
const Icons = {
  ArrowLeft: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  TrendingUp: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  BarChart: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  Activity: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Zap: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Target: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Layers: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Play: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  ChevronDown: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Clock: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  DollarSign: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  Check: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

// ── Strategy Templates Data ────────────────────────────────────
const TEMPLATES = [
  {
    id: "momentum",
    name: "Momentum Trend",
    icon: Icons.TrendingUp,
    color: "#22d3ee",
    description: "Ride the trend. Buy when price crosses above the 20 EMA, sell when it drops below.",
    logic: "Long when Close > EMA(20) crossover. Exit when Close < EMA(20) crossunder.",
    indicators: ["EMA 20"],
    difficulty: "Beginner",
    avgReturn: "+18.4%",
    winRate: "62%",
  },
  {
    id: "rsi-bounce",
    name: "RSI Bounce",
    icon: Icons.Activity,
    color: "#34d399",
    description: "Buy oversold dips, sell overbought peaks. Classic mean-reversion on RSI extremes.",
    logic: "Long when RSI(14) < 30. Exit when RSI(14) > 55.",
    indicators: ["RSI 14"],
    difficulty: "Beginner",
    avgReturn: "+24.1%",
    winRate: "68%",
  },
  {
    id: "macd-cross",
    name: "MACD Crossover",
    icon: Icons.BarChart,
    color: "#f59e0b",
    description: "Follow momentum shifts. Enter on MACD signal line cross, exit on reverse.",
    logic: "Long when MACD > Signal crossover. Exit when MACD < Signal crossunder.",
    indicators: ["MACD (12,26,9)"],
    difficulty: "Intermediate",
    avgReturn: "+15.7%",
    winRate: "58%",
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    icon: Icons.Target,
    color: "#a78bfa",
    description: "Buy stretched pullbacks, sell stretched rallies. Uses RSI bands for entry/exit.",
    logic: "Long when RSI(14) < 35. Exit when RSI(14) > 65.",
    indicators: ["RSI 14", "Bollinger Bands"],
    difficulty: "Intermediate",
    avgReturn: "+21.3%",
    winRate: "65%",
  },
  {
    id: "breakout",
    name: "Breakout Hunter",
    icon: Icons.Zap,
    color: "#f472b6",
    description: "Catch explosive moves. Enter on volume-confirmed breakout above resistance.",
    logic: "Long when Close > 20-day High with Volume > 1.5x Avg. Trail stop at 2 ATR.",
    indicators: ["Volume", "ATR", "20-day High"],
    difficulty: "Advanced",
    avgReturn: "+28.6%",
    winRate: "52%",
  },
  {
    id: "scalper",
    name: "Scalping Engine",
    icon: Icons.Layers,
    color: "#fb923c",
    description: "Quick in, quick out. High-frequency entries on micro momentum with tight stops.",
    logic: "Long when RSI(7) < 25 AND MACD histogram > 0. Exit at +1.5% or -0.8%.",
    indicators: ["RSI 7", "MACD", "VWAP"],
    difficulty: "Advanced",
    avgReturn: "+31.2%",
    winRate: "71%",
  },
];

const TICKERS = [
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta" },
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq ETF" },
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
];

const TIMEFRAMES = ["5m", "15m", "1H", "4H", "1D"];
const PERIODS = ["1M", "3M", "6M", "1Y"];

// ── API Configuration ──────────────────────────────────────────
const CRYPTO_TICKERS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "LINK", "ADA", "AVAX", "DOT"];

// ── Fetch Real Historical Data from Alpaca via Vercel API ──────
const fetchHistoricalBars = async (ticker, period, timeframe) => {
  const isCrypto = CRYPTO_TICKERS.includes(ticker);

  if (isCrypto) {
    return fetchCryptoBars(ticker, period, timeframe);
  }

  try {
    // Use Vercel API endpoint which hits Alpaca with live data
    const url = `/api/history?symbol=${ticker}&timeframe=${timeframe}&period=${period}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

    if (!data.bars || data.bars.length === 0) throw new Error("No bars returned");

    return {
      source: "alpaca-live",
      bars: data.bars.map((b) => ({
        date: b.date,
        timestamp: b.timestamp || new Date(b.date).getTime(),
        open: +b.open,
        high: +b.high,
        low: +b.low,
        close: +b.close,
        volume: b.volume || 0,
      })),
    };
  } catch (err) {
    console.warn(`Alpaca fetch failed for ${ticker}, falling back to simulated:`, err.message);
    return { source: "simulated", bars: generateSimulatedData(ticker, period, timeframe) };
  }
};

// ── Crypto via Crypto.com REST API ─────────────────────────────
const fetchCryptoBars = async (ticker, period, timeframe) => {
  try {
    // Crypto.com instrument format: BTC_USD, ETH_USD, etc.
    const instrument = `${ticker}_USD`;

    // Map timeframe to Crypto.com interval
    const intervalMap = {
      "5m": "5m",
      "15m": "15m",
      "1H": "1h",
      "4H": "4h",
      "1D": "1D",
    };
    const interval = intervalMap[timeframe] || "1h";

    const res = await fetch(
      `https://api.crypto.com/exchange/v1/public/get-candlestick?instrument_name=${instrument}&timeframe=${interval}`
    );

    if (!res.ok) throw new Error(`Crypto.com API ${res.status}`);
    const data = await res.json();

    if (!data.result?.data || data.result.data.length === 0) {
      throw new Error("No crypto candle data");
    }

    // Crypto.com returns: { t: timestamp, o, h, l, c, v }
    const periodDays = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
    const cutoff = Date.now() - (periodDays[period] || 180) * 24 * 60 * 60 * 1000;

    const bars = data.result.data
      .filter((c) => c.t >= cutoff)
      .map((c) => ({
        date: new Date(c.t).toISOString(),
        timestamp: c.t,
        open: +c.o,
        high: +c.h,
        low: +c.l,
        close: +c.c,
        volume: +c.v,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (bars.length === 0) throw new Error("No bars after filtering");

    return { source: "crypto.com", bars };
  } catch (err) {
    console.warn(`Crypto.com fetch failed for ${ticker}, falling back to simulated:`, err.message);
    return { source: "simulated", bars: generateSimulatedData(ticker, period, timeframe) };
  }
};

// ── Simulated Fallback (keeps app working offline/if APIs fail) ─
const generateSimulatedData = (ticker, period, timeframe = "1H") => {
  // Seed based on ticker for consistent results per symbol
  const seed = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  let rng = seed;
  const rand = () => {
    rng = (rng * 16807 + 0) % 2147483647;
    return rng / 2147483647;
  };

  const configs = {
    TSLA: { start: 220, volatility: 0.018, trend: 0.0004 },
    AAPL: { start: 185, volatility: 0.010, trend: 0.0003 },
    NVDA: { start: 480, volatility: 0.022, trend: 0.0005 },
    MSFT: { start: 420, volatility: 0.009, trend: 0.0002 },
    GOOGL: { start: 170, volatility: 0.012, trend: 0.0003 },
    AMZN: { start: 185, volatility: 0.013, trend: 0.0003 },
    META: { start: 510, volatility: 0.015, trend: 0.0004 },
    SPY: { start: 540, volatility: 0.007, trend: 0.0002 },
    QQQ: { start: 460, volatility: 0.009, trend: 0.0003 },
    BTC: { start: 62000, volatility: 0.025, trend: 0.0006 },
    ETH: { start: 3200, volatility: 0.028, trend: 0.0005 },
    SOL: { start: 145, volatility: 0.035, trend: 0.0007 },
  };

  const cfg = configs[ticker] || { start: 100, volatility: 0.015, trend: 0.0003 };
  const periodDays = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252 };
  const days = periodDays[period] || 132;

  // Candles per day based on timeframe (6.5hr market day)
  const candlesPerDay = {
    "5m": 78,   // 390 min / 5
    "15m": 26,  // 390 min / 15
    "1H": 7,    // ~6.5 rounded
    "4H": 2,    // 2 candles per day
    "1D": 1,    // daily
  };
  const cpd = candlesPerDay[timeframe] || 7;

  // Scale volatility per candle — smaller timeframes = smaller per-candle moves
  const volScale = Math.sqrt(1 / cpd); // volatility scales with sqrt of time
  const trendScale = 1 / cpd; // trend distributes evenly

  const points = [];
  let price = cfg.start;

  for (let d = 0; d < days; d++) {
    const date = new Date(2025, 7, 1);
    date.setDate(date.getDate() + d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (let c = 0; c < cpd; c++) {
      const r = (rand() - 0.5) * 2 * cfg.volatility * volScale * price;
      const t = cfg.trend * trendScale * price * (0.5 + rand());
      const cycle = Math.sin((d / days) * Math.PI * 3) * cfg.volatility * volScale * price * 0.3;
      price = Math.max(price + r + t + cycle * 0.1, cfg.start * 0.5);

      const noiseScale = volScale * 0.4;
      const open = price + (rand() - 0.5) * price * noiseScale * 0.02;
      const high = Math.max(price, open) + rand() * price * noiseScale * 0.03;
      const low = Math.min(price, open) - rand() * price * noiseScale * 0.03;

      // Set time based on candle position in the day
      const minuteOffset = Math.floor((c / cpd) * 390); // 390 min market day
      const candleDate = new Date(date);
      candleDate.setHours(9, 30 + minuteOffset, 0, 0);

      points.push({
        date: candleDate.toISOString(),
        timestamp: candleDate.getTime(),
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +price.toFixed(2),
        volume: Math.floor((5000000 + rand() * 15000000) / cpd),
      });
    }
  }
  return points;
};

// ── Indicator Calculations ─────────────────────────────────────
const calcEMA = (prices, period) => {
  const ema = [prices[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < prices.length; i++) ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  return ema;
};

const calcRSI = (prices, period = 14) => {
  const rsi = new Array(prices.length).fill(50);
  for (let i = period; i < prices.length; i++) {
    let g = 0, l = 0;
    for (let j = i - period; j < i; j++) {
      const d = prices[j + 1] - prices[j];
      d > 0 ? (g += d) : (l -= d);
    }
    const rs = l === 0 ? 100 : g / l;
    rsi[i] = +(100 - 100 / (1 + rs)).toFixed(2);
  }
  return rsi;
};

// ── Strategy Simulator ─────────────────────────────────────────
const runBacktest = (strategyId, data, capital) => {
  const closes = data.map((d) => d.close);
  const rsi = calcRSI(closes);
  const ema20 = calcEMA(closes, 20);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macd, 9);

  const trades = [];
  const equity = [capital];
  let pos = null;
  let cash = capital;

  const buy = (i, shares) => {
    pos = { shares, entry: closes[i], entryIdx: i };
    cash -= shares * closes[i];
    trades.push({ type: "BUY", index: i, price: closes[i], shares, date: data[i].date });
  };

  const sell = (i) => {
    if (!pos) return;
    const pnl = (closes[i] - pos.entry) * pos.shares;
    cash += pos.shares * closes[i];
    trades.push({ type: "SELL", index: i, price: closes[i], shares: pos.shares, pnl: +pnl.toFixed(2), date: data[i].date });
    pos = null;
  };

  const startIdx = 30; // warmup
  for (let i = startIdx; i < closes.length; i++) {
    // Strategy logic
    switch (strategyId) {
      case "momentum":
        if (!pos && closes[i] > ema20[i] && closes[i - 1] <= ema20[i - 1]) {
          buy(i, Math.floor(cash / closes[i]));
        } else if (pos && closes[i] < ema20[i] && closes[i - 1] >= ema20[i - 1]) {
          sell(i);
        }
        break;

      case "rsi-bounce":
        if (!pos && rsi[i] < 30) buy(i, Math.floor(cash / closes[i]));
        else if (pos && rsi[i] > 55) sell(i);
        break;

      case "macd-cross":
        if (!pos && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1]) {
          buy(i, Math.floor(cash / closes[i]));
        } else if (pos && macd[i] < signal[i] && macd[i - 1] >= signal[i - 1]) {
          sell(i);
        }
        break;

      case "mean-reversion":
        if (!pos && rsi[i] < 35 && rsi[i - 1] >= 35) buy(i, Math.floor(cash / closes[i]));
        else if (pos && rsi[i] > 65) sell(i);
        break;

      case "breakout": {
        const lookback = closes.slice(Math.max(0, i - 140), i); // 20 days * 7h
        const high20 = Math.max(...lookback);
        const avgVol = data.slice(Math.max(0, i - 70), i).reduce((a, d) => a + d.volume, 0) / 70;
        if (!pos && closes[i] > high20 && data[i].volume > avgVol * 1.5) {
          buy(i, Math.floor(cash / closes[i]));
        } else if (pos && closes[i] < pos.entry * 0.96) {
          sell(i);
        } else if (pos && closes[i] > pos.entry * 1.08) {
          sell(i);
        }
        break;
      }

      case "scalper": {
        const rsi7 = calcRSI(closes.slice(0, i + 1), 7);
        const r7 = rsi7[rsi7.length - 1];
        if (!pos && r7 < 25 && macd[i] - signal[i] > 0) {
          buy(i, Math.floor(cash / closes[i]));
        } else if (pos) {
          const pctChange = (closes[i] - pos.entry) / pos.entry;
          if (pctChange > 0.015 || pctChange < -0.008) sell(i);
        }
        break;
      }
    }

    const val = pos ? pos.shares * closes[i] + cash : cash;
    equity.push(+val.toFixed(2));
  }

  // Fill warmup period
  while (equity.length < closes.length) equity.unshift(capital);

  // Close any open position at end
  if (pos) sell(closes.length - 1);

  // Stats
  const finalEquity = equity[equity.length - 1];
  const pnl = finalEquity - capital;
  const pctReturn = ((pnl / capital) * 100).toFixed(1);
  const sells = trades.filter((t) => t.type === "SELL");
  const wins = sells.filter((t) => t.pnl > 0).length;
  const winRate = sells.length > 0 ? ((wins / sells.length) * 100).toFixed(0) : "—";
  let peak = capital, maxDD = 0;
  equity.forEach((v) => { if (v > peak) peak = v; const dd = ((peak - v) / peak) * 100; if (dd > maxDD) maxDD = dd; });
  const returns = [];
  for (let i = 1; i < equity.length; i++) returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  const avgRet = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdRet = Math.sqrt(returns.reduce((a, b) => a + (b - avgRet) ** 2, 0) / returns.length);
  const sharpe = stdRet > 0 ? ((avgRet / stdRet) * Math.sqrt(252 * 7)).toFixed(2) : "—";
  const bestTrade = sells.length > 0 ? Math.max(...sells.map((t) => t.pnl)) : 0;
  const worstTrade = sells.length > 0 ? Math.min(...sells.map((t) => t.pnl)) : 0;
  const avgTrade = sells.length > 0 ? sells.reduce((a, t) => a + t.pnl, 0) / sells.length : 0;

  // Build round-trip trade pairs for detailed log
  const roundTrips = [];
  for (let i = 0; i < trades.length; i++) {
    if (trades[i].type === "BUY") {
      const entry = trades[i];
      const exit = trades[i + 1]?.type === "SELL" ? trades[i + 1] : null;
      if (exit) {
        const pnlDollar = exit.pnl;
        const pnlPct = ((exit.price - entry.price) / entry.price * 100);
        const openValue = entry.shares * entry.price;
        const closeValue = entry.shares * exit.price;
        // Duration in ms
        const entryTime = new Date(entry.date).getTime();
        const exitTime = new Date(exit.date).getTime();
        const durationMs = exitTime - entryTime;
        const durationHrs = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        let durationStr = "";
        if (durationHrs >= 24) {
          const days = Math.floor(durationHrs / 24);
          const hrs = durationHrs % 24;
          durationStr = `${days}d ${hrs}h`;
        } else {
          durationStr = `${durationHrs}h ${durationMins}m`;
        }

        roundTrips.push({
          id: roundTrips.length + 1,
          type: "LONG",
          entryDate: entry.date,
          exitDate: exit.date,
          entryPrice: entry.price,
          exitPrice: exit.price,
          shares: entry.shares,
          openValue: +openValue.toFixed(2),
          closeValue: +closeValue.toFixed(2),
          pnl: pnlDollar,
          pnlPct: +pnlPct.toFixed(2),
          duration: durationStr,
          entryIdx: entry.index,
          exitIdx: exit.index,
        });
        i++; // skip the SELL since we consumed it
      }
    }
  }

  return {
    trades, roundTrips, equity, pnl, pctReturn, finalEquity, winRate,
    maxDD: maxDD.toFixed(1), sharpe, totalTrades: sells.length,
    wins, losses: sells.length - wins, bestTrade, worstTrade, avgTrade,
    rsi, ema20, macd, signal,
  };
};

// ── Chart Component ────────────────────────────────────────────
const BacktestChart = ({ data, result, template }) => {
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 360 });
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((e) => {
      const { width, height } = e[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { w, h } = dims;
  const pad = { top: 24, right: 56, bottom: 28, left: 8 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  // Downsample
  const step = Math.max(1, Math.floor(data.length / 500));
  const sampled = useMemo(() => data.filter((_, i) => i % step === 0), [data, step]);

  const minP = Math.min(...sampled.map((d) => d.low)) * 0.985;
  const maxP = Math.max(...sampled.map((d) => d.high)) * 1.015;
  const rangeP = maxP - minP || 1;

  const x = (i) => pad.left + (i / (sampled.length - 1)) * cw;
  const y = (v) => pad.top + ch - ((v - minP) / rangeP) * ch;

  const pricePath = sampled.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.close)}`).join(" ");

  // Equity overlay (normalized to price range)
  const eqSampled = result.equity.filter((_, i) => i % step === 0);
  const eqMin = Math.min(...eqSampled);
  const eqMax = Math.max(...eqSampled);
  const eqRange = eqMax - eqMin || 1;
  const eqPath = eqSampled
    .map((v, i) => {
      const norm = minP + ((v - eqMin) / eqRange) * rangeP;
      return `${i === 0 ? "M" : "L"}${x(i)},${y(norm)}`;
    })
    .join(" ");

  // Trade markers (mapped to sampled indices)
  const tradeMarkers = result.trades
    .map((t) => ({ ...t, si: Math.round(t.index / step) }))
    .filter((t) => t.si >= 0 && t.si < sampled.length);

  // Y-axis
  const yTicks = 6;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const val = minP + (rangeP * i) / (yTicks - 1);
    return { val, yp: y(val) };
  });

  // X-axis months
  const monthLabels = {};
  sampled.forEach((d, i) => {
    const dt = new Date(d.date);
    const k = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (!monthLabels[k]) monthLabels[k] = { label: dt.toLocaleDateString("en-US", { month: "short" }), xp: x(i) };
  });

  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left - pad.left;
    const idx = Math.round((mx / cw) * (sampled.length - 1));
    setHover(Math.max(0, Math.min(sampled.length - 1, idx)));
  };

  const hd = hover != null ? sampled[hover] : null;
  const heq = hover != null ? eqSampled[Math.min(hover, eqSampled.length - 1)] : null;

  return (
    <div ref={ref} className="w-full h-full relative cursor-crosshair" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
      {/* Hover tooltip */}
      {hd && (
        <div className="absolute top-2 left-3 flex items-center gap-4 text-xs z-10 pointer-events-none" style={{ fontFamily: "monospace" }}>
          <span style={{ color: "#64748b" }}>{new Date(hd.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span style={{ color: "#94a3b8" }}>O {hd.open.toFixed(2)}</span>
          <span style={{ color: "#34d399" }}>H {hd.high.toFixed(2)}</span>
          <span style={{ color: "#f87171" }}>L {hd.low.toFixed(2)}</span>
          <span style={{ color: "#e2e8f0" }}>C {hd.close.toFixed(2)}</span>
          {heq && (
            <span style={{ color: template.color }}>
              Equity ${heq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      )}

      <svg width={w} height={h}>
        <defs>
          <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="eGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={template.color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={template.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map(({ val, yp }, i) => (
          <g key={i}>
            <line x1={pad.left} y1={yp} x2={w - pad.right} y2={yp} stroke="#1e293b" strokeWidth="0.5" />
            <text x={w - pad.right + 5} y={yp + 3} fill="#475569" fontSize="9" fontFamily="monospace">
              {val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`}
            </text>
          </g>
        ))}

        {Object.values(monthLabels).map((m, i) => (
          <text key={i} x={m.xp} y={h - 6} fill="#475569" fontSize="9" fontFamily="monospace" textAnchor="middle">
            {m.label}
          </text>
        ))}

        {/* Price area */}
        <path d={`${pricePath} L${x(sampled.length - 1)},${y(minP)} L${x(0)},${y(minP)} Z`} fill="url(#pGrad)" />
        <path d={pricePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.7" />

        {/* Equity curve */}
        <path d={`${eqPath} L${x(eqSampled.length - 1)},${y(minP)} L${x(0)},${y(minP)} Z`} fill="url(#eGrad)" />
        <path d={eqPath} fill="none" stroke={template.color} strokeWidth="2" opacity="0.9" />

        {/* Trade markers */}
        {tradeMarkers.map((t, i) => (
          <g key={i}>
            {t.type === "BUY" ? (
              <>
                <circle cx={x(t.si)} cy={y(t.price)} r="3.5" fill={template.color} opacity="0.9" />
                <line x1={x(t.si)} y1={y(t.price) + 4} x2={x(t.si)} y2={y(t.price) + 12} stroke={template.color} strokeWidth="0.5" opacity="0.5" />
              </>
            ) : (
              <>
                <circle cx={x(t.si)} cy={y(t.price)} r="3.5" fill={t.pnl >= 0 ? "#34d399" : "#f87171"} opacity="0.9" />
                <line x1={x(t.si)} y1={y(t.price) - 4} x2={x(t.si)} y2={y(t.price) - 12} stroke={t.pnl >= 0 ? "#34d399" : "#f87171"} strokeWidth="0.5" opacity="0.5" />
              </>
            )}
          </g>
        ))}

        {/* Hover crosshair */}
        {hover != null && (
          <>
            <line x1={x(hover)} y1={pad.top} x2={x(hover)} y2={h - pad.bottom} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
            <circle cx={x(hover)} cy={y(sampled[hover].close)} r="3" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
};

// ── Stat Card ──────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color }) => (
  <div className="px-2.5 py-1.5 rounded-lg" style={{ background: "#0d1829", border: "1px solid #1e293b" }}>
    <div className="text-[10px] mb-0.5" style={{ color: "#475569" }}>{label}</div>
    <div className="text-sm font-semibold tabular-nums" style={{ color: color || "#e2e8f0", fontFamily: "monospace" }}>{value}</div>
    {sub && <div className="text-[10px]" style={{ color: "#475569" }}>{sub}</div>}
  </div>
);

// ── Dropdown ───────────────────────────────────────────────────
const Dropdown = ({ value, options, onChange, renderOption, width = "w-32" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = renderOption ? renderOption(value) : value;

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all"
        style={{ background: "#0d1829", border: "1px solid #1e293b", color: "#e2e8f0" }}
      >
        <span className="truncate">{label}</span>
        <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "#475569" }} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full rounded-lg overflow-hidden z-50 max-h-60 overflow-y-auto" style={{ background: "#0d1829", border: "1px solid #1e293b", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          {options.map((opt) => {
            const optVal = typeof opt === "object" ? opt.symbol || opt.value : opt;
            const optLabel = renderOption ? renderOption(opt) : optVal;
            return (
              <button
                key={optVal}
                onClick={() => { onChange(optVal); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-all hover:bg-white/5"
                style={{ color: optVal === value ? "#3b82f6" : "#94a3b8" }}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Templates Gallery ──────────────────────────────────────────
const TemplatesGallery = ({ onSelect }) => (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-semibold tracking-tight" style={{ color: "#e2e8f0" }}>Strategy Templates</h2>
      <p className="text-sm mt-1" style={{ color: "#475569" }}>Select a strategy to backtest on any ticker</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {TEMPLATES.map((t, i) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="group text-left p-4 rounded-xl transition-all duration-300"
            style={{
              background: "#0a1628",
              border: "1px solid #1e293b",
              animationDelay: `${i * 60}ms`,
              animation: "fadeSlideIn 0.4s ease both",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = t.color + "50";
              e.currentTarget.style.boxShadow = `0 0 24px ${t.color}10`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1e293b";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: t.color + "12" }}>
                <Icon className="w-4.5 h-4.5" style={{ color: t.color, width: 18, height: 18 }} />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: t.color + "15", color: t.color }}>
                {t.difficulty}
              </span>
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>{t.name}</h3>
            <p className="text-xs leading-relaxed mb-3" style={{ color: "#64748b" }}>{t.description}</p>
            <div className="flex items-center gap-3 text-xs" style={{ color: "#475569" }}>
              <span>Avg <span style={{ color: "#34d399" }}>{t.avgReturn}</span></span>
              <span>•</span>
              <span>Win Rate <span style={{ color: "#94a3b8" }}>{t.winRate}</span></span>
            </div>
            <div className="mt-3 pt-3 flex items-center gap-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderTop: `1px solid #1e293b`, color: t.color }}>
              <Icons.Play style={{ width: 12, height: 12 }} />
              Run Backtest
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

// ── Strategy Detail View ───────────────────────────────────────
const StrategyDetail = ({ template, onBack }) => {
  const [ticker, setTicker] = useState("TSLA");
  const [timeframe, setTimeframe] = useState("1H");
  const [period, setPeriod] = useState("6M");
  const [capital, setCapital] = useState(100000);
  const [showTrades, setShowTrades] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [activated, setActivated] = useState(false);
  const [data, setData] = useState([]);
  const [dataSource, setDataSource] = useState("loading");
  const [fetchError, setFetchError] = useState(null);

  // Fetch real data when params change
  useEffect(() => {
    let cancelled = false;
    setIsRunning(true);
    setFetchError(null);
    setDataSource("loading");

    fetchHistoricalBars(ticker, period, timeframe).then((result) => {
      if (cancelled) return;
      setData(result.bars);
      setDataSource(result.source);
      setIsRunning(false);
    }).catch((err) => {
      if (cancelled) return;
      setFetchError(err.message);
      // Fall back to simulated
      const fallback = generateSimulatedData(ticker, period, timeframe);
      setData(fallback);
      setDataSource("simulated");
      setIsRunning(false);
    });

    return () => { cancelled = true; };
  }, [ticker, period, timeframe]);

  const result = useMemo(() => {
    if (data.length === 0) return null;
    return runBacktest(template.id, data, capital);
  }, [template.id, data, capital]);

  const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  const Icon = template.icon;

  return (
    <div style={{ animation: "fadeSlideIn 0.35s ease both" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-all hover:bg-white/5"
            style={{ border: "1px solid #1e293b" }}
          >
            <Icons.ArrowLeft className="w-4 h-4" style={{ color: "#94a3b8" }} />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: template.color + "15" }}>
            <Icon style={{ color: template.color, width: 16, height: 16 }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#e2e8f0" }}>{template.name}</h2>
            <p className="text-xs" style={{ color: "#475569" }}>{template.logic}</p>
          </div>
        </div>

        <button
          onClick={() => setActivated(true)}
          disabled={activated}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activated ? "#16a34a20" : `linear-gradient(135deg, ${template.color}, ${template.color}cc)`,
            color: activated ? "#34d399" : "#020817",
            border: activated ? "1px solid #16a34a40" : "none",
            opacity: activated ? 1 : undefined,
          }}
        >
          {activated ? (
            <>
              <Icons.Check className="w-4 h-4" />
              Strategy Activated
            </>
          ) : (
            <>
              <Icons.Play className="w-3.5 h-3.5" />
              Activate Strategy
            </>
          )}
        </button>
      </div>

      {/* Config Bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Dropdown
          value={ticker}
          options={TICKERS}
          onChange={setTicker}
          width="w-40"
          renderOption={(opt) => {
            if (typeof opt === "object") return `$${opt.symbol} — ${opt.name}`;
            const found = TICKERS.find((t) => t.symbol === opt);
            return found ? `$${found.symbol}` : opt;
          }}
        />
        <Dropdown value={timeframe} options={TIMEFRAMES} onChange={setTimeframe} width="w-20" />
        <Dropdown value={period} options={PERIODS} onChange={setPeriod} width="w-20" />

        <div className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ background: "#0d1829", border: "1px solid #1e293b" }}>
          <Icons.DollarSign className="w-3.5 h-3.5" style={{ color: "#475569" }} />
          <input
            type="text"
            value={capital.toLocaleString()}
            onChange={(e) => {
              const v = parseInt(e.target.value.replace(/,/g, ""));
              if (!isNaN(v) && v > 0) setCapital(v);
            }}
            className="w-24 bg-transparent text-sm outline-none tabular-nums"
            style={{ color: "#e2e8f0", fontFamily: "monospace" }}
          />
        </div>

        {isRunning && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: template.color }}>
            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${template.color} transparent ${template.color} ${template.color}` }} />
            Running backtest...
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs tabular-nums" style={{ fontFamily: "monospace" }}>
          <span className="px-1.5 py-0.5 rounded" style={{
            background: dataSource === "alpaca" ? "#16a34a15" : dataSource === "crypto.com" ? "#f59e0b15" : dataSource === "simulated" ? "#ef444415" : "#3b82f615",
            color: dataSource === "alpaca" ? "#34d399" : dataSource === "crypto.com" ? "#fbbf24" : dataSource === "simulated" ? "#f87171" : "#60a5fa",
            border: `1px solid ${dataSource === "alpaca" ? "#16a34a30" : dataSource === "crypto.com" ? "#f59e0b30" : dataSource === "simulated" ? "#ef444430" : "#3b82f630"}`,
          }}>
            {dataSource === "alpaca" ? "LIVE DATA" : dataSource === "crypto.com" ? "CRYPTO.COM" : dataSource === "simulated" ? "SIMULATED" : "LOADING"}
          </span>
          <span style={{ color: "#334155" }}>{data.length.toLocaleString()} candles</span>
          <span style={{ color: "#334155" }}>·</span>
          <span style={{ color: "#334155" }}>{timeframe} × {period}</span>
        </div>
      </div>

      {/* Chart - collapses when trade log is open */}
      {!showTrades && (
      <div className="rounded-xl overflow-hidden mb-3" style={{ background: "#0a1628", border: "1px solid #1e293b", opacity: isRunning ? 0.5 : 1, transition: "opacity 0.3s" }}>
        <div className="h-[340px]">
          {data.length > 0 && result ? (
            <BacktestChart data={data} result={result} template={template} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-6 h-6 mx-auto mb-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${template.color} transparent ${template.color} ${template.color}` }} />
                <span className="text-xs" style={{ color: "#475569" }}>
                  {fetchError ? `Error: ${fetchError} — using simulated data` : "Fetching market data..."}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs" style={{ borderTop: "1px solid #1e293b" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: "#3b82f6" }} />
            <span style={{ color: "#64748b" }}>Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: template.color }} />
            <span style={{ color: "#64748b" }}>Equity Curve</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: template.color }} />
            <span style={{ color: "#64748b" }}>Buy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#34d399" }} />
            <span style={{ color: "#64748b" }}>Sell (profit)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} />
            <span style={{ color: "#64748b" }}>Sell (loss)</span>
          </div>
        </div>
      </div>
      )}

      {/* Stats Grid */}
      {result && (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-3">
        <StatCard label="Total P&L" value={`${result.pnl >= 0 ? "+" : ""}${fmt(result.pnl)}`} color={result.pnl >= 0 ? "#34d399" : "#f87171"} />
        <StatCard label="Return" value={`${result.pnl >= 0 ? "+" : ""}${result.pctReturn}%`} color={result.pnl >= 0 ? "#34d399" : "#f87171"} />
        <StatCard label="Final Value" value={fmt(result.finalEquity)} />
        <StatCard label="Win Rate" value={`${result.winRate}%`} color="#94a3b8" />
        <StatCard label="Trades" value={result.totalTrades} sub={`${result.wins}W / ${result.losses}L`} />
        <StatCard label="Max Drawdown" value={`-${result.maxDD}%`} color="#f87171" />
        <StatCard label="Sharpe Ratio" value={result.sharpe} color={parseFloat(result.sharpe) > 1 ? "#34d399" : "#f59e0b"} />
        <StatCard label="Best Trade" value={`+${fmt(result.bestTrade)}`} color="#34d399" />
      </div>
      )}

      {/* Trade Log */}
      {result && (
      <div className="rounded-xl overflow-hidden" style={{ background: "#0a1628", border: "1px solid #1e293b" }}>
        <button
          onClick={() => setShowTrades(!showTrades)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-all hover:bg-white/[0.02]"
          style={{ color: "#94a3b8" }}
        >
          <div className="flex items-center gap-3">
            <span>TRADE LOG</span>
            <span className="px-1.5 py-0.5 rounded" style={{ background: "#1e293b", color: "#64748b" }}>
              {result.roundTrips.length} round-trips
            </span>
            <span className="px-1.5 py-0.5 rounded" style={{ background: result.pnl >= 0 ? "#16a34a15" : "#ef444415", color: result.pnl >= 0 ? "#34d399" : "#f87171" }}>
              {result.wins}W / {result.losses}L
            </span>
          </div>
          <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTrades ? "rotate-180" : ""}`} />
        </button>
        {showTrades && (
          <div className="overflow-x-auto" style={{ borderTop: "1px solid #1e293b" }}>
            <div className="max-h-[360px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1e293b #0a1628" }}>
              <table className="w-full text-xs" style={{ fontFamily: "monospace", minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e293b", position: "sticky", top: 0, background: "#0a1628", zIndex: 2 }}>
                    {["#", "Type", "Open", "Close", "Entry", "Exit", "Shares", "Open $", "Close $", "P&L", "P&L %", "Hold Time"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: "#475569", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.roundTrips.map((rt) => {
                    const isWin = rt.pnl >= 0;
                    const entryDt = new Date(rt.entryDate);
                    const exitDt = new Date(rt.exitDate);
                    const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

                    return (
                      <tr key={rt.id} className="transition-colors hover:bg-white/[0.02] group" style={{ borderBottom: "1px solid #0f172a08" }}>
                        {/* # */}
                        <td className="px-3 py-2 tabular-nums" style={{ color: "#334155" }}>{rt.id}</td>

                        {/* Type */}
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{
                            background: "#22d3ee12",
                            color: "#22d3ee",
                            fontSize: 10,
                            letterSpacing: "0.05em",
                          }}>
                            {rt.type}
                          </span>
                        </td>

                        {/* Open date/time */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div style={{ color: "#94a3b8" }}>{fmtDate(entryDt)}</div>
                          <div style={{ color: "#475569", fontSize: 9 }}>{fmtTime(entryDt)}</div>
                        </td>

                        {/* Close date/time */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div style={{ color: "#94a3b8" }}>{fmtDate(exitDt)}</div>
                          <div style={{ color: "#475569", fontSize: 9 }}>{fmtTime(exitDt)}</div>
                        </td>

                        {/* Entry price */}
                        <td className="px-3 py-2 tabular-nums" style={{ color: "#e2e8f0" }}>
                          ${rt.entryPrice.toFixed(2)}
                        </td>

                        {/* Exit price */}
                        <td className="px-3 py-2 tabular-nums" style={{ color: isWin ? "#34d399" : "#f87171" }}>
                          ${rt.exitPrice.toFixed(2)}
                        </td>

                        {/* Shares */}
                        <td className="px-3 py-2 tabular-nums" style={{ color: "#64748b" }}>
                          {rt.shares.toLocaleString()}
                        </td>

                        {/* Open $ value */}
                        <td className="px-3 py-2 tabular-nums" style={{ color: "#94a3b8" }}>
                          {fmt(rt.openValue)}
                        </td>

                        {/* Close $ value */}
                        <td className="px-3 py-2 tabular-nums" style={{ color: "#94a3b8" }}>
                          {fmt(rt.closeValue)}
                        </td>

                        {/* P&L $ */}
                        <td className="px-3 py-2 tabular-nums font-semibold" style={{ color: isWin ? "#34d399" : "#f87171" }}>
                          {isWin ? "+" : ""}{fmt(rt.pnl)}
                        </td>

                        {/* P&L % */}
                        <td className="px-3 py-2 tabular-nums" style={{ color: isWin ? "#34d399" : "#f87171" }}>
                          <span className="px-1.5 py-0.5 rounded" style={{ background: isWin ? "#34d39910" : "#f8717110" }}>
                            {isWin ? "+" : ""}{rt.pnlPct}%
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#475569" }}>
                          <div className="flex items-center gap-1">
                            <Icons.Clock style={{ width: 10, height: 10, color: "#334155" }} />
                            {rt.duration}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary row */}
            <div className="flex items-center justify-between px-4 py-2.5 text-xs" style={{ borderTop: "1px solid #1e293b", background: "#080f1e" }}>
              <div className="flex items-center gap-4">
                <span style={{ color: "#475569" }}>Avg Trade:</span>
                <span className="tabular-nums font-medium" style={{ color: result.avgTrade >= 0 ? "#34d399" : "#f87171", fontFamily: "monospace" }}>
                  {result.avgTrade >= 0 ? "+" : ""}{fmt(result.avgTrade)}
                </span>
                <span style={{ color: "#1e293b" }}>|</span>
                <span style={{ color: "#475569" }}>Best:</span>
                <span className="tabular-nums font-medium" style={{ color: "#34d399", fontFamily: "monospace" }}>+{fmt(result.bestTrade)}</span>
                <span style={{ color: "#1e293b" }}>|</span>
                <span style={{ color: "#475569" }}>Worst:</span>
                <span className="tabular-nums font-medium" style={{ color: "#f87171", fontFamily: "monospace" }}>{fmt(result.worstTrade)}</span>
              </div>
              <span style={{ color: "#334155" }}>{result.roundTrips.length} completed trades</span>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────
export default function StrategyTemplateFlow() {
  const [selected, setSelected] = useState(null);

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{
        background: "linear-gradient(180deg, #020817 0%, #0a1628 40%, #060d18 100%)",
        fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
      }}
    >
      {/* Subtle grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      <div className="relative z-10 p-4 lg:p-6 max-w-[1400px] mx-auto">
        {/* Content */}
        {selected ? (
          <StrategyDetail template={selected} onBack={() => setSelected(null)} />
        ) : (
          <TemplatesGallery onSelect={setSelected} />
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input[type="text"]:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a1628; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>
    </div>
  );
}
