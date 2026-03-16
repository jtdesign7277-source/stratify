/**
 * Global wrapper for Supabase calls that silently absorbs AbortErrors.
 *
 * On browser refresh, the browser aborts ALL in-flight fetch requests.
 * Every sync module (TradeHistory, Watchlist, Strategy, DashboardState,
 * Subscription, Auth, broker connections) fires AbortError simultaneously.
 * Without this wrapper, at least one stores the raw error Object in state
 * → React Error #310.
 *
 * Usage:
 *   const result = await safeSupabaseCall(() =>
 *     supabase.from('profiles').select('*').eq('id', userId).single()
 *   );
 *   if (!result) return; // aborted
 *   const { data, error } = result;
 */
export async function safeSupabaseCall(fn) {
  try {
    return await fn();
  } catch (error) {
    if (
      error?.name === 'AbortError' ||
      error?.message?.includes?.('AbortError') ||
      error?.code === 'ABORT_ERR' ||
      error?.code === 20
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Converts any error to a safe string for storing in React state.
 * Prevents Error #310 (Objects are not valid as React children).
 */
export function errorToString(error, fallback = 'An error occurred') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error?.message) return String(error.message);
  try { return String(error); } catch { return fallback; }
}

export default safeSupabaseCall;
