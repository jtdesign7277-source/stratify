import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { T, CARD_VARIANTS, HOVER_LIFT } from './communityConstants';
import { ShimmerBlock } from './CommunityShared';
import {
  normalizeSymbolKey,
  toMaybeFiniteNumber,
  formatPrice,
  formatSignedPercent,
} from './communityHelpers';

const sentimentStyle = (sentiment) => {
  if (sentiment === 'bullish') return { label: 'Bullish', color: T.green, bg: 'rgba(63,185,80,0.12)' };
  if (sentiment === 'bearish') return { label: 'Bearish', color: T.red, bg: 'rgba(248,81,73,0.12)' };
  return { label: 'Neutral', color: T.muted, bg: 'rgba(125,133,144,0.16)' };
};

export const AiSearchLoadingCard = ({ query }) => (
  <motion.article
    layout
    {...HOVER_LIFT}
    className="rounded-lg border border-l-2 p-3 animate-pulse"
    style={{
      borderColor: T.border,
      borderLeftColor: T.blue,
      backgroundColor: T.card,
    }}
  >
    <div className="flex items-center gap-2 text-xs mb-2" style={{ color: T.blue }}>
      <Sparkles size={13} strokeWidth={1.5} />
      <span>Searching...</span>
      {query ? <span style={{ color: T.muted }}>"{query}"</span> : null}
    </div>
    <ShimmerBlock lines={3} />
  </motion.article>
);

export const AiSearchResultCard = ({ result, quoteMap = {}, onClear, onTickerClick }) => {
  const sentiment = sentimentStyle(result?.sentiment);
  const snapshots = result?.tickerSnapshots && typeof result.tickerSnapshots === 'object'
    ? result.tickerSnapshots
    : {};

  const resolveQuote = (ticker, quoteMap) => {
    const normalized = normalizeSymbolKey(ticker);
    if (!normalized) return null;

    const streamRow = quoteMap?.[normalized]
      || quoteMap?.[`${normalized}/USD`]
      || null;
    if (streamRow) {
      const price = toMaybeFiniteNumber(streamRow?.price ?? streamRow?.last ?? streamRow?.close);
      const percentChange = toMaybeFiniteNumber(
        streamRow?.dayChangePercent
        ?? streamRow?.percentChange
        ?? streamRow?.percent_change
        ?? streamRow?.changePercent
      );
      return {
        price,
        percentChange,
      };
    }

    const snapshotRow = snapshots?.[normalized]
      || snapshots?.[`${normalized}/USD`]
      || null;
    if (!snapshotRow) return null;
    return {
      price: toMaybeFiniteNumber(snapshotRow?.price),
      percentChange: toMaybeFiniteNumber(snapshotRow?.percentChange),
    };
  };

  return (
    <motion.article
      layout
      variants={CARD_VARIANTS}
      {...HOVER_LIFT}
      className="rounded-lg border border-l-2 p-4"
      style={{
        borderColor: T.border,
        borderLeftColor: '#58a6ff',
        backgroundColor: '#151b23',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm inline-flex items-center gap-1.5 font-semibold" style={{ color: T.blue }}>
            <Sparkles size={13} strokeWidth={1.5} />
            <span>AI Search Result</span>
          </div>
          <div className="text-sm mt-1 truncate" style={{ color: T.muted }}>
            "{result?.query || ''}"
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm transition-colors"
          style={{ color: T.muted }}
          onMouseEnter={(event) => { event.currentTarget.style.color = T.text; }}
          onMouseLeave={(event) => { event.currentTarget.style.color = T.muted; }}
        >
          Clear search
        </button>
      </div>

      <p className="mt-3 text-[15px] leading-7 font-medium" style={{ color: '#e6edf3' }}>
        {result?.summary}
      </p>

      {Array.isArray(result?.keyPoints) && result.keyPoints.length > 0 ? (
        <div className="mt-3 space-y-2">
          {result.keyPoints.map((point, index) => (
            <div key={`${result.id}-kp-${index}`} className="text-sm leading-6" style={{ color: '#c9d1d9' }}>
              - {point}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="text-[11px] px-2 py-0.5 rounded-full border"
          style={{
            color: sentiment.color,
            borderColor: sentiment.color,
            backgroundColor: sentiment.bg,
          }}
        >
          {sentiment.label}
        </span>

        {(result.relatedTickers || []).map((ticker) => {
          const quote = resolveQuote(ticker, quoteMap);
          const quotePrice = quote?.price;
          const quotePct = quote?.percentChange;
          return (
            <button
              key={`${result.id}-ticker-${ticker}`}
              type="button"
              onClick={() => onTickerClick?.(ticker)}
              className="text-sm px-3 py-1 rounded-full border transition-colors inline-flex items-center gap-1.5"
              style={{
                color: T.blue,
                borderColor: 'rgba(88,166,255,0.35)',
                backgroundColor: 'rgba(88,166,255,0.12)',
              }}
            >
              <span className="font-semibold">${ticker}</span>
              {Number.isFinite(quotePrice) ? (
                <span style={{ color: '#e6edf3' }}>${formatPrice(quotePrice)}</span>
              ) : null}
              {Number.isFinite(quotePct) ? (
                <span style={{ color: quotePct >= 0 ? T.green : T.red }}>
                  {formatSignedPercent(quotePct)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {Array.isArray(result?.sources) && result.sources.length > 0 ? (
        <div className="mt-3 pt-2 border-t space-y-2" style={{ borderColor: T.border }}>
          <div className="text-[11px] uppercase tracking-[0.13em]" style={{ color: T.muted }}>Sources</div>
          {result.sources.map((source, index) => (
            <a
              key={`${result.id}-source-${index}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border px-2.5 py-2 transition-colors"
              style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.5)' }}
            >
              <div className="text-xs truncate" style={{ color: T.blue }}>{source.title || source.url}</div>
              <div className="text-[11px] truncate" style={{ color: T.muted }}>{source.url}</div>
            </a>
          ))}
        </div>
      ) : null}
    </motion.article>
  );
};
