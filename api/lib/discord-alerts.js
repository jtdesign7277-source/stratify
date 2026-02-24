import { fetchIndicator } from './indicators.js';
import { buildMarketMoverEmbed, postToDiscord } from './discord.js';
import { fetchTwelveData } from './twelvedata.js';

const ALPACA_DATA_BASE = 'https://data.alpaca.markets';
const DEFAULT_ALERT_LIMIT = 10;
const DEFAULT_SCAN_LIMIT = 24;
const DEFAULT_MOVER_POSTS = 3;
const MIN_CANDLE_COUNT = 36;
const LOOKBACK_LEVEL_BARS = 20;
const LOOKBACK_ATR_BARS = 14;
const BREAKOUT_BUFFER = 1.001;
const VOLUME_SPIKE_RATIO = 2.0;
const RSI_OVERSOLD_LEVEL = 30;
const CHART_POINTS = 40;

const FALLBACK_ALPACA_SYMBOLS = [
  'SPY',
  'QQQ',
  'IWM',
  'AAPL',
  'MSFT',
  'NVDA',
  'AMD',
  'META',
  'TSLA',
  'AMZN',
  'GOOGL',
  'NFLX',
  'PLTR',
  'COIN',
  'SMH',
  'XLF',
  'XLE',
  'XLK',
  'BAC',
  'JPM',
];

const ALERT_META = Object.freeze({
  breakout: {
    label: 'Breakout Alert',
    emoji: '🚀',
    summaryPrefix: 'Price cleared resistance',
  },
  volumeSpike: {
    label: 'Volume Spike Alert',
    emoji: '📊',
    summaryPrefix: 'Unusual volume expansion',
  },
  rsiBounce: {
    label: 'RSI Bounce Alert',
    emoji: '🟢',
    summaryPrefix: 'Oversold RSI bounce',
  },
  pattern: {
    label: 'Pattern Alert',
    emoji: '📐',
    summaryPrefix: 'Bullish pattern setup',
  },
});

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0.00%';
  return `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%`;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatPrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '$0.00';
  return `$${parsed.toFixed(2)}`;
};

const formatVolume = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return parsed.toLocaleString();
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase().replace(/^\$/, '');
const DISCORD_EMBED_LIMITS = Object.freeze({
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footerText: 2048,
  fields: 25,
  embeds: 10,
});
const DISCORD_COLOR_BULLISH = 0x22C55E;

const truncateText = (value, maxLength) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
};

const toEmbedText = (value, { fallback = '—', maxLength = 1024, allowEmpty = false } = {}) => {
  if (value === null || value === undefined) {
    return allowEmpty ? '' : truncateText(fallback, maxLength);
  }

  const normalized = truncateText(
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? value
      : '',
    maxLength,
  );

  if (normalized) return normalized;
  return allowEmpty ? '' : truncateText(fallback, maxLength);
};

const normalizeEmbedColor = (value, fallback = DISCORD_COLOR_BULLISH) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xFFFFFF) {
    return fallback;
  }
  return parsed;
};

