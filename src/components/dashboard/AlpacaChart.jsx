import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

// ── Timeframe config with correct Alpaca params ────────────────────
const TIMEFRAMES = [
  { label: '1D',  value: '1D',  alpacaTF: '5Min',  daysBack: 4,   barSpacing: 6  },
  { label: '1W',  value: '1W',  alpacaTF: '15Min', daysBack: 9,   barSpacing: 3  },
  { label: '1M',  value: '1M',  alpacaTF: '1Day',  daysBack: 35,  barSpacing: 10 },
  { label: '3M',  value: '3M',  alpacaTF: '1Day',  daysBack: 100, barSpacing: 6  },
  { label: '1Y',  value: '1Y',  alpacaTF: '1Day',  daysBack: 370, barSpacing: 3  },
];

const ORDER_TYPES = [
  { label: 'Market', value: 'market' },
  { label: 'Limit', value: 'limit' },
  { label: 'Stop', value: 'stop' },
  { label: 'Stop Limit', value: 'stop_limit' },
];

const TIF_OPTIONS = [
  { label: 'Day', value: 'day' },
  { label: 'GTC', value: 'gtc' },
  { label: 'IOC', value: 'ioc' },
  { label: 'FOK', value: 'fok' },
];

// ── Bar mapper — handles both Alpaca SDK and REST formats ──────────
function mapBars(bars, isIntraday) {
  if (!bars || !bars.length) return [];
  return bars
    .map((b) => {
      const ts = b.Timestamp || b.t || '';
      return {
        time: isIntraday
          ? Math.floor(new Date(ts).getTime() / 1000)
          : ts.slice(0, 10),
        open:  Number(b.OpenPrice  ?? b.o),
        high:  Number(b.HighPrice  ?? b.h),
        low:   Number(b.LowPrice   ?? b.l),
        close: Number(b.ClosePrice ?? b.c),
      };
    })
    .filter((b) => b.time && !isNaN(b.open))
    .sort((a, b) => (a.time < b.time ? -1 : 1));
}

// ── Chevron icon ───────────────────────────────────────────────────
function ChevronIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Shared styles ──────────────────────────────────────────────────
const labelStyle = {
  display: 'block', color: '#444444', fontSize: '10px', fontWeight: 600,
  fontFamily: "'SF Mono', monospace", textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px',
};
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 600,
  fontFamily: "'SF Mono', 'Fira Code', monospace", background: '#0a0a0a',
  border: '1px solid #1a1a1a', borderRadius: '6px', color: '#ffffff',
  outline: 'none', boxSizing: 'border-box',
};

