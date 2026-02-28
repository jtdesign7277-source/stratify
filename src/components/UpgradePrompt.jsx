import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { persistPendingCheckoutSession } from '../lib/checkoutSession';
import {
  getPreferredProBillingInterval,
  PRO_BILLING_INTERVAL_YEARLY,
  PRO_MONTHLY_PRICE_LABEL,
  PRO_YEARLY_DISCOUNT_LABEL,
  PRO_YEARLY_STRIPE_PRICE_ID,
  resolveProCheckoutPriceId,
} from '../lib/billing';

export default function UpgradePrompt({
  featureName = 'Premium Feature',
  description = 'Unlock advanced tools, higher limits, and priority insights.',
  priceId,
  className = '',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user, isAuthenticated } = useAuth();
  const preferredInterval = getPreferredProBillingInterval();
  const isYearlySelected = preferredInterval === PRO_BILLING_INTERVAL_YEARLY && Boolean(PRO_YEARLY_STRIPE_PRICE_ID);
  const checkoutPriceId = priceId || resolveProCheckoutPriceId(preferredInterval);
  const upgradeCtaLabel = isYearlySelected
    ? `Upgrade to Pro - Yearly (${PRO_YEARLY_DISCOUNT_LABEL})`
    : `Upgrade to Pro - ${PRO_MONTHLY_PRICE_LABEL}`;

  const handleUpgrade = async () => {
    if (!checkoutPriceId) {
      setError('Missing Stripe price ID.');
      return;
    }

    if (!isAuthenticated || !user?.id || !user?.email) {
      setError('Please sign in to upgrade.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: checkoutPriceId,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to start checkout.');
      }

      if (data?.sessionId) {
        persistPendingCheckoutSession(data.sessionId);
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      throw new Error('Stripe checkout URL missing.');
    } catch (err) {
      setError(err.message || 'Upgrade failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`w-full max-w-xl rounded-2xl border border-white/10 bg-[#060d18] p-6 shadow-[0_30px_80px_rgba(2,8,23,0.55)] ${className}`}
    >
      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-[0.3em] text-blue-400">Pro Required</div>
        <div className="text-2xl font-semibold text-white">{featureName}</div>
        <p className="text-sm text-white/70">{description}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Redirecting...' : upgradeCtaLabel}
          </button>
          <div className="text-xs text-white/50">Cancel anytime</div>
        </div>
        {error ? (
          <div className="text-xs text-red-300">{error}</div>
        ) : null}
      </div>
    </motion.div>
  );
}
