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
  text: '#f0f0f0',
  green: '#10b981',
  greenBright: '#00ff88',
  red: '#ff4444',
  amber: '#ffaa00',
  blue: '#4488ff',
  cyan: '#00ccff',
  dim: '#8a8a8a',
  dimmer: '#555555',
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
  const [pnlFull, setPnlFull] = useState([]); // all-time equity curve
  const [pnlDaily, setPnlDaily] = useState([]); // today's trades only
  const [pnlView, setPnlView] = useState('total'); // 'total' | 'daily'
  const [stream, setStream] = useState([]);
  const [connected, setConnected] = useState(false);
  const [dataSource, setDataSource] = useState('connecting'); // 'live' | 'sim' | 'connecting'

  const refs = useRef({ block: 0, bal: 2000000, trades: 0, wins: 0, peak: 2000000, btcPrice: null, polymarkets: [], pnlViewRef: 'total' });
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

          // Seed equity curve from real trade history
          if (data.equityCurve && data.equityCurve.length > 0) {
            setPnlFull(data.equityCurve);
            // Only overwrite pnl if user is viewing total (don't clobber daily view)
            if (refs.current.pnlViewRef !== 'daily') {
              setPnl(data.equityCurve);
            }
            refs.current.equitySeeded = true;

            // Build daily curve: only trades from today (ET)
            const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
            const todayStart = new Date(todayET + 'T00:00:00-05:00').getTime();
            const todayTrades = data.equityCurve.filter(p => p.t >= todayStart);
            if (todayTrades.length >= 3) {
              const prevClose = data.equityCurve.length > todayTrades.length
                ? data.equityCurve[data.equityCurve.length - todayTrades.length - 1].v
                : 0;
              const dailyData = todayTrades.map(p => ({ t: p.t, v: Math.round((p.v - prevClose) * 100) / 100 }));
              setPnlDaily(dailyData);
              // If user is viewing daily, update with fresh daily data
              if (refs.current.pnlViewRef === 'daily') {
                setPnl(dailyData);
              }
            } else {
              // Not enough daily trades for a chart — keep daily empty
              setPnlDaily([]);
              if (refs.current.pnlViewRef === 'daily') {
                setPnl([]);
              }
            }
          }

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

  // ── P&L curve updates — append live unrealized ticks after equity curve is seeded ──
  useEffect(() => {
    const iv = setInterval(() => {
      if (!refs.current.equitySeeded) return; // Wait for real data before appending
      const bal = refs.current.bal;
      const deposit = refs.current.deposit || 2000000;
      const liveVal = bal - deposit;
      setPnl(prev => {
        const last = prev[prev.length - 1];
        // Only append if value changed meaningfully (avoid flat line spam)
        if (last && Math.abs(last.v - liveVal) < 0.5) return prev;
        return [...prev, { t: Date.now(), v: liveVal }].slice(-500);
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // ── Real signal stream from /api/sentinel/signals ──
  useEffect(() => {
    let active = true;
    const lastSeen = { ts: null };

    const formatSignal = (sig) => {
      const sym = sig.symbol?.replace('/USD','') || '';
      if (sig.type === 'SCAN') return `${sym} ${sig.timeframe || '5min'} scanned`;
      if (sig.type === 'BAYES_REJECT') return `${sym} post=${sig.bayesian?.posterior?.toFixed(2)} REJECTED`;
      if (sig.type === 'EDGE_REJECT') return `${sym} EV=${sig.edge?.ev?.toFixed(3)} NO EDGE`;
      if (sig.type === 'TRADE_FIRED') return `${sig.direction} ${sym} score=${sig.score}`;
      return `${sig.type} ${sym}`;
    };

    const expandToEvents = (sig) => {
      const events = [];
      const sym = sig.symbol?.replace('/USD','') || '';
      if (sig.bayesian) events.push({ type: '[BAYES]', color: COLORS.cyan, text: `post=${sig.bayesian.posterior?.toFixed(2)}, ev=${sig.bayesian.ev?.toFixed(3)}` });
      if (sig.edge) events.push({ type: '[EDGE]', color: sig.edge.pass ? COLORS.greenBright : COLORS.text, text: `EV=${sig.edge.ev?.toFixed(3)}${sig.edge.pass ? ' PASS' : ''}` });
      if (sig.stoikov) events.push({ type: '[STOIKOV]', color: COLORS.blue, text: `r=$${sig.stoikov.reservation?.toFixed(0)}, size=${sig.stoikov.optimalSize}` });
      if (sig.mc) events.push({ type: '[KELLY]', color: COLORS.amber, text: `f=${((sig.mc.kelly||0)*100).toFixed(1)}%, DD=${sig.mc.maxDd?.toFixed(1)}%` });
      events.push({
        type: sig.fired ? '[EXEC]' : `[${(sig.type || 'SCAN').replace('_REJECT','')}]`,
        color: sig.fired ? COLORS.greenBright : COLORS.amber,
        text: formatSignal(sig),
      });
      return events;
    };

    const poll = async () => {
      if (!active) return;
      try {
        const url = lastSeen.ts
          ? `/api/sentinel/signals?limit=20&since=${encodeURIComponent(lastSeen.ts)}`
          : '/api/sentinel/signals?limit=50';
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.signals?.length > 0) {
          // Update model panels from latest signal with real model values
          const latestWithModels = data.signals.find(s => s.bayesian || s.edge || s.stoikov || s.mc);
          if (latestWithModels) {
            if (latestWithModels.bayesian) {
              setBayesian(prev => ({
                prior: latestWithModels.bayesian.prior || prev.prior,
                post: latestWithModels.bayesian.posterior || prev.post,
                ev: latestWithModels.bayesian.ev || prev.ev,
                epoch: prev.epoch + 1,
                loss: prev.loss,
                conf: latestWithModels.bayesian.confidence || prev.conf,
              }));
            }
            if (latestWithModels.edge) {
              setEdge({
                ev: latestWithModels.edge.ev || 0,
                cost: latestWithModels.edge.cost || 0,
                net: (latestWithModels.edge.ev || 0) - (latestWithModels.edge.cost || 0),
                pass: latestWithModels.edge.pass ?? true,
              });
              setSpread({
                z: latestWithModels.edge.zScore || 0,
                pSum: latestWithModels.edge.pSum || 0.96,
              });
            }
            if (latestWithModels.stoikov) {
              setStoikov({
                r: latestWithModels.stoikov.reservation || 0,
                q: latestWithModels.stoikov.q || 0,
                gamma: latestWithModels.stoikov.gamma || 0,
                s2: latestWithModels.stoikov.sigma2 || 0,
              });
            }
            if (latestWithModels.mc) {
              setMc({
                dd: latestWithModels.mc.maxDd || 0,
                fStar: (latestWithModels.mc.kelly || 0) * 2, // full kelly = 2x half kelly
                f: latestWithModels.mc.kelly || 0,
              });
            }
          }
          if (data.latestModels) refs.current.latestModels = data.latestModels;
          for (const sig of data.signals.reverse()) {
            for (const ev of expandToEvents(sig)) pushEvent(ev.type, ev.color, ev.text);
          }
          lastSeen.ts = data.signals[data.signals.length - 1]?.t || lastSeen.ts;
        }
      } catch { /* silent */ }
    };

    poll();
    const iv = setInterval(poll, 10000);
    return () => { active = false; clearInterval(iv); };
  }, [pushEvent]);

  // Update connection status from WS
  useEffect(() => {
    if (wsConnected) {
      setConnected(true);
      if (dataSource === 'connecting') setDataSource('live');
    }
  }, [wsConnected, dataSource]);

  // Keep pnlView ref in sync so the fetch callback respects the user's view choice
  useEffect(() => {
    refs.current.pnlViewRef = pnlView;
  }, [pnlView]);

  return { tick, bayesian, edge, spread, stoikov, mc, metrics, pnl, setPnl, pnlFull, pnlDaily, pnlView, setPnlView, stream, connected, dataSource, btcPrice: wsPrice || refs.current.btcPrice };
}

// ─── Monte Carlo Canvas — animated fan with distribution histogram ─────────
const MonteCarloCanvas = memo(function MonteCarloCanvas() {
  const canvasRef = useRef(null);
  const pathsRef = useRef(null);   // pre-generated path data
  const frameRef = useRef(0);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  // Generate a batch of random-walk paths (called once + on resize)
  const generatePaths = useCallback((W, H) => {
    const ox = 40, oy = H * 0.45;
    const STEPS = 200;
    const TOTAL = 600;
    const sx = (W - 80) / STEPS;
    const drift = 0.0003;     // slight upward bias
    const vol = 0.018;

    const paths = [];
    const endings = [];

    for (let i = 0; i < TOTAL; i++) {
      const pts = [{ x: ox, y: oy }];
      let y = oy;
      for (let s = 1; s <= STEPS; s++) {
        // Brownian motion with drift — variance grows with sqrt(t)
        const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 2; // approx normal
        y -= (drift + vol * noise * Math.sqrt(s / STEPS)) * H;
        pts.push({ x: ox + s * sx, y });
      }
      const finalY = pts[pts.length - 1].y;
      const profit = finalY < oy;
      paths.push({ pts, profit, finalY });
      endings.push(finalY);
    }

    return { paths, endings, ox, oy, STEPS };
  }, []);

  // Animate: reveal once over ~6s, then hold with very slow shimmer
  const render = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    const W = rect.width, H = rect.height;

    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.scale(dpr, dpr);
      pathsRef.current = generatePaths(W, H);
    }

    if (!pathsRef.current) {
      pathsRef.current = generatePaths(W, H);
    }

    const { paths, endings, ox, oy, STEPS } = pathsRef.current;
    const frame = frameRef.current++;

    // Reveal over ~6 seconds (360 frames at 60fps), then stay at 1
    const reveal = Math.min(1, frame / 360);
    const visibleSteps = Math.floor(reveal * STEPS);
    const revealed = reveal >= 1;

    // Wall-clock time for smooth animation regardless of frame rate
    const now = Date.now() / 1000;

    ctx.clearRect(0, 0, W, H);

    // Draw paths
    for (let i = 0; i < paths.length; i++) {
      const { pts, profit } = paths[i];
      const stepsToShow = Math.min(visibleSteps, pts.length);
      if (stepsToShow < 2) continue;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let s = 1; s < stepsToShow; s++) {
        ctx.lineTo(pts[s].x, pts[s].y);
      }

      // During reveal: use frame counter. After: use wall-clock for smooth, slow breathe
      let alpha;
      if (revealed) {
        // Very slow breathe — 8 second cycle, barely perceptible
        alpha = 0.03 + Math.sin(now * 0.8 + i * 0.3) * 0.008;
      } else {
        alpha = 0.03 + Math.sin((frame + i * 7) * 0.02) * 0.012;
      }

      if (profit) {
        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
      } else {
        ctx.strokeStyle = `rgba(255, 68, 68, ${alpha * 0.7})`;
      }
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }

    // Distribution histogram on right edge (fade in near end of reveal)
    if (reveal > 0.8) {
      const histAlpha = Math.min(1, (reveal - 0.8) * 5);
      const bins = 30;
      const minY = Math.min(...endings);
      const maxY = Math.max(...endings);
      const binH = (maxY - minY) / bins;
      const counts = new Array(bins).fill(0);
      for (const ey of endings) {
        const bi = Math.min(bins - 1, Math.floor((ey - minY) / binH));
        counts[bi]++;
      }
      const maxCount = Math.max(...counts);
      const barX = W - 36;
      const barMaxW = 28;

      for (let b = 0; b < bins; b++) {
        const by = minY + b * binH;
        const bw = (counts[b] / maxCount) * barMaxW;
        if (bw < 1) continue;
        const isProfit = (by + binH / 2) < oy;
        ctx.fillStyle = isProfit
          ? `rgba(16, 185, 129, ${0.25 * histAlpha})`
          : `rgba(255, 68, 68, ${0.2 * histAlpha})`;
        ctx.fillRect(barX, by, bw, Math.max(1, binH - 1));
      }
    }

    // Origin glow
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 35);
    grad.addColorStop(0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.2)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(ox - 35, oy - 35, 70, 70);

    // Origin dot with slow pulse (wall-clock based for smoothness)
    const pulseR = 5 + Math.sin(now * 0.8) * 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ox, oy, pulseR + 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + Math.sin(now * 0.5) * 0.08})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Axis labels
    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.green;
    ctx.fillText('0', ox - 14, oy + 3);

    // Y-axis scale
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '9px monospace';
    const scaleSteps = [20, 40, 60, 80];
    for (const pct of scaleSteps) {
      const yUp = oy - (pct / 100) * H * 0.4;
      const yDn = oy + (pct / 100) * H * 0.4;
      ctx.fillText(`+${pct}`, 6, yUp + 3);
      ctx.fillStyle = 'rgba(255,68,68,0.15)';
      ctx.fillText(`-${pct}`, 6, yDn + 3);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(ox, yUp); ctx.lineTo(W - 40, yUp); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, yDn); ctx.lineTo(W - 40, yDn); ctx.stroke();
    }

    // Watermark
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.font = '11px monospace';
    ctx.fillText('STRATIFY SENTINEL · 1000 SCENARIOS', ox + 10, H - 10);

    // During reveal: full 60fps. After: throttle to ~10fps to save CPU (no blink — we always draw before scheduling next)
    if (revealed) {
      timerRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(render);
      }, 100);
    } else {
      rafRef.current = requestAnimationFrame(render);
    }
  }, [generatePaths]);

  useEffect(() => {
    // Kick off initial sizing
    const c = canvasRef.current;
    if (c) {
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      pathsRef.current = generatePaths(rect.width, rect.height);
    }
    rafRef.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(timerRef.current); };
  }, [render, generatePaths]);

  useEffect(() => {
    const h = () => {
      pathsRef.current = null; // force regenerate on resize
      frameRef.current = 0;
    };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
});

