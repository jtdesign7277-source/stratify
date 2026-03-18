function isPresent(value) {
  return String(value || '').trim().length > 0;
}

function getCombinedPresence(...values) {
  return values.some((value) => isPresent(value));
}

function buildEnvChecks() {
  const cronSecretConfigured = isPresent(process.env.CRON_SECRET);
  const xCredentialsConfigured = [
    process.env.X_API_KEY,
    process.env.X_API_SECRET,
    process.env.X_ACCESS_TOKEN,
    process.env.X_ACCESS_TOKEN_SECRET,
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const checks = buildEnvChecks();
  const auth = getAuthorizationState(req, checks.cronSecretConfigured);
  const missing = getMissingRequirements(checks, isProduction);

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
    checks: {
      xPostingReady: checks.xCredentialsConfigured,
      redisReady: checks.redisConfigured,
      marketDataReady: checks.twelveDataConfigured,
      aiPostingReady: checks.anthropicXpostConfigured,
      breakingNewsReady: checks.marketauxConfigured,
      sentinelPnlReady: checks.sentinelSupabaseConfigured,
    },
    missing,
    notes: [
      'This endpoint never posts to X.',
      'In production, once CRON_SECRET is configured, this route also requires Authorization: Bearer <CRON_SECRET>.',
    ],
    timestamp: new Date().toISOString(),
  };

  if (!checks.cronSecretConfigured && isProduction) {
    response.notes.unshift('CRON_SECRET is missing, so production X bot routes will fail closed.');
  }

  return res.status(missing.length === 0 ? 200 : 500).json(response);
}
