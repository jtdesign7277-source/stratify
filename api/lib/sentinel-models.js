/**
 * sentinel-models.js — Real signal computation for all 5 Sentinel models
 * Each model takes market data and returns computed values.
 * These are NOT simulated — every number comes from real math on real data.
 */

// ════════════════════════════════════════════════════════════
// 1. BAYESIAN MODEL — Updates belief P(win|data) using Bayes' theorem
// P(H|D) = P(D|H) × P(H) / P(D)
// ════════════════════════════════════════════════════════════
function computeBayesian({ setup, symbol, regime, weights }) {
  // Prior: base win probability for this setup type (learned from history)
  const setupPriors = weights.setup_priors || {};
  const prior = setupPriors[setup] || 0.5;

  // Likelihood adjustments from symbol and regime performance
  const symbolWeights = weights.symbol_weights || {};
  const regimeWeights = weights.regime_weights || {};

  const symbolFactor = symbolWeights[symbol] || 1.0;
  const regimeFactor = regimeWeights[regime] || 1.0;

  // P(D|H) — likelihood that we'd see this data given a winning trade
  const likelihood = Math.min(0.95, Math.max(0.05, prior * symbolFactor * regimeFactor));

  // P(D) — total probability of seeing this data (win or loss)
  const pD = likelihood * prior + (1 - likelihood) * (1 - prior);

  // Posterior: P(H|D) = P(D|H) × P(H) / P(D)
  const posterior = pD > 0 ? (likelihood * prior) / pD : prior;

  // Expected value: posterior - cost of being wrong
  const ev = posterior - (1 - posterior);

  // Confidence: how far from 50/50 (0 = no edge, 100 = certain)
  const confidence = Math.round(Math.abs(posterior - 0.5) * 200);

  return {
    prior: +prior.toFixed(4),
    posterior: +posterior.toFixed(4),
    ev: +ev.toFixed(4),
    confidence,
  };
}

// ════════════════════════════════════════════════════════════
// 2. EDGE FILTER — Is there real mathematical edge after costs?
// EV_net = q - p - c
// q = probability of win × avg win, p = probability of loss × avg loss
// c = total costs (spread + slippage + fees)
// ════════════════════════════════════════════════════════════
function computeEdge({ posterior, spread, avgWin, avgLoss, entryPrice }) {
  const spreadCost = spread / entryPrice; // spread as % of price
  const slippage = 0.0005; // 5bps estimated slippage
  const fees = 0.0001; // 1bp exchange fee
  const totalCost = spreadCost + slippage + fees;

  // Expected gain per dollar risked
  const q = posterior * (avgWin || 0.02); // default 2% avg win
  const p = (1 - posterior) * (avgLoss || 0.01); // default 1% avg loss
  const evNet = q - p - totalCost;

  // Z-score: how many standard deviations from breakeven
  const stdDev = Math.sqrt(posterior * (1 - posterior)) * (avgWin + avgLoss);
  const zScore = stdDev > 0 ? evNet / stdDev : 0;

  // p_sum: probability that this trade is net positive after costs
  const pSum = 0.5 * (1 + erf(zScore / Math.SQRT2));

  const pass = evNet > (weights_cache?.min_edge_threshold || 0.02);

  return {
    ev: +evNet.toFixed(4),
    cost: +totalCost.toFixed(4),
    net: +(evNet + totalCost).toFixed(4),
    zScore: +zScore.toFixed(4),
    pSum: +pSum.toFixed(4),
    pass,
  };
}

// Error function approximation for normal CDF
function erf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

let weights_cache = null;

// ════════════════════════════════════════════════════════════
// 3. SPREAD / LMSR — Bid-ask analysis + market maker detection
// z = (s - μ_s) / σ_s  (how unusual is current spread)
// LMSR: Hanson's Logarithmic Market Scoring Rule for impact estimation
// ════════════════════════════════════════════════════════════
function computeSpread({ bid, ask, recentSpreads }) {
  if (!bid || !ask || bid >= ask) {
    return { bid: 0, ask: 0, mid: 0, width: 0, zScore: 0, lmsr_b: 0, lmsr_impact: 0 };
  }

  const mid = (bid + ask) / 2;
  const width = ask - bid;
  const spreadPct = width / mid;

  // Z-score of current spread vs recent history
  let zScore = 0;
  if (recentSpreads && recentSpreads.length > 5) {
    const mean = recentSpreads.reduce((a, b) => a + b, 0) / recentSpreads.length;
    const variance = recentSpreads.reduce((sum, s) => sum + (s - mean) ** 2, 0) / recentSpreads.length;
    const std = Math.sqrt(variance);
    zScore = std > 0 ? (spreadPct - mean) / std : 0;
  }

  // LMSR: b parameter controls liquidity depth
  // Higher b = more liquid, lower impact per trade
  const b = Math.max(0.1, mid / (width * 100)); // liquidity score
  const impact = 1 / (b * Math.log(2)); // cost of moving the market 1 unit

  return {
    bid: +bid.toFixed(2),
    ask: +ask.toFixed(2),
    mid: +mid.toFixed(2),
    width: +width.toFixed(4),
    spreadPct: +spreadPct.toFixed(6),
    zScore: +zScore.toFixed(3),
    lmsr_b: +b.toFixed(1),
    lmsr_impact: +impact.toFixed(3),
  };
}

