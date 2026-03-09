/**
 * Stratify Pattern Detection Engine
 * 10 signals, Redis caps, chart visuals, X + Discord to trade-setups
 */

import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const WATCHLIST = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'SPY', 'QQQ',
  'SOFI', 'HIMS', 'COIN', 'HNST', 'LMND', 'RKLB', 'FUBO',
  'RDFN', 'PLTR', 'NFLX', 'BMNR', 'IREN', 'ELF', 'EL',
  'NKE', 'DUOL', 'ADBE', 'PYPL', 'LULU',
  'BTC/USD', 'ETH/USD', 'SOL/USD'
];

const TWELVE_BASE = 'https://api.twelvedata.com';
const INDICATOR_CACHE_TTL = 90;
const SIGNAL_COOLDOWN_MINUTES = 90;
const MIN_RR = 2;
const MIN_VOLUME_RATIO = 1.5;
const EARNINGS_BLACKOUT_HOURS = 48;

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

function getDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function isMarketHoursET() {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false });
  const parts = formatter.formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday').value;
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const minutes = hour * 60 + minute;
  if (['Sat', 'Sun'].includes(weekday)) return false;
  if (minutes < 9 * 60 + 30) return false;
  if (minutes >= 15 * 60 + 30) return false;
  return true;
}