const normalizeEmbedTimestamp = (value) => {
  const candidate = value || new Date().toISOString();
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const normalizeEmbedImage = (candidate) => {
  const rawUrl =
    typeof candidate === 'string'
      ? candidate
      : candidate && typeof candidate === 'object'
        ? candidate.url
        : '';

  const url = String(rawUrl || '').trim();
  if (!url) return null;
  if (url.startsWith('attachment://')) return { url };
  if (/^https?:\/\//i.test(url)) return { url };
  return null;
};

const normalizeEmbedField = (field) => {
  if (!field || typeof field !== 'object' || Array.isArray(field)) return null;

  const name = toEmbedText(field.name, {
    fallback: 'Details',
    maxLength: DISCORD_EMBED_LIMITS.fieldName,
  });
  const value = toEmbedText(field.value, {
    fallback: '—',
    maxLength: DISCORD_EMBED_LIMITS.fieldValue,
  });
  const inline = typeof field.inline === 'boolean' ? field.inline : Boolean(field.inline);

  return { name, value, inline };
};

const sanitizeDiscordEmbed = (embed) => {
  if (!embed || typeof embed !== 'object' || Array.isArray(embed)) return null;

  const sanitized = {
    color: normalizeEmbedColor(embed.color),
    timestamp: normalizeEmbedTimestamp(embed.timestamp),
  };

  const title = toEmbedText(embed.title, {
    fallback: '',
    maxLength: DISCORD_EMBED_LIMITS.title,
    allowEmpty: true,
  });
  if (title) sanitized.title = title;

  const description = toEmbedText(embed.description, {
    fallback: '',
    maxLength: DISCORD_EMBED_LIMITS.description,
    allowEmpty: true,
  });
  if (description) sanitized.description = description;

  const fields = Array.isArray(embed.fields)
    ? embed.fields.map(normalizeEmbedField).filter(Boolean).slice(0, DISCORD_EMBED_LIMITS.fields)
    : [];
  if (fields.length > 0) sanitized.fields = fields;

  const footerText = toEmbedText(embed?.footer?.text, {
    fallback: '',
    maxLength: DISCORD_EMBED_LIMITS.footerText,
    allowEmpty: true,
  });
  if (footerText) sanitized.footer = { text: footerText };

  const image = normalizeEmbedImage(embed?.image || embed?.imageUrl);
  if (image) sanitized.image = image;

  const hasContent = Boolean(
    sanitized.title
      || sanitized.description
      || (Array.isArray(sanitized.fields) && sanitized.fields.length > 0)
      || sanitized.footer?.text
      || sanitized.image?.url,
  );

  if (!hasContent) return null;
  return sanitized;
};

export const sanitizeDiscordEmbeds = (embeds = []) => {
  if (!Array.isArray(embeds)) return [];
  return embeds
    .map((embed) => sanitizeDiscordEmbed(embed))
    .filter(Boolean)
    .slice(0, DISCORD_EMBED_LIMITS.embeds);
};

const logEmbedValidation = (context, originalEmbeds, sanitizedEmbeds) => {
  const originalCount = Array.isArray(originalEmbeds) ? originalEmbeds.length : 0;
  if (sanitizedEmbeds.length !== originalCount) {
    console.warn(
      `[discord-alerts] ${context}: filtered ${Math.max(0, originalCount - sanitizedEmbeds.length)} invalid embed(s)`,
    );
  }
};

const dedupeBySymbol = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const symbol = normalizeSymbol(row?.symbol);
    if (!symbol) return;
    const existing = map.get(symbol);
    if (!existing) {
      map.set(symbol, { ...row, symbol });
      return;
    }

    const rowMagnitude = Math.abs(toNumber(row?.percentChange) || 0);
    const existingMagnitude = Math.abs(toNumber(existing?.percentChange) || 0);
    if (rowMagnitude > existingMagnitude) {
      map.set(symbol, { ...existing, ...row, symbol });
      return;
    }

    map.set(symbol, {
      ...existing,
      ...row,
      symbol,
      source: existing.source || row.source,
      volume: Math.max(toNumber(existing.volume) || 0, toNumber(row.volume) || 0),
    });
  });

  return [...map.values()];
};

const computeRsiFromCloses = (closes = [], period = 14) => {
  if (!Array.isArray(closes) || closes.length <= period) return [];

  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    gains.push(delta > 0 ? delta : 0);
    losses.push(delta < 0 ? Math.abs(delta) : 0);
  }

  let avgGain = gains.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  const rsi = new Array(closes.length).fill(null);
  for (let i = period; i < gains.length; i += 1) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

    if (avgLoss === 0) {
      rsi[i + 1] = 100;
      continue;
    }

    const rs = avgGain / avgLoss;
    rsi[i + 1] = 100 - (100 / (1 + rs));
  }

  return rsi;
};