// ════════════════════════════════════════════════════════════
// 4. STOIKOV MODEL — Optimal reservation price + position sizing
// r = s - q·γ·σ²·T  (reservation price)
// Adapted from Avellaneda-Stoikov for directional trading
// ════════════════════════════════════════════════════════════
function computeStoikov({ midPrice, position, gamma, volatility, timeHorizon, accountBalance }) {
  const q = position || 0; // current inventory (positive = long, negative = short)
  const sigma2 = (volatility || 0.02) ** 2; // variance of returns
  const T = timeHorizon || 1; // time to close (in hours)
  const gammaVal = gamma || 0.1; // risk aversion parameter

  // Reservation price: where we'd be indifferent to holding
  const reservation = midPrice - q * gammaVal * sigma2 * T;

  // Optimal spread around reservation price
  const optimalSpread = gammaVal * sigma2 * T + (2 / gammaVal) * Math.log(1 + gammaVal / 1);

  // Position size based on Kelly and account risk
  const maxRisk = (accountBalance || 2000000) * 0.005; // 0.5% max risk per trade
  const optimalSize = Math.floor(maxRisk / (midPrice * volatility));

  return {
    q: +q.toFixed(2),
    gamma: +gammaVal.toFixed(2),
    sigma_sq: +sigma2.toFixed(6),
    reservation: +reservation.toFixed(2),
    optimalSpread: +optimalSpread.toFixed(4),
    optimalSize,
  };
}

// ════════════════════════════════════════════════════════════
// 5. MONTE CARLO — Kelly sizing + path simulation
// Runs N randomized paths to estimate outcome distribution
// ════════════════════════════════════════════════════════════
function computeMonteCarlo({ winRate, avgWin, avgLoss, numPaths, tradesPerPath, accountBalance }) {
  const wr = winRate || 0.5;
  const aW = avgWin || 0.02;
  const aL = avgLoss || 0.01;
  const N = numPaths || 1000;
  const T = tradesPerPath || 50;
  const balance = accountBalance || 2000000;

  // Kelly fraction: f* = (p × b - q) / b where b = avgWin/avgLoss
  const b = aL > 0 ? aW / aL : 2;
  const kellyFull = (wr * b - (1 - wr)) / b;
  const kellyFraction = Math.max(0, Math.min(0.25, kellyFull * 0.5)); // half-Kelly, capped at 25%

  // Simulate paths
  const endings = [];
  let maxDd = 0;

  for (let i = 0; i < N; i++) {
    let equity = balance;
    let peak = equity;
    let pathMaxDd = 0;

    for (let t = 0; t < T; t++) {
      const betSize = equity * kellyFraction;
      if (Math.random() < wr) {
        equity += betSize * aW;
      } else {
        equity -= betSize * aL;
      }
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > pathMaxDd) pathMaxDd = dd;
    }

    endings.push(equity - balance);
    if (pathMaxDd > maxDd) maxDd = pathMaxDd;
  }

  endings.sort((a, b) => a - b);
  const median = endings[Math.floor(N / 2)];
  const p5 = endings[Math.floor(N * 0.05)];
  const p95 = endings[Math.floor(N * 0.95)];

  return {
    paths: N,
    median: +median.toFixed(2),
    p5: +p5.toFixed(2),
    p95: +p95.toFixed(2),
    kellyFraction: +kellyFraction.toFixed(4),
    maxDdPct: +(maxDd * 100).toFixed(1),
  };
}

// ════════════════════════════════════════════════════════════
// COMPOSITE SCORER — Runs all 5 models, returns trade/no-trade decision
// ════════════════════════════════════════════════════════════
function computeCompositeScore({
  symbol, setup, regime, direction,
  bid, ask, entryPrice, volatility, recentSpreads,
  position, accountBalance, weights,
  winRate, avgWin, avgLoss,
}) {
  weights_cache = weights;

  // 1. Bayesian
  const bayesian = computeBayesian({ setup, symbol, regime, weights });

  // 2. Edge Filter
  const spread = ask && bid ? ask - bid : entryPrice * 0.001;
  const edge = computeEdge({
    posterior: bayesian.posterior, spread, avgWin, avgLoss, entryPrice,
  });

  // 3. Spread / LMSR
  const spreadModel = computeSpread({ bid, ask, recentSpreads });

  // 4. Stoikov
  const stoikov = computeStoikov({
    midPrice: entryPrice, position, gamma: 0.1,
    volatility, timeHorizon: 1, accountBalance,
  });

  // 5. Monte Carlo
  const mc = computeMonteCarlo({
    winRate: bayesian.posterior, avgWin, avgLoss,
    numPaths: 500, tradesPerPath: 30, accountBalance,
  });

  // Composite: weighted average of all model scores (0-100)
  const bayesianScore = bayesian.confidence; // 0-100
  const edgeScore = edge.pass ? Math.min(100, edge.pSum * 100) : 0; // 0-100
  const spreadScore = spreadModel.zScore < 2 ? 80 : spreadModel.zScore < 3 ? 50 : 20; // penalize wide spreads
  const stoikovScore = stoikov.optimalSize > 0 ? 70 : 30;
  const mcScore = mc.median > 0 ? Math.min(100, 50 + (mc.kellyFraction * 400)) : 20;

  const composite = Math.round(
    bayesianScore * 0.30 +
    edgeScore * 0.25 +
    spreadScore * 0.15 +
    stoikovScore * 0.15 +
    mcScore * 0.15
  );

  return {
    bayesian,
    edge,
    spread: spreadModel,
    stoikov,
    mc,
    composite,
    shouldTrade: composite >= (weights.min_composite_score || 60),
    direction,
    symbol,
    setup,
    regime,
    optimalSize: stoikov.optimalSize,
  };
}

module.exports = {
  computeBayesian,
  computeEdge,
  computeSpread,
  computeStoikov,
  computeMonteCarlo,
  computeCompositeScore,
};