async function fetchTwelve(path, params = {}) {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return null;
  const q = new URLSearchParams({ ...params, apikey: key });
  const url = `${TWELVE_BASE}${path}?${q.toString()}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return res.ok ? data : null;
  } catch {
    return null;
  }
}

async function getCachedOrFetch(redis, key, fetcher, ttl = INDICATOR_CACHE_TTL) {
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached != null) return typeof cached === 'string' ? JSON.parse(cached) : cached;
    } catch {}
  }
  const value = await fetcher();
  if (redis && value != null) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: ttl });
    } catch {}
  }
  return value;
}

async function getQuote(symbol, redis) {
  const key = `pattern:quote:${symbol}`;
  return getCachedOrFetch(redis, key, () => fetchTwelve('/quote', { symbol }));
}

async function getIndicator(symbol, indicator, interval, period, redis) {
  const key = `pattern:${indicator}:${interval}:${period}:${symbol}`;
  return getCachedOrFetch(redis, key, () => {
    const params = { symbol, interval };
    if (period != null) params.period = period;
    return fetchTwelve(`/${indicator}`, params);
  });
}

async function getTimeSeries(symbol, interval, outputsize, redis) {
  const key = `pattern:ts:${interval}:${outputsize}:${symbol}`;
  return getCachedOrFetch(redis, key, () => fetchTwelve('/time_series', { symbol, interval, outputsize: String(outputsize) }));
}

async function getEarningsWithinHours(symbol, hours, redis) {
  const key = `pattern:earnings:${symbol}`;
  const data = await getCachedOrFetch(redis, key, () =>
    fetchTwelve('/earnings_calendar', { symbol }).catch(() => null),
    3600
  );
  if (!data) return false;
  const list = Array.isArray(data.earnings) ? data.earnings : Array.isArray(data.data) ? data.data : [];
  const now = Date.now();
  const cutoff = now + hours * 60 * 60 * 1000;
  return list.some((e) => {
    const t = new Date(e.date || e.report_date || e.epoch).getTime();
    return Number.isFinite(t) && t >= now && t <= cutoff;
  });
}

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildIndicatorValues(symbol, redis, data) {
  const rawQuote = data.quote;
  const quote = rawQuote && typeof rawQuote === 'object' && !Array.isArray(rawQuote) ? (rawQuote.data || rawQuote) : {};
  const ema8_5 = data.ema8_5?.values?.[0];
  const ema21_5 = data.ema21_5?.values?.[0];
  const ema8_1d = data.ema8_1d?.values?.[0];
  const ema21_1d = data.ema21_1d?.values?.[0];
  const sma50_1d = data.sma50_1d?.values?.[0];
  const vwap_5 = data.vwap_5?.values?.[0];
  const seriesRaw = data.series?.values || data.series?.data || [];
  const series = Array.isArray(seriesRaw) ? seriesRaw : [];
  const price = toNum(quote.close ?? quote.price) ?? (series[0] ? toNum(series[0].close) : null);
  const volume = toNum(quote.volume);
  const avgVolume = toNum(quote.average_volume ?? quote.avg_volume);
  const changePct = toNum(quote.percent_change ?? quote.change_pct);
  return {
    symbol,
    price,
    volume,
    avgVolume,
    changePct,
    ema8_5: ema8_5 ? toNum(ema8_5.ema) : null,
    ema21_5: ema21_5 ? toNum(ema21_5.ema) : null,
    ema8_1d: ema8_1d ? toNum(ema8_1d.ema) : null,
    ema21_1d: ema21_1d ? toNum(ema21_1d.ema) : null,
    sma50_1d: sma50_1d ? toNum(sma50_1d.sma) : null,
    vwap: vwap_5 ? toNum(vwap_5.vwap) : null,
    candles: series,
  };
}

async function fetchIndicatorsForTicker(symbol, redis) {
  const [quote, ema8_5, ema21_5, ema8_1d, ema21_1d, sma50_1d, vwap_5, series] = await Promise.all([
    getQuote(symbol, redis),
    getIndicator(symbol, 'ema', '5min', 8, redis),
    getIndicator(symbol, 'ema', '5min', 21, redis),
    getIndicator(symbol, 'ema', '1day', 8, redis),
    getIndicator(symbol, 'ema', '1day', 21, redis),
    getIndicator(symbol, 'sma', '1day', 50, redis),
    getIndicator(symbol, 'vwap', '5min', null, redis),
    getTimeSeries(symbol, '5min', 20, redis),
  ]);
  return buildIndicatorValues(symbol, redis, {
    quote,
    ema8_5,
    ema21_5,
    ema8_1d,
    ema21_1d,
    sma50_1d,
    vwap_5,
    series,
  });
}

function detectPatterns(ind) {
  const { price, volume, avgVolume, ema8_5, ema21_5, ema8_1d, ema21_1d, sma50_1d, vwap, candles } = ind;
  if (price == null) return [];
  const results = [];
  const pct = (a, b) => (b != null && b !== 0 ? (Math.abs(price - b) / b) * 100 : null);

  if (vwap != null) {
    if (price > vwap) results.push({ pattern: 'VWAP RECLAIM', direction: 'long', rr: 2, setup: 'Price crossed above VWAP' });
    else results.push({ pattern: 'VWAP REJECTION', direction: 'short', rr: 2, setup: 'Price crossed below VWAP' });
  }

  if (ema8_5 != null && ema21_5 != null && pct(price, ema8_5) != null && pct(price, ema8_5) <= 0.4 && price > ema21_5) {
    results.push({ pattern: '8 EMA PULLBACK intraday', direction: 'long', rr: 2, setup: 'Within 0.4% of 8 EMA 5m, above 21 EMA' });
  }
  if (ema21_5 != null && pct(price, ema21_5) != null && pct(price, ema21_5) <= 0.4) {
    results.push({ pattern: '21 EMA PULLBACK intraday', direction: 'long', rr: 2, setup: 'Within 0.4% of 21 EMA 5m' });
  }
  if (ema8_1d != null && pct(price, ema8_1d) != null && pct(price, ema8_1d) <= 0.5) {
    results.push({ pattern: '8 DAY EMA PULLBACK swing', direction: 'long', rr: 2.5, setup: 'Within 0.5% of 8 day EMA' });
  }
  if (ema21_1d != null && pct(price, ema21_1d) != null && pct(price, ema21_1d) <= 0.5) {
    results.push({ pattern: '21 DAY EMA PULLBACK swing', direction: 'long', rr: 2.5, setup: 'Within 0.5% of 21 day EMA' });
  }

  if (Array.isArray(candles) && candles.length >= 6) {
    const recent = candles.slice(0, 6);
    const firstClose = toNum(recent[recent.length - 1]?.close);
    const lastClose = toNum(recent[0]?.close);
    const change30 = firstClose != null && firstClose !== 0 ? ((lastClose - firstClose) / firstClose) * 100 : null;
    const range = recent.slice(0, 3).map(c => toNum(c.close));
    const inRange = range.every(v => v != null) && Math.max(...range) - Math.min(...range) <= (price * 0.005);
    if (change30 != null && change30 >= 2 && inRange) {
      results.push({ pattern: 'BULL FLAG', direction: 'long', rr: 2.5, setup: 'Up 2%+ in 30min, 3 candles tight range' });
    }
    if (change30 != null && change30 <= -2 && inRange) {
      results.push({ pattern: 'BEAR FLAG', direction: 'short', rr: 2.5, setup: 'Down 2%+ in 30min, 3 candles tight range' });
    }
  }

  const resistance = candles?.[0] ? Math.max(...(candles.slice(0, 12).map(c => toNum(c.high)).filter(Boolean))) : null;
  const support = candles?.[0] ? Math.min(...(candles.slice(0, 12).map(c => toNum(c.low)).filter(Boolean))) : null;
  if (resistance != null && pct(price, resistance) != null && pct(price, resistance) <= 0.3 && price < resistance) {
    results.push({ pattern: 'BREAK AND RETEST LONG', direction: 'long', rr: 2, setup: 'Pulled back to within 0.3% of prior resistance' });
  }
  if (support != null && pct(price, support) != null && pct(price, support) <= 0.3 && price > support) {
    results.push({ pattern: 'BREAK AND RETEST SHORT', direction: 'short', rr: 2, setup: 'Bounced to within 0.3% of prior support' });
  }

  return results;
}

function computeSignal(ind, hit) {
  const { price, ema8_5, ema21_5, ema8_1d, ema21_1d, volume, avgVolume } = ind;
  const isLong = hit.direction === 'long';
  let stop = null;
  if (isLong) {
    const below = [ema8_5, ema21_5, ema8_1d, ema21_1d].filter(v => v != null && v < price);
    stop = below.length ? Math.max(...below) : price * 0.98;
  } else {
    const above = [ema8_5, ema21_5, ema8_1d, ema21_1d].filter(v => v != null && v > price);
    stop = above.length ? Math.min(...above) : price * 1.02;
  }
  const risk = Math.abs(price - stop);
  const mult1 = 1.5;
  const mult2 = 2.5;
  const target1 = isLong ? price + risk * mult1 : price - risk * mult1;
  const target2 = isLong ? price + risk * mult2 : price - risk * mult2;
  const rr = risk > 0 ? (Math.abs((isLong ? target2 : price - (price - target2)) - price) / risk) : 0;
  const volRatio = avgVolume && avgVolume > 0 ? (volume || 0) / avgVolume : 0;
  return {
    ...hit,
    entry: price,
    stop,
    target1,
    target2,
    rr: Math.round(rr * 10) / 10,
    volRatio: Math.round(volRatio * 10) / 10,
  };
}

function buildQuickChartUrl(candles, vwap, ema8, ema21) {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  const labels = candles.map(c => c.datetime || '').reverse();
  const o = candles.map(c => toNum(c.open)).reverse();
  const h = candles.map(c => toNum(c.high)).reverse();
  const l = candles.map(c => toNum(c.low)).reverse();
  const c = candles.map(c => toNum(c.close)).reverse();
  const vwapLine = vwap != null ? { label: 'VWAP', data: candles.map(() => vwap).reverse(), borderColor: '#3b82f6', fill: false } : null;
  const ema8Line = ema8 != null ? { label: '8 EMA', data: candles.map(() => ema8).reverse(), borderColor: '#10b981', fill: false } : null;
  const ema21Line = ema21 != null ? { label: '21 EMA', data: candles.map(() => ema21).reverse(), borderColor: '#06b6d4', fill: false } : null;
  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Open', data: o, borderColor: '#64748b', fill: false },
        { label: 'High', data: h, borderColor: '#64748b', fill: false },
        { label: 'Low', data: l, borderColor: '#64748b', fill: false },
        { label: 'Close', data: c, borderColor: '#f8fafc', fill: false },
        ...(vwapLine ? [vwapLine] : []),
        ...(ema8Line ? [ema8Line] : []),
        ...(ema21Line ? [ema21Line] : []),
      ],
    },
    options: {
      backgroundColor: '#0a0a0f',
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } },
    },
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&width=800&height=400`;
}

