import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, TrendingUp, TrendingDown, X } from 'lucide-react';

const MAX_VISIBLE = 5;

function timeAgoLabel(ts) {
  if (!ts) return 'just now';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function PriceAlertToasts({ toasts = [], onDismiss }) {
  const visible = toasts.slice(-MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div className="absolute left-0 top-0 z-40 flex flex-col gap-2 p-2 pointer-events-none" style={{ width: 280 }}>
      <AnimatePresence initial={false}>
        {visible.map((toast) => {
          const isAbove = toast.direction === 'above';
          const price = Number.isFinite(Number(toast.price)) ? Number(toast.price) : null;
          const targetPrice = Number.isFinite(Number(toast.targetPrice)) ? Number(toast.targetPrice) : null;
          const pct = price != null && targetPrice != null && targetPrice !== 0
            ? (((price - targetPrice) / targetPrice) * 100).toFixed(2)
            : null;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              className="relative bg-[#161b22] border border-white/10 rounded-xl p-3 shadow-lg backdrop-blur-md pointer-events-auto"
            >
              {/* Row 1: header + dismiss */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Bell size={14} strokeWidth={1.5} className="text-[#58a6ff] flex-shrink-0" />
                  <span className="text-[#58a6ff] text-xs font-bold uppercase tracking-wide">Price Alert</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss?.(toast.id)}
                  className="text-[#7d8590] hover:text-[#e6edf3] transition-colors cursor-pointer"
                  aria-label="Dismiss alert"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>

              {/* Row 2: ticker + direction message */}
              <div className="text-[#e6edf3] text-sm font-bold leading-tight mb-1">
                {isAbove
                  ? `$${toast.ticker} hit $${targetPrice != null ? targetPrice.toFixed(2) : '--'}`
                  : `$${toast.ticker} dropped below $${targetPrice != null ? targetPrice.toFixed(2) : '--'}`
                }
              </div>

              {/* Row 3: current price + % change */}
              <div className={`flex items-center gap-1.5 text-xs font-mono mb-1.5 ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                {isAbove
                  ? <TrendingUp size={12} strokeWidth={1.5} className="flex-shrink-0" />
                  : <TrendingDown size={12} strokeWidth={1.5} className="flex-shrink-0" />
                }
                <span className="text-[#e6edf3]">
                  {price != null ? `$${price.toFixed(2)}` : '—'}
                </span>
                {pct != null && (
                  <span>{isAbove ? '+' : ''}{pct}%</span>
                )}
              </div>

              {/* Row 4: timestamp */}
              <div className="text-[#7d8590] text-xs">
                {timeAgoLabel(toast.triggeredAt)}
              </div>

              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#58a6ff]/30" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
