// Shared sports betting utilities and design tokens — NO project imports (circular import prevention)

/**
 * Calculate the total payout for a bet given a stake and American odds.
 * @param {number} stake - The amount wagered
 * @param {number|string} odds - American odds (e.g. +150, -110)
 * @returns {number} Total payout including stake
 */
export function calcPayout(stake, odds) {
  const n = Number(odds);
  if (n > 0) return stake * (n / 100 + 1);
  return stake * (100 / Math.abs(n) + 1);
}

/**
 * Design color tokens for the sports betting UI.
 * Matches the locked CONTEXT.md values — import these instead of copy-pasting.
 */
export const DESIGN_COLORS = {
  background: '#0a0a0f',
  accent: '#10b981',
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  muted: 'text-gray-400',
  dimmed: 'text-gray-500',
};

/**
 * Tailwind class strings for glass card variants.
 * Locked to CONTEXT.md values — Phase 2 components must import from here.
 */
export const GLASS_CARD = {
  standard:
    'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]',
  inset:
    'bg-black/40 rounded-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04]',
  active:
    'bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]',
  floating:
    'bg-white/[0.05] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)]',
};
