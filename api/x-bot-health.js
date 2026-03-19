import crypto from 'crypto';

const X_API_BASE = 'https://api.x.com';

function isPresent(value) {
  return String(value || '').trim().length > 0;
}

function getTrimmedEnv(name) {
  return String(process.env[name] || '').trim();
}

function getXCredentials() {
  return {
    apiKey: getTrimmedEnv('X_API_KEY'),
    apiSecret: getTrimmedEnv('X_API_SECRET'),
    accessToken: getTrimmedEnv('X_ACCESS_TOKEN'),
    accessTokenSecret: getTrimmedEnv('X_ACCESS_TOKEN_SECRET'),
  };
}

function getCombinedPresence(...values) {
  return values.some((value) => isPresent(value));
}

function buildEnvChecks() {
  const xCreds = getXCredentials();
  const cronSecretConfigured = isPresent(process.env.CRON_SECRET);
  const xCredentialsConfigured = [
    xCreds.apiKey,
    xCreds.apiSecret,
    xCreds.accessToken,
    xCreds.accessTokenSecret,
  ].every(isPresent);
  const redisConfigured = [
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  ].every(isPresent);
  const twelveDataConfigured = getCombinedPresence(
    process.env.TWELVEDATA_API_KEY,
    process.env.TWELVE_DATA_API_KEY
  );
  const anthropicXpostConfigured = isPresent(process.env.ANTHROPIC_API_KEY_XPOST);
  const marketauxConfigured = isPresent(process.env.MARKETAUX_API_KEY);
  const sentinelSupabaseConfigured = [
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].every(isPresent);

  return {
    cronSecretConfigured,
    xCredentialsConfigured,
    redisConfigured,
    twelveDataConfigured,
    anthropicXpostConfigured,
    marketauxConfigured,
    sentinelSupabaseConfigured,
  };
}

function getMissingRequirements(checks, isProduction) {
  const missing = [];

  if (isProduction && !checks.cronSecretConfigured) {
    missing.push('CRON_SECRET');
  }
  if (!checks.xCredentialsConfigured) {
    missing.push('X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET');
  }
  if (!checks.redisConfigured) {
    missing.push('KV_REST_API_URL / KV_REST_API_TOKEN');
  }
  if (!checks.twelveDataConfigured) {
    missing.push('TWELVEDATA_API_KEY or TWELVE_DATA_API_KEY');
  }
  if (!checks.anthropicXpostConfigured) {
    missing.push('ANTHROPIC_API_KEY_XPOST');
  }
  if (!checks.marketauxConfigured) {
    missing.push('MARKETAUX_API_KEY');
  }
  if (!checks.sentinelSupabaseConfigured) {
    missing.push('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }

  return missing;
}

function getAuthorizationState(req, cronSecretConfigured) {
  const authHeader = req.headers.authorization || '';
  const expected = cronSecretConfigured ? `Bearer ${String(process.env.CRON_SECRET).trim()}` : '';
  const authorized = cronSecretConfigured ? authHeader === expected : false;

  return {
    headerPresent: authHeader.length > 0,
    authorized,
  };
}

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

function getXOAuthHeader(method, baseUrl, extraParams = {}) {
  const xCreds = getXCredentials();
  const oauthParams = {
    oauth_consumer_key: xCreds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: xCreds.accessToken,
    oauth_version: '1.0',
  };
  const allParams = { ...oauthParams, ...extraParams };
  const signature = generateOAuthSignature(
    method,
    baseUrl,
    allParams,
    xCreds.apiSecret,
    xCreds.accessTokenSecret
  );

  return `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`)
    .join(', ')}`;
}

async function validateXCredentials() {
  const xCreds = getXCredentials();
  const configured = [
    xCreds.apiKey,
    xCreds.apiSecret,
    xCreds.accessToken,
    xCreds.accessTokenSecret,
  ].every(isPresent);

  if (!configured) {
    return {
      performed: false,
      validated: false,
      status: null,
      detail: 'X credentials are not fully configured',
      userId: null,
    };
  }

  const baseUrl = `${X_API_BASE}/2/users/me`;
  const queryParams = { 'user.fields': 'id' };
  const fullUrl = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        Authorization: getXOAuthHeader('GET', baseUrl, queryParams),
      },
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok) {
      return {
        performed: true,
        validated: true,
        status: response.status,
        detail: 'X API credentials accepted',
        userId: data?.data?.id || null,
      };
    }

    const apiDetail = data?.detail || data?.title || `HTTP ${response.status}`;
    const detail = response.status === 401
      ? 'X API rejected the configured credentials or app permissions'
      : apiDetail;

    return {
      performed: true,
      validated: false,
      status: response.status,
      detail,
      userId: null,
    };
  } catch (error) {
    return {
      performed: true,
      validated: false,
      status: null,
      detail: error?.message || 'X credential validation request failed',
      userId: null,
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const checks = buildEnvChecks();
  const auth = getAuthorizationState(req, checks.cronSecretConfigured);
  let missing = getMissingRequirements(checks, isProduction);

  if (isProduction && checks.cronSecretConfigured && !auth.authorized) {
    return res.status(401).json({
      ok: false,
      status: 'unauthorized',
      error: 'Unauthorized',
      auth: {
        cronSecretConfigured: true,
        headerPresent: auth.headerPresent,
        authorized: false,
      },
      timestamp: new Date().toISOString(),
    });
  }

  let xAuth = {
    performed: false,
    validated: false,
    status: null,
    detail: checks.xCredentialsConfigured
      ? 'Validation skipped'
      : 'X credentials are not fully configured',
    userId: null,
  };
  if (checks.xCredentialsConfigured) {
    xAuth = await validateXCredentials();
    if (xAuth.performed && !xAuth.validated) {
      const suffix = xAuth.status ? ` (${xAuth.status})` : '';
      missing.push(`X API authentication failed${suffix}: ${xAuth.detail}`);
    }
  }

  const response = {
    ok: missing.length === 0,
    status: missing.length === 0 ? 'ok' : 'misconfigured',
    environment: {
      vercelEnv: process.env.VERCEL_ENV || null,
      nodeEnv: process.env.NODE_ENV || null,
      isProduction,
    },
    auth: {
      cronSecretConfigured: checks.cronSecretConfigured,
      headerPresent: auth.headerPresent,
      authorized: checks.cronSecretConfigured ? auth.authorized : false,
    },
    xAuth,
    checks: {
      xPostingReady: checks.xCredentialsConfigured && xAuth.validated,
      xCredentialsConfigured: checks.xCredentialsConfigured,
      xAuthValidated: xAuth.validated,
      redisReady: checks.redisConfigured,
      marketDataReady: checks.twelveDataConfigured,
      aiPostingReady: checks.anthropicXpostConfigured,
      breakingNewsReady: checks.marketauxConfigured,
      sentinelPnlReady: checks.sentinelSupabaseConfigured,
    },
    missing,
    notes: [
      'This endpoint never posts to X.',
      'When X credentials are configured, this endpoint validates them against GET /2/users/me before reporting healthy.',
      'In production, once CRON_SECRET is configured, this route also requires Authorization: Bearer <CRON_SECRET>.',
    ],
    timestamp: new Date().toISOString(),
  };

  if (!checks.cronSecretConfigured && isProduction) {
    response.notes.unshift('CRON_SECRET is missing, so production X bot routes will fail closed.');
  }

  return res.status(missing.length === 0 ? 200 : 500).json(response);
}
