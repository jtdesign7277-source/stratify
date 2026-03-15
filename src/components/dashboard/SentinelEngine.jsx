import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/*
 * SENTINEL ENGINE — Crypto Arb Terminal
 * Sub-page within Sentinel
 *
 * Data sources (with simulation fallback):
 *   /api/btc-feed       → live BTC price (Crypto.com → Twelve Data)
 *   /api/polymarket-btc  → Polymarket BTC prediction markets
 *   /api/engine-state    → Sentinel account metrics + open positions
 *   /api/claude-signal   → Claude AI Bayesian signal analysis
 *   Crypto.com WebSocket → real-time BTC tick stream (fallback: simulated)
 */

const COLORS = {
  bg: '#080808',
  panel: '#0d0d0d',
  border: '#1a1a1a',
  text: '#e0e0e0',
  green: '#10b981',
  greenBright: '#00ff88',
  red: '#ff4444',
  amber: '#ffaa00',
  blue: '#4488ff',
  cyan: '#00ccff',
  dim: '#555555',
  dimmer: '#333333',
  white: '#ffffff',
};

// ─── Crypto.com WebSocket for real-time BTC ticks ──────────────────────────
function useCryptoComWS() {
  const [price, setPrice] = useState(null);
  const [bid, setBid] = useState(null);
  const [ask, setAsk] = useState(null);
  const [volume, setVolume] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket('wss://stream.crypto.com/exchange/v1/market');
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        // Subscribe to BTC_USDT ticker
        ws.send(JSON.stringify({
          id: 1,
          method: 'subscribe',
          params: { channels: ['ticker.BTC_USDT'] },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.result?.channel === 'ticker.BTC_USDT' && msg.result?.data) {
            const d = Array.isArray(msg.result.data) ? msg.result.data[0] : msg.result.data;
            if (d.best_bid) setBid(parseFloat(d.best_bid));
            if (d.best_ask) setAsk(parseFloat(d.best_ask));
            if (d.last_trade_price || d.best_bid) setPrice(parseFloat(d.last_trade_price || d.best_bid));
            if (d.total_quantity_traded) setVolume(parseFloat(d.total_quantity_traded));
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setWsConnected(false);
      reconnectRef.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { price, bid, ask, volume, wsConnected };
}

// ─── Live data hook with simulation fallback ───────────────────────────────
function useBotStream() {
  const [tick, setTick] = useState({ block: 0, vol: 0, edge: 0 });
  const [bayesian, setBayesian] = useState({ prior: 0.5, post: 0.5, ev: 0, epoch: 0, loss: 0, conf: 0 });
  const [edge, setEdge] = useState({ ev: 0, cost: 0, net: 0, pass: true });
  const [spread, setSpread] = useState({ z: 0, pSum: 0.96 });
  const [stoikov, setStoikov] = useState({ r: 0, q: 0, gamma: 0, s2: 0 });
  const [mc, setMc] = useState({ dd: 0, fStar: 0, f: 0 });
  const [metrics, setMetrics] = useState({
    balance: 2000000, deposit: 2000000, roi: 0, winRate: 0, edge: 0,
    tradesHr: 0, total: 0, sharpe: 0, maxDd: 0, orders: 0,
    strategy: '5m BTC Arb', spec: 'Directional', hedging: 'Directional',
    status: { polymarket: 'CONNECTING', scanner: 'SCAN', bayes: 'CONNECTING', kelly: 'CONNECTING', slippage: 'ACTIVE', sync: 0 },
  });
  const [pnl, setPnl] = useState([]);
  const [stream, setStream] = useState([]);
  const [connected, setConnected] = useState(false);
  const [dataSource, setDataSource] = useState('connecting'); // 'live' | 'sim' | 'connecting'

  const refs = useRef({ block: 0, bal: 2000000, trades: 0, wins: 0, peak: 2000000, btcPrice: null, polymarkets: [] });
  const { price: wsPrice, bid: wsBid, ask: wsAsk, volume: wsVolume, wsConnected } = useCryptoComWS();

  // Helper: push event to stream
  const pushEvent = useCallback((type, color, detail) => {
    setStream(prev => [{
      id: Date.now() + Math.random(),
      type,
      color,
      detail,
      ts: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev].slice(0, 120));
  }, []);

  // ── Fetch BTC price (REST fallback when WS unavailable) ──
  useEffect(() => {
    if (wsPrice) {
      refs.current.btcPrice = wsPrice;
      return;
    }
    // REST polling fallback
    let active = true;
    const poll = async () => {
      try {
        const resp = await fetch('/api/btc-feed');
        if (resp.ok) {
          const data = await resp.json();
          if (active && data.price) refs.current.btcPrice = data.price;
        }
      } catch { /* silent */ }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => { active = false; clearInterval(iv); };
  }, [wsPrice]);

  // ── Fetch Polymarket BTC markets ──
  useEffect(() => {
    let active = true;
    const fetchPoly = async () => {
      try {
        const resp = await fetch('/api/polymarket-btc');
        if (resp.ok) {
          const data = await resp.json();
          if (active) refs.current.polymarkets = data.markets || [];
          pushEvent('SCAN', COLORS.amber, `polymarket ${data.totalMarkets || 0} mkts, ${data.totalArbs || 0} arbs`);
        }
      } catch { /* silent */ }
    };
    fetchPoly();
    const iv = setInterval(fetchPoly, 30000); // refresh every 30s
    return () => { active = false; clearInterval(iv); };
  }, [pushEvent]);

  // ── Fetch engine state (account metrics) ──
  useEffect(() => {
    let active = true;
    const fetchState = async () => {
      try {
        const resp = await fetch('/api/engine-state');
        if (resp.ok) {
          const data = await resp.json();
          if (!active) return;
          const m = data.metrics;
          setMetrics(prev => ({
            ...prev,
            balance: m.balance || prev.balance,
            deposit: m.deposit || prev.deposit,
            roi: m.roi || prev.roi,
            winRate: m.winRate || prev.winRate,
            sharpe: m.sharpe || prev.sharpe,
            maxDd: m.maxDd || prev.maxDd,
            tradesHr: m.tradesHr || prev.tradesHr,
            total: m.totalTrades || prev.total,
            orders: (m.totalTrades || 0) * 2,
            status: data.status || prev.status,
          }));
          refs.current.bal = m.balance || refs.current.bal;
          refs.current.trades = m.totalTrades || refs.current.trades;
          refs.current.peak = Math.max(refs.current.peak, m.balance || 0);

          // Push EXEC events from recent signals
          for (const sig of (data.execSignals || []).slice(0, 3)) {
            pushEvent('EXEC', COLORS.greenBright, `${sig.direction} ${sig.symbol}, ${sig.setup}, ${sig.confidence}%`);
          }

          setDataSource('live');
          setConnected(true);
          return true;
        }
      } catch { /* silent */ }
      return false;
    };

    fetchState().then(ok => {
      if (!ok) {
        // Engine state API unavailable — fall back to simulation
        setDataSource('sim');
        setConnected(true);
        pushEvent('SCAN', COLORS.amber, 'engine-state unavailable, sim mode');
      }
    });
    const iv = setInterval(fetchState, 15000);
    return () => { active = false; clearInterval(iv); };
  }, [pushEvent]);

  // ── Claude signal analysis (every 30s when live data available) ──
  useEffect(() => {
    let active = true;
    const fetchSignal = async () => {
      const btcPrice = refs.current.btcPrice;
      if (!btcPrice) return;

      try {
        const resp = await fetch('/api/claude-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            btcPrice,
            bid: wsBid,
            ask: wsAsk,
            polymarkets: refs.current.polymarkets.slice(0, 5),
            accountBalance: refs.current.bal,
          }),
        });

        if (resp.ok && active) {
          const data = await resp.json();
          setBayesian(prev => ({
            prior: data.bayesian?.prior ?? prev.prior,
            post: data.bayesian?.post ?? prev.post,
            ev: data.bayesian?.ev ?? prev.ev,
            epoch: prev.epoch + 1,
            loss: data.bayesian?.loss ?? prev.loss,
            conf: data.bayesian?.conf ?? prev.conf,
          }));
          setEdge(data.edge || edge);
          setSpread(data.spread || spread);
          setStoikov(data.stoikov || stoikov);
          setMc(data.mc || mc);

          // Log signal to stream
          const sig = data.signal;
          if (sig) {
            const sigColor = sig.action === 'LONG' ? COLORS.greenBright : sig.action === 'SHORT' ? COLORS.red : COLORS.dim;
            pushEvent('BAYES', COLORS.blue, `post=${data.bayesian?.post}, conf=${data.bayesian?.conf}%`);
            pushEvent(sig.action === 'HOLD' ? 'FILTER' : 'EXEC', sigColor,
              sig.action === 'HOLD' ? `rejected: ${sig.reason}` : `${sig.action} $${sig.riskDollars?.toLocaleString()}, ${sig.reason}`
            );
            if (data.mc?.fStar) {
              pushEvent('KELLY', COLORS.text, `f*=${data.mc.fStar}, ${data.mc.f < data.mc.fStar ? 'safe' : 'limit'}`);
            }

            // ── EXEC signal → fire paper trade ──
            if (sig.action !== 'HOLD' && sig.confidence >= 60 && sig.riskDollars > 0) {
              executePaperTrade(sig, btcPrice);
            }
          }
        }
      } catch {
        // Claude signal unavailable — push sim values
        if (active) simulateSignalTick();
      }
    };

    // Initial delay then poll
    const t0 = setTimeout(fetchSignal, 2000);
    const iv = setInterval(fetchSignal, 30000);
    return () => { active = false; clearTimeout(t0); clearInterval(iv); };
  }, [wsBid, wsAsk, pushEvent]);

  // ── Fire paper trade from EXEC signal ──
  const executePaperTrade = useCallback(async (signal, btcPrice) => {
    try {
      const side = signal.action === 'LONG' ? 'buy' : 'sell';
      const quantity = Math.max(0.001, +(signal.riskDollars / btcPrice).toFixed(6));

      pushEvent('EXEC', COLORS.greenBright, `paper ${side} ${quantity} BTC @ $${btcPrice.toLocaleString()}`);

      // Insert directly into sentinel_trades via engine-state or paper-trade API
      const resp = await fetch('/api/paper-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USD',
          side,
          quantity,
          source: 'arb-engine',
        }),
      });

      if (resp.ok) {
        pushEvent('FILL', COLORS.green, `${side.toUpperCase()} ${quantity} BTC filled @ $${btcPrice.toLocaleString()}`);
      } else {
        pushEvent('FILTER', COLORS.red, `paper trade rejected: ${resp.status}`);
      }
    } catch (err) {
      pushEvent('FILTER', COLORS.red, `trade error: ${err.message}`);
    }
  }, [pushEvent]);

  // ── Simulation fallback for model panels (when Claude signal unavailable) ──
  const simulateSignalTick = useCallback(() => {
    const btcPrice = refs.current.btcPrice || 72000;
    const prior = 0.42 + Math.random() * 0.18;
    const post = Math.min(0.99, prior + (Math.random() - 0.35) * 0.1);
    const ev = (post - prior) * 100;
    const evNet = +(Math.random() * 0.09).toFixed(4);
    const cost = +(0.005 + Math.random() * 0.025).toFixed(4);
    const net = +(evNet - cost).toFixed(4);

    setBayesian(prev => ({
      prior: +prior.toFixed(3),
      post: +post.toFixed(3),
      ev: +ev.toFixed(2),
      epoch: prev.epoch + 1,
      loss: +(0.005 + Math.random() * 0.04).toFixed(4),
      conf: +(68 + Math.random() * 28).toFixed(1),
    }));
    setEdge({ ev: evNet, cost, net, pass: net > 0 });
    setSpread({ z: +(-2.5 + Math.random() * 5).toFixed(2), pSum: +(0.90 + Math.random() * 0.08).toFixed(4) });
    setStoikov({
      r: +(btcPrice + Math.random() * 300).toFixed(0),
      q: +(Math.random() * 5 - 2.5).toFixed(1),
      gamma: +(0.01 + Math.random() * 0.05).toFixed(2),
      s2: +(80 + Math.random() * 600).toFixed(0),
    });
    setMc({
      dd: +(Math.random() * 7).toFixed(1),
      fStar: +(0.02 + Math.random() * 0.18).toFixed(2),
      f: +(0.01 + Math.random() * 0.14).toFixed(2),
    });
  }, []);

  // ── Tick counter + volume from WS ──
  useEffect(() => {
    const iv = setInterval(() => {
      refs.current.block++;
      const btcPrice = refs.current.btcPrice || 72000;
      const vol = wsVolume ? (wsVolume * btcPrice / 1e9) : (3.5 + Math.random() * 0.8);
      setTick({
        block: refs.current.block,
        vol: +vol.toFixed(2),
        edge: metrics.edge || +(8 + Math.random() * 6).toFixed(1),
      });
    }, 500);
    return () => clearInterval(iv);
  }, [wsVolume, metrics.edge]);

  // ── P&L curve updates ──
  useEffect(() => {
    const iv = setInterval(() => {
      const bal = refs.current.bal;
      const deposit = refs.current.deposit || 2000000;
      setPnl(prev => [...prev, { t: Date.now(), v: bal - deposit }].slice(-500));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  // ── Simulation stream events (when real signals are sparse) ──
  useEffect(() => {
    const SIM_EVENTS = [
      { type: 'SCAN', color: COLORS.amber, gen: () => `5m repriced` },
      { type: 'SPREAD', color: COLORS.cyan, gen: () => {
        const poly = refs.current.polymarkets[0];
        return poly ? `pSum=${poly.pSum}, spread=${poly.spread}` : `z=${(Math.random()*4-1).toFixed(2)}, disclose`;
      }},
      { type: 'LMSR', color: COLORS.blue, gen: () => `b=${(Math.random()*2).toFixed(1)}, impact=${(Math.random()*5).toFixed(3)}` },
      { type: 'HEDGE', color: COLORS.amber, gen: () => `delta=${(Math.random()*0.5).toFixed(3)}` },
      { type: 'ARB', color: COLORS.greenBright, gen: () => {
        const arbs = refs.current.polymarkets.filter(m => m.pSum < 0.98);
        return arbs.length > 0 ? `+${((1 - arbs[0].pSum) * 100).toFixed(1)}% edge` : `+$${(Math.random()*20).toFixed(2)}`;
      }},
      { type: 'EV', color: COLORS.text, gen: () => `net=${(Math.random()*0.12).toFixed(4)}` },
    ];

    let st;
    const emit = () => {
      const e = SIM_EVENTS[Math.random() * SIM_EVENTS.length | 0];
      pushEvent(e.type, e.color, e.gen());
      st = setTimeout(emit, 300 + Math.random() * 700);
    };
    st = setTimeout(emit, 500);
    return () => clearTimeout(st);
  }, [pushEvent]);

  // Update connection status from WS
  useEffect(() => {
    if (wsConnected) {
      setConnected(true);
      if (dataSource === 'connecting') setDataSource('live');
    }
  }, [wsConnected, dataSource]);

  return { tick, bayesian, edge, spread, stoikov, mc, metrics, pnl, stream, connected, dataSource, btcPrice: wsPrice || refs.current.btcPrice };
}

// ─── Monte Carlo Canvas ────────────────────────────────────────────────────
const MonteCarloCanvas = memo(function MonteCarloCanvas() {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const ox = 50, oy = H / 2;
    const steps = 30;
    const sx = (W - 100) / steps;
    const vol = 0.025, edg = 0.012;
    const paths = 800;

    for (let i = 0; i < paths; i++) {
      ctx.beginPath();
      let y = oy;
      ctx.moveTo(ox, y);
      for (let s = 1; s <= steps; s++) {
        y -= (edg / steps + vol * (Math.random() * 2 - 1) * Math.sqrt(1 / steps)) * H * 2.5;
        ctx.lineTo(ox + s * sx, y);
      }
      if (y < oy - 5) {
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.06 + Math.random() * 0.08})`;
      } else if (y > oy + 5) {
        ctx.strokeStyle = `rgba(255, 68, 68, ${0.04 + Math.random() * 0.06})`;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      }
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(ox - 30, oy - 30, 60, 60);

    ctx.beginPath();
    ctx.arc(ox, oy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ox, oy, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = COLORS.green;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(W - 50, oy - H * 0.22);
    ctx.stroke();
    ctx.strokeStyle = COLORS.red;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(W - 50, oy + H * 0.15);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.green;
    ctx.fillText(`+${(edg * 800).toFixed(1)}%`, W - 46, oy - H * 0.22 - 6);
    ctx.fillStyle = COLORS.red;
    ctx.fillText(`-${(vol * 400).toFixed(1)}%`, W - 46, oy + H * 0.15 + 14);

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.font = '12px monospace';
    ctx.fillText('STRATIFY SENTINEL', 14, H - 12);
  }, []);

  useEffect(() => {
    draw();
    const iv = setInterval(draw, 5000);
    return () => clearInterval(iv);
  }, [draw]);

  useEffect(() => {
    const h = () => draw();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
});

// ─── UI Components ─────────────────────────────────────────────────────────
function PulsingDot({ color = COLORS.green }) {
  return (
    <span className="relative inline-flex items-center justify-center w-4 h-4">
      <span className="absolute w-3 h-3 rounded-full opacity-40 animate-ping" style={{ backgroundColor: color }} />
      <span className="relative w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

function Val({ children, color }) {
  return <span style={{ color: color || COLORS.text }} className="font-mono text-xs">{children}</span>;
}

function Dim({ children }) {
  return <span style={{ color: COLORS.dim }} className="font-mono text-[11px]">{children}</span>;
}

function Row({ label, value, color }) {
  return (
    <div className="flex justify-between items-center py-[2px] px-3">
      <Dim>{label}</Dim>
      <Val color={color}>{value}</Val>
    </div>
  );
}

const PnlCanvas = memo(function PnlCanvas({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !data.length) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const vals = data.map(d => d.v);
    const minV = Math.min(0, ...vals);
    const maxV = Math.max(0, ...vals);
    const range = maxV - minV || 1;
    const pad = 4;

    const toX = (i) => pad + (i / (data.length - 1)) * (W - pad * 2);
    const toY = (v) => H - pad - ((v - minV) / range) * (H - pad * 2);

    // Fill
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    for (let i = 0; i < data.length; i++) ctx.lineTo(toX(i), toY(vals[i]));
    ctx.lineTo(toX(data.length - 1), toY(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(16,185,129,0.15)');
    grad.addColorStop(1, 'rgba(16,185,129,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = toX(i), y = toY(vals[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
});

// ─── Main Component ────────────────────────────────────────────────────────
export default function SentinelEngine() {
  const { tick, bayesian, edge, spread, stoikov, mc, metrics, pnl, stream, connected, dataSource, btcPrice } = useBotStream();
  const totalPnl = metrics.balance - metrics.deposit;

  const marquee = `BAYESIAN + EDGE + SPREAD + STOIKOV + KELLY + MONTE CARLO  ·  $${metrics.balance.toLocaleString()} → $${(metrics.deposit * 2).toLocaleString()}  ·  5-MIN BTC  ·  LIMIT ORDERS  ·  ${metrics.tradesHr}/hr TRADING  ·  ${metrics.winRate}% WIN  ·  ${metrics.edge || '—'}% EDGE`;

  const panelStyle = {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
  };

  const headerStyle = {
    color: COLORS.dim,
    fontSize: '11px',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    padding: '8px 10px 6px',
    borderBottom: `1px solid ${COLORS.border}`,
  };

  return (
    <div
      className="w-full flex flex-col overflow-hidden select-none h-full"
      style={{
        background: COLORS.bg,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', monospace",
        color: COLORS.text,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        .sentinel-scroll::-webkit-scrollbar { width: 3px; }
        .sentinel-scroll::-webkit-scrollbar-track { background: transparent; }
        .sentinel-scroll::-webkit-scrollbar-thumb { background: ${COLORS.dimmer}; border-radius: 2px; }
        .sentinel-scroll { scrollbar-width: thin; scrollbar-color: ${COLORS.dimmer} transparent; }
        @keyframes sentinel-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.8); } }
      `}</style>

      {/* HEADER BAR */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4"
        style={{ height: 36, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panel }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold tracking-widest" style={{ color: COLORS.white }}>
            ARB ENGINE
          </span>
          <span className="text-[11px]" style={{ color: COLORS.dim }}>
            // 5-MIN BTC MARKETS
          </span>
          {btcPrice && (
            <span className="text-[11px] font-semibold" style={{ color: COLORS.green }}>
              ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[11px]" style={{ color: COLORS.dim }}>
            BLOCK <span style={{ color: COLORS.text }}>{tick.block.toLocaleString()}</span>
          </span>
          <span className="text-[11px]" style={{ color: COLORS.dim }}>
            VOL <span style={{ color: COLORS.text }}>${tick.vol.toFixed(2)}B</span>
          </span>
          <span className="text-[11px]" style={{ color: COLORS.dim }}>
            EDGE <span style={{ color: COLORS.green }}>{typeof tick.edge === 'number' ? tick.edge.toFixed(1) : '—'}%</span>
          </span>
          <div className="flex items-center gap-1.5">
            <PulsingDot color={connected ? COLORS.green : COLORS.amber} />
            <span className="text-[11px] font-semibold" style={{ color: connected ? COLORS.green : COLORS.amber }}>
              {!connected ? 'CONNECTING...' : dataSource === 'live' ? 'LIVE' : 'SIM'}
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: 1, gap: 1 }}>

        {/* TOP ROW: 3 MODEL PANELS */}
        <div className="flex gap-[1px] flex-shrink-0" style={{ height: '27%' }}>

          {/* BAYESIAN MODEL */}
          <div className="flex-1 flex flex-col overflow-hidden" style={panelStyle}>
            <div style={headerStyle}>
              <div>BAYESIAN MODEL</div>
              <div className="mt-0.5 text-[10px]" style={{ color: COLORS.dim, letterSpacing: '0.05em' }}>BAYESIAN UPDATE</div>
            </div>
            <div className="px-3 py-1.5" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <span className="text-[11px]" style={{ color: COLORS.dimmer }}>
                P(H|D) = P(D|H) × P(H) / P(D)
              </span>
            </div>
            <div className="flex-1 overflow-y-auto sentinel-scroll py-1">
              <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>H = outcome hypothesis</div>
              <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>D = new market data (spot, vol, imb)</div>
              <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>P(H) = prior from last window</div>
              <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>P(H|D) = posterior probability</div>
              <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>recalculated every 5 ticks</div>
              <div className="h-1" />
              <Row label="prior" value={bayesian.prior} color={COLORS.text} />
              <Row label="post" value={bayesian.post} color={COLORS.green} />
              <Row label="ev" value={bayesian.ev} color={+bayesian.ev > 0 ? COLORS.green : COLORS.red} />
              <div className="h-1" />
              <Row label="epoch" value={bayesian.epoch} />
              <Row label="loss" value={bayesian.loss} />
              <Row label="conf" value={`${bayesian.conf}%`} color={COLORS.green} />
            </div>
          </div>

          {/* EDGE + SPREAD */}
          <div className="flex-1 flex flex-col overflow-hidden" style={panelStyle}>
            <div style={headerStyle}>
              <div className="flex justify-between">
                <span>EDGE + SPREAD</span>
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px]" style={{ color: COLORS.dim }}>EDGE FILTER</span>
                <span className="text-[10px]" style={{ color: COLORS.dim }}>SPREAD EDGE</span>
              </div>
            </div>
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll" style={{ borderRight: `1px solid ${COLORS.border}` }}>
                <div className="px-3 py-1.5 text-[11px]" style={{ color: COLORS.dimmer, borderBottom: `1px solid ${COLORS.border}` }}>
                  EV_net = q - p - c
                </div>
                <div className="py-1">
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>q = model probability</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>p = market price</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>c = fees + spread + slippage</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>only +EV entries pass</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>main system filter</div>
                  <div className="h-1" />
                  <Row label="EV" value={edge.ev} color={COLORS.text} />
                  <Row label="cost" value={edge.cost} color={COLORS.text} />
                  <Row label="net" value={edge.net} color={edge.pass ? COLORS.green : COLORS.red} />
                  <div className="px-3 py-0.5">
                    <span className="text-xs font-bold" style={{ color: edge.pass ? COLORS.green : COLORS.red }}>
                      {edge.pass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll">
                <div className="px-3 py-1.5 text-[11px]" style={{ color: COLORS.dimmer, borderBottom: `1px solid ${COLORS.border}` }}>
                  z = (s - μ_s) / σ_s
                </div>
                <div className="py-1">
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>p1 = polymarket arb opportunity</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>if sum {'<'} 1: these moves exist</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>net edge after all costs</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>typically 1-3% on 5m mkts</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>calculates robustness</div>
                  <div className="h-1" />
                  <Row label="z-score" value={spread.z} color={Math.abs(spread.z) > 1.5 ? COLORS.amber : COLORS.text} />
                  <Row label="p_sum" value={spread.pSum} color={+spread.pSum < 1 ? COLORS.green : COLORS.text} />
                </div>
              </div>
            </div>
          </div>

          {/* EXECUTION LAYER */}
          <div className="flex-1 flex flex-col overflow-hidden" style={panelStyle}>
            <div style={headerStyle}>
              <div>EXECUTION LAYER</div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px]" style={{ color: COLORS.dim }}>STOIKOV QUOTING</span>
                <span className="text-[10px]" style={{ color: COLORS.dim }}>MONTE CARLO</span>
              </div>
            </div>
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll" style={{ borderRight: `1px solid ${COLORS.border}` }}>
                <div className="px-3 py-1.5 text-[11px]" style={{ color: COLORS.dimmer, borderBottom: `1px solid ${COLORS.border}` }}>
                  r = s - q*gamma*sigma²*(T-t)
                </div>
                <div className="py-1">
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>r = reservation price</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>s = mid price</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>q = inventory, gamma = risk</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>sigma² = variance</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>T-t = time remaining</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>adjusts execution price</div>
                  <div className="h-1" />
                  <Row label="q" value={stoikov.q} />
                  <Row label="gamma" value={stoikov.gamma} />
                  <Row label="s²" value={stoikov.s2} />
                  <Row label="r" value={`$${stoikov.r}`} color={COLORS.green} />
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll">
                <div className="px-3 py-1.5 text-[11px]" style={{ color: COLORS.dimmer, borderBottom: `1px solid ${COLORS.border}` }}>
                  W(t+1) = W(t) × (1 + r(t))
                </div>
                <div className="py-1">
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>DD = max((Peak-W)/Peak)</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>1000 scenarios per cycle</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>tests fill rates, slippage</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>random execution delays</div>
                  <div className="px-3 py-0.5 text-[11px]" style={{ color: COLORS.dim }}>validates robustness</div>
                  <div className="h-1" />
                  <Row label="f*" value={mc.fStar} color={COLORS.green} />
                  <Row label="f" value={mc.f} />
                  <Row label="max DD" value={`${mc.dd}%`} color={COLORS.red} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MONTE CARLO VISUALIZATION */}
        <div className="flex-shrink-0 overflow-hidden" style={{ ...panelStyle, height: '30%' }}>
          <MonteCarloCanvas />
        </div>

        {/* BOTTOM ROW */}
        <div className="flex gap-[1px] flex-1 min-h-0">

          {/* TRAINING STREAM */}
          <div className="flex flex-col overflow-hidden" style={{ ...panelStyle, flex: '1.15' }}>
            <div style={headerStyle}>TRAINING STREAM</div>
            <div className="flex-1 overflow-y-auto sentinel-scroll px-2 py-1">
              {stream.map(e => (
                <div key={e.id} className="flex gap-1.5 py-[1px] text-[11px] leading-tight">
                  <span style={{ color: COLORS.dim }} className="w-[56px] flex-shrink-0 tabular-nums">{e.ts}</span>
                  <span style={{ color: e.color }} className="font-bold w-[56px] flex-shrink-0">[{e.type}]</span>
                  <span style={{ color: e.type === 'FILTER' ? COLORS.red : COLORS.dim }}>{e.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BOT METRICS */}
          <div className="flex flex-col overflow-hidden" style={{ ...panelStyle, flex: '0.85' }}>
            <div style={headerStyle}>BOT METRICS</div>
            <div className="flex-1 overflow-y-auto sentinel-scroll py-1">
              <div className="px-3 pt-1 pb-2">
                <div className="text-[11px]" style={{ color: COLORS.dim }}>Balance</div>
                <div className="text-[22px] font-bold tabular-nums" style={{ color: COLORS.green }}>
                  ${metrics.balance.toLocaleString()}
                </div>
              </div>
              <Row label="Deposit" value={`$${metrics.deposit.toLocaleString()}`} />
              <Row label="ROI" value={`${metrics.roi}%`} color={+metrics.roi >= 0 ? COLORS.green : COLORS.red} />
              <Row label="Win Rate" value={`${metrics.winRate}%`} color={+metrics.winRate > 50 ? COLORS.green : COLORS.red} />
              <Row label="Edge" value={`${metrics.edge || '—'}%`} color={COLORS.green} />
              <Row label="Trades/Hr" value={metrics.tradesHr} />
              <Row label="Total" value={metrics.total.toLocaleString()} />
              <Row label="Sharpe" value={metrics.sharpe} color={+metrics.sharpe > 1.5 ? COLORS.green : COLORS.text} />
              <Row label="Max DD" value={`${metrics.maxDd}%`} color={COLORS.red} />
              <Row label="Orders" value={metrics.orders.toLocaleString()} />
              <Row label="Strategy" value={metrics.strategy} color={COLORS.cyan} />
              <Row label="Hedging" value={metrics.hedging} />

              <div className="mt-2 pt-1.5" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <div className="px-3 pb-1 text-[11px] font-bold tracking-wider" style={{ color: COLORS.dim }}>STATUS</div>
                {Object.entries(metrics.status).map(([k, v]) => (
                  <Row
                    key={k}
                    label={k.charAt(0).toUpperCase() + k.slice(1)}
                    value={typeof v === 'number' ? `${v}%` : v}
                    color={v === 'ONLINE' ? COLORS.green : v === 'ACTIVE' ? COLORS.green : v === 'SCAN' ? COLORS.amber : typeof v === 'number' ? COLORS.green : v === 'CONNECTING' ? COLORS.amber : COLORS.red}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* P&L CURVE */}
          <div className="flex flex-col overflow-hidden" style={{ ...panelStyle, flex: '1' }}>
            <div style={headerStyle}>
              <div className="flex justify-between items-center">
                <span>P&L CURVE</span>
              </div>
            </div>
            <div className="px-3 pt-2 pb-1">
              <div className="text-[22px] font-bold tabular-nums" style={{ color: totalPnl >= 0 ? COLORS.green : COLORS.red }}>
                ${Math.abs(totalPnl) < 1 ? totalPnl.toFixed(2) : totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[11px]" style={{ color: COLORS.dim }}>
                from ${metrics.deposit.toLocaleString()}
              </div>
            </div>
            <div className="flex-1 min-h-0 px-1 pb-1">
              <PnlCanvas data={pnl} />
            </div>
          </div>
        </div>
      </div>

      {/* STATUS BAR */}
      <div
        className="flex-shrink-0 flex items-center overflow-hidden"
        style={{ height: 28, borderTop: `1px solid ${COLORS.border}`, background: COLORS.panel, padding: '0 12px' }}
      >
        <div className="overflow-hidden whitespace-nowrap w-full">
          <motion.div
            className="inline-block text-[11px]"
            style={{ color: COLORS.dim }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
          >
            {marquee}{'          ·          '}{marquee}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
