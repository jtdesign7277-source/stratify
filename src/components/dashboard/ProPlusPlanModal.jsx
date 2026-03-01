import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

const DEFAULT_FEATURES = [
  'Live breaking news feed (MARKETAUX_API_KEY)',
  'Live stock, crypto, and index tickers from Twelve Data WebSocket',
  'Unlimited Sophia AI chat and strategy builds (Anthropic)',
  'Unlimited paper trading beyond the $300,000 simulation cap',
];

const resolveTitle = (reason) => {
  const normalizedReason = String(reason || '').trim().toLowerCase();
  if (normalizedReason === 'sophia_limit_reached') return 'Sophia Usage Limit Reached';
  if (normalizedReason === 'paper_trading_limit_reached') return 'Paper Trading Limit Reached';
  return 'Upgrade Required';
};

export default function ProPlusPlanModal({
  open = false,
  payload = null,
  onClose,
  onOpenUpgrade,
  upgrading = false,
  upgradeError = '',
}) {
  if (!open) return null;

  const planName = String(payload?.plan?.name || 'PRO PLUS PLAN').trim() || 'PRO PLUS PLAN';
  const monthlyPrice = Number(payload?.plan?.monthly_price || 39.99);
  const features = Array.isArray(payload?.plan?.features) && payload.plan.features.length > 0
    ? payload.plan.features
    : DEFAULT_FEATURES;
  const usage = payload?.usage && typeof payload.usage === 'object' ? payload.usage : null;
  const title = resolveTitle(payload?.reason);
  const message = String(
    payload?.message
    || `Subscribe to ${planName} to unlock all premium features.`
  ).trim();

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">{planName}</div>
            <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-white/70">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close Pro Plus modal"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-cyan-200">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.7} />
            <span className="font-semibold">PRO PLUS PLAN — ${monthlyPrice.toFixed(2)}/month</span>
          </div>
        </div>

        {usage ? (
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-3 text-xs text-white/70 md:grid-cols-3">
            <div>Used: <span className="font-mono text-white">${Number(usage.used_usd || 0).toFixed(2)}</span></div>
            <div>Limit: <span className="font-mono text-white">${Number(usage.limit_usd || 0).toFixed(2)}</span></div>
            <div>Remaining: <span className="font-mono text-white">${Number(usage.remaining_usd || 0).toFixed(2)}</span></div>
          </div>
        ) : null}

        <div className="mb-5 space-y-2 rounded-xl border border-white/[0.08] bg-black/30 p-4">
          {features.map((feature) => (
            <div key={feature} className="flex items-start gap-2 text-sm text-white/80">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.7} />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={upgrading}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onOpenUpgrade}
            disabled={upgrading}
            className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/30"
          >
            {upgrading ? 'Redirecting to Stripe...' : 'Subscribe to PRO PLUS PLAN'}
          </button>
        </div>
        {upgradeError ? (
          <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {upgradeError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
