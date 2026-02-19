import { useCallback, useEffect, useMemo, useState } from 'react';

export const INDICATOR_OPTIONS = Object.freeze([
  { id: 'rsi', label: 'RSI' },
  { id: 'macd', label: 'MACD' },
  { id: 'bbands', label: 'Bollinger Bands' },
  { id: 'ema', label: 'EMA' },
  { id: 'sma', label: 'SMA' },
  { id: 'stoch', label: 'Stochastic' },
  { id: 'adx', label: 'ADX' },
  { id: 'atr', label: 'ATR' },
  { id: 'supertrend', label: 'Supertrend' },
  { id: 'obv', label: 'OBV' },
  { id: 'ichimoku', label: 'Ichimoku' },
]);

export const STRATEGY_INDICATOR_MAP = Object.freeze({
  momentum: ['ema', 'sma', 'adx', 'atr'],
  rsi: ['rsi', 'stoch', 'bbands'],
  'mean-reversion': ['rsi', 'bbands', 'sma'],
  meanreversion: ['rsi', 'bbands', 'sma'],
  meanrev: ['rsi', 'bbands', 'sma'],
  breakout: ['adx', 'atr', 'obv', 'supertrend'],
  macd: ['macd', 'ema', 'sma'],
  scalping: ['rsi', 'macd', 'ema', 'atr', 'supertrend'],
  scalp: ['rsi', 'macd', 'ema', 'atr', 'supertrend'],
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeIndicatorName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const normalizeIndicatorList = (value) => {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  return source
    .map((item) => normalizeIndicatorName(item))
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const normalizeTemplateId = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z-]/g, '');

const getLatest = (payload) => payload?.latest || payload?.value || null;
const getPrevious = (payload) => payload?.previous || payload?.values?.[1] || null;

const addVote = (target, direction, reason, weight = 1) => {
  target[direction] += weight;
  target.reasons.push({ direction, reason, weight });
};

export const evaluateSignals = (indicatorData = {}) => {
  const votes = {
    buy: 0,
    sell: 0,
    hold: 0,
    reasons: [],
  };

  const rsi = toNumber(getLatest(indicatorData.rsi)?.rsi);
  if (rsi !== null) {
    if (rsi < 35) addVote(votes, 'buy', `RSI ${rsi.toFixed(2)} is oversold`, 2);
    else if (rsi > 65) addVote(votes, 'sell', `RSI ${rsi.toFixed(2)} is overbought`, 2);
    else addVote(votes, 'hold', `RSI ${rsi.toFixed(2)} is neutral`, 1);
  }

  const macdLatest = getLatest(indicatorData.macd);
  const macd = toNumber(macdLatest?.macd);
  const macdSignal = toNumber(macdLatest?.macd_signal ?? macdLatest?.signal);
  const macdHist = toNumber(macdLatest?.macd_hist ?? macdLatest?.histogram);
  if (macd !== null && macdSignal !== null) {
    if (macd > macdSignal && (macdHist === null || macdHist >= 0)) {
      addVote(votes, 'buy', 'MACD is above signal line', 2);
    } else if (macd < macdSignal && (macdHist === null || macdHist <= 0)) {
      addVote(votes, 'sell', 'MACD is below signal line', 2);
    } else {
      addVote(votes, 'hold', 'MACD crossover is indecisive', 1);
    }
  }

  const stochLatest = getLatest(indicatorData.stoch);
  const stochK = toNumber(stochLatest?.slow_k ?? stochLatest?.stoch_k ?? stochLatest?.k);
  const stochD = toNumber(stochLatest?.slow_d ?? stochLatest?.stoch_d ?? stochLatest?.d);
  if (stochK !== null && stochD !== null) {
    if (stochK < 20 && stochD < 20) addVote(votes, 'buy', 'Stochastic indicates oversold momentum', 1.5);
    else if (stochK > 80 && stochD > 80) addVote(votes, 'sell', 'Stochastic indicates overbought momentum', 1.5);
    else addVote(votes, 'hold', 'Stochastic is mid-range', 1);
  }

  const ema = toNumber(getLatest(indicatorData.ema)?.ema);
  const sma = toNumber(getLatest(indicatorData.sma)?.sma);
  if (ema !== null && sma !== null) {
    if (ema > sma) addVote(votes, 'buy', 'EMA is above SMA (bullish trend)', 1.5);
    else if (ema < sma) addVote(votes, 'sell', 'EMA is below SMA (bearish trend)', 1.5);
    else addVote(votes, 'hold', 'EMA and SMA are aligned', 1);
  }

  const bbandsLatest = getLatest(indicatorData.bbands);
  const bbUpper = toNumber(bbandsLatest?.upper_band);
  const bbLower = toNumber(bbandsLatest?.lower_band);
  const bbMiddle = toNumber(bbandsLatest?.middle_band);
  const bbClose = toNumber(bbandsLatest?.close);
  if (bbUpper !== null && bbLower !== null && bbClose !== null) {
    if (bbClose <= bbLower) addVote(votes, 'buy', 'Price is at lower Bollinger Band', 1.5);
    else if (bbClose >= bbUpper) addVote(votes, 'sell', 'Price is at upper Bollinger Band', 1.5);
    else if (bbMiddle !== null) addVote(votes, 'hold', 'Price is within Bollinger range', 0.8);
  }

  const adxLatest = getLatest(indicatorData.adx);
  const adx = toNumber(adxLatest?.adx);
  const plusDi = toNumber(adxLatest?.plus_di);
  const minusDi = toNumber(adxLatest?.minus_di);
  if (adx !== null && plusDi !== null && minusDi !== null) {
    if (adx >= 20 && plusDi > minusDi) addVote(votes, 'buy', `ADX ${adx.toFixed(2)} confirms bullish trend`, 1.2);
    else if (adx >= 20 && minusDi > plusDi) addVote(votes, 'sell', `ADX ${adx.toFixed(2)} confirms bearish trend`, 1.2);
    else addVote(votes, 'hold', 'ADX shows weak trend strength', 0.8);
  }

  const supertrendLatest = getLatest(indicatorData.supertrend);
  const stValue = toNumber(supertrendLatest?.supertrend);
  const stClose = toNumber(supertrendLatest?.close);
  const stTrend = String(supertrendLatest?.trend || '').toLowerCase();
  if (stTrend) {
    if (stTrend.includes('up')) addVote(votes, 'buy', 'Supertrend is bullish', 1.3);
    else if (stTrend.includes('down')) addVote(votes, 'sell', 'Supertrend is bearish', 1.3);
  } else if (stValue !== null && stClose !== null) {
    if (stClose > stValue) addVote(votes, 'buy', 'Price is above Supertrend', 1.3);
    else if (stClose < stValue) addVote(votes, 'sell', 'Price is below Supertrend', 1.3);
  }

  const obvLatest = toNumber(getLatest(indicatorData.obv)?.obv);
  const obvPrevious = toNumber(getPrevious(indicatorData.obv)?.obv);
  if (obvLatest !== null && obvPrevious !== null) {
    if (obvLatest > obvPrevious) addVote(votes, 'buy', 'OBV is rising (volume confirmation)', 1);
    else if (obvLatest < obvPrevious) addVote(votes, 'sell', 'OBV is falling (volume divergence)', 1);
    else addVote(votes, 'hold', 'OBV is flat', 0.5);
  }

  const atr = toNumber(getLatest(indicatorData.atr)?.atr);
  if (atr !== null) {
    if (atr > 0) addVote(votes, 'hold', `ATR ${atr.toFixed(2)} gauges volatility`, 0.4);
  }

  const ichimokuLatest = getLatest(indicatorData.ichimoku);
  const conversionLine = toNumber(ichimokuLatest?.conversion_line);
  const baseLine = toNumber(ichimokuLatest?.base_line);
  if (conversionLine !== null && baseLine !== null) {
    if (conversionLine > baseLine) addVote(votes, 'buy', 'Ichimoku conversion line crossed above base line', 1.2);
    else if (conversionLine < baseLine) addVote(votes, 'sell', 'Ichimoku conversion line crossed below base line', 1.2);
  }

  const buy = votes.buy;
  const sell = votes.sell;
  const hold = votes.hold;
  const total = buy + sell + hold;

  let signal = 'HOLD';
  let dominant = hold;

  if (buy > sell && buy > hold) {
    signal = 'BUY';
    dominant = buy;
  } else if (sell > buy && sell > hold) {
    signal = 'SELL';
    dominant = sell;
  }

  const confidence = total > 0 ? Math.round((dominant / total) * 100) : 50;

  return {
    signal,
    confidence: Math.max(35, Math.min(confidence, 99)),
    votes: { buy, sell, hold },
    reasons: votes.reasons,
    totalWeight: total,
    computedAt: new Date().toISOString(),
  };
};

export function useIndicator({
  symbol,
  indicator,
  interval = '1day',
  outputsize = 2,
  enabled = true,
  params = {},
} = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizedIndicator = normalizeIndicatorName(indicator);
  const normalizedSymbol = String(symbol || '').trim().toUpperCase().replace(/^\$/, '');

  const fetchIndicatorData = useCallback(async () => {
    if (!enabled || !normalizedIndicator || !normalizedSymbol) {
      setData(null);
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        symbol: normalizedSymbol,
        interval,
        outputsize: String(outputsize),
      });

      Object.entries(params || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        query.set(key, String(value));
      });

      const response = await fetch(`/api/indicators/${normalizedIndicator}?${query.toString()}`, {
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to fetch ${normalizedIndicator}`);
      }

      const next = payload?.data || null;
      setData(next);
      return next;
    } catch (fetchError) {
      setError(fetchError?.message || 'Indicator request failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, interval, normalizedIndicator, normalizedSymbol, outputsize, params]);

  useEffect(() => {
    fetchIndicatorData();
  }, [fetchIndicatorData]);

  return {
    data,
    loading,
    error,
    refresh: fetchIndicatorData,
  };
}

export function useStrategyIndicators({
  symbol,
  templateId,
  indicators = [],
  interval = '1day',
  outputsize = 2,
  enabled = true,
} = {}) {
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizedTemplateId = normalizeTemplateId(templateId);

  const indicatorList = useMemo(() => {
    const explicit = normalizeIndicatorList(indicators);
    if (explicit.length > 0) return explicit;
    return normalizeIndicatorList(STRATEGY_INDICATOR_MAP[normalizedTemplateId] || []);
  }, [indicators, normalizedTemplateId]);

  const normalizedSymbol = String(symbol || '').trim().toUpperCase().replace(/^\$/, '');

  const fetchBatch = useCallback(async () => {
    if (!enabled || !normalizedSymbol || indicatorList.length === 0) {
      setData({});
      setErrors({});
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/indicators/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: normalizedSymbol,
          interval,
          outputsize,
          indicators: indicatorList,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch indicators');
      }

      const nextData = payload?.data || {};
      setData(nextData);
      setErrors(payload?.errors || {});

      if (Object.keys(nextData).length === 0) {
        setError('No indicator data returned.');
      }

      return nextData;
    } catch (fetchError) {
      setError(fetchError?.message || 'Indicator batch request failed');
      setData({});
      setErrors({});
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, indicatorList, interval, normalizedSymbol, outputsize]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  const evaluation = useMemo(() => evaluateSignals(data), [data]);

  return {
    indicatorList,
    data,
    errors,
    loading,
    error,
    evaluation,
    signal: evaluation.signal,
    confidence: evaluation.confidence,
    refresh: fetchBatch,
  };
}

