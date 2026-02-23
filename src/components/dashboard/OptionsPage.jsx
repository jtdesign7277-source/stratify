import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Settings, Zap } from 'lucide-react';
import { subscribeTwelveDataQuotes, subscribeTwelveDataStatus } from '../../services/twelveDataWebSocket';

// ── Mag 7 + Popular ──
const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'SPY', 'QQQ', 'AMD'];

// ── Helpers ──
const fmt = (v, dec = 2) => v != null ? Number(v).toFixed(dec) : '—';
const fmtPct = (v) => {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
};
const fmtIV = (v) => v != null ? (Number(v) * 100).toFixed(2) + '%' : '—';
const fmtStrike = (v) => Number(v).toFixed(v % 1 === 0 ? 0 : 2);
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' });
};
const dte = (d) => {
  if (!d) return 0;
  const now = new Date();
  const exp = new Date(d + 'T16:00:00');
  return Math.max(0, Math.ceil((exp - now) / 86400000));
};

// ── OCC Parser ──
function parseOCC(occ) {
  if (!occ || occ.length < 15) return null;
  const tail = occ.slice(-15);
  const underlying = occ.slice(0, -15).trim();
  const year = 2000 + parseInt(tail.slice(0, 2), 10);
  const month = tail.slice(2, 4);
  const day = tail.slice(4, 6);
  const type = tail[6] === 'C' ? 'call' : 'put';
  const strike = parseInt(tail.slice(7), 10) / 1000;
  return { underlying, expiration: `${year}-${month}-${day}`, type, strike };
}

// ── Color constants (matching reference screenshots) ──
const CALL_COLOR = '#00E5FF';     // teal/cyan for call bid/ask
const PUT_COLOR = '#FF4081';      // magenta/pink for put bid/ask
const GREEN = '#00E676';          // positive % change
const RED = '#FF1744';            // negative % change
const ITM_BG = '#0D0D1A';        // dark navy for ITM rows
const OTM_BG = 'transparent';    // black bg for OTM rows
const HEADER_BG = '#111118';     // slightly lighter header
const SEPARATOR_BG = '#0A0A14';  // ITM separator bar
const SIDE_COL_WIDTH = '16.6667%';

