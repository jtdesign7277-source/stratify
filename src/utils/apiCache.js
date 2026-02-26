// ---------------------------------------------------------------------------
// apiCache.js -- Request dedup, debounce, and client-side response caching
// No external dependencies. Pure ES module.
// ---------------------------------------------------------------------------

// ---- Simple hash (djb2) ---------------------------------------------------

/**
 * Returns a short deterministic hash string for any input string.
 * Uses the djb2 algorithm and encodes the result as base-36.
 */
export function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0; // hash * 33 + c
  }
  // Convert to unsigned 32-bit then base-36 for a compact key
  return (hash >>> 0).toString(36);
}

// ---- Request deduplication ------------------------------------------------

/** @type {Map<string, Promise<Response>>} */
const pendingRequests = new Map();

/**
 * Drop-in replacement for `fetch` that deduplicates identical in-flight
 * requests.  Two requests are considered identical when their URL and
 * serialised options produce the same hash.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export function dedupedFetch(url, options = {}) {
  const key = simpleHash(url + JSON.stringify(options));

  if (pendingRequests.has(key)) {
    // Clone so each caller gets an independent Response body stream
    return pendingRequests.get(key).then((res) => res.clone());
  }

  const request = fetch(url, options)
    .then((res) => {
      // Keep a clone in the promise chain so the first consumer can still
      // read the body while subsequent callers receive their own clone above.
      return res;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);

  // Return a clone for the first caller as well so the stored Response
  // remains unconsumed for any late duplicate that arrives before finally().
  return request.then((res) => res.clone());
}

// ---- Debounce utility -----------------------------------------------------

/**
 * Creates a debounced wrapper around `fn`.
 *
 * @param {Function} fn        - The function to debounce.
 * @param {number}   [delay=500] - Delay in milliseconds.
 * @returns {{ call: (...args: any[]) => void, cancel: () => void }}
 */
export function createDebouncedFn(fn, delay = 500) {
  let timerId = null;

  function call(...args) {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      fn(...args);
    }, delay);
  }

  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  return { call, cancel };
}

// ---- Client-side response cache with TTL ----------------------------------

/** @type {Map<string, { data: any, timestamp: number, ttl: number }>} */
const cache = new Map();

/**
 * Retrieve a cached value if it exists and has not expired.
 *
 * @param {string} key
 * @returns {any|null} The cached data, or `null` if missing / expired.
 */
export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a value in the cache with a given TTL.
 *
 * @param {string} key
 * @param {any}    data
 * @param {number} ttlMs - Time-to-live in milliseconds.
 */
export function setCache(key, data, ttlMs) {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

/**
 * Clear the entire client-side cache.
 */
export function clearCache() {
  cache.clear();
}

// ---- Combined fetch helper ------------------------------------------------

/**
 * Fetches JSON from `url` with built-in client-side caching and request
 * deduplication.
 *
 * 1. Checks the client cache -- returns immediately on a hit.
 * 2. On a miss, uses `dedupedFetch` so concurrent identical calls share one
 *    network request.
 * 3. Caches the parsed JSON response for `cacheTtlMs` milliseconds.
 *
 * @param {string}      url
 * @param {RequestInit}  [options]
 * @param {number}       [cacheTtlMs=60000] - Cache lifetime (default 60 s).
 * @returns {Promise<any>} Parsed JSON response.
 */
export async function cachedFetch(url, options = {}, cacheTtlMs = 60_000) {
  const cacheKey = simpleHash(url + JSON.stringify(options));

  const hit = getCached(cacheKey);
  if (hit !== null) return hit;

  const res = await dedupedFetch(url, options);
  if (!res.ok) {
    throw new Error(`cachedFetch: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  setCache(cacheKey, data, cacheTtlMs);
  return data;
}
