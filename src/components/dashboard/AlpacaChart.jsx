import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

// ── Timeframe options ──────────────────────────────────────────────
const TIMEFRAMES = [
  { label: '1D', value: '1Day' },
  { label: '1W', value: '1Week' },
  { label: '1M', value: '1Month' },
  { label: '3M', value: '3Month' },
  { label: '1Y', value: '1Year' },
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

// ── Alpaca bar mapper ──────────────────────────────────────────────
function mapBars(bars) {
  if (!bars || !bars.length) return [];
  return bars.map((b) => ({
    time: b.Timestamp
      ? b.Timestamp.slice(0, 10)
      : b.t ? b.t.slice(0, 10) : '',
    open:  Number(b.OpenPrice  ?? b.o),
    high:  Number(b.HighPrice  ?? b.h),
    low:   Number(b.LowPrice   ?? b.l),
    close: Number(b.ClosePrice ?? b.c),
  }));
}

// ── Chevron icon ───────────────────────────────────────────────────
function ChevronIcon({ open }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{
        transition: 'transform 0.2s ease',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Shared styles ──────────────────────────────────────────────────
const labelStyle = {
  display: 'block',
  color: '#444444',
  fontSize: '10px',
  fontWeight: 600,
  fontFamily: "'SF Mono', monospace",
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '4px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: '6px',
  color: '#ffffff',
  outline: 'none',
  transition: 'border-color 0.15s ease',
  boxSizing: 'border-box',
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
    if (!quantity || Number(quantity) <= 0) {
      setError('Enter a valid quantity');
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        symbol: symbol.toUpperCase(),
        qty: Number(quantity),
        side,
        type: orderType,
        time_in_force: tif,
      };

      if (orderType === 'limit' || orderType === 'stop_limit') {
        if (!limitPrice) { setError('Limit price required'); setSubmitting(false); return; }
        payload.limit_price = Number(limitPrice);
      }
      if (orderType === 'stop' || orderType === 'stop_limit') {
        if (!stopPrice) { setError('Stop price required'); setSubmitting(false); return; }
        payload.stop_price = Number(stopPrice);
      }

      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Order failed (${res.status})`);

      setResult({
        id: data.id,
        status: data.status,
        filled: data.filled_qty || 0,
        side: data.side,
        symbol: data.symbol,
      });
      setQuantity('');
      setLimitPrice('');
      setStopPrice('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [symbol, side, orderType, quantity, limitPrice, stopPrice, tif]);

  const isBuy = side === 'buy';

  return (
    <div style={{ borderTop: '1px solid #111111' }}>
      {/* Toggle header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}
      >
        <span style={{ color: '#888', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' }}>
          TRADE ${symbol}
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {/* Collapsible content */}
      <div style={{
        maxHeight: isOpen ? '600px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }}>
        <div style={{ padding: '0 16px 16px' }}>

          {/* Buy / Sell toggle */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            marginBottom: '12px',
            background: '#0a0a0a',
            borderRadius: '6px',
            padding: '3px',
          }}>
            {['buy', 'sell'].map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                style={{
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: "'SF Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: side === s
                    ? (s === 'buy' ? '#00DC82' : '#FF3B5C')
                    : 'transparent',
                  color: side === s ? '#000000' : '#555555',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Order Type</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '3px',
              background: '#0a0a0a',
              borderRadius: '4px',
              padding: '2px',
            }}>
              {ORDER_TYPES.map((ot) => (
                <button
                  key={ot.value}
                  onClick={() => setOrderType(ot.value)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    fontFamily: "'SF Mono', monospace",
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    background: orderType === ot.value ? '#1a1a2e' : 'transparent',
                    color: orderType === ot.value ? '#ffffff' : '#444444',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {ot.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Shares</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              min="1"
              style={inputStyle}
            />
          </div>

          {/* Limit price */}
          {(orderType === 'limit' || orderType === 'stop_limit') && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Limit Price</label>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={lastPrice?.toFixed(2) || '0.00'}
                step="0.01"
                style={inputStyle}
              />
            </div>
          )}

          {/* Stop price */}
          {(orderType === 'stop' || orderType === 'stop_limit') && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Stop Price</label>
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                style={inputStyle}
              />
            </div>
          )}

          {/* Time in force */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Time in Force</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '3px',
              background: '#0a0a0a',
              borderRadius: '4px',
              padding: '2px',
            }}>
              {TIF_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTif(t.value)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    fontFamily: "'SF Mono', monospace",
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    background: tif === t.value ? '#1a1a2e' : 'transparent',
                    color: tif === t.value ? '#ffffff' : '#444444',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated cost */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 12px',
            background: '#0a0a0a',
            borderRadius: '6px',
            marginBottom: '12px',
          }}>
            <span style={{ color: '#444', fontSize: '11px', fontFamily: "'SF Mono', monospace" }}>
              Est. {isBuy ? 'Cost' : 'Credit'}
            </span>
            <span style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: "'SF Mono', monospace",
            }}>
              ${estimatedCost}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !quantity}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: "'SF Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '1px',
              border: 'none',
              borderRadius: '6px',
              cursor: submitting || !quantity ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              background: submitting ? '#222222' : isBuy ? '#00DC82' : '#FF3B5C',
              color: submitting ? '#555' : '#000000',
              opacity: !quantity ? 0.5 : 1,
            }}
          >
            {submitting
              ? 'Submitting...'
              : `${side.toUpperCase()} ${quantity || '0'} ${symbol}`
            }
          </button>

          {/* Feedback */}
          {result && (
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              background: '#001a0d',
              border: '1px solid #003d1a',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: "'SF Mono', monospace",
              color: '#00DC82',
            }}>
              ✓ Order {result.status} — {result.side.toUpperCase()} {result.symbol} (ID: {result.id?.slice(0, 8)}...)
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              background: '#1a0000',
              border: '1px solid #330000',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: "'SF Mono', monospace",
              color: '#FF3B5C',
            }}>
              ✗ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function AlpacaChart({ symbol = 'AAPL', height = 500 }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const tooltipRef   = useRef(null);

  const [activeTimeframe, setActiveTimeframe] = useState('1Month');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastBar, setLastBar]       = useState(null);
  const [tradeOpen, setTradeOpen]   = useState(false);

  // ── Create chart ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: 'solid', color: '#000000' },
        textColor: '#555555',
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines:   { visible: false },
        horzLines:   { visible: false },
      },
      crosshair: {
        mode: 0,
        vertLine:  { color: '#2962FF33', width: 1, style: 2, labelBackgroundColor: '#2962FF' },
        horzLine:  { color: '#2962FF33', width: 1, style: 2, labelBackgroundColor: '#2962FF' },
      },
      rightPriceScale: {
        borderColor: '#111111',
        textColor: '#444444',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#111111',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         '#00DC82',
      downColor:       '#FF3B5C',
      borderUpColor:   '#00DC82',
      borderDownColor: '#FF3B5C',
      wickUpColor:     '#00DC82',
      wickDownColor:   '#FF3B5C',
    });

    chartRef.current  = chart;
    seriesRef.current = candleSeries;

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        return;
      }
      const data = param.seriesData.get(candleSeries);
      if (!data) return;
      setLastBar(data);
      if (tooltipRef.current) tooltipRef.current.style.display = 'flex';
    });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [height]);

  // ── Fetch bars ─────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return;
    let cancelled = false;

    async function fetchBars() {
      setLoading(true);
      setError(null);
      try {
        const end = new Date();
        const start = new Date();
        switch (activeTimeframe) {
          case '1Day':   start.setDate(end.getDate() - 1);   break;
          case '1Week':  start.setDate(end.getDate() - 7);   break;
          case '1Month': start.setMonth(end.getMonth() - 1);  break;
          case '3Month': start.setMonth(end.getMonth() - 3);  break;
          case '1Year':  start.setFullYear(end.getFullYear() - 1); break;
        }

        const timeframe = activeTimeframe === '1Day' ? '15Min' : '1Day';
        const params = new URLSearchParams({
          symbol, timeframe,
          start: start.toISOString(),
          end:   end.toISOString(),
          limit: '1000',
        });

        const res = await fetch(`/api/bars?${params}`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();

        const bars = mapBars(json.bars || json);
        if (!cancelled && bars.length) {
          seriesRef.current.setData(bars);
          chartRef.current.timeScale().fitContent();
          setLastBar(bars[bars.length - 1]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBars();
    return () => { cancelled = true; };
  }, [symbol, activeTimeframe]);

  const priceChange = lastBar ? (lastBar.close - lastBar.open).toFixed(2) : '0.00';
  const pricePct    = lastBar && lastBar.open
    ? ((lastBar.close - lastBar.open) / lastBar.open * 100).toFixed(2) : '0.00';
  const isPositive  = Number(priceChange) >= 0;

  return (
    <div style={{
      position: 'relative',
      background: '#000000',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #111111',
      fontFamily: "'SF Mono', 'Fira Code', monospace",
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #111111',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>
            ${symbol}
          </span>
          {lastBar && (
            <>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                {lastBar.close?.toFixed(2)}
              </span>
              <span style={{
                color: isPositive ? '#00DC82' : '#FF3B5C',
                fontSize: '12px', fontWeight: 500,
              }}>
                {isPositive ? '+' : ''}{priceChange} ({isPositive ? '+' : ''}{pricePct}%)
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setActiveTimeframe(tf.value)}
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                fontFamily: "'SF Mono', monospace",
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activeTimeframe === tf.value ? '#2962FF' : 'transparent',
                color: activeTimeframe === tf.value ? '#fff' : '#555',
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* OHLC */}
      <div ref={tooltipRef} style={{
        display: lastBar ? 'flex' : 'none',
        gap: '16px', padding: '6px 16px', fontSize: '11px', color: '#444',
        borderBottom: '1px solid #0a0a0a',
      }}>
        {lastBar && (
          <>
            <span>O <span style={{ color: '#666' }}>{lastBar.open?.toFixed(2)}</span></span>
            <span>H <span style={{ color: '#666' }}>{lastBar.high?.toFixed(2)}</span></span>
            <span>L <span style={{ color: '#666' }}>{lastBar.low?.toFixed(2)}</span></span>
            <span>C <span style={{ color: isPositive ? '#00DC82' : '#FF3B5C' }}>{lastBar.close?.toFixed(2)}</span></span>
          </>
        )}
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ width: '100%' }} />

      {/* Trade Panel */}
      <TradePanel
        symbol={symbol}
        lastPrice={lastBar?.close}
        isOpen={tradeOpen}
        onToggle={() => setTradeOpen(!tradeOpen)}
      />

      {/* Loading */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)', zIndex: 10,
        }}>
          <div style={{
            width: '20px', height: '20px',
            border: '2px solid #222', borderTop: '2px solid #2962FF',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          position: 'absolute', bottom: '12px', left: '16px',
          padding: '6px 12px', background: '#1a0000',
          border: '1px solid #330000', borderRadius: '4px',
          color: '#FF3B5C', fontSize: '11px', zIndex: 10,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
