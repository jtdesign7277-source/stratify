const USAGE_ENDPOINTS = [
  { method: 'GET', url: 'https://api.x.ai/v1/usage' },
  { method: 'GET', url: 'https://api.x.ai/v1/usage/tokens' },
  { method: 'GET', url: 'https://api.x.ai/v1/billing/usage' },
  { method: 'GET', url: 'https://api.x.ai/v1/billing/tokens' },
  { method: 'GET', url: 'https://api.x.ai/v1/credits' },
];

const DEFAULT_CRON_BREAKDOWN = [
  { name: 'Warm War Room Scans', weight: 0.34, runs: 9 },
  { name: 'Warm War Room Transcripts', weight: 0.2, runs: 6 },
  { name: 'Community Bot', weight: 0.18, runs: 6 },
  { name: 'Sophia Morning + Insight', weight: 0.14, runs: 2 },
  { name: 'Market Summaries', weight: 0.14, runs: 2 },
];

const NUMBER_PATTERNS = {
  total: [
    'total_tokens',
    'totalTokens',
    'token_limit',
    'tokenLimit',
    'limit_tokens',
    'limit',
    'quota.total_tokens',
    'quota.limit',
    'usage.total_tokens',
    'usage.limit',
    'data.total_tokens',
    'data.limit',
    'credits.total',
    'balance.total_tokens',
  ],
  used: [
    'used_tokens',
    'usedTokens',
    'tokens_used',
    'current_usage',
    'usage.used_tokens',
    'usage.current',
    'usage.used',
    'data.used_tokens',
    'data.usage',
    'credits.used',
    'balance.used_tokens',
  ],
  remaining: [
    'remaining_tokens',
    'remainingTokens',
    'tokens_remaining',
    'usage.remaining_tokens',
    'data.remaining_tokens',
    'credits.remaining',
    'balance.remaining_tokens',
  ],
  percentage: [
    'percentage',
    'used_percentage',
    'usage.percentage',
    'data.percentage',
  ],
};

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,_\s]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

function readPath(source, path) {
  if (!source || typeof source !== 'object') return undefined;
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined), source);
}

function pickNumber(source, paths = []) {
  for (const path of paths) {
    const candidate = toNumber(readPath(source, path));
    if (Number.isFinite(candidate)) return candidate;
  }
  return NaN;
}

function normalizeCronBreakdown(rows, usedTokens) {
  if (Array.isArray(rows) && rows.length > 0) {
    const normalized = rows
      .map((row) => {
        const name =
          String(row?.name || row?.job || row?.label || row?.cron || row?.task || 'Unnamed Cron').trim() ||
          'Unnamed Cron';
        const tokens = toNumber(row?.tokens ?? row?.used_tokens ?? row?.usage ?? row?.value);
        const runs = toNumber(row?.runs ?? row?.count ?? row?.invocations);
        const percentage = toNumber(row?.percentage ?? row?.pct);
        return {
          name,
          tokens: Number.isFinite(tokens) ? Math.max(0, Math.round(tokens)) : 0,
          runs: Number.isFinite(runs) ? Math.max(0, Math.round(runs)) : 0,
          percentage: Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : NaN,
        };
      })
      .filter((row) => row.name);

    const tokenSum = normalized.reduce((sum, row) => sum + row.tokens, 0);
    return normalized.map((row) => ({
      name: row.name,
      tokens: row.tokens,
      runs: row.runs,
      percentage: Number.isFinite(row.percentage)
        ? row.percentage
        : tokenSum > 0
          ? (row.tokens / tokenSum) * 100
          : 0,
    }));
  }

  const fallbackUsed = Math.max(0, Math.round(Number(usedTokens) || 0));
  return DEFAULT_CRON_BREAKDOWN.map((item) => ({
    name: item.name,
    runs: item.runs,
    tokens: Math.round(fallbackUsed * item.weight),
    percentage: item.weight * 100,
  }));
}

function normalizeUsagePayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  let total = pickNumber(source, NUMBER_PATTERNS.total);
  let used = pickNumber(source, NUMBER_PATTERNS.used);
  let remaining = pickNumber(source, NUMBER_PATTERNS.remaining);
  let percentage = pickNumber(source, NUMBER_PATTERNS.percentage);

  if (!Number.isFinite(used) && Number.isFinite(total) && Number.isFinite(remaining)) {
    used = total - remaining;
  }

  if (!Number.isFinite(remaining) && Number.isFinite(total) && Number.isFinite(used)) {
    remaining = total - used;
  }

  if (!Number.isFinite(total) && Number.isFinite(used) && Number.isFinite(remaining)) {
    total = used + remaining;
  }

  total = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  used = Number.isFinite(used) ? Math.max(0, Math.round(used)) : 0;
  remaining = Number.isFinite(remaining) ? Math.max(0, Math.round(remaining)) : Math.max(total - used, 0);

  if (total <= 0) {
    total = Math.max(used + remaining, 1);
  }

  if (!Number.isFinite(percentage)) {
    percentage = total > 0 ? (used / total) * 100 : 0;
  }

  percentage = Math.max(0, Math.min(100, percentage));

  const rawBreakdown =
    readPath(source, 'cron_breakdown') ||
    readPath(source, 'breakdown') ||
    readPath(source, 'usage_breakdown') ||
    readPath(source, 'jobs') ||
    readPath(source, 'data.cron_breakdown') ||
    readPath(source, 'data.breakdown') ||
    [];

  const cron_breakdown = normalizeCronBreakdown(rawBreakdown, used);
  const remainingRatio = total > 0 ? (remaining / total) * 100 : 0;

  return {
    total_tokens: total,
    used_tokens: used,
    remaining_tokens: remaining,
    percentage: Number(percentage.toFixed(2)),
    alert: remainingRatio < 25,
    cron_breakdown,
  };
}

async function fetchUsageFromEndpoint(apiKey, endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('xai_usage_timeout'), 8000);

  try {
    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`${endpoint.url} -> ${response.status} ${bodyText.slice(0, 140)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'XAI_API_KEY is missing. Add it in Vercel environment variables.' });
  }

  const endpointErrors = [];

  for (const endpoint of USAGE_ENDPOINTS) {
    try {
      const payload = await fetchUsageFromEndpoint(apiKey, endpoint);
      const normalized = normalizeUsagePayload(payload);
      return res.status(200).json(normalized);
    } catch (error) {
      endpointErrors.push(error?.message || `Failed: ${endpoint.url}`);
    }
  }

  return res.status(502).json({
    error: 'Unable to fetch xAI token usage from available endpoints.',
    details: endpointErrors,
  });
}