const makeRequest = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}): ${text || response.statusText}`);
  }
  return response;
};

const fetchTwelveDataMovers = async (direction = 'gainers', outputsize = 30) => {
  const payload = await fetchTwelveData('market_movers/stocks', {
    direction,
    outputsize,
  });

  const values = Array.isArray(payload?.values) ? payload.values : [];
  return values
    .map((row) => {
      const symbol = normalizeSymbol(row?.symbol);
      if (!symbol) return null;

      return {
        symbol,
        name: row?.name || symbol,
        price: toNumber(row?.last ?? row?.price),
        change: toNumber(row?.change),
        percentChange: toNumber(row?.percent_change ?? row?.percentChange),
        volume: toNumber(row?.volume),
        high: toNumber(row?.high),
        low: toNumber(row?.low),
        source: 'twelve_data',
      };
    })
    .filter(Boolean);
};

const fetchAlpacaFallbackMovers = async () => {
  const key = String(process.env.ALPACA_API_KEY || '').trim();
  const secret = String(process.env.ALPACA_API_SECRET || process.env.ALPACA_SECRET_KEY || '').trim();
  if (!key || !secret) return [];

  const query = new URLSearchParams({
    symbols: FALLBACK_ALPACA_SYMBOLS.join(','),
    feed: 'sip',
  });

  const response = await makeRequest(`${ALPACA_DATA_BASE}/v2/stocks/snapshots?${query.toString()}`, {
    headers: {
      'APCA-API-KEY-ID': key,
      'APCA-API-SECRET-KEY': secret,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));

  return FALLBACK_ALPACA_SYMBOLS
    .map((symbol) => {
      const snapshot = payload?.[symbol] || payload?.snapshots?.[symbol] || null;
      if (!snapshot) return null;

      const latestPrice = toNumber(snapshot?.latestTrade?.p ?? snapshot?.dailyBar?.c);
      const previousClose = toNumber(snapshot?.prevDailyBar?.c);
      if (!Number.isFinite(latestPrice) || !Number.isFinite(previousClose) || previousClose === 0) {
        return null;
      }

      const change = latestPrice - previousClose;
      const percentChange = (change / previousClose) * 100;

      return {
        symbol,
        name: symbol,
        price: latestPrice,
        change,
        percentChange,
        volume: toNumber(snapshot?.dailyBar?.v ?? snapshot?.minuteBar?.v),
        high: toNumber(snapshot?.dailyBar?.h),
        low: toNumber(snapshot?.dailyBar?.l),
        source: 'alpaca_snapshot',
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.percentChange || 0) - Math.abs(a.percentChange || 0));
};

const fetchIntradayCandles = async (symbol, interval = '15min', outputsize = 90) => {
  const payload = await fetchTwelveData('time_series', {
    symbol,
    interval,
    outputsize,
    order: 'ASC',
    prepost: 'true',
    dp: 4,
  });

  const values = Array.isArray(payload?.values) ? payload.values : [];
  return values
    .map((row) => ({
      datetime: row?.datetime || null,
      open: toNumber(row?.open),
      high: toNumber(row?.high),
      low: toNumber(row?.low),
      close: toNumber(row?.close),
      volume: toNumber(row?.volume),
    }))
    .filter((row) => row.datetime && Number.isFinite(row.close));
};

const fetchRsiSnapshot = async (symbol, interval, candles = []) => {
  try {
    const payload = await fetchIndicator({
      name: 'rsi',
      symbol,
      interval,
      outputsize: 3,
    });

    const series = Array.isArray(payload?.values) ? payload.values : [];
    const latest = toNumber(series?.[0]?.rsi ?? series?.[0]?.value);
    const previous = toNumber(series?.[1]?.rsi ?? series?.[1]?.value);

    if (Number.isFinite(latest) && Number.isFinite(previous)) {
      return { latest, previous, source: 'twelve_data' };
    }
  } catch {
    // Fallback below.
  }

  const closes = candles.map((bar) => bar.close).filter((value) => Number.isFinite(value));
  const computed = computeRsiFromCloses(closes, 14);
  const latest = toNumber(computed[computed.length - 1]);
  const previous = toNumber(computed[computed.length - 2]);

  return {
    latest: Number.isFinite(latest) ? latest : null,
    previous: Number.isFinite(previous) ? previous : null,
    source: 'computed',
  };
};

const analyzeCandles = (candles = []) => {
  if (!Array.isArray(candles) || candles.length < MIN_CANDLE_COUNT) return null;

  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  if (!latest || !previous) return null;

  const lookback = candles.slice(-(LOOKBACK_LEVEL_BARS + 1), -1);
  if (lookback.length === 0) return null;

  const resistance = Math.max(...lookback.map((bar) => bar.high || bar.close || 0));
  const support = Math.min(...lookback.map((bar) => bar.low || bar.close || 0));

  const avgVolume =
    lookback
      .map((bar) => bar.volume)
      .filter((value) => Number.isFinite(value))
      .reduce((sum, value, _, src) => sum + (value / src.length), 0) || 0;

  const atrWindow = candles.slice(-LOOKBACK_ATR_BARS);
  const atr =
    atrWindow
      .map((bar) => {
        if (!Number.isFinite(bar.high) || !Number.isFinite(bar.low)) return null;
        return bar.high - bar.low;
      })
      .filter((value) => Number.isFinite(value))
      .reduce((sum, value, _, src) => sum + (value / src.length), 0) ||
    latest.close * 0.012;

  const volumeRatio =
    Number.isFinite(latest.volume) && avgVolume > 0
      ? latest.volume / avgVolume
      : 0;

  return {
    latest,
    previous,
    support,
    resistance,
    avgVolume,
    atr,
    volumeRatio,
  };
};

const detectAscendingTriangle = (candles = [], metrics = {}) => {
  const window = candles.slice(-24);
  if (window.length < 20 || !Number.isFinite(metrics?.resistance)) return { detected: false };

  const resistance = metrics.resistance;
  const highs = window.map((bar) => bar.high || bar.close || 0);
  const nearResistanceTouches = highs.filter((value) => {
    if (!Number.isFinite(value) || !Number.isFinite(resistance) || resistance === 0) return false;
    return Math.abs(value - resistance) / resistance <= 0.004;
  }).length;

  const half = Math.floor(window.length / 2);
  const firstHalfLows = window.slice(0, half).map((bar) => bar.low || bar.close || 0);
  const secondHalfLows = window.slice(half).map((bar) => bar.low || bar.close || 0);

  const firstLowAvg = firstHalfLows.reduce((sum, value, _, src) => sum + (value / src.length), 0);
  const secondLowAvg = secondHalfLows.reduce((sum, value, _, src) => sum + (value / src.length), 0);

  const lowsRising = Number.isFinite(firstLowAvg) && Number.isFinite(secondLowAvg) && secondLowAvg > firstLowAvg * 1.004;
  const closeNearBreak = Number.isFinite(metrics?.latest?.close)
    && Number.isFinite(resistance)
    && metrics.latest.close >= resistance * 0.992;

  const detected = nearResistanceTouches >= 3 && lowsRising && closeNearBreak;

  return {
    detected,
    patternName: detected ? 'Ascending Triangle' : null,
    confidence: detected ? clamp((nearResistanceTouches / 6) + (lowsRising ? 0.35 : 0), 0, 1) : 0,
  };
};

const detectBullFlag = (candles = []) => {
  const window = candles.slice(-30);
  if (window.length < 24) return { detected: false };

  const pole = window.slice(0, 10);
  const flag = window.slice(10, 24);

  const poleStart = pole[0]?.close;
  const poleHigh = Math.max(...pole.map((bar) => bar.high || bar.close || 0));
  const flagLow = Math.min(...flag.map((bar) => bar.low || bar.close || 0));
  const flagHigh = Math.max(...flag.map((bar) => bar.high || bar.close || 0));

  if (!Number.isFinite(poleStart) || !Number.isFinite(poleHigh) || poleStart <= 0) {
    return { detected: false };
  }

  const runup = (poleHigh - poleStart) / poleStart;
  const retraceBase = poleHigh - poleStart;
  const retrace = retraceBase > 0 && Number.isFinite(flagLow)
    ? (poleHigh - flagLow) / retraceBase
    : 0;

  const flagSlope = (flag[flag.length - 1]?.close - flag[0]?.close) / (flag[0]?.close || 1);
  const latest = window[window.length - 1];
  const breakoutAttempt = Number.isFinite(latest?.close) && latest.close >= flagHigh * 0.996;

  const detected = runup >= 0.03 && retrace >= 0.12 && retrace <= 0.62 && flagSlope < 0.01 && breakoutAttempt;

  return {
    detected,
    patternName: detected ? 'Bull Flag' : null,
    confidence: detected ? clamp((runup * 8) + ((0.62 - retrace) * 0.4), 0, 1) : 0,
  };
};

const detectPatternAlert = (candles = [], metrics = {}) => {
  const ascendingTriangle = detectAscendingTriangle(candles, metrics);
  if (ascendingTriangle.detected) return ascendingTriangle;

  const bullFlag = detectBullFlag(candles);
  if (bullFlag.detected) return bullFlag;

  return { detected: false };
};

const buildTradeLevels = ({ latestClose, support, resistance, atr, type }) => {
  const safePrice = Number.isFinite(latestClose) ? latestClose : 0;
  const supportGap = Number.isFinite(support) && support < safePrice ? safePrice - support : safePrice * 0.012;
  const atrRisk = Number.isFinite(atr) ? atr * 1.15 : safePrice * 0.012;

  const riskUnit = clamp(
    Math.max(supportGap * 0.75, atrRisk, safePrice * 0.009),
    safePrice * 0.006,
    safePrice * 0.08,
  );

  const rewardRatio = type === 'volumeSpike' ? 1.7 : type === 'rsiBounce' ? 1.8 : 2.0;
  const entry = round(safePrice, 2);
  const stopLoss = round(Math.max(0.01, safePrice - riskUnit), 2);
  const target = round(safePrice + (riskUnit * rewardRatio), 2);

  const fallbackResistance = Number.isFinite(resistance) ? resistance : safePrice * 1.015;

  return {
    entry,
    stopLoss,
    target,
    support: Number.isFinite(support) ? round(support, 2) : round(stopLoss * 0.997, 2),
    resistance: Number.isFinite(fallbackResistance) ? round(fallbackResistance, 2) : round(target * 0.99, 2),
  };
};

const buildAlertReasoning = ({ type, metrics, rsi, patternName }) => {
  switch (type) {
    case 'breakout':
      return `Close ${formatPrice(metrics.latest.close)} broke resistance ${formatPrice(metrics.resistance)} with ${metrics.volumeRatio.toFixed(2)}x relative volume.`;
    case 'volumeSpike':
      return `Volume printed ${metrics.volumeRatio.toFixed(2)}x the 20-bar average while price held above prior close.`;
    case 'rsiBounce':
      return `RSI rebounded from ${Number(rsi.previous).toFixed(1)} to ${Number(rsi.latest).toFixed(1)} and price reclaimed momentum.`;
    case 'pattern':
      return `${patternName || 'Bullish continuation'} structure is active near resistance with improving trend support.`;
    default:
      return 'Bullish setup detected.';
  }
};

const scoreAlert = ({ type, mover, metrics, rsi, patternConfidence = 0 }) => {
  const momentum = Math.max(0, toNumber(mover?.percentChange) || 0);
  const volumeScore = Math.max(0, (toNumber(metrics?.volumeRatio) || 0) - 1) * 10;
  const rsiScore = Number.isFinite(rsi?.latest)
    ? Math.max(0, 50 - Math.abs(50 - rsi.latest)) * 0.2
    : 0;

  const typeBoost = {
    breakout: 22,
    volumeSpike: 20,
    rsiBounce: 18,
    pattern: 19,
  }[type] || 15;

  return round(typeBoost + momentum * 1.8 + volumeScore + rsiScore + (patternConfidence * 14), 3);
};

const createAlert = ({ type, analysis, patternName = null, patternConfidence = 0 }) => {
  const { symbol, mover, metrics, rsi, candles } = analysis;
  const meta = ALERT_META[type] || ALERT_META.breakout;
  const levels = buildTradeLevels({
    latestClose: metrics.latest.close,
    support: metrics.support,
    resistance: metrics.resistance,
    atr: metrics.atr,
    type,
  });

  const reasoning = buildAlertReasoning({ type, metrics, rsi, patternName });
  const score = scoreAlert({ type, mover, metrics, rsi, patternConfidence });

  return {
    symbol,
    type,
    label: meta.label,
    emoji: meta.emoji,
    patternName,
    direction: 'long',
    score,
    summary: `${meta.summaryPrefix} on $${symbol}`,
    reasoning,
    entry: levels.entry,
    target: levels.target,
    stopLoss: levels.stopLoss,
    support: levels.support,
    resistance: levels.resistance,
    currentPrice: round(metrics.latest.close, 2),
    volume: toNumber(metrics.latest.volume) || 0,
    averageVolume: round(metrics.avgVolume || 0, 0),
    volumeRatio: round(metrics.volumeRatio || 0, 2),
    change: toNumber(mover?.change),
    changePercent: toNumber(mover?.percentChange),
    rsiLatest: toNumber(rsi?.latest),
    rsiPrevious: toNumber(rsi?.previous),
    candles,
    moverSource: mover?.source || 'scan',
    generatedAt: new Date().toISOString(),
  };
};

const analyzeSymbolForAlerts = async (mover, interval = '15min') => {
  const symbol = normalizeSymbol(mover?.symbol);
  if (!symbol) {
    return { symbol: '', mover, alerts: [], candles: [], metrics: null, rsi: { latest: null, previous: null } };
  }

  try {
    const candles = await fetchIntradayCandles(symbol, interval, 90);
    const metrics = analyzeCandles(candles);
    if (!metrics) {
      return { symbol, mover, alerts: [], candles, metrics: null, rsi: { latest: null, previous: null } };
    }

    const rsi = await fetchRsiSnapshot(symbol, interval, candles);
    const pattern = detectPatternAlert(candles, metrics);

    const breakout = metrics.latest.close > metrics.resistance * BREAKOUT_BUFFER && metrics.volumeRatio >= 1.2;
    const volumeSpike = metrics.volumeRatio >= VOLUME_SPIKE_RATIO && metrics.latest.close >= metrics.previous.close;
    const rsiBounce =
      Number.isFinite(rsi.previous)
      && Number.isFinite(rsi.latest)
      && rsi.previous <= RSI_OVERSOLD_LEVEL
      && rsi.latest > rsi.previous
      && metrics.latest.close >= metrics.previous.close;

    const alerts = [];
    if (breakout) {
      alerts.push(createAlert({ type: 'breakout', analysis: { symbol, mover, metrics, rsi, candles } }));
    }
    if (volumeSpike) {
      alerts.push(createAlert({ type: 'volumeSpike', analysis: { symbol, mover, metrics, rsi, candles } }));
    }
    if (rsiBounce) {
      alerts.push(createAlert({ type: 'rsiBounce', analysis: { symbol, mover, metrics, rsi, candles } }));
    }
    if (pattern.detected) {
      alerts.push(
        createAlert({
          type: 'pattern',
          analysis: { symbol, mover, metrics, rsi, candles },
          patternName: pattern.patternName,
          patternConfidence: pattern.confidence,
        }),
      );
    }

    return {
      symbol,
      mover,
      candles,
      metrics,
      rsi,
      pattern,
      alerts,
    };
  } catch (error) {
    return {
      symbol,
      mover,
      candles: [],
      metrics: null,
      rsi: { latest: null, previous: null },
      alerts: [],
      error: error?.message || 'Scan failed',
    };
  }
};

const formatChartLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(-5);
  return date.toISOString().slice(11, 16);
};

const buildQuickChartConfig = (alert) => {
  const candles = Array.isArray(alert?.candles) ? alert.candles.slice(-CHART_POINTS) : [];
  if (candles.length === 0) return null;

  const labels = candles.map((bar) => formatChartLabel(bar.datetime));
  const closeSeries = candles.map((bar) => round(bar.close, 2));
  const volumeSeries = candles.map((bar) => round(bar.volume || 0, 0));

  const horizontalLine = (value) => labels.map(() => round(value, 2));

  const title = `${alert.symbol} ${alert.label} • Entry ${formatPrice(alert.entry)} / Target ${formatPrice(alert.target)}`;

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: `${alert.symbol} Price`,
          data: closeSeries,
          borderColor: '#34d399',
          borderWidth: 2,
          tension: 0.22,
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Resistance',
          data: horizontalLine(alert.resistance),
          borderColor: '#f59e0b',
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Support',
          data: horizontalLine(alert.support),
          borderColor: '#64748b',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Entry',
          data: horizontalLine(alert.entry),
          borderColor: '#22c55e',
          borderWidth: 1,
          borderDash: [4, 2],
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Stop',
          data: horizontalLine(alert.stopLoss),
          borderColor: '#ef4444',
          borderWidth: 1,
          borderDash: [4, 2],
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Volume',
          data: volumeSeries,
          backgroundColor: 'rgba(59, 130, 246, 0.25)',
          borderWidth: 0,
          yAxisID: 'yVolume',
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: title,
          color: '#e2e8f0',
          font: { size: 17 },
          padding: { top: 12, bottom: 8 },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            maxTicksLimit: 8,
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.08)',
          },
        },
        y: {
          ticks: {
            color: '#cbd5e1',
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)',
          },
        },
        yVolume: {
          position: 'right',
          beginAtZero: true,
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            display: false,
          },
        },
      },
      layout: {
        padding: { left: 8, right: 8, top: 4, bottom: 2 },
      },
    },
  };
};

const buildQuickChartUrl = (config) => {
  const query = new URLSearchParams({
    width: '1100',
    height: '620',
    format: 'png',
    backgroundColor: '#0f172a',
    devicePixelRatio: '1.3',
    chart: JSON.stringify(config),
  });

  return `https://quickchart.io/chart?${query.toString()}`;
};

