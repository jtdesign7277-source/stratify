import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { persistPendingCheckoutSession } from '../../lib/checkoutSession';
import {
  PRO_BILLING_INTERVAL_MONTHLY,
  PRO_BILLING_INTERVAL_YEARLY,
  PRO_MONTHLY_PRICE,
  PRO_YEARLY_PRICE,
  PRO_YEARLY_STRIPE_PRICE_ID,
  resolveProCheckoutPriceId,
} from '../../lib/billing';

const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

const modalPanel = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { type: 'spring', stiffness: 400, damping: 30 },
};

const FEATURES = [
  'War Room, Terminal, Trade, Portfolio',
  'AI strategy builder & backtesting',
  'Live market data & alerts',
  'Priority support',
];

export default function ProModal({ open, onClose }) {
  const { user } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  const startCheckout = useCallback(
    async (interval) => {
      if (!user?.id || !user?.email) {
        setError('Please sign in to continue with checkout.');
        return;
      }

      const resolvedPriceId = resolveProCheckoutPriceId(interval);

      if (!resolvedPriceId) {
        setError('Missing Stripe price configuration.');
        return;
      }

      if (interval === PRO_BILLING_INTERVAL_YEARLY && !PRO_YEARLY_STRIPE_PRICE_ID) {
        setError('Yearly checkout is not configured yet. Use monthly for now.');
        return;
      }

      setError('');
      setRedirecting(true);

      try {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            priceId: resolvedPriceId,
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
        setError(err?.message || 'Unable to redirect to Stripe checkout.');
        setRedirecting(false);
      }
    },
    [user?.id, user?.email]
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        {...modalBackdrop}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          {...modalPanel}
          className="w-full max-w-md rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.5)] p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-1">
            <span aria-hidden>⚡</span>
            Upgrade to Stratify Pro
          </h2>
          <p className="text-sm text-white/60 mb-5">Unlock the full dashboard and AI tools.</p>

          <ul className="space-y-2 mb-6">
            {FEATURES.map((line, i) => (
              <li key={i} className="text-sm text-emerald-400">
                {line}
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col">
              <div className="text-lg font-semibold text-white">${PRO_MONTHLY_PRICE.toFixed(2)}/mo</div>
              <div className="text-xs text-white/50 mb-3">Monthly</div>
              <button
                type="button"
                onClick={() => startCheckout(PRO_BILLING_INTERVAL_MONTHLY)}
                disabled={redirecting}
                className="mt-auto rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-3 py-2 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
              >
                {redirecting ? 'Redirecting...' : 'Upgrade Now'}
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col">
              <div className="text-lg font-semibold text-white">${PRO_YEARLY_PRICE.toFixed(2)}/yr</div>
              <div className="text-xs text-white/50 mb-1">Annual</div>
              <div className="text-xs text-emerald-400 mb-3">Save 20%</div>
              <button
                type="button"
                onClick={() => startCheckout(PRO_BILLING_INTERVAL_YEARLY)}
                disabled={redirecting}
                className="mt-auto rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-3 py-2 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
              >
                {redirecting ? 'Redirecting...' : 'Upgrade Now'}
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-white/10 text-white/70 py-2 text-sm font-medium hover:bg-white/5 hover:text-white/90 transition-colors"
          >
            Maybe later
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
