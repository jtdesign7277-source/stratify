const CHECKOUT_PENDING_SESSION_KEY = 'stratify_checkout_pending_session_id';
const CHECKOUT_PENDING_STARTED_AT_KEY = 'stratify_checkout_pending_started_at';
const CHECKOUT_PENDING_TTL_MS = 1000 * 60 * 60 * 6;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function persistPendingCheckoutSession(sessionId) {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId || !canUseStorage()) return;

  try {
    window.localStorage.setItem(CHECKOUT_PENDING_SESSION_KEY, normalizedSessionId);
    window.localStorage.setItem(CHECKOUT_PENDING_STARTED_AT_KEY, String(Date.now()));
  } catch {
    // localStorage may be unavailable in private browsing modes.
  }
}

export function clearPendingCheckoutSession() {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(CHECKOUT_PENDING_SESSION_KEY);
    window.localStorage.removeItem(CHECKOUT_PENDING_STARTED_AT_KEY);
  } catch {
    // no-op
  }
}

export function readPendingCheckoutSession() {
  if (!canUseStorage()) return null;

  try {
    const sessionId = String(window.localStorage.getItem(CHECKOUT_PENDING_SESSION_KEY) || '').trim();
    if (!sessionId) return null;

    const startedAtRaw = window.localStorage.getItem(CHECKOUT_PENDING_STARTED_AT_KEY);
    const startedAt = Number(startedAtRaw);
    const hasValidTimestamp = Number.isFinite(startedAt) && startedAt > 0;

    if (hasValidTimestamp && Date.now() - startedAt > CHECKOUT_PENDING_TTL_MS) {
      clearPendingCheckoutSession();
      return null;
    }

    return sessionId;
  } catch {
    return null;
  }
}
