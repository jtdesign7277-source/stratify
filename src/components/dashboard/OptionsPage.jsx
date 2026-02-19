import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Settings, Zap } from 'lucide-react';
import { API_URL } from '../../config';

const API_BASE = API_URL || 'https://stratify-backend-production-3ebd.up.railway.app';
const WS_URL = (API_BASE).replace(/^https/, 'wss').replace(/^http/, 'ws');

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

const OptionsPage = () => {
  const [activeTicker, setActiveTicker] = useState('AAPL');
  const [stockPrice, setStockPrice] = useState(null);
  const [stockChange, setStockChange] = useState(null);
  const [stockChangePct, setStockChangePct] = useState(null);
  const [chains, setChains] = useState([]); // grouped by expiration
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numStrikes, setNumStrikes] = useState(6);
  const [showBoth, setShowBoth] = useState(true);
  const [expandedExps, setExpandedExps] = useState(new Set());
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // Fetch options chain for a ticker
  const fetchChain = useCallback(async (symbol) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stock price
      const quoteRes = await fetch(`${API_BASE}/api/public/quote/${symbol}`);
      if (quoteRes.ok) {
        const q = await quoteRes.json();
        setStockPrice(q.latestTrade?.p || q.price || q.close || null);
        setStockChange(q.change ?? q.dailyBar?.c - q.prevDailyBar?.c ?? null);
        setStockChangePct(q.changePercent ?? null);
      }

      // Fetch options contracts + snapshots
      const res = await fetch(`/api/options/chain?symbol=${symbol}&strikes=${numStrikes}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setChains(data.expirations || []);

      // Start all collapsed — user clicks to expand
      setExpandedExps(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [numStrikes]);

  useEffect(() => {
    fetchChain(activeTicker);
  }, [activeTicker, numStrikes]); // eslint-disable-line react-hooks/exhaustive-deps

  // WS for live updates
  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => setWsConnected(false);
    socket.onerror = () => socket.close();
    return () => socket.close();
  }, []);

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
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[#1f1f1f]" style={{ background: HEADER_BG }}>
        {/* Strategy type */}
        <span className="text-[11px] text-white/60 px-2 py-1 rounded border border-[#333] cursor-default">Single</span>

        {/* Strikes selector */}
        <select
          value={numStrikes}
          onChange={(e) => setNumStrikes(Number(e.target.value))}
          className="text-[11px] text-white bg-transparent border border-[#333] rounded px-2 py-1 cursor-pointer outline-none"
        >
          {[4, 6, 8, 10, 14, 20, 30, 50].map((n) => (
            <option key={n} value={n} className="bg-[#111]">{n}</option>
          ))}
        </select>

        {/* Both/Calls/Puts */}
        <select
          value={showBoth ? 'both' : 'calls'}
          onChange={(e) => setShowBoth(e.target.value === 'both')}
          className="text-[11px] text-white bg-transparent border border-[#333] rounded px-2 py-1 cursor-pointer outline-none"
        >
          <option value="both" className="bg-[#111]">Both</option>
          <option value="calls" className="bg-[#111]">Calls</option>
          <option value="puts" className="bg-[#111]">Puts</option>
        </select>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className={`text-[10px] uppercase tracking-wider ${wsConnected ? 'text-emerald-400' : 'text-red-400/60'}`}>
            {wsConnected ? 'LIVE' : 'OFF'}
          </span>
        </div>

        {/* Stock info */}
        {stockPrice && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-white font-semibold">{activeTicker}</span>
            <span className="text-sm text-white font-mono">{fmt(stockPrice)}</span>
            {stockChange != null && (
              <span className="text-xs font-mono" style={{ color: stockChange >= 0 ? GREEN : RED }}>
                {stockChange >= 0 ? '+' : ''}{fmt(stockChange)} ({fmtPct(stockChangePct ? stockChangePct : (stockChange / (stockPrice - stockChange)) * 100)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Quick Ticker Tabs ── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-[#1f1f1f] overflow-x-auto scrollbar-hide">
        {QUICK_TICKERS.map((sym) => (
          <button
            key={sym}
            onClick={() => handleTickerClick(sym)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
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
      <div className="flex-shrink-0 flex items-center text-[10px] text-white/35 uppercase tracking-wider font-medium" style={{ background: HEADER_BG }}>
        {/* Calls header */}
        <div className="flex-1 flex items-center">
          <div className="w-[13%] px-2 py-1.5 text-right">Impl Vol</div>
          <div className="w-[13%] px-2 py-1.5 text-right">Mid</div>
          <div className="w-[14%] px-2 py-1.5 text-right">% Chg</div>
          <div className="w-[13%] px-2 py-1.5 text-right">Last</div>
          <div className="w-[13%] px-2 py-1.5 text-right" style={{ color: CALL_COLOR + '80' }}>Ask</div>
          <div className="w-[13%] px-2 py-1.5 text-right" style={{ color: CALL_COLOR + '80' }}>Bid</div>
        </div>

        {/* Strike center */}
        <div className="w-24 text-center flex-shrink-0 px-2 py-1.5 font-semibold text-white/50">Strike</div>

        {/* Puts header */}
        <div className="flex-1 flex items-center">
          <div className="w-[13%] px-2 py-1.5 text-left" style={{ color: PUT_COLOR + '80' }}>Bid</div>
          <div className="w-[13%] px-2 py-1.5 text-left" style={{ color: PUT_COLOR + '80' }}>Ask</div>
          <div className="w-[13%] px-2 py-1.5 text-left">Last</div>
          <div className="w-[14%] px-2 py-1.5 text-left">% Chg</div>
          <div className="w-[13%] px-2 py-1.5 text-left">Mid</div>
          <div className="w-[13%] px-2 py-1.5 text-left">Impl Vol</div>
        </div>
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
          chains.map((expGroup) => {
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
                  <div className="flex-1 flex items-center px-3 py-2">
                    {isExpanded
                      ? <ChevronDown size={14} className="text-white/40 mr-2 flex-shrink-0" />
                      : <ChevronRight size={14} className="text-white/40 mr-2 flex-shrink-0" />
                    }
                    <span className="text-white text-xs font-medium">
                      {dateLabel} {isWeekly ? <span className="text-white/30">(W)</span> : ''} <span className="text-white/30 ml-1">{strikeCount}</span>
                    </span>
                    <span className="text-[10px] text-white/30 ml-auto mr-2">↗ Calls</span>
                  </div>

                  {/* DTE centered in strike column */}
                  <div className="w-24 text-center flex-shrink-0 flex-shrink-0">
                    <span className="text-white/50 text-xs font-mono font-semibold">{daysToExp} D</span>
                  </div>

                  {/* Puts side */}
                  <div className="flex-1 flex items-center px-3 py-2">
                    <span className="text-[10px] text-white/30 ml-2">Puts ↘</span>
                  </div>
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
                          <span className="text-[10px] text-white/25">△ ITM</span>
                          <div className="flex-1 text-center">
                            <span className="text-[11px] font-mono font-medium" style={{ color: CALL_COLOR }}>
                              {activeTicker}: {fmt(stockPrice)} {stockChange != null && (
                                <span style={{ color: stockChange >= 0 ? GREEN : RED }}>
                                  {stockChange >= 0 ? '+' : ''}{fmt(stockChange)} {fmtPct(stockChangePct || 0)}
                                </span>
                              )}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/25">ITM ▽</span>
                        </div>
                      )}

                      <div
                        className="flex items-center text-[11px] font-mono border-b border-[#0f0f0f] hover:bg-white/[0.03] transition-colors"
                        style={{ background: rowBg }}
                      >
                        {/* ── Calls side ── */}
                        <div className="flex-1 flex items-center">
                          <div className="w-[13%] px-2 py-1.5 text-right text-white/60">{call.iv ? fmtIV(call.iv) : '—'}</div>
                          <div className="w-[13%] px-2 py-1.5 text-right text-white/70">{call.mid ? fmt(call.mid) : '—'}</div>
                          <div className="w-[14%] px-2 py-1.5 text-right" style={{ color: call.pctChange > 0 ? GREEN : call.pctChange < 0 ? RED : '#888' }}>
                            {call.pctChange != null ? fmtPct(call.pctChange) : '—'}
                          </div>
                          <div className="w-[13%] px-2 py-1.5 text-right text-white/70">{call.last ? fmt(call.last) : '—'}</div>
                          <div className="w-[13%] px-2 py-1.5 text-right font-medium" style={{ color: CALL_COLOR }}>{call.ask ? fmt(call.ask) : '—'}</div>
                          <div className="w-[13%] px-2 py-1.5 text-right font-medium" style={{ color: CALL_COLOR }}>{call.bid ? fmt(call.bid) : '—'}</div>
                        </div>

                        {/* ── Strike ── */}
                        <div className={`w-24 text-center flex-shrink-0 px-2 py-1.5 font-semibold ${isATM ? 'text-amber-300' : 'text-white'}`}>
                          {fmtStrike(strike)}
                        </div>

                        {/* ── Puts side ── */}
                        <div className="flex-1 flex items-center">
                          <div className="w-[13%] px-2 py-1.5 text-left font-medium" style={{ color: PUT_COLOR }}>{put.bid ? fmt(put.bid) : '—'}</div>
                          <div className="w-[13%] px-2 py-1.5 text-left font-medium" style={{ color: PUT_COLOR }}>{put.ask ? fmt(put.ask) : '—'}</div>
                          <div className="w-[13%] px-2 py-1.5 text-left text-white/70">{put.last ? fmt(put.last) : '—'}</div>
                          <div className="w-[14%] px-2 py-1.5 text-left" style={{ color: put.pctChange > 0 ? GREEN : put.pctChange < 0 ? RED : '#888' }}>
                            {put.pctChange != null ? fmtPct(put.pctChange) : '—'}
                          </div>
                          <div className="w-[13%] px-2 py-1.5 text-left text-white/70">{put.mid ? fmt(put.mid) : '—'}</div>
                          <div className="w-[13%] px-2 py-1.5 text-left text-white/60">{put.iv ? fmtIV(put.iv) : '—'}</div>
                        </div>
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