async function postToX(text) {
  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';
  const oauthParams = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const signBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`).join('&')
  )}`;
  const signKey = `${encodeURIComponent(process.env.X_API_SECRET || '')}&${encodeURIComponent(process.env.X_ACCESS_TOKEN_SECRET || '')}`;
  const signature = crypto.createHmac('sha1', signKey).update(signBase).digest('base64');
  const authHeader = 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: signature })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');
  const res = await fetch(url, {
    method,
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || JSON.stringify(data));
  return data;
}

async function fireSignal(signal, ind, redis) {
  const dateKey = getDateKey();
  const ticker = ind.symbol;
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
  const fmt = (n) => (n != null ? `$${Number(n).toFixed(2)}` : '—');
  const color = signal.direction === 'long' ? 0x00ff88 : 0xff4444;
  const chartUrl = buildQuickChartUrl(ind.candles, ind.vwap, ind.ema8_5, ind.ema21_5);

  const embed = {
    title: `🚨 ${signal.pattern} — $${ticker}`,
    color,
    fields: [
      { name: 'Entry', value: fmt(signal.entry), inline: true },
      { name: 'Stop', value: fmt(signal.stop), inline: true },
      { name: 'R/R', value: `1:${signal.rr}`, inline: true },
      { name: 'Target 1', value: fmt(signal.target1), inline: true },
      { name: 'Target 2', value: fmt(signal.target2), inline: true },
      { name: 'Volume', value: `${signal.volRatio}x avg`, inline: true },
      { name: 'Setup', value: signal.setup || signal.pattern, inline: false },
      { name: 'Live Data', value: `Price: ${fmt(ind.price)} | VWAP: ${fmt(ind.vwap)} | 8EMA: ${fmt(ind.ema8_5)}`, inline: false },
    ],
    footer: { text: `⏰ ${timeStr} ET | Twelve Data live | Paper trade only. Not financial advice.` },
    timestamp: new Date().toISOString(),
  };
  if (chartUrl) embed.image = { url: chartUrl };

  const webhook = process.env.DISCORD_WEBHOOK_TRADE_SETUPS;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    } catch (e) {
      console.error('Discord webhook failed:', e.message);
    }
  }

  const xText = `🚨 $${ticker} ${signal.pattern}\nEntry: ${fmt(signal.entry)} | Stop: ${fmt(signal.stop)} | T1: ${fmt(signal.target1)} | T2: ${fmt(signal.target2)}\nR/R: 1:${signal.rr} | ${timeStr} ET\n📊 Paper trade only. Not financial advice.`;
  try {
    await postToX(xText);
  } catch (e) {
    console.error('X post failed:', e.message);
  }

  if (redis) {
    try {
      const countKey = `signals:count:${dateKey}`;
      await redis.incr(countKey);
      await redis.expire(countKey, 86400);
      await redis.set(`signals:fired:${ticker}:${dateKey}`, 'true', { ex: 86400 });
      await redis.set(`signals:last_fired:${dateKey}`, String(Date.now()), { ex: 86400 });
    } catch {}
  }
}

