import React from 'react';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveQuoteValues = (quote) => {
  const price = toNumber(
    quote?.price
    ?? quote?.close
    ?? quote?.last
    ?? quote?.latestPrice
  );
  const change = toNumber(quote?.change);
  const changePercent = toNumber(
    quote?.changePercent
    ?? quote?.percentChange
    ?? quote?.percent_change
  );

  return { price, change, changePercent };
};

const TickerPill = ({ symbol, onRemove, quote = null, loading = false }) => {
  const { price, change, changePercent } = resolveQuoteValues(quote);
  const hasTrend = changePercent !== null || change !== null;
  const trendValue = changePercent ?? change ?? 0;
  const isPositive = trendValue >= 0;

  const colorClass = hasTrend
    ? (isPositive ? 'text-emerald-400' : 'text-red-400')
    : 'text-zinc-400';
  const showLoading = loading && price === null;
  const percentText = changePercent === null
    ? '--'
    : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

  return (
    <motion.div
      whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="h-7 px-1.5 flex items-center gap-1.5 group cursor-default rounded-lg"
    >
      <span
        className="ticker-symbol text-[11px] font-semibold text-white"
        style={{ fontVariationSettings: '"wght" 500', transition: 'font-variation-settings 200ms ease' }}
      >
        ${symbol}
      </span>
      {showLoading ? (
        <span className="text-[10px] text-gray-400">...</span>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-white">{price === null ? '--' : `$${price.toFixed(2)}`}</span>
          <span className={`text-[9px] font-mono ${colorClass} flex items-center`}>
            {hasTrend ? (
              isPositive ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
            ) : null}
            {percentText}
          </span>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.(symbol);
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity"
        aria-label={`Remove ${symbol} mini pill`}
        title="Remove mini pill"
      >
        <Trash2 className="w-3 h-3 text-gray-400 hover:text-emerald-300" />
      </button>
    </motion.div>
  );
};

export default TickerPill;