// ── Trade Panel ────────────────────────────────────────────────────
function TradePanel({ symbol, lastPrice, isOpen, onToggle }) {
  const [side, setSide]             = useState('buy');
  const [orderType, setOrderType]   = useState('market');
  const [quantity, setQuantity]     = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice]   = useState('');
  const [tif, setTif]               = useState('day');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  const estimatedCost = quantity && lastPrice
    ? (Number(quantity) * (orderType === 'limit' && limitPrice ? Number(limitPrice) : lastPrice)).toFixed(2)
    : '0.00';

  const handleSubmit = useCallback(async () => {
    if (!quantity || Number(quantity) <= 0) { setError('Enter a valid quantity'); return; }
    setSubmitting(true); setError(null); setResult(null);
    try {
      const payload = { symbol: symbol.toUpperCase(), qty: Number(quantity), side, type: orderType, time_in_force: tif };
      if (orderType === 'limit' || orderType === 'stop_limit') {
        if (!limitPrice) { setError('Limit price required'); setSubmitting(false); return; }
        payload.limit_price = Number(limitPrice);
      }
      if (orderType === 'stop' || orderType === 'stop_limit') {
        if (!stopPrice) { setError('Stop price required'); setSubmitting(false); return; }
        payload.stop_price = Number(stopPrice);
      }
      const res = await fetch('/api/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Order failed (${res.status})`);
      setResult({ id: data.id, status: data.status, filled: data.filled_qty || 0, side: data.side, symbol: data.symbol });
      setQuantity(''); setLimitPrice(''); setStopPrice('');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }, [symbol, side, orderType, quantity, limitPrice, stopPrice, tif]);

  const isBuy = side === 'buy';

  return (
    <div style={{ borderTop: '1px solid #111111', flexShrink: 0 }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: "'SF Mono', monospace",
      }}>
        <span style={{ color: '#888', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' }}>TRADE ${symbol}</span>
        <ChevronIcon open={isOpen} />
      </button>
      <div style={{ maxHeight: isOpen ? '500px' : '0px', overflow: isOpen ? 'auto' : 'hidden', transition: 'max-height 0.3s ease' }}>
        <div style={{ padding: '0 16px 16px' }}>
          {/* Buy / Sell */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '12px', background: '#0a0a0a', borderRadius: '6px', padding: '3px' }}>
            {['buy', 'sell'].map((s) => (
              <button key={s} onClick={() => setSide(s)} style={{
                padding: '8px', fontSize: '12px', fontWeight: 700, fontFamily: "'SF Mono', monospace",
                textTransform: 'uppercase', letterSpacing: '1px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: side === s ? (s === 'buy' ? '#00DC82' : '#FF3B5C') : 'transparent',
                color: side === s ? '#000' : '#555',
              }}>{s}</button>
            ))}
          </div>
          {/* Order type */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Order Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', background: '#0a0a0a', borderRadius: '4px', padding: '2px' }}>
              {ORDER_TYPES.map((ot) => (
                <button key={ot.value} onClick={() => setOrderType(ot.value)} style={{
                  padding: '6px 4px', fontSize: '10px', fontWeight: 600, fontFamily: "'SF Mono', monospace",
                  border: 'none', borderRadius: '3px', cursor: 'pointer',
                  background: orderType === ot.value ? '#1a1a2e' : 'transparent',
                  color: orderType === ot.value ? '#fff' : '#444',
                }}>{ot.label}</button>
              ))}
            </div>
          </div>
          {/* Qty */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Shares</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" min="1" style={inputStyle} />
          </div>
          {(orderType === 'limit' || orderType === 'stop_limit') && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Limit Price</label>
              <input type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={lastPrice?.toFixed(2) || '0.00'} step="0.01" style={inputStyle} />
            </div>
          )}
          {(orderType === 'stop' || orderType === 'stop_limit') && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Stop Price</label>
              <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="0.00" step="0.01" style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Time in Force</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', background: '#0a0a0a', borderRadius: '4px', padding: '2px' }}>
              {TIF_OPTIONS.map((t) => (
                <button key={t.value} onClick={() => setTif(t.value)} style={{
                  padding: '6px 4px', fontSize: '10px', fontWeight: 600, fontFamily: "'SF Mono', monospace",
                  border: 'none', borderRadius: '3px', cursor: 'pointer',
                  background: tif === t.value ? '#1a1a2e' : 'transparent',
                  color: tif === t.value ? '#fff' : '#444',
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#0a0a0a', borderRadius: '6px', marginBottom: '12px' }}>
            <span style={{ color: '#444', fontSize: '11px', fontFamily: "'SF Mono', monospace" }}>Est. {isBuy ? 'Cost' : 'Credit'}</span>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>${estimatedCost}</span>
          </div>
          <button onClick={handleSubmit} disabled={submitting || !quantity} style={{
            width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700,
            fontFamily: "'SF Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px',
            border: 'none', borderRadius: '6px', cursor: submitting || !quantity ? 'not-allowed' : 'pointer',
            background: submitting ? '#222' : isBuy ? '#00DC82' : '#FF3B5C',
            color: submitting ? '#555' : '#000', opacity: !quantity ? 0.5 : 1,
          }}>
            {submitting ? 'Submitting...' : `${side.toUpperCase()} ${quantity || '0'} ${symbol}`}
          </button>
          {result && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: '#001a0d', border: '1px solid #003d1a', borderRadius: '6px', fontSize: '11px', fontFamily: "'SF Mono', monospace", color: '#00DC82' }}>
              ✓ Order {result.status} — {result.side.toUpperCase()} {result.symbol}
            </div>
          )}
          {error && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: '#1a0000', border: '1px solid #330000', borderRadius: '6px', fontSize: '11px', fontFamily: "'SF Mono', monospace", color: '#FF3B5C' }}>
              ✗ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function AlpacaChart({ symbol = 'AAPL' }) {
  const wrapperRef    = useRef(null);
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);
  const seriesRef     = useRef(null);
  const tooltipRef    = useRef(null);

  const [activeTF, setActiveTF]       = useState('1M');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastBar, setLastBar]         = useState(null);
  const [tradeOpen, setTradeOpen]     = useState(false);
  const [chartHeight, setChartHeight] = useState(400);

  // ── Dynamic chart height ──────────────────────────────────────
  useEffect(() => {
    function calcHeight() {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const h = Math.max(250, window.innerHeight - rect.top - 160);
      setChartHeight(h);
    }
    calcHeight();
    window.addEventListener('resize', calcHeight);
    return () => window.removeEventListener('resize', calcHeight);
  }, []);

  // ── Create chart ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: chartHeight,
      layout: {
        background: { type: 'solid', color: '#000000' },
        textColor: '#555555',
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 11,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: {
        mode: 0,
        vertLine: { color: '#2962FF33', width: 1, style: 2, labelBackgroundColor: '#2962FF' },
        horzLine: { color: '#2962FF33', width: 1, style: 2, labelBackgroundColor: '#2962FF' },
      },
      rightPriceScale: { borderColor: '#111111', textColor: '#444444', scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: '#111111', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00DC82', downColor: '#FF3B5C',
      borderUpColor: '#00DC82', borderDownColor: '#FF3B5C',
      wickUpColor: '#00DC82', wickDownColor: '#FF3B5C',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    chart.subscribeCrosshairMove((param) => {
      if (!param?.time || !param?.seriesData) {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        return;
      }
      const data = param.seriesData.get(series);
      if (data) { setLastBar(data); if (tooltipRef.current) tooltipRef.current.style.display = 'flex'; }
    });

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [chartHeight]);

  useEffect(() => {
    if (chartRef.current) chartRef.current.applyOptions({ height: chartHeight });
  }, [chartHeight]);

  // ── Fetch bars ────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return;
    let cancelled = false;
    const tfConfig = TIMEFRAMES.find((t) => t.value === activeTF) || TIMEFRAMES[2];

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - tfConfig.daysBack);

        const isIntraday = tfConfig.alpacaTF.includes('Min');
        const params = new URLSearchParams({
          symbol, timeframe: tfConfig.alpacaTF,
          start: start.toISOString(), end: end.toISOString(), limit: '1000',
        });

        const res = await fetch(`/api/bars?${params}`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        const bars = mapBars(json.bars || json, isIntraday);

        if (!cancelled && bars.length) {
          seriesRef.current.setData(bars);
          chartRef.current.timeScale().applyOptions({ barSpacing: tfConfig.barSpacing });
          chartRef.current.timeScale().fitContent();
          setLastBar(bars[bars.length - 1]);
        } else if (!cancelled) {
          setError('No data for this timeframe');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [symbol, activeTF]);

  const priceChange = lastBar ? (lastBar.close - lastBar.open).toFixed(2) : '0.00';
  const pricePct = lastBar?.open ? ((lastBar.close - lastBar.open) / lastBar.open * 100).toFixed(2) : '0.00';
  const isUp = Number(priceChange) >= 0;

  return (
    <div ref={wrapperRef} style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      maxHeight: 'calc(100vh - 80px)', background: '#000000',
      borderRadius: '8px', overflow: 'hidden', border: '1px solid #111111',
      fontFamily: "'SF Mono', 'Fira Code', monospace", position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #111111', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>${symbol}</span>
          {lastBar && (
            <>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{lastBar.close?.toFixed(2)}</span>
              <span style={{ color: isUp ? '#00DC82' : '#FF3B5C', fontSize: '12px', fontWeight: 500 }}>
                {isUp ? '+' : ''}{priceChange} ({isUp ? '+' : ''}{pricePct}%)
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {TIMEFRAMES.map((tf) => (
            <button key={tf.value} onClick={() => setActiveTF(tf.value)} style={{
              padding: '4px 10px', fontSize: '11px', fontWeight: 600,
              fontFamily: "'SF Mono', monospace", border: 'none', borderRadius: '4px', cursor: 'pointer',
              background: activeTF === tf.value ? '#2962FF' : 'transparent',
              color: activeTF === tf.value ? '#fff' : '#555',
            }}>{tf.label}</button>
          ))}
        </div>
      </div>

      {/* OHLC */}
      <div ref={tooltipRef} style={{ display: lastBar ? 'flex' : 'none', gap: '16px', padding: '6px 16px', fontSize: '11px', color: '#444', borderBottom: '1px solid #0a0a0a', flexShrink: 0 }}>
        {lastBar && (
          <>
            <span>O <span style={{ color: '#666' }}>{lastBar.open?.toFixed(2)}</span></span>
            <span>H <span style={{ color: '#666' }}>{lastBar.high?.toFixed(2)}</span></span>
            <span>L <span style={{ color: '#666' }}>{lastBar.low?.toFixed(2)}</span></span>
            <span>C <span style={{ color: isUp ? '#00DC82' : '#FF3B5C' }}>{lastBar.close?.toFixed(2)}</span></span>
          </>
        )}
      </div>

      {/* Chart fills remaining space */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />

      {/* Trade panel pinned bottom */}
      <TradePanel symbol={symbol} lastPrice={lastBar?.close} isOpen={tradeOpen} onToggle={() => setTradeOpen(!tradeOpen)} />

      {/* Loading */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 10 }}>
          <div style={{ width: '20px', height: '20px', border: '2px solid #222', borderTop: '2px solid #2962FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ position: 'absolute', bottom: '50px', left: '16px', padding: '6px 12px', background: '#1a0000', border: '1px solid #330000', borderRadius: '4px', color: '#FF3B5C', fontSize: '11px', zIndex: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
