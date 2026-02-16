import crypto from 'crypto';

/**
 * Webull OpenAPI Signature Helper
 * 
 * Webull uses HMAC-SHA1 to sign requests.
 * Signature = Base64(HMAC-SHA1(app_secret, signContent))
 * signContent = app_key|timestamp|method|endpoint|body(if POST)
 */

export function generateSignature(appSecret, signContent) {
  return crypto
    .createHmac('sha1', appSecret)
    .update(signContent)
    .digest('base64');
}

export function buildSignHeaders(appKey, appSecret, method, endpoint, body = '') {
  const timestamp = Date.now().toString();
  const signParts = [appKey, timestamp, method.toUpperCase(), endpoint];
  if (body) signParts.push(body);
  const signContent = signParts.join('|');
  const signature = generateSignature(appSecret, signContent);

  return {
    'app_key': appKey,
    'timestamp': timestamp,
    'sign': signature,
    'sign_type': 'HMAC-SHA1',
    'Content-Type': 'application/json',
  };
}

/**
 * Get Webull access token using app_key + app_secret
 * POST /api/trade/token/v2/get
 */
export async function getWebullToken(appKey, appSecret) {
  const endpoint = '/api/trade/token/v2/get';
  const baseUrl = 'https://api.webull.com';
  const body = JSON.stringify({ app_key: appKey });
  const headers = buildSignHeaders(appKey, appSecret, 'POST', endpoint, body);

  const resp = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Webull token error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  if (data.code !== 200 && data.code !== 0 && !data.data?.access_token) {
    throw new Error(`Webull token failed: ${JSON.stringify(data)}`);
  }

  return data.data?.access_token || data.access_token;
}

/**
 * Make authenticated Webull API request
 */
export async function webullRequest(appKey, appSecret, method, endpoint, body = null) {
  const baseUrl = 'https://api.webull.com';
  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = buildSignHeaders(appKey, appSecret, method, endpoint, bodyStr);

  // Get fresh token for each request (tokens are short-lived)
  const token = await getWebullToken(appKey, appSecret);
  headers['access_token'] = token;

  const opts = { method, headers };
  if (bodyStr) opts.body = bodyStr;

  const resp = await fetch(`${baseUrl}${endpoint}`, opts);

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Webull API error (${resp.status}): ${text}`);
  }

  return resp.json();
}
