import React, { useEffect, useMemo, useState } from 'react';
import useAlpacaStream from '../../hooks/useAlpacaStream';

const SNAPSHOT_REFRESH_MS = 30000;
const INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA'];

const normalizeSymbol = (value) => {
  if (!value) return null;
  const symbol = String(value).trim().toUpperCase();
  return symbol ? symbol : null;
};

const buildSymbolList = (watchlist = []) => {
  const seen = new Set();
  const ordered = [];

  const addSymbol = (value) => {
    const symbol = normalizeSymbol(value);
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    ordered.push(symbol);
  };

  watchlist.forEach((item) => {
    if (typeof item === 'string') {
      addSymbol(item);
      return;
    }
    if (item && typeof item === 'object') {
      addSymbol(item.symbol || item.ticker || item.Symbol);
    }
  });

  INDEX_SYMBOLS.forEach(addSymbol);

  return ordered.slice(0, 200);
};

const formatChange = (value) => {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  const sign = safeValue >= 0 ? '+' : '-';
  return `${sign}${Math.abs(safeValue).toFixed(2)}`;
};

const formatPrice = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '...';
  return numeric.toFixed(2);
};

const LiveAlertsTicker = ({ watchlist = [] }) => {
  const symbols = useMemo(() => buildSymbolList(watchlist), [watchlist]);
  const symbolsKey = useMemo(() => symbols.join(','), [symbols]);

  const { stockQuotes } = useAlpacaStream({
    stockSymbols: symbols,
    cryptoSymbols: [],
    enabled: symbols.length > 0,
  });

  const [snapshots, setSnapshots] = useState({});
  const [prevCloseMap, setPrevCloseMap] = useState({});

  useEffect(() => {
    let isMounted = true;

    const fetchSnapshots = async () => {
      if (symbols.length === 0) {
        if (isMounted) {
          setSnapshots({});
          setPrevCloseMap({});
        }
        return;
      }

      try {
        const response = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbolsKey)}`);
        if (!response.ok) {
          throw new Error(`Snapshot fetch failed: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) return;

        const nextSnapshots = {};
        const nextPrevClose = {};

        data.forEach((item) => {
          const symbol = normalizeSymbol(item?.symbol);
          if (!symbol) return;
          const price = Number(item?.price ?? item?.latestPrice ?? item?.last ?? item?.close);
          const change = Number(item?.change ?? item?.changeAmount ?? item?.changeDollar);
          const prevClose = Number(item?.prevClose);

          nextSnapshots[symbol] = {
            price: Number.isFinite(price) ? price : undefined,
            change: Number.isFinite(change) ? change : undefined,
          };

          if (Number.isFinite(prevClose)) {
            nextPrevClose[symbol] = prevClose;
          } else if (Number.isFinite(price) && Number.isFinite(change)) {
            nextPrevClose[symbol] = price - change;
          }
        });

        if (isMounted) {
          setSnapshots(nextSnapshots);
          setPrevCloseMap(nextPrevClose);
        }
      } catch (error) {
        console.error('[LiveAlertsTicker] Snapshot fetch error:', error);
      }
    };

    fetchSnapshots();
    const interval = setInterval(fetchSnapshots, SNAPSHOT_REFRESH_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbolsKey, symbols.length]);

  const tickerItems = useMemo(() => (
    symbols.map((symbol) => {
      const snapshot = snapshots[symbol] || {};
      const wsQuote = stockQuotes[symbol] || {};
      const price = Number.isFinite(wsQuote.price)
        ? wsQuote.price
        : snapshot.price;
      const prevClose = prevCloseMap[symbol];
      const derivedChange = (Number.isFinite(prevClose) && Number.isFinite(price))
        ? price - prevClose
        : snapshot.change;

      return {
        symbol,
        price,
        change: derivedChange,
      };
    })
  ), [symbols, snapshots, prevCloseMap, stockQuotes]);

  const allItems = tickerItems.length > 0 ? [...tickerItems, ...tickerItems] : [];

  return (
    <div className="relative h-8 overflow-hidden bg-[#151518] border-b border-[#1f1f1f]">
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .live-ticker-track {
          display: flex;
          align-items: center;
          height: 100%;
          overflow: hidden;
        }
        .live-ticker-content {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: ticker-scroll 35s linear infinite;
        }
        .live-ticker-content:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      {/* LIVE Badge */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-[#151518] via-[#151518] to-transparent">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1e1e2d] border border-[#2a2a3d] rounded">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse shadow-[0_0_6px_rgba(0,200,83,0.6)]" />
          <span className="text-[10px] font-semibold text-[#E8EAED] uppercase tracking-wider">Live</span>
        </div>
      </div>
      
      {/* Scrolling Content */}
      <div className="live-ticker-track pl-20">
        <div className="live-ticker-content">
          {/* Duplicate items for seamless loop */}
          {allItems.map((item, idx) => {
            const changeValue = Number.isFinite(item.change) ? item.change : 0;
            const isPositive = changeValue >= 0;
            const dotClass = isPositive ? 'bg-emerald-400' : 'bg-red-400';
            const textClass = isPositive ? 'text-emerald-400' : 'text-red-400';

            return (
              <span key={`${item.symbol}-${idx}`} className="flex items-center">
                <span className={`inline-block mr-2 shrink-0 w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <span className={`text-xs font-medium ${textClass}`}>
                  {item.symbol} {formatChange(changeValue)} @ {formatPrice(item.price)}
                </span>
                <span className="mx-4 text-[#5f6368]">•</span>
              </span>
            );
          })}
        </div>
      </div>
      
      {/* Right fade */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#151518] to-transparent" />
    </div>
  );
};

export default LiveAlertsTicker;