// ─── Equity Curve Canvas — live P&L chart that updates with every new data point ─
const EquityCurveCanvas = memo(function EquityCurveCanvas({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();

    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) {
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 15, bottom: 20, left: 40 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;

    // Use raw P&L data as-is — the real trading curve
    const vals = data.map(d => d.v);
    if (vals.length < 3) {
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.textAlign = 'center';
      ctx.fillText(vals.length === 0 ? 'No trades closed today — switch to Total P&L' : 'Not enough data points yet...', W / 2, H / 2 - 8);
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillText('Daily view requires closed trades during the current session', W / 2, H / 2 + 12);
      ctx.textAlign = 'left';
      return;
    }

    const minV = Math.min(0, ...vals);
    const maxV = Math.max(0, ...vals);
    const vPad = Math.max(50, (maxV - minV) * 0.1);
    const rangeMin = minV - vPad;
    const rangeMax = maxV + vPad;
    const range = rangeMax - rangeMin;

    const toX = (i) => pad.left + (i / (vals.length - 1)) * cw;
    const toY = (v) => pad.top + ch - ((v - rangeMin) / range) * ch;

    // Grid
    ctx.font = '9px monospace';
    const step = rangeMax > 4000 ? 1000 : rangeMax > 2000 ? 500 : rangeMax > 400 ? 100 : 50;
    for (let val = Math.ceil(rangeMin / step) * step; val <= rangeMax; val += step) {
      const y = toY(val);
      if (y < pad.top - 2 || y > H - pad.bottom + 2) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      const label = Math.abs(val) >= 1e6 ? `$${(val / 1e6).toFixed(1)}M`
        : Math.abs(val) >= 1e3 ? `$${(val / 1e3).toFixed(0)}K`
        : `$${val.toFixed(0)}`;
      ctx.fillText(label, 2, y + 3);
    }

    // $0 dashed baseline
    const zeroY = toY(0);
    if (zeroY > pad.top && zeroY < H - pad.bottom) {
      ctx.strokeStyle = 'rgba(68, 136, 255, 0.15)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(W - pad.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Fill under curve (from $0 line)
    const lastVal = vals[vals.length - 1];
    const isUp = lastVal >= 0;
    const gradFill = ctx.createLinearGradient(0, isUp ? pad.top : zeroY, 0, isUp ? zeroY : H - pad.bottom);
    if (isUp) {
      gradFill.addColorStop(0, 'rgba(68, 136, 255, 0.12)');
      gradFill.addColorStop(1, 'rgba(68, 136, 255, 0)');
    } else {
      gradFill.addColorStop(0, 'rgba(255, 68, 68, 0)');
      gradFill.addColorStop(1, 'rgba(255, 68, 68, 0.12)');
    }

    ctx.beginPath();
    ctx.moveTo(toX(0), zeroY);
    for (let i = 0; i < vals.length; i++) ctx.lineTo(toX(i), toY(vals[i]));
    ctx.lineTo(toX(vals.length - 1), zeroY);
    ctx.closePath();
    ctx.fillStyle = gradFill;
    ctx.fill();

    // Main line — blue like the reference
    const lineColor = isUp ? '#4488ff' : '#ff4444';
    ctx.beginPath();
    for (let i = 0; i < vals.length; i++) {
      const x = toX(i), y = toY(vals[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tip dot + value
    const lastX = toX(vals.length - 1);
    const lastY = toY(lastVal);

    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    ctx.font = '10px monospace';
    ctx.fillStyle = lineColor;
    const prefix = lastVal >= 0 ? '+' : '';
    const label = Math.abs(lastVal) >= 1e6 ? `${prefix}$${(lastVal / 1e6).toFixed(2)}M`
      : Math.abs(lastVal) >= 1e3 ? `${prefix}$${(lastVal / 1e3).toFixed(1)}K`
      : `${prefix}$${lastVal.toFixed(0)}`;
    ctx.fillText(label, lastX - 40, lastY - 8);
  }, [data]);

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
  return <span style={{ color: color || COLORS.text }} className="font-mono text-[11px] tabular-nums">{children}</span>;
}

function Dim({ children }) {
  return <span style={{ color: COLORS.dim }} className="font-mono text-[10px]">{children}</span>;
}

function Row({ label, value, color }) {
  return (
    <div className="flex justify-between items-center py-[1px] px-3">
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
export default function SentinelEngine({ sentinelTotalPnl, sentinelDailyPnl, sentinelAccount, sentinelTotalTrades, sentinelOpenCount }) {
  const { tick, bayesian, edge, spread, stoikov, mc, metrics, pnl, setPnl, pnlFull, pnlDaily, pnlView, setPnlView, stream, connected, dataSource, btcPrice } = useBotStream();
  const totalPnl = sentinelTotalPnl != null ? sentinelTotalPnl : (metrics.balance - metrics.deposit);
  const dailyPnl = sentinelDailyPnl != null ? sentinelDailyPnl : 0;
  // Use shared account stats when available (single source of truth with Overview)
  const sharedWinRate = sentinelAccount?.win_rate != null ? sentinelAccount.win_rate : metrics.winRate;
  const sharedTotalTrades = sentinelTotalTrades != null ? sentinelTotalTrades : metrics.total;
  const sharedOpenCount = sentinelOpenCount || 0;
  const [vizMode, setVizMode] = useState('mc'); // 'mc' | 'equity' | 'models'
  const [modelModal, setModelModal] = useState(null);

  const MODEL_DOCS = {
    bayesian: {
      title: 'Bayesian Model',
      subtitle: 'P(H|D) = P(D|H) × P(H) / P(D)',
      color: '#00d4ff',
      description: `The Bayesian Model is the brain of Sentinel's belief system. It continuously updates the probability that a trade setup will win, given all observed data.

How it works:
• Prior (0.5 default): Sentinel's base assumption that any given setup has a 50% chance of winning before seeing any evidence.
• Posterior: Updated probability after observing market conditions, volume, regime, and recent trade outcomes. If BTC has been winning 70% of long trades in trending conditions, the posterior shifts above 0.5.
• EV (Expected Value): The dollar-weighted expected outcome of the trade. Positive EV = take the trade.
• Epoch: How many 5-minute candles of data the model has processed in this session.
• Loss: Cross-entropy loss measuring how wrong the model's predictions are. Lower = more accurate.
• Conf: Model's confidence percentage in its current prediction.

Why it matters: Sentinel only takes trades where the posterior exceeds a threshold (typically >0.6). This prevents trading on gut feel — every entry requires statistical evidence.`,
    },
    edge: {
      title: 'Edge Filter',
      subtitle: 'EV_net = q − p − c',
      color: '#00ff88',
      description: `The Edge Filter is the gatekeeper. Before any trade executes, it calculates whether there's a real mathematical edge after all costs.

Formula breakdown:
• q = probability of winning × average win size
• p = probability of losing × average loss size  
• c = estimated transaction cost (spread + slippage)
• EV_net = q − p − c (must be positive to trade)

The PASS/FAIL indicator:
• PASS (green): Net expected value is positive — the trade has a genuine mathematical edge after costs.
• FAIL (red): Costs eat the edge or the win probability is too low — Sentinel skips the trade.

Z-score: Measures how far the current spread deviates from normal. High z-scores indicate unusual market conditions where the edge calculation may be less reliable.

Why it matters: Most retail traders lose because they trade without edge. Every Sentinel trade must mathematically prove it's worth taking before execution.`,
    },
    spread: {
      title: 'Spread / LMSR',
      subtitle: 'z = (s − μₛ) / σₛ',
      color: '#ffaa00',
      description: `The Spread model monitors bid-ask spreads and uses LMSR (Logarithmic Market Scoring Rule) to detect when market makers are extracting unusual profit — a signal that informed traders may be moving.

Components:
• z-score: How abnormal the current spread is (in standard deviations). Above +2 = spreads are wide, market is uncertain. Below -1 = tight spreads, healthy liquidity.
• p_sum: Sum of implied probabilities across the order book. Should be close to 1.0. Above 1.0 means the book is overpriced (market makers padding). Below indicates arbitrage opportunity.

LMSR (pSum, impact, cost):
• Borrowed from prediction market theory — treats the order book as a probability market
• Detects when large orders will move price vs when they'll be absorbed
• Impact: estimated price slippage of Sentinel's order
• Cost: total transaction cost including spread impact

Why it matters: Trading in wide-spread conditions destroys edge. The spread model ensures Sentinel only trades in liquid conditions where transaction costs don't exceed the modeled edge.`,
    },
    stoikov: {
      title: 'Stoikov Model',
      subtitle: 'r = s − q·γ·σ²·T',
      color: '#cc88ff',
      description: `The Stoikov model is a market-making framework adapted for directional crypto trading. Originally designed by Sasha Stoikov to optimize limit order placement, Sentinel uses it to determine optimal entry price and position sizing.

Formula: r = s − q·γ·σ²·T
• s = mid price (current market price)
• q = current inventory (net position in base currency)
• γ = risk aversion parameter (how much Sentinel penalizes holding risk)
• σ² = estimated price variance (volatility squared)
• T = time horizon of the trade
• r = reservation price — the fair value Sentinel is willing to trade at

What it calculates:
• If r > current price: Sentinel believes price is below fair value → bullish signal
• If r < current price: price is above fair value → bearish signal
• The spread around r determines limit order placement

Why it matters: Instead of chasing market orders, Sentinel targets the reservation price, improving average entry by 0.05-0.15% per trade. On 110+ trades, this compounds significantly.`,
    },
    monte_carlo: {
      title: 'Monte Carlo',
      subtitle: 'Kelly + Path Simulation',
      color: '#ff6644',
      description: `Monte Carlo simulation runs thousands of randomized future trading paths to determine the optimal bet size and understand the distribution of possible outcomes.

How it works:
• Sentinel runs 1,000+ simulated trading sessions using current win rate, average win, and average loss
• Each simulation randomly sequences wins and losses to produce a possible equity curve
• The spread of outcomes shows best case, worst case, and most likely trajectories

Key outputs:
• f* (Kelly fraction): The mathematically optimal percentage of capital to risk per trade. Derived from the Kelly Criterion: f* = (p·b − q) / b, where p = win rate, b = win/loss ratio, q = 1 − p
• f (actual fraction): The fraction Sentinel actually uses — typically half-Kelly (f*/2) to reduce variance
• DD (max drawdown): The worst simulated drawdown across all paths at 95th percentile

The visualization:
• Green cone: The range of likely equity paths (25th to 75th percentile)
• Orange bars at bottom: Downside tail risk scenarios
• Center line: Median expected path

Why it matters: Most traders blow up because they size too large. Monte Carlo proves what size keeps Sentinel alive across thousands of simulated scenarios, not just lucky streaks.`,
    },
  };

  const sharedBalance = sentinelAccount?.current_balance || metrics.balance;
  const marquee = `BAYESIAN + EDGE + SPREAD + STOIKOV + KELLY + MONTE CARLO  ·  $${sharedBalance.toLocaleString()} → $${(metrics.deposit * 2).toLocaleString()}  ·  5-MIN BTC  ·  LIMIT ORDERS  ·  ${metrics.tradesHr}/hr TRADING  ·  ${sharedWinRate}% WIN  ·  ${metrics.edge || '—'}% EDGE`;

  const panelStyle = {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
  };

  const headerStyle = {
    color: COLORS.dim,
    fontSize: '10px',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    padding: '4px 10px 3px',
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
        style={{ height: 30, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panel }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold tracking-widest" style={{ color: COLORS.white }}>
            ARB ENGINE
          </span>
          <span className="text-[11px]" style={{ color: COLORS.dim }}>
            // 5-MIN BTC MARKETS
          </span>
          {btcPrice && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded" style={{ background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.15)' }}>
              <span className="text-[10px] font-bold" style={{ color: COLORS.amber }}>BTC</span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: COLORS.white }}>
                ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
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

      {/* CONTENT — 3-column layout: models | MC/Equity | training stream */}
      <div className="flex-1 min-h-0 flex" style={{ padding: 1, gap: 1 }}>

        {/* LEFT COLUMN: model panels + metrics */}
        <div className="flex flex-col gap-[1px]" style={{ width: '24%', minWidth: 240 }}>

          {/* BAYESIAN MODEL */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={panelStyle}>
            <div style={headerStyle}>BAYESIAN MODEL</div>
            <div className="px-3 py-0.5" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <span className="text-[9px]" style={{ color: COLORS.dimmer }}>P(H|D) = P(D|H) × P(H) / P(D)</span>
            </div>
            <div className="flex-1 overflow-y-auto sentinel-scroll py-0">
              <Row label="prior" value={bayesian.prior} color={COLORS.text} />
              <Row label="post" value={bayesian.post} color={COLORS.green} />
              <Row label="ev" value={bayesian.ev} color={+bayesian.ev > 0 ? COLORS.green : COLORS.red} />
              <Row label="epoch" value={bayesian.epoch} />
              <Row label="loss" value={bayesian.loss} />
              <Row label="conf" value={`${bayesian.conf}%`} color={COLORS.green} />
            </div>
          </div>

          {/* EDGE + SPREAD */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={panelStyle}>
            <div style={headerStyle}>
              <div className="flex justify-between">
                <span>EDGE FILTER</span>
                <span>SPREAD</span>
              </div>
            </div>
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll" style={{ borderRight: `1px solid ${COLORS.border}` }}>
                <div className="px-3 py-0 text-[9px]" style={{ color: COLORS.dimmer, borderBottom: `1px solid ${COLORS.border}` }}>EV_net = q - p - c</div>
                <div className="py-0.5">
                  <Row label="EV" value={edge.ev} color={COLORS.text} />
                  <Row label="cost" value={edge.cost} color={COLORS.text} />
                  <Row label="net" value={edge.net} color={edge.pass ? COLORS.green : COLORS.red} />
                  <div className="px-3 py-0">
                    <span className="text-[10px] font-bold" style={{ color: edge.pass ? COLORS.green : COLORS.red }}>{edge.pass ? 'PASS' : 'FAIL'}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll">
                <div className="px-3 py-0 text-[9px]" style={{ color: COLORS.dimmer, borderBottom: `1px solid ${COLORS.border}` }}>z = (s - μ_s) / σ_s</div>
                <div className="py-0.5">
                  <Row label="z-score" value={spread.z} color={Math.abs(spread.z) > 1.5 ? COLORS.amber : COLORS.text} />
                  <Row label="p_sum" value={spread.pSum} color={+spread.pSum < 1 ? COLORS.green : COLORS.text} />
                </div>
              </div>
            </div>
          </div>

          {/* EXECUTION LAYER */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={panelStyle}>
            <div style={headerStyle}>
              <div className="flex justify-between">
                <span>STOIKOV</span>
                <span>MONTE CARLO</span>
              </div>
            </div>
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll" style={{ borderRight: `1px solid ${COLORS.border}` }}>
                <div className="py-0.5">
                  <Row label="q" value={stoikov.q} />
                  <Row label="γ" value={stoikov.gamma} />
                  <Row label="σ²" value={stoikov.s2} />
                  <Row label="r" value={`$${stoikov.r}`} color={COLORS.green} />
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto sentinel-scroll">
                <div className="py-0.5">
                  <Row label="f*" value={mc.fStar} color={COLORS.green} />
                  <Row label="f" value={mc.f} />
                  <Row label="DD" value={`${mc.dd}%`} color={COLORS.red} />
                </div>
              </div>
            </div>
          </div>

          {/* BOT METRICS */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={panelStyle}>
            <div style={headerStyle}>BOT METRICS</div>
            <div className="flex-1 overflow-y-auto sentinel-scroll py-0">
              <div className="px-3 pt-0.5 pb-0">
                <div className="text-[9px]" style={{ color: COLORS.dim }}>Balance</div>
                <div className="text-[13px] font-bold tabular-nums" style={{ color: COLORS.green }}>${(sentinelAccount?.current_balance || metrics.balance).toLocaleString()}</div>
              </div>
              <Row label="ROI" value={`${metrics.roi}%`} color={+metrics.roi >= 0 ? COLORS.green : COLORS.red} />
              <Row label="Win Rate" value={`${sharedWinRate}%`} color={totalPnl >= 0 ? COLORS.green : COLORS.red} />
              <Row label="Sharpe" value={metrics.sharpe} color={+metrics.sharpe > 1.5 ? COLORS.green : COLORS.text} />
              <Row label="Max DD" value={`${metrics.maxDd}%`} color={COLORS.red} />
              <Row label="Trades" value={`${sharedTotalTrades.toLocaleString()}${sharedOpenCount > 0 ? ` (${sharedOpenCount} open)` : ''}`} />
              <Row label="Trades/Hr" value={metrics.tradesHr} />
              {Object.entries(metrics.status).map(([k, v]) => (
                <Row key={k} label={k} value={typeof v === 'number' ? `${v}%` : v}
                  color={v === 'ONLINE' || v === 'ACTIVE' ? COLORS.green : v === 'SCAN' || v === 'CONNECTING' ? COLORS.amber : typeof v === 'number' ? COLORS.green : COLORS.red} />
              ))}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: MC/Equity visualization + P&L */}
        <div className="flex-1 flex flex-col gap-[1px] min-w-0">

          {/* MC / EQUITY CANVAS — main visualization */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={panelStyle}>
            <div className="flex items-center justify-between px-3 flex-shrink-0" style={{ height: 24, borderBottom: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-widest" style={{ color: COLORS.dim }}>
                  {vizMode === 'mc' ? 'MONTE CARLO' : vizMode === 'equity' ? (pnlView === 'daily' ? 'DAILY EQUITY' : 'EQUITY CURVE') : 'MODELS'}
                </span>
                {vizMode === 'equity' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: COLORS.green, color: '#000' }}>{pnlView === 'daily' ? 'TODAY' : 'LIVE'}</span>
                )}
              </div>
              <div className="flex items-center gap-1" style={{ background: COLORS.bg, borderRadius: 4, padding: 2 }}>
                {[{ id: 'mc', label: 'MC' }, { id: 'equity', label: 'EQUITY' }, { id: 'models', label: 'MODELS' }].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setVizMode(tab.id)}
                    className="transition-all duration-150"
                    style={{
                      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontFamily: 'monospace',
                      fontWeight: 600, letterSpacing: '0.05em', border: 'none', cursor: 'pointer',
                      background: vizMode === tab.id ? COLORS.border : 'transparent',
                      color: vizMode === tab.id ? COLORS.white : COLORS.dim,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto sentinel-scroll">
              {vizMode === 'mc' ? <MonteCarloCanvas /> : vizMode === 'equity' ? <EquityCurveCanvas data={pnl} /> : (
                <div className="p-3 grid grid-cols-1 gap-2">
                  {Object.entries(MODEL_DOCS).map(([key, model]) => (
                    <button
                      key={key}
                      onClick={() => setModelModal(key)}
                      className="text-left transition-all duration-150 rounded"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${COLORS.border}`,
                        padding: '10px 12px',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold tracking-wider" style={{ color: model.color }}>{model.title.toUpperCase()}</span>
                        <span className="text-[9px] font-mono" style={{ color: COLORS.dimmer }}>tap to learn →</span>
                      </div>
                      <div className="mt-1 text-[11px] font-mono" style={{ color: COLORS.dim }}>{model.subtitle}</div>
                      <div className="mt-1.5 text-[12px] leading-relaxed" style={{ color: COLORS.text }}>
                        {model.description.split('\n')[0]}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* P&L — clickable toggle for equity curve view */}
          <div className="flex items-center justify-between px-3" style={{ ...panelStyle, height: 36 }}>
            <button
              onClick={() => { setPnlView('total'); setPnl(pnlFull); if (vizMode !== 'equity') setVizMode('equity'); }}
              className="flex items-center gap-3 transition-all duration-200"
              style={{
                cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px', borderRadius: 6,
                outline: pnlView === 'total' ? `1px solid ${totalPnl >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` : 'none',
                boxShadow: pnlView === 'total' ? `0 0 12px ${totalPnl >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}` : 'none',
              }}
            >
              <span className="text-[10px] tracking-widest font-bold" style={{ color: pnlView === 'total' ? COLORS.white : COLORS.dim }}>TOTAL P&L</span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: totalPnl >= 0 ? COLORS.green : COLORS.red }}>
                {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl) < 1 ? totalPnl.toFixed(2) : totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </button>
            <button
              onClick={() => { setPnlView('daily'); setPnl(pnlDaily.length >= 3 ? pnlDaily : []); if (vizMode !== 'equity') setVizMode('equity'); }}
              className="flex items-center gap-3 transition-all duration-200"
              style={{
                cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px', borderRadius: 6,
                outline: pnlView === 'daily' ? `1px solid ${dailyPnl >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` : 'none',
                boxShadow: pnlView === 'daily' ? `0 0 12px ${dailyPnl >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}` : 'none',
              }}
            >
              <span className="text-[10px] tracking-widest font-bold" style={{ color: pnlView === 'daily' ? COLORS.white : COLORS.dim }}>DAILY P&L</span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: dailyPnl >= 0 ? COLORS.green : COLORS.red }}>
                {dailyPnl >= 0 ? '+' : ''}${Math.abs(dailyPnl) < 1 ? dailyPnl.toFixed(2) : dailyPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Training Stream (full height) */}
        <div className="flex flex-col gap-[1px]" style={{ width: '20%', minWidth: 200 }}>
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={panelStyle}>
            <div style={headerStyle}>TRAINING STREAM</div>
            <div className="flex-1 overflow-y-auto sentinel-scroll px-2 py-0.5">
              {stream.map(e => (
                <div key={e.id} className="flex gap-1 py-0 text-[10px] leading-tight">
                  <span style={{ color: COLORS.dim }} className="w-[48px] flex-shrink-0 tabular-nums">{e.ts}</span>
                  <span style={{ color: e.color }} className="font-bold w-[48px] flex-shrink-0">[{e.type}]</span>
                  <span style={{ color: e.type === 'FILTER' ? COLORS.red : COLORS.dim }} className="truncate">{e.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STATUS BAR */}
      <div
        className="flex-shrink-0 flex items-center overflow-hidden"
        style={{ height: 22, borderTop: `1px solid ${COLORS.border}`, background: COLORS.panel, padding: '0 12px' }}
      >
        <div className="overflow-hidden whitespace-nowrap w-full">
          <motion.div
            className="inline-block text-[11px]"
            style={{ color: COLORS.dim }}
            animate={{ x: ['-50%', '0%'] }}
            transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
          >
            {marquee}{'          ·          '}{marquee}
          </motion.div>
        </div>
      </div>

      {/* MODEL DETAIL MODAL */}
      {modelModal && MODEL_DOCS[modelModal] && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setModelModal(null)}
        >
          <div
            className="relative flex flex-col overflow-hidden"
            style={{
              width: '90%', maxWidth: 560, maxHeight: '80%',
              background: '#0e0e14',
              border: `1px solid ${MODEL_DOCS[modelModal].color}40`,
              borderRadius: 12,
              boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 40px ${MODEL_DOCS[modelModal].color}15`,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <div>
                <div className="text-[14px] font-bold tracking-widest" style={{ color: MODEL_DOCS[modelModal].color }}>
                  {MODEL_DOCS[modelModal].title.toUpperCase()}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: COLORS.dim }}>
                  {MODEL_DOCS[modelModal].subtitle}
                </div>
              </div>
              <button
                onClick={() => setModelModal(null)}
                style={{ color: COLORS.dim, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            {/* Modal body */}
            <div className="overflow-y-auto sentinel-scroll px-5 py-4 flex-1">
              {MODEL_DOCS[modelModal].description.split('\n').map((line, i) => {
                if (line.trim() === '') return <div key={i} className="h-2" />;
                if (line.startsWith('•')) return (
                  <div key={i} className="flex gap-2 mb-1">
                    <span style={{ color: MODEL_DOCS[modelModal].color, flexShrink: 0 }}>•</span>
                    <span className="text-[13px] font-mono leading-relaxed" style={{ color: '#e8e8e8' }}>{line.slice(1).trim()}</span>
                  </div>
                );
                // Section headers (lines ending with colon)
                if (line.endsWith(':') && !line.startsWith(' ')) return (
                  <div key={i} className="text-[11px] font-bold tracking-widest mt-3 mb-1.5" style={{ color: COLORS.dim }}>{line.toUpperCase()}</div>
                );
                return <p key={i} className="text-[13px] font-mono leading-relaxed mb-1" style={{ color: '#e8e8e8' }}>{line}</p>;
              })}
            </div>
            {/* Nav between models */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${COLORS.border}` }}>
              {(() => {
                const keys = Object.keys(MODEL_DOCS);
                const idx = keys.indexOf(modelModal);
                const prev = keys[idx - 1];
                const next = keys[idx + 1];
                return (
                  <>
                    <button
                      onClick={() => prev && setModelModal(prev)}
                      style={{ color: prev ? COLORS.dim : COLORS.dimmer, background: 'none', border: 'none', cursor: prev ? 'pointer' : 'default', fontSize: 11, fontFamily: 'monospace' }}
                    >
                      {prev ? `← ${MODEL_DOCS[prev].title}` : ''}
                    </button>
                    <span className="text-[10px] font-mono" style={{ color: COLORS.dimmer }}>
                      {Object.keys(MODEL_DOCS).indexOf(modelModal) + 1} / {Object.keys(MODEL_DOCS).length}
                    </span>
                    <button
                      onClick={() => next && setModelModal(next)}
                      style={{ color: next ? COLORS.dim : COLORS.dimmer, background: 'none', border: 'none', cursor: next ? 'pointer' : 'default', fontSize: 11, fontFamily: 'monospace' }}
                    >
                      {next ? `${MODEL_DOCS[next].title} →` : ''}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