const buildChartAttachment = async (alert) => {
  const config = buildQuickChartConfig(alert);
  if (!config) {
    return {
      file: null,
      imageUrl: null,
      chartUrl: null,
      source: 'none',
    };
  }

  const chartUrl = buildQuickChartUrl(config);
  const safeType = String(alert.type || 'setup').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const safeSymbol = String(alert.symbol || 'chart').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const fileName = `${safeSymbol}-${safeType}-${Date.now()}.png`;

  try {
    const response = await makeRequest(chartUrl, {
      headers: { Accept: 'image/png' },
    });
    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      file: {
        name: fileName,
        data: buffer,
        contentType: 'image/png',
      },
      imageUrl: `attachment://${fileName}`,
      chartUrl,
      source: 'uploaded',
    };
  } catch {
    return {
      file: null,
      imageUrl: chartUrl,
      chartUrl,
      source: 'url_fallback',
    };
  }
};

export const buildTradeAlertEmbed = (alert = {}, chartImageUrl = null) => {
  const safeSymbol = normalizeSymbol(alert.symbol) || 'TICKER';
  const safeLabel = toEmbedText(alert.label, {
    fallback: 'Trade Alert',
    maxLength: 80,
  });
  const patternName = toEmbedText(alert.patternName, {
    fallback: '',
    maxLength: 80,
    allowEmpty: true,
  });
  const patternDetails = patternName ? ` (${patternName})` : '';
  const summary = toEmbedText(alert.summary, {
    fallback: `Bullish setup on $${safeSymbol}`,
    maxLength: DISCORD_EMBED_LIMITS.description - 16,
  });

  const volumeRatio = toNumber(alert.volumeRatio);
  const safeVolumeRatio = Number.isFinite(volumeRatio) ? volumeRatio : 0;
  const rsiLatest = toNumber(alert.rsiLatest);
  const rsiPrevious = toNumber(alert.rsiPrevious);

  const signalType =
    alert.type === 'pattern' && patternName
      ? `${ALERT_META.pattern.label}: ${patternName}`
      : (ALERT_META[alert.type]?.label
        || toEmbedText(alert.type, { fallback: 'Trade setup', maxLength: 120 }));

  const image = normalizeEmbedImage(chartImageUrl);

  const rawEmbed = {
    title: `${toEmbedText(alert.emoji, { fallback: '📈', maxLength: 8 })} $${safeSymbol} ${safeLabel}${patternDetails}`,
    description: `**Buy signal:** ${summary}`,
    color: DISCORD_COLOR_BULLISH,
    fields: [
      { name: 'Entry', value: formatPrice(alert.entry), inline: true },
      { name: 'Target', value: formatPrice(alert.target), inline: true },
      { name: 'Stop Loss', value: formatPrice(alert.stopLoss), inline: true },
      { name: 'Current', value: formatPrice(alert.currentPrice), inline: true },
      { name: 'Change', value: toPercent(alert.changePercent), inline: true },
      { name: 'Volume', value: `${formatVolume(alert.volume)} (${safeVolumeRatio.toFixed(2)}x)`, inline: true },
      {
        name: 'Key Levels',
        value: `Support ${formatPrice(alert.support)} | Resistance ${formatPrice(alert.resistance)}`,
      },
      {
        name: 'Setup Notes',
        value: toEmbedText(alert.reasoning, {
          fallback: 'Momentum setup aligned with current trend structure.',
          maxLength: DISCORD_EMBED_LIMITS.fieldValue,
        }),
      },
      { name: 'Signal Type', value: signalType },
      ...(Number.isFinite(rsiLatest)
        ? [{ name: 'RSI', value: `${Number.isFinite(rsiPrevious) ? rsiPrevious.toFixed(1) : '—'} → ${rsiLatest.toFixed(1)}`, inline: true }]
        : []),
    ],
    ...(image ? { image } : {}),
    footer: { text: 'Stratify Trade Alerts • Educational only' },
    timestamp: new Date().toISOString(),
  };

  const sanitized = sanitizeDiscordEmbed(rawEmbed);
  if (sanitized) return sanitized;

  return {
    title: `$${safeSymbol} ${safeLabel}`,
    description: '**Buy signal:** Setup detected.',
    color: DISCORD_COLOR_BULLISH,
    timestamp: new Date().toISOString(),
  };
};

