import React from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

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
  const bgClass = hasTrend
    ? (isPositive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30')
    : 'bg-zinc-500/10 border-zinc-500/30';

  const showLoading = loading && price === null;
  const percentText = changePercent === null
    ? '--'
    : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

  return (
    <div className={`h-8 px-3 rounded-full flex items-center gap-2 border ${bgClass} group cursor-default`}>
      <span className="text-xs font-semibold text-white">{symbol}</span>
      {showLoading ? (
        <span className="text-xs text-gray-400">...</span>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-white">{price === null ? '--' : `$${price.toFixed(2)}`}</span>
          <span className={`text-[10px] font-mono ${colorClass} flex items-center`}>
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
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded-full transition-opacity"
      >
        <X className="w-3 h-3 text-gray-400 hover:text-white" />
      </button>
    </div>
  );
};

export default TickerPill;
