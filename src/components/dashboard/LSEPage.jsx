import { useMemo, useState } from 'react';
import { Globe, Loader2, RefreshCcw, Search, Wifi, WifiOff } from 'lucide-react';
import useTwelveData from '../../hooks/useTwelveData';

const PRESET_WATCHLIST = [
  { symbol: 'SHEL', name: 'Shell plc' },
  { symbol: 'AZN', name: 'AstraZeneca' },
  { symbol: 'HSBA', name: 'HSBC Holdings' },
  { symbol: 'BP', name: 'BP plc' },
  { symbol: 'ULVR', name: 'Unilever PLC' },
  { symbol: 'RIO', name: 'Rio Tinto' },
  { symbol: 'GSK', name: 'GSK plc' },
  { symbol: 'BARC', name: 'Barclays PLC' },
  { symbol: 'LLOY', name: 'Lloyds Banking Group' },
  { symbol: 'NG', name: 'National Grid' },
  { symbol: 'REL', name: 'RELX' },
  { symbol: 'VOD', name: 'Vodafone Group' },
];

const formatPrice = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `£${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleTimeString();
};

const valueClass = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'text-white/60';
  if (num > 0) return 'text-emerald-400';
  if (num < 0) return 'text-red-400';
  return 'text-white/70';
};

const LSEPage = () => {
  const [query, setQuery] = useState('');
  const watchlistSymbols = useMemo(() => PRESET_WATCHLIST.map((item) => item.symbol), []);
  const labelsBySymbol = useMemo(
    () => PRESET_WATCHLIST.reduce((acc, item) => ({ ...acc, [item.symbol]: item.name }), {}),
    []
  );

  const {
    quoteList,
    quotes,
    status,
    error,
    loadingQuotes,
    loadingSearch,
    searchResults,
    searchSymbols,
    refreshQuotes,
  } = useTwelveData({ symbols: watchlistSymbols, labelsBySymbol });

  const connectionLabel = useMemo(() => {
    if (status.connected) return 'Live';
    if (status.connecting) return 'Connecting...';
    return 'Offline';
  }, [status.connected, status.connecting]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await searchSymbols(query);
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-transparent px-5 py-4" style={{ scrollbarWidth: 'none' }}>
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="rounded-xl border border-blue-500/20 bg-[#060d18]/70 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
              <div>
                <h1 className="text-lg font-semibold text-white">Global Markets</h1>
                <p className="text-xs text-white/55">UK blue-chip watchlist (U.S.-friendly defaults) via Twelve Data streaming</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={`inline-flex items-center gap-1.5 ${status.connected ? 'text-emerald-400' : 'text-amber-300'}`}>
                {status.connected ? <Wifi className="h-3.5 w-3.5" strokeWidth={1.5} /> : <WifiOff className="h-3.5 w-3.5" strokeWidth={1.5} />}
                {connectionLabel}
              </span>
              <button
                type="button"
                onClick={refreshQuotes}
                className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-blue-300 hover:bg-blue-500/20 transition-colors"
              >
                <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                Refresh
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-xl border border-blue-500/20 bg-[#0a1628]/75 p-4 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">London Stock Exchange Watchlist</h2>
              {loadingQuotes && <Loader2 className="h-4 w-4 animate-spin text-blue-400" strokeWidth={1.5} />}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PRESET_WATCHLIST.map((item) => {
                const quote = quotes[item.symbol] || quoteList.find((entry) => entry.symbol === item.symbol) || {
                  symbol: item.symbol,
                  name: item.name,
                  price: null,
                  percentChange: null,
                  timestamp: null,
                };

                return (
                <article key={item.symbol} className="rounded-lg border border-white/10 bg-[#060d18]/70 p-3">
                  <div className="text-sm font-semibold text-white">{item.symbol}</div>
                  <div className="mt-0.5 text-xs text-white/55 truncate">{item.name}</div>
                  <div className="mt-3 text-lg font-semibold text-white">{formatPrice(quote.price)}</div>
                  <div className={`text-sm font-medium ${valueClass(quote.percentChange)}`}>
                    {formatPercent(quote.percentChange)}
                  </div>
                  <div className="mt-2 text-[11px] text-white/45">Updated: {formatTime(quote.timestamp)}</div>
                </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-blue-500/20 bg-[#0a1628]/75 p-4 backdrop-blur">
            <h2 className="text-sm font-semibold text-white">LSE Symbol Search</h2>
            <form onSubmit={handleSearch} className="mt-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#060d18]/80 px-3 py-2">
                <Search className="h-4 w-4 text-white/45" strokeWidth={1.5} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search LSE ticker..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 transition-colors"
              >
                Search
              </button>
            </form>

            <div className="mt-3 min-h-[280px] rounded-lg border border-white/10 bg-[#060d18]/70 p-2">
              {loadingSearch ? (
                <div className="flex items-center gap-2 px-2 py-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" strokeWidth={1.5} />
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 280, scrollbarWidth: 'none' }}>
                  {searchResults.map((item) => (
                    <div key={`${item.symbol}-${item.micCode}`} className="rounded-md border border-white/10 bg-[#0a1628]/60 px-2.5 py-2">
                      <div className="text-sm font-semibold text-white">{item.symbol}</div>
                      <div className="text-xs text-white/60">{item.instrumentName}</div>
                      <div className="mt-1 text-[11px] text-blue-300/90">
                        {item.exchange} {item.country ? `• ${item.country}` : ''} {item.currency ? `• ${item.currency}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-2 py-2 text-sm text-white/45">Search for a London ticker (e.g., VOD, HSBA, BP).</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LSEPage;