const buildAllowedMentions = (mentionText = '') => {
  const text = String(mentionText || '').trim();
  if (!text) return undefined;

  const parse = [];
  if (/@everyone|@here/.test(text)) parse.push('everyone');

  const roleMatches = [...text.matchAll(/<@&(\d+)>/g)].map((match) => match[1]);
  const userMatches = [...text.matchAll(/<@!?(\d+)>/g)].map((match) => match[1]);

  return {
    parse,
    roles: [...new Set(roleMatches)],
    users: [...new Set(userMatches)],
    replied_user: false,
  };
};

const makeTradeAlertContent = (alert, mention = '') => {
  const prefix = mention ? `${mention} ` : '';
  return `${prefix}**BUY SIGNAL** $${alert.symbol} ${alert.label} | Entry ${formatPrice(alert.entry)} | Target ${formatPrice(alert.target)} | Stop ${formatPrice(alert.stopLoss)}`;
};

const makeMarketMoverContent = (mover, mention = '') => {
  const prefix = mention ? `${mention} ` : '';
  return `${prefix}**Market mover:** $${mover.symbol} ${toPercent(mover.percentChange)} (${mover.source || 'scan'})`;
};

const buildMomentumFallbackAlert = (analysis) => {
  if (!analysis?.metrics || !analysis?.symbol) return null;

  const synthetic = createAlert({
    type: 'breakout',
    analysis: {
      symbol: analysis.symbol,
      mover: analysis.mover,
      metrics: analysis.metrics,
      rsi: analysis.rsi,
      candles: analysis.candles,
    },
  });

  return {
    ...synthetic,
    summary: `Momentum continuation watch on $${analysis.symbol}`,
    reasoning: `Fallback buy setup from strength scan: ${formatPrice(analysis.metrics.latest.close)} vs resistance ${formatPrice(analysis.metrics.resistance)} with ${analysis.metrics.volumeRatio.toFixed(2)}x volume.`,
    score: round((synthetic.score || 0) * 0.82, 3),
    type: 'breakout',
    label: 'Breakout Alert',
  };
};

