import React, { useEffect, useMemo, useState } from 'react';

const TAPE_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA', 'AAPL', 'MSFT', 'NVDA', 'TSLA'];
const REFRESH_MS = 20_000;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPrice = (value) => (Number.isFinite(value) ? Number(value).toFixed(2) : '--');

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const percentColorClass = (value) => {
  if (!Number.isFinite(value)) return 'text-white/45';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-rose-400';
  return 'text-white/60';
};

export default function LandingMarketTape() {
  const [quotes, setQuotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchQuotes = async (showLoading = false) => {
      if (showLoading && isMounted) setIsLoading(true);

      try {
        const response = await fetch('/api/watchlist/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: TAPE_SYMBOLS }),
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const bySymbol = new Map();

        rows.forEach((row) => {
          const symbol = String(row?.requestedSymbol || row?.symbol || '')
            .trim()
            .toUpperCase();
          if (!symbol) return;

          const raw = row?.raw || row;
          const price = toNumber(row?.price ?? row?.last ?? row?.close ?? raw?.close);
          const percent = toNumber(row?.percentChange ?? row?.percent_change ?? raw?.percent_change ?? raw?.percentChange);

          bySymbol.set(symbol, {
            symbol,
            price,
            percent,
          });
        });

        const ordered = TAPE_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter(Boolean);
        if (isMounted && ordered.length > 0) setQuotes(ordered);
      } catch (error) {
        console.error('[LandingMarketTape] Quote fetch error:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchQuotes(true);
    const timer = setInterval(() => fetchQuotes(false), REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const displayRows = useMemo(() => {
    if (quotes.length > 0) return quotes;
    return TAPE_SYMBOLS.map((symbol) => ({ symbol, price: null, percent: null }));
  }, [quotes]);

  const scrollingRows = useMemo(() => [...displayRows, ...displayRows], [displayRows]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-[rgba(2,8,14,0.74)] backdrop-blur-md">
      <style>{`
        @keyframes landing-market-tape-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .landing-market-tape-track {
          animation: landing-market-tape-scroll 64s linear infinite;
        }
        .landing-market-tape-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="relative h-10 overflow-hidden">
        <div className="landing-market-tape-track inline-flex min-w-max items-center gap-5 px-4 py-2.5">
          {scrollingRows.map((row, index) => (
            <div key={`${row.symbol}-${index}`} className="inline-flex items-center gap-2 text-[12px]">
              <span className="font-semibold text-white/85">{`$${row.symbol}`}</span>
              <span className="text-white/70">{formatPrice(row.price)}</span>
              <span className={`font-semibold ${percentColorClass(row.percent)}`}>{formatPercent(row.percent)}</span>
              <span className="ml-1 text-white/20">•</span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#030812] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#030812] to-transparent" />
        {isLoading ? (
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[10px] uppercase tracking-[0.16em] text-white/40">
            Loading
          </div>
        ) : null}
      </div>
    </div>
  );
}