const OptionsPage = () => {
  const [activeTicker, setActiveTicker] = useState('AAPL');
  const [stockPrice, setStockPrice] = useState(null);
  const [stockChange, setStockChange] = useState(null);
  const [stockChangePct, setStockChangePct] = useState(null);
  const [chains, setChains] = useState([]); // grouped by expiration
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numStrikes, setNumStrikes] = useState(6);
  const [chainView, setChainView] = useState('both');
  const [expandedExps, setExpandedExps] = useState(new Set());
  const [wsConnected, setWsConnected] = useState(false);
  const visibleExpCount = useMemo(() => Math.max(1, Math.min(numStrikes, 10)), [numStrikes]);
  const visibleChains = useMemo(() => chains.slice(0, visibleExpCount), [chains, visibleExpCount]);

  // Fetch options chain for a ticker
  const fetchChain = useCallback(async (symbol) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stock price (Twelve Data route, same feed family as stream)
      const quoteRes = await fetch(`/api/lse/quotes?symbols=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
      if (quoteRes.ok) {
        const quotePayload = await quoteRes.json();
        const quoteRow = Array.isArray(quotePayload?.data)
          ? quotePayload.data.find((item) => {
              const requested = String(item?.requestedSymbol || '').toUpperCase();
              const stream = String(item?.symbol || '').toUpperCase();
              return requested === symbol || stream.startsWith(symbol);
            }) || quotePayload.data[0]
          : null;

        const nextPrice = Number(quoteRow?.price);
        if (Number.isFinite(nextPrice)) {
          setStockPrice(nextPrice);
        }

        const nextChange = Number(quoteRow?.change);
        if (Number.isFinite(nextChange)) {
          setStockChange(nextChange);
        }

        const nextPercent = Number(quoteRow?.percentChange);
        if (Number.isFinite(nextPercent)) {
          setStockChangePct(nextPercent);
        } else if (Number.isFinite(nextPrice) && Number.isFinite(nextChange) && nextPrice !== nextChange) {
          const prevClose = nextPrice - nextChange;
          if (prevClose !== 0) {
            setStockChangePct((nextChange / prevClose) * 100);
          }
        }
      }

      // Fetch options contracts + snapshots
      const res = await fetch(`/api/options/chain?symbol=${symbol}&strikes=${numStrikes}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const expirations = data.expirations || [];
      setChains(expirations);

      // Keep expiry date count in sync with strike-count selector:
      // selecting 4 opens the nearest 4 expiration days.
      const autoExpanded = new Set(
        expirations
          .slice(0, Math.min(Math.max(1, numStrikes), 10))
          .map((exp) => exp.expiration)
      );
      setExpandedExps(autoExpanded);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [numStrikes]);

  useEffect(() => {
    fetchChain(activeTicker);
  }, [activeTicker, numStrikes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Twelve Data WS for live underlying updates + connection state
  useEffect(() => {
    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      setWsConnected(Boolean(status?.connected));
    });

    const unsubscribeQuote = subscribeTwelveDataQuotes([activeTicker], (update) => {
      const nextPrice = Number(update?.price);
      if (Number.isFinite(nextPrice) && nextPrice > 0) {
        setStockPrice(nextPrice);
      }

      const nextChange = Number(update?.change);
      if (Number.isFinite(nextChange)) {
        setStockChange(nextChange);
      }

      const nextPercent = Number(update?.percentChange);
      if (Number.isFinite(nextPercent)) {
        setStockChangePct(nextPercent);
      } else if (Number.isFinite(nextChange) && Number.isFinite(nextPrice) && nextPrice !== nextChange) {
        const prevClose = nextPrice - nextChange;
        if (prevClose !== 0) {
          setStockChangePct((nextChange / prevClose) * 100);
        }
      }
    });

    return () => {
      unsubscribeQuote?.();
      unsubscribeStatus?.();
    };
  }, [activeTicker]);

  const toggleExp = (exp) => {
    setExpandedExps((prev) => {
      const next = new Set(prev);
      next.has(exp) ? next.delete(exp) : next.add(exp);
      return next;
    });
  };

  const handleTickerClick = (symbol) => {
    setActiveTicker(symbol);
  };

  // ── Render ──
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#000' }}>
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-[#1f1f1f]" style={{ background: HEADER_BG }}>
        {/* Strategy type */}
        <span className="text-[14px] text-white/70 px-2.5 py-1 rounded border border-[#333] cursor-default">Single</span>

        {/* Strikes selector */}
        <select
          value={numStrikes}
          onChange={(e) => setNumStrikes(Number(e.target.value))}
          className="text-[14px] text-white bg-transparent border border-[#333] rounded px-2.5 py-1 cursor-pointer outline-none"
        >
          {[4, 6, 8, 10, 14, 20, 30, 50].map((n) => (
            <option key={n} value={n} className="bg-[#111]">{n}</option>
          ))}
        </select>

        {/* Both/Calls/Puts */}
        <select
          value={chainView}
          onChange={(e) => setChainView(e.target.value)}
          className="text-[14px] text-white bg-transparent border border-[#333] rounded px-2.5 py-1 cursor-pointer outline-none"
        >
          <option value="both" className="bg-[#111]">Both</option>
          <option value="calls" className="bg-[#111]">Calls</option>
          <option value="puts" className="bg-[#111]">Puts</option>
        </select>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className={`text-[12px] uppercase tracking-wider ${wsConnected ? 'text-emerald-400' : 'text-red-400/60'}`}>
            {wsConnected ? 'LIVE' : 'OFF'}
          </span>
        </div>

        {/* Stock info */}
        {stockPrice && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-lg text-white font-semibold">{activeTicker}</span>
            <span className="text-lg text-white font-mono">{fmt(stockPrice)}</span>
            {stockChange != null && (
              <span className="text-base font-mono font-semibold" style={{ color: stockChange >= 0 ? GREEN : RED }}>
                {stockChange >= 0 ? '+' : ''}{fmt(stockChange)} ({fmtPct(stockChangePct ? stockChangePct : (stockChange / (stockPrice - stockChange)) * 100)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Quick Ticker Tabs ── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2.5 border-b border-[#1f1f1f] overflow-x-auto scrollbar-hide">
        {QUICK_TICKERS.map((sym) => (
          <button
            key={sym}
            onClick={() => handleTickerClick(sym)}
            className={`flex-shrink-0 px-3 py-1.5 text-base font-semibold rounded transition-all ${
              activeTicker === sym
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* ── Column Headers ── */}
      <div className="flex-shrink-0 flex items-center text-[13px] text-white/45 uppercase tracking-wider font-semibold" style={{ background: HEADER_BG }}>
        {/* Calls header */}
        {chainView !== 'puts' && (
          <div className="flex-1 flex items-center">
            <div className="px-2 py-2 text-right" style={{ width: SIDE_COL_WIDTH }}>Impl Vol</div>
            <div className="px-2 py-2 text-right" style={{ width: SIDE_COL_WIDTH }}>Mid</div>
            <div className="px-2 py-2 text-right" style={{ width: SIDE_COL_WIDTH }}>% Chg</div>
            <div className="px-2 py-2 text-right" style={{ width: SIDE_COL_WIDTH }}>Last</div>
            <div className="px-2 py-2 text-right" style={{ width: SIDE_COL_WIDTH, color: CALL_COLOR + '80' }}>Ask</div>
            <div className="px-2 py-2 text-right" style={{ width: SIDE_COL_WIDTH, color: CALL_COLOR + '80' }}>Bid</div>
          </div>
        )}

        {chainView === 'both' && (
          <div className="w-16 text-center px-1 py-2 font-semibold text-white/65">Strike</div>
        )}

        {/* Puts header */}
        {chainView !== 'calls' && (
          <div className="flex-1 flex items-center">
            <div className="px-2 py-2 text-left" style={{ width: SIDE_COL_WIDTH, color: PUT_COLOR + '80' }}>Bid</div>
            <div className="px-2 py-2 text-left" style={{ width: SIDE_COL_WIDTH, color: PUT_COLOR + '80' }}>Ask</div>
            <div className="px-2 py-2 text-left" style={{ width: SIDE_COL_WIDTH }}>Last</div>
            <div className="px-2 py-2 text-left" style={{ width: SIDE_COL_WIDTH }}>% Chg</div>
            <div className="px-2 py-2 text-left" style={{ width: SIDE_COL_WIDTH }}>Mid</div>
            <div className="px-2 py-2 text-left" style={{ width: SIDE_COL_WIDTH }}>Impl Vol</div>
          </div>
        )}
      </div>

      {/* ── Chain Body ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <span className="text-white/30 text-sm">Loading {activeTicker} options...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            <button onClick={() => fetchChain(activeTicker)} className="text-xs text-white/40 hover:text-white/60">Retry</button>
          </div>
        ) : chains.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">No options data available</div>
        ) : (
          visibleChains.map((expGroup) => {
            const isExpanded = expandedExps.has(expGroup.expiration);
            const daysToExp = dte(expGroup.expiration);
            const dateLabel = fmtDate(expGroup.expiration);
            const isWeekly = expGroup.isWeekly;
            const strikeCount = expGroup.strikes?.length || 0;

            return (
              <div key={expGroup.expiration}>
                {/* Expiration header */}
                <button
                  onClick={() => toggleExp(expGroup.expiration)}
                  className="w-full flex items-center border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors"
                  style={{ background: '#080810' }}
                >
                  {/* Calls side */}
                  {chainView !== 'puts' && (
                    <div className="flex-1 flex items-center px-3 py-2">
                      {isExpanded
                        ? <ChevronDown size={14} className="text-white/40 mr-2 flex-shrink-0" />
                        : <ChevronRight size={14} className="text-white/40 mr-2 flex-shrink-0" />
                      }
                      <span className="text-white text-sm font-medium">
                        {dateLabel} {isWeekly ? <span className="text-white/30">(W)</span> : ''} <span className="text-white/30 ml-1">{strikeCount}</span>
                      </span>
                      <span className="text-[12px] text-white/30 ml-auto mr-2">↗ Calls</span>
                    </div>
                  )}

                  {chainView === 'both' && (
                    <div className="w-16 text-center flex-shrink-0">
                      <span className="text-white/50 text-sm font-mono font-semibold">{daysToExp} D</span>
                    </div>
                  )}

                  {/* Puts side */}
                  {chainView !== 'calls' && (
                    <div className="flex-1 flex items-center px-3 py-2">
                      {chainView === 'puts' && (
                        <>
                          {isExpanded
                            ? <ChevronDown size={14} className="text-white/40 mr-2 flex-shrink-0" />
                            : <ChevronRight size={14} className="text-white/40 mr-2 flex-shrink-0" />
                          }
                          <span className="text-white text-sm font-medium">
                            {dateLabel} {isWeekly ? <span className="text-white/30">(W)</span> : ''} <span className="text-white/30 ml-1">{strikeCount}</span>
                          </span>
                        </>
                      )}
                      <span className={`text-[12px] text-white/30 ${chainView === 'puts' ? 'ml-auto' : 'ml-2'}`}>Puts ↘</span>
                    </div>
                  )}
                </button>

                {/* Strike rows */}
                {isExpanded && expGroup.strikes?.map((row, idx) => {
                  const call = row.call || {};
                  const put = row.put || {};
                  const strike = row.strike;
                  const isCallITM = stockPrice && strike < stockPrice;
                  const isPutITM = stockPrice && strike > stockPrice;
                  const isATM = stockPrice && Math.abs(strike - stockPrice) < (expGroup.strikeGap || 2.5) / 2;
                  const rowBg = (isCallITM || isPutITM) ? ITM_BG : OTM_BG;

                  // ITM separator (render once at the ATM boundary)
                  const prevStrike = idx > 0 ? expGroup.strikes[idx - 1].strike : null;
                  const showSeparator = stockPrice && prevStrike && prevStrike < stockPrice && strike >= stockPrice;

                  return (
                    <React.Fragment key={`${expGroup.expiration}-${strike}`}>
                      {showSeparator && (
                        <div className="flex items-center px-4 py-1" style={{ background: SEPARATOR_BG }}>
                          <span className="text-[13px] text-white/30">△ ITM</span>
                          <div className="flex-1 text-center">
                            <span className="text-[15px] font-mono font-semibold" style={{ color: CALL_COLOR }}>
                              {activeTicker}: {fmt(stockPrice)} {stockChange != null && (
                                <span style={{ color: stockChange >= 0 ? GREEN : RED }}>
                                  {stockChange >= 0 ? '+' : ''}{fmt(stockChange)} {fmtPct(stockChangePct || 0)}
                                </span>
                              )}
                            </span>
                          </div>
                          <span className="text-[13px] text-white/30">ITM ▽</span>
                        </div>
                      )}

                      <div
                        className="flex items-center text-[15px] font-mono border-b border-[#0f0f0f] hover:bg-white/[0.03] transition-colors"
                        style={{ background: rowBg }}
                      >
                        {/* ── Calls side ── */}
                        {chainView !== 'puts' && (
                          <div className="flex-1 flex items-center">
                            <div className="px-2.5 py-2.5 text-right text-white/65" style={{ width: SIDE_COL_WIDTH }}>{call.iv ? fmtIV(call.iv) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-right text-white/80" style={{ width: SIDE_COL_WIDTH }}>{call.mid ? fmt(call.mid) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-right font-semibold" style={{ width: SIDE_COL_WIDTH, color: call.pctChange > 0 ? GREEN : call.pctChange < 0 ? RED : '#888' }}>
                              {call.pctChange != null ? fmtPct(call.pctChange) : '—'}
                            </div>
                            <div className="px-2.5 py-2.5 text-right text-white/80" style={{ width: SIDE_COL_WIDTH }}>{call.last ? fmt(call.last) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-right font-semibold" style={{ width: SIDE_COL_WIDTH, color: CALL_COLOR }}>{call.ask ? fmt(call.ask) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-right font-semibold" style={{ width: SIDE_COL_WIDTH, color: CALL_COLOR }}>{call.bid ? fmt(call.bid) : '—'}</div>
                          </div>
                        )}

                        {/* ── Strike ── */}
                        {chainView === 'both' && (
                          <div className={`w-16 text-center px-1 py-2.5 text-[16px] font-bold ${isATM ? 'text-amber-300' : 'text-white'}`}>
                            {fmtStrike(strike)}
                          </div>
                        )}

                        {/* ── Puts side ── */}
                        {chainView !== 'calls' && (
                          <div className="flex-1 flex items-center">
                            <div className="px-2.5 py-2.5 text-left font-semibold" style={{ width: SIDE_COL_WIDTH, color: PUT_COLOR }}>{put.bid ? fmt(put.bid) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-left font-semibold" style={{ width: SIDE_COL_WIDTH, color: PUT_COLOR }}>{put.ask ? fmt(put.ask) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-left text-white/80" style={{ width: SIDE_COL_WIDTH }}>{put.last ? fmt(put.last) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-left font-semibold" style={{ width: SIDE_COL_WIDTH, color: put.pctChange > 0 ? GREEN : put.pctChange < 0 ? RED : '#888' }}>
                              {put.pctChange != null ? fmtPct(put.pctChange) : '—'}
                            </div>
                            <div className="px-2.5 py-2.5 text-left text-white/80" style={{ width: SIDE_COL_WIDTH }}>{put.mid ? fmt(put.mid) : '—'}</div>
                            <div className="px-2.5 py-2.5 text-left text-white/65" style={{ width: SIDE_COL_WIDTH }}>{put.iv ? fmtIV(put.iv) : '—'}</div>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OptionsPage;
