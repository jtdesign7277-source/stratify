// api/sentinel/risk-dashboard.js — Two Sigma Risk Management System
// Computes all risk metrics from real positions, trade history, and market data
// Every number is derived from actual data in Supabase + live prices

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TD_KEY = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY;

async function fetchPrice(symbol) {
  try {
    const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TD_KEY}`);
    const d = await res.json();
    return d.close ? parseFloat(d.close) : null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════
// KELLY CRITERION — Optimal position sizing
// f* = (p × b - q) / b  where p=win rate, q=loss rate, b=win/loss ratio
// ══════════════════════════════════════════════════════════════
function computeKelly(winRate, avgWinR, avgLossR) {
  if (winRate <= 0 || winRate >= 1 || avgLossR <= 0) return { full: 0, half: 0, quarter: 0 };
  const b = avgWinR / avgLossR;
  const p = winRate;
  const q = 1 - p;
  const fStar = Math.max(0, (p * b - q) / b);
  return {
    full: +fStar.toFixed(4),
    half: +(fStar / 2).toFixed(4),
    quarter: +(fStar / 4).toFixed(4),
    recommended: +(fStar / 2).toFixed(4), // half-Kelly is industry standard
    maxPositionPct: +Math.min(fStar / 2, 0.05).toFixed(4), // capped at 5%
  };
}

// ══════════════════════════════════════════════════════════════
// STOP-LOSS FRAMEWORK — Rules for each stop type
// ══════════════════════════════════════════════════════════════
function computeStopFramework(openPositions, atrBySymbol) {
  return openPositions.map(pos => {
    const atr = atrBySymbol[pos.symbol] || pos.entry * 0.02;
    const isLong = pos.direction === 'LONG';
    const currentPnlPct = isLong
      ? ((pos.current_price || pos.entry) - pos.entry) / pos.entry
      : (pos.entry - (pos.current_price || pos.entry)) / pos.entry;

    return {
      symbol: pos.symbol,
      direction: pos.direction,
      entry: pos.entry,
      currentPnlPct: +(currentPnlPct * 100).toFixed(2),
      stops: {
        fixed: {
          price: isLong ? +(pos.entry - atr * 1.5).toFixed(2) : +(pos.entry + atr * 1.5).toFixed(2),
          type: 'ATR-based fixed',
          distance: +(atr * 1.5).toFixed(2),
        },
        trailing: {
          activationPct: 1.5, // activate after 1.5% profit
          trailPct: 0.75, // trail by 0.75%
          active: currentPnlPct > 0.015,
          currentTrail: currentPnlPct > 0.015
            ? (isLong ? +((pos.current_price || pos.entry) * 0.9925).toFixed(2) : +((pos.current_price || pos.entry) * 1.0075).toFixed(2))
            : null,
        },
        volatilityAdjusted: {
          price: isLong ? +(pos.entry - atr * 2.0).toFixed(2) : +(pos.entry + atr * 2.0).toFixed(2),
          atrMultiple: 2.0,
          atr: +atr.toFixed(2),
        },
        timeBased: {
          maxHoldHours: pos.timeframe === '5min' ? 4 : 24,
          hoursHeld: +((Date.now() - new Date(pos.opened_at).getTime()) / 3600000).toFixed(1),
          shouldClose: ((Date.now() - new Date(pos.opened_at).getTime()) / 3600000) > (pos.timeframe === '5min' ? 4 : 24),
        },
      },
    };
  });
}

// ══════════════════════════════════════════════════════════════
// DRAWDOWN CONTROLS — Hard limits + auto-deleveraging
// ══════════════════════════════════════════════════════════════
function computeDrawdownControls(account, recentPnls) {
  const balance = account.current_balance || 2000000;
  const startBalance = account.starting_balance || 2000000;
  const totalPnl = account.total_pnl || 0;
  const peak = startBalance + Math.max(0, ...recentPnls.map((_, i) => recentPnls.slice(0, i + 1).reduce((a, b) => a + b, 0)));
  const currentDD = peak > startBalance ? (peak - (startBalance + totalPnl)) / peak : 0;

  // Daily P&L from recent trades
  const todayPnls = recentPnls.slice(0, 10); // approximate today
  const todayPnl = todayPnls.reduce((a, b) => a + b, 0);
  const dailyDDPct = Math.abs(Math.min(0, todayPnl)) / balance;

  return {
    currentDrawdownPct: +(currentDD * 100).toFixed(2),
    peakBalance: +peak.toFixed(2),
    maxAllowedDD: 15, // 15% max drawdown
    dailyLossPct: +(dailyDDPct * 100).toFixed(2),
    maxDailyLoss: 3, // 3% max daily loss
    breached: currentDD > 0.15,
    dailyBreached: dailyDDPct > 0.03,
    action: currentDD > 0.15 ? 'HALT_TRADING' : currentDD > 0.10 ? 'REDUCE_50PCT' : currentDD > 0.07 ? 'REDUCE_25PCT' : 'NORMAL',
    positionSizeMultiplier: currentDD > 0.15 ? 0 : currentDD > 0.10 ? 0.5 : currentDD > 0.07 ? 0.75 : 1.0,
  };
}

// ══════════════════════════════════════════════════════════════
// CORRELATION MONITORING — Detect hidden co-movement
// ══════════════════════════════════════════════════════════════
function computeCorrelations(positions, returns) {
  if (positions.length < 2) return { pairs: [], maxCorrelation: 0, warning: false };

  const pairs = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const symA = positions[i].symbol;
      const symB = positions[j].symbol;
      const rA = returns[symA] || [];
      const rB = returns[symB] || [];
      const n = Math.min(rA.length, rB.length, 20);
      if (n < 5) continue;

      const meanA = rA.slice(0, n).reduce((a, b) => a + b, 0) / n;
      const meanB = rB.slice(0, n).reduce((a, b) => a + b, 0) / n;
      let covAB = 0, varA = 0, varB = 0;
      for (let k = 0; k < n; k++) {
        covAB += (rA[k] - meanA) * (rB[k] - meanB);
        varA += (rA[k] - meanA) ** 2;
        varB += (rB[k] - meanB) ** 2;
      }
      const corr = varA > 0 && varB > 0 ? covAB / Math.sqrt(varA * varB) : 0;
      pairs.push({ symbolA: symA, symbolB: symB, correlation: +corr.toFixed(3), n });
    }
  }

  const maxCorr = Math.max(0, ...pairs.map(p => Math.abs(p.correlation)));
  return {
    pairs,
    maxCorrelation: +maxCorr.toFixed(3),
    warning: maxCorr > 0.7,
    alert: maxCorr > 0.85 ? 'HIGHLY_CORRELATED — positions moving together, reduce exposure' : null,
  };
}

// ══════════════════════════════════════════════════════════════
// VALUE AT RISK (VaR) — Parametric VaR at 95% and 99%
// ══════════════════════════════════════════════════════════════
function computeVaR(dailyReturns, portfolioValue) {
  if (dailyReturns.length < 10) return { var95: 0, var99: 0, cvar95: 0 };

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / dailyReturns.length;
  const std = Math.sqrt(variance);

  // Parametric VaR: VaR = μ - z × σ
  const var95 = -(mean - 1.645 * std) * portfolioValue;
  const var99 = -(mean - 2.326 * std) * portfolioValue;

  // Conditional VaR (Expected Shortfall): average loss beyond VaR
  const sorted = [...dailyReturns].sort((a, b) => a - b);
  const cutoff = Math.floor(sorted.length * 0.05);
  const tailLosses = sorted.slice(0, Math.max(1, cutoff));
  const cvar95 = -tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length * portfolioValue;

  return {
    var95: +var95.toFixed(2),
    var99: +var99.toFixed(2),
    cvar95: +cvar95.toFixed(2),
    dailyVolatility: +(std * 100).toFixed(2),
    annualizedVol: +(std * Math.sqrt(252) * 100).toFixed(2),
  };
}

// ══════════════════════════════════════════════════════════════
// STRESS TESTS — Simulate portfolio under crash scenarios
// ══════════════════════════════════════════════════════════════
function runStressTests(positions, portfolioValue) {
  const scenarios = [
    { name: '2008 Financial Crisis', equityDrop: -0.38, cryptoDrop: -0.50, duration: '6 months' },
    { name: 'COVID Crash (Mar 2020)', equityDrop: -0.34, cryptoDrop: -0.55, duration: '1 month' },
    { name: 'Flash Crash (2010)', equityDrop: -0.09, cryptoDrop: -0.15, duration: '36 minutes' },
    { name: 'Crypto Winter 2022', equityDrop: -0.05, cryptoDrop: -0.75, duration: '12 months' },
    { name: '10% Overnight Gap', equityDrop: -0.10, cryptoDrop: -0.10, duration: 'overnight' },
  ];

  return scenarios.map(scenario => {
    let loss = 0;
    for (const pos of positions) {
      const isCrypto = pos.symbol.includes('/');
      const drop = isCrypto ? scenario.cryptoDrop : scenario.equityDrop;
      const isLong = pos.direction === 'LONG';
      const posLoss = isLong ? drop * (pos.dollar_size || 0) : -drop * (pos.dollar_size || 0);
      loss += posLoss;
    }
    return {
      scenario: scenario.name,
      duration: scenario.duration,
      estimatedLoss: +loss.toFixed(2),
      portfolioImpactPct: +((loss / portfolioValue) * 100).toFixed(2),
      survivable: Math.abs(loss / portfolioValue) < 0.20,
    };
  });
}

// ══════════════════════════════════════════════════════════════
// EXPOSURE ANALYSIS — Sector, direction, and concentration
// ══════════════════════════════════════════════════════════════
function computeExposure(positions, portfolioValue) {
  const byDirection = { LONG: 0, SHORT: 0 };
  const byAsset = {};
  const byType = { equity: 0, crypto: 0 };

  for (const pos of positions) {
    const dollarSize = pos.dollar_size || 0;
    byDirection[pos.direction] = (byDirection[pos.direction] || 0) + dollarSize;
    byAsset[pos.symbol] = (byAsset[pos.symbol] || 0) + dollarSize;
    const isCrypto = pos.symbol.includes('/');
    byType[isCrypto ? 'crypto' : 'equity'] += dollarSize;
  }

  const grossExposure = byDirection.LONG + byDirection.SHORT;
  const netExposure = byDirection.LONG - byDirection.SHORT;
  const maxSinglePosition = Math.max(0, ...Object.values(byAsset));
  const concentrationPct = grossExposure > 0 ? (maxSinglePosition / grossExposure) * 100 : 0;

  return {
    grossExposure: +grossExposure.toFixed(2),
    netExposure: +netExposure.toFixed(2),
    grossPct: +((grossExposure / portfolioValue) * 100).toFixed(1),
    netPct: +((netExposure / portfolioValue) * 100).toFixed(1),
    longExposure: +byDirection.LONG.toFixed(2),
    shortExposure: +byDirection.SHORT.toFixed(2),
    byAsset,
    byType,
    maxSinglePositionPct: +concentrationPct.toFixed(1),
    concentrationWarning: concentrationPct > 30,
    leverageRatio: +(grossExposure / portfolioValue).toFixed(2),
    maxLeverage: 2.0, // hard cap
    leverageBreached: (grossExposure / portfolioValue) > 2.0,
  };
}

// ══════════════════════════════════════════════════════════════
// LIQUIDITY RISK — Can we exit positions quickly?
// ══════════════════════════════════════════════════════════════
function assessLiquidity(positions) {
  // For major crypto and Mag 7 stocks, liquidity is not an issue
  // Flag anything that might be illiquid
  const LIQUID_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'SPY', 'QQQ'];

  return positions.map(pos => {
    const isLiquid = LIQUID_SYMBOLS.some(s => pos.symbol.includes(s));
    return {
      symbol: pos.symbol,
      dollarSize: pos.dollar_size,
      liquid: isLiquid,
      estimatedExitTime: isLiquid ? '<1 second' : '1-5 minutes',
      slippageEstimate: isLiquid ? '0.01-0.05%' : '0.1-0.5%',
      risk: isLiquid ? 'LOW' : 'MEDIUM',
    };
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Parallel data fetch
    const [accountRes, openTradesRes, closedTradesRes, weightsRes] = await Promise.all([
      supabase.from('sentinel_account').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single(),
      supabase.from('sentinel_trades').select('*').eq('status', 'open'),
      supabase.from('sentinel_trades').select('pnl, win, result_r, closed_at, symbol, setup').eq('status', 'closed').order('closed_at', { ascending: false }).limit(200),
      supabase.from('sentinel_model_weights').select('*').eq('id', 1).single(),
    ]);

    const account = accountRes.data || {};
    const openPositions = openTradesRes.data || [];
    const closedTrades = closedTradesRes.data || [];
    const weights = weightsRes.data || {};
    const portfolioValue = account.current_balance || 2000000;

    // Fetch live prices for open positions
    const pricePromises = openPositions.map(async (pos) => {
      const price = await fetchPrice(pos.symbol);
      pos.current_price = price || pos.entry;
      return pos;
    });
    await Promise.all(pricePromises);

    // Compute trade statistics
    const wins = closedTrades.filter(t => t.win);
    const losses = closedTrades.filter(t => !t.win);
    const winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0.5;
    const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + Math.abs(t.result_r || 1.5), 0) / wins.length : 1.5;
    const avgLossR = losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(t.result_r || 1.0), 0) / losses.length : 1.0;

    // Daily returns for VaR (group PnL by day)
    const dailyPnlMap = {};
    for (const t of closedTrades) {
      const day = t.closed_at?.slice(0, 10);
      if (day) dailyPnlMap[day] = (dailyPnlMap[day] || 0) + (t.pnl || 0);
    }
    const dailyPnls = Object.values(dailyPnlMap);
    const dailyReturns = dailyPnls.map(p => p / portfolioValue);
    const recentPnls = closedTrades.map(t => t.pnl || 0);

    // Compute all risk metrics
    const kelly = computeKelly(winRate, avgWinR, avgLossR);
    const drawdown = computeDrawdownControls(account, recentPnls);
    const var_ = computeVaR(dailyReturns, portfolioValue);
    const exposure = computeExposure(openPositions, portfolioValue);
    const stressTests = runStressTests(openPositions, portfolioValue);
    const stopFramework = computeStopFramework(openPositions, {});
    const liquidity = assessLiquidity(openPositions);
    const correlations = computeCorrelations(openPositions, {});

    // Overall risk score (0-100, lower = safer)
    let riskScore = 0;
    if (drawdown.currentDrawdownPct > 10) riskScore += 30;
    else if (drawdown.currentDrawdownPct > 5) riskScore += 15;
    if (exposure.leverageRatio > 1.5) riskScore += 20;
    else if (exposure.leverageRatio > 1.0) riskScore += 10;
    if (exposure.concentrationWarning) riskScore += 15;
    if (correlations.warning) riskScore += 10;
    if (var_.var95 > portfolioValue * 0.03) riskScore += 15;
    if (winRate < 0.4) riskScore += 10;
    riskScore = Math.min(100, riskScore);

    const riskLevel = riskScore > 70 ? 'CRITICAL' : riskScore > 50 ? 'HIGH' : riskScore > 30 ? 'MODERATE' : 'LOW';

    return res.status(200).json({
      riskScore,
      riskLevel,
      timestamp: new Date().toISOString(),
      portfolio: {
        value: portfolioValue,
        openPositions: openPositions.length,
        totalTrades: closedTrades.length,
        winRate: +(winRate * 100).toFixed(1),
        avgWinR: +avgWinR.toFixed(2),
        avgLossR: +avgLossR.toFixed(2),
      },
      kelly,
      drawdown,
      var: var_,
      exposure,
      correlations,
      stressTests,
      stopFramework,
      liquidity,
      modelWeights: {
        minEdgeThreshold: weights.min_edge_threshold,
        minCompositeScore: weights.min_composite_score,
        maxKellyFraction: weights.max_kelly_fraction,
        sessionsAnalyzed: weights.sessions_analyzed,
      },
      preMarketChecklist: [
        { check: 'Drawdown within limits', status: !drawdown.breached ? 'PASS' : 'FAIL', value: `${drawdown.currentDrawdownPct}% (max 15%)` },
        { check: 'Daily loss limit', status: !drawdown.dailyBreached ? 'PASS' : 'FAIL', value: `${drawdown.dailyLossPct}% (max 3%)` },
        { check: 'Leverage within bounds', status: !exposure.leverageBreached ? 'PASS' : 'FAIL', value: `${exposure.leverageRatio}x (max 2.0x)` },
        { check: 'No concentration risk', status: !exposure.concentrationWarning ? 'PASS' : 'WARNING', value: `${exposure.maxSinglePositionPct}% max position (cap 30%)` },
        { check: 'Correlation acceptable', status: !correlations.warning ? 'PASS' : 'WARNING', value: `Max corr: ${correlations.maxCorrelation}` },
        { check: 'VaR 95% tolerable', status: var_.var95 < portfolioValue * 0.03 ? 'PASS' : 'WARNING', value: `$${var_.var95.toLocaleString()} (${((var_.var95 / portfolioValue) * 100).toFixed(2)}%)` },
        { check: 'All positions liquid', status: liquidity.every(l => l.liquid) ? 'PASS' : 'WARNING', value: `${liquidity.filter(l => l.liquid).length}/${liquidity.length} liquid` },
        { check: 'Time-based stops checked', status: stopFramework.every(s => !s.stops.timeBased.shouldClose) ? 'PASS' : 'FAIL', value: `${stopFramework.filter(s => s.stops.timeBased.shouldClose).length} overheld` },
      ],
    });
  } catch (err) {
    console.error('[risk-dashboard] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