export async function runPatternScan() {
  if (!isMarketHoursET()) return;

  const redis = getRedis();
  const dateKey = getDateKey();

  if (redis) {
    try {
      const count = parseInt(await redis.get(`signals:count:${dateKey}`), 10) || 0;
      if (count >= 3) return;
      const lastFired = parseInt(await redis.get(`signals:last_fired:${dateKey}`), 10);
      if (lastFired && Date.now() - lastFired < SIGNAL_COOLDOWN_MINUTES * 60 * 1000) return;
    } catch {}
  }

  let spyQuote = null;
  try {
    spyQuote = await getQuote('SPY', redis);
  } catch {}
  const spyChange = spyQuote ? toNum(spyQuote.percent_change) : null;
  const spyDown2 = spyChange != null && spyChange <= -2;
  const blockLongOnRedDay = (pattern) => ['VWAP RECLAIM', 'BULL FLAG'].includes(pattern);

  const candidates = [];

  for (const symbol of WATCHLIST) {
    if (redis) {
      try {
        if (await redis.get(`signals:fired:${symbol}:${dateKey}`)) continue;
      } catch {}
    }

    try {
      const hasEarnings = await getEarningsWithinHours(symbol, EARNINGS_BLACKOUT_HOURS, redis);
      if (hasEarnings) continue;
    } catch {}

    const ind = await fetchIndicatorsForTicker(symbol, redis);
    if (ind.volume != null && ind.avgVolume != null && ind.volume < ind.avgVolume * MIN_VOLUME_RATIO) continue;

    const patterns = detectPatterns(ind);
    for (const hit of patterns) {
      if (spyDown2 && hit.direction === 'long' && blockLongOnRedDay(hit.pattern)) continue;
      const signal = computeSignal(ind, hit);
      if (signal.rr < MIN_RR) continue;
      candidates.push({ signal, ind });
    }
  }

  if (candidates.length === 0) return;
  const best = candidates.sort((a, b) => (b.signal.rr || 0) - (a.signal.rr || 0))[0];
  await fireSignal(best.signal, best.ind, redis);
}