export const fetchMarketMovers = async ({ limit = 30 } = {}) => {
  const maxRows = Math.max(10, Math.min(Number(limit) || 30, 80));
  const results = await Promise.allSettled([
    fetchTwelveDataMovers('gainers', maxRows),
    fetchTwelveDataMovers('actives', maxRows),
    fetchTwelveDataMovers('losers', maxRows),
  ]);

  const collected = results
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value || []);

  if (collected.length > 0) {
    return dedupeBySymbol(collected)
      .sort((a, b) => Math.abs(toNumber(b.percentChange) || 0) - Math.abs(toNumber(a.percentChange) || 0))
      .slice(0, maxRows);
  }

  let fallback = [];
  try {
    fallback = await fetchAlpacaFallbackMovers();
  } catch {
    fallback = [];
  }
  return dedupeBySymbol(fallback).slice(0, maxRows);
};

export const generateAlertFeed = async ({ limit = DEFAULT_ALERT_LIMIT, scanLimit = DEFAULT_SCAN_LIMIT } = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_ALERT_LIMIT, 20));
  const safeScanLimit = Math.max(safeLimit, Math.min(Number(scanLimit) || DEFAULT_SCAN_LIMIT, 40));

  const movers = await fetchMarketMovers({ limit: safeScanLimit + 6 });
  const scanTargets = movers.slice(0, safeScanLimit);

  const analysisSettled = await Promise.allSettled(
    scanTargets.map((mover) => analyzeSymbolForAlerts(mover, '15min')),
  );

  const analyses = analysisSettled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter(Boolean);

  const rawAlerts = analyses.flatMap((item) => item.alerts || []);

  const deduped = [];
  const seen = new Set();
  rawAlerts
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .forEach((alert) => {
      const key = `${alert.symbol}:${alert.type}:${alert.patternName || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(alert);
    });

  const fallbackPool = analyses
    .filter((item) => item?.metrics)
    .sort((a, b) => (Math.abs(toNumber(b?.mover?.percentChange) || 0) - Math.abs(toNumber(a?.mover?.percentChange) || 0)));

  let cursor = 0;
  while (deduped.length < safeLimit && cursor < fallbackPool.length) {
    const candidate = buildMomentumFallbackAlert(fallbackPool[cursor]);
    cursor += 1;
    if (!candidate) continue;

    const key = `${candidate.symbol}:${candidate.type}:fallback`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return {
    alerts: deduped
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, Math.max(safeLimit, DEFAULT_ALERT_LIMIT)),
    movers,
    analyses,
    scannedSymbols: scanTargets.length,
    generatedAt: new Date().toISOString(),
  };
};

export const runDiscordAlertCycle = async ({
  limit = DEFAULT_ALERT_LIMIT,
  mention = process.env.DISCORD_ALERTS_MENTION || process.env.DISCORD_ALERT_MENTION || '@here',
  marketMoverPosts = DEFAULT_MOVER_POSTS,
  dryRun = false,
} = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_ALERT_LIMIT, 20));
  const moverSlots = Math.min(
    Math.max(1, Number(marketMoverPosts) || DEFAULT_MOVER_POSTS),
    Math.max(1, Math.floor(safeLimit / 2)),
  );
  const alertSlots = Math.max(1, safeLimit - moverSlots);

  const feed = await generateAlertFeed({
    limit: alertSlots,
    scanLimit: Math.max(DEFAULT_SCAN_LIMIT, safeLimit * 2),
  });

  const selectedAlerts = feed.alerts.slice(0, alertSlots);
  const selectedMovers = feed.movers
    .slice()
    .sort((a, b) => Math.abs(toNumber(b.percentChange) || 0) - Math.abs(toNumber(a.percentChange) || 0))
    .slice(0, moverSlots);

  const allowedMentions = buildAllowedMentions(mention);

  const alertItems = await Promise.all(
    selectedAlerts.map(async (alert) => {
      const chart = await buildChartAttachment(alert);
      const embed = buildTradeAlertEmbed(alert, chart.imageUrl);
      const embeds = sanitizeDiscordEmbeds([embed]);
      logEmbedValidation(`trade_alert:${alert.symbol || 'unknown'}`, [embed], embeds);

      return {
        kind: 'trade_alert',
        channel: 'tradeSetups',
        symbol: alert.symbol,
        alertType: alert.type,
        content: makeTradeAlertContent(alert, mention),
        embeds,
        files: chart?.file ? [chart.file] : [],
        allowedMentions,
        chartSource: chart?.source || 'none',
        chartUrl: chart?.chartUrl || null,
      };
    }),
  );

  const moverItems = selectedMovers.map((mover) => ({
    kind: 'market_mover',
    channel: 'marketTalk',
    symbol: mover.symbol,
    alertType: 'market_mover',
    content: makeMarketMoverContent(mover, mention),
    embeds: sanitizeDiscordEmbeds([
      buildMarketMoverEmbed({
        ticker: mover.symbol,
        price: toNumber(mover.price) || 0,
        change: toNumber(mover.change) || 0,
        changePercent: round(toNumber(mover.percentChange) || 0, 2),
        volume: toNumber(mover.volume) || 0,
        catalyst: `Source: ${mover.source || 'scan'}`,
      }),
    ]),
    files: [],
    allowedMentions,
    chartSource: 'none',
    chartUrl: null,
  }));

  const items = [...alertItems, ...moverItems].slice(0, safeLimit);

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      requested: safeLimit,
      generated: items.length,
      counts: {
        alerts: alertItems.length,
        movers: moverItems.length,
      },
      scannedSymbols: feed.scannedSymbols,
      generatedAt: new Date().toISOString(),
      items: items.map((item) => ({
        kind: item.kind,
        channel: item.channel,
        symbol: item.symbol,
        alertType: item.alertType,
        chartSource: item.chartSource,
      })),
    };
  }

  const posted = [];
  const failures = [];

  for (const item of items) {
    try {
      const validatedEmbeds = sanitizeDiscordEmbeds(item.embeds);
      logEmbedValidation(`${item.kind}:${item.symbol || 'unknown'}`, item.embeds, validatedEmbeds);

      await postToDiscord(item.channel, {
        content: item.content,
        embeds: validatedEmbeds.length > 0 ? validatedEmbeds : undefined,
        files: item.files,
        allowedMentions: item.allowedMentions,
      });

      posted.push({
        channel: item.channel,
        kind: item.kind,
        symbol: item.symbol,
        alertType: item.alertType,
        chartSource: item.chartSource,
      });
    } catch (error) {
      failures.push({
        channel: item.channel,
        kind: item.kind,
        symbol: item.symbol,
        alertType: item.alertType,
        error: error?.message || 'Discord post failed',
      });
    }
  }

  return {
    success: failures.length === 0,
    dryRun: false,
    requested: safeLimit,
    generated: items.length,
    postedCount: posted.length,
    failedCount: failures.length,
    counts: {
      alerts: alertItems.length,
      movers: moverItems.length,
    },
    scannedSymbols: feed.scannedSymbols,
    generatedAt: new Date().toISOString(),
    posted,
    failures,
  };
};
